import {
  computeObjectives,
  computeMacroAlerts,
  findObjectiveSetupTrigger,
} from "../macroTracker";
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
  });

  describe("computeMacroAlerts", () => {
    it("computeMacroAlerts_AllConditionsActive_CapsAtMaxTwoAlertsAndPrioritizesDangerAndObjective", () => {
      const state = makeGameState({
        gameTime: 200, // In 2:55-3:45 jungle gank window
        localPlayer: makePlayer({
          position: "TOP",
          scores: { kills: 5, deaths: 0, assists: 1, creepScore: 30, wardScore: 2 },
        }),
        enemies: [makePlayer({ championName: "Lee Sin", position: "JUNGLE", team: "CHAOS" })],
        activePlayer: makeActivePlayer({ currentGold: 2000 }),
      });
      const objectives = computeObjectives(makeGameState({ gameTime: 240 }));

      const alerts = computeMacroAlerts(state, objectives, 60);

      expect(alerts).toHaveLength(2);
      expect(alerts[0].category).toBe("danger");
      expect(alerts[1].category).toBe("danger");
    });

    it("computeMacroAlerts_ObjectiveSetupAndGoldHoarding_ReturnsBothWhenNoDanger", () => {
      const state = makeGameState({
        gameTime: 240,
        localPlayer: makePlayer({ position: "MID" }),
        activePlayer: makeActivePlayer({ currentGold: 1600 }),
      });
      const objectives = computeObjectives(state);

      const alerts = computeMacroAlerts(state, objectives, 45);

      expect(alerts).toHaveLength(2);
      expect(alerts[0].category).toBe("objective");
      expect(alerts[1].category).toBe("economy");
    });
  });

  describe("findObjectiveSetupTrigger", () => {
    it("findObjectiveSetupTrigger_AtTMinus60s_ReturnsDragonObjective", () => {
      const objectives = computeObjectives(makeGameState({ gameTime: 240 }));

      const trigger = findObjectiveSetupTrigger(objectives);

      expect(trigger?.type).toBe("dragon");
    });
  });
});
