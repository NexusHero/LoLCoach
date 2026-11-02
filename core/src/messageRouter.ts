import type { WebSocket } from "ws";
import { inject, singleton } from "tsyringe";
import { BridgeOrchestrator } from "./orchestrator.js";
import { Logger } from "./logger.js";
import type { WsMessage } from "./types.js";

import { createLlmProvider } from "./llmProvider.js";
import type { ProviderType } from "./llmProvider.js";
import type { RiskLevel, BuildFocus } from "./types.js";

const VALID_RISK_LEVELS: readonly RiskLevel[] = ["safe", "normal", "risky"];
const VALID_BUILD_FOCUSES: readonly BuildFocus[] = ["auto", "burst", "dps", "bruiser", "split"];

type MessageHandler = (ws: WebSocket, message: Record<string, unknown>) => Promise<void> | void;

@singleton()
export class MessageRouter {
  // Dispatch table instead of an if-chain on message.event — adding a new
  // event type means adding a map entry, not editing existing branches (OCP).
  // Built in the constructor body (not as a field initializer): field
  // initializers run in declaration order, and this one must run *after*
  // the handler arrow-function fields below are assigned, not before.
  private readonly handlers: ReadonlyMap<string, MessageHandler>;

  // Explicit @inject (not reflected design:paramtypes) — see comment in
  // orchestrator.ts: `tsx`/esbuild doesn't emit that metadata.
  constructor(@inject(BridgeOrchestrator) private readonly orchestrator: BridgeOrchestrator) {
    this.handlers = new Map([
      ["SET_SUMMONER", this.handleSetSummoner],
      ["TRIGGER_ANALYSIS", this.handleTriggerAnalysis],
      ["SET_LLM_PROVIDER", this.handleSetLlmProvider],
      ["SET_RISK_LEVEL", this.handleSetRiskLevel],
      ["SET_BUILD_FOCUS", this.handleSetBuildFocus],
      ["SET_PREFER_PASSIVE_ITEMS", this.handleSetPreferPassiveItems],
      ["GET_MODELS", this.handleGetModels],
      ["VALIDATE_KEY", this.handleValidateKey],
    ]);
  }

  async handle(ws: WebSocket, message: Record<string, unknown>): Promise<void> {
    const event = message.event;
    if (typeof event !== "string") return;

    const handler = this.handlers.get(event);
    if (!handler) return;

    await handler(ws, message);
  }

  private handleSetSummoner: MessageHandler = (_ws, message) => {
    if (typeof message.summonerName === "string") {
      this.orchestrator.setSummonerName(message.summonerName);
    }
  };

  private handleTriggerAnalysis: MessageHandler = async () => {
    await this.orchestrator.triggerManualAnalysis();
  };

  private handleSetRiskLevel: MessageHandler = (_ws, message) => {
    const level = message.riskLevel;
    if (typeof level === "string" && VALID_RISK_LEVELS.includes(level as RiskLevel)) {
      this.orchestrator.setRiskLevel(level as RiskLevel);
    } else {
      Logger.warn(`[MessageRouter] Ignoring invalid risk level: ${String(level)}`);
    }
  };

  private handleSetBuildFocus: MessageHandler = (_ws, message) => {
    const focus = message.buildFocus;
    if (typeof focus === "string" && VALID_BUILD_FOCUSES.includes(focus as BuildFocus)) {
      this.orchestrator.setBuildFocus(focus as BuildFocus);
    } else {
      Logger.warn(`[MessageRouter] Ignoring invalid build focus: ${String(focus)}`);
    }
  };

  private handleSetPreferPassiveItems: MessageHandler = (_ws, message) => {
    if (typeof message.preferPassiveItems === "boolean") {
      this.orchestrator.setPreferPassiveItems(message.preferPassiveItems);
    }
  };

  private handleGetModels: MessageHandler = async (ws, message) => {
    const providerType = message.provider as ProviderType | undefined;
    const apiKey = message.apiKey as string | undefined;

    if (!providerType || !apiKey) {
      ws.send(JSON.stringify({ event: "MODELS_ERROR", error: "Provider and API key are required" }));
      return;
    }

    try {
      const provider = await createLlmProvider(providerType, apiKey);
      const models = await provider.listModels();
      ws.send(JSON.stringify({ event: "MODELS_AVAILABLE", provider: providerType, models }));
    } catch (err) {
      ws.send(JSON.stringify({ event: "MODELS_ERROR", error: err instanceof Error ? err.message : String(err) }));
    }
  };

  private handleValidateKey: MessageHandler = async (ws, message) => {
    const providerType = message.provider as ProviderType | undefined;
    const apiKey = message.apiKey as string | undefined;

    if (!providerType || !apiKey) {
      ws.send(JSON.stringify({ event: "KEY_INVALID", error: "Provider and API key are required" }));
      return;
    }

    try {
      const provider = await createLlmProvider(providerType, apiKey);
      await provider.listModels();
      ws.send(JSON.stringify({ event: "KEY_VALID", provider: providerType }));
    } catch (err) {
      ws.send(JSON.stringify({ event: "KEY_INVALID", provider: providerType, error: err instanceof Error ? err.message : String(err) }));
    }
  };

  private handleSetLlmProvider: MessageHandler = async (_ws, message) => {
    const providerType = message.provider as ProviderType | undefined;
    const apiKey = message.apiKey as string | undefined;
    const model = message.model as string | undefined;
    const tokenBudget = typeof message.tokenBudget === "number" ? message.tokenBudget : 0;

    this.orchestrator.setTokenBudget(tokenBudget);

    if (!providerType || !apiKey) {
      Logger.info("[MessageRouter] LLM provider disabled.");
      this.orchestrator.setLlmProvider(null);
      return;
    }

    try {
      const provider = await createLlmProvider(providerType, apiKey, model);
      this.orchestrator.setLlmProvider(provider);
    } catch (err) {
      Logger.error("[MessageRouter] Failed to create LLM provider:", err);
      this.orchestrator.setLlmProvider(null);
    }
  };
}
