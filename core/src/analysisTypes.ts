/**
 * Post-game review & analysis board — shared contract between the core and
 * the Flutter app. Every number here is computed by code; the LLM only
 * writes the `aiReview`, goal `text` and answers to questions.
 */

/** Rank tiers in ladder order. */
export const TIERS = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
] as const;
export type Tier = (typeof TIERS)[number];

/**
 * Metrics compared against rank benchmarks and used for goals. Lane
 * differences (csDiff10, goldDiff15) average to zero over a rank — both
 * laners are sampled — so benchmarks and goals use absolute values instead.
 */
export type MetricKey = "cs10" | "earlyDeaths" | "gold15" | "objectivePresence";

/** Higher is better for every metric except `earlyDeaths`. */
export const LOWER_IS_BETTER: ReadonlySet<MetricKey> = new Set(["earlyDeaths"]);

export interface EarlyDeath {
  /** Game time in seconds. */
  time: number;
  /** Human-readable map zone, e.g. "Top lane, enemy half". */
  zone: string;
  killerChampion: string;
  /** Number of enemies involved (killer + assists). */
  enemiesInvolved: number;
}

export interface MinuteDiff {
  minute: number;
  gold: number;
  xp: number;
  cs: number;
}

export interface ShopVisit {
  /** Game time in seconds of the first purchase in the visit. */
  time: number;
  /** Gold the player held right before the visit (nearest minute frame). */
  goldBefore: number;
  itemsBought: string[];
}

export interface MatchReview {
  matchId: string;
  /** Epoch milliseconds of game start. */
  gameStart: number;
  durationSec: number;
  /** e.g. "26.22" */
  patch: string;
  win: boolean;
  role: string;
  champion: string;
  opponentChampion?: string;
  kills: number;
  deaths: number;
  assists: number;

  // Headline metrics
  cs10: number;
  csDiff10: number;
  earlyDeaths: EarlyDeath[];
  /** Total gold at 15:00. */
  gold15: number;
  goldDiff15: number;
  xpDiff15: number;
  /** Share (0–1) of epic objectives taken by either team where the player was present. */
  objectivePresence: number;
  objectivesTotal: number;
  objectivesPresent: number;

  // Pro depth
  minuteDiffs: MinuteDiff[];
  /** Minute the first completed legendary item was bought, if any. */
  firstCoreItemMinute?: number;
  firstCoreItem?: string;
  shopVisits: ShopVisit[];

  /** LLM-written review (3–5 sentences), absent for backfilled games. */
  aiReview?: string;
}

/** Aggregated averages for one rank tier of one role. */
export interface Benchmark {
  tier: Tier;
  role: string;
  patch: string;
  sampleSize: number;
  cs10: number;
  earlyDeaths: number;
  gold15: number;
  objectivePresence: number;
}

export type GoalStatus = "active" | "achieved" | "repeat";

export interface TrainingGoal {
  id: string;
  metric: MetricKey;
  /** Target the metric must reach in a game (≤ for earlyDeaths, ≥ otherwise). */
  target: number;
  /** LLM-written goal sentence; falls back to a template without a provider. */
  text: string;
  /** Benchmark tier the target was derived from. */
  basedOnTier: Tier;
  /** Match ids counted for this block, at most 5. */
  matchIds: string[];
  /** Per counted match: was the goal met? Parallel to `matchIds`. */
  results: boolean[];
  status: GoalStatus;
  createdAt: number;
}

export interface RankInfo {
  tier: Tier | "UNRANKED";
  division: string;
  leaguePoints: number;
  wins: number;
  losses: number;
}

export type SyncState = "idle" | "syncing" | "waiting_for_match" | "error";

export interface AggregationProgress {
  state: "idle" | "running" | "paused" | "done" | "key_expired" | "error";
  /** Tiers being collected, with collected sample counts. */
  tiers: Array<{ tier: Tier; samples: number; target: number }>;
  patch?: string;
  message?: string;
}

export interface AnalysisSnapshot {
  riotId?: string;
  region: string;
  rank?: RankInfo;
  /** Tier the "next rank" benchmarks refer to. */
  nextTier?: Tier;
  /** Newest first, at most 20. */
  matches: MatchReview[];
  benchmarks: Benchmark[];
  goal?: TrainingGoal;
  /** LLM summary over the backfilled games, if generated. */
  backfillSummary?: string;
  sync: { state: SyncState; message?: string; lastSyncAt?: number };
  aggregation: AggregationProgress;
  /** True when the Riot key is missing, invalid or expired. */
  keyProblem?: "missing" | "invalid_or_expired";
}

/**
 * WebSocket events
 *
 * App → core:
 *   { event: "GET_ANALYSIS" }
 *   { event: "REFRESH_ANALYSIS" }                       re-sync matches now
 *   { event: "SET_RIOT_ID", riotId: "Name#TAG", region: "EUW" }
 *   { event: "ASK_ANALYSIS", question: string, requestId: string }
 *
 * Core → app:
 *   { event: "ANALYSIS_UPDATE", analysis: AnalysisSnapshot }
 *   { event: "ANALYSIS_ANSWER", requestId: string, answer?: string, error?: string }
 */
export interface AnalysisAnswer {
  requestId: string;
  answer?: string;
  error?: string;
}
