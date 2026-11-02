"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BUILD_FOCUS = exports.DEFAULT_RISK_LEVEL = exports.AllGameDataSchema = exports.GameDataSchema = exports.LiveGameEventSchema = exports.PlayerSchema = exports.PlayerRunesSchema = exports.SummonerSpellsSchema = exports.SummonerSpellSchema = exports.ItemSchema = exports.ActivePlayerSchema = exports.FullRunesSchema = exports.AbilitySlotSchema = void 0;
const zod_1 = require("zod");
// --- Riot Live Client API Schemas ---
exports.AbilitySlotSchema = zod_1.z.object({
    abilityLevel: zod_1.z.number().catch(0),
    displayName: zod_1.z.string().catch(""),
    id: zod_1.z.string().catch(""),
});
exports.FullRunesSchema = zod_1.z
    .object({
    keystone: zod_1.z.object({ displayName: zod_1.z.string().catch("") }).optional(),
    primaryRuneTree: zod_1.z.object({ displayName: zod_1.z.string().catch("") }).optional(),
    secondaryRuneTree: zod_1.z.object({ displayName: zod_1.z.string().catch("") }).optional(),
    generalRunes: zod_1.z
        .array(zod_1.z.object({ displayName: zod_1.z.string().catch("") }))
        .catch([]),
})
    .optional();
exports.ActivePlayerSchema = zod_1.z.object({
    championStats: zod_1.z.object({
        abilityPower: zod_1.z.number().catch(0),
        armor: zod_1.z.number().catch(0),
        attackDamage: zod_1.z.number().catch(0),
        critChance: zod_1.z.number().catch(0),
        healthMax: zod_1.z.number().catch(0),
        magicResist: zod_1.z.number().catch(0),
        abilityHaste: zod_1.z.number().catch(0),
        attackSpeed: zod_1.z.number().catch(0),
        moveSpeed: zod_1.z.number().catch(0),
        magicPenetrationFlat: zod_1.z.number().catch(0),
        magicPenetrationPercent: zod_1.z.number().catch(0),
        armorPenetrationFlat: zod_1.z.number().catch(0),
        armorPenetrationPercent: zod_1.z.number().catch(0),
        lifeSteal: zod_1.z.number().catch(0),
        omnivamp: zod_1.z.number().catch(0),
        currentHealth: zod_1.z.number().catch(0),
    }),
    currentGold: zod_1.z.number(),
    level: zod_1.z.number(),
    summonerName: zod_1.z.string(),
    abilities: zod_1.z
        .object({
        Q: exports.AbilitySlotSchema.optional(),
        W: exports.AbilitySlotSchema.optional(),
        E: exports.AbilitySlotSchema.optional(),
        R: exports.AbilitySlotSchema.optional(),
    })
        .optional(),
    fullRunes: exports.FullRunesSchema,
});
exports.ItemSchema = zod_1.z.object({
    canUse: zod_1.z.boolean(),
    consumable: zod_1.z.boolean(),
    count: zod_1.z.number(),
    displayName: zod_1.z.string(),
    itemID: zod_1.z.number(),
    price: zod_1.z.number(),
    rawDescription: zod_1.z.string(),
    slot: zod_1.z.number(),
});
exports.SummonerSpellSchema = zod_1.z.object({
    displayName: zod_1.z.string().catch(""),
});
exports.SummonerSpellsSchema = zod_1.z
    .object({
    summonerSpellOne: exports.SummonerSpellSchema.optional(),
    summonerSpellTwo: exports.SummonerSpellSchema.optional(),
})
    .optional();
exports.PlayerRunesSchema = zod_1.z
    .object({
    keystone: zod_1.z.object({ displayName: zod_1.z.string().catch("") }).optional(),
    primaryRuneTree: zod_1.z.object({ displayName: zod_1.z.string().catch("") }).optional(),
    secondaryRuneTree: zod_1.z.object({ displayName: zod_1.z.string().catch("") }).optional(),
})
    .optional();
exports.PlayerSchema = zod_1.z.object({
    championName: zod_1.z.string(),
    isBot: zod_1.z.boolean(),
    isDead: zod_1.z.boolean(),
    respawnTimer: zod_1.z.number().catch(0).optional(),
    items: zod_1.z.array(exports.ItemSchema),
    level: zod_1.z.number(),
    position: zod_1.z.string().catch(""),
    rawChampionName: zod_1.z.string(),
    summonerSpells: exports.SummonerSpellsSchema,
    runes: exports.PlayerRunesSchema,
    scores: zod_1.z.object({
        assists: zod_1.z.number(),
        creepScore: zod_1.z.number(),
        deaths: zod_1.z.number(),
        kills: zod_1.z.number(),
        wardScore: zod_1.z.number().catch(0),
    }),
    skinID: zod_1.z.number(),
    summonerName: zod_1.z.string(),
    team: zod_1.z.enum(["ORDER", "CHAOS"]).catch("ORDER"),
});
exports.LiveGameEventSchema = zod_1.z.object({
    EventID: zod_1.z.number().catch(0),
    EventName: zod_1.z.string().catch(""),
    EventTime: zod_1.z.number().catch(0),
    KillerName: zod_1.z.string().optional(),
    VictimName: zod_1.z.string().optional(),
    DragonType: zod_1.z.string().optional(),
    Stolen: zod_1.z.string().optional(),
    TurretKilled: zod_1.z.string().optional(),
    Assisters: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.GameDataSchema = zod_1.z.object({
    gameMode: zod_1.z.string(),
    gameTime: zod_1.z.number(),
    mapName: zod_1.z.string(),
    mapNumber: zod_1.z.number(),
    mapTerrain: zod_1.z.string().catch(""),
});
exports.AllGameDataSchema = zod_1.z.object({
    activePlayer: exports.ActivePlayerSchema,
    allPlayers: zod_1.z.array(exports.PlayerSchema),
    gameData: exports.GameDataSchema,
    events: zod_1.z
        .object({
        Events: zod_1.z.array(exports.LiveGameEventSchema).catch([]),
    })
        .optional(),
});
exports.DEFAULT_RISK_LEVEL = "normal";
exports.DEFAULT_BUILD_FOCUS = "auto";
