import { addToHistogram, binIndex, emptyAggregate, percentileOf } from "../benchmarkAggregator";
import type { Benchmark, MatchReview } from "../analysisTypes";
import {
  blockPassed,
  chooseGoal,
  isBlockComplete,
  mainRole,
  meetsTarget,
  newGoal,
  recordMatches,
  templateGoalText,
} from "../goals";
import { aggregationTiers, nextTierOf } from "../analysisService";

function makeReview(overrides: Partial<MatchReview> = {}): MatchReview {
  return {
    matchId: "EUW1_1",
    gameStart: 1_000,
    durationSec: 1_800,
    patch: "16.22",
    win: true,
    role: "TOP",
    champion: "Darius",
    opponentChampion: "Garen",
    kills: 3,
    deaths: 2,
    assists: 4,
    cs10: 70,
    csDiff10: 0,
    earlyDeaths: [],
    gold15: 5_200,
    goldDiff15: 0,
    xpDiff15: 0,
    objectivePresence: 0.5,
    objectivesTotal: 4,
    objectivesPresent: 2,
    minuteDiffs: [],
    shopVisits: [],
    ...overrides,
  };
}

const emerald: Benchmark = {
  tier: "EMERALD",
  role: "TOP",
  patch: "16.22",
  sampleSize: 300,
  cs10: 72,
  earlyDeaths: 0.8,
  gold15: 5_200,
  objectivePresence: 0.55,
};

describe("goals", () => {
  it("chooseGoal_PlayerFarBehindOnEarlyDeaths_PicksEarlyDeathsWithFlooredTarget", () => {
    const death = { time: 300, zone: "Top lane, own half", killerChampion: "Garen", enemiesInvolved: 2 };
    const recent = [1, 2, 3].map((i) =>
      makeReview({ matchId: `m${i}`, earlyDeaths: [death, death, death], cs10: 71, gold15: 5_100 }),
    );

    const choice = chooseGoal(recent, emerald, "EMERALD");

    expect(choice).toEqual({ metric: "earlyDeaths", target: 0, basedOnTier: "EMERALD" });
  });

  it("chooseGoal_NoOrThinBenchmark_ReturnsNoGoal", () => {
    const recent = [makeReview({ cs10: 40 })];

    expect(chooseGoal(recent, undefined, "EMERALD")).toBeUndefined();
    expect(chooseGoal(recent, { ...emerald, sampleSize: 40 }, "EMERALD")).toBeUndefined();
  });

  it("chooseGoal_NoGames_ReturnsUndefined", () => {
    expect(chooseGoal([], emerald, "EMERALD")).toBeUndefined();
  });

  it("meetsTarget_LowerIsBetterOnlyForEarlyDeaths", () => {
    expect(meetsTarget("earlyDeaths", 1, 1)).toBe(true);
    expect(meetsTarget("earlyDeaths", 2, 1)).toBe(false);
    expect(meetsTarget("cs10", 75, 72)).toBe(true);
    expect(meetsTarget("cs10", 70, 72)).toBe(false);
  });

  it("recordMatches_OnlyGamesAfterGoal_FillsBlockOldestFirstUpToFive", () => {
    const goal = newGoal({ metric: "cs10", target: 72, basedOnTier: "EMERALD" }, "text", 100);
    const newestFirst = [7, 6, 5, 4, 3, 2, 1, 0].map((i) =>
      makeReview({ matchId: `m${i}`, gameStart: i * 50, cs10: i % 2 === 0 ? 80 : 60 }),
    );

    const updated = recordMatches(goal, newestFirst);

    expect(updated.matchIds).toEqual(["m2", "m3", "m4", "m5", "m6"]);
    expect(updated.results).toEqual([true, false, true, false, true]);
    expect(isBlockComplete(updated)).toBe(true);
    expect(blockPassed(updated)).toBe(false);
  });

  it("blockPassed_FourOfFiveMet_ReturnsTrue", () => {
    const goal = { ...newGoal({ metric: "cs10", target: 72, basedOnTier: "EMERALD" }, "t", 0), matchIds: ["a", "b", "c", "d", "e"], results: [true, true, false, true, true] };
    expect(blockPassed(goal)).toBe(true);
  });

  it("templateGoalText_PercentAndLowerIsBetter_FormatsReadably", () => {
    expect(templateGoalText({ metric: "objectivePresence", target: 0.6, basedOnTier: "EMERALD" })).toContain("60%");
    expect(templateGoalText({ metric: "earlyDeaths", target: 1, basedOnTier: "EMERALD" })).toContain("at most 1");
  });

  it("mainRole_MixedRoles_ReturnsMostFrequent", () => {
    const games = [makeReview({ role: "MIDDLE" }), makeReview({ role: "TOP" }), makeReview({ role: "MIDDLE" })];
    expect(mainRole(games)).toBe("MIDDLE");
  });

  it("nextTierOf_And_aggregationTiers_CoverNextRankAndApex", () => {
    expect(nextTierOf("PLATINUM")).toBe("EMERALD");
    expect(nextTierOf("CHALLENGER")).toBe("CHALLENGER");
    expect(nextTierOf("UNRANKED")).toBe("PLATINUM");
    expect(aggregationTiers("PLATINUM")).toEqual(["EMERALD", "MASTER", "GRANDMASTER", "CHALLENGER"]);
    expect(aggregationTiers("MASTER")).toEqual(["GRANDMASTER", "MASTER", "CHALLENGER"]);
  });
});


describe("benchmark histograms", () => {
  it("binIndex_ValuesAtBinEdgesAndOutOfRange_AreClamped", () => {
    expect(binIndex("objectivePresence", 0.3)).toBe(3);
    expect(binIndex("cs10", -4)).toBe(0);
    expect(binIndex("cs10", 999)).toBe(31);
    expect(binIndex("gold15", 5_100)).toBe(12);
  });

  it("percentileOf_TooFewSamples_IsUndefined", () => {
    const a = emptyAggregate("EMERALD", "MIDDLE", "16.22");
    for (let i = 0; i < 49; i++) addToHistogram(a, "cs10", 70);
    expect(percentileOf(a.histograms?.cs10, "cs10", 80)).toBeUndefined();
  });

  it("percentileOf_HigherIsBetterAndLowerIsBetter_CountsHalfOwnBin", () => {
    const a = emptyAggregate("EMERALD", "MIDDLE", "16.22");
    for (let i = 0; i < 50; i++) addToHistogram(a, "cs10", 60); // bin 12
    for (let i = 0; i < 50; i++) addToHistogram(a, "cs10", 80); // bin 16
    for (let d = 0; d < 4; d++) for (let i = 0; i < 25; i++) addToHistogram(a, "earlyDeaths", d);

    expect(percentileOf(a.histograms?.cs10, "cs10", 70)).toBe(50);
    expect(percentileOf(a.histograms?.cs10, "cs10", 82)).toBe(75);
    expect(percentileOf(a.histograms?.earlyDeaths, "earlyDeaths", 0)).toBe(88);
    expect(percentileOf(a.histograms?.earlyDeaths, "earlyDeaths", 3)).toBe(13);
  });
});
