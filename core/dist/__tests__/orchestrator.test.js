"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const orchestrator_1 = require("../orchestrator");
const eventDetector_1 = require("../eventDetector");
const recommendationEngine_1 = require("../recommendationEngine");
const fixtures_1 = require("./fixtures");
function setup(overrides = {}) {
    const broadcasts = [];
    const wsServer = {
        broadcast: jest.fn((msg) => broadcasts.push(msg)),
        clientCount: overrides.clientCount ?? 1,
        close: jest.fn(),
    };
    const llmProvider = {
        name: "mock",
        getAnalysis: jest.fn().mockResolvedValue({
            reasoning: overrides.llmResult ?? "LLM says buy this",
            strategy: {
                winCondition: "mid",
                summary: "Scale into mid-game.",
                immediateAction: "Farm safely.",
                lateGamePlan: "Fight with full build.",
            },
        }),
    };
    const orchestrator = new orchestrator_1.BridgeOrchestrator(wsServer, new eventDetector_1.EventDetector(), new recommendationEngine_1.RecommendationEngine(), overrides.hasLlm === false ? null : llmProvider, { summonerName: "TestPlayer", llmCooldownMs: 60_000 }, overrides.clock ?? (() => 1000));
    return { orchestrator, wsServer, llmProvider, broadcasts };
}
describe("BridgeOrchestrator", () => {
    describe("handleGameData", () => {
        it("handleGameData_FirstCall_BroadcastsGameStarted", async () => {
            const { orchestrator, broadcasts } = setup();
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)());
            expect(broadcasts.map((b) => b.event)).toContain("GAME_STARTED");
        });
        it("handleGameData_FirstCall_BroadcastsRecommendationUpdate", async () => {
            const { orchestrator, broadcasts } = setup();
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)());
            expect(broadcasts.map((b) => b.event)).toContain("RECOMMENDATION_UPDATE");
        });
        it("handleGameData_EnemyBuysItem_BroadcastsItemPurchasedNoRecommendation", async () => {
            const enemy = (0, fixtures_1.makePlayer)({ summonerName: "Enemy1", team: "CHAOS" });
            const { orchestrator, broadcasts } = setup();
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)([(0, fixtures_1.makePlayer)(), enemy]));
            broadcasts.length = 0;
            const enemyWithItem = { ...enemy, items: [(0, fixtures_1.makeItem)({ itemID: 3102 })] };
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)([(0, fixtures_1.makePlayer)(), enemyWithItem]));
            const events = broadcasts.map((b) => b.event);
            expect(events).toContain("ITEM_PURCHASED");
            expect(events).not.toContain("RECOMMENDATION_UPDATE");
        });
        it("handleGameData_GameTickCrossed_DoesNotBroadcastRecommendation", async () => {
            const { orchestrator, broadcasts } = setup();
            const raw1 = (0, fixtures_1.makeRawGameData)();
            raw1.gameData.gameTime = 1;
            await orchestrator.handleGameData(raw1);
            broadcasts.length = 0;
            const raw2 = (0, fixtures_1.makeRawGameData)();
            raw2.gameData.gameTime = 31;
            await orchestrator.handleGameData(raw2);
            const events = broadcasts.map((b) => b.event);
            expect(events).toContain("GAME_TICK");
            expect(events).not.toContain("RECOMMENDATION_UPDATE");
        });
        it("handleGameData_LocalPlayerLevelsUp_DoesNotBroadcastRecommendation", async () => {
            const { orchestrator, broadcasts } = setup();
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)([(0, fixtures_1.makePlayer)({ level: 1 })]));
            broadcasts.length = 0;
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)([(0, fixtures_1.makePlayer)({ level: 2 })]));
            const events = broadcasts.map((b) => b.event);
            expect(events).toContain("LEVEL_UP");
            expect(events).not.toContain("RECOMMENDATION_UPDATE");
        });
        it("handleGameData_FirstCall_BroadcastIncludesGameState", async () => {
            const { orchestrator, broadcasts } = setup();
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)());
            const gameStarted = broadcasts.find((b) => b.event === "GAME_STARTED");
            expect(gameStarted?.gameState).toBeDefined();
            expect(gameStarted?.gameState?.gameMode).toBe("CLASSIC");
        });
    });
    describe("sendRecommendation", () => {
        it("sendRecommendation_NoLlmProvider_NoRecommendationFires", async () => {
            const { orchestrator, broadcasts } = setup({ hasLlm: false });
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)());
            expect(broadcasts.find((b) => b.event === "RECOMMENDATION_UPDATE")).toBeUndefined();
        });
        it("sendRecommendation_LlmProviderSetGameStarted_UsesLlmSource", async () => {
            const { orchestrator, broadcasts } = setup({ hasLlm: true, clientCount: 1 });
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)());
            const rec = broadcasts.find((b) => b.event === "RECOMMENDATION_UPDATE");
            expect(rec?.recommendation?.source).toBe("llm");
        });
        it("sendRecommendation_LlmProviderSet_BroadcastsOnlyRecommendationUpdate", async () => {
            const { orchestrator, broadcasts } = setup({ hasLlm: true, clientCount: 1 });
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)());
            const events = broadcasts.map((b) => b.event);
            expect(events).not.toContain("RECOMMENDATION");
            expect(events).toContain("RECOMMENDATION_UPDATE");
        });
        it("sendRecommendation_LlmProviderSet_RecommendationUpdateHasCorrelationId", async () => {
            const { orchestrator, broadcasts } = setup({ hasLlm: true, clientCount: 1 });
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)());
            const update = broadcasts.find((b) => b.event === "RECOMMENDATION_UPDATE");
            expect(update?.correlationId).toBeDefined();
        });
        it("sendRecommendation_ItemPurchasedEvent_SkipsLlm", async () => {
            const { orchestrator, broadcasts, llmProvider } = setup({ hasLlm: true, clientCount: 1 });
            const enemy = (0, fixtures_1.makePlayer)({ summonerName: "Enemy1", team: "CHAOS" });
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)([(0, fixtures_1.makePlayer)(), enemy]));
            llmProvider.getAnalysis.mockClear();
            broadcasts.length = 0;
            const enemyWithItem = { ...enemy, items: [(0, fixtures_1.makeItem)({ itemID: 3102 })] };
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)([(0, fixtures_1.makePlayer)(), enemyWithItem]));
            expect(broadcasts.find((b) => b.event === "RECOMMENDATION_UPDATE")).toBeUndefined();
            expect(llmProvider.getAnalysis).not.toHaveBeenCalled();
        });
        it("sendRecommendation_NoClientsConnected_SkipsLlm", async () => {
            const { orchestrator, broadcasts, llmProvider } = setup({ hasLlm: true, clientCount: 0 });
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)());
            expect(broadcasts.find((b) => b.event === "RECOMMENDATION_UPDATE")).toBeUndefined();
            expect(llmProvider.getAnalysis).not.toHaveBeenCalled();
        });
    });
    describe("PLAYER_DIED trigger", () => {
        it("sendRecommendation_PlayerDiedLowGold_StillUsesLlm", async () => {
            const { orchestrator, broadcasts, llmProvider } = setup({ hasLlm: true, clientCount: 1 });
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)());
            llmProvider.getAnalysis.mockClear();
            broadcasts.length = 0;
            const raw2 = (0, fixtures_1.makeRawGameData)([(0, fixtures_1.makePlayer)({ isDead: true })]);
            raw2.activePlayer = (0, fixtures_1.makeActivePlayer)({ currentGold: 50 });
            await orchestrator.handleGameData(raw2);
            const rec = broadcasts.find((b) => b.event === "RECOMMENDATION_UPDATE");
            expect(rec?.recommendation?.source).toBe("llm");
            expect(llmProvider.getAnalysis).toHaveBeenCalledTimes(1);
        });
        it("sendRecommendation_PlayerDiedImmediatelyAfterGameStart_UsesLlmWithoutCooldown", async () => {
            let now = 100_000;
            const { orchestrator, broadcasts, llmProvider } = setup({
                hasLlm: true,
                clientCount: 1,
                clock: () => now,
            });
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)());
            llmProvider.getAnalysis.mockClear();
            broadcasts.length = 0;
            now = 102_000;
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)([(0, fixtures_1.makePlayer)({ isDead: true })]));
            // LLM analysis is served (from cache or fresh — both valid), source must be "llm"
            const rec = broadcasts.find((b) => b.event === "RECOMMENDATION_UPDATE");
            expect(rec?.recommendation?.source).toBe("llm");
        });
        it("sendRecommendation_CacheHit_SkipsLlmCallButStillBroadcastsUpdate", async () => {
            const { orchestrator, broadcasts, llmProvider } = setup({ hasLlm: true, clientCount: 1 });
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)());
            llmProvider.getAnalysis.mockClear();
            broadcasts.length = 0;
            // Same state again via triggerManualAnalysis → cache hit
            await orchestrator.triggerManualAnalysis();
            expect(llmProvider.getAnalysis).not.toHaveBeenCalled();
            const update = broadcasts.find((b) => b.event === "RECOMMENDATION_UPDATE");
            expect(update?.recommendation?.source).toBe("llm");
        });
    });
    describe("triggerManualAnalysis", () => {
        it("triggerManualAnalysis_NoGameStateReceived_BroadcastsNothing", async () => {
            const { orchestrator, broadcasts } = setup({ hasLlm: true, clientCount: 1 });
            await orchestrator.triggerManualAnalysis();
            expect(broadcasts).toHaveLength(0);
        });
        it("triggerManualAnalysis_LlmProviderSet_BroadcastsRecommendationUpdate", async () => {
            const { orchestrator, broadcasts } = setup({ hasLlm: true, clientCount: 1 });
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)());
            broadcasts.length = 0;
            await orchestrator.triggerManualAnalysis();
            expect(broadcasts.find((b) => b.event === "RECOMMENDATION_UPDATE")).toBeDefined();
        });
        it("triggerManualAnalysis_LlmProviderSet_UsesLlm", async () => {
            const { orchestrator, broadcasts } = setup({ hasLlm: true, clientCount: 1 });
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)());
            broadcasts.length = 0;
            await orchestrator.triggerManualAnalysis();
            // LLM analysis served (fresh call or cache) — source must be "llm"
            const rec = broadcasts.find((b) => b.event === "RECOMMENDATION_UPDATE");
            expect(rec?.recommendation?.source).toBe("llm");
        });
        it("triggerManualAnalysis_NoLlmProvider_NoRecommendationFires", async () => {
            const { orchestrator, broadcasts } = setup({ hasLlm: false, clientCount: 1 });
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)());
            broadcasts.length = 0;
            await orchestrator.triggerManualAnalysis();
            expect(broadcasts.find((b) => b.event === "RECOMMENDATION_UPDATE")).toBeUndefined();
        });
        it("triggerManualAnalysis_AfterResetDetector_BroadcastsNothing", async () => {
            const { orchestrator, broadcasts } = setup({ hasLlm: true, clientCount: 1 });
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)());
            orchestrator.resetDetector();
            broadcasts.length = 0;
            await orchestrator.triggerManualAnalysis();
            expect(broadcasts).toHaveLength(0);
        });
    });
    describe("resetDetector", () => {
        it("resetDetector_AfterReset_NextCallEmitsGameStarted", async () => {
            const { orchestrator, broadcasts } = setup();
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)());
            broadcasts.length = 0;
            orchestrator.resetDetector();
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)());
            expect(broadcasts.map((b) => b.event)).toContain("GAME_STARTED");
        });
    });
    describe("setSummonerName", () => {
        it("setSummonerName_NewName_UpdatesLocalPlayerIdentification", async () => {
            const player1 = (0, fixtures_1.makePlayer)({ summonerName: "Player1", team: "ORDER" });
            const player2 = (0, fixtures_1.makePlayer)({ summonerName: "Player2", team: "ORDER", championName: "Garen" });
            const enemy = (0, fixtures_1.makePlayer)({ summonerName: "Enemy1", team: "CHAOS" });
            const { orchestrator, broadcasts } = setup();
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)([player1, player2, enemy]));
            broadcasts.length = 0;
            orchestrator.setSummonerName("Player2");
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)([player1, player2, enemy]));
            const rec = broadcasts.find((b) => b.event === "RECOMMENDATION_UPDATE");
            expect(rec?.gameState?.localPlayer.summonerName).toBe("Player2");
            expect(rec?.gameState?.localPlayer.championName).toBe("Garen");
        });
        it("setSummonerName_NewName_ResetsDetectorSoGameStartedFires", async () => {
            const { orchestrator, broadcasts } = setup();
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)());
            broadcasts.length = 0;
            orchestrator.setSummonerName("NewPlayer");
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)());
            expect(broadcasts.map((b) => b.event)).toContain("GAME_STARTED");
        });
        it("setSummonerName_SameName_DoesNotResetDetector", async () => {
            const { orchestrator, broadcasts } = setup();
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)());
            broadcasts.length = 0;
            orchestrator.setSummonerName("TestPlayer");
            await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)());
            expect(broadcasts.map((b) => b.event)).not.toContain("GAME_STARTED");
        });
    });
});
