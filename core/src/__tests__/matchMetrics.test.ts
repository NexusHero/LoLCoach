import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  computeLaneSample,
  computeMatchReview,
  describeZone,
  patchOf,
  type ItemLookup,
} from "../matchMetrics";
import type { RiotMatch, RiotTimeline } from "../riotApi";

// Real ranked game (anonymised: player ids replaced, names removed). PUUID_8 is
// a mid-lane Malzahar against Hwei who lost the lane after two deaths at 10:45 / 11:56.
const match = JSON.parse(readFileSync(join(__dirname, "fixtures", "match.json"), "utf8")) as RiotMatch;
const timeline = JSON.parse(readFileSync(join(__dirname, "fixtures", "timeline.json"), "utf8")) as RiotTimeline;

const items: ItemLookup = (id) =>
  ({
    3802: { name: "Lost Chapter", totalGold: 1200, into: [6655] },
    6655: { name: "Luden's Companion", totalGold: 2750 },
    3020: { name: "Sorcerer's Shoes", totalGold: 1100, tags: ["Boots"] },
  })[id];

describe("matchMetrics", () => {
  const review = computeMatchReview(match, timeline, "PUUID_8", items);

  it("computeMatchReview_RealGame_IdentifiesRoleChampionAndLaneOpponent", () => {
    expect(review?.role).toBe("MIDDLE");
    expect(review?.champion).toBe("Malzahar");
    expect(review?.opponentChampion).toBe("Hwei");
    expect(review?.win).toBe(false);
    expect(review?.patch).toBe("16.22");
  });

  it("computeMatchReview_RealGame_ComputesLaneDiffsAtTenAndFifteen", () => {
    expect(review?.cs10).toBe(95);
    expect(review?.csDiff10).toBe(22);
    expect(review?.goldDiff15).toBe(-804);
    expect(review?.xpDiff15).toBe(-896);
    expect(review?.gold15).toBeGreaterThan(0);
  });

  it("computeMatchReview_RealGame_ListsDeathsBeforeFourteenWithZoneAndKiller", () => {
    expect(review?.earlyDeaths).toEqual([
      { time: 645, zone: "Mid lane, own half", killerChampion: "Hwei", enemiesInvolved: 1 },
      { time: 716, zone: "Mid lane, own half", killerChampion: "Hwei", enemiesInvolved: 2 },
    ]);
  });

  it("computeMatchReview_RealGame_CountsObjectivePresence", () => {
    expect(review?.objectivesTotal).toBe(5);
    expect(review?.objectivesPresent).toBe(1);
    expect(review?.objectivePresence).toBeCloseTo(0.2);
    expect(review?.objectiveEvents).toHaveLength(5);
    expect(review?.objectiveEvents?.filter((e) => e.present)).toHaveLength(1);
    expect(review?.objectiveEvents?.[0]).toMatchObject({ type: "DRAGON", time: 369, ownTeam: true });
  });

  it("computeMatchReview_RealGame_MinuteDiffsMatchHeadlineValues", () => {
    const at = (m: number) => review?.minuteDiffs.find((d) => d.minute === m);
    expect(at(0)).toEqual({ minute: 0, gold: 0, xp: 0, cs: 0 });
    expect(at(10)?.cs).toBe(22);
    expect(at(15)?.gold).toBe(-804);
  });

  it("computeMatchReview_RealGame_GroupsPurchasesIntoShopVisitsAfterFirstMinute", () => {
    expect(review?.shopVisits.length).toBeGreaterThan(0);
    expect(review?.shopVisits[0]).toMatchObject({ time: 298, goldBefore: 1133 });
    expect(review?.shopVisits[0].itemsBought).toContain("Lost Chapter");
    expect(review?.shopVisits[0].itemIds).toContain(3802);
  });

  it("computeMatchReview_UnknownPuuid_ReturnsUndefined", () => {
    expect(computeMatchReview(match, timeline, "nobody", items)).toBeUndefined();
  });

  it("computeMatchReview_Remake_ReturnsUndefined", () => {
    const remake = { ...match, info: { ...match.info, gameDuration: 200 } };
    expect(computeMatchReview(remake, timeline, "PUUID_8", items)).toBeUndefined();
  });

  it("computeLaneSample_OpponentOfSameGame_MirrorsTheDiffs", () => {
    const hwei = match.info.participants.find((p) => p.championName === "Hwei");
    const sample = hwei ? computeLaneSample(match, timeline, hwei) : undefined;
    expect(sample?.csDiff10).toBe(-22);
    expect(sample?.goldDiff15).toBe(804);
  });

  it("describeZone_BlueAndRedPerspective_ReportsHalvesAndBases", () => {
    expect(describeZone({ x: 500, y: 500 }, 100)).toBe("Own base");
    expect(describeZone({ x: 500, y: 500 }, 200)).toBe("Enemy base");
    expect(describeZone({ x: 1500, y: 9000 }, 100)).toBe("Top lane, own half");
    expect(describeZone({ x: 1500, y: 9000 }, 200)).toBe("Top lane, enemy half");
    expect(describeZone({ x: 7400, y: 7400 }, 100)).toBe("Mid lane, river");
    expect(describeZone(undefined, 100)).toBe("Unknown position");
  });

  it("patchOf_FullGameVersion_ReturnsMajorMinor", () => {
    expect(patchOf("16.22.834.8910")).toBe("16.22");
  });
});
