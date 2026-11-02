import { inject, singleton } from "tsyringe";
import { parseGameState } from "./parser.js";
import type { LlmProvider } from "./llmProvider.js";
import type {
  AllGameData,
  ParsedGameState,
  RiskLevel,
  BuildFocus,
  TacticalInsights,
  PostGameAutopsy,
  PlayerHabitProfile,
} from "./types.js";
import { DEFAULT_BUILD_FOCUS } from "./types.js";
import type { IEventDetector, IRecommendationEngine, IWsBroadcaster } from "./interfaces.js";
import { Logger } from "./logger.js";
import {
  CLOCK_TOKEN,
  EVENT_DETECTOR_TOKEN,
  LLM_PROVIDER_TOKEN,
  ORCHESTRATOR_CONFIG_TOKEN,
  RECOMMENDATION_ENGINE_TOKEN,
  WS_BROADCASTER_TOKEN,
} from "./tokens.js";
import {
  computePrimaryThreat,
  computeTeamDamageProfile,
  computeNextBestBuy,
  computeEnemyCooldowns,
} from "./tacticalAnalyzer.js";
import {
  computeObjectives,
  computeMacroAlerts,
  findObjectiveSetupTrigger,
} from "./macroTracker.js";
import { PlayerProfileService } from "./playerProfileService.js";

export interface OrchestratorConfig {
  summonerName: string;
  llmCooldownMs: number;
  tokenBudget?: number; // session input token budget; 0 or undefined = unlimited
}

@singleton()
export class BridgeOrchestrator {
  private lastState: ParsedGameState | null = null;
  private correlationCounter = 0;
  private buildFocus: BuildFocus = DEFAULT_BUILD_FOCUS;
  private preferPassiveItems = false;
  private lastObjectiveTriggerKey = "";
  private readonly profileService = new PlayerProfileService();

  constructor(
    @inject(WS_BROADCASTER_TOKEN) private readonly wsServer: IWsBroadcaster,
    @inject(EVENT_DETECTOR_TOKEN) private readonly eventDetector: IEventDetector,
    @inject(RECOMMENDATION_ENGINE_TOKEN) private readonly engine: IRecommendationEngine,
    @inject(LLM_PROVIDER_TOKEN) llmProvider: LlmProvider | null,
    @inject(ORCHESTRATOR_CONFIG_TOKEN) private readonly config: OrchestratorConfig,
    @inject(CLOCK_TOKEN) private readonly clock: () => number = Date.now,
  ) {
    this.engine.setLlmProvider(llmProvider);
    if (this.config.tokenBudget) {
      this.engine.setTokenBudget(this.config.tokenBudget);
    }
    this.profileService.load().catch(() => {});
  }

  private async computeTacticalInsights(state: ParsedGameState): Promise<TacticalInsights> {
    const telemetry = this.profileService.observeTick(state);
    const objectives = computeObjectives(state);
    const macroAlerts = computeMacroAlerts(state, objectives, telemetry.goldHoardingSeconds);
    const primaryThreat = computePrimaryThreat(state);
    const teamDamageProfile = computeTeamDamageProfile(state);
    const recommendedItems = this.engine.getLastRecommendedItems?.() ?? [];
    const nextBestBuy = computeNextBestBuy(state, recommendedItems);
    const enemyCooldowns = await computeEnemyCooldowns(state);

    return {
      ...(primaryThreat ? { primaryThreat } : {}),
      teamDamageProfile,
      ...(nextBestBuy ? { nextBestBuy } : {}),
      ...(enemyCooldowns ? { enemyCooldowns } : {}),
      macroAlerts,
      objectives,
      csPerMin: telemetry.csPerMin,
      targetCsPerMin: telemetry.targetCsPerMin,
      buildFocus: this.buildFocus,
      preferPassiveItems: this.preferPassiveItems,
    };
  }

