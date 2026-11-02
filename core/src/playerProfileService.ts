import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";
import type {
  ParsedGameState,
  PlayerHabitProfile,
  PostGameAutopsy,
  RolePosition,
} from "./types.js";

const PROFILE_DIR =
  process.platform === "win32"
    ? join(process.env.LOCALAPPDATA ?? tmpdir(), "lolcoach")
    : join(homedir(), ".cache", "lolcoach");

const PROFILE_FILE = join(PROFILE_DIR, "player_profile.json");

interface StoredProfileData {
  gamesTracked: number;
  totalCsPerMin: number;
  totalEarlyDeaths: number;
  totalHighGoldDeaths: number;
  lastAutopsy?: PostGameAutopsy;
}

export function getRoleTargetCsPerMin(role: RolePosition): number {
  switch (role) {
    case "UTILITY":
      return 1.2;
    case "JUNGLE":
      return 6.5;
    case "TOP":
    case "MIDDLE":
    case "MID":
    case "BOTTOM":
    default:
      return 8.0;
  }
}

export function computeLiveCsPerMin(state: ParsedGameState): number {
  if (state.gameTime < 90) return 0;
  const minutes = state.gameTime / 60;
  return Number((state.localPlayer.scores.creepScore / minutes).toFixed(1));
}

export class PlayerProfileService {
  private stored: StoredProfileData = {
    gamesTracked: 0,
    totalCsPerMin: 0,
    totalEarlyDeaths: 0,
    totalHighGoldDeaths: 0,
  };

  private lastState: ParsedGameState | null = null;
  private highGoldSinceGameTime: number | null = null;
  private earlyDeathsThisGame = 0;
  private highGoldDeathsThisGame = 0;
  private loaded = false;
  private readonly persistToDisk: boolean;

  constructor(persistToDisk: boolean = process.env.NODE_ENV !== "test") {
    this.persistToDisk = persistToDisk;
  }

  async load(): Promise<void> {
    if (this.loaded || !this.persistToDisk) return;
    this.loaded = true;
    try {
      const raw = await readFile(PROFILE_FILE, "utf-8");
      const parsed = JSON.parse(raw) as Partial<StoredProfileData>;
      this.stored = {
        gamesTracked: parsed.gamesTracked ?? 0,
        totalCsPerMin: parsed.totalCsPerMin ?? 0,
        totalEarlyDeaths: parsed.totalEarlyDeaths ?? 0,
        totalHighGoldDeaths: parsed.totalHighGoldDeaths ?? 0,
        ...(parsed.lastAutopsy ? { lastAutopsy: parsed.lastAutopsy } : {}),
      };
    } catch {
      // Fresh profile on first run
    }
  }

  private async save(): Promise<void> {
    if (!this.persistToDisk) return;
    try {
      await mkdir(PROFILE_DIR, { recursive: true });
      await writeFile(PROFILE_FILE, JSON.stringify(this.stored, null, 2), "utf-8");
    } catch {
      // Ignore disk errors in sandboxed/test environments
    }
  }

  /**
   * Updates live session telemetry on every game poll tick and returns
   * how many seconds the player has been hoarding >= 1400g.
   */
  observeTick(state: ParsedGameState): { goldHoardingSeconds: number; csPerMin: number; targetCsPerMin: number } {
    const prev = this.lastState;
    const gold = state.activePlayer.currentGold;
    const justDied = prev && !prev.localPlayer.isDead && state.localPlayer.isDead;

    if (justDied) {
      if (state.gameTime < 360) {
        this.earlyDeathsThisGame++;
      }
      if (gold >= 1400) {
        this.highGoldDeathsThisGame++;
      }
    }

    if (gold >= 1400 && !state.localPlayer.isDead) {
      if (this.highGoldSinceGameTime === null) {
        this.highGoldSinceGameTime = state.gameTime;
      }
    } else {
      this.highGoldSinceGameTime = null;
    }

    this.lastState = state;

    const goldHoardingSeconds =
      this.highGoldSinceGameTime !== null
        ? Math.max(0, state.gameTime - this.highGoldSinceGameTime)
        : 0;

    const role = (state.localPlayer.position || "UNKNOWN") as RolePosition;
    const csPerMin = computeLiveCsPerMin(state);
    const targetCsPerMin = getRoleTargetCsPerMin(role);

    return { goldHoardingSeconds, csPerMin, targetCsPerMin };
  }

