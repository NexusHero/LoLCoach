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
  CoachExchange,
  RolePosition,
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
  findLaneOpponent,
} from "./tacticalAnalyzer.js";
import {
  computeObjectives,
  computeMacroAlerts,
  findObjectiveSetupTrigger,
} from "./macroTracker.js";
import { PlayerProfileService } from "./playerProfileService.js";
import { VectorMemoryService, type EmbeddingConfig } from "./vectorMemoryService.js";
import { TacticalCommandService } from "./tacticalCommandService.js";

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
  private readonly vectorMemory = new VectorMemoryService();
  private readonly commandService = new TacticalCommandService(this.vectorMemory);

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
    this.vectorMemory.load().catch(() => {});
  }

  private async computeTacticalInsights(state: ParsedGameState): Promise<TacticalInsights> {
    const telemetry = this.profileService.observeTick(state);
    const liveOverrides = this.commandService.getOverrides(state.gameTime);
    const lastCoachExchange = this.commandService.getLastExchange();
    const objectives = computeObjectives(state);
    const macroAlerts = computeMacroAlerts(
      state,
      objectives,
      telemetry.goldHoardingSeconds,
      liveOverrides.campedStatus ?? "normal",
    );
    const primaryThreat = computePrimaryThreat(state);
    const teamDamageProfile = computeTeamDamageProfile(state, liveOverrides.enemyBuildOverrides);
    const recommendedItems = this.engine.getLastRecommendedItems?.() ?? [];
    const nextBestBuy = computeNextBestBuy(state, recommendedItems, this.preferPassiveItems);
    const enemyCooldowns = await computeEnemyCooldowns(state, liveOverrides.laneOpponentOverride);

    this.engine.setLiveOverrides?.(liveOverrides);

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
      liveOverrides,
      ...(lastCoachExchange ? { lastCoachExchange } : {}),
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

    // Retrieve Vector RAG matchup memories when a match starts
    if (events.some((e) => e.type === "GAME_STARTED")) {
      const myPos = (state.localPlayer.position || "UNKNOWN") as RolePosition;
      const opp = findLaneOpponent(state, myPos, insights.liveOverrides?.laneOpponentOverride);
      const memories = await this.vectorMemory.searchRelevantMemories(
        `${state.localPlayer.championName} vs ${opp?.championName ?? ""}`,
        state.localPlayer.championName,
        opp?.championName,
        3,
      );
      this.engine.setVectorMemories?.(memories);
    }

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
          this.preferPassiveItems,
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
        const nextBestBuy = computeNextBestBuy(state, rec.items, this.preferPassiveItems);
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

  async handleCoachCommand(text: string): Promise<CoachExchange> {
    const { exchange, shouldReevaluate } = await this.commandService.executeCommand(
      text,
      this.lastState,
      this.clock,
    );

    if (exchange.uiMutation) {
      if (exchange.uiMutation.riskLevel) this.setRiskLevel(exchange.uiMutation.riskLevel);
      if (exchange.uiMutation.buildFocus) this.setBuildFocus(exchange.uiMutation.buildFocus);
      if (exchange.uiMutation.preferPassiveItems !== undefined) {
        this.setPreferPassiveItems(exchange.uiMutation.preferPassiveItems);
      }
    }

    const insights = this.lastState ? await this.computeTacticalInsights(this.lastState) : undefined;
    this.wsServer.broadcast({
      event: "COACH_COMMAND_RESULT",
      timestamp: this.clock(),
      ...(this.lastState ? { gameState: this.lastState } : {}),
      ...(insights ? { tacticalInsights: insights } : {}),
      coachExchange: exchange,
    });

    if (shouldReevaluate && this.lastState && insights) {
      await this.sendRecommendation(this.lastState, "MANUAL", insights);
    }

    return exchange;
  }

  async handleClearOverride(key: string): Promise<void> {
    const cleared = this.commandService.clearOverride(key);
    if (!cleared) return;
    if (this.lastState) {
      const insights = await this.computeTacticalInsights(this.lastState);
      this.wsServer.broadcast({
        event: "GAME_TICK",
        timestamp: this.clock(),
        gameState: this.lastState,
        tacticalInsights: insights,
      });
      await this.sendRecommendation(this.lastState, "MANUAL", insights);
    }
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
    const prevState = this.lastState;
    const autopsy = this.profileService.finalizeMatch(this.clock());
    if (autopsy) {
      const myPos = (prevState?.localPlayer.position || "UNKNOWN") as RolePosition;
      const opp = prevState
        ? findLaneOpponent(prevState, myPos, this.commandService.getOverrides().laneOpponentOverride)
        : undefined;
      this.vectorMemory.storeAutopsy(autopsy, opp?.championName).catch(() => {});
    }
    this.lastState = null;
    this.lastObjectiveTriggerKey = "";
    this.commandService.resetMatch();
    this.eventDetector.reset();
    this.engine.reset();
    return autopsy;
  }

  getPlayerProfile(): PlayerHabitProfile {
    return this.profileService.getProfile();
  }

  getVectorMemoryService(): VectorMemoryService {
    return this.vectorMemory;
  }

  setEmbeddingConfig(config: EmbeddingConfig): void {
    this.vectorMemory.setEmbeddingConfig(config);
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
