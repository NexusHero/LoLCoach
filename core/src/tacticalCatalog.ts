export interface ComponentRecipe {
  id: number;
  name: string;
  price: number;
}

/**
 * Curated fallback component & recipe database so deterministic gold math works
 * instantaneously even before DDragon network fetch completes or in offline tests.
 */
export const COMPONENT_CATALOG: Record<number, ComponentRecipe> = {
  1001: { id: 1001, name: "Boots", price: 300 },
  1026: { id: 1026, name: "Blasting Wand", price: 850 },
  1028: { id: 1028, name: "Ruby Crystal", price: 400 },
  1029: { id: 1029, name: "Cloth Armor", price: 300 },
  1033: { id: 1033, name: "Null-Magic Mantle", price: 400 },
  1036: { id: 1036, name: "Long Sword", price: 350 },
  1037: { id: 1037, name: "Pickaxe", price: 875 },
  1038: { id: 1038, name: "B.F. Sword", price: 1300 },
  1052: { id: 1052, name: "Amplifying Tome", price: 400 },
  1057: { id: 1057, name: "Negatron Cloak", price: 850 },
  1058: { id: 1058, name: "Needlessly Large Rod", price: 1200 },
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

export const FALLBACK_ITEM_RECIPES: Record<number, { totalGold: number; from: number[] }> = {
  3031: { totalGold: 3400, from: [1038, 1037] }, // Infinity Edge
  3033: { totalGold: 3200, from: [3123, 1037] }, // Mortal Reminder
  3036: { totalGold: 3000, from: [1037, 1036] }, // Lord Dominik's Regards
  3047: { totalGold: 1200, from: [1001, 1029] }, // Plated Steelcaps
  3053: { totalGold: 3200, from: [1037, 3044, 1028] }, // Sterak's Gage
  3068: { totalGold: 2700, from: [1028, 1029] }, // Sunfire Aegis
  3071: { totalGold: 3000, from: [3044, 3133, 1028] }, // Black Cleaver
  3075: { totalGold: 2450, from: [3076, 1029, 1028] }, // Thornmail
  3078: { totalGold: 3333, from: [3057, 3044, 3051] }, // Trinity Force
  3089: { totalGold: 3600, from: [1058, 1058] }, // Rabadon's Deathcap
  3102: { totalGold: 3000, from: [1058, 1033] }, // Banshee's Veil
  3111: { totalGold: 1300, from: [1001, 1033] }, // Mercury's Treads
  3135: { totalGold: 3000, from: [1026, 1052] }, // Void Staff
  3139: { totalGold: 3200, from: [3140, 1037] }, // Mercurial Scimitar
  3143: { totalGold: 2700, from: [3082, 1028] }, // Randuin's Omen
  3156: { totalGold: 3100, from: [3133, 1033] }, // Maw of Malmortius
  3157: { totalGold: 3250, from: [1058, 1029] }, // Zhonya's Hourglass
  3165: { totalGold: 2200, from: [3916, 1026] }, // Morellonomicon
  4401: { totalGold: 2800, from: [1057, 1028] }, // Force of Nature
  6672: { totalGold: 3100, from: [3051, 1036] }, // Kraken Slayer
  6675: { totalGold: 3200, from: [3145, 1058] }, // Shadowflame
};

export const HEALING_CHAMPIONS = new Set([
  "Aatrox", "Briar", "Dr. Mundo", "Fiora", "Illaoi", "Maokai", "Olaf",
  "Red Kayn", "Kayn", "Soraka", "Swain", "Sylas", "Trundle", "Vladimir",
  "Volibear", "Warwick", "Yuumi", "Zac",
]);

export const HEALING_ITEM_IDS = new Set([3072, 3153, 3065, 3074, 6692, 2502, 6610, 6617, 3107]);
export const ARMOR_ITEM_IDS = new Set([3047, 3075, 3143, 3110, 3068, 3157, 6333, 3742, 3076, 3082]);
export const MR_ITEM_IDS = new Set([3111, 2504, 4401, 3065, 3156, 3091, 3102, 3211, 1057]);

export const ITEM_ABILITY_HASTE: Record<number, number> = {
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
};

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
