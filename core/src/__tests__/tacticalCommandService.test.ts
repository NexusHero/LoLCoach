import {
  VectorMemoryService,
  computeLocalEmbedding,
  cosineSimilarity,
} from "../vectorMemoryService";
import { TacticalCommandService } from "../tacticalCommandService";
import { makeGameState, makePlayer, makeItem } from "./fixtures";

describe("VectorMemoryService & TacticalCommandService", () => {
  describe("VectorMemoryService", () => {
    it("computeLocalEmbedding_SimilarMatchupTexts_HaveHighCosineSimilarity", () => {
      const v1 = computeLocalEmbedding("[Ahri vs Zed] Always rush Cloth Armor before Lost Chapter");
      const v2 = computeLocalEmbedding("Ahri vs Zed cloth armor early build");
      const vUnrelated = computeLocalEmbedding("Baron Nashor respawn timer at 20 minutes");

      const simRelated = cosineSimilarity(v1, v2);
      const simUnrelated = cosineSimilarity(v1, vUnrelated);

      expect(simRelated).toBeGreaterThan(simUnrelated);
      expect(simRelated).toBeGreaterThan(0.25);
    });

    it("storeMatchupNoteAndSearch_MatchingChampionAndOpponent_ReturnsRelevantMemoryFirst", async () => {
      const memory = new VectorMemoryService(false);
      await memory.storeMatchupNote(
        "Ahri",
        "Rush Seeker's Armguard and hold Charm until Zed exits R behind you",
        "Zed",
      );
      await memory.storeMatchupNote(
        "Ornn",
        "Buy Bramble Vest against Fiora",
        "Fiora",
      );

      const results = await memory.searchRelevantMemories(
        "Wie spiele ich gegen Zed R?",
        "Ahri",
        "Zed",
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toContain("Ahri vs Zed");
      expect(results[0]).toContain("Hold Charm" .toLowerCase().replace("hold charm", "hold Charm"));
    });
  });

  describe("TacticalCommandService", () => {
    function makeTestMatchState() {
      return makeGameState({
        gameTime: 420,
        localPlayer: makePlayer({ championName: "Ahri", position: "MID", level: 7 }),
        enemies: [
          makePlayer({
            championName: "Zed",
            position: "MID",
            team: "CHAOS",
            level: 7,
            items: [makeItem({ itemID: 3158, displayName: "Ionian Boots", price: 900 })],
            summonerSpells: {
              summonerSpellOne: { displayName: "Flash" },
              summonerSpellTwo: { displayName: "Ignite" },
            },
          }),
          makePlayer({
            championName: "Vayne",
            position: "TOP",
            team: "CHAOS",
            level: 7,
          }),
          makePlayer({
            championName: "Kai'Sa",
            position: "BOTTOM",
            team: "CHAOS",
            level: 6,
          }),
        ],
      });
    }

    it("executeCommand_EnemySpellCallout_StartsNoCooldownTimerAndBecomesReviewMarker", async () => {
      const memory = new VectorMemoryService(false);
      const svc = new TacticalCommandService(memory);
      const state = makeTestMatchState();

      const res = await svc.executeCommand("Zed Flash used", state);

      expect(res.shouldReevaluate).toBe(false);
      expect(res.exchange.actionsExecuted).toEqual(["📍 Marker 7:00"]);
      expect(svc.getOverrides()).not.toHaveProperty("activeTimers");
      expect(svc.getReviewMarkers()).toEqual([{ id: "m_1", gameTime: 420, note: "Zed Flash used" }]);
    });

    it("executeCommand_ExplicitMarkerCommand_StoresMarkerWithGameTimeAndStrippedNote", async () => {
      const memory = new VectorMemoryService(false);
      const svc = new TacticalCommandService(memory);
      const state = makeTestMatchState();

      const res = await svc.executeCommand("Marker: schlechter Trade", state);

      expect(res.shouldReevaluate).toBe(false);
      expect(svc.getReviewMarkers()).toEqual([
        { id: "m_1", gameTime: 420, note: "schlechter Trade" },
      ]);
      expect(res.exchange.replyText).toContain("7:00");
    });

    it("executeCommand_MarkerWithoutRunningGame_SetsNoMarker", async () => {
      const memory = new VectorMemoryService(false);
      const svc = new TacticalCommandService(memory);

      const res = await svc.executeCommand("Marker", null);

      expect(svc.getReviewMarkers()).toHaveLength(0);
      expect(res.exchange.actionsExecuted).toHaveLength(0);
    });

    it("clearOverride_MarkerKey_RemovesOnlyThatMarker", async () => {
      const memory = new VectorMemoryService(false);
      const svc = new TacticalCommandService(memory);
      const state = makeTestMatchState();
      await svc.executeCommand("Marker eins", state);
      await svc.executeCommand("Marker zwei", state);

      expect(svc.clearOverride("marker:m_1")).toBe(true);

      expect(svc.getReviewMarkers().map((m) => m.id)).toEqual(["m_2"]);
    });

    it("resetMatch_AfterMarkers_ClearsMarkersAndOverrides", async () => {
      const memory = new VectorMemoryService(false);
      const svc = new TacticalCommandService(memory);
      const state = makeTestMatchState();
      await svc.executeCommand("Marker eins", state);
      await svc.executeCommand("Swap Vayne", state);

      svc.resetMatch();

      expect(svc.getReviewMarkers()).toHaveLength(0);
      expect(svc.getOverrides().laneOpponentOverride).toBeUndefined();
    });

    it("executeCommand_LaneSwapCommand_SetsLaneOpponentOverrideAndTriggersReeval", async () => {
      const memory = new VectorMemoryService(false);
      const svc = new TacticalCommandService(memory);
      const state = makeTestMatchState();

      const res = await svc.executeCommand("Swap Vayne — ich spiele gegen Vayne", state);

      expect(res.shouldReevaluate).toBe(true);
      expect(svc.getOverrides().laneOpponentOverride).toBe("Vayne");
      expect(res.exchange.actionsExecuted).toContain("🔄 Lane → Vayne");
    });

    it("executeCommand_GettingCampedCommand_ActivatesCampedProtocolAndSwitchesRiskToSafe", async () => {
      const memory = new VectorMemoryService(false);
      const svc = new TacticalCommandService(memory);
      const state = makeTestMatchState();

      const res = await svc.executeCommand("Ich werde dauernd gecampt", state);

      expect(res.shouldReevaluate).toBe(true);
      expect(svc.getOverrides().campedStatus).toBe("camped");
      expect(res.exchange.uiMutation?.riskLevel).toBe("safe");
    });

    it("executeCommand_EnemyBuildOverride_MarksKaisaAsApAndAllowsClearOverride", async () => {
      const memory = new VectorMemoryService(false);
      const svc = new TacticalCommandService(memory);
      const state = makeTestMatchState();

      const res = await svc.executeCommand("Kai'Sa geht auf AP", state);

      expect(res.shouldReevaluate).toBe(true);
      expect(svc.getOverrides().enemyBuildOverrides["Kai'Sa"]).toBe("ap");

      // Clear override via 1-click context chip key
      expect(svc.clearOverride("enemyBuild:Kai'Sa")).toBe(true);
      expect(svc.getOverrides().enemyBuildOverrides["Kai'Sa"]).toBeUndefined();
    });

    it("executeCommand_RememberDirective_StoresNoteInVectorMemory", async () => {
      const memory = new VectorMemoryService(false);
      const svc = new TacticalCommandService(memory);
      const state = makeTestMatchState();

      const res = await svc.executeCommand(
        "Merk dir: Gegen Zed immer erst Cloth Armor vor Lost Chapter kaufen",
        state,
      );

      expect(res.exchange.actionsExecuted).toContain("🧠 Memory: Zed");
      expect(memory.getAllDocuments()).toHaveLength(1);
      expect(memory.getAllDocuments()[0].text).toContain("Cloth Armor");
    });
  });
});
