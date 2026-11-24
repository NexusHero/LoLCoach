import type { AggregationProgress, Benchmark, MetricKey, Tier } from "./analysisTypes.js";
import { LOWER_IS_BETTER } from "./analysisTypes.js";
import type { TierAggregate } from "./analysisStore.js";
import { computeLaneSample, isRemake, patchOf } from "./matchMetrics.js";
import { RiotApiError, type RiotApiClient } from "./riotApi.js";
import { Logger } from "./logger.js";

/** Lane samples per tier before the benchmark counts as complete. */
export const SAMPLES_PER_TIER = 300;
/** Recent games sampled per ladder player, so a few players do not dominate. */
const MATCHES_PER_PLAYER = 3;
const MAX_SEEN_IDS = 2_000;

/** Samples a histogram needs before percentiles are shown. */
export const MIN_STANDING_SAMPLES = 50;

/** Fixed bins per metric: values are clamped into [start, start + size * count). */
export const HISTOGRAM_BINS: Record<MetricKey, { start: number; size: number; count: number }> = {
  cs10: { start: 0, size: 5, count: 32 },
  earlyDeaths: { start: 0, size: 1, count: 7 },
  gold15: { start: 2_000, size: 250, count: 30 },
  objectivePresence: { start: 0, size: 0.1, count: 11 },
};

const METRICS = Object.keys(HISTOGRAM_BINS) as MetricKey[];

export function binIndex(metric: MetricKey, value: number): number {
  const bins = HISTOGRAM_BINS[metric];
  // The epsilon keeps values like 0.3 / 0.1 from landing one bin low.
  const raw = Math.floor((value - bins.start) / bins.size + 1e-9);
  return Math.max(0, Math.min(bins.count - 1, raw));
}

export function addToHistogram(aggregate: TierAggregate, metric: MetricKey, value: number): void {
  const histograms = (aggregate.histograms ??= {});
  const counts = (histograms[metric] ??= new Array<number>(HISTOGRAM_BINS[metric].count).fill(0));
  counts[binIndex(metric, value)] += 1;
}

/**
 * Share (0–100) of the tier's samples the value does better than, counting
 * half of its own bin. Undefined until the histogram has enough samples.
 */
export function percentileOf(counts: number[] | undefined, metric: MetricKey, value: number): number | undefined {
  const total = counts?.reduce((a, b) => a + b, 0) ?? 0;
  if (!counts || total < MIN_STANDING_SAMPLES) return undefined;
  const idx = binIndex(metric, value);
  const below = counts.slice(0, idx).reduce((a, b) => a + b, 0);
  const share = (below + counts[idx] / 2) / total;
  return Math.round((LOWER_IS_BETTER.has(metric) ? 1 - share : share) * 100);
}

export interface AggregatorDeps {
  client: () => RiotApiClient | undefined;
  /** True while a live game runs; collection pauses so polling stays responsive. */
  isGameActive: () => boolean;
  load: () => Promise<TierAggregate[]>;
  save: (aggregates: TierAggregate[]) => Promise<void>;
  onProgress: (progress: AggregationProgress) => void;
  sleep?: (ms: number) => Promise<void>;
}

export function emptyAggregate(tier: Tier, role: string, patch: string): TierAggregate {
  return {
    tier,
    role,
    patch,
    samples: 0,
    sums: { cs10: 0, earlyDeaths: 0, gold15: 0, objectivePresence: 0 },
    seenMatchIds: [],
    playerCursor: 0,
    ladderPage: 1,
  };
}

export function toBenchmark(a: TierAggregate): Benchmark | undefined {
  if (a.samples === 0) return undefined;
  const avg = (v: number) => v / a.samples;
  return {
    tier: a.tier,
    role: a.role,
    patch: a.patch,
    sampleSize: a.samples,
    cs10: avg(a.sums.cs10),
    earlyDeaths: avg(a.sums.earlyDeaths),
    gold15: avg(a.sums.gold15),
    objectivePresence: avg(a.sums.objectivePresence),
  };
}

/**
 * Collects role benchmarks per tier from ranked games of ladder players.
 * Runs in the background, resumes from persisted cursors, restarts when the
 * patch changes, and stops cleanly on an expired key.
 */
