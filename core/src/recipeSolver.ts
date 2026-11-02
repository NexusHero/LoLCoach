import type {
  ParsedGameState,
  RecommendedItem,
  NextBestBuy,
} from "./types.js";
import { ddragon } from "./ddragonService.js";
import {
  type ComponentRecipe,
  COMPONENT_CATALOG,
  FALLBACK_ITEM_RECIPES,
  GRIEVOUS_WOUNDS_ITEM_IDS,
} from "./tacticalCatalog.js";

const FULL_GW_TO_COMPONENT: Record<number, ComponentRecipe> = {
  3033: COMPONENT_CATALOG[3123], // Mortal Reminder -> Executioner's Calling (800g)
  3165: COMPONENT_CATALOG[3916], // Morellonomicon -> Oblivion Orb (800g)
  3075: COMPONENT_CATALOG[3076], // Thornmail -> Bramble Vest (800g)
};

function getItemMeta(itemId: number): { name: string; totalGold: number; from: number[] } {
  const dd = ddragon.getItemInfo(itemId);
  const fb = FALLBACK_ITEM_RECIPES[itemId];
  const comp = COMPONENT_CATALOG[itemId];
  return {
    name: dd?.name ?? comp?.name ?? `Item #${itemId}`,
    totalGold: dd?.totalGold ?? fb?.totalGold ?? comp?.price ?? 800,
    from: dd?.from ?? fb?.from ?? [],
  };
}

function resolveRecipeNode(
  itemId: number,
  ownedPool: Map<number, number>,
  isRoot = false,
): {
  totalGold: number;
  ownedDiscount: number;
  remainingCost: number;
  directMissing: ComponentRecipe[];
  leafMissing: ComponentRecipe[];
} {
  const meta = getItemMeta(itemId);
  const ownedCount = ownedPool.get(itemId) ?? 0;

  if (!isRoot && ownedCount > 0) {
    ownedPool.set(itemId, ownedCount - 1);
    return {
      totalGold: meta.totalGold,
      ownedDiscount: meta.totalGold,
      remainingCost: 0,
      directMissing: [],
      leafMissing: [],
    };
  }

  if (meta.from.length === 0) {
    const leaf: ComponentRecipe = { id: itemId, name: meta.name, price: meta.totalGold };
    return {
      totalGold: meta.totalGold,
      ownedDiscount: 0,
      remainingCost: meta.totalGold,
      directMissing: isRoot ? [] : [leaf],
      leafMissing: isRoot ? [] : [leaf],
    };
  }

  let ownedDiscount = 0;
  const directMissing: ComponentRecipe[] = [];
  const leafMissing: ComponentRecipe[] = [];

  for (const childId of meta.from) {
    const childRes = resolveRecipeNode(childId, ownedPool, false);
    ownedDiscount += childRes.ownedDiscount;
    if (childRes.remainingCost > 0) {
      const childMeta = getItemMeta(childId);
      directMissing.push({
        id: childId,
        name: childMeta.name,
        price: childRes.remainingCost,
      });
      leafMissing.push(...childRes.leafMissing);
    }
  }

  const remainingCost = Math.max(0, meta.totalGold - ownedDiscount);
  return {
    totalGold: meta.totalGold,
    ownedDiscount,
    remainingCost,
    directMissing,
    leafMissing,
  };
}

export function getDefaultTargetItems(state: ParsedGameState, preferPassive = false): RecommendedItem[] {
  const pos = (state.localPlayer.position || "").toUpperCase();
  const tags = ddragon.getChampionTags(state.localPlayer.championName);
  const stats = state.activePlayer.championStats;

  if (pos === "UTILITY" || (tags.includes("Support") && !tags.includes("Mage"))) {
    return [{ id: 3190, name: "Locket of the Iron Solari", reason: "Core support teamfight shield", priority: "core" }];
  }
  if (tags.includes("Tank") && !tags.includes("Fighter")) {
    return [{ id: 3068, name: "Sunfire Aegis", reason: "Core tank waveclear & armor spike", priority: "core" }];
  }
  if (tags.includes("Marksman") || (pos === "BOTTOM" && stats.attackDamage >= stats.abilityPower)) {
    return [{ id: 6672, name: "Kraken Slayer", reason: "Core ADC sustained DPS spike", priority: "core" }];
  }
  if (stats.abilityPower > stats.attackDamage || tags.includes("Mage")) {
    if (preferPassive) {
      return [{ id: 3102, name: "Banshee's Veil", reason: "Passive AP spell-shield", priority: "core" }];
    }
    return [{ id: 3157, name: "Zhonya's Hourglass", reason: "Core AP survival", priority: "core" }];
  }
  if (tags.includes("Assassin")) {
    return [{ id: 3142, name: "Youmuu's Ghostblade", reason: "Core lethality roam & burst spike", priority: "core" }];
  }
  return [{ id: 3078, name: "Trinity Force", reason: "Core AD spike", priority: "core" }];
}

