import type {
  ParsedGameState,
  GameEvent,
  WsMessage,
  RiskLevel,
  BuildFocus,
  RecommendedItem,
  LiveTacticalOverrides,
} from "./types.js";
import type { LlmProvider } from "./llmProvider.js";
import type { RecommendationCallbacks } from "./recommendationEngine.js";

/**
 * Abstractions BridgeOrchestrator depends on, instead of the concrete
 * classes directly — completes DIP (the tsyringe wiring alone only gives
 * Inversion of Control, not Dependency Inversion). Bound to the concrete
 * singletons via `useToken` aliases in the composition root (index.ts), so
 * there is still exactly one instance of each — no duplicate construction.
 */

export interface IWsBroadcaster {
  broadcast(message: WsMessage): void;
  readonly clientCount: number;
}

export interface IEventDetector {
  detect(current: ParsedGameState): GameEvent[];
  reset(): void;
}

export interface IRecommendationEngine {
  setLlmProvider(provider: LlmProvider | null): void;
  setTokenBudget(budget: number): void;
  setRiskLevel(level: RiskLevel): void;
  setBuildFocus?(focus: BuildFocus): void;
  setPreferPassiveItems?(prefer: boolean): void;
  setHabitWarnings?(warnings: string[]): void;
  setLiveOverrides?(overrides: LiveTacticalOverrides): void;
  setVectorMemories?(memories: string[]): void;
  getLastRecommendedItems?(): RecommendedItem[];
  reset(): void;
  process(
    state: ParsedGameState,
    eventType: string,
    hasClients: boolean,
    callbacks: RecommendationCallbacks,
  ): Promise<void>;
}
