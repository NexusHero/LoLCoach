"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// reflect-metadata must be imported once, before any decorated class is
// loaded — tsyringe reads constructor parameter metadata it emits.
require("reflect-metadata");
require("dotenv/config");
const ws_1 = require("ws");
const tsyringe_1 = require("tsyringe");
const poller_js_1 = require("./poller.js");
const eventDetector_js_1 = require("./eventDetector.js");
const recommendationEngine_js_1 = require("./recommendationEngine.js");
const wsServer_js_1 = require("./wsServer.js");
const orchestrator_js_1 = require("./orchestrator.js");
const messageRouter_js_1 = require("./messageRouter.js");
const llmProvider_js_1 = require("./llmProvider.js");
const ddragonService_js_1 = require("./ddragonService.js");
const secretManager_js_1 = require("./secretManager.js");
const config_js_1 = require("./config.js");
const logger_js_1 = require("./logger.js");
const tokens_js_1 = require("./tokens.js");
// DDragon im Hintergrund initialisieren — kein blocking start
ddragonService_js_1.ddragon.init().catch((err) => logger_js_1.Logger.error("[Main] DDragon init error:", err));
const LOCAL_SUMMONER = process.env.SUMMONER_NAME ?? "";
if (!LOCAL_SUMMONER) {
    logger_js_1.Logger.warn("[Main] SUMMONER_NAME not set — falling back to first player.");
}
const WS_PORT = config_js_1.config.ws.port;
const DEFAULT_LLM_COOLDOWN_MS = config_js_1.config.llm.defaultCooldownMs;
// --- Parent Process Watchdog ---
const args = process.argv.slice(2);
const parentPidArg = args.find(a => a.startsWith('--parent-pid='));
if (parentPidArg) {
    const parentPid = parseInt(parentPidArg.split('=')[1]);
    if (!isNaN(parentPid)) {
        logger_js_1.Logger.info(`[Main] Watching parent PID: ${parentPid}`);
        setInterval(() => {
            try {
                // signal 0 = existence check only (no actual signal sent)
                // NOTE: On Windows, process.kill(pid, 0) may throw EPERM when the parent
                // has a different integrity level, even if the parent is still alive.
                process.kill(parentPid, 0);
            }
            catch (e) {
                logger_js_1.Logger.info(`[Main] Parent process ${parentPid} died. Exiting bridge...`);
                process.exit(0);
            }
        }, 2000);
    }
}
const secret = (0, secretManager_js_1.loadOrCreateSecret)();
logger_js_1.Logger.info(`[Main] Bridge secret stored at: ${(0, secretManager_js_1.secretFilePath)()}`);
// --- DI container registrations ---
// tsyringe resolves the acyclic part of the graph (EventDetector,
// RecommendationEngine, BridgeOrchestrator, MessageRouter). Interfaces,
// unions and external (non-decorated) classes can't be resolved by
// reflected type, so they get an explicit value token registered here.
tsyringe_1.container.register(tokens_js_1.ORCHESTRATOR_CONFIG_TOKEN, {
    useValue: {
        summonerName: LOCAL_SUMMONER,
        llmCooldownMs: DEFAULT_LLM_COOLDOWN_MS,
    },
});
// tsyringe's `useValue` provider treats `null`/`undefined` as "not a value"
// (a `!= undefined` check) and would mis-register this as a class to
// construct. `useFactory` has no such check, so it's the safe way to
// register a token whose initial value is null.
tsyringe_1.container.register(tokens_js_1.LLM_PROVIDER_TOKEN, { useFactory: () => null });
tsyringe_1.container.register(tokens_js_1.CLOCK_TOKEN, { useValue: Date.now });
tsyringe_1.container.register(tokens_js_1.WSS_TOKEN, {
    useValue: new ws_1.WebSocketServer({
        host: config_js_1.config.ws.host,
        port: WS_PORT,
        verifyClient: ({ req }) => req.headers["authorization"] === `Bearer ${secret}`,
    }),
});
// BridgeOrchestrator depends on interfaces (DIP), not the concrete classes.
// `useToken` is an alias, not a separate registration — resolving the
// interface token redirects to `container.resolve(BridgeWsServer)` etc.,
// which (being @singleton()) returns the SAME cached instance used below.
// Registering these as `useClass` instead would silently construct a
// second, disconnected singleton per interface — exactly the bug already
// fixed once for BridgeWsServer's connection-listener duplication.
tsyringe_1.container.register(tokens_js_1.WS_BROADCASTER_TOKEN, { useToken: wsServer_js_1.BridgeWsServer });
tsyringe_1.container.register(tokens_js_1.EVENT_DETECTOR_TOKEN, { useToken: eventDetector_js_1.EventDetector });
tsyringe_1.container.register(tokens_js_1.RECOMMENDATION_ENGINE_TOKEN, { useToken: recommendationEngine_js_1.RecommendationEngine });
// BridgeWsServer <-> MessageRouter is a genuine cycle (the router needs the
// orchestrator, which needs the wsServer, which needs to call the router on
// incoming messages) — no DI container resolves a true constructor cycle.
// Broken here via method injection: construct both through the container,
// then wire the one circular edge explicitly.
const wsServer = tsyringe_1.container.resolve(wsServer_js_1.BridgeWsServer);
const orchestrator = tsyringe_1.container.resolve(orchestrator_js_1.BridgeOrchestrator);
const messageRouter = tsyringe_1.container.resolve(messageRouter_js_1.MessageRouter);
wsServer.setMessageHandler((ws, message) => messageRouter.handle(ws, message));
// Backward compatible: use ANTHROPIC_API_KEY from .env if present
if (process.env.ANTHROPIC_API_KEY) {
    (0, llmProvider_js_1.createLlmProvider)("claude", process.env.ANTHROPIC_API_KEY).then((provider) => {
        orchestrator.setLlmProvider(provider);
        logger_js_1.Logger.info("[Main] Using Claude provider from ANTHROPIC_API_KEY env var.");
    });
}
const poller = new poller_js_1.LiveClientPoller((data) => orchestrator.handleGameData(data), (active) => {
    if (!active) {
        const autopsy = orchestrator.resetDetector();
        wsServer.broadcast({
            event: "GAME_INACTIVE",
            timestamp: Date.now(),
            ...(autopsy ? { postGameAutopsy: autopsy } : {}),
            playerProfile: orchestrator.getPlayerProfile(),
        });
    }
});
poller.start();
process.on("SIGINT", () => {
    logger_js_1.Logger.info("\n[Main] Shutting down bridge...");
    poller.stop();
    wsServer.close();
    process.exit(0);
});
