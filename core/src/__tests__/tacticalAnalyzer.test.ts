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
  });

  describe("computeEnemyCooldowns", () => {
    it("computeEnemyCooldowns_LaneOpponentPresent_ComputesQWERAndThreatSummary", async () => {
      const state = makeGameState({
        localPlayer: makePlayer({ championName: "Ahri", position: "MID", level: 9 }),
        enemies: [
          makePlayer({
            championName: "Zed",
            position: "MID",
            team: "CHAOS",
            level: 9,
            items: [makeItem({ itemID: 3071, price: 3000 })],
          }),
        ],
      });

      const cds = await computeEnemyCooldowns(state);

      expect(cds).toBeDefined();
      expect(cds?.championName).toBe("Zed");
      expect(cds?.abilityHaste).toBe(20);
      expect(cds?.q).toBeGreaterThan(0);
      expect(cds?.w).toBeGreaterThan(0);
      expect(cds?.keyThreatSummary.length).toBeGreaterThan(10);
    });
  });
});
