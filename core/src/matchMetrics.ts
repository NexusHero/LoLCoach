import type { EarlyDeath, MatchReview, MinuteDiff, ObjectiveEvent, ShopVisit } from "./analysisTypes.js";
import type {
  RiotMatch,
  RiotParticipant,
  RiotParticipantFrame,
  RiotTimeline,
  RiotTimelineEvent,
} from "./riotApi.js";

const MINUTE_MS = 60_000;
const EARLY_DEATH_CUTOFF_MS = 14 * MINUTE_MS;
const REMAKE_MAX_SEC = 300;
/** Summoner's Rift spans roughly 0–14870 on both axes; the river is x + y ≈ MAP_DIAGONAL. */
const MAP_DIAGONAL = 14_800;
const RIVER_HALF_WIDTH = 1_300;
const MID_LANE_HALF_WIDTH = 1_700;
const SIDE_LANE_EDGE = 3_200;
const BASE_RADIUS = 4_200;
const MAP_MAX = 14_870;
/** Players within this distance of an epic objective at the nearest frame count as present. */
const OBJECTIVE_PRESENCE_RADIUS = 4_000;
/** Voidgrub kills this close together belong to one camp. */
const GRUB_CAMP_WINDOW_MS = 90_000;
const SHOP_VISIT_WINDOW_MS = 20_000;
const FIRST_SHOP_CUTOFF_MS = MINUTE_MS;
const CORE_ITEM_MIN_GOLD = 2_200;

const EPIC_MONSTERS = new Set(["DRAGON", "BARON_NASHOR", "RIFTHERALD", "HORDE", "ATAKHAN"]);

/** Item data the metrics need; injected so tests do not depend on Data Dragon. */
export interface ItemLookup {
  (itemId: number): { name: string; totalGold?: number; into?: number[]; tags?: string[] } | undefined;
}

export function patchOf(gameVersion: string): string {
  return gameVersion.split(".").slice(0, 2).join(".");
}

export function isRemake(match: RiotMatch): boolean {
  return match.info.gameDuration < REMAKE_MAX_SEC;
}

export function findLaneOpponent(
  match: RiotMatch,
  me: RiotParticipant,
): RiotParticipant | undefined {
  if (!me.teamPosition) return undefined;
  return match.info.participants.find(
    (p) => p.teamId !== me.teamId && p.teamPosition === me.teamPosition,
  );
}

function frameAt(timeline: RiotTimeline, minute: number) {
  const frames = timeline.info.frames;
  return frames[Math.min(minute, frames.length - 1)];
}

function participantFrame(
  timeline: RiotTimeline,
  minute: number,
  participantId: number,
): RiotParticipantFrame | undefined {
  return frameAt(timeline, minute)?.participantFrames[String(participantId)];
}

function csOf(frame: RiotParticipantFrame | undefined): number {
  return frame ? frame.minionsKilled + frame.jungleMinionsKilled : 0;
}

function allEvents(timeline: RiotTimeline): RiotTimelineEvent[] {
  return timeline.info.frames.flatMap((f) => f.events);
}

/** Describes a map position from the point of view of `teamId` (100 = blue, bottom-left). */
export function describeZone(pos: { x: number; y: number } | undefined, teamId: number): string {
  if (!pos) return "Unknown position";
  const { x, y } = pos;
  const ownBase = teamId === 100 ? { x: 0, y: 0 } : { x: MAP_MAX, y: MAP_MAX };
  const enemyBase = teamId === 100 ? { x: MAP_MAX, y: MAP_MAX } : { x: 0, y: 0 };
  if (Math.hypot(x - ownBase.x, y - ownBase.y) < BASE_RADIUS) return "Own base";
  if (Math.hypot(x - enemyBase.x, y - enemyBase.y) < BASE_RADIUS) return "Enemy base";

  const diagonal = x + y - MAP_DIAGONAL;
  if (Math.abs(diagonal) < RIVER_HALF_WIDTH) {
    if (Math.abs(x - y) < MID_LANE_HALF_WIDTH) return "Mid lane, river";
    return x < y ? "River, top side" : "River, bot side";
  }
  const enemyHalf = teamId === 100 ? diagonal > 0 : diagonal < 0;
  const half = enemyHalf ? "enemy half" : "own half";

  let area = "Jungle";
  if (Math.abs(x - y) < MID_LANE_HALF_WIDTH) area = "Mid lane";
  else if (x < SIDE_LANE_EDGE || y > MAP_MAX - SIDE_LANE_EDGE) area = "Top lane";
  else if (y < SIDE_LANE_EDGE || x > MAP_MAX - SIDE_LANE_EDGE) area = "Bot lane";
  return `${area}, ${half}`;
}

