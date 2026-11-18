import { Logger } from "./logger.js";

/** Platform (e.g. euw1) and regional (e.g. europe) routing for a region code. */
export const REGION_ROUTING: Record<string, { platform: string; regional: string }> = {
  EUW: { platform: "euw1", regional: "europe" },
  EUNE: { platform: "eun1", regional: "europe" },
  TR: { platform: "tr1", regional: "europe" },
  RU: { platform: "ru", regional: "europe" },
  NA: { platform: "na1", regional: "americas" },
  BR: { platform: "br1", regional: "americas" },
  LAN: { platform: "la1", regional: "americas" },
  LAS: { platform: "la2", regional: "americas" },
  KR: { platform: "kr", regional: "asia" },
  JP: { platform: "jp1", regional: "asia" },
  OCE: { platform: "oc1", regional: "sea" },
};

export const RANKED_SOLO_QUEUE = 420;

export class RiotApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RiotApiError";
  }

  /** 401/403: the key is missing, invalid or (for development keys) expired. */
  get isKeyProblem(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

export type Fetcher = (url: string, init: { headers: Record<string, string> }) => Promise<{
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}>;

interface RateWindow {
  limit: number;
  windowMs: number;
}

/** Development / personal key limits: 20 per second and 100 per two minutes. */
const DEFAULT_WINDOWS: RateWindow[] = [
  { limit: 20, windowMs: 1_000 },
  { limit: 100, windowMs: 120_000 },
];

const MAX_RETRIES = 3;

/**
 * Sliding-window limiter shared by all calls of one key. Requests wait until
 * every window has room, so long backfills never trip a 429.
 */
export class RateLimiter {
  private readonly sent: number[] = [];

  constructor(
    private readonly windows: RateWindow[] = DEFAULT_WINDOWS,
    private readonly now: () => number = Date.now,
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  /** Milliseconds until another request may be sent. */
  delayNeeded(): number {
    const t = this.now();
    let wait = 0;
    for (const w of this.windows) {
      const inWindow = this.sent.filter((s) => t - s < w.windowMs);
      if (inWindow.length >= w.limit) {
        const oldest = inWindow[inWindow.length - w.limit];
        wait = Math.max(wait, oldest + w.windowMs - t + 5);
      }
    }
    return wait;
  }

  async acquire(): Promise<void> {
    for (let wait = this.delayNeeded(); wait > 0; wait = this.delayNeeded()) {
      await this.sleep(wait);
    }
    this.sent.push(this.now());
    const longest = Math.max(...this.windows.map((w) => w.windowMs));
    while (this.sent.length > 0 && this.now() - this.sent[0] > longest) this.sent.shift();
  }

  async pause(ms: number): Promise<void> {
    await this.sleep(ms);
  }
}

export interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

export interface LeagueEntry {
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  puuid?: string;
}

/** Thin client for the Riot endpoints the review and aggregation need. */
export class RiotApiClient {
  private readonly platformHost: string;
  private readonly regionalHost: string;

  constructor(
    private readonly apiKey: string,
    region: string,
    private readonly limiter: RateLimiter = new RateLimiter(),
    private readonly fetcher: Fetcher = globalThis.fetch as unknown as Fetcher,
  ) {
    const routing = REGION_ROUTING[region.toUpperCase()];
    if (!routing) throw new Error(`Unknown region: ${region}`);
    this.platformHost = `https://${routing.platform}.api.riotgames.com`;
    this.regionalHost = `https://${routing.regional}.api.riotgames.com`;
  }

  private async get<T>(url: string, attempt = 0): Promise<T> {
    await this.limiter.acquire();
    const res = await this.fetcher(url, { headers: { "X-Riot-Token": this.apiKey } });
    if (res.status === 429 || res.status >= 500) {
      if (attempt >= MAX_RETRIES) throw new RiotApiError(`Riot API ${res.status} after retries`, res.status);
      const retryAfterSec = Number(res.headers.get("retry-after") ?? "0");
      const backoffMs = Math.max(retryAfterSec * 1000, 1000 * 2 ** attempt);
      Logger.warn(`[Riot] ${res.status}, retrying in ${backoffMs} ms`);
      await this.limiter.pause(backoffMs);
      return this.get<T>(url, attempt + 1);
    }
    if (res.status !== 200) {
      throw new RiotApiError(`Riot API ${res.status} for ${new URL(url).pathname}`, res.status);
    }
    return (await res.json()) as T;
  }

  accountByRiotId(gameName: string, tagLine: string): Promise<RiotAccount> {
    const path = `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    return this.get<RiotAccount>(this.regionalHost + path);
  }

  leagueEntriesByPuuid(puuid: string): Promise<LeagueEntry[]> {
    return this.get<LeagueEntry[]>(`${this.platformHost}/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`);
  }

  matchIdsByPuuid(puuid: string, count: number, queue = RANKED_SOLO_QUEUE): Promise<string[]> {
    const url = `${this.regionalHost}/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?queue=${queue}&start=0&count=${count}`;
    return this.get<string[]>(url);
  }

  match(matchId: string): Promise<RiotMatch> {
    return this.get<RiotMatch>(`${this.regionalHost}/lol/match/v5/matches/${encodeURIComponent(matchId)}`);
  }

  timeline(matchId: string): Promise<RiotTimeline> {
    return this.get<RiotTimeline>(`${this.regionalHost}/lol/match/v5/matches/${encodeURIComponent(matchId)}/timeline`);
  }

  /** Apex tiers come as one league; lower tiers are paginated per division. */
  async ladderPuuids(tier: string, page = 1): Promise<string[]> {
    const queue = "RANKED_SOLO_5x5";
    const apex: Record<string, string> = {
      CHALLENGER: "challengerleagues",
      GRANDMASTER: "grandmasterleagues",
      MASTER: "masterleagues",
    };
    if (apex[tier]) {
      if (page > 1) return [];
      const league = await this.get<{ entries: Array<{ puuid?: string }> }>(
        `${this.platformHost}/lol/league/v4/${apex[tier]}/by-queue/${queue}`,
      );
      return league.entries.map((e) => e.puuid).filter((p): p is string => typeof p === "string");
    }
    const entries = await this.get<LeagueEntry[]>(
      `${this.platformHost}/lol/league/v4/entries/${queue}/${tier}/I?page=${page}`,
    );
    return entries.map((e) => e.puuid).filter((p): p is string => typeof p === "string");
  }
}

// --- Minimal shapes of the match-v5 payloads we read ---

export interface RiotParticipant {
  participantId: number;
  puuid: string;
  teamId: number;
  teamPosition: string;
  championName: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
}

export interface RiotMatch {
  metadata: { matchId: string; participants: string[] };
  info: {
    gameCreation: number;
    gameStartTimestamp?: number;
    gameDuration: number;
    gameVersion: string;
    queueId: number;
    participants: RiotParticipant[];
  };
}

export interface RiotTimelineEvent {
  type: string;
  timestamp: number;
  participantId?: number;
  killerId?: number;
  victimId?: number;
  assistingParticipantIds?: number[];
  position?: { x: number; y: number };
  itemId?: number;
  monsterType?: string;
  monsterSubType?: string;
  killerTeamId?: number;
}

export interface RiotParticipantFrame {
  participantId: number;
  currentGold: number;
  totalGold: number;
  xp: number;
  minionsKilled: number;
  jungleMinionsKilled: number;
  position?: { x: number; y: number };
}

export interface RiotTimeline {
  info: {
    frameInterval: number;
    frames: Array<{
      timestamp: number;
      participantFrames: Record<string, RiotParticipantFrame>;
      events: RiotTimelineEvent[];
    }>;
    participants?: Array<{ participantId: number; puuid: string }>;
  };
}
