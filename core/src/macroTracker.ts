import type {
  ParsedGameState,
  ObjectiveTimer,
  MacroAlert,
} from "./types.js";

const DRAGON_FIRST_SPAWN_SEC = 300; // 5:00
const DRAGON_RESPAWN_SEC = 300; // 5:00
const GRUBS_SPAWN_SEC = 360; // 6:00
const GRUBS_DESPAWN_SEC = 825; // 13:45
const HERALD_SPAWN_SEC = 840; // 14:00
const HERALD_DESPAWN_SEC = 1185; // 19:45
const BARON_FIRST_SPAWN_SEC = 1200; // 20:00
const BARON_RESPAWN_SEC = 360; // 6:00

export function computeObjectives(state: ParsedGameState): ObjectiveTimer[] {
  const t = state.gameTime;
  const events = state.mapEvents ?? [];
  const timers: ObjectiveTimer[] = [];

  // 1. Dragon timer
  const dragonKills = events
    .filter((e) => e.EventName === "DragonKill")
    .sort((a, b) => b.EventTime - a.EventTime);

  let nextDragonSec = DRAGON_FIRST_SPAWN_SEC;
  if (dragonKills.length > 0) {
    nextDragonSec = Math.floor(dragonKills[0].EventTime + DRAGON_RESPAWN_SEC);
  } else if (t >= DRAGON_FIRST_SPAWN_SEC) {
    nextDragonSec = t; // Alive on map
  }

  const dragonCountdown = Math.max(0, nextDragonSec - t);
  timers.push({
    type: "dragon",
    label: "Dragon",
    secondsUntilSpawn: dragonCountdown,
    status:
      dragonCountdown === 0
        ? "alive"
        : dragonCountdown <= 75
          ? "spawning_soon"
          : "countdown",
  });

  // 2. Top-side pit: Grubs (<13:45) -> Herald (14:00-19:45) -> Baron (>=20:00)
  if (t < GRUBS_DESPAWN_SEC) {
    const grubKills = events.filter((e) => e.EventName === "HordeKill");
    if (grubKills.length < 6) {
      const grubCountdown = Math.max(0, GRUBS_SPAWN_SEC - t);
      timers.push({
        type: "grubs",
        label: "Voidgrubs",
        secondsUntilSpawn: grubCountdown,
        status:
          grubCountdown === 0
            ? "alive"
            : grubCountdown <= 75
              ? "spawning_soon"
              : "countdown",
      });
    }
  } else if (t < HERALD_DESPAWN_SEC) {
    const heraldKilled = events.some((e) => e.EventName === "HeraldKill");
    if (!heraldKilled) {
      const heraldCountdown = Math.max(0, HERALD_SPAWN_SEC - t);
      timers.push({
        type: "herald",
        label: "Rift Herald",
        secondsUntilSpawn: heraldCountdown,
        status:
          heraldCountdown === 0
            ? "alive"
            : heraldCountdown <= 75
              ? "spawning_soon"
              : "countdown",
      });
    }
  }

  // Always show Baron countdown from 18:00 onwards
  if (t >= 1080) {
    const baronKills = events
      .filter((e) => e.EventName === "BaronKill")
      .sort((a, b) => b.EventTime - a.EventTime);

    let nextBaronSec = BARON_FIRST_SPAWN_SEC;
    if (baronKills.length > 0) {
      nextBaronSec = Math.floor(baronKills[0].EventTime + BARON_RESPAWN_SEC);
    } else if (t >= BARON_FIRST_SPAWN_SEC) {
      nextBaronSec = t;
    }

    const baronCountdown = Math.max(0, nextBaronSec - t);
    timers.push({
      type: "baron",
      label: "Baron",
      secondsUntilSpawn: baronCountdown,
      status:
        baronCountdown === 0
          ? "alive"
          : baronCountdown <= 75
            ? "spawning_soon"
            : "countdown",
    });
  }

  return timers;
}

/**
 * Priority-Capped Banner — strictly returns at most 2 simultaneous MacroAlerts:
 * 1. Danger (Early Jungle Gank 2:55–3:45 OR Shutdown Bounty Protection)
 * 2. Objective T-60s Reset Window
 * 3. Economy (Gold Hoarding >= 1400g)
 */