export function computeEarlyDeaths(
  match: RiotMatch,
  timeline: RiotTimeline,
  me: RiotParticipant,
): EarlyDeath[] {
  const byId = new Map(match.info.participants.map((p) => [p.participantId, p]));
  return allEvents(timeline)
    .filter(
      (e) =>
        e.type === "CHAMPION_KILL" &&
        e.victimId === me.participantId &&
        e.timestamp < EARLY_DEATH_CUTOFF_MS,
    )
    .map((e) => ({
      time: Math.floor(e.timestamp / 1000),
      zone: describeZone(e.position, me.teamId),
      killerChampion: byId.get(e.killerId ?? -1)?.championName ?? "Tower / minions",
      enemiesInvolved: (e.killerId && e.killerId > 0 ? 1 : 0) + (e.assistingParticipantIds?.length ?? 0),
    }));
}

/** Epic objective kills, with voidgrub kills collapsed into one entry per camp. */
function epicObjectives(timeline: RiotTimeline): RiotTimelineEvent[] {
  const result: RiotTimelineEvent[] = [];
  let lastGrub = -Infinity;
  for (const e of allEvents(timeline)) {
    if (e.type !== "ELITE_MONSTER_KILL" || !EPIC_MONSTERS.has(e.monsterType ?? "")) continue;
    if (e.monsterType === "HORDE") {
      if (e.timestamp - lastGrub < GRUB_CAMP_WINDOW_MS) continue;
      lastGrub = e.timestamp;
    }
    result.push(e);
  }
  return result;
}

function wasPresent(timeline: RiotTimeline, obj: RiotTimelineEvent, participantId: number): boolean {
  if (obj.killerId === participantId) return true;
  const minute = Math.round(obj.timestamp / MINUTE_MS);
  const pos = participantFrame(timeline, minute, participantId)?.position;
  return !!(pos && obj.position && Math.hypot(pos.x - obj.position.x, pos.y - obj.position.y) <= OBJECTIVE_PRESENCE_RADIUS);
}

export function computeObjectiveEvents(
  timeline: RiotTimeline,
  participantId: number,
  teamId: number,
): ObjectiveEvent[] {
  return epicObjectives(timeline).map((obj) => ({
    time: Math.floor(obj.timestamp / 1000),
    type: obj.monsterType ?? "UNKNOWN",
    ownTeam: obj.killerTeamId === teamId,
    present: wasPresent(timeline, obj, participantId),
  }));
}

export function computeObjectivePresence(
  timeline: RiotTimeline,
  participantId: number,
): { total: number; present: number } {
  const objectives = epicObjectives(timeline);
  const present = objectives.filter((obj) => wasPresent(timeline, obj, participantId)).length;
  return { total: objectives.length, present };
}

export function computeMinuteDiffs(
  timeline: RiotTimeline,
  meId: number,
  oppId: number | undefined,
): MinuteDiff[] {
  return timeline.info.frames.map((frame, minute) => {
    const me = frame.participantFrames[String(meId)];
    const opp = oppId === undefined ? undefined : frame.participantFrames[String(oppId)];
    return {
      minute,
      gold: (me?.totalGold ?? 0) - (opp?.totalGold ?? me?.totalGold ?? 0),
      xp: (me?.xp ?? 0) - (opp?.xp ?? me?.xp ?? 0),
      cs: csOf(me) - (opp ? csOf(opp) : csOf(me)),
    };
  });
}

/** A purchase is ignored when undone right after (ITEM_UNDO with matching beforeId). */
function effectivePurchases(timeline: RiotTimeline, participantId: number): RiotTimelineEvent[] {
  const events = allEvents(timeline).filter((e) => e.participantId === participantId);
  const purchases: RiotTimelineEvent[] = [];
  for (const e of events) {
    if (e.type === "ITEM_PURCHASED") purchases.push(e);
    else if (e.type === "ITEM_UNDO") {
      const beforeId = (e as RiotTimelineEvent & { beforeId?: number }).beforeId;
      const idx = purchases.map((p) => p.itemId).lastIndexOf(beforeId);
      if (idx >= 0) purchases.splice(idx, 1);
    }
  }
  return purchases;
}

