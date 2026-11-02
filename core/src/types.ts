import { z } from "zod";

// --- Riot Live Client API Schemas ---

export const AbilitySlotSchema = z.object({
  abilityLevel: z.number().catch(0),
  displayName: z.string().catch(""),
  id: z.string().catch(""),
});

export const FullRunesSchema = z
  .object({
    keystone: z.object({ displayName: z.string().catch("") }).optional(),
    primaryRuneTree: z.object({ displayName: z.string().catch("") }).optional(),
    secondaryRuneTree: z.object({ displayName: z.string().catch("") }).optional(),
    generalRunes: z
      .array(z.object({ displayName: z.string().catch("") }))
      .catch([]),
  })
  .optional();

export const ActivePlayerSchema = z.object({
  championStats: z.object({
    abilityPower: z.number().catch(0),
    armor: z.number().catch(0),
    attackDamage: z.number().catch(0),
    critChance: z.number().catch(0),
    healthMax: z.number().catch(0),
    magicResist: z.number().catch(0),
    abilityHaste: z.number().catch(0),
    attackSpeed: z.number().catch(0),
    moveSpeed: z.number().catch(0),
    magicPenetrationFlat: z.number().catch(0),
    magicPenetrationPercent: z.number().catch(0),
    armorPenetrationFlat: z.number().catch(0),
    armorPenetrationPercent: z.number().catch(0),
    lifeSteal: z.number().catch(0),
    omnivamp: z.number().catch(0),
    currentHealth: z.number().catch(0),
  }),
  currentGold: z.number(),
  level: z.number(),
  summonerName: z.string(),
  abilities: z
    .object({
      Q: AbilitySlotSchema.optional(),
      W: AbilitySlotSchema.optional(),
      E: AbilitySlotSchema.optional(),
      R: AbilitySlotSchema.optional(),
    })
    .optional(),
  fullRunes: FullRunesSchema,
});

export const ItemSchema = z.object({
  canUse: z.boolean(),
  consumable: z.boolean(),
  count: z.number(),
  displayName: z.string(),
  itemID: z.number(),
  price: z.number(),
  rawDescription: z.string(),
  slot: z.number(),
});

export const SummonerSpellSchema = z.object({
  displayName: z.string().catch(""),
});

export const SummonerSpellsSchema = z
  .object({
    summonerSpellOne: SummonerSpellSchema.optional(),
    summonerSpellTwo: SummonerSpellSchema.optional(),
  })
  .optional();

export const PlayerRunesSchema = z
  .object({
    keystone: z.object({ displayName: z.string().catch("") }).optional(),
    primaryRuneTree: z.object({ displayName: z.string().catch("") }).optional(),
    secondaryRuneTree: z.object({ displayName: z.string().catch("") }).optional(),
  })
  .optional();

export const PlayerSchema = z.object({
  championName: z.string(),
  isBot: z.boolean(),
  isDead: z.boolean(),
  respawnTimer: z.number().catch(0).optional(),
  items: z.array(ItemSchema),
  level: z.number(),
  position: z.string().catch(""),
  rawChampionName: z.string(),
  summonerSpells: SummonerSpellsSchema,
  runes: PlayerRunesSchema,
  scores: z.object({
    assists: z.number(),
    creepScore: z.number(),
    deaths: z.number(),
    kills: z.number(),
    wardScore: z.number().catch(0),
  }),
  skinID: z.number(),
  summonerName: z.string(),
  team: z.enum(["ORDER", "CHAOS"]).catch("ORDER" as any),
});

export const LiveGameEventSchema = z.object({
  EventID: z.number().catch(0),
  EventName: z.string().catch(""),
  EventTime: z.number().catch(0),
  KillerName: z.string().optional(),
  VictimName: z.string().optional(),
  DragonType: z.string().optional(),
  Stolen: z.string().optional(),
  TurretKilled: z.string().optional(),
  Assisters: z.array(z.string()).optional(),
});

export const GameDataSchema = z.object({
  gameMode: z.string(),
  gameTime: z.number(),
  mapName: z.string(),
  mapNumber: z.number(),
  mapTerrain: z.string().catch(""),
});

export const AllGameDataSchema = z.object({
  activePlayer: ActivePlayerSchema,
  allPlayers: z.array(PlayerSchema),
  gameData: GameDataSchema,
  events: z
    .object({
      Events: z.array(LiveGameEventSchema).catch([]),
    })
    .optional(),
});

export type ActivePlayer = z.infer<typeof ActivePlayerSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type Player = z.infer<typeof PlayerSchema>;
export type LiveGameEvent = z.infer<typeof LiveGameEventSchema>;
export type GameData = z.infer<typeof GameDataSchema>;
export type AllGameData = z.infer<typeof AllGameDataSchema>;

export type RolePosition = "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY" | "UNKNOWN" | string;

/**
 * Playstyle the user wants the coaching tuned to.
 * Shapes only the *tone/aggressiveness* of the single recommendation — never
 * produces multiple parallel recommendations.
 */
