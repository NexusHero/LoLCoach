import { buildCompProfile, getHeuristicRecommendations, buildHeuristicStrategy } from "../heuristic";
import { makePlayer, makeGameState } from "./fixtures";

describe("buildCompProfile", () => {
  it("buildCompProfile_AllApChampions_ReturnsApRatioOne", () => {
    const enemies = [
      makePlayer({ championName: "Ahri" }),
      makePlayer({ championName: "Lux" }),
      makePlayer({ championName: "Syndra" }),
    ];

    const profile = buildCompProfile(enemies);

    expect(profile.apRatio).toBe(1);
    expect(profile.adRatio).toBe(0);
  });

  it("buildCompProfile_HalfApHalfAd_ReturnsEqualRatios", () => {
    const enemies = [
      makePlayer({ championName: "Ahri" }),
      makePlayer({ championName: "Caitlyn" }),
    ];

    const profile = buildCompProfile(enemies);

    expect(profile.apRatio).toBe(0.5);
    expect(profile.adRatio).toBe(0.5);
  });

  it("buildCompProfile_EmptyEnemyList_ReturnsSafeDefaults", () => {
    const profile = buildCompProfile([]);

    expect(profile.apRatio).toBe(0);
    expect(profile.adRatio).toBe(1);
    expect(profile.ccScore).toBe(0);
    expect(profile.healScore).toBe(0);
  });

  it("buildCompProfile_TwoCcChampions_ReturnsCcScoreTwo", () => {
    const enemies = [
      makePlayer({ championName: "Leona" }),
      makePlayer({ championName: "Nautilus" }),
      makePlayer({ championName: "Ahri" }),
    ];

    const profile = buildCompProfile(enemies);

    expect(profile.ccScore).toBe(2);
  });

  it("buildCompProfile_TwoHealers_ReturnsHealScoreTwo", () => {
    const enemies = [
      makePlayer({ championName: "Soraka" }),
      makePlayer({ championName: "Yuumi" }),
      makePlayer({ championName: "Caitlyn" }),
    ];

    const profile = buildCompProfile(enemies);

    expect(profile.healScore).toBe(2);
  });

  it("buildCompProfile_ApHealerChampion_CountsBothApAndHeal", () => {
    const enemies = [makePlayer({ championName: "Soraka" })];

    const profile = buildCompProfile(enemies);

    expect(profile.apRatio).toBe(1);
    expect(profile.healScore).toBe(1);
  });
});

describe("getHeuristicRecommendations", () => {
  it("getHeuristicRecommendations_ApChampVsTwoHealers_IncludesMorellonomicon", () => {
    const profile = { apRatio: 0.4, adRatio: 0.6, ccScore: 0, healScore: 2 };

    const rec = getHeuristicRecommendations(profile, "Ahri", makeGameState());

    expect(rec.items.some((i) => i.id === 3165)).toBe(true);
  });

  it("getHeuristicRecommendations_AdChampVsTwoHealers_IncludesMortalReminder", () => {
    const profile = { apRatio: 0.4, adRatio: 0.6, ccScore: 0, healScore: 2 };

    const rec = getHeuristicRecommendations(profile, "Caitlyn", makeGameState());

    expect(rec.items.some((i) => i.id === 3033)).toBe(true);
  });

  it("getHeuristicRecommendations_ApHeavyComp_ApChampGetsBansheesVeil", () => {
    const profile = { apRatio: 0.8, adRatio: 0.2, ccScore: 0, healScore: 0 };

    const rec = getHeuristicRecommendations(profile, "Ahri", makeGameState());

    expect(rec.items.some((i) => i.id === 3102)).toBe(true);
  });

  it("getHeuristicRecommendations_ApHeavyComp_AdChampGetsNoHeuristicItem", () => {
    const profile = { apRatio: 0.8, adRatio: 0.2, ccScore: 0, healScore: 0 };

    const rec = getHeuristicRecommendations(profile, "Caitlyn", makeGameState());

    // AD champs vs AP-heavy: no heuristic item — LLM handles build recommendation
    expect(rec.items.some((i) => i.id === 3102)).toBe(false);
    expect(rec.items.some((i) => i.id === 3143)).toBe(false);
  });

  it("getHeuristicRecommendations_AdHeavyComp_NoRanduinsForAnyone", () => {
    const profile = { apRatio: 0.1, adRatio: 0.9, ccScore: 0, healScore: 0 };

    const rec = getHeuristicRecommendations(profile, "Caitlyn", makeGameState());

    // AD-heavy counters are role-specific — handled by LLM, not heuristic
    expect(rec.items.some((i) => i.id === 3143)).toBe(false);
  });

  it("getHeuristicRecommendations_ThreePlusCcChampions_IncludesQss", () => {
    const profile = { apRatio: 0.4, adRatio: 0.6, ccScore: 3, healScore: 0 };

    const rec = getHeuristicRecommendations(profile, "Caitlyn", makeGameState());

    expect(rec.items.some((i) => i.id === 3140)).toBe(true);
  });

  it("getHeuristicRecommendations_BalancedCompNoThreats_ReturnsEmptyItems", () => {
    const profile = { apRatio: 0.5, adRatio: 0.5, ccScore: 1, healScore: 1 };

    const rec = getHeuristicRecommendations(profile, "Caitlyn", makeGameState());

    expect(rec.items).toHaveLength(0);
  });

  it("getHeuristicRecommendations_AnyInput_SourceIsAlwaysHeuristic", () => {
    const profile = { apRatio: 0, adRatio: 1, ccScore: 0, healScore: 0 };

    const rec = getHeuristicRecommendations(profile, "Caitlyn", makeGameState());

    expect(rec.source).toBe("heuristic");
  });

  it("getHeuristicRecommendations_AnyInput_AlwaysIncludesStrategy", () => {
    const profile = { apRatio: 0.5, adRatio: 0.5, ccScore: 1, healScore: 0 };

    const rec = getHeuristicRecommendations(profile, "Lux", makeGameState());

    expect(rec.strategy).toBeDefined();
    expect(["early", "mid", "late"]).toContain(rec.strategy.winCondition);
    expect(rec.strategy.summary).toBeTruthy();
    expect(rec.strategy.lateGamePlan).toBeTruthy();
  });
});

describe("buildHeuristicStrategy", () => {
  const profile = { apRatio: 0.5, adRatio: 0.5, ccScore: 0, healScore: 0 };

  it("buildHeuristicStrategy_EarlyGameAhead_ReturnsEarlyWinCondition", () => {
    const state = makeGameState({
      activePlayer: { ...makeGameState().activePlayer, currentGold: 2000 },
      localPlayer: {
        ...makeGameState().localPlayer,
        scores: { kills: 3, deaths: 0, assists: 2, creepScore: 80, wardScore: 0 },
      },
      gameTime: 5 * 60,
    });

    const strategy = buildHeuristicStrategy(state, profile, "Zed");

    expect(strategy.winCondition).toBe("early");
    expect(strategy.summary).toContain("ahead");
  });

  it("buildHeuristicStrategy_EarlyGameBehind_ReturnsLateWinConditionForApChamp", () => {
    const state = makeGameState({ gameTime: 5 * 60 });

    const strategy = buildHeuristicStrategy(state, profile, "Lux");

    expect(strategy.winCondition).toBe("late");
  });

  it("buildHeuristicStrategy_LateGamePhase_ReturnsLateWinCondition", () => {
    const state = makeGameState({ gameTime: 26 * 60 });

    const strategy = buildHeuristicStrategy(state, profile, "Caitlyn");

    expect(strategy.winCondition).toBeDefined();
  });
});
