import { WebSocketServer } from "ws";
import WebSocket from "ws";
import { BridgeWsServer } from "../wsServer";
import { BridgeOrchestrator } from "../orchestrator";
import { EventDetector } from "../eventDetector";
import { RecommendationEngine } from "../recommendationEngine";
import { MessageRouter } from "../messageRouter";
import { makeRawGameData, makePlayer } from "./fixtures";
import type { WsMessage } from "../types";

// System tests: wire together all real components the same way index.ts does.
// Uses injected fetcher and random port — no real network I/O, no process spawning.

jest.mock("../llmProvider", () => ({
  createLlmProvider: jest.fn().mockResolvedValue({ name: "mock-provider", getAnalysis: jest.fn() }),
}));

function waitForMessage(ws: WebSocket, eventName: string, timeoutMs = 2000): Promise<WsMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for event "${eventName}"`)), timeoutMs);
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

describe("System: Full Bridge Wiring (e2e)", () => {
  let wss: WebSocketServer;
  let port: number;
  let orchestrator: BridgeOrchestrator;
  let wsServer: BridgeWsServer;
  let messageRouter: MessageRouter;

  beforeEach(async () => {
    wss = new WebSocketServer({ host: "127.0.0.1", port: 0 });
    await new Promise<void>((resolve) => wss.once("listening", resolve));
    port = (wss.address() as any).port;

    // Mirror the closure pattern from index.ts
    let _orchestrator: BridgeOrchestrator;
    let _messageRouter: MessageRouter;

    wsServer = new BridgeWsServer(wss);
    wsServer.setMessageHandler((_ws, msg) => _messageRouter.handle(_ws, msg));

    _orchestrator = new BridgeOrchestrator(
      wsServer,
      new EventDetector(),
      new RecommendationEngine(),
      null,
      { summonerName: "TestPlayer", llmCooldownMs: 0 },
    );

    _messageRouter = new MessageRouter(_orchestrator);
    orchestrator = _orchestrator;
    messageRouter = _messageRouter;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => wss.close(() => resolve()));
  });

  it("system_ClientConnects_ReceivesConnectedEvent", async () => {
    const client = new WebSocket(`ws://127.0.0.1:${port}`);

    const msg = await waitForMessage(client, "CONNECTED");

    expect(msg.event).toBe("CONNECTED");
    expect(msg.timestamp).toBeGreaterThan(0);
    client.close();
  });

  it("system_GameDataHandled_ClientReceivesGameStartedOnly_NoLlm", async () => {
    const client = new WebSocket(`ws://127.0.0.1:${port}`);
    await waitForMessage(client, "CONNECTED");
    const collecting = collectMessages(client, 200);

    await orchestrator.handleGameData(makeRawGameData());

    const messages = await collecting;
    const events = messages.map((m) => m.event);
    expect(events).toContain("GAME_STARTED");
    expect(events).not.toContain("RECOMMENDATION_UPDATE");
    client.close();
  });

  it("system_ClientSendsSetSummoner_OrchestratorUpdatesSummonerName", async () => {
    const client = new WebSocket(`ws://127.0.0.1:${port}`);
    await waitForMessage(client, "CONNECTED");

    client.send(JSON.stringify({ event: "SET_SUMMONER", summonerName: "Faker" }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    const player = makePlayer({ summonerName: "Faker", team: "ORDER" });
    await orchestrator.handleGameData(makeRawGameData([player]));
    const collecting = collectMessages(client, 100);
    const messages = await collecting;

    const gameStarted = messages.find((m) => m.event === "GAME_STARTED");
    expect(gameStarted?.gameState?.localPlayer.summonerName).toBe("Faker");
    client.close();
  });

  it("system_ClientSendsTriggerAnalysis_NoLlm_NoBroadcast", async () => {
    const client = new WebSocket(`ws://127.0.0.1:${port}`);
    await waitForMessage(client, "CONNECTED");

    await orchestrator.handleGameData(makeRawGameData());
    await waitForMessage(client, "GAME_STARTED");

    const collecting = collectMessages(client, 200);
    client.send(JSON.stringify({ event: "TRIGGER_ANALYSIS" }));
    const messages = await collecting;

    expect(messages.find((m) => m.event === "RECOMMENDATION_UPDATE")).toBeUndefined();
    client.close();
  });

  it("system_ClientSendsMalformedJson_ServerStaysAlive", async () => {
    const client = new WebSocket(`ws://127.0.0.1:${port}`);
    await waitForMessage(client, "CONNECTED");

    client.send("not json at all {{{");
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Server is still alive — a second client can connect and receive CONNECTED
    const client2 = new WebSocket(`ws://127.0.0.1:${port}`);
    const msg = await waitForMessage(client2, "CONNECTED");
    expect(msg.event).toBe("CONNECTED");

    client.close();
    client2.close();
  });

  it("system_SetLlmProviderWithoutApiKey_SetsProviderNull_NoRecommendation", async () => {
    const client = new WebSocket(`ws://127.0.0.1:${port}`);
    await waitForMessage(client, "CONNECTED");

    client.send(JSON.stringify({ event: "SET_LLM_PROVIDER" }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    // After disabling provider, no recommendation fires
    const collecting = collectMessages(client, 200);
    await orchestrator.handleGameData(makeRawGameData());
    const messages = await collecting;
    expect(messages.find((m) => m.event === "RECOMMENDATION_UPDATE")).toBeUndefined();
    client.close();
  });

  it("system_ClientSendsSetRiskLevel_PropagatesToGetAnalysisCall", async () => {
    const { createLlmProvider } = jest.requireMock("../llmProvider") as {
      createLlmProvider: jest.Mock;
    };
    const getAnalysis = jest.fn().mockResolvedValue({
      reasoning: "",
      strategy: { winCondition: "mid", summary: "", lateGamePlan: "" },
    });
    createLlmProvider.mockResolvedValue({ name: "mock-provider", getAnalysis });

    const client = new WebSocket(`ws://127.0.0.1:${port}`);
    await waitForMessage(client, "CONNECTED");

    client.send(JSON.stringify({ event: "SET_LLM_PROVIDER", provider: "claude", apiKey: "sk-test" }));
    client.send(JSON.stringify({ event: "SET_RISK_LEVEL", riskLevel: "risky" }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    await orchestrator.handleGameData(makeRawGameData());
    await waitForMessage(client, "RECOMMENDATION_UPDATE");

    expect(getAnalysis).toHaveBeenCalledWith(expect.anything(), "risky");
    client.close();
  });
});
