import type { ChampionAbilities } from "./ddragonService.js";

export interface ComponentRecipe {
  id: number;
  name: string;
  price: number;
}

export type SkillSlot = "Q" | "W" | "E";

export interface ChampionTacticalMeta {
  maxOrder: [SkillSlot, SkillSlot, SkillSlot];
  keyThreatSpell: SkillSlot;
  escapeSpell: SkillSlot;
}

/**
 * Curated fallback component & recipe database so deterministic gold math works
 * instantaneously even before DDragon network fetch completes or in offline tests.
 */
export const COMPONENT_CATALOG: Record<number, ComponentRecipe> = {
  1001: { id: 1001, name: "Boots", price: 300 },
  1018: { id: 1018, name: "Cloak of Agility", price: 600 },
  1026: { id: 1026, name: "Blasting Wand", price: 850 },
  1027: { id: 1027, name: "Sapphire Crystal", price: 300 },
  1028: { id: 1028, name: "Ruby Crystal", price: 400 },
  1029: { id: 1029, name: "Cloth Armor", price: 300 },
  1031: { id: 1031, name: "Chain Vest", price: 800 },
  1033: { id: 1033, name: "Null-Magic Mantle", price: 400 },
  1036: { id: 1036, name: "Long Sword", price: 350 },
  1037: { id: 1037, name: "Pickaxe", price: 875 },
  1038: { id: 1038, name: "B.F. Sword", price: 1300 },
  1042: { id: 1042, name: "Dagger", price: 250 },
  1052: { id: 1052, name: "Amplifying Tome", price: 400 },
  1057: { id: 1057, name: "Negatron Cloak", price: 850 },
  1058: { id: 1058, name: "Needlessly Large Rod", price: 1200 },
  2022: { id: 2022, name: "Glowing Mote", price: 250 },
  2508: { id: 2508, name: "Fated Ashes", price: 900 },
  3044: { id: 3044, name: "Phage", price: 1100 },
  3051: { id: 3051, name: "Hearthbound Axe", price: 1200 },
  3057: { id: 3057, name: "Sheen", price: 900 },
  3076: { id: 3076, name: "Bramble Vest", price: 800 },
  3077: { id: 3077, name: "Tiamat", price: 1200 },
  3082: { id: 3082, name: "Warden's Mail", price: 1000 },
  3123: { id: 3123, name: "Executioner's Calling", price: 800 },
  3133: { id: 3133, name: "Caulfield's Warhammer", price: 1050 },
  3134: { id: 3134, name: "Serrated Dirk", price: 1000 },
  3140: { id: 3140, name: "Quicksilver Sash", price: 1300 },
  3145: { id: 3145, name: "Hextech Alternator", price: 1100 },
  3211: { id: 3211, name: "Spectre's Cowl", price: 1250 },
  3802: { id: 3802, name: "Lost Chapter", price: 1200 },
  3916: { id: 3916, name: "Oblivion Orb", price: 800 },
  6670: { id: 6670, name: "Noonquiver", price: 1300 },
};

/**
 * Multi-tier recipe catalog (Tier-3 -> Tier-2 -> Tier-1) for recursive gold math.
 */
