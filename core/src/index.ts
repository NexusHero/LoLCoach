// reflect-metadata must be imported once, before any decorated class is
// loaded — tsyringe reads constructor parameter metadata it emits.
import "reflect-metadata";
import "dotenv/config";
import type { IncomingMessage } from "http";
import { WebSocketServer } from "ws";
import { container } from "tsyringe";
import { LiveClientPoller } from "./poller.js";
import { EventDetector } from "./eventDetector.js";
import { RecommendationEngine } from "./recommendationEngine.js";
import { BridgeWsServer } from "./wsServer.js";
import { BridgeOrchestrator } from "./orchestrator.js";
import { MessageRouter } from "./messageRouter.js";
import { createLlmProvider } from "./llmProvider.js";
import { ddragon } from "./ddragonService.js";
import { loadOrCreateSecret, secretFilePath } from "./secretManager.js";
import { config } from "./config.js";
import { Logger } from "./logger.js";
import {
  CLOCK_TOKEN,
  EVENT_DETECTOR_TOKEN,
  LLM_PROVIDER_TOKEN,
  ORCHESTRATOR_CONFIG_TOKEN,
  RECOMMENDATION_ENGINE_TOKEN,
  WS_BROADCASTER_TOKEN,
  WSS_TOKEN,
} from "./tokens.js";

// DDragon im Hintergrund initialisieren — kein blocking start
ddragon.init().catch((err) => Logger.error("[Main] DDragon init error:", err));

const LOCAL_SUMMONER = process.env.SUMMONER_NAME ?? "";
if (!LOCAL_SUMMONER) {
  Logger.warn("[Main] SUMMONER_NAME not set — falling back to first player.");
}

const WS_PORT = config.ws.port;
const DEFAULT_LLM_COOLDOWN_MS = config.llm.defaultCooldownMs;

// --- Parent Process Watchdog ---
const args = process.argv.slice(2);
const parentPidArg = args.find(a => a.startsWith('--parent-pid='));
if (parentPidArg) {
  const parentPid = parseInt(parentPidArg.split('=')[1]);
  if (!isNaN(parentPid)) {
    Logger.info(`[Main] Watching parent PID: ${parentPid}`);
    setInterval(() => {
      try {
        // signal 0 = existence check only (no actual signal sent)
        // NOTE: On Windows, process.kill(pid, 0) may throw EPERM when the parent
        // has a different integrity level, even if the parent is still alive.
        process.kill(parentPid, 0);
      } catch (e) {
        Logger.info(`[Main] Parent process ${parentPid} died. Exiting bridge...`);
        process.exit(0);
      }
    }, 2000);
  }
}

const secret = loadOrCreateSecret();
Logger.info(`[Main] Bridge secret stored at: ${secretFilePath()}`);

// --- DI container registrations ---
// tsyringe resolves the acyclic part of the graph (EventDetector,
// RecommendationEngine, BridgeOrchestrator, MessageRouter). Interfaces,
// unions and external (non-decorated) classes can't be resolved by
// reflected type, so they get an explicit value token registered here.
container.register(ORCHESTRATOR_CONFIG_TOKEN, {
  useValue: {
    summonerName: LOCAL_SUMMONER,
    llmCooldownMs: DEFAULT_LLM_COOLDOWN_MS,
  },
});
// tsyringe's `useValue` provider treats `null`/`undefined` as "not a value"
// (a `!= undefined` check) and would mis-register this as a class to
// construct. `useFactory` has no such check, so it's the safe way to
// register a token whose initial value is null.
container.register(LLM_PROVIDER_TOKEN, { useFactory: () => null });
container.register(CLOCK_TOKEN, { useValue: Date.now });
container.register(WSS_TOKEN, {
  useValue: new WebSocketServer({
    host: config.ws.host,
    port: WS_PORT,
    verifyClient: ({ req }: { req: IncomingMessage }) =>
      req.headers["authorization"] === `Bearer ${secret}`,
  }),
});

// BridgeOrchestrator depends on interfaces (DIP), not the concrete classes.
// `useToken` is an alias, not a separate registration — resolving the
// interface token redirects to `container.resolve(BridgeWsServer)` etc.,
// which (being @singleton()) returns the SAME cached instance used below.
// Registering these as `useClass` instead would silently construct a
// second, disconnected singleton per interface — exactly the bug already
// fixed once for BridgeWsServer's connection-listener duplication.
container.register(WS_BROADCASTER_TOKEN, { useToken: BridgeWsServer });
container.register(EVENT_DETECTOR_TOKEN, { useToken: EventDetector });
container.register(RECOMMENDATION_ENGINE_TOKEN, { useToken: RecommendationEngine });

// BridgeWsServer <-> MessageRouter is a genuine cycle (the router needs the
// orchestrator, which needs the wsServer, which needs to call the router on
// incoming messages) — no DI container resolves a true constructor cycle.
// Broken here via method injection: construct both through the container,
// then wire the one circular edge explicitly.
const wsServer = container.resolve(BridgeWsServer);
const orchestrator = container.resolve(BridgeOrchestrator);
const messageRouter = container.resolve(MessageRouter);
wsServer.setMessageHandler((ws, message) => messageRouter.handle(ws, message));

// Backward compatible: use ANTHROPIC_API_KEY from .env if present
if (process.env.ANTHROPIC_API_KEY) {
  createLlmProvider("claude", process.env.ANTHROPIC_API_KEY).then((provider) => {
    orchestrator.setLlmProvider(provider);
    Logger.info("[Main] Using Claude provider from ANTHROPIC_API_KEY env var.");
  });
}

const poller = new LiveClientPoller(
  (data) => orchestrator.handleGameData(data),
  (active) => {
    if (!active) {
      const autopsy = orchestrator.resetDetector();
      wsServer.broadcast({
        event: "GAME_INACTIVE",
        timestamp: Date.now(),
        ...(autopsy ? { postGameAutopsy: autopsy } : {}),
        playerProfile: orchestrator.getPlayerProfile(),
      });
    }
  },
);

poller.start();

process.on("SIGINT", () => {
  Logger.info("\n[Main] Shutting down bridge...");
  poller.stop();
  wsServer.close();
  process.exit(0);
});
