"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const ws_2 = __importDefault(require("ws"));
const wsServer_1 = require("../wsServer");
const orchestrator_1 = require("../orchestrator");
const eventDetector_1 = require("../eventDetector");
const recommendationEngine_1 = require("../recommendationEngine");
const messageRouter_1 = require("../messageRouter");
const fixtures_1 = require("./fixtures");
// System tests: wire together all real components the same way index.ts does.
// Uses injected fetcher and random port — no real network I/O, no process spawning.
jest.mock("../llmProvider", () => ({
    createLlmProvider: jest.fn().mockResolvedValue({ name: "mock-provider", getAnalysis: jest.fn() }),
}));
function waitForMessage(ws, eventName, timeoutMs = 2000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timeout waiting for event "${eventName}"`)), timeoutMs);
        ws.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.event === eventName) {
                clearTimeout(timer);
                resolve(msg);
            }
        });
    });
}
function collectMessages(ws, durationMs) {
    return new Promise((resolve) => {
        const messages = [];
        ws.on("message", (data) => messages.push(JSON.parse(data.toString())));
        setTimeout(() => resolve(messages), durationMs);
    });
}
describe("System: Full Bridge Wiring (e2e)", () => {
    let wss;
    let port;
    let orchestrator;
    let wsServer;
    let messageRouter;
    beforeEach(async () => {
        wss = new ws_1.WebSocketServer({ host: "127.0.0.1", port: 0 });
        await new Promise((resolve) => wss.once("listening", resolve));
        port = wss.address().port;
        // Mirror the closure pattern from index.ts
        let _orchestrator;
        let _messageRouter;
        wsServer = new wsServer_1.BridgeWsServer(wss);
        wsServer.setMessageHandler((_ws, msg) => _messageRouter.handle(_ws, msg));
        _orchestrator = new orchestrator_1.BridgeOrchestrator(wsServer, new eventDetector_1.EventDetector(), new recommendationEngine_1.RecommendationEngine(), null, { summonerName: "TestPlayer", llmCooldownMs: 0 });
        _messageRouter = new messageRouter_1.MessageRouter(_orchestrator);
        orchestrator = _orchestrator;
        messageRouter = _messageRouter;
    });
    afterEach(async () => {
        await new Promise((resolve) => wss.close(() => resolve()));
    });
    it("system_ClientConnects_ReceivesConnectedEvent", async () => {
        const client = new ws_2.default(`ws://127.0.0.1:${port}`);
        const msg = await waitForMessage(client, "CONNECTED");
        expect(msg.event).toBe("CONNECTED");
        expect(msg.timestamp).toBeGreaterThan(0);
        client.close();
    });
    it("system_GameDataHandled_ClientReceivesGameStartedOnly_NoLlm", async () => {
        const client = new ws_2.default(`ws://127.0.0.1:${port}`);
        await waitForMessage(client, "CONNECTED");
        const collecting = collectMessages(client, 200);
        await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)());
        const messages = await collecting;
        const events = messages.map((m) => m.event);
        expect(events).toContain("GAME_STARTED");
        expect(events).not.toContain("RECOMMENDATION_UPDATE");
        client.close();
    });
    it("system_ClientSendsSetSummoner_OrchestratorUpdatesSummonerName", async () => {
        const client = new ws_2.default(`ws://127.0.0.1:${port}`);
        await waitForMessage(client, "CONNECTED");
        client.send(JSON.stringify({ event: "SET_SUMMONER", summonerName: "Faker" }));
        await new Promise((resolve) => setTimeout(resolve, 50));
        const player = (0, fixtures_1.makePlayer)({ summonerName: "Faker", team: "ORDER" });
        await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)([player]));
        const collecting = collectMessages(client, 100);
        const messages = await collecting;
        const gameStarted = messages.find((m) => m.event === "GAME_STARTED");
        expect(gameStarted?.gameState?.localPlayer.summonerName).toBe("Faker");
        client.close();
    });
    it("system_ClientSendsTriggerAnalysis_NoLlm_NoBroadcast", async () => {
        const client = new ws_2.default(`ws://127.0.0.1:${port}`);
        await waitForMessage(client, "CONNECTED");
        await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)());
        await waitForMessage(client, "GAME_STARTED");
        const collecting = collectMessages(client, 200);
        client.send(JSON.stringify({ event: "TRIGGER_ANALYSIS" }));
        const messages = await collecting;
        expect(messages.find((m) => m.event === "RECOMMENDATION_UPDATE")).toBeUndefined();
        client.close();
    });
    it("system_ClientSendsMalformedJson_ServerStaysAlive", async () => {
        const client = new ws_2.default(`ws://127.0.0.1:${port}`);
        await waitForMessage(client, "CONNECTED");
        client.send("not json at all {{{");
        await new Promise((resolve) => setTimeout(resolve, 50));
        // Server is still alive — a second client can connect and receive CONNECTED
        const client2 = new ws_2.default(`ws://127.0.0.1:${port}`);
        const msg = await waitForMessage(client2, "CONNECTED");
        expect(msg.event).toBe("CONNECTED");
        client.close();
        client2.close();
    });
    it("system_SetLlmProviderWithoutApiKey_SetsProviderNull_NoRecommendation", async () => {
        const client = new ws_2.default(`ws://127.0.0.1:${port}`);
        await waitForMessage(client, "CONNECTED");
        client.send(JSON.stringify({ event: "SET_LLM_PROVIDER" }));
        await new Promise((resolve) => setTimeout(resolve, 50));
        // After disabling provider, no recommendation fires
        const collecting = collectMessages(client, 200);
        await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)());
        const messages = await collecting;
        expect(messages.find((m) => m.event === "RECOMMENDATION_UPDATE")).toBeUndefined();
        client.close();
    });
    it("system_ClientSendsSetRiskLevel_PropagatesToGetAnalysisCall", async () => {
        const { createLlmProvider } = jest.requireMock("../llmProvider");
        const getAnalysis = jest.fn().mockResolvedValue({
            reasoning: "",
            strategy: { winCondition: "mid", summary: "", immediateAction: "", lateGamePlan: "" },
        });
        createLlmProvider.mockResolvedValue({ name: "mock-provider", getAnalysis });
        const client = new ws_2.default(`ws://127.0.0.1:${port}`);
        await waitForMessage(client, "CONNECTED");
        client.send(JSON.stringify({ event: "SET_LLM_PROVIDER", provider: "claude", apiKey: "sk-test" }));
        client.send(JSON.stringify({ event: "SET_RISK_LEVEL", riskLevel: "risky" }));
        await new Promise((resolve) => setTimeout(resolve, 50));
        await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)());
        await waitForMessage(client, "RECOMMENDATION_UPDATE");
        expect(getAnalysis).toHaveBeenCalledWith(expect.anything(), "risky");
        client.close();
    });
});