export const FALLBACK_ITEM_RECIPES: Record<number, { totalGold: number; from: number[] }> = {
  // Tier-2 intermediate components
  1031: { totalGold: 800, from: [1029] }, // Chain Vest
  1057: { totalGold: 850, from: [1033] }, // Negatron Cloak
  2508: { totalGold: 900, from: [1052] }, // Fated Ashes
  3044: { totalGold: 1100, from: [1028, 1036] }, // Phage (Ruby Crystal + Long Sword)
  3051: { totalGold: 1200, from: [1036, 1042, 1036] }, // Hearthbound Axe
  3057: { totalGold: 900, from: [2022] }, // Sheen
  3076: { totalGold: 800, from: [1029, 1029] }, // Bramble Vest
  3077: { totalGold: 1200, from: [1036, 1036] }, // Tiamat
  3082: { totalGold: 1000, from: [1029, 1029] }, // Warden's Mail
  3123: { totalGold: 800, from: [1036] }, // Executioner's Calling
  3133: { totalGold: 1050, from: [1036, 2022, 1036] }, // Caulfield's Warhammer
  3134: { totalGold: 1000, from: [1036, 1036] }, // Serrated Dirk
  3140: { totalGold: 1300, from: [1033] }, // Quicksilver Sash
  3145: { totalGold: 1100, from: [1052, 1052] }, // Hextech Alternator
  3211: { totalGold: 1250, from: [1028, 1033] }, // Spectre's Cowl
  3802: { totalGold: 1200, from: [1052, 1027, 2022] }, // Lost Chapter
  3916: { totalGold: 800, from: [1052] }, // Oblivion Orb
  6670: { totalGold: 1300, from: [1036, 1018] }, // Noonquiver
  // Tier-3 completed items
  3031: { totalGold: 3400, from: [1038, 1037, 1018] }, // Infinity Edge
  3033: { totalGold: 3200, from: [3123, 1037, 1018] }, // Mortal Reminder
  3036: { totalGold: 3000, from: [1037, 6670] }, // Lord Dominik's Regards
  3047: { totalGold: 1200, from: [1001, 1029] }, // Plated Steelcaps
  3053: { totalGold: 3200, from: [1037, 3044, 1028] }, // Sterak's Gage
  3068: { totalGold: 2700, from: [1028, 1031] }, // Sunfire Aegis
  3071: { totalGold: 3000, from: [3044, 3133, 1028] }, // Black Cleaver
  3075: { totalGold: 2450, from: [3076, 1031, 1028] }, // Thornmail
  3078: { totalGold: 3333, from: [3057, 3044, 3051] }, // Trinity Force
  3089: { totalGold: 3600, from: [1058, 1058] }, // Rabadon's Deathcap
  3102: { totalGold: 3000, from: [1058, 1057] }, // Banshee's Veil
  3111: { totalGold: 1300, from: [1001, 1033] }, // Mercury's Treads
  3135: { totalGold: 3000, from: [1026, 1052] }, // Void Staff
  3139: { totalGold: 3200, from: [3140, 1037] }, // Mercurial Scimitar
  3142: { totalGold: 2800, from: [3134, 1036] }, // Youmuu's Ghostblade
  3143: { totalGold: 2700, from: [3082, 1028] }, // Randuin's Omen
  3156: { totalGold: 3100, from: [3133, 1033] }, // Maw of Malmortius
  3157: { totalGold: 3250, from: [1058, 1031] }, // Zhonya's Hourglass
  3165: { totalGold: 2200, from: [3916, 1026] }, // Morellonomicon
  3190: { totalGold: 2200, from: [1028, 1029, 1033] }, // Locket of the Iron Solari
  2504: { totalGold: 2900, from: [3211, 1057] }, // Kaenic Rookern
  4401: { totalGold: 2800, from: [1057, 1028] }, // Force of Nature
  6653: { totalGold: 3000, from: [2508, 1026] }, // Liandry's Torment
  6672: { totalGold: 3100, from: [3051, 1036] }, // Kraken Slayer
  6675: { totalGold: 3200, from: [3145, 1058] }, // Shadowflame
};

export const HEALING_CHAMPIONS = new Set([
  "Aatrox", "Briar", "Dr. Mundo", "Fiora", "Illaoi", "Maokai", "Olaf",
  "Red Kayn", "Kayn", "Soraka", "Swain", "Sylas", "Trundle", "Vladimir",
  "Volibear", "Warwick", "Yuumi", "Zac", "Warwick", "Nasus", "Darius",
]);

export const HEALING_ITEM_IDS = new Set([3072, 3153, 3065, 3074, 6692, 2502, 6610, 6617, 3107]);
export const GRIEVOUS_WOUNDS_ITEM_IDS = new Set([3123, 3916, 3076, 3033, 3165, 3075, 6609]);
export const ARMOR_ITEM_IDS = new Set([3047, 3075, 3143, 3110, 3068, 3157, 6333, 3742, 3076, 3082, 1031]);
export const MR_ITEM_IDS = new Set([3111, 2504, 4401, 3065, 3156, 3091, 3102, 3211, 1057]);

