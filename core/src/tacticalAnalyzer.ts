import type {
  ParsedGameState,
  Player,
  EnemyCooldowns,
  EnemySummonerCooldown,
  RolePosition,
} from "./types.js";
import { ddragon } from "./ddragonService.js";
import {
  type SkillSlot,
  FALLBACK_ITEM_DAMAGE_STATS,
  HEALING_CHAMPIONS,
  HEALING_ITEM_IDS,
  ARMOR_ITEM_IDS,
  MR_ITEM_IDS,
  ITEM_ABILITY_HASTE,
  PASSIVE_ITEM_ALTERNATIVES,
  getChampionTacticalMeta,
  computeSummonerSpellCooldown,
} from "./tacticalCatalog.js";

export { PASSIVE_ITEM_ALTERNATIVES };
export { computeNextBestBuy } from "./recipeSolver.js";

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

    // Dynamic hybrid/off-meta shift based on actual purchased items
    if (itemAp >= 60 && itemAd === 0) {
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

function computeSkillRanks(
  lvl: number,
  maxOrder: [SkillSlot, SkillSlot, SkillSlot],
): Record<SkillSlot, number> {
  const firstRank = Math.min(5, Math.ceil(lvl / 2));
  const secondRank = lvl >= 4 ? Math.min(5, Math.max(1, lvl - 7)) : 1;
  const thirdRank = lvl >= 3 ? Math.min(5, Math.max(1, lvl - 12)) : 1;
  return {
    [maxOrder[0]]: firstRank,
    [maxOrder[1]]: secondRank,
    [maxOrder[2]]: thirdRank,
  } as Record<SkillSlot, number>;
}

function computeOpponentSummonerSpells(
  opp: Player,
  gameTimeSec: number,
): EnemySummonerCooldown[] {
  let summonerHaste = 0;
  if (opp.items.some((i) => i.itemID === 3158)) summonerHaste += 10; // Ionian Boots
  const primaryTree = opp.runes?.primaryRuneTree?.displayName ?? "";
  const secondaryTree = opp.runes?.secondaryRuneTree?.displayName ?? "";
  if (primaryTree.includes("Inspiration") || secondaryTree.includes("Inspiration")) {
    summonerHaste += 18; // Cosmic Insight
  }

  const rawSpells = [
    opp.summonerSpells?.summonerSpellOne?.displayName,
    opp.summonerSpells?.summonerSpellTwo?.displayName,
  ].filter((s): s is string => !!s && s.trim().length > 0);

  const result: EnemySummonerCooldown[] = [];
  for (const name of rawSpells) {
    const parsed = computeSummonerSpellCooldown(name, opp.level, gameTimeSec, summonerHaste);
    if (parsed) result.push(parsed);
  }
  return result;
}

/**
 * Computes opponent Q/W/E/R + Summoner Spell cooldowns using champion-specific
 * skill-maxing curves, DDragon Ability Haste, and Key-Threat vs Escape spell diff.
 */
export async function computeEnemyCooldowns(
  state: ParsedGameState,
): Promise<EnemyCooldowns | undefined> {
  const myPos = (state.localPlayer.position || "UNKNOWN") as RolePosition;
  const opp = findLaneOpponent(state, myPos);
  if (!opp) return undefined;

  const oppAbilities = await ddragon.getChampionAbilities(opp.championName);
  const myAbilities = await ddragon.getChampionAbilities(state.localPlayer.championName);

  const oppMeta = getChampionTacticalMeta(opp.championName, oppAbilities);
  const myMeta = getChampionTacticalMeta(state.localPlayer.championName, myAbilities);

  const oppAh = opp.items.reduce((sum, i) => {
    const ddAh = ddragon.getItemInfo(i.itemID)?.numericStats?.abilityHaste;
    const ah = ddAh && ddAh > 0 ? ddAh : (ITEM_ABILITY_HASTE[i.itemID] ?? 0);
    return sum + ah * Math.max(1, i.count);
  }, 0);

  const lvl = Math.max(1, Math.min(18, opp.level));
  const ranks = computeSkillRanks(lvl, oppMeta.maxOrder);
  const rRank = lvl >= 16 ? 3 : lvl >= 11 ? 2 : 1;

  const pickCd = (arr: number[] | undefined, rank: number, fallback: number): number => {
    const base = arr && arr.length > 0 ? (arr[Math.min(arr.length - 1, rank - 1)] ?? fallback) : fallback;
    return Math.max(1, Math.round(base * (100 / (100 + oppAh))));
  };

  const q = pickCd(oppAbilities?.qCooldown, ranks.Q, 7);
  const w = pickCd(oppAbilities?.wCooldown, ranks.W, 13);
  const e = pickCd(oppAbilities?.eCooldown, ranks.E, 15);
  const r = pickCd(oppAbilities?.rCooldown, rRank, 100);
  const cdBySlot: Record<SkillSlot, number> = { Q: q, W: w, E: e };

  const myEscapeSlot = myMeta.escapeSpell;
  const myAh = state.activePlayer.championStats.abilityHaste ?? 0;
  const myEscapeLevel = state.activePlayer.abilities?.[myEscapeSlot]?.abilityLevel || 1;
  const myEscapeArr =
    myEscapeSlot === "Q"
      ? myAbilities?.qCooldown
      : myEscapeSlot === "E"
        ? myAbilities?.eCooldown
        : myAbilities?.wCooldown;
  const myEscapeBase = myEscapeArr?.[Math.max(0, myEscapeLevel - 1)] ?? 15;
  const myEscapeCd = Math.max(1, Math.round(myEscapeBase * (100 / (100 + myAh))));

  const keySkill = oppMeta.keyThreatSpell;
  const keyCd = cdBySlot[keySkill];
  const keyThreatSummary =
    myEscapeCd > keyCd
      ? `His ${keySkill} (${keyCd}s) vs your ${myEscapeSlot} (${myEscapeCd}s) -> ${myEscapeCd - keyCd}s vulnerable!`
      : `Punish ${opp.championName} ${keySkill} (${keyCd}s CD) after cast!`;

  const summonerSpells = computeOpponentSummonerSpells(opp, state.gameTime);

  return {
    championName: opp.championName,
    level: opp.level,
    abilityHaste: oppAh,
    q,
    w,
    e,
    r,
    keyThreatSpell: keySkill,
    ...(summonerSpells.length > 0 ? { summonerSpells } : {}),
    keyThreatSummary,
  };
}
