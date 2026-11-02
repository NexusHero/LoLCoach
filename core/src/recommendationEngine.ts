import { singleton } from "tsyringe";
import type { LlmProvider } from "./llmProvider.js";
import { CacheService } from "./cacheService.js";
import type {
  ParsedGameState,
  ItemRecommendation,
  WsTokenUsage,
  RiskLevel,
  BuildFocus,
  RecommendedItem,
  LiveTacticalOverrides,
} from "./types.js";
import { DEFAULT_RISK_LEVEL, DEFAULT_BUILD_FOCUS } from "./types.js";
import type { IRecommendationEngine } from "./interfaces.js";
import { Logger } from "./logger.js";
import { ddragon } from "./ddragonService.js";
import { PASSIVE_ITEM_ALTERNATIVES } from "./tacticalAnalyzer.js";

const SECONDARY_TRIGGER_COOLDOWN_SEC = 45;

export interface RecommendationCallbacks {
  onLlmBudgetExceeded: (sessionTokens: number, budget: number) => void;
  onLlmError: (msg: string) => void;
  onLlmSuccess: (rec: ItemRecommendation, tokenUsage?: WsTokenUsage) => void;
}

@singleton()
export class RecommendationEngine implements IRecommendationEngine {
  private llmProvider: LlmProvider | null = null;
  private readonly cache = new CacheService();
  private sessionInputTokens = 0;
  private sessionOutputTokens = 0;
  private tokenBudget = 0;
  private riskLevel: RiskLevel = DEFAULT_RISK_LEVEL;
  private buildFocus: BuildFocus = DEFAULT_BUILD_FOCUS;
  private preferPassiveItems = false;
  private habitWarnings: string[] = [];
  private liveOverrides: LiveTacticalOverrides | undefined;
  private vectorMemories: string[] = [];
  private lastRecommendedItems: RecommendedItem[] = [];
  private lastLlmGameTime = -999;

  setRiskLevel(level: RiskLevel): void {
    if (this.riskLevel !== level) {
      Logger.info(`[Engine] Risk level changed: ${this.riskLevel} → ${level}`);
      this.riskLevel = level;
    }
  }

  setBuildFocus(focus: BuildFocus): void {
    if (this.buildFocus !== focus) {
      Logger.info(`[Engine] Build focus changed: ${this.buildFocus} → ${focus}`);
      this.buildFocus = focus;
    }
  }

  setPreferPassiveItems(prefer: boolean): void {
    if (this.preferPassiveItems !== prefer) {
      Logger.info(`[Engine] Prefer passive items changed: ${this.preferPassiveItems} → ${prefer}`);
      this.preferPassiveItems = prefer;
    }
  }

  setHabitWarnings(warnings: string[]): void {
    this.habitWarnings = warnings;
  }

  setLiveOverrides(overrides: LiveTacticalOverrides): void {
    this.liveOverrides = overrides;
  }

  setVectorMemories(memories: string[]): void {
    this.vectorMemories = memories;
  }

  getLastRecommendedItems(): RecommendedItem[] {
    return this.lastRecommendedItems;
  }

  setLlmProvider(provider: LlmProvider | null): void {
    const oldName = this.llmProvider?.name ?? "none";
    const newName = provider?.name ?? "none";
    if (oldName !== newName) {
      Logger.info(`[Engine] LLM provider changed: ${oldName} → ${newName}`);
    }
    this.llmProvider = provider;
  }

  setTokenBudget(budget: number): void {
    this.tokenBudget = budget;
  }

  reset(): void {
    this.cache.clear();
    this.sessionInputTokens = 0;
    this.sessionOutputTokens = 0;
    this.liveOverrides = undefined;
    this.vectorMemories = [];
    this.lastRecommendedItems = [];
    this.lastLlmGameTime = -999;
  }

  private shouldTriggerLlm(state: ParsedGameState, eventType: string): boolean {
    if (
      eventType === "GAME_STARTED" ||
      eventType === "PLAYER_DIED" ||
      eventType === "MANUAL"
    ) {
      return true;
    }

    const elapsedGameSec = state.gameTime - this.lastLlmGameTime;
    if (elapsedGameSec < SECONDARY_TRIGGER_COOLDOWN_SEC) {
      return false;
    }

    if (eventType === "HIGH_GOLD_REACHED") {
      return state.activePlayer.currentGold >= 1400;
    }

    if (eventType === "OBJECTIVE_SETUP_WINDOW") {
      return true;
    }

    if (eventType === "ITEM_PURCHASED") {
      const enemyMajorSpike = state.enemies.some((e) =>
        e.items.some((i) => i.price >= 2600),
      );
      const localCompletedSpike = state.localPlayer.items.some(
        (i) =>
          i.price >= 2200 ||
          this.lastRecommendedItems.some((rec) => rec.id === i.itemID),
      );
      return enemyMajorSpike || localCompletedSpike;
    }

    return false;
  }

