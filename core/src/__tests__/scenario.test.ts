import { WebSocketServer } from "ws";
import WebSocket from "ws";
import { BridgeWsServer } from "../wsServer.js";
import { BridgeOrchestrator } from "../orchestrator.js";
import { EventDetector } from "../eventDetector.js";
import { RecommendationEngine } from "../recommendationEngine.js";
import { MessageRouter } from "../messageRouter.js";
import { LiveClientPoller } from "../poller.js";
import type { DataFetcher } from "../poller.js";
import { buildGameScenario } from "./gameScenario.js";
import type { WsMessage } from "../types.js";

// System tests: full game scenario pumped through the real pipeline.
// Two layers:
//   1. Direct orchestrator feed — semantic event correctness, no fake timers.
//   2. Full poller pipeline     — real LiveClientPoller + fake timers, verifies
//      the poller→orchestrator→WS chain including GAME_INACTIVE signaling.

jest.mock("../llmProvider.js", () => ({
  createLlmProvider: jest.fn().mockResolvedValue({
    name: "mock",
    getAnalysis: jest.fn().mockResolvedValue({
      reasoning: "mock reasoning",
      strategy: { winCondition: "mid", summary: "s", lateGamePlan: "b" },
    }),
  }),
}));

function waitForMessage(ws: WebSocket, eventName: string, timeoutMs = 3000): Promise<WsMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout waiting for WS event "${eventName}"`)),
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

function buildStack() {
  let _orchestrator: BridgeOrchestrator;
  let _router: MessageRouter;

  const wss = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  const wsServer = new BridgeWsServer(wss);
  wsServer.setMessageHandler((_ws, msg) => _router.handle(_ws, msg));

  _orchestrator = new BridgeOrchestrator(wsServer, new EventDetector(), new RecommendationEngine(), null, {
    summonerName: "TestPlayer",
    llmCooldownMs: 0,
  });
  _router = new MessageRouter(_orchestrator);

  return { wss, wsServer, orchestrator: _orchestrator };
}

// ── 1. Direct Orchestrator Feed ────────────────────────────────────────────

describe("System: Game Scenario — Orchestrator Pipeline", () => {
  let wss: WebSocketServer;
  let port: number;
  let orchestrator: BridgeOrchestrator;

  beforeEach(async () => {
    const stack = buildStack();
    wss = stack.wss;
    orchestrator = stack.orchestrator;
    await new Promise<void>((resolve) => wss.once("listening", resolve));
    port = (wss.address() as { port: number }).port;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => wss.close(() => resolve()));
  });

  async function feedScenario(orch: BridgeOrchestrator) {
    for (const frame of buildGameScenario()) {
      await orch.handleGameData(frame);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  it("scenario_FullGameSequence_EmitsAllExpectedGameEvents", async () => {
    // Arrange
    const client = new WebSocket(`ws://127.0.0.1:${port}`);
    await waitForMessage(client, "CONNECTED");
    const received: WsMessage[] = [];
    client.on("message", (data) => received.push(JSON.parse(data.toString())));

    // Act
    await feedScenario(orchestrator);

    // Assert — game events
    const events = received.map((m) => m.event);
    expect(events).toContain("GAME_STARTED");
    expect(events).toContain("GAME_TICK");
    expect(events).toContain("ITEM_PURCHASED");
    expect(events).toContain("LEVEL_UP");
    expect(events).toContain("PLAYER_DIED");
    expect(events).toContain("HIGH_GOLD_REACHED");

    // Without LLM: no recommendations fire
    expect(received.filter((m) => m.event === "RECOMMENDATION_UPDATE")).toHaveLength(0);

    client.close();
  });

  it("scenario_EnemyBuysItem_ItemPurchasedEventFires", async () => {
    // Arrange
    const client = new WebSocket(`ws://127.0.0.1:${port}`);
    await waitForMessage(client, "CONNECTED");
    const received: WsMessage[] = [];
    client.on("message", (data) => received.push(JSON.parse(data.toString())));

    // Act — feed up to and including frame 2 (ITEM_PURCHASED)
    for (const frame of buildGameScenario().slice(0, 3)) {
      await orchestrator.handleGameData(frame);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    // Assert — ITEM_PURCHASED fires after GAME_STARTED
    const events = received.map((m) => m.event);
    const gameStartedIdx = events.indexOf("GAME_STARTED");
    const itemIdx = events.lastIndexOf("ITEM_PURCHASED");
    expect(gameStartedIdx).toBeGreaterThan(-1);
    expect(itemIdx).toBeGreaterThan(gameStartedIdx);

    client.close();
  });

  it("scenario_LocalPlayerDies_PlayerDiedEventFiresWithDeadState", async () => {
    // Arrange
    const client = new WebSocket(`ws://127.0.0.1:${port}`);
    await waitForMessage(client, "CONNECTED");
    const received: WsMessage[] = [];
    client.on("message", (data) => received.push(JSON.parse(data.toString())));

    // Act — feed through frame 4 (PLAYER_DIED)
    for (const frame of buildGameScenario().slice(0, 5)) {
      await orchestrator.handleGameData(frame);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    // Assert — PLAYER_DIED event carries the dead state
    const deathEvent = received
      .filter((m) => m.event === "PLAYER_DIED")
      .find((r) => r.gameState?.localPlayer.isDead === true);
    expect(deathEvent).toBeDefined();

    client.close();
  });

  it("scenario_GoldThresholdCrossed_HighGoldEventEmitted", async () => {
    // Arrange
    const client = new WebSocket(`ws://127.0.0.1:${port}`);
    await waitForMessage(client, "CONNECTED");
    const received: WsMessage[] = [];
    client.on("message", (data) => received.push(JSON.parse(data.toString())));

    // Act — full scenario
    await feedScenario(orchestrator);

    // Assert — HIGH_GOLD_REACHED event present
    expect(received.map((m) => m.event)).toContain("HIGH_GOLD_REACHED");

    client.close();
  });
});

