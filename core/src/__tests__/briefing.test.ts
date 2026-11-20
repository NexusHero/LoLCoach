import type { MatchReview } from "../analysisTypes";
import {
  assembleBriefing,
  historyPoint,
  lastMatchInMatchup,
  normalizeChampion,
  parseBriefingReply,
} from "../briefing";

function review(overrides: Partial<MatchReview>): MatchReview {
  return {
    matchId: "m",
    gameStart: Date.UTC(2026, 10, 15),
    durationSec: 1_800,
    patch: "16.22",
    win: false,
    role: "MIDDLE",
    champion: "Malzahar",
    opponentChampion: "Hwei",
    kills: 3,
    deaths: 7,
    assists: 4,
    cs10: 95,
    csDiff10: 22,
    earlyDeaths: [],
    gold15: 5_000,
    goldDiff15: -804,
    xpDiff15: -896,
    objectivePresence: 0.2,
    objectivesTotal: 5,
    objectivesPresent: 1,
    minuteDiffs: [],
    shopVisits: [],
    ...overrides,
  };
}

describe("briefing", () => {
  it("normalizeChampion_LiveClientAndMatchNames_AreEqual", () => {
    expect(normalizeChampion("Kai'Sa")).toBe(normalizeChampion("Kaisa"));
    expect(normalizeChampion("Dr. Mundo")).toBe(normalizeChampion("DrMundo"));
  });

  it("lastMatchInMatchup_SeveralGames_ReturnsNewestOfExactPairing", () => {
    const games = [
      review({ matchId: "new-other", opponentChampion: "Zed" }),
      review({ matchId: "new-hwei" }),
      review({ matchId: "old-hwei" }),
    ];
    expect(lastMatchInMatchup(games, "Malzahar", "Hwei")?.matchId).toBe("new-hwei");
    expect(lastMatchInMatchup(games, "Ahri", "Hwei")).toBeUndefined();
  });

  it("historyPoint_LastGameWithEarlyDeaths_StatesNumbersAndFirstDeathZone", () => {
    const last = review({
      earlyDeaths: [
        { time: 645, zone: "Mid lane, own half", killerChampion: "Hwei", enemiesInvolved: 1 },
        { time: 716, zone: "Mid lane, own half", killerChampion: "Hwei", enemiesInvolved: 2 },
      ],
    });

    const point = historyPoint(last, "Hwei", "Respect Hwei level 6.");

    expect(point.kind).toBe("history");
    expect(point.text).toBe(
      "Last time (loss, 2026-11-15): CS +22 at 10:00, gold -804 at 15:00, 2 deaths before 14:00 (Mid lane, own half). Note: Respect Hwei level 6.",
    );
  });

  it("historyPoint_NoGameNoNote_SaysSo", () => {
    expect(historyPoint(undefined, "Zed").text).toBe("No reviewed game against Zed yet.");
  });

  it("parseBriefingReply_ValidJsonInFence_ReturnsTradingAndSpike", () => {
    const points = parseBriefingReply('```json\n{"trading":"Short trades favour you.","spike":"Level 6 all-in."}\n```');
    expect(points).toEqual([
      { kind: "trading", text: "Short trades favour you." },
      { kind: "spike", text: "Level 6 all-in." },
    ]);
  });

  it("parseBriefingReply_GarbageOrMissing_ReturnsNoPoints", () => {
    expect(parseBriefingReply("not json")).toEqual([]);
    expect(parseBriefingReply(undefined)).toEqual([]);
  });

  it("assembleBriefing_PutsLlmPointsBeforeHistory", () => {
    const b = assembleBriefing("Malzahar", "Hwei", "MIDDLE", [{ kind: "spike", text: "s" }], { kind: "history", text: "h" }, 1);
    expect(b.points.map((p) => p.kind)).toEqual(["spike", "history"]);
  });
});
