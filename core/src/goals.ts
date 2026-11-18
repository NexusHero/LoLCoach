import type { Benchmark, MatchReview, MetricKey, Tier, TrainingGoal } from "./analysisTypes.js";
import { LOWER_IS_BETTER } from "./analysisTypes.js";

export const BLOCK_SIZE = 5;
export const BLOCK_PASS_COUNT = 4;
/** Recent games of the main role used to judge the current level. */
const CURRENT_LEVEL_WINDOW = 10;

/** One "unit" of each metric, used to compare gaps across different scales. */
const METRIC_SCALE: Record<MetricKey, number> = {
  cs10: 10,
  earlyDeaths: 1,
  gold15: 500,
  objectivePresence: 0.2,
};

export const METRIC_LABEL: Record<MetricKey, string> = {
  cs10: "CS at 10:00",
  earlyDeaths: "deaths before 14:00",
  gold15: "gold at 15:00",
  objectivePresence: "objective presence",
};

export function metricValue(match: MatchReview, metric: MetricKey): number {
  return metric === "earlyDeaths" ? match.earlyDeaths.length : match[metric];
}

export function average(matches: MatchReview[], metric: MetricKey): number {
  if (matches.length === 0) return 0;
  return matches.reduce((sum, m) => sum + metricValue(m, metric), 0) / matches.length;
}

export function mainRole(matches: MatchReview[]): string | undefined {
  const counts = new Map<string, number>();
  for (const m of matches) {
    if (m.role && m.role !== "UNKNOWN") counts.set(m.role, (counts.get(m.role) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** Positive when the player is behind the benchmark, in metric units. */
function gapInUnits(metric: MetricKey, mine: number, benchmark: number): number {
  const raw = LOWER_IS_BETTER.has(metric) ? mine - benchmark : benchmark - mine;
  return raw / METRIC_SCALE[metric];
}

function roundTarget(metric: MetricKey, value: number): number {
  switch (metric) {
    case "earlyDeaths":
      return Math.max(0, Math.floor(value));
    case "objectivePresence":
      return Math.min(1, Math.round(value * 10) / 10);
    case "gold15":
      return Math.round(value / 50) * 50;
    default:
      return Math.round(value);
  }
}

export function meetsTarget(metric: MetricKey, value: number, target: number): boolean {
  return LOWER_IS_BETTER.has(metric) ? value <= target : value >= target;
}

export interface GoalChoice {
  metric: MetricKey;
  target: number;
  basedOnTier: Tier;
}

/** Benchmark samples needed before a goal is derived from it. */
export const MIN_SAMPLES_FOR_GOAL = 100;

/**
 * Picks the metric with the largest gap to the next-tier benchmark. Without a
 * sufficiently sampled benchmark there is no goal: comparing the player only
 * with themself cannot tell which metric matters most.
 */
export function chooseGoal(
  recentMainRole: MatchReview[],
  benchmark: Benchmark | undefined,
  tier: Tier,
): GoalChoice | undefined {
  if (recentMainRole.length === 0 || !benchmark || benchmark.sampleSize < MIN_SAMPLES_FOR_GOAL) {
    return undefined;
  }
  const metrics: MetricKey[] = ["cs10", "earlyDeaths", "gold15", "objectivePresence"];
  let best: { metric: MetricKey; gap: number; target: number } | undefined;
  for (const metric of metrics) {
    const mine = average(recentMainRole, metric);
    const reference = benchmark[metric];
    const gap = gapInUnits(metric, mine, reference);
    if (!best || gap > best.gap) best = { metric, gap, target: reference };
  }
  if (!best) return undefined;
  return { metric: best.metric, target: roundTarget(best.metric, best.target), basedOnTier: tier };
}

export function templateGoalText(choice: GoalChoice): string {
  const label = METRIC_LABEL[choice.metric];
  const target =
    choice.metric === "objectivePresence" ? `${Math.round(choice.target * 100)}%` : String(choice.target);
  return LOWER_IS_BETTER.has(choice.metric)
    ? `Next ${BLOCK_SIZE} games: at most ${target} ${label} per game.`
    : `Next ${BLOCK_SIZE} games: ${label} of at least ${target} per game.`;
}

export function newGoal(choice: GoalChoice, text: string, now: number, repeatOf?: TrainingGoal): TrainingGoal {
  return {
    id: `goal_${now}`,
    metric: choice.metric,
    target: choice.target,
    text,
    basedOnTier: choice.basedOnTier,
    matchIds: [],
    results: [],
    status: repeatOf ? "repeat" : "active",
    createdAt: now,
  };
}

/** Adds matches played after the goal was set, oldest first, until the block is full. */
export function recordMatches(goal: TrainingGoal, matchesNewestFirst: MatchReview[]): TrainingGoal {
  const updated = { ...goal, matchIds: [...goal.matchIds], results: [...goal.results] };
  const candidates = [...matchesNewestFirst]
    .reverse()
    .filter((m) => m.gameStart >= goal.createdAt && !updated.matchIds.includes(m.matchId));
  for (const m of candidates) {
    if (updated.matchIds.length >= BLOCK_SIZE) break;
    updated.matchIds.push(m.matchId);
    updated.results.push(meetsTarget(goal.metric, metricValue(m, goal.metric), goal.target));
  }
  return updated;
}

export function isBlockComplete(goal: TrainingGoal): boolean {
  return goal.matchIds.length >= BLOCK_SIZE;
}

export function blockPassed(goal: TrainingGoal): boolean {
  return goal.results.filter(Boolean).length >= BLOCK_PASS_COUNT;
}

export { CURRENT_LEVEL_WINDOW };
