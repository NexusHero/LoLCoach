import type { BriefingPoint, MatchReview, MatchupBriefing } from "./analysisTypes.js";

/** Live Client names ("Kai'Sa") and match-v5 names ("Kaisa") differ in punctuation. */
export function normalizeChampion(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function shortDate(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

/** Newest stored review of this exact champion pairing. */
export function lastMatchInMatchup(
  matchesNewestFirst: MatchReview[],
  myChampion: string,
  opponentChampion: string,
): MatchReview | undefined {
  const me = normalizeChampion(myChampion);
  const opp = normalizeChampion(opponentChampion);
  return matchesNewestFirst.find(
    (m) => normalizeChampion(m.champion) === me && normalizeChampion(m.opponentChampion ?? "") === opp,
  );
}

/**
 * Fact line about the last game in this matchup, built from stored numbers
 * only, plus the saved matchup insight when there is one.
 */
export function historyPoint(
  last: MatchReview | undefined,
  opponentChampion: string,
  insight?: string,
): BriefingPoint {
  if (!last) {
    return {
      kind: "history",
      text: insight
        ? `First reviewed game against ${opponentChampion}. Saved note: ${insight}`
        : `No reviewed game against ${opponentChampion} yet.`,
    };
  }
  const deaths = last.earlyDeaths.length;
  const deathText =
    deaths === 0
      ? "no deaths before 14:00"
      : `${deaths} death${deaths > 1 ? "s" : ""} before 14:00 (${last.earlyDeaths[0].zone})`;
  const facts = `Last time (${last.win ? "win" : "loss"}, ${shortDate(last.gameStart)}): CS ${signed(last.csDiff10)} at 10:00, gold ${signed(last.goldDiff15)} at 15:00, ${deathText}.`;
  return { kind: "history", text: insight ? `${facts} Note: ${insight}` : facts };
}

export const BRIEFING_SYSTEM = `You prepare a League of Legends player for the lane they are about to play.
Give matchup FACTS, not commands: describe how the matchup tends to play out; never say "do X now".
Never mention cooldown timers or claim anything about the current game state.
Reply ONLY with JSON: {"trading": "max 20 words: how trades in this matchup usually go and which abilities decide them", "spike": "max 20 words: the opponent's most dangerous power spike (level or item) in this matchup"}`;

export function briefingPrompt(args: {
  myChampion: string;
  myAbilities?: string;
  opponentChampion: string;
  opponentAbilities?: string;
  role: string;
  rank?: string;
}): string {
  return [
    `Role: ${args.role}`,
    args.rank ? `Player rank: ${args.rank}` : "",
    `My champion: ${args.myChampion}${args.myAbilities ? ` (${args.myAbilities})` : ""}`,
    `Lane opponent: ${args.opponentChampion}${args.opponentAbilities ? ` (${args.opponentAbilities})` : ""}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Parses the LLM reply; returns no points when it is not the expected JSON. */
export function parseBriefingReply(raw: string | undefined): BriefingPoint[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw.replace(/```(?:json)?/g, "").trim()) as { trading?: unknown; spike?: unknown };
    const points: BriefingPoint[] = [];
    if (typeof parsed.trading === "string" && parsed.trading.trim()) {
      points.push({ kind: "trading", text: parsed.trading.trim() });
    }
    if (typeof parsed.spike === "string" && parsed.spike.trim()) {
      points.push({ kind: "spike", text: parsed.spike.trim() });
    }
    return points;
  } catch {
    return [];
  }
}

export function assembleBriefing(
  myChampion: string,
  opponentChampion: string,
  role: string,
  llmPoints: BriefingPoint[],
  history: BriefingPoint,
  now: number,
): MatchupBriefing {
  return {
    myChampion,
    opponentChampion,
    role,
    points: [...llmPoints, history],
    createdAt: now,
  };
}