// ── 2. Full Poller Pipeline ────────────────────────────────────────────────

describe("System: Game Scenario — Full Poller Pipeline", () => {
  let wss: WebSocketServer;
  let port: number;
  let orchestrator: BridgeOrchestrator;
  let wsServer: BridgeWsServer;

  beforeEach(async () => {
    const stack = buildStack();
    wss = stack.wss;
    wsServer = stack.wsServer;
    orchestrator = stack.orchestrator;
    await new Promise<void>((resolve) => wss.once("listening", resolve));
    port = (wss.address() as { port: number }).port;

    // Fake setTimeout/setInterval but leave I/O primitives untouched so the
    // WS socket can still deliver messages to the client.
    jest.useFakeTimers({ doNotFake: ["setImmediate", "queueMicrotask", "nextTick"] });
  });

  afterEach(async () => {
    jest.useRealTimers();
    await new Promise<void>((resolve) => wss.close(() => resolve()));
  });

  function makeScenarioFetcher(frames: ReturnType<typeof buildGameScenario>, throwAfterFrames = false): DataFetcher {
    let idx = 0;
    return () => {
      if (idx < frames.length) return Promise.resolve(frames[idx++]);
      if (throwAfterFrames) return Promise.reject(new Error("Game ended"));
      return Promise.resolve(frames[frames.length - 1]); // repeat last frame
    };
  }

  async function advanceThroughFrames(n: number) {
    // Frame 0 fires immediately from poller.start()
    await jest.advanceTimersByTimeAsync(0);
    for (let i = 1; i < n; i++) {
      await jest.advanceTimersByTimeAsync(1000);
    }
  }

  it("scenario_PollerFeedsAllFrames_AllGameEventsReachWsClient", async () => {
    // Arrange
    const frames = buildGameScenario();
    const poller = new LiveClientPoller(
      (data) => orchestrator.handleGameData(data),
      (active) => {
        if (!active) {
          orchestrator.resetDetector();
          wsServer.broadcast({ event: "GAME_INACTIVE", timestamp: Date.now() });
        }
      },
      makeScenarioFetcher(frames),
    );

    const client = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>((resolve) => client.once("open", resolve));
    const received: WsMessage[] = [];
    client.on("message", (data) => received.push(JSON.parse(data.toString())));

    // Act — advance through all 7 frames
    poller.start();
    await advanceThroughFrames(frames.length);
    poller.stop();

    // Drain: switch to real timers so socket I/O can deliver pending messages
    jest.useRealTimers();
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Assert
    const events = received.map((m) => m.event);
    expect(events).toContain("GAME_STARTED");
    expect(events).toContain("ITEM_PURCHASED");
    expect(events).toContain("PLAYER_DIED");
    expect(events).toContain("HIGH_GOLD_REACHED");
    expect(received.filter((m) => m.event === "RECOMMENDATION_UPDATE")).toHaveLength(0);

    client.close();
  });

  it("scenario_PollerExhaustsFrames_BroadcastsGameInactiveAfterThreeConsecutiveFailures", async () => {
    // Arrange — fetcher throws once all frames are consumed
    const frames = buildGameScenario();
    const poller = new LiveClientPoller(
      (data) => orchestrator.handleGameData(data),
      (active) => {
        if (!active) {
          orchestrator.resetDetector();
          wsServer.broadcast({ event: "GAME_INACTIVE", timestamp: Date.now() });
        }
      },
      makeScenarioFetcher(frames, true),
    );

    const client = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>((resolve) => client.once("open", resolve));
    const received: WsMessage[] = [];
    client.on("message", (data) => received.push(JSON.parse(data.toString())));

    // Act — all game frames + MAX_POLL_FAILURES (3) extra ticks
    poller.start();
    await advanceThroughFrames(frames.length + 3);
    poller.stop();

    jest.useRealTimers();
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Assert — GAME_INACTIVE arrives after all game events
    const events = received.map((m) => m.event);
    expect(events).toContain("GAME_INACTIVE");
    expect(events.indexOf("GAME_INACTIVE")).toBeGreaterThan(
      events.indexOf("HIGH_GOLD_REACHED"),
    );

    client.close();
  });
});