export function computeItemTiming(
  timeline: RiotTimeline,
  participantId: number,
  items: ItemLookup,
): { firstCoreItem?: string; firstCoreItemId?: number; firstCoreItemMinute?: number; shopVisits: ShopVisit[] } {
  const purchases = effectivePurchases(timeline, participantId);

  const core = purchases.find((p) => {
    const info = items(p.itemId ?? 0);
    if (!info) return false;
    const isFinal = !info.into || info.into.length === 0;
    const isBoots = info.tags?.includes("Boots") ?? false;
    return isFinal && !isBoots && (info.totalGold ?? 0) >= CORE_ITEM_MIN_GOLD;
  });

  const shopVisits: ShopVisit[] = [];
  let current: ShopVisit | undefined;
  let lastTime = -Infinity;
  for (const p of purchases) {
    if (p.timestamp < FIRST_SHOP_CUTOFF_MS) continue;
    const name = items(p.itemId ?? 0)?.name ?? `Item ${p.itemId}`;
    if (!current || p.timestamp - lastTime > SHOP_VISIT_WINDOW_MS) {
      const minute = Math.floor(p.timestamp / MINUTE_MS);
      current = {
        time: Math.floor(p.timestamp / 1000),
        goldBefore: participantFrame(timeline, minute, participantId)?.currentGold ?? 0,
        itemsBought: [],
        itemIds: [],
      };
      shopVisits.push(current);
    }
    current.itemsBought.push(name);
    current.itemIds?.push(p.itemId ?? 0);
    lastTime = p.timestamp;
  }

  return {
    ...(core
      ? {
          firstCoreItem: items(core.itemId ?? 0)?.name,
          firstCoreItemId: core.itemId,
          firstCoreItemMinute: Math.round((core.timestamp / MINUTE_MS) * 10) / 10,
        }
      : {}),
    shopVisits,
  };
}

/** Lane metrics of one participant; shared by the personal review and the benchmark aggregation. */
export interface LaneSample {
  role: string;
  cs10: number;
  csDiff10: number;
  earlyDeaths: number;
  gold15: number;
  goldDiff15: number;
  xpDiff15: number;
  objectivePresence: number;
}

export function computeLaneSample(
  match: RiotMatch,
  timeline: RiotTimeline,
  me: RiotParticipant,
): LaneSample | undefined {
  const opp = findLaneOpponent(match, me);
  if (!opp || isRemake(match)) return undefined;
  const my10 = participantFrame(timeline, 10, me.participantId);
  const opp10 = participantFrame(timeline, 10, opp.participantId);
  const my15 = participantFrame(timeline, 15, me.participantId);
  const opp15 = participantFrame(timeline, 15, opp.participantId);
  const presence = computeObjectivePresence(timeline, me.participantId);
  return {
    role: me.teamPosition,
    cs10: csOf(my10),
    csDiff10: csOf(my10) - csOf(opp10),
    earlyDeaths: computeEarlyDeaths(match, timeline, me).length,
    gold15: my15?.totalGold ?? 0,
    goldDiff15: (my15?.totalGold ?? 0) - (opp15?.totalGold ?? 0),
    xpDiff15: (my15?.xp ?? 0) - (opp15?.xp ?? 0),
    objectivePresence: presence.total > 0 ? presence.present / presence.total : 0,
  };
}

/** Full personal review of one match for the player with `puuid`. */
export function computeMatchReview(
  match: RiotMatch,
  timeline: RiotTimeline,
  puuid: string,
  items: ItemLookup,
): MatchReview | undefined {
  const me = match.info.participants.find((p) => p.puuid === puuid);
  if (!me || isRemake(match)) return undefined;
  const opp = findLaneOpponent(match, me);
  const lane = computeLaneSample(match, timeline, me);
  const presence = computeObjectivePresence(timeline, me.participantId);

  return {
    matchId: match.metadata.matchId,
    gameStart: match.info.gameStartTimestamp ?? match.info.gameCreation,
    durationSec: match.info.gameDuration,
    patch: patchOf(match.info.gameVersion),
    win: me.win,
    role: me.teamPosition || "UNKNOWN",
    champion: me.championName,
    ...(opp ? { opponentChampion: opp.championName } : {}),
    kills: me.kills,
    deaths: me.deaths,
    assists: me.assists,
    cs10: lane?.cs10 ?? csOf(participantFrame(timeline, 10, me.participantId)),
    csDiff10: lane?.csDiff10 ?? 0,
    earlyDeaths: computeEarlyDeaths(match, timeline, me),
    gold15: lane?.gold15 ?? participantFrame(timeline, 15, me.participantId)?.totalGold ?? 0,
    goldDiff15: lane?.goldDiff15 ?? 0,
    xpDiff15: lane?.xpDiff15 ?? 0,
    objectivePresence: presence.total > 0 ? presence.present / presence.total : 0,
    objectivesTotal: presence.total,
    objectivesPresent: presence.present,
    objectiveEvents: computeObjectiveEvents(timeline, me.participantId, me.teamId),
    minuteDiffs: computeMinuteDiffs(timeline, me.participantId, opp?.participantId),
    ...computeItemTiming(timeline, me.participantId, items),
  };
}
