"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const v3_1 = require("zod/v3");
const orchestrator_1 = require("../orchestrator");
const eventDetector_1 = require("../eventDetector");
const recommendationEngine_1 = require("../recommendationEngine");
const fixtures_1 = require("./fixtures");
// Zod schemas derived from asyncapi.yml — these are the contract
const BaseMessageSchema = v3_1.z.object({
    event: v3_1.z.enum([
        "CONNECTED", "GAME_STARTED", "ITEM_PURCHASED", "LEVEL_UP",
        "GAME_TICK", "GAME_INACTIVE", "RECOMMENDATION_UPDATE", "PLAYER_DIED", "HIGH_GOLD_REACHED",
        "LLM_ERROR", "LLM_BUDGET_EXCEEDED",
    ]),
    timestamp: v3_1.z.number().int(),
    error: v3_1.z.string().optional(),
});
const PlayerScoresSchema = v3_1.z.object({
    kills: v3_1.z.number().int(),
    deaths: v3_1.z.number().int(),
    assists: v3_1.z.number().int(),
    creepScore: v3_1.z.number().int(),
    wardScore: v3_1.z.number(),
});
const ItemSchema = v3_1.z.object({
    itemID: v3_1.z.number().int(),
    displayName: v3_1.z.string(),
    slot: v3_1.z.number().int().min(0).max(6),
    price: v3_1.z.number().int(),
    count: v3_1.z.number().int(),
    canUse: v3_1.z.boolean(),
    consumable: v3_1.z.boolean(),
});
const PlayerSchema = v3_1.z.object({
    championName: v3_1.z.string(),
    isBot: v3_1.z.boolean(),
    isDead: v3_1.z.boolean(),
    items: v3_1.z.array(ItemSchema),
    level: v3_1.z.number().int().min(1),
    position: v3_1.z.string(),
    scores: PlayerScoresSchema,
    summonerName: v3_1.z.string(),
    team: v3_1.z.enum(["ORDER", "CHAOS"]),
});
const ActivePlayerSchema = v3_1.z.object({
    summonerName: v3_1.z.string(),
    level: v3_1.z.number().int(),
    currentGold: v3_1.z.number(),
    championStats: v3_1.z.object({
        abilityPower: v3_1.z.number().optional(),
        armor: v3_1.z.number().optional(),
        attackDamage: v3_1.z.number().optional(),
        critChance: v3_1.z.number().optional(),
        healthMax: v3_1.z.number().optional(),
        magicResist: v3_1.z.number().optional(),
    }).optional(),
});
const ParsedGameStateSchema = v3_1.z.object({
    gameTime: v3_1.z.number(),
    gameMode: v3_1.z.string(),
    localPlayer: PlayerSchema,
    allies: v3_1.z.array(PlayerSchema),
    enemies: v3_1.z.array(PlayerSchema),
    activePlayer: ActivePlayerSchema,
});
const RecommendedItemSchema = v3_1.z.object({
    id: v3_1.z.number().int(),
    name: v3_1.z.string(),
    reason: v3_1.z.string(),
    priority: v3_1.z.enum(["core", "situational"]),
});
const ItemRecommendationSchema = v3_1.z.object({
    items: v3_1.z.array(RecommendedItemSchema),
    reasoning: v3_1.z.string(),
    source: v3_1.z.enum(["heuristic", "llm"]),
});
const GameStateMessageSchema = BaseMessageSchema.extend({
    gameState: ParsedGameStateSchema,
});
const RecommendationMessageSchema = GameStateMessageSchema.extend({
    recommendation: ItemRecommendationSchema,
    triggerEvent: v3_1.z.string().optional(),
});
describe("AsyncAPI Contract: broadcast messages match schema", () => {
    function makeMockLlmProvider() {
        return {
            name: "mock",
            listModels: jest.fn().mockResolvedValue([]),
            getAnalysis: jest.fn().mockResolvedValue({
                reasoning: "mock reasoning",
                situationalItems: [{ id: 3102, name: "Banshee's Veil", reason: "AP heavy", priority: "situational" }],
                strategy: { winCondition: "early", summary: "s", immediateAction: "a", lateGamePlan: "b" },
            }),
        };
    }
    function setupOrchestrator(llmProvider = null) {
        const broadcasts = [];
        const wsServer = {
            broadcast: jest.fn((msg) => broadcasts.push(msg)),
            clientCount: 1,
            close: jest.fn(),
        };
        const orchestrator = new orchestrator_1.BridgeOrchestrator(wsServer, new eventDetector_1.EventDetector(), new recommendationEngine_1.RecommendationEngine(), llmProvider, { summonerName: "TestPlayer", llmCooldownMs: 0 }, () => Date.now());
        return { orchestrator, broadcasts };
    }
    it("broadcast_GameStartedEvent_ConformsToGameStateMessageSchema", async () => {
        const { orchestrator, broadcasts } = setupOrchestrator();
        await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)());
        const gameStarted = broadcasts.find((b) => b.event === "GAME_STARTED");
        expect(gameStarted).toBeDefined();
        const result = GameStateMessageSchema.safeParse(gameStarted);
        expect(result.success).toBe(true);
    });
    it("broadcast_RecommendationUpdateEvent_ConformsToRecommendationMessageSchema", async () => {
        const { orchestrator, broadcasts } = setupOrchestrator(makeMockLlmProvider());
        await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)());
        const rec = broadcasts.find((b) => b.event === "RECOMMENDATION_UPDATE");
        expect(rec).toBeDefined();
        const result = RecommendationMessageSchema.safeParse(rec);
        expect(result.success).toBe(true);
    });
    it("broadcast_ItemPurchasedEvent_ConformsToGameStateMessageSchema", async () => {
        const { orchestrator, broadcasts } = setupOrchestrator();
        const enemy = (0, fixtures_1.makePlayer)({ summonerName: "Enemy1", team: "CHAOS" });
        await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)([(0, fixtures_1.makePlayer)(), enemy]));
        broadcasts.length = 0;
        const enemyWithItem = { ...enemy, items: [{ itemID: 3102, displayName: "Banshee's Veil", slot: 0, price: 2900, count: 1, canUse: false, consumable: false, rawDescription: "" }] };
        await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)([(0, fixtures_1.makePlayer)(), enemyWithItem]));
        const itemPurchased = broadcasts.find((b) => b.event === "ITEM_PURCHASED");
        expect(itemPurchased).toBeDefined();
        const result = GameStateMessageSchema.safeParse(itemPurchased);
        expect(result.success).toBe(true);
    });
    it("broadcast_AllEvents_HaveRequiredBaseFields", async () => {
        const { orchestrator, broadcasts } = setupOrchestrator();
        await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)());
        for (const msg of broadcasts) {
            const result = BaseMessageSchema.safeParse(msg);
            if (!result.success) {
                throw new Error(`Message "${msg.event}" failed schema: ${result.error.message}`);
            }
        }
    });
    it("broadcast_RecommendationSource_IsAlwaysLlm", async () => {
        const { orchestrator, broadcasts } = setupOrchestrator(makeMockLlmProvider());
        await orchestrator.handleGameData((0, fixtures_1.makeRawGameData)());
        const recs = broadcasts.filter((b) => b.event === "RECOMMENDATION_UPDATE");
        expect(recs).toHaveLength(1);
        for (const rec of recs) {
            expect(rec.recommendation?.source).toBe("llm");
        }
    });
});
