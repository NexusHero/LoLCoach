import type {
  ParsedGameState,
  ObjectiveTimer,
  MacroAlert,
  LiveGameEvent,
} from "./types.js";

// Objective timings as of patch 26.1 (verified against patch 26.22).
const DRAGON_FIRST_SPAWN_SEC = 300; // 5:00
const DRAGON_RESPAWN_SEC = 300; // 5:00
const DRAGONS_FOR_SOUL = 4;
const ELDER_RESPAWN_SEC = 360; // 6:00 after soul / previous Elder
const GRUBS_SPAWN_SEC = 480; // 8:00
const GRUBS_DESPAWN_SEC = 885; // 14:45
const GRUBS_COUNT = 3; // single camp of three, no respawn
const HERALD_SPAWN_SEC = 900; // 15:00
const HERALD_DESPAWN_SEC = 1185; // 19:45
const BARON_FIRST_SPAWN_SEC = 1200; // 20:00
const BARON_RESPAWN_SEC = 360; // 6:00
const BARON_VISIBLE_FROM_SEC = 1080; // show the countdown from 18:00

const SPAWNING_SOON_SEC = 75;
const ALERT_WINDOW_MIN_SEC = 35;
const GOLD_ALERT_MIN = 1400;
const GOLD_ALERT_IMMEDIATE = 1800;
const GOLD_HOARDING_SEC = 30;
const MAX_ALERTS = 2;

type Team = "ORDER" | "CHAOS";

function timerStatus(secondsUntilSpawn: number): ObjectiveTimer["status"] {
  if (secondsUntilSpawn === 0) return "alive";
  return secondsUntilSpawn <= SPAWNING_SOON_SEC ? "spawning_soon" : "countdown";
}

function makeTimer(
  type: ObjectiveTimer["type"],
  label: string,
  spawnAtSec: number,
  gameTime: number,
): ObjectiveTimer {
  const secondsUntilSpawn = Math.max(0, Math.floor(spawnAtSec - gameTime));
  return { type, label, secondsUntilSpawn, status: timerStatus(secondsUntilSpawn) };
}

function latestEvent(events: LiveGameEvent[]): LiveGameEvent | undefined {
  return events.reduce<LiveGameEvent | undefined>(
    (latest, e) => (!latest || e.EventTime > latest.EventTime ? e : latest),
    undefined,
  );
}

/** Live events carry the game name only; player entries may carry "Name#TAG". */
function baseName(name: string): string {
  return name.split("#")[0].trim().toLowerCase();
}

function buildTeamLookup(state: ParsedGameState): Map<string, Team> {
  const lookup = new Map<string, Team>();
  for (const p of [state.localPlayer, ...state.allies, ...state.enemies]) {
    lookup.set(baseName(p.summonerName), p.team);
  }
  return lookup;
}

function isElderKill(e: LiveGameEvent): boolean {
  return (e.DragonType ?? "").toLowerCase() === "elder";
}

/**
 * True once one team holds the Dragon Soul. Kills whose killer cannot be
 * mapped to a team are ignored, except that seven elemental kills always
 * imply a soul (one team must hold four).
 */
function isSoulTaken(elementalKills: LiveGameEvent[], teams: Map<string, Team>): boolean {
  if (elementalKills.length >= DRAGONS_FOR_SOUL * 2 - 1) return true;
  const counts: Record<Team, number> = { ORDER: 0, CHAOS: 0 };
  for (const kill of elementalKills) {
    const team = kill.KillerName ? teams.get(baseName(kill.KillerName)) : undefined;
    if (team) counts[team] += 1;
  }
  return counts.ORDER >= DRAGONS_FOR_SOUL || counts.CHAOS >= DRAGONS_FOR_SOUL;
}