  async handleGameData(raw: AllGameData): Promise<void> {
    const stateResult = parseGameState(raw, this.config.summonerName);
    if (!stateResult.ok) {
      Logger.warn(`[Orchestrator] Failed to parse game state: ${stateResult.error.message}`);
      return;
    }
    const state = stateResult.value;
    this.lastState = state;

    const profile = this.profileService.getProfile();
    this.engine.setHabitWarnings?.(profile.habitWarnings);

    let insights = await this.computeTacticalInsights(state);
    const events = this.eventDetector.detect(state);

    // Check Objective T-60s Setup Window trigger
    const setupObj = findObjectiveSetupTrigger(insights.objectives);
    if (setupObj) {
      const spawnMinuteBucket = Math.floor((state.gameTime + setupObj.secondsUntilSpawn) / 60);
      const triggerKey = `${setupObj.type}_${spawnMinuteBucket}`;
      if (triggerKey !== this.lastObjectiveTriggerKey) {
        this.lastObjectiveTriggerKey = triggerKey;
        await this.sendRecommendation(state, "OBJECTIVE_SETUP_WINDOW", insights);
      }
    }

    for (const event of events) {
      Logger.info(`[Event] ${event.type}`);

      const shouldRecommend =
        event.type === "GAME_STARTED" ||
        event.type === "ITEM_PURCHASED" ||
        event.type === "PLAYER_DIED" ||
        event.type === "HIGH_GOLD_REACHED";

      if (shouldRecommend) {
        await this.sendRecommendation(event.state, event.type, insights);
        const updatedNextBuy = computeNextBestBuy(
          state,
          this.engine.getLastRecommendedItems?.() ?? [],
        );
        if (updatedNextBuy) {
          insights = { ...insights, nextBestBuy: updatedNextBuy };
        }
      }

      this.wsServer.broadcast({
        event: event.type,
        timestamp: this.clock(),
        gameState: event.state,
        tacticalInsights: insights,
        playerProfile: profile,
      });
    }
  }

  private async sendRecommendation(
    state: ParsedGameState,
    eventType: string,
    insights?: TacticalInsights,
  ): Promise<void> {
    const correlationId = `${eventType}_${++this.correlationCounter}`;
    const hasClients = this.wsServer.clientCount > 0;

    await this.engine.process(state, eventType, hasClients, {
      onLlmBudgetExceeded: (sessionTokens, budget) => {
        this.wsServer.broadcast({
          event: "LLM_BUDGET_EXCEEDED",
          timestamp: this.clock(),
          sessionInputTokens: sessionTokens,
          budget,
        });
      },
      onLlmError: (msg) => {
        this.wsServer.broadcast({ event: "LLM_ERROR", timestamp: this.clock(), error: msg });
      },
      onLlmSuccess: (rec, tokenUsage) => {
        const nextBestBuy = computeNextBestBuy(state, rec.items);
        const enrichedInsights = insights
          ? { ...insights, ...(nextBestBuy ? { nextBestBuy } : {}) }
          : undefined;
        this.wsServer.broadcast({
          event: "RECOMMENDATION_UPDATE",
          timestamp: this.clock(),
          gameState: state,
          recommendation: rec,
          ...(enrichedInsights ? { tacticalInsights: enrichedInsights } : {}),
          correlationId,
          triggerEvent: eventType,
          tokenUsage,
        });
      },
    });
  }

  async triggerManualAnalysis(): Promise<void> {
    if (!this.lastState) {
      Logger.info("[Orchestrator] Manual analysis requested but no game state available.");
      return;
    }
    Logger.info("[Orchestrator] Manual analysis triggered.");
    const insights = await this.computeTacticalInsights(this.lastState);
    await this.sendRecommendation(this.lastState, "MANUAL", insights);
  }

  resetDetector(): PostGameAutopsy | undefined {
    const autopsy = this.profileService.finalizeMatch(this.clock());
    this.lastState = null;
    this.lastObjectiveTriggerKey = "";
    this.eventDetector.reset();
    this.engine.reset();
    return autopsy;
  }

  getPlayerProfile(): PlayerHabitProfile {
    return this.profileService.getProfile();
  }

  setTokenBudget(budget: number): void {
    this.config.tokenBudget = budget;
    this.engine.setTokenBudget(budget);
  }

  setSummonerName(name: string): void {
    if (this.config.summonerName !== name) {
      Logger.info(`[Orchestrator] Changing summoner name to '${name}'`);
      this.config.summonerName = name;
      this.resetDetector();
    }
  }

  setLlmProvider(provider: LlmProvider | null): void {
    this.engine.setLlmProvider(provider);
  }

  setRiskLevel(level: RiskLevel): void {
    this.engine.setRiskLevel(level);
  }

  setBuildFocus(focus: BuildFocus): void {
    this.buildFocus = focus;
    this.engine.setBuildFocus?.(focus);
  }

  setPreferPassiveItems(prefer: boolean): void {
    this.preferPassiveItems = prefer;
    this.engine.setPreferPassiveItems?.(prefer);
  }
}
