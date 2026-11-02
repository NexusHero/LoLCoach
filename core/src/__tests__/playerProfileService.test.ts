import { PlayerProfileService } from "../playerProfileService";
import { makeGameState, makePlayer, makeActivePlayer } from "./fixtures";

describe("PlayerProfileService", () => {
  it("observeTickAndFinalizeMatch_PlayerDiesEarlyWithHighGold_GeneratesAutopsyWithMistakes", () => {
    const svc = new PlayerProfileService();
    const aliveState = makeGameState({
      gameTime: 180,
      localPlayer: makePlayer({
        championName: "Ahri",
        position: "MID",
        isDead: false,
        scores: { kills: 1, deaths: 0, assists: 0, creepScore: 24, wardScore: 2 },
      }),
      activePlayer: makeActivePlayer({ currentGold: 1500 }),
    });
    const deadState = makeGameState({
      gameTime: 200,
      localPlayer: makePlayer({
        championName: "Ahri",
        position: "MID",
        isDead: true,
        scores: { kills: 1, deaths: 1, assists: 0, creepScore: 24, wardScore: 2 },
      }),
      activePlayer: makeActivePlayer({ currentGold: 1550 }),
    });

    svc.observeTick(aliveState);
    const telemetry = svc.observeTick(deadState);
    const autopsy = svc.finalizeMatch(123456);
    const profile = svc.getProfile();

    expect(telemetry.csPerMin).toBeGreaterThan(6);
    expect(autopsy).toBeDefined();
    expect(autopsy?.championName).toBe("Ahri");
    expect(autopsy?.mistakes.some((m) => m.includes("before 6:00"))).toBe(true);
    expect(autopsy?.mistakes.some((m) => m.includes(">=1400g"))).toBe(true);
    expect(profile.gamesTracked).toBe(1);
    expect(profile.habitWarnings.length).toBeGreaterThan(0);
  });
});
