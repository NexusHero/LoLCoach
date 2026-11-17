import { computeObjectives, computeMacroAlerts } from "../macroTracker";
import { makeGameState, makePlayer, makeActivePlayer } from "./fixtures";

describe("macroTracker", () => {
  describe("computeObjectives", () => {
    it("computeObjectives_AtFourMinutes_ShowsDragonSpawningIn60s", () => {
      const state = makeGameState({ gameTime: 240 });

      const objectives = computeObjectives(state);

      const dragon = objectives.find((o) => o.type === "dragon");
      expect(dragon?.secondsUntilSpawn).toBe(60);
      expect(dragon?.status).toBe("spawning_soon");
    });

    it("computeObjectives_AfterDragonKill_CalculatesFiveMinuteRespawn", () => {
      const state = makeGameState({
        gameTime: 400,
        mapEvents: [{ EventID: 1, EventName: "DragonKill", EventTime: 320 }],
      });

      const objectives = computeObjectives(state);

      const dragon = objectives.find((o) => o.type === "dragon");
      expect(dragon?.secondsUntilSpawn).toBe(220);
      expect(dragon?.status).toBe("countdown");
    });

    it("computeObjectives_BeforeEightMinutes_CountsVoidgrubsDownToEightMinutes", () => {
      const objectives = computeObjectives(makeGameState({ gameTime: 420 }));

      const grubs = objectives.find((o) => o.type === "grubs");
      expect(grubs?.secondsUntilSpawn).toBe(60);
      expect(grubs?.status).toBe("spawning_soon");
      expect(objectives.some((o) => o.type === "herald")).toBe(false);
    });

    it("computeObjectives_AllThreeVoidgrubsKilled_SwitchesToHeraldCountdown", () => {
      const state = makeGameState({
        gameTime: 600,
        mapEvents: [1, 2, 3].map((id) => ({ EventID: id, EventName: "HordeKill", EventTime: 540 })),
      });

      const objectives = computeObjectives(state);

      expect(objectives.some((o) => o.type === "grubs")).toBe(false);
      expect(objectives.find((o) => o.type === "herald")?.secondsUntilSpawn).toBe(300);
    });

    it("computeObjectives_AfterGrubDespawn_ShowsHeraldSpawningAtFifteenMinutes", () => {
      const objectives = computeObjectives(makeGameState({ gameTime: 890 }));

      expect(objectives.some((o) => o.type === "grubs")).toBe(false);
      expect(objectives.find((o) => o.type === "herald")?.secondsUntilSpawn).toBe(10);
    });

    it("computeObjectives_HeraldAliveAtSixteenMinutes_ReportsAlive", () => {
      const objectives = computeObjectives(makeGameState({ gameTime: 960 }));

      expect(objectives.find((o) => o.type === "herald")?.status).toBe("alive");
    });

    it("computeObjectives_AfterBaronKill_CalculatesSixMinuteRespawn", () => {
      const state = makeGameState({
        gameTime: 1500,
        mapEvents: [{ EventID: 1, EventName: "BaronKill", EventTime: 1400 }],
      });

      const baron = computeObjectives(state).find((o) => o.type === "baron");

      expect(baron?.secondsUntilSpawn).toBe(260);
    });

    it("computeObjectives_TeamTakesFourthDragon_SwitchesToElderWithSixMinuteSpawn", () => {
      const state = makeGameState({
        gameTime: 1700,
        localPlayer: makePlayer({ summonerName: "Hero#EUW", team: "ORDER" }),
        mapEvents: [300, 620, 940, 1600].map((time, i) => ({
          EventID: i,
          EventName: "DragonKill",
          EventTime: time,
          KillerName: "Hero",
          DragonType: "Fire",
        })),
      });

      const objectives = computeObjectives(state);

      expect(objectives.some((o) => o.type === "dragon")).toBe(false);
      const elder = objectives.find((o) => o.type === "elder");
      expect(elder?.label).toBe("Elder Dragon");
      expect(elder?.secondsUntilSpawn).toBe(260);
    });

    it("computeObjectives_FourDragonsSplitBetweenTeams_KeepsElementalDragonTimer", () => {
      const state = makeGameState({
        gameTime: 1700,
        localPlayer: makePlayer({ summonerName: "Hero", team: "ORDER" }),
        enemies: [makePlayer({ summonerName: "Villain", team: "CHAOS" })],
        mapEvents: [300, 620, 940, 1600].map((time, i) => ({
          EventID: i,
          EventName: "DragonKill",
          EventTime: time,
          KillerName: i % 2 === 0 ? "Hero" : "Villain",
          DragonType: "Fire",
        })),
      });

      const objectives = computeObjectives(state);

      expect(objectives.some((o) => o.type === "elder")).toBe(false);
      expect(objectives.find((o) => o.type === "dragon")?.secondsUntilSpawn).toBe(200);
    });

    it("computeObjectives_AfterElderKill_CalculatesSixMinuteElderRespawn", () => {
      const state = makeGameState({
        gameTime: 2300,
        localPlayer: makePlayer({ summonerName: "Hero", team: "ORDER" }),
        mapEvents: [
          ...[300, 620, 940, 1600].map((time, i) => ({
            EventID: i,
            EventName: "DragonKill",
            EventTime: time,
            KillerName: "Hero",
            DragonType: "Fire",
          })),
          { EventID: 9, EventName: "DragonKill", EventTime: 2200, KillerName: "Hero", DragonType: "Elder" },
        ],
      });

      const elder = computeObjectives(state).find((o) => o.type === "elder");

      expect(elder?.secondsUntilSpawn).toBe(260);
    });
  });

  describe("computeMacroAlerts", () => {
    it("computeMacroAlerts_ObjectiveSoonAndGoldHoarding_ReturnsObjectiveThenEconomy", () => {
      const state = makeGameState({
        gameTime: 240,
        localPlayer: makePlayer({ position: "MID" }),
        activePlayer: makeActivePlayer({ currentGold: 1600 }),
      });
      const objectives = computeObjectives(state);

      const alerts = computeMacroAlerts(state, objectives, 45);

      expect(alerts.map((a) => a.id)).toEqual(["obj_spawn_dragon", "gold_hoarding"]);
      expect(alerts[0].title).toBe("DRAGON IN 60s");
    });

    it("computeMacroAlerts_FedPlayerInEarlyGameWithLevelSixOpponent_EmitsNoDangerOrSpikeAlerts", () => {
      const state = makeGameState({
        gameTime: 200,
        localPlayer: makePlayer({
          position: "TOP",
          level: 5,
          scores: { kills: 5, deaths: 0, assists: 1, creepScore: 30, wardScore: 2 },
        }),
        enemies: [
          makePlayer({ championName: "Lee Sin", position: "JUNGLE", team: "CHAOS" }),
          makePlayer({ championName: "Darius", position: "TOP", team: "CHAOS", level: 6 }),
        ],
        activePlayer: makeActivePlayer({ currentGold: 300 }),
      });

      const alerts = computeMacroAlerts(state, computeObjectives(state));

      expect(alerts).toHaveLength(0);
    });

    it("computeMacroAlerts_AnyAlert_NeverUsesDangerCategoryOrCriticalPriority", () => {
      const state = makeGameState({
        gameTime: 240,
        activePlayer: makeActivePlayer({ currentGold: 2500 }),
      });

      const alerts = computeMacroAlerts(state, computeObjectives(state), 90);

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts.every((a) => a.category !== "danger" && a.priority !== "critical")).toBe(true);
    });

    it("computeMacroAlerts_DeadPlayerWithGold_SkipsGoldAlert", () => {
      const state = makeGameState({
        gameTime: 600,
        localPlayer: makePlayer({ isDead: true }),
        activePlayer: makeActivePlayer({ currentGold: 2500 }),
      });

      const alerts = computeMacroAlerts(state, computeObjectives(state), 90);

      expect(alerts.some((a) => a.id === "gold_hoarding")).toBe(false);
    });
  });
});