export function computeMacroAlerts(
  state: ParsedGameState,
  objectives: ObjectiveTimer[],
  goldHoardingSeconds = 0,
  campedStatus: "normal" | "camped" | "weaksided" = "normal",
): MacroAlert[] {
  const alerts: MacroAlert[] = [];
  const t = state.gameTime;
  const me = state.localPlayer;
  const gold = Math.floor(state.activePlayer.currentGold);

  // Priority 1A: Early Jungle Clear Gank Window (2:55 - 3:45)
  if (t >= 175 && t <= 225 && me.position !== "JUNGLE" && !me.isDead) {
    const enemyJg = state.enemies.find((e) => e.position === "JUNGLE");
    const jgName = enemyJg?.championName ?? "Enemy Jungler";
    alerts.push({
      id: "jungle_gank_window",
      priority: "critical",
      category: "danger",
      title: `GANK WINDOW (3:00–3:40): ${jgName.toUpperCase()}`,
      detail: `${jgName} finished 6-camp clear — ward river & hug safe side`,
    });
  }

  // Priority 1B: Shutdown Bounty Protection
  const netKills = me.scores.kills - me.scores.deaths;
  if (!me.isDead && (netKills >= 3 || (me.scores.kills >= 4 && me.scores.deaths <= 1))) {
    alerts.push({
      id: "shutdown_protection",
      priority: "critical",
      category: "danger",
      title: `PROTECT SHUTDOWN (${me.scores.kills}/${me.scores.deaths}/${me.scores.assists})`,
      detail: "High bounty on your head — avoid blind 1v2s and play on vision",
    });
  }

  // Priority 1C: Active Camped / Weakside Override from Voice/Chat Coach
  if (!me.isDead && (campedStatus === "camped" || campedStatus === "weaksided")) {
    alerts.push({
      id: "camped_protocol",
      priority: "critical",
      category: "danger",
      title: campedStatus === "camped" ? "CAMPED PROTOCOL ACTIVE" : "WEAKSIDE PROTOCOL ACTIVE",
      detail: "Freeze near tower, hold escape spell & buy defensive stats first",
    });
  }

  // Priority 1D: Level 6 Ultimate Spike Disadvantage vs Lane Opponent
  if (!me.isDead && me.position && me.position !== "UNKNOWN" && me.position !== "JUNGLE") {
    const laneOpp = state.enemies.find((e) => e.position === me.position && !e.isDead);
    if (laneOpp && laneOpp.level >= 6 && me.level === 5) {
      alerts.push({
        id: "level_6_disadvantage",
        priority: "critical",
        category: "danger",
        title: `LVL 6 DANGER: ${laneOpp.championName.toUpperCase()} HAS R (YOU: LVL 5)`,
        detail: `Respect ${laneOpp.championName} ultimate all-in — concede wave until you hit Level 6`,
      });
    }
  }

  // Priority 2: Objective T-60s Setup / Reset Window
  const upcomingObj = objectives.find(
    (o) => o.secondsUntilSpawn >= 35 && o.secondsUntilSpawn <= 75,
  );
  if (upcomingObj) {
    alerts.push({
      id: `obj_setup_${upcomingObj.type}`,
      priority: "warning",
      category: "objective",
      title: `${upcomingObj.label.toUpperCase()} IN ${upcomingObj.secondsUntilSpawn}s — RESET NOW`,
      detail: `Push wave & recall (${gold}g in pocket) to arrive 30s early for vision`,
    });
  }

  // Priority 3: Gold Hoarding Warning
  if (!me.isDead && gold >= 1400 && (goldHoardingSeconds >= 30 || gold >= 1800)) {
    alerts.push({
      id: "gold_hoarding",
      priority: "info",
      category: "economy",
      title: `UNSPENT GOLD SPIKE: ${gold}g`,
      detail: "Sitting on unspent combat stats — crash next wave and recall",
    });
  }

  return alerts.slice(0, 2);
}

export function findObjectiveSetupTrigger(
  objectives: ObjectiveTimer[],
): ObjectiveTimer | undefined {
  return objectives.find(
    (o) => o.secondsUntilSpawn >= 50 && o.secondsUntilSpawn <= 68,
  );
}
