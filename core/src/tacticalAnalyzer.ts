import type { ParsedGameState, Player, RolePosition } from "./types.js";
import { ddragon } from "./ddragonService.js";
import {
  FALLBACK_ITEM_DAMAGE_STATS,
  HEALING_CHAMPIONS,
  HEALING_ITEM_IDS,
  ARMOR_ITEM_IDS,
  MR_ITEM_IDS,
  PASSIVE_ITEM_ALTERNATIVES,
} from "./tacticalCatalog.js";

export { PASSIVE_ITEM_ALTERNATIVES };
export { computeNextBestBuy, getDefaultTargetItems } from "./recipeSolver.js";

function normalizeChamp(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function findLaneOpponent(
  state: ParsedGameState,
  myPos: RolePosition,
  laneOpponentOverride?: string,
): Player | undefined {
  if (laneOpponentOverride && laneOpponentOverride.trim().length > 0) {
    const target = normalizeChamp(laneOpponentOverride);
    const matched = state.enemies.find((e) => normalizeChamp(e.championName).includes(target));
    if (matched) return matched;
  }
  if (myPos === "UNKNOWN" || myPos === "") return state.enemies[0];
  const exact = state.enemies.find((e) => e.position === myPos);
  if (exact) return exact;
  const fallbackPos = myPos === "UTILITY" ? "BOTTOM" : myPos;
  return state.enemies.find((e) => e.position === fallbackPos) ?? state.enemies[0];
}

export function computePrimaryThreat(state: ParsedGameState): {
  championName: string;
  reason: string;
  kills: number;
  cs: number;
  level: number;
} | undefined {
  if (state.enemies.length === 0) return undefined;

  let bestEnemy = state.enemies[0];
  let bestScore = -1;

  for (const enemy of state.enemies) {
    const itemGold = enemy.items.reduce((sum, i) => sum + i.price * Math.max(1, i.count), 0);
    const score =
      enemy.scores.kills * 350 +
      enemy.scores.assists * 120 +
      enemy.scores.creepScore * 18 +
      enemy.level * 150 +
      itemGold * 0.5;
    if (score > bestScore) {
      bestScore = score;
      bestEnemy = enemy;
    }
  }

  const coreItems = bestEnemy.items
    .filter((i) => !i.consumable && i.price >= 1000)
    .map((i) => i.displayName)
    .slice(0, 2);
  const itemText = coreItems.length > 0 ? ` (${coreItems.join(", ")})` : "";

  return {
    championName: bestEnemy.championName,
    reason: `${bestEnemy.scores.kills}/${bestEnemy.scores.deaths}/${bestEnemy.scores.assists} · ${bestEnemy.scores.creepScore} CS · Lvl ${bestEnemy.level}${itemText}`,
    kills: bestEnemy.scores.kills,
    cs: bestEnemy.scores.creepScore,
    level: bestEnemy.level,
  };
}

export function computeTeamDamageProfile(
  state: ParsedGameState,
  enemyBuildOverrides: Record<string, "ad" | "ap" | "tank"> = {},
) {
  if (state.enemies.length === 0) {
    return { adPercent: 50, apPercent: 50, heavyHealing: false, armorStacking: false, mrStacking: false };
  }

  const normalizedOverrides = new Map<string, "ad" | "ap" | "tank">();
  for (const [k, v] of Object.entries(enemyBuildOverrides)) {
    normalizedOverrides.set(normalizeChamp(k), v);
  }

  let adWeight = 0;
  let apWeight = 0;
  let healers = 0;
  let armorBuilders = 0;
  let mrBuilders = 0;

  for (const enemy of state.enemies) {
    const tags = ddragon.getChampionTags(enemy.championName);
    const threatMult = 1 + enemy.scores.kills * 0.15;
    const override = normalizedOverrides.get(normalizeChamp(enemy.championName));

    let champAd = 0;
    let champAp = 0;
    if (tags.includes("Mage")) champAp += 2;
    if (tags.includes("Marksman") || tags.includes("Fighter")) champAd += 2;
    if (tags.includes("Assassin")) {
      champAd += 1;
      champAp += 1;
    }
    if (champAd === 0 && champAp === 0) {
      champAd = 1;
      champAp = 1;
    }

    let itemAd = 0;
    let itemAp = 0;
    let hasArmor = false;
    let hasMr = false;
    let hasHealItem = false;

    for (const item of enemy.items) {
      const count = Math.max(1, item.count);
      const ddStats = ddragon.getItemInfo(item.itemID)?.numericStats;
      const fbStats = FALLBACK_ITEM_DAMAGE_STATS[item.itemID];

      itemAd += (ddStats?.ad ?? fbStats?.ad ?? 0) * count;
      itemAp += (ddStats?.ap ?? fbStats?.ap ?? 0) * count;

      if (ARMOR_ITEM_IDS.has(item.itemID) || (ddStats?.armor ?? 0) >= 25) hasArmor = true;
      if (MR_ITEM_IDS.has(item.itemID) || (ddStats?.mr ?? 0) >= 25) hasMr = true;
      if (HEALING_ITEM_IDS.has(item.itemID)) hasHealItem = true;
    }

    if (override === "ap") {
      champAd = 0.2;
      champAp = 4.5 + itemAp / 35;
    } else if (override === "ad") {
      champAp = 0.2;
      champAd = 4.5 + itemAd / 22;
    } else if (override === "tank") {
      hasArmor = true;
      hasMr = true;
    } else if (itemAp >= 60 && itemAd === 0) {
      champAd *= 0.25;
      champAp = Math.max(champAp, 2) + itemAp / 35;
    } else if (itemAd >= 40 && itemAp === 0) {
      champAp *= 0.25;
      champAd = Math.max(champAd, 2) + itemAd / 22;
    } else {
      champAd += itemAd / 25;
      champAp += itemAp / 40;
    }

    adWeight += champAd * threatMult;
    apWeight += champAp * threatMult;

    if (HEALING_CHAMPIONS.has(enemy.championName) || hasHealItem) healers++;
    if (hasArmor) armorBuilders++;
    if (hasMr) mrBuilders++;
  }

  const total = Math.max(1, adWeight + apWeight);
  const adPercent = Math.round((adWeight / total) * 100);
  const apPercent = 100 - adPercent;

  return {
    adPercent,
    apPercent,
    heavyHealing: healers >= 2,
    armorStacking: armorBuilders >= 2,
    mrStacking: mrBuilders >= 2,
  };
}
