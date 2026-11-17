import { z } from "zod/v3";
import { BridgeOrchestrator } from "../orchestrator";
import { EventDetector } from "../eventDetector";
import { RecommendationEngine } from "../recommendationEngine";
import type { IWsBroadcaster } from "../interfaces";
import { makeRawGameData, makePlayer } from "./fixtures";
import type { WsMessage } from "../types";

// Zod schemas derived from asyncapi.yml — these are the contract
const BaseMessageSchema = z.object({
  event: z.enum([
    "CONNECTED", "GAME_STARTED", "ITEM_PURCHASED", "LEVEL_UP",
    "GAME_TICK", "GAME_INACTIVE", "RECOMMENDATION_UPDATE", "PLAYER_DIED", "HIGH_GOLD_REACHED",
    "LLM_ERROR", "LLM_BUDGET_EXCEEDED",
  ]),
  timestamp: z.number().int(),
  error: z.string().optional(),
});

const PlayerScoresSchema = z.object({
  kills: z.number().int(),
  deaths: z.number().int(),
  assists: z.number().int(),
  creepScore: z.number().int(),
  wardScore: z.number(),
});

const ItemSchema = z.object({
  itemID: z.number().int(),
  displayName: z.string(),
  slot: z.number().int().min(0).max(6),
  price: z.number().int(),
  count: z.number().int(),
  canUse: z.boolean(),
  consumable: z.boolean(),
});

const PlayerSchema = z.object({
  championName: z.string(),
  isBot: z.boolean(),
  isDead: z.boolean(),
  items: z.array(ItemSchema),
  level: z.number().int().min(1),
  position: z.string(),
  scores: PlayerScoresSchema,
  summonerName: z.string(),
  team: z.enum(["ORDER", "CHAOS"]),
});

const ActivePlayerSchema = z.object({
  summonerName: z.string(),
  level: z.number().int(),
  currentGold: z.number(),
  championStats: z.object({
    abilityPower: z.number().optional(),
    armor: z.number().optional(),
    attackDamage: z.number().optional(),
    critChance: z.number().optional(),
    healthMax: z.number().optional(),
    magicResist: z.number().optional(),
  }).optional(),
});

const ParsedGameStateSchema = z.object({
  gameTime: z.number(),
  gameMode: z.string(),
  localPlayer: PlayerSchema,
  allies: z.array(PlayerSchema),
  enemies: z.array(PlayerSchema),
  activePlayer: ActivePlayerSchema,
});

const RecommendedItemSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  reason: z.string(),
  priority: z.enum(["core", "situational"]),
});

const ItemRecommendationSchema = z.object({
  items: z.array(RecommendedItemSchema),
  reasoning: z.string(),
  source: z.enum(["heuristic", "llm"]),
});

const GameStateMessageSchema = BaseMessageSchema.extend({
  gameState: ParsedGameStateSchema,
});

const RecommendationMessageSchema = GameStateMessageSchema.extend({
  recommendation: ItemRecommendationSchema,
  triggerEvent: z.string().optional(),
});

describe("AsyncAPI Contract: broadcast messages match schema", () => {
  function makeMockLlmProvider() {
    return {
      name: "mock",
      listModels: jest.fn().mockResolvedValue([]),
      getAnalysis: jest.fn().mockResolvedValue({
        reasoning: "mock reasoning",
        situationalItems: [{ id: 3102, name: "Banshee's Veil", reason: "AP heavy", priority: "situational" }],
        strategy: { winCondition: "early" as const, summary: "s", lateGamePlan: "b" },
      }),
    };
  }

  function setupOrchestrator(llmProvider = null as any) {
    const broadcasts: WsMessage[] = [];
    const wsServer = {
      broadcast: jest.fn((msg: WsMessage) => broadcasts.push(msg)),
      clientCount: 1,
      close: jest.fn(),
    } as unknown as IWsBroadcaster;
    const orchestrator = new BridgeOrchestrator(
      wsServer,
      new EventDetector(),
      new RecommendationEngine(),
      llmProvider,
      { summonerName: "TestPlayer", llmCooldownMs: 0 },
      () => Date.now(),
    );
    return { orchestrator, broadcasts };
  }

  it("broadcast_GameStartedEvent_ConformsToGameStateMessageSchema", async () => {
    const { orchestrator, broadcasts } = setupOrchestrator();

    await orchestrator.handleGameData(makeRawGameData());

    const gameStarted = broadcasts.find((b) => b.event === "GAME_STARTED");
    expect(gameStarted).toBeDefined();
    const result = GameStateMessageSchema.safeParse(gameStarted);
    expect(result.success).toBe(true);
  });

  it("broadcast_RecommendationUpdateEvent_ConformsToRecommendationMessageSchema", async () => {
    const { orchestrator, broadcasts } = setupOrchestrator(makeMockLlmProvider());

    await orchestrator.handleGameData(makeRawGameData());

    const rec = broadcasts.find((b) => b.event === "RECOMMENDATION_UPDATE");
    expect(rec).toBeDefined();
    const result = RecommendationMessageSchema.safeParse(rec);
    expect(result.success).toBe(true);
  });

  it("broadcast_ItemPurchasedEvent_ConformsToGameStateMessageSchema", async () => {
    const { orchestrator, broadcasts } = setupOrchestrator();
    const enemy = makePlayer({ summonerName: "Enemy1", team: "CHAOS" });
    await orchestrator.handleGameData(makeRawGameData([makePlayer(), enemy]));
    broadcasts.length = 0;

    const enemyWithItem = { ...enemy, items: [{ itemID: 3102, displayName: "Banshee's Veil", slot: 0, price: 2900, count: 1, canUse: false, consumable: false, rawDescription: "" }] };
    await orchestrator.handleGameData(makeRawGameData([makePlayer(), enemyWithItem]));

    const itemPurchased = broadcasts.find((b) => b.event === "ITEM_PURCHASED");
    expect(itemPurchased).toBeDefined();
    const result = GameStateMessageSchema.safeParse(itemPurchased);
    expect(result.success).toBe(true);
  });

  it("broadcast_AllEvents_HaveRequiredBaseFields", async () => {
    const { orchestrator, broadcasts } = setupOrchestrator();

    await orchestrator.handleGameData(makeRawGameData());

    expect(broadcasts.length).toBeGreaterThan(0);
    const failures = broadcasts
      .map((msg) => ({ event: msg.event, result: BaseMessageSchema.safeParse(msg) }))
      .filter(({ result }) => !result.success)
      .map(({ event }) => event);
    expect(failures).toEqual([]);
  });

  it("broadcast_RecommendationSource_IsAlwaysLlm", async () => {
    const { orchestrator, broadcasts } = setupOrchestrator(makeMockLlmProvider());

    await orchestrator.handleGameData(makeRawGameData());

    const recs = broadcasts.filter((b) => b.event === "RECOMMENDATION_UPDATE");
    expect(recs).toHaveLength(1);
    for (const rec of recs) {
      expect(rec.recommendation?.source).toBe("llm");
    }
  });
});