  async process(
    state: ParsedGameState,
    eventType: string,
    hasClients: boolean,
    callbacks: RecommendationCallbacks
  ): Promise<void> {
    const useLlm =
      this.llmProvider !== null &&
      hasClients &&
      this.shouldTriggerLlm(state, eventType);

    if (!useLlm) return;

    if (this.tokenBudget > 0 && this.sessionInputTokens >= this.tokenBudget) {
      Logger.warn(`[Engine] Session token budget exhausted (${this.sessionInputTokens}/${this.tokenBudget}). Skipping LLM.`);
      callbacks.onLlmBudgetExceeded(this.sessionInputTokens, this.tokenBudget);
      return;
    }

    const hasOverrides =
      this.liveOverrides !== undefined &&
      (Boolean(this.liveOverrides.laneOpponentOverride) ||
        Boolean(this.liveOverrides.campedStatus) ||
        Object.keys(this.liveOverrides.enemyBuildOverrides).length > 0 ||
        this.liveOverrides.tacticalNotes.length > 0);

    const overrideSig = hasOverrides
      ? JSON.stringify({
          l: this.liveOverrides?.laneOpponentOverride,
          c: this.liveOverrides?.campedStatus,
          b: this.liveOverrides?.enemyBuildOverrides,
          n: this.liveOverrides?.tacticalNotes,
        })
      : "";

    const cacheKey = this.cache.buildKey(
      state,
      this.riskLevel,
      this.buildFocus,
      this.preferPassiveItems,
      overrideSig,
    );
    const cached = this.cache.get(cacheKey);

    let llmAnalysis: Awaited<ReturnType<LlmProvider["getAnalysis"]>>;
    if (cached) {
      Logger.info(`[Engine] Cache HIT (${eventType})`);
      llmAnalysis = cached;
    } else {
      try {
        const hasExtraOptions =
          this.buildFocus !== DEFAULT_BUILD_FOCUS ||
          this.preferPassiveItems ||
          this.habitWarnings.length > 0 ||
          hasOverrides ||
          this.vectorMemories.length > 0;
        llmAnalysis = hasExtraOptions
          ? await this.llmProvider!.getAnalysis(state, this.riskLevel, {
              buildFocus: this.buildFocus,
              preferPassiveItems: this.preferPassiveItems,
              habitWarnings: this.habitWarnings,
              ...(hasOverrides && this.liveOverrides ? { liveOverrides: this.liveOverrides } : {}),
              ...(this.vectorMemories.length > 0 ? { vectorMemories: this.vectorMemories } : {}),
            })
          : await this.llmProvider!.getAnalysis(state, this.riskLevel);
        this.lastLlmGameTime = state.gameTime;
        if (llmAnalysis.tokenUsage) {
          this.sessionInputTokens += llmAnalysis.tokenUsage.input;
          this.sessionOutputTokens += llmAnalysis.tokenUsage.output;
        }
        this.cache.set(cacheKey, llmAnalysis);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        Logger.error(`[Engine] LLM failed for ${eventType}:`, msg);
        callbacks.onLlmError(msg);
        return;
      }
    }

    const ownedItemIds = new Set(state.localPlayer.items.map((i) => i.itemID));
    const seenIds = new Set<number>();
    const rawItems = (llmAnalysis.situationalItems ?? []).map((i) => {
      if (this.preferPassiveItems && PASSIVE_ITEM_ALTERNATIVES[i.id]) {
        const alt = PASSIVE_ITEM_ALTERNATIVES[i.id];
        return { ...i, id: alt.id, name: alt.name, reason: alt.reason };
      }
      return i;
    });

    const filteredItems = rawItems.filter((i) => {
      if (ownedItemIds.has(i.id)) return false;
      if (!ddragon.getItemInfo(i.id)) {
        Logger.warn(`[Rec] Dropping hallucinated item id=${i.id} name="${i.name}"`);
        return false;
      }
      if (seenIds.has(i.id)) return false;
      seenIds.add(i.id);
      return true;
    });

    this.lastRecommendedItems = filteredItems;

    const rec: ItemRecommendation = {
      items: filteredItems,
      reasoning: llmAnalysis.reasoning,
      strategy: llmAnalysis.strategy,
      source: "llm",
      provider: this.llmProvider!.name,
    };

    const tokenUsageInfo: WsTokenUsage | undefined = llmAnalysis.tokenUsage
      ? {
          lastInput: llmAnalysis.tokenUsage.input,
          lastOutput: llmAnalysis.tokenUsage.output,
          sessionInput: this.sessionInputTokens,
          sessionOutput: this.sessionOutputTokens,
        }
      : undefined;

    callbacks.onLlmSuccess(rec, tokenUsageInfo);
    Logger.info(`[Rec] llm (Trigger: ${eventType}): ${rec.items.map((i) => i.name).join(", ")}`);
  }
}
