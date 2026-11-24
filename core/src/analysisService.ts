import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  AnalysisAnswer,
  MatchupBriefing,
  AnalysisSnapshot,
  Benchmark,
  MatchReview,
  MetricKey,
  RankInfo,
  Standing,
  SyncState,
  Tier,
  TrainingGoal,
} from "./analysisTypes.js";
import { TIERS } from "./analysisTypes.js";
import type { AnalysisStore, AnalysisConfig, AnalysisState } from "./analysisStore.js";
import { BenchmarkAggregator, percentileOf, toBenchmark } from "./benchmarkAggregator.js";
import {
  BLOCK_SIZE,
  CURRENT_LEVEL_WINDOW,
  METRIC_LABEL,
  MIN_SAMPLES_FOR_GOAL,
  average,
  blockPassed,
  chooseGoal,
  isBlockComplete,
  mainRole,
  newGoal,
  recordMatches,
  templateGoalText,
} from "./goals.js";
import type { LlmProvider } from "./llmProvider.js";
import { Logger } from "./logger.js";
import { computeMatchReview, type ItemLookup } from "./matchMetrics.js";
import { RiotApiClient, RiotApiError } from "./riotApi.js";
import type { ParsedGameState } from "./types.js";
import {
  BRIEFING_SYSTEM,
  assembleBriefing,
  briefingPrompt,
  historyPoint,
  lastMatchInMatchup,
  parseBriefingReply,
} from "./briefing.js";

export const MATCH_HISTORY_SIZE = 20;
/** Riot publishes a finished match after a short delay; retry at these offsets. */
const POST_GAME_RETRY_DELAYS_MS = [60_000, 120_000, 240_000, 480_000];
const APEX_TIERS: readonly Tier[] = ["MASTER", "GRANDMASTER", "CHALLENGER"];
const DEFAULT_TIER: Tier = "PLATINUM";

export function nextTierOf(tier: Tier | "UNRANKED"): Tier {
  if (tier === "UNRANKED") return DEFAULT_TIER;
  const idx = TIERS.indexOf(tier);
  return TIERS[Math.min(TIERS.length - 1, idx + 1)];
}

/** Tiers to collect: the next one above the player plus the apex tiers. */
export function aggregationTiers(tier: Tier | "UNRANKED"): Tier[] {
  const next = nextTierOf(tier);
  return [next, ...APEX_TIERS.filter((t) => t !== next)];
}

/** Reads RIOT_API_KEY from the environment or, so a new key works without a restart, from .env. */
export function readRiotKey(envFile = join(process.cwd(), ".env")): string | undefined {
  try {
    const fromFile = readFileSync(envFile, "utf-8")
      .split("\n")
      .find((l) => l.startsWith("RIOT_API_KEY="))
      ?.slice("RIOT_API_KEY=".length)
      .trim();
    if (fromFile) return fromFile;
  } catch {
    // no .env file
  }
  return process.env.RIOT_API_KEY?.trim() || undefined;
}

function parseRiotId(riotId: string): { gameName: string; tagLine: string } | undefined {
  const parts = riotId.split("#");
  if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) return undefined;
  return { gameName: parts[0].trim(), tagLine: parts[1].trim() };
}