export const ITEM_ABILITY_HASTE: Record<number, number> = {
  2022: 5,  // Glowing Mote
  3071: 20, // Black Cleaver
  3078: 15, // Trinity Force
  3133: 10, // Warhammer
  3156: 15, // Maw
  3165: 15, // Morello
  3802: 10, // Lost Chapter
  6610: 15, // Sundered Sky
  6333: 15, // Death's Dance
  3110: 20, // Frozen Heart
  3065: 10, // Spirit Visage
  3158: 15, // Ionian Boots
  3161: 20, // Spear of Shojin
  4629: 25, // Cosmic Drive
  6655: 20, // Luden's Companion
  6653: 15, // Liandry's
  3003: 25, // Archangel's Staff
  6692: 15, // Eclipse
  6694: 15, // Serylda's Grudge
  3190: 10, // Locket
  6617: 20, // Moonstone
  3107: 15, // Redemption
};

/**
 * Fallback AD / AP item values when running offline without DDragon item cache.
 */
export const FALLBACK_ITEM_DAMAGE_STATS: Record<number, { ad?: number; ap?: number }> = {
  1036: { ad: 10 }, 1037: { ad: 25 }, 1038: { ad: 40 }, 3031: { ad: 80 },
  3033: { ad: 35 }, 3036: { ad: 35 }, 3053: { ad: 50 }, 3071: { ad: 40 },
  3072: { ad: 80 }, 3078: { ad: 36 }, 3133: { ad: 25 }, 3134: { ad: 20 },
  3153: { ad: 40 }, 3156: { ad: 60 }, 6333: { ad: 60 }, 6610: { ad: 45 },
  6672: { ad: 50 }, 6692: { ad: 60 },
  1026: { ap: 45 }, 1052: { ap: 20 }, 1058: { ap: 65 }, 3089: { ap: 130 },
  3102: { ap: 105 }, 3115: { ap: 80 }, 3135: { ap: 95 }, 3145: { ap: 45 },
  3157: { ap: 105 }, 3165: { ap: 75 }, 3802: { ap: 40 }, 4629: { ap: 70 },
  6653: { ap: 70 }, 6655: { ap: 85 }, 6675: { ap: 110 },
};

/**
 * Curated champion-specific skill-maxing order, primary opponent threat spell,
 * and local player defensive/mobility spell.
 */