  /**
   * Generates a Post-Game Autopsy Card when a match ends and updates long-term habits.
   */
  finalizeMatch(timestamp: number = Date.now()): PostGameAutopsy | undefined {
    const state = this.lastState;
    if (!state) return undefined;

    const me = state.localPlayer;
    const role = (me.position || "MID") as RolePosition;
    const durationMinutes = Math.max(1, Math.round(state.gameTime / 60));
    const csPerMin = computeLiveCsPerMin(state);
    const targetCsPerMin = getRoleTargetCsPerMin(role);
    const kda = `${me.scores.kills}/${me.scores.deaths}/${me.scores.assists}`;

    // Determine praise
    let praise = `Solid KDA (${kda}) on ${me.championName}.`;
    if (role !== "UTILITY" && csPerMin >= targetCsPerMin) {
      praise = `Challenger-level CS tempo (${csPerMin} CS/m vs ${targetCsPerMin} target).`;
    } else if (this.earlyDeathsThisGame === 0 && me.scores.deaths <= 2) {
      praise = `High lane discipline — 0 early deaths before 6:00 and clean survival (${kda}).`;
    } else if (me.scores.kills + me.scores.assists >= 8) {
      praise = `High map impact with ${me.scores.kills} kills and ${me.scores.assists} assists.`;
    }

    // Determine top 2 mistakes
    const mistakes: string[] = [];
    if (this.earlyDeathsThisGame > 0) {
      mistakes.push(
        `Died ${this.earlyDeathsThisGame}x before 6:00 — ward river at 2:55 and respect early jungle clear.`,
      );
    }
    if (this.highGoldDeathsThisGame > 0) {
      mistakes.push(
        `Died ${this.highGoldDeathsThisGame}x while hoarding >=1400g — crash wave and recall on item spikes.`,
      );
    }
    if (role !== "UTILITY" && csPerMin < targetCsPerMin - 1.2 && state.gameTime >= 300) {
      mistakes.push(
        `CS tempo below benchmark (${csPerMin} vs ${targetCsPerMin} CS/m) — catch side waves before grouping.`,
      );
    }
    if (me.scores.deaths >= 5 && mistakes.length < 2) {
      mistakes.push(
        `High death count (${me.scores.deaths} deaths) — avoid fighting when outnumbered or without vision.`,
      );
    }
    if (mistakes.length === 0) {
      mistakes.push("Keep tracking enemy summoner spells and arriving 45s early to Dragon/Baron.");
    }

    const autopsy: PostGameAutopsy = {
      championName: me.championName,
      role: role || "MID",
      durationMinutes,
      kda,
      csPerMin,
      targetCsPerMin,
      praise,
      mistakes: mistakes.slice(0, 2),
      timestamp,
    };

    // Update persistent stats
    this.stored.gamesTracked += 1;
    this.stored.totalCsPerMin += csPerMin;
    this.stored.totalEarlyDeaths += this.earlyDeathsThisGame;
    this.stored.totalHighGoldDeaths += this.highGoldDeathsThisGame;
    this.stored.lastAutopsy = autopsy;
    this.save().catch(() => {});

    this.resetMatchState();
    return autopsy;
  }

  resetMatchState(): void {
    this.lastState = null;
    this.highGoldSinceGameTime = null;
    this.earlyDeathsThisGame = 0;
    this.highGoldDeathsThisGame = 0;
  }

  getProfile(): PlayerHabitProfile {
    const games = Math.max(1, this.stored.gamesTracked);
    const avgCsPerMin =
      this.stored.gamesTracked > 0
        ? Number((this.stored.totalCsPerMin / games).toFixed(1))
        : 0;
    const earlyDeathRate =
      this.stored.gamesTracked > 0
        ? Number((this.stored.totalEarlyDeaths / games).toFixed(1))
        : 0;
    const highGoldDeathRate =
      this.stored.gamesTracked > 0
        ? Number((this.stored.totalHighGoldDeaths / games).toFixed(1))
        : 0;

    const habitWarnings: string[] = [];
    if (earlyDeathRate >= 0.8 || this.earlyDeathsThisGame > 0) {
      habitWarnings.push(
        "Player habit: prone to early deaths (<6m) — emphasize wave safety & 3:15 jungle gank timer.",
      );
    }
    if (highGoldDeathRate >= 0.6 || this.highGoldDeathsThisGame > 0) {
      habitWarnings.push(
        "Player habit: tends to overstay with >1400g — remind to reset immediately for component spike.",
      );
    }
    if (this.stored.gamesTracked >= 2 && avgCsPerMin > 0 && avgCsPerMin < 6.2) {
      habitWarnings.push(
        `Player habit: historical CS avg is ${avgCsPerMin}/m — prioritize catching side waves before mid ARAM.`,
      );
    }

    return {
      gamesTracked: this.stored.gamesTracked,
      avgCsPerMin,
      earlyDeathRate,
      highGoldDeathRate,
      habitWarnings,
      ...(this.stored.lastAutopsy ? { lastAutopsy: this.stored.lastAutopsy } : {}),
    };
  }
}