function clock(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function matchLine(m: MatchReview): string {
  return [
    `${m.champion} vs ${m.opponentChampion ?? "?"}`,
    m.win ? "WIN" : "LOSS",
    `KDA ${m.kills}/${m.deaths}/${m.assists}`,
    `CS@10 ${m.cs10} (diff ${m.csDiff10})`,
    `gold@15 ${m.gold15} (diff ${m.goldDiff15})`,
    `xp diff@15 ${m.xpDiff15}`,
    `deaths before 14:00: ${m.earlyDeaths.map((d) => `${clock(d.time)} ${d.zone} by ${d.killerChampion} (${d.enemiesInvolved} enemies)`).join("; ") || "none"}`,
    `objective presence ${m.objectivesPresent}/${m.objectivesTotal}`,
    m.firstCoreItem ? `first core item ${m.firstCoreItem} at ${m.firstCoreItemMinute} min` : "no core item",
  ].join(" | ");
}

const REVIEW_SYSTEM = `You are a League of Legends coach reviewing one ranked game for the player.
Use ONLY the facts and numbers given. Never invent numbers, events or cooldowns.
Reply ONLY with JSON: {"review": "3-5 short sentences: what decided the lane and the game, and one concrete thing to do differently", "insight": "one sentence matchup lesson for this champion pairing"}`;

const GOAL_SYSTEM = `You write training goals for a League of Legends player.
Rewrite the given goal as ONE concrete, motivating sentence of at most 22 words. Keep the number and the metric exactly. Reply with the sentence only.`;

const SUMMARY_SYSTEM = `You are a League of Legends coach. Summarise the player's recent ranked games in 4-6 sentences: strongest habit, biggest leak, and the single priority for the next games.
Use ONLY the given numbers; never invent statistics.`;

const ASK_SYSTEM = `You answer a League of Legends player's questions about their own recent ranked games.
Base every statement on the provided match data and benchmarks. If the data cannot answer the question, say so. Be concrete and brief (max 8 sentences).`;

export interface AnalysisServiceDeps {
  store: AnalysisStore;
  broadcast: (snapshot: AnalysisSnapshot) => void;
  items: ItemLookup;
  isGameActive: () => boolean;
  storeMatchupNote: (myChampion: string, note: string, opponent?: string) => Promise<unknown>;
  /** Saved matchup insights, most relevant first. */
  searchMatchupNotes?: (myChampion: string, opponent: string) => Promise<string[]>;
  /** Ability names for the briefing prompt, e.g. "Q Bloodlust, W Unstoppable, …". */
  abilitiesOf?: (champion: string) => Promise<string | undefined>;
  clientFactory?: (key: string, region: string) => RiotApiClient;
  readKey?: () => string | undefined;
  now?: () => number;
  schedule?: (fn: () => void, ms: number) => void;
}

/**
 * Owns the post-game review: syncs the player's ranked games, computes the
 * review metrics, keeps the training goal, drives the benchmark collection
 * and asks the LLM for texts. Every number is computed here, never by the LLM.
 */
export class AnalysisService {
  private config: AnalysisConfig = { region: "EUW" };
  private state: AnalysisState = { goals: [], aggregates: [] };
  private matches: MatchReview[] = [];
  private rank?: RankInfo;
  private sync: AnalysisSnapshot["sync"] = { state: "idle" };
  private keyProblem?: AnalysisSnapshot["keyProblem"];
  private llm: LlmProvider | null = null;
  private syncing = false;
  private goalUpdating = false;
  private briefing?: MatchupBriefing;
  private readonly aggregator: BenchmarkAggregator;
  private readonly now: () => number;

  constructor(private readonly deps: AnalysisServiceDeps) {
    this.now = deps.now ?? Date.now;
    this.aggregator = new BenchmarkAggregator({
      client: () => this.client(),
      isGameActive: deps.isGameActive,
      load: async () => this.state.aggregates,
      save: async (aggregates) => {
        const others = this.state.aggregates.filter(
          (a) => !aggregates.some((n) => n.tier === a.tier && n.role === a.role && n.patch === a.patch),
        );
        this.state = { ...this.state, aggregates: [...others, ...aggregates] };
        await this.deps.store.saveState(this.state);
      },
      onProgress: () => this.onAggregationProgress(),
    });
  }

  /** Creates the first goal as soon as the next-tier benchmark is sampled well enough. */
  private onAggregationProgress(): void {
    const hasGoal = this.state.goals.length > 0;
    const tier = nextTierOf(this.currentTier());
    const ready = this.benchmarks().some((b) => b.tier === tier && b.sampleSize >= MIN_SAMPLES_FOR_GOAL);
    if (!hasGoal && ready && !this.goalUpdating) {
      this.goalUpdating = true;
      void this.updateGoal()
        .catch((err) => Logger.warn("[Analysis] Goal update failed:", err))
        .finally(() => {
          this.goalUpdating = false;
          this.publish();
        });
    }
    this.publish();
  }

  setLlmProvider(provider: LlmProvider | null): void {
    this.llm = provider;
  }

  async start(): Promise<void> {
    this.config = await this.deps.store.loadConfig();
    this.state = await this.deps.store.loadState();
    this.matches = await this.deps.store.loadMatches();
    this.publish();
    if (this.config.riotId) void this.refresh();
  }

  private client(): RiotApiClient | undefined {
    const key = (this.deps.readKey ?? readRiotKey)();
    if (!key) return undefined;
    return (this.deps.clientFactory ?? ((k, r) => new RiotApiClient(k, r)))(key, this.config.region);
  }

  private currentTier(): Tier | "UNRANKED" {
    return this.rank?.tier ?? "UNRANKED";
  }

  private benchmarks(): Benchmark[] {
    const role = mainRole(this.matches);
    const patch = this.matches[0]?.patch;
    return this.state.aggregates
      .filter((a) => (!role || a.role === role) && (!patch || a.patch === patch))
      .map(toBenchmark)
      .filter((b): b is Benchmark => b !== undefined);
  }

  /** Percentiles of the player's recent main-role average within each collected tier. */
  private standings(): Standing[] {
    const role = mainRole(this.matches);
    const patch = this.matches[0]?.patch;
    const recent = this.matches.filter((m) => m.role === role).slice(0, CURRENT_LEVEL_WINDOW);
    if (!role || !patch || recent.length === 0) return [];
    const metrics: MetricKey[] = ["cs10", "earlyDeaths", "gold15", "objectivePresence"];
    const result: Standing[] = [];
    for (const a of this.state.aggregates.filter((x) => x.role === role && x.patch === patch)) {
      for (const metric of metrics) {
        const percentile = percentileOf(a.histograms?.[metric], metric, average(recent, metric));
        if (percentile !== undefined) result.push({ tier: a.tier, metric, percentile });
      }
    }
    return result;
  }

  snapshot(): AnalysisSnapshot {
    const goal = this.state.goals[this.state.goals.length - 1];
    return {
      ...(this.config.riotId ? { riotId: this.config.riotId } : {}),
      region: this.config.region,
      ...(this.rank ? { rank: this.rank } : {}),
      nextTier: nextTierOf(this.currentTier()),
      matches: this.matches.slice(0, MATCH_HISTORY_SIZE),
      benchmarks: this.benchmarks(),
      standings: this.standings(),
      ...(goal ? { goal } : {}),
      ...(this.state.backfillSummary ? { backfillSummary: this.state.backfillSummary } : {}),
      sync: this.sync,
      aggregation: this.aggregator.getProgress(),
      ...(this.keyProblem ? { keyProblem: this.keyProblem } : {}),
    };
  }

  private publish(): void {
    this.deps.broadcast(this.snapshot());
  }

  private setSync(state: SyncState, message?: string): void {
    this.sync = { ...this.sync, state, ...(message ? { message } : { message: undefined }) };
    if (state === "idle") this.sync.lastSyncAt = this.now();
    this.publish();
  }

  async setRiotId(riotId: string, region: string): Promise<void> {
    const changed = riotId !== this.config.riotId || region !== this.config.region;
    if (!changed) return this.refresh();
    this.aggregator.stop();
    await this.deps.store.resetPersonalData();
    this.state = { ...this.state, goals: [], backfillSummary: undefined };
    this.matches = [];
    this.rank = undefined;
    this.config = { riotId, region };
    await this.deps.store.saveConfig(this.config);
    await this.refresh();
  }

  /** Polls for the just-finished match until Riot publishes it. */
  /** Briefing of the running game, if one was created. */
  currentBriefing(): MatchupBriefing | undefined {
    return this.briefing;
  }

  /**
   * Builds the pre-lane briefing: two matchup facts from the LLM (when a
   * provider is configured) and one line from the player's own history.
   */
  async createBriefing(state: ParsedGameState, opponentChampion: string | undefined): Promise<MatchupBriefing | undefined> {
    if (!opponentChampion) return undefined;
    const me = state.localPlayer.championName;
    const role = state.localPlayer.position || "UNKNOWN";
    const [notes, myAbilities, oppAbilities] = await Promise.all([
      this.deps.searchMatchupNotes?.(me, opponentChampion).catch(() => []) ?? Promise.resolve([]),
      this.deps.abilitiesOf?.(me).catch(() => undefined),
      this.deps.abilitiesOf?.(opponentChampion).catch(() => undefined),
    ]);
    const llmReply = await this.complete(
      BRIEFING_SYSTEM,
      briefingPrompt({
        myChampion: me,
        myAbilities,
        opponentChampion,
        opponentAbilities: oppAbilities,
        role,
        rank: this.rank ? `${this.rank.tier} ${this.rank.division}` : undefined,
      }),
      200,
    );
    const history = historyPoint(lastMatchInMatchup(this.matches, me, opponentChampion), opponentChampion, notes[0]);
    this.briefing = assembleBriefing(me, opponentChampion, role, parseBriefingReply(llmReply), history, this.now());
    return this.briefing;
  }

  onGameEnded(): void {
    this.briefing = undefined;
    if (!this.config.riotId) return;
    const knownNewest = this.matches[0]?.matchId;
    this.setSync("waiting_for_match", "Waiting for Riot to publish the match");
    const attempt = (i: number) => {
      (this.deps.schedule ?? ((fn, ms) => setTimeout(fn, ms)))(async () => {
        await this.refresh();
        const found = this.matches[0]?.matchId !== knownNewest;
        if (!found && i + 1 < POST_GAME_RETRY_DELAYS_MS.length) attempt(i + 1);
      }, POST_GAME_RETRY_DELAYS_MS[i]);
    };
    attempt(0);
  }

  async refresh(): Promise<void> {
    if (this.syncing) return;
    const riotId = this.config.riotId ? parseRiotId(this.config.riotId) : undefined;
    if (!riotId) return;
    const client = this.client();
    if (!client) {
      this.keyProblem = "missing";
      this.setSync("error", "RIOT_API_KEY is not set");
      return;
    }
    this.syncing = true;
    this.setSync("syncing");
    try {
      if (!this.config.puuid) {
        const account = await client.accountByRiotId(riotId.gameName, riotId.tagLine);
        this.config = { ...this.config, puuid: account.puuid };
        await this.deps.store.saveConfig(this.config);
      }
      const puuid = this.config.puuid as string;
      const entries = await client.leagueEntriesByPuuid(puuid);
      const solo = entries.find((e) => e.queueType === "RANKED_SOLO_5x5");
      this.rank = solo
        ? { tier: solo.tier as Tier, division: solo.rank, leaguePoints: solo.leaguePoints, wins: solo.wins, losses: solo.losses }
        : { tier: "UNRANKED", division: "", leaguePoints: 0, wins: 0, losses: 0 };

      const isBackfill = this.matches.length === 0;
      const known = new Set(this.matches.map((m) => m.matchId));
      const ids = await client.matchIdsByPuuid(puuid, MATCH_HISTORY_SIZE);
      const fresh: MatchReview[] = [];
      for (const id of ids.filter((i) => !known.has(i))) {
        const [match, timeline] = [await client.match(id), await client.timeline(id)];
        const review = computeMatchReview(match, timeline, puuid, this.deps.items);
        if (!review) continue;
        fresh.push(review);
      }
      this.keyProblem = undefined;

      for (const review of fresh) {
        if (!isBackfill) await this.addAiReview(review);
        await this.deps.store.saveMatch(review);
      }
      this.matches = [...fresh, ...this.matches].sort((a, b) => b.gameStart - a.gameStart);
      if (isBackfill && fresh.length > 0) await this.writeBackfillSummary();
      await this.updateGoal();
      this.setSync("idle");
      this.startAggregation();
    } catch (err) {
      if (err instanceof RiotApiError && err.isKeyProblem) {
        this.keyProblem = "invalid_or_expired";
        this.setSync("error", "Riot API key invalid or expired");
      } else if (err instanceof RiotApiError && err.status === 404) {
        this.setSync("error", `Riot ID ${this.config.riotId} not found in ${this.config.region}`);
      } else {
        Logger.warn("[Analysis] Sync failed:", err);
        this.setSync("error", err instanceof Error ? err.message : String(err));
      }
    } finally {
      this.syncing = false;
    }
  }

  private startAggregation(): void {
    const role = mainRole(this.matches);
    const patch = this.matches[0]?.patch;
    if (!role || !patch) return;
    void this.aggregator.run(aggregationTiers(this.currentTier()), role, patch);
  }

  private async complete(system: string, user: string, maxTokens: number): Promise<string | undefined> {
    if (!this.llm?.completeText) return undefined;
    try {
      return (await this.llm.completeText(system, user, maxTokens)).text.trim();
    } catch (err) {
      Logger.warn("[Analysis] LLM call failed:", err);
      return undefined;
    }
  }

  private async addAiReview(review: MatchReview): Promise<void> {
    const raw = await this.complete(REVIEW_SYSTEM, matchLine(review), 400);
    if (!raw) return;
    let text = raw;
    let insight: string | undefined;
    try {
      const parsed = JSON.parse(raw.replace(/```(?:json)?/g, "").trim()) as { review?: string; insight?: string };
      text = parsed.review ?? raw;
      insight = parsed.insight;
    } catch {
      // plain text answer
    }
    review.aiReview = text;
    if (insight && review.opponentChampion) {
      await this.deps.storeMatchupNote(review.champion, insight, review.opponentChampion).catch(() => {});
    }
  }

  private async writeBackfillSummary(): Promise<void> {
    const lines = this.matches.slice(0, MATCH_HISTORY_SIZE).map(matchLine).join("\n");
    const summary = await this.complete(SUMMARY_SYSTEM, lines, 450);
    if (!summary) return;
    this.state = { ...this.state, backfillSummary: summary };
    await this.deps.store.saveState(this.state);
  }

  private async updateGoal(): Promise<void> {
    const role = mainRole(this.matches);
    const recent = this.matches.filter((m) => m.role === role).slice(0, CURRENT_LEVEL_WINDOW);
    const tier = nextTierOf(this.currentTier());
    const goals = [...this.state.goals];
    let current = goals[goals.length - 1];

    if (current && current.status !== "achieved") {
      current = recordMatches(current, this.matches);
      goals[goals.length - 1] = current;
      if (isBlockComplete(current)) {
        const passed = blockPassed(current);
        goals[goals.length - 1] = { ...current, status: passed ? "achieved" : current.status };
        if (!passed) {
          goals.push(newGoal({ metric: current.metric, target: current.target, basedOnTier: current.basedOnTier }, current.text, this.now(), current));
        }
        current = goals[goals.length - 1];
      }
    }

    if (!current || current.status === "achieved") {
      const benchmark = this.benchmarks().find((b) => b.tier === tier);
      const choice = chooseGoal(recent, benchmark, tier);
      if (choice) {
        const template = templateGoalText(choice);
        const mine = average(recent, choice.metric).toFixed(1);
        const text =
          (await this.complete(
            GOAL_SYSTEM,
            `Goal: ${template}\nContext: player's current average ${METRIC_LABEL[choice.metric]} is ${mine}; target is based on ${tier} players in the ${role} role.`,
            80,
          )) ?? template;
        goals.push(newGoal(choice, text, this.now()));
      }
    }
    this.state = { ...this.state, goals: goals.slice(-20) };
    await this.deps.store.saveState(this.state);
  }

  async ask(question: string, requestId: string): Promise<AnalysisAnswer> {
    if (!this.llm?.completeText) return { requestId, error: "No AI provider configured" };
    if (this.matches.length === 0) return { requestId, error: "No games analysed yet" };
    const goal: TrainingGoal | undefined = this.state.goals[this.state.goals.length - 1];
    const benchmarks = this.benchmarks()
      .map((b) => `${b.tier}: CS@10 ${b.cs10.toFixed(1)}, deaths before 14:00 ${b.earlyDeaths.toFixed(2)}, gold@15 ${Math.round(b.gold15)}, objective presence ${(b.objectivePresence * 100).toFixed(0)}% (n=${b.sampleSize})`)
      .join("\n");
    const context = [
      `Player rank: ${this.rank ? `${this.rank.tier} ${this.rank.division}` : "unknown"}`,
      goal ? `Current goal: ${goal.text} (${goal.results.filter(Boolean).length}/${goal.results.length} met so far, block of ${BLOCK_SIZE})` : "",
      `Benchmarks for the player's role:\n${benchmarks || "not collected yet"}`,
      `Recent games, newest first:\n${this.matches.slice(0, MATCH_HISTORY_SIZE).map(matchLine).join("\n")}`,
      `Question: ${question}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    const answer = await this.complete(ASK_SYSTEM, context, 500);
    return answer ? { requestId, answer } : { requestId, error: "The AI provider did not answer" };
  }
}
