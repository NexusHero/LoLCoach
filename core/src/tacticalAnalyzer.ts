import type {
  ParsedGameState,
  Player,
  RecommendedItem,
  NextBestBuy,
  EnemyCooldowns,
  RolePosition,
} from "./types.js";
import { ddragon } from "./ddragonService.js";
import {
  type ComponentRecipe,
  COMPONENT_CATALOG,
  FALLBACK_ITEM_RECIPES,
  HEALING_CHAMPIONS,
  HEALING_ITEM_IDS,
  ARMOR_ITEM_IDS,
  MR_ITEM_IDS,
  ITEM_ABILITY_HASTE,
  PASSIVE_ITEM_ALTERNATIVES,
} from "./tacticalCatalog.js";

export { PASSIVE_ITEM_ALTERNATIVES };

export function findLaneOpponent(state: ParsedGameState, myPos: RolePosition): Player | undefined {
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

export function computeTeamDamageProfile(state: ParsedGameState) {
  if (state.enemies.length === 0) {
    return { adPercent: 50, apPercent: 50, heavyHealing: false, armorStacking: false, mrStacking: false };
  }

  let adWeight = 0;
  let apWeight = 0;
  let healers = 0;
  let armorBuilders = 0;
  let mrBuilders = 0;

  for (const enemy of state.enemies) {
    const tags = ddragon.getChampionTags(enemy.championName);
    const threatMult = 1 + enemy.scores.kills * 0.15;

    if (tags.includes("Mage")) apWeight += 2 * threatMult;
    if (tags.includes("Marksman") || tags.includes("Fighter")) adWeight += 2 * threatMult;
    if (tags.includes("Assassin")) {
      adWeight += 1 * threatMult;
      apWeight += 1 * threatMult;
    }
    if (adWeight === 0 && apWeight === 0) {
      adWeight += 1;
      apWeight += 1;
    }

    if (HEALING_CHAMPIONS.has(enemy.championName)) healers++;

    let hasArmor = false;
    let hasMr = false;
    let hasHealItem = false;

    for (const item of enemy.items) {
      if (ARMOR_ITEM_IDS.has(item.itemID)) hasArmor = true;
      if (MR_ITEM_IDS.has(item.itemID)) hasMr = true;
      if (HEALING_ITEM_IDS.has(item.itemID)) hasHealItem = true;
    }
    if (hasArmor) armorBuilders++;
    if (hasMr) mrBuilders++;
    if (hasHealItem) healers++;
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

/**
 * Smart Single-Best-Buy + Breakpoint-Hint calculator.
 */
export function computeNextBestBuy(
  state: ParsedGameState,
  recommendedItems: RecommendedItem[] = [],
): NextBestBuy | undefined {
  const gold = Math.floor(state.activePlayer.currentGold);
  const ownedIds = new Set(state.localPlayer.items.map((i) => i.itemID));
  const usedSlots = state.localPlayer.items.filter((i) => i.slot >= 0 && i.slot < 6).length;
  const openSlots = Math.max(0, 6 - usedSlots);

  const candidates: RecommendedItem[] =
    recommendedItems.length > 0
      ? recommendedItems.filter((i) => !ownedIds.has(i.id))
      : getDefaultTargetItems(state).filter((i) => !ownedIds.has(i.id));

  const target = candidates[0];
  if (!target) return undefined;

  const ddragonTarget = ddragon.getItemInfo(target.id);
  const fallbackTarget = FALLBACK_ITEM_RECIPES[target.id];
  const totalTargetGold = ddragonTarget?.totalGold ?? fallbackTarget?.totalGold ?? 3000;
  const fromIds = ddragonTarget?.from ?? fallbackTarget?.from ?? [1036, 1028];

  let ownedComponentValue = 0;
  const remainingComponents: ComponentRecipe[] = [];

  for (const compId of fromIds) {
    const compInfo = ddragon.getItemInfo(compId);
    const fallbackComp = COMPONENT_CATALOG[compId];
    const compPrice = compInfo?.totalGold ?? fallbackComp?.price ?? 800;
    const compName = compInfo?.name ?? fallbackComp?.name ?? `Item #${compId}`;

    if (ownedIds.has(compId)) {
      ownedComponentValue += compPrice;
    } else {
      remainingComponents.push({ id: compId, name: compName, price: compPrice });
    }
  }

  remainingComponents.sort((a, b) => b.price - a.price);
  const completionCost = Math.max(300, totalTargetGold - ownedComponentValue);

  if (gold >= completionCost) {
    return {
      itemId: target.id,
      itemName: target.name,
      price: completionCost,
      targetItemId: target.id,
      targetItemName: target.name,
    };
  }

  // Check if player is <250g away from completing the full item
  if (completionCost - gold <= 250) {
    const diff = completionCost - gold;
    const waves = Math.max(1, Math.ceil(diff / 125));
    const affordableNow = openSlots > 0 ? remainingComponents.find((c) => c.price <= gold) : undefined;
    if (affordableNow) {
      return {
        itemId: affordableNow.id,
        itemName: affordableNow.name,
        price: affordableNow.price,
        targetItemId: target.id,
        targetItemName: target.name,
        breakpointHint: `or +${diff}g (${waves} wave${waves > 1 ? "s" : ""}) for full ${target.name}`,
      };
    }
    return {
      itemId: target.id,
      itemName: `Hold for ${target.name}`,
      price: completionCost,
      targetItemId: target.id,
      targetItemName: target.name,
      breakpointHint: `+${diff}g (${waves} wave${waves > 1 ? "s" : ""}) to complete`,
    };
  }

  if (openSlots === 0) return undefined;

  const affordable = remainingComponents.filter((c) => c.price <= gold);
  const strongerUnachaivable = [...remainingComponents]
    .reverse()
    .find((c) => c.price > gold && c.price - gold <= 250);

  if (affordable.length > 0) {
    const bestNow = affordable[0];
    let breakpointHint: string | undefined;
    if (strongerUnachaivable) {
      const diff = strongerUnachaivable.price - gold;
      const waves = Math.max(1, Math.ceil(diff / 125));
      breakpointHint = `or +${diff}g (${waves} wave${waves > 1 ? "s" : ""}) for ${strongerUnachaivable.name}`;
    }
    return {
      itemId: bestNow.id,
      itemName: bestNow.name,
      price: bestNow.price,
      targetItemId: target.id,
      targetItemName: target.name,
      ...(breakpointHint ? { breakpointHint } : {}),
    };
  }

  // Nothing in direct recipe affordable yet: check if within 250g of cheapest component
  const cheapest = remainingComponents[remainingComponents.length - 1];
  if (cheapest && cheapest.price - gold <= 250 && cheapest.price > gold) {
    const diff = cheapest.price - gold;
    const waves = Math.max(1, Math.ceil(diff / 125));
    return {
      itemId: cheapest.id,
      itemName: `Hold for ${cheapest.name}`,
      price: cheapest.price,
      targetItemId: target.id,
      targetItemName: target.name,
      breakpointHint: `+${diff}g (${waves} wave${waves > 1 ? "s" : ""}) needed`,
    };
  }

  return undefined;
}

function getDefaultTargetItems(state: ParsedGameState): RecommendedItem[] {
  const stats = state.activePlayer.championStats;
  if (stats.abilityPower > stats.attackDamage) {
    return [{ id: 3157, name: "Zhonya's Hourglass", reason: "Core AP survival", priority: "core" }];
  }
  return [{ id: 3078, name: "Trinity Force", reason: "Core AD spike", priority: "core" }];
}

/**
 * Computes opponent Q/W/E/R cooldowns based on level skill-maxing curve & Ability Haste,
 * plus 1-line Key-Threat-Diff summary.
 */
export async function computeEnemyCooldowns(
  state: ParsedGameState,
): Promise<EnemyCooldowns | undefined> {
  const myPos = (state.localPlayer.position || "UNKNOWN") as RolePosition;
  const opp = findLaneOpponent(state, myPos);
  if (!opp) return undefined;

  const oppAbilities = await ddragon.getChampionAbilities(opp.championName);
  const myAbilities = await ddragon.getChampionAbilities(state.localPlayer.championName);

  const oppAh = opp.items.reduce((sum, i) => sum + (ITEM_ABILITY_HASTE[i.itemID] ?? 0), 0);
  const lvl = Math.max(1, Math.min(18, opp.level));

  // Standard skill-maxing curve: Q maxed first, W second, E third, R at 6/11/16
  const qRank = Math.min(5, Math.ceil(lvl / 2));
  const wRank = lvl >= 4 ? Math.min(5, Math.max(1, lvl - 7)) : 1;
  const eRank = lvl >= 3 ? Math.min(5, Math.max(1, lvl - 12)) : 1;
  const rRank = lvl >= 16 ? 3 : lvl >= 11 ? 2 : lvl >= 6 ? 1 : 1;

  const pickCd = (arr: number[] | undefined, rank: number, fallback: number): number => {
    const base = arr && arr.length > 0 ? (arr[Math.min(arr.length - 1, rank - 1)] ?? fallback) : fallback;
    return Math.max(1, Math.round(base * (100 / (100 + oppAh))));
  };

  const q = pickCd(oppAbilities?.qCooldown, qRank, 7);
  const w = pickCd(oppAbilities?.wCooldown, wRank, 13);
  const e = pickCd(oppAbilities?.eCooldown, eRank, 15);
  const r = pickCd(oppAbilities?.rCooldown, rRank, 100);

  // Compare with local player's defensive/mobility W cooldown
  const myAh = state.activePlayer.championStats.abilityHaste ?? 0;
  const myWLevel = state.activePlayer.abilities?.W?.abilityLevel || 1;
  const myWBase = myAbilities?.wCooldown?.[Math.max(0, myWLevel - 1)] ?? 16;
  const myW = Math.max(1, Math.round(myWBase * (100 / (100 + myAh))));

  const keySkill = w <= e ? "W" : "E";
  const keyCd = w <= e ? w : e;
  const keyThreatSummary =
    myW > keyCd
      ? `His ${keySkill} (${keyCd}s) vs your W (${myW}s) -> ${myW - keyCd}s vulnerable!`
      : `Punish ${opp.championName} ${keySkill} (${keyCd}s CD) after cast!`;

  return {
    championName: opp.championName,
    level: opp.level,
    abilityHaste: oppAh,
    q,
    w,
    e,
    r,
    keyThreatSummary,
  };
}