/**
 * Recursive Smart Single-Best-Buy + Breakpoint-Hint calculator with Multiset Inventory
 * and Challenger 800g Anti-Heal Component-Sitting Rule.
 */
export function computeNextBestBuy(
  state: ParsedGameState,
  recommendedItems: RecommendedItem[] = [],
  preferPassiveItems = false,
): NextBestBuy | undefined {
  const gold = Math.floor(state.activePlayer.currentGold);
  const ownedIds = new Set(state.localPlayer.items.map((i) => i.itemID));
  const usedSlots = state.localPlayer.items.filter((i) => i.slot >= 0 && i.slot < 6).length;
  const openSlots = Math.max(0, 6 - usedSlots);

  const candidates: RecommendedItem[] =
    recommendedItems.length > 0
      ? recommendedItems.filter((i) => !ownedIds.has(i.id))
      : getDefaultTargetItems(state, preferPassiveItems).filter((i) => !ownedIds.has(i.id));

  // Challenger 800g Anti-Heal Component-Sitting Rule:
  // If any recommended item is a completed Grievous Wounds item (3033/3165/3075)
  // before 2 completed items, sit on the 800g component (3123/3916/3076) first!
  const completedCount = state.localPlayer.items.filter((i) => !i.consumable && i.price >= 2200).length;
  const hasAnyGw = state.localPlayer.items.some((i) => GRIEVOUS_WOUNDS_ITEM_IDS.has(i.itemID));
  const gwTarget = candidates.find((c) => FULL_GW_TO_COMPONENT[c.id] !== undefined);
  if (gwTarget && !hasAnyGw && completedCount < 2 && openSlots > 0 && gold >= 800) {
    const comp = FULL_GW_TO_COMPONENT[gwTarget.id];
    const primaryCore = candidates.find((c) => c.id !== gwTarget.id) ?? gwTarget;
    return {
      itemId: comp.id,
      itemName: comp.name,
      price: comp.price,
      targetItemId: primaryCore.id,
      targetItemName: primaryCore.name,
      breakpointHint: `Sit on 800g Anti-Heal → then finish ${primaryCore.name}`,
    };
  }

  const target = candidates[0];
  if (!target) return undefined;

  const ownedPool = new Map<number, number>();
  for (const item of state.localPlayer.items) {
    ownedPool.set(item.itemID, (ownedPool.get(item.itemID) ?? 0) + Math.max(1, item.count));
  }

  const resolved = resolveRecipeNode(target.id, ownedPool, true);
  const completionCost = Math.max(300, resolved.remainingCost);

  if (gold >= completionCost) {
    return {
      itemId: target.id,
      itemName: target.name,
      price: completionCost,
      targetItemId: target.id,
      targetItemName: target.name,
    };
  }

  const directPool = [...resolved.directMissing].sort((a, b) => b.price - a.price);
  const leafPool = [...resolved.leafMissing].sort((a, b) => b.price - a.price);
  const candidateComponents = directPool.length > 0 ? directPool : leafPool;

  // Check if player is <=250g away from completing the full item
  if (completionCost - gold <= 250) {
    const diff = completionCost - gold;
    const waves = Math.max(1, Math.ceil(diff / 125));
    const affordableNow = openSlots > 0 ? candidateComponents.find((c) => c.price <= gold) : undefined;
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

  let affordable = directPool.filter((c) => c.price <= gold);
  let referencePool = directPool;
  if (affordable.length === 0 && leafPool.length > 0) {
    affordable = leafPool.filter((c) => c.price <= gold);
    referencePool = [...directPool, ...leafPool].sort((a, b) => b.price - a.price);
  }

  const strongerWithinReach = [...referencePool]
    .reverse()
    .find((c) => c.price > gold && c.price - gold <= 250);

  if (affordable.length > 0) {
    const bestNow = affordable[0];
    let breakpointHint: string | undefined;
    if (strongerWithinReach) {
      const diff = strongerWithinReach.price - gold;
      const waves = Math.max(1, Math.ceil(diff / 125));
      breakpointHint = `or +${diff}g (${waves} wave${waves > 1 ? "s" : ""}) for ${strongerWithinReach.name}`;
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

  const cheapest = candidateComponents[candidateComponents.length - 1];
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