export const CHAMPION_TACTICAL_META: Record<string, ChampionTacticalMeta> = {
  Ahri: { maxOrder: ["Q", "W", "E"], keyThreatSpell: "E", escapeSpell: "W" },
  Aatrox: { maxOrder: ["Q", "E", "W"], keyThreatSpell: "E", escapeSpell: "E" },
  Akali: { maxOrder: ["Q", "E", "W"], keyThreatSpell: "E", escapeSpell: "W" },
  Anivia: { maxOrder: ["E", "Q", "W"], keyThreatSpell: "Q", escapeSpell: "W" },
  Ashe: { maxOrder: ["W", "Q", "E"], keyThreatSpell: "W", escapeSpell: "E" },
  AurelionSol: { maxOrder: ["Q", "W", "E"], keyThreatSpell: "E", escapeSpell: "W" },
  Blitzcrank: { maxOrder: ["Q", "E", "W"], keyThreatSpell: "Q", escapeSpell: "W" },
  Caitlyn: { maxOrder: ["Q", "W", "E"], keyThreatSpell: "E", escapeSpell: "E" },
  Camille: { maxOrder: ["Q", "E", "W"], keyThreatSpell: "E", escapeSpell: "E" },
  Cassiopeia: { maxOrder: ["E", "Q", "W"], keyThreatSpell: "W", escapeSpell: "W" },
  Darius: { maxOrder: ["Q", "E", "W"], keyThreatSpell: "E", escapeSpell: "E" },
  Diana: { maxOrder: ["Q", "W", "E"], keyThreatSpell: "E", escapeSpell: "W" },
  Ekko: { maxOrder: ["Q", "E", "W"], keyThreatSpell: "E", escapeSpell: "E" },
  Ezreal: { maxOrder: ["Q", "E", "W"], keyThreatSpell: "E", escapeSpell: "E" },
  Fiora: { maxOrder: ["Q", "E", "W"], keyThreatSpell: "W", escapeSpell: "W" },
  Fizz: { maxOrder: ["E", "W", "Q"], keyThreatSpell: "E", escapeSpell: "E" },
  Garen: { maxOrder: ["E", "Q", "W"], keyThreatSpell: "Q", escapeSpell: "W" },
  Gwen: { maxOrder: ["Q", "E", "W"], keyThreatSpell: "W", escapeSpell: "E" },
  Hwei: { maxOrder: ["Q", "E", "W"], keyThreatSpell: "E", escapeSpell: "W" },
  Irelia: { maxOrder: ["Q", "E", "W"], keyThreatSpell: "E", escapeSpell: "W" },
  Jax: { maxOrder: ["W", "Q", "E"], keyThreatSpell: "E", escapeSpell: "E" },
  Jinx: { maxOrder: ["Q", "W", "E"], keyThreatSpell: "E", escapeSpell: "E" },
  "Kai'Sa": { maxOrder: ["Q", "E", "W"], keyThreatSpell: "W", escapeSpell: "E" },
  Katarina: { maxOrder: ["Q", "E", "W"], keyThreatSpell: "E", escapeSpell: "E" },
  Kayle: { maxOrder: ["E", "Q", "W"], keyThreatSpell: "Q", escapeSpell: "W" },
  LeBlanc: { maxOrder: ["W", "Q", "E"], keyThreatSpell: "W", escapeSpell: "W" },
  "Lee Sin": { maxOrder: ["Q", "W", "E"], keyThreatSpell: "Q", escapeSpell: "W" },
  Leona: { maxOrder: ["W", "E", "Q"], keyThreatSpell: "E", escapeSpell: "W" },
  Lucian: { maxOrder: ["Q", "E", "W"], keyThreatSpell: "E", escapeSpell: "E" },
  Lux: { maxOrder: ["E", "Q", "W"], keyThreatSpell: "Q", escapeSpell: "W" },
  Malphite: { maxOrder: ["Q", "E", "W"], keyThreatSpell: "Q", escapeSpell: "Q" },
  Mordekaiser: { maxOrder: ["Q", "E", "W"], keyThreatSpell: "E", escapeSpell: "W" },
  Morgana: { maxOrder: ["W", "Q", "E"], keyThreatSpell: "Q", escapeSpell: "E" },
  Nautilus: { maxOrder: ["Q", "W", "E"], keyThreatSpell: "Q", escapeSpell: "W" },
  Orianna: { maxOrder: ["Q", "W", "E"], keyThreatSpell: "W", escapeSpell: "E" },
  Ornn: { maxOrder: ["W", "Q", "E"], keyThreatSpell: "E", escapeSpell: "E" },
  Pyke: { maxOrder: ["Q", "E", "W"], keyThreatSpell: "Q", escapeSpell: "E" },
  Renekton: { maxOrder: ["Q", "E", "W"], keyThreatSpell: "E", escapeSpell: "E" },
  Riven: { maxOrder: ["Q", "E", "W"], keyThreatSpell: "W", escapeSpell: "E" },
  Sett: { maxOrder: ["Q", "W", "E"], keyThreatSpell: "W", escapeSpell: "W" },
  Shen: { maxOrder: ["Q", "E", "W"], keyThreatSpell: "E", escapeSpell: "W" },
  Sylas: { maxOrder: ["W", "E", "Q"], keyThreatSpell: "E", escapeSpell: "E" },
  Syndra: { maxOrder: ["Q", "W", "E"], keyThreatSpell: "E", escapeSpell: "E" },
  Thresh: { maxOrder: ["Q", "E", "W"], keyThreatSpell: "Q", escapeSpell: "W" },
  Tristana: { maxOrder: ["E", "Q", "W"], keyThreatSpell: "W", escapeSpell: "W" },
  Vayne: { maxOrder: ["Q", "W", "E"], keyThreatSpell: "E", escapeSpell: "Q" },
  Veigar: { maxOrder: ["Q", "W", "E"], keyThreatSpell: "E", escapeSpell: "E" },
  Viktor: { maxOrder: ["E", "Q", "W"], keyThreatSpell: "W", escapeSpell: "W" },
  Vladimir: { maxOrder: ["Q", "E", "W"], keyThreatSpell: "W", escapeSpell: "W" },
  Yasuo: { maxOrder: ["Q", "E", "W"], keyThreatSpell: "W", escapeSpell: "W" },
  Yone: { maxOrder: ["Q", "E", "W"], keyThreatSpell: "E", escapeSpell: "E" },
  Zed: { maxOrder: ["Q", "E", "W"], keyThreatSpell: "W", escapeSpell: "W" },
};

