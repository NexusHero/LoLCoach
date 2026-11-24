import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { MatchReview, MetricKey, Tier, TrainingGoal } from "./analysisTypes.js";

export const ANALYSIS_DIR =
  process.env.NODE_ENV === "test"
    ? join(tmpdir(), "lolcoach-test", "analysis")
    : join(homedir(), ".lolcoach", "analysis");

export interface AnalysisConfig {
  riotId?: string;
  region: string;
  puuid?: string;
}

/** Running sums of one tier's benchmark collection. */
export interface TierAggregate {
  tier: Tier;
  role: string;
  patch: string;
  samples: number;
  sums: { cs10: number; earlyDeaths: number; gold15: number; objectivePresence: number };
  /** Fixed-bin histograms per metric (see HISTOGRAM_BINS); absent in aggregates from older versions. */
  histograms?: Partial<Record<MetricKey, number[]>>;
  /** Matches already counted, so a restart never counts a game twice. */
  seenMatchIds: string[];
  /** Index of the next ladder player to sample. */
  playerCursor: number;
  ladderPage: number;
}

export interface AnalysisState {
  goals: TrainingGoal[];
  backfillSummary?: string;
  aggregates: TierAggregate[];
}

const DEFAULT_STATE: AnalysisState = { goals: [], aggregates: [] };

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

/**
 * Local persistence under ~/.lolcoach/analysis: one JSON file per reviewed
 * match plus small config and state files. Only aggregates of other players'
 * games are stored, never their individual matches.
 */
export class AnalysisStore {
  private readonly matchesDir: string;

  constructor(private readonly dir: string = ANALYSIS_DIR) {
    this.matchesDir = join(dir, "matches");
  }

  private async ensureDirs(): Promise<void> {
    await mkdir(this.matchesDir, { recursive: true });
  }

  loadConfig(): Promise<AnalysisConfig> {
    return readJson<AnalysisConfig>(join(this.dir, "config.json"), { region: "EUW" });
  }

  async saveConfig(config: AnalysisConfig): Promise<void> {
    await this.ensureDirs();
    await writeFile(join(this.dir, "config.json"), JSON.stringify(config, null, 2));
  }

  async loadState(): Promise<AnalysisState> {
    return { ...DEFAULT_STATE, ...(await readJson<Partial<AnalysisState>>(join(this.dir, "state.json"), {})) };
  }

  async saveState(state: AnalysisState): Promise<void> {
    await this.ensureDirs();
    await writeFile(join(this.dir, "state.json"), JSON.stringify(state));
  }

  async saveMatch(review: MatchReview): Promise<void> {
    await this.ensureDirs();
    const safeId = review.matchId.replace(/[^A-Za-z0-9_]/g, "");
    await writeFile(join(this.matchesDir, `${safeId}.json`), JSON.stringify(review));
  }

  /** All stored reviews, newest first. */
  async loadMatches(): Promise<MatchReview[]> {
    let files: string[];
    try {
      files = await readdir(this.matchesDir);
    } catch {
      return [];
    }
    const reviews = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map((f) => readJson<MatchReview | null>(join(this.matchesDir, f), null)),
    );
    return reviews
      .filter((r): r is MatchReview => r !== null)
      .sort((a, b) => b.gameStart - a.gameStart);
  }

  /** Clears personal data when the Riot ID changes. */
  async resetPersonalData(): Promise<void> {
    await rm(this.matchesDir, { recursive: true, force: true });
    const state = await this.loadState();
    await this.saveState({ ...state, goals: [], backfillSummary: undefined });
  }
}
