import { WebSocketServer } from "ws";
import WebSocket from "ws";
import { BridgeWsServer } from "../wsServer";
import { BridgeOrchestrator } from "../orchestrator";
import { EventDetector } from "../eventDetector";
import { RecommendationEngine } from "../recommendationEngine";
import { MessageRouter } from "../messageRouter";
import { makeRawGameData } from "./fixtures";
import type { WsMessage } from "../types";
import type { LlmProvider, LlmAnalysis } from "../llmProvider";

// Prevent SDK imports inside the real llmProvider module from loading.
jest.mock("../llmProvider", () => ({ createLlmProvider: jest.fn() }));

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Registers a one-shot event listener; the listener is NOT removed after firing
// because accumulated listeners are harmless (resolve is idempotent on settled
// promises). Register the promise BEFORE triggering the action to avoid races.
function waitForMessage(ws: WebSocket, eventName: string, timeoutMs = 2000): Promise<WsMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout waiting for "${eventName}"`)),
      timeoutMs,
    );
    ws.on("message", (data) => {
      const msg: WsMessage = JSON.parse(data.toString());
      if (msg.event === eventName) {
        clearTimeout(timer);
        resolve(msg);
      }
    });
  });
}

function collectMessages(ws: WebSocket, durationMs: number): Promise<WsMessage[]> {
  return new Promise((resolve) => {
    const messages: WsMessage[] = [];
    ws.on("message", (data) => messages.push(JSON.parse(data.toString())));
    setTimeout(() => resolve(messages), durationMs);
  });
}

const MOCK_ANALYSIS: LlmAnalysis = {
  reasoning: "Buy Thornmail against heavy AD",
  strategy: {
    winCondition: "early",
    summary: "Snowball early",
    lateGamePlan: "Close out before 30 min",
  },
  tokenUsage: { input: 60, output: 20 },
};

function makeMockProvider(analysis: LlmAnalysis = MOCK_ANALYSIS): LlmProvider {
  return {
    name: "mock-llm",
    listModels: jest.fn().mockResolvedValue([]),
    getAnalysis: jest.fn().mockResolvedValue(analysis),
  };
}

async function setupBridge(llmProvider: LlmProvider | null = null, tokenBudget?: number) {
  const wss = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await new Promise<void>((resolve) => wss.once("listening", resolve));
  const port = (wss.address() as { port: number }).port;

  let _router: MessageRouter;
  const wsServer = new BridgeWsServer(wss);
  wsServer.setMessageHandler((_ws, msg) => _router.handle(_ws, msg));
  const orchestrator = new BridgeOrchestrator(
    wsServer,
    new EventDetector(),
    new RecommendationEngine(),
    llmProvider,
    { summonerName: "TestPlayer", llmCooldownMs: 0, tokenBudget },
  );
  _router = new MessageRouter(orchestrator);

  return { wss, port, orchestrator };
}

async function closeBridge(wss: WebSocketServer): Promise<void> {
  await new Promise<void>((resolve) => wss.close(() => resolve()));
}

describe("Recommendation flow (e2e)", () => {
  describe("No LLM provider", () => {
    it("NoLlm_GameStarted_NoRecommendationFires", async () => {
      const { wss, port, orchestrator } = await setupBridge();
      const client = new WebSocket(`ws://127.0.0.1:${port}`);
      await waitForMessage(client, "CONNECTED");

      const collecting = collectMessages(client, 150);
      await orchestrator.handleGameData(makeRawGameData());
      const messages = await collecting;

      expect(messages.find((m) => m.event === "RECOMMENDATION")).toBeUndefined();
      expect(messages.find((m) => m.event === "RECOMMENDATION_UPDATE")).toBeUndefined();

      client.close();
      await closeBridge(wss);
    });
  });

  // ─── LLM mode ──────────────────────────────────────────────────────────────

  describe("LLM mode", () => {
    it("LlmFlow_GameStarted_OnlyLlmUpdateFires", async () => {
      const provider = makeMockProvider();
      const { wss, port, orchestrator } = await setupBridge(provider);
      const client = new WebSocket(`ws://127.0.0.1:${port}`);
      await waitForMessage(client, "CONNECTED");

      const updatePromise = waitForMessage(client, "RECOMMENDATION_UPDATE");
      await orchestrator.handleGameData(makeRawGameData());
      const update = await updatePromise;

      expect(update.recommendation!.source).toBe("llm");
      expect(update.recommendation!.reasoning).toBe("Buy Thornmail against heavy AD");

      client.close();
      await closeBridge(wss);
    });

    it("LlmFlow_TriggerAnalysis_LlmUpdateFires", async () => {
      const provider = makeMockProvider();
      const { wss, port, orchestrator } = await setupBridge(provider);
      const client = new WebSocket(`ws://127.0.0.1:${port}`);
      await waitForMessage(client, "CONNECTED");

      await orchestrator.handleGameData(makeRawGameData());
      await waitForMessage(client, "RECOMMENDATION_UPDATE");

      const updatePromise = waitForMessage(client, "RECOMMENDATION_UPDATE");
      client.send(JSON.stringify({ event: "TRIGGER_ANALYSIS" }));
      const update = await updatePromise;

      expect(update.recommendation!.source).toBe("llm");
      expect(update.recommendation!.reasoning).toBe("Buy Thornmail against heavy AD");
      expect(update.tokenUsage?.lastInput).toBe(60);
      expect(update.tokenUsage?.lastOutput).toBe(20);

      client.close();
      await closeBridge(wss);
    });

    it("LlmFlow_TriggerAnalysisTwice_SecondTriggerProducesNewUpdate", async () => {
      const provider = makeMockProvider();
      const { wss, port, orchestrator } = await setupBridge(provider);
      const client = new WebSocket(`ws://127.0.0.1:${port}`);
      await waitForMessage(client, "CONNECTED");

      await orchestrator.handleGameData(makeRawGameData());
      await waitForMessage(client, "RECOMMENDATION_UPDATE");

      client.send(JSON.stringify({ event: "TRIGGER_ANALYSIS" }));
      await waitForMessage(client, "RECOMMENDATION_UPDATE");

      const update2Promise = waitForMessage(client, "RECOMMENDATION_UPDATE");
      client.send(JSON.stringify({ event: "TRIGGER_ANALYSIS" }));
      const secondUpdate = await update2Promise;

      expect(secondUpdate.recommendation!.source).toBe("llm");

      client.close();
      await closeBridge(wss);
    });

    it("LlmFlow_BudgetExhausted_ManualTriggerEmitsBudgetExceeded", async () => {
      // Budget of 50 tokens; first LLM call (on game start) costs 60 → exhausted.
      const provider = makeMockProvider({
        ...MOCK_ANALYSIS,
        tokenUsage: { input: 60, output: 20 },
      });
      const { wss, port, orchestrator } = await setupBridge(provider, 50);
      const client = new WebSocket(`ws://127.0.0.1:${port}`);
      await waitForMessage(client, "CONNECTED");

      await orchestrator.handleGameData(makeRawGameData());
      await waitForMessage(client, "RECOMMENDATION_UPDATE"); // 60 tokens consumed — now exceeds budget of 50

      // Manual trigger — 60 >= 50 → LLM is blocked, LLM_BUDGET_EXCEEDED emitted
      const collecting = collectMessages(client, 300);
      client.send(JSON.stringify({ event: "TRIGGER_ANALYSIS" }));
      const messages = await collecting;

      const budgetMsg = messages.find((m) => m.event === "LLM_BUDGET_EXCEEDED");
      expect(budgetMsg).toBeDefined();
      expect(budgetMsg!.sessionInputTokens).toBe(60);
      expect(messages.find((m) => m.event === "RECOMMENDATION_UPDATE")).toBeUndefined();

      client.close();
      await closeBridge(wss);
    });
  });
});