export class BenchmarkAggregator {
  private running = false;
  private stopRequested = false;
  private progress: AggregationProgress = { state: "idle", tiers: [] };

  constructor(private readonly deps: AggregatorDeps) {}

  getProgress(): AggregationProgress {
    return this.progress;
  }

  stop(): void {
    this.stopRequested = true;
  }

  private report(update: Partial<AggregationProgress>, aggregates: TierAggregate[]): void {
    this.progress = {
      ...this.progress,
      ...update,
      tiers: aggregates.map((a) => ({ tier: a.tier, samples: a.samples, target: SAMPLES_PER_TIER })),
    };
    this.deps.onProgress(this.progress);
  }

  /** Starts (or resumes) collection; returns immediately when already running. */
  async run(tiers: Tier[], role: string, patch: string): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.stopRequested = false;
    try {
      let aggregates = await this.deps.load();
      aggregates = tiers.map(
        (tier) =>
          aggregates.find((a) => a.tier === tier && a.role === role && a.patch === patch) ??
          emptyAggregate(tier, role, patch),
      );
      this.report({ state: "running", patch, message: undefined }, aggregates);

      for (const aggregate of aggregates) {
        while (aggregate.samples < SAMPLES_PER_TIER && !this.stopRequested) {
          const client = this.deps.client();
          if (!client) {
            this.report({ state: "key_expired", message: "No Riot API key configured" }, aggregates);
            return;
          }
          if (this.deps.isGameActive()) {
            this.report({ state: "paused", message: "Paused while a game is running" }, aggregates);
            await (this.deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))))(30_000);
            continue;
          }
          const progressed = await this.samplePlayer(client, aggregate);
          await this.deps.save(aggregates);
          this.report({ state: "running", message: undefined }, aggregates);
          if (!progressed) break; // ladder exhausted for this tier
        }
      }
      this.report({ state: this.stopRequested ? "idle" : "done" }, aggregates);
    } catch (err) {
      const keyProblem = err instanceof RiotApiError && err.isKeyProblem;
      Logger.warn("[Benchmarks] Collection stopped:", err);
      this.progress = {
        ...this.progress,
        state: keyProblem ? "key_expired" : "error",
        message: keyProblem ? "Riot API key invalid or expired" : String(err instanceof Error ? err.message : err),
      };
      this.deps.onProgress(this.progress);
    } finally {
      this.running = false;
    }
  }

  /** Samples the next ladder player's recent games; false when no players are left. */
  private async samplePlayer(client: RiotApiClient, aggregate: TierAggregate): Promise<boolean> {
    const players = await client.ladderPuuids(aggregate.tier, aggregate.ladderPage);
    if (aggregate.playerCursor >= players.length) {
      if (players.length === 0 || ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(aggregate.tier)) return false;
      aggregate.ladderPage += 1;
      aggregate.playerCursor = 0;
      return true;
    }
    const puuid = players[aggregate.playerCursor];
    aggregate.playerCursor += 1;

    const ids = await client.matchIdsByPuuid(puuid, MATCHES_PER_PLAYER);
    for (const id of ids) {
      if (aggregate.seenMatchIds.includes(id) || aggregate.samples >= SAMPLES_PER_TIER) continue;
      aggregate.seenMatchIds = [...aggregate.seenMatchIds, id].slice(-MAX_SEEN_IDS);
      const match = await client.match(id);
      if (patchOf(match.info.gameVersion) !== aggregate.patch || isRemake(match)) continue;
      const laners = match.info.participants.filter((p) => p.teamPosition === aggregate.role);
      if (laners.length !== 2) continue;
      const timeline = await client.timeline(id);
      for (const p of laners) {
        const sample = computeLaneSample(match, timeline, p);
        if (!sample) continue;
        aggregate.samples += 1;
        aggregate.sums.cs10 += sample.cs10;
        aggregate.sums.earlyDeaths += sample.earlyDeaths;
        aggregate.sums.gold15 += sample.gold15;
        aggregate.sums.objectivePresence += sample.objectivePresence;
        for (const metric of METRICS) addToHistogram(aggregate, metric, sample[metric]);
      }
    }
    return true;
  }
}