function computeDragonTimer(state: ParsedGameState, events: LiveGameEvent[]): ObjectiveTimer {
  const t = state.gameTime;
  const dragonKills = events.filter((e) => e.EventName === "DragonKill");
  const lastKill = latestEvent(dragonKills);
  const elementalKills = dragonKills.filter((e) => !isElderKill(e));

  if (lastKill && isSoulTaken(elementalKills, buildTeamLookup(state))) {
    return makeTimer("elder", "Elder Dragon", lastKill.EventTime + ELDER_RESPAWN_SEC, t);
  }
  const spawnAt = lastKill ? lastKill.EventTime + DRAGON_RESPAWN_SEC : DRAGON_FIRST_SPAWN_SEC;
  return makeTimer("dragon", "Dragon", spawnAt, t);
}

/** Top-side pit before Baron: Voidgrubs until 14:45, then Rift Herald until 19:45. */
function computeVoidPitTimer(t: number, events: LiveGameEvent[]): ObjectiveTimer | undefined {
  const grubKills = events.filter((e) => e.EventName === "HordeKill").length;
  if (t < GRUBS_DESPAWN_SEC && grubKills < GRUBS_COUNT) {
    return makeTimer("grubs", "Voidgrubs", GRUBS_SPAWN_SEC, t);
  }
  const heraldKilled = events.some((e) => e.EventName === "HeraldKill");
  if (t < HERALD_DESPAWN_SEC && !heraldKilled) {
    return makeTimer("herald", "Rift Herald", HERALD_SPAWN_SEC, t);
  }
  return undefined;
}

function computeBaronTimer(t: number, events: LiveGameEvent[]): ObjectiveTimer | undefined {
  if (t < BARON_VISIBLE_FROM_SEC) return undefined;
  const lastKill = latestEvent(events.filter((e) => e.EventName === "BaronKill"));
  const spawnAt = lastKill ? lastKill.EventTime + BARON_RESPAWN_SEC : BARON_FIRST_SPAWN_SEC;
  return makeTimer("baron", "Baron", spawnAt, t);
}

export function computeObjectives(state: ParsedGameState): ObjectiveTimer[] {
  const t = state.gameTime;
  const events = state.mapEvents ?? [];
  const timers: Array<ObjectiveTimer | undefined> = [
    computeDragonTimer(state, events),
    computeVoidPitTimer(t, events),
    computeBaronTimer(t, events),
  ];
  return timers.filter((timer): timer is ObjectiveTimer => timer !== undefined);
}

/**
 * Informational banner, capped at two entries. It only surfaces facts the
 * game client itself shows (objective spawn countdown, own unspent gold) and
 * never tells the player what to do — Riot's third-party policy forbids tools
 * that dictate decisions or raise power-spike / gank alarms.
 */
export function computeMacroAlerts(
  state: ParsedGameState,
  objectives: ObjectiveTimer[],
  goldHoardingSeconds = 0,
): MacroAlert[] {
  const alerts: MacroAlert[] = [];
  const gold = Math.floor(state.activePlayer.currentGold);

  const upcoming = objectives.find(
    (o) => o.secondsUntilSpawn >= ALERT_WINDOW_MIN_SEC && o.secondsUntilSpawn <= SPAWNING_SOON_SEC,
  );
  if (upcoming) {
    alerts.push({
      id: `obj_spawn_${upcoming.type}`,
      priority: "warning",
      category: "objective",
      title: `${upcoming.label.toUpperCase()} IN ${upcoming.secondsUntilSpawn}s`,
      detail: `Spawns soon — you hold ${gold}g`,
    });
  }

  const hoarding = goldHoardingSeconds >= GOLD_HOARDING_SEC || gold >= GOLD_ALERT_IMMEDIATE;
  if (!state.localPlayer.isDead && gold >= GOLD_ALERT_MIN && hoarding) {
    alerts.push({
      id: "gold_hoarding",
      priority: "info",
      category: "economy",
      title: `UNSPENT GOLD: ${gold}g`,
      detail: "Enough gold for your next item component",
    });
  }

  return alerts.slice(0, MAX_ALERTS);
}