export function getChampionTacticalMeta(
  championName: string,
  abilities?: ChampionAbilities,
): ChampionTacticalMeta {
  const curated = CHAMPION_TACTICAL_META[championName];
  if (curated) return curated;

  const wBase = abilities?.wCooldown?.[0] ?? 14;
  const eBase = abilities?.eCooldown?.[0] ?? 14;
  const highCdSlot: SkillSlot = eBase > wBase ? "E" : "W";

  return {
    maxOrder: ["Q", "W", "E"],
    keyThreatSpell: highCdSlot,
    escapeSpell: highCdSlot,
  };
}

const SUMMONER_BASE_COOLDOWNS: Array<[string, number]> = [
  ["flash", 300],
  ["teleport", 360],
  ["ignite", 180],
  ["exhaust", 210],
  ["ghost", 240],
  ["heal", 240],
  ["cleanse", 240],
  ["barrier", 180],
  ["smite", 90],
];

export function computeSummonerSpellCooldown(
  displayName: string,
  level: number,
  gameTimeSec: number,
  summonerHaste: number,
): { name: string; cooldown: number } | undefined {
  const lower = displayName.trim().toLowerCase();
  if (!lower) return undefined;

  let canonicalName = displayName.trim();
  let baseCd = 240;

  if (lower.includes("teleport")) {
    canonicalName = gameTimeSec >= 600 ? "Unleashed TP" : "Teleport";
    const lvlFactor = (Math.max(1, Math.min(18, level)) - 1) / 17;
    baseCd = gameTimeSec >= 600
      ? Math.round(330 - lvlFactor * 90)
      : Math.round(360 - lvlFactor * 120);
  } else {
    const match = SUMMONER_BASE_COOLDOWNS.find(([key]) => lower.includes(key));
    if (!match) return undefined;
    canonicalName = match[0].charAt(0).toUpperCase() + match[0].slice(1);
    baseCd = match[1];
  }

  const cooldown = Math.max(15, Math.round(baseCd * (100 / (100 + summonerHaste))));
  return { name: canonicalName, cooldown };
}

/**
 * Passive/stat-stick substitutes for active items when `preferPassiveItems` is enabled.
 */
export const PASSIVE_ITEM_ALTERNATIVES: Record<number, { id: number; name: string; reason: string }> = {
  3157: { id: 3102, name: "Banshee's Veil", reason: "Passive spell-shield instead of Zhonya's active" },
  3143: { id: 3110, name: "Frozen Heart", reason: "Passive attack-speed aura instead of Randuin's active" },
  3140: { id: 3111, name: "Mercury's Treads", reason: "Passive Tenacity instead of QSS active" },
  3139: { id: 3053, name: "Sterak's Gage", reason: "Auto-shield + Tenacity instead of Scimitar active" },
  3190: { id: 3109, name: "Knight's Vow", reason: "Passive damage redirect instead of Locket active" },
};