export type RiskLevel = "safe" | "normal" | "risky";

export const DEFAULT_RISK_LEVEL: RiskLevel = "normal";

/**
 * Combat/build focus preference for item & tactical recommendations.
 */
export type BuildFocus = "auto" | "burst" | "dps" | "bruiser" | "split";

export const DEFAULT_BUILD_FOCUS: BuildFocus = "auto";

// --- Interne Bridge-Typen ---

export interface ParsedGameState {
  gameTime: number;
  gameMode: string;
  localPlayer: Player;
  allies: Player[];
  enemies: Player[];
  activePlayer: ActivePlayer;
  mapEvents?: LiveGameEvent[];
}

export type GameEvent =
  | { type: "GAME_STARTED"; state: ParsedGameState }
  | { type: "ITEM_PURCHASED"; player: Player; state: ParsedGameState }
  | { type: "LEVEL_UP"; player: Player; newLevel: number; state: ParsedGameState }
  | { type: "GAME_TICK"; state: ParsedGameState }
  | { type: "PLAYER_DIED"; state: ParsedGameState }
  | { type: "HIGH_GOLD_REACHED"; state: ParsedGameState };

// --- Challenger Coaching Engine Insights ---

export interface NextBestBuy {
  itemId: number;
  itemName: string;
  price: number;
  targetItemId: number;
  targetItemName: string;
  breakpointHint?: string;
}

export interface EnemySummonerCooldown {
  name: string;
  cooldown: number;
}

export interface EnemyCooldowns {
  championName: string;
  level: number;
  abilityHaste: number;
  q: number;
  w: number;
  e: number;
  r: number;
  keyThreatSpell?: "Q" | "W" | "E" | "R";
  summonerSpells?: EnemySummonerCooldown[];
  keyThreatSummary: string;
}

export type MacroAlertPriority = "critical" | "warning" | "info";
export type MacroAlertCategory = "danger" | "objective" | "economy";

export interface MacroAlert {
  id: string;
  priority: MacroAlertPriority;
  category: MacroAlertCategory;
  title: string;
  detail: string;
}

export interface ObjectiveTimer {
  type: "dragon" | "baron" | "herald" | "grubs";
  label: string;
  secondsUntilSpawn: number;
  status: "alive" | "spawning_soon" | "countdown";
}

export interface TacticalInsights {
  primaryThreat?: {
    championName: string;
    reason: string;
    kills: number;
    cs: number;
    level: number;
  };
  teamDamageProfile: {
    adPercent: number;
    apPercent: number;
    heavyHealing: boolean;
    armorStacking: boolean;
    mrStacking: boolean;
  };
  nextBestBuy?: NextBestBuy;
  enemyCooldowns?: EnemyCooldowns;
  macroAlerts: MacroAlert[];
  objectives: ObjectiveTimer[];
  csPerMin: number;
  targetCsPerMin: number;
  buildFocus: BuildFocus;
  preferPassiveItems: boolean;
}

export interface PostGameAutopsy {
  championName: string;
  role: string;
  durationMinutes: number;
  kda: string;
  csPerMin: number;
  targetCsPerMin: number;
  praise: string;
  mistakes: string[];
  timestamp: number;
}

export interface PlayerHabitProfile {
  gamesTracked: number;
  avgCsPerMin: number;
  earlyDeathRate: number;
  highGoldDeathRate: number;
  habitWarnings: string[];
  lastAutopsy?: PostGameAutopsy;
}

// --- WebSocket Message Schema (an Flutter gesendet) ---

export interface WsTokenUsage {
  lastInput: number;
  lastOutput: number;
  sessionInput: number;
  sessionOutput: number;
}

export interface WsMessage {
  event: string;
  timestamp: number;
  gameState?: ParsedGameState;
  recommendation?: ItemRecommendation;
  tacticalInsights?: TacticalInsights;
  playerProfile?: PlayerHabitProfile;
  postGameAutopsy?: PostGameAutopsy;
  error?: string;
  correlationId?: string;
  /** Game event that triggered this recommendation (e.g. PLAYER_DIED). */
  triggerEvent?: string;
  tokenUsage?: WsTokenUsage;
  sessionInputTokens?: number;
  budget?: number;
}

export interface Strategy {
  winCondition: "early" | "mid" | "late";
  summary: string;
  immediateAction: string;
  lateGamePlan: string;
  laneMatchupAnalysis?: string;
  counterPlay?: string;
}

export interface ItemRecommendation {
  items: RecommendedItem[];
  reasoning: string;
  source: "heuristic" | "llm";
  provider: string;
  strategy: Strategy;
}

export interface RecommendedItem {
  id: number;
  name: string;
  reason: string;
  priority: "core" | "situational";
}

export interface CompProfile {
  adRatio: number;
  apRatio: number;
  ccScore: number;
  healScore: number;
}
