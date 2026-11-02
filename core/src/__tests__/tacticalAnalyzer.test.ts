import {
  computePrimaryThreat,
  computeTeamDamageProfile,
  computeNextBestBuy,
  computeEnemyCooldowns,
} from "../tacticalAnalyzer";
import { makeGameState, makePlayer, makeItem, makeActivePlayer } from "./fixtures";

describe("tacticalAnalyzer", () => {
  describe("computePrimaryThreat", () => {
    it("computePrimaryThreat_MultipleEnemies_ReturnsHighestThreatEnemy", () => {
      const tank = makePlayer({
        championName: "Ornn",
        team: "CHAOS",
        level: 9,
        scores: { kills: 0, deaths: 2, assists: 1, creepScore: 110, wardScore: 5 },
      });
      const fedAssassin = makePlayer({
        championName: "Zed",
        team: "CHAOS",
        level: 12,
        scores: { kills: 8, deaths: 1, assists: 3, creepScore: 165, wardScore: 8 },
        items: [makeItem({ itemID: 3134, displayName: "Hubris", price: 3000 })],
      });
      const state = makeGameState({ enemies: [tank, fedAssassin] });

      const threat = computePrimaryThreat(state);

      expect(threat?.championName).toBe("Zed");
      expect(threat?.kills).toBe(8);
      expect(threat?.reason).toContain("8/1/3");
      expect(threat?.reason).toContain("Hubris");
    });

    it("computePrimaryThreat_NoEnemies_ReturnsUndefined", () => {
      const state = makeGameState({ enemies: [] });

      const threat = computePrimaryThreat(state);

      expect(threat).toBeUndefined();
    });
  });

  describe("computeTeamDamageProfile", () => {
    it("computeTeamDamageProfile_ArmorAndHealingEnemies_DetectsArmorStackingAndHeavyHealing", () => {
      const e1 = makePlayer({
        championName: "Aatrox",
        team: "CHAOS",
        items: [makeItem({ itemID: 3047, price: 1200 })],
      });
      const e2 = makePlayer({
        championName: "Soraka",
        team: "CHAOS",
        items: [makeItem({ itemID: 3075, price: 2450 })],
      });
      const state = makeGameState({ enemies: [e1, e2] });

      const profile = computeTeamDamageProfile(state);

      expect(profile.heavyHealing).toBe(true);
      expect(profile.armorStacking).toBe(true);
      expect(profile.mrStacking).toBe(false);
    });

    it("computeTeamDamageProfile_HybridChampBuildingHeavyAp_ShiftsDamageSplitTowardAp", () => {
      const apKaisa = makePlayer({
        championName: "Kai'Sa",
        team: "CHAOS",
        items: [
          makeItem({ itemID: 3115, displayName: "Nashor's Tooth", price: 3000 }),
          makeItem({ itemID: 3089, displayName: "Rabadon's Deathcap", price: 3600 }),
        ],
      });
      const state = makeGameState({ enemies: [apKaisa] });

      const profile = computeTeamDamageProfile(state);

      expect(profile.apPercent).toBeGreaterThan(80);
      expect(profile.adPercent).toBeLessThan(20);
    });
  });

  describe("computeNextBestBuy", () => {
    it("computeNextBestBuy_GoldAllowsComponentAndNearStrongerComponent_ReturnsBuyWithBreakpointHint", () => {
      const state = makeGameState({
        activePlayer: makeActivePlayer({ currentGold: 980 }),
        localPlayer: makePlayer({ items: [] }),
      });

      const nextBuy = computeNextBestBuy(state, [
        { id: 3078, name: "Trinity Force", reason: "Core spike", priority: "core" },
      ]);

      expect(nextBuy).toBeDefined();
      expect(nextBuy?.itemName).toBe("Sheen");
      expect(nextBuy?.price).toBe(900);
      expect(nextBuy?.breakpointHint).toContain("+120g");
      expect(nextBuy?.breakpointHint).toContain("Phage");
    });

    it("computeNextBestBuy_GoldCoversFullTargetItem_ReturnsFullTargetItem", () => {
      const state = makeGameState({
        activePlayer: makeActivePlayer({ currentGold: 3500 }),
        localPlayer: makePlayer({ items: [] }),
      });

      const nextBuy = computeNextBestBuy(state, [
        { id: 3078, name: "Trinity Force", reason: "Core spike", priority: "core" },
      ]);

      expect(nextBuy?.itemId).toBe(3078);
      expect(nextBuy?.itemName).toBe("Trinity Force");
    });

    it("computeNextBestBuy_OwnedTier1LongSword_DiscountsTier2PhageInRecursiveTree", () => {
      const state = makeGameState({
        activePlayer: makeActivePlayer({ currentGold: 800 }),
        localPlayer: makePlayer({
          items: [makeItem({ itemID: 1036, displayName: "Long Sword", price: 350, slot: 0 })],
        }),
      });

      const nextBuy = computeNextBestBuy(state, [
        { id: 3078, name: "Trinity Force", reason: "Core spike", priority: "core" },
      ]);

      // Phage (1100g) minus owned Long Sword (350g) = 750g, which is now affordable at 800g!
      expect(nextBuy).toBeDefined();
      expect(nextBuy?.itemId).toBe(3044);
      expect(nextBuy?.itemName).toBe("Phage");
      expect(nextBuy?.price).toBe(750);
    });

    it("computeNextBestBuy_RabadonsWithOneOwnedRod_DoesNotDoubleCountDuplicateComponent", () => {
      const state = makeGameState({
        activePlayer: makeActivePlayer({ currentGold: 1300 }),
        localPlayer: makePlayer({
          items: [makeItem({ itemID: 1058, displayName: "Needlessly Large Rod", price: 1200, slot: 0 })],
        }),
      });

      const nextBuy = computeNextBestBuy(state, [
        { id: 3089, name: "Rabadon's Deathcap", reason: "AP spike", priority: "core" },
      ]);

      // Rabadon's (3600g) needs TWO 1058 rods. Owning ONE rod leaves 2400g total, so second rod (1200g) is recommended next.
      expect(nextBuy).toBeDefined();
      expect(nextBuy?.itemId).toBe(1058);
      expect(nextBuy?.itemName).toBe("Needlessly Large Rod");
      expect(nextBuy?.price).toBe(1200);
    });

    it("computeNextBestBuy_LowGoldOnlyAffordsTier1Leaf_RecommendsTier1Component", () => {
      const state = makeGameState({
        activePlayer: makeActivePlayer({ currentGold: 420 }),
        localPlayer: makePlayer({ items: [] }),
      });

      const nextBuy = computeNextBestBuy(state, [
        { id: 3078, name: "Trinity Force", reason: "Core spike", priority: "core" },
      ]);

      expect(nextBuy).toBeDefined();
      expect(nextBuy?.itemId).toBe(1028);
      expect(nextBuy?.itemName).toBe("Ruby Crystal");
      expect(nextBuy?.price).toBe(400);
    });
  });

  describe("computeEnemyCooldowns", () => {
    it("computeEnemyCooldowns_LaneOpponentWithSummonersAndHaste_ComputesQWERKeySpellAndSummonerCds", async () => {
      const state = makeGameState({
        gameTime: 720,
        localPlayer: makePlayer({ championName: "Ezreal", position: "BOTTOM", level: 9 }),
        enemies: [
          makePlayer({
            championName: "Blitzcrank",
            position: "BOTTOM",
            team: "CHAOS",
            level: 9,
            items: [
              makeItem({ itemID: 3158, displayName: "Ionian Boots of Lucidity", price: 900 }),
              makeItem({ itemID: 3190, displayName: "Locket of the Iron Solari", price: 2200 }),
            ],
            runes: {
              keystone: { displayName: "Glacial Augment" },
              primaryRuneTree: { displayName: "Inspiration" },
              secondaryRuneTree: { displayName: "Resolve" },
            },
            summonerSpells: {
              summonerSpellOne: { displayName: "Flash" },
              summonerSpellTwo: { displayName: "Ignite" },
            },
          }),
        ],
      });

      const cds = await computeEnemyCooldowns(state);

      expect(cds).toBeDefined();
      expect(cds?.championName).toBe("Blitzcrank");
      expect(cds?.abilityHaste).toBe(25); // 15 (Ionian) + 10 (Locket)
      expect(cds?.keyThreatSpell).toBe("Q");
      expect(cds?.keyThreatSummary).toContain("Q");
      // Summoner haste: +10 (Ionian) + 18 (Inspiration) = 28 -> Flash 300 * 100/128 = 234s
      expect(cds?.summonerSpells).toHaveLength(2);
      expect(cds?.summonerSpells?.[0]).toEqual({ name: "Flash", cooldown: 234 });
      expect(cds?.summonerSpells?.[1]).toEqual({ name: "Ignite", cooldown: 141 });
    });
  });
});
