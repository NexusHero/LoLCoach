import type {
  ParsedGameState,
  Player,
  LiveTacticalOverrides,
  CoachExchange,
  ReviewMarker,
  RiskLevel,
  BuildFocus,
  RolePosition,
} from "./types.js";
import { findLaneOpponent } from "./tacticalAnalyzer.js";
import { VectorMemoryService } from "./vectorMemoryService.js";

const MAX_REVIEW_MARKERS = 30;
const MIN_FREE_TEXT_MARKER_LENGTH = 8;

const REMEMBER_PATTERN = /\b(?:merk\s+dir|remember|notiere)[:\s]\s*(\S.*)$/i;
const MARKER_PATTERN = /\b(?:marker|markier\w*|mark|bookmark|clip)\b[:\s]*/i;
const QUESTION_PATTERN = /^(wie|warum|was|wann|soll|kann|who|what|why|how|should|can)\b/;
const LANE_SWAP_PATTERN = /\b(swap|lane\s+gegen|spiele\s+gegen|vs\b|opponent|gegner\s+ist)\b/i;
const CAMPED_PATTERN = /\b(camp|gecampt|camping|weakside|weak\s+side|2v1|3v1|dauernd\s+gegankt)\b/i;
const ENEMY_BUILD_PATTERN = /\b(ap|ad|tank)\b/i;
const PRO_HUD_PATTERN = /\b(pro\s*mode|pro\s*hud|challenger\s*hud)\b/i;
const PRO_HUD_OFF_PATTERN = /\b(aus|off|standard|normal)\b/i;
const PASSIVE_ITEMS_PATTERN = /\b(passive\s+items|nur\s+passive|keine\s+aktiven)\b/i;

const RISK_COMMANDS: ReadonlyArray<[RegExp, RiskLevel, string]> = [
  [/\b(play\s+safe|safe\s+mode|spiel\s+safe|defensiv)\b/i, "safe", "🛡️ Risk → Safe"],
  [/\b(aggressive|aggressiv|risky|all\s*in)\b/i, "risky", "⚔️ Risk → Risky"],
];

const BUILD_FOCUS_COMMANDS: ReadonlyArray<[RegExp, BuildFocus, string]> = [
  [/\b(tank\s*shred|dps\s*build)\b/i, "dps", "🎯 Focus → DPS"],
  [/\b(burst\s*build|one\s*shot)\b/i, "burst", "🎯 Focus → Burst"],
  [/\b(bruiser|anti\s*burst)\b/i, "bruiser", "🎯 Focus → Bruiser"],
  [/\b(split\s*push|sidelane|1v1)\b/i, "split", "🎯 Focus → Split"],
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatGameTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export interface CommandExecutionResult {
  exchange: CoachExchange;
  shouldReevaluate: boolean;
}

/** Mutable result that the individual command handlers contribute to. */
interface CommandContext {
  text: string;
  lower: string;
  state: ParsedGameState | null;
  namedEnemy: Player | undefined;
  currentOpp: Player | undefined;
  isQuestion: boolean;
  actions: string[];
  replyParts: string[];
  uiMutation: NonNullable<CoachExchange["uiMutation"]>;
  shouldReevaluate: boolean;
}

/**
 * Interprets typed or spoken coach commands. It records the player's own
 * corrections (lane opponent, enemy build path, item preferences), saves
 * matchup notes, and sets review markers for the post-game review. It never
 * tracks enemy cooldowns — Riot's third-party policy forbids that.
 */
export class TacticalCommandService {
  private overrides: LiveTacticalOverrides = { enemyBuildOverrides: {} };
  private reviewMarkers: ReviewMarker[] = [];
  private markerCounter = 0;
  private exchangeCounter = 0;
  private lastExchange: CoachExchange | undefined;

  constructor(private readonly vectorMemory: VectorMemoryService) {}

  getOverrides(): LiveTacticalOverrides {
    return {
      ...(this.overrides.laneOpponentOverride
        ? { laneOpponentOverride: this.overrides.laneOpponentOverride }
        : {}),
      ...(this.overrides.campedStatus && this.overrides.campedStatus !== "normal"
        ? { campedStatus: this.overrides.campedStatus }
        : {}),
      enemyBuildOverrides: { ...this.overrides.enemyBuildOverrides },
    };
  }

  getReviewMarkers(): ReviewMarker[] {
    return this.reviewMarkers.map((m) => ({ ...m }));
  }

  getLastExchange(): CoachExchange | undefined {
    return this.lastExchange;
  }

  resetMatch(): void {
    this.overrides = { enemyBuildOverrides: {} };
    this.reviewMarkers = [];
    this.markerCounter = 0;
    this.lastExchange = undefined;
  }

  clearOverride(key: string): boolean {
    if (key === "laneOpponent") {
      delete this.overrides.laneOpponentOverride;
      return true;
    }
    if (key === "campedStatus") {
      delete this.overrides.campedStatus;
      return true;
    }
    if (key.startsWith("enemyBuild:")) {
      delete this.overrides.enemyBuildOverrides[key.slice("enemyBuild:".length)];
      return true;
    }
    if (key.startsWith("marker:")) {
      const markerId = key.slice("marker:".length);
      this.reviewMarkers = this.reviewMarkers.filter((m) => m.id !== markerId);
      return true;
    }
    if (key === "all") {
      this.resetMatch();
      return true;
    }
    return false;
  }

  private findMatchingEnemy(text: string, state: ParsedGameState | null): Player | undefined {
    if (!state) return undefined;
    const normText = normalize(text);
    return state.enemies.find((enemy) => {
      const normChamp = normalize(enemy.championName);
      return normChamp.length >= 3 && normText.includes(normChamp);
    });
  }

  private addReviewMarker(ctx: CommandContext, note: string): void {
    if (!ctx.state) {
      ctx.replyParts.push("Kein laufendes Spiel — Marker nicht gesetzt.");
      return;
    }
    const marker: ReviewMarker = {
      id: `m_${++this.markerCounter}`,
      gameTime: Math.floor(ctx.state.gameTime),
      note,
    };
    this.reviewMarkers = [...this.reviewMarkers, marker].slice(-MAX_REVIEW_MARKERS);
    const at = formatGameTime(marker.gameTime);
    ctx.actions.push(`📍 Marker ${at}`);
    ctx.replyParts.push(`Marker bei ${at} gesetzt — erscheint im Review nach dem Spiel.`);
  }

  private async applyRemember(ctx: CommandContext, clock: () => number): Promise<boolean> {
    const match = REMEMBER_PATTERN.exec(ctx.text);
    if (!match) return false;
    const note = match[1].trim();
    const myChamp = ctx.state?.localPlayer.championName ?? "General";
    const noteEnemy = this.findMatchingEnemy(note, ctx.state) ?? ctx.namedEnemy ?? ctx.currentOpp;
    const oppChamp = noteEnemy?.championName;
    await this.vectorMemory.storeMatchupNote(myChamp, note, oppChamp, clock());
    ctx.actions.push(`🧠 Memory: ${oppChamp ?? myChamp}`);
    ctx.replyParts.push(
      `Gespeichert im Vektor-Gedächtnis für ${myChamp}${oppChamp ? ` vs ${oppChamp}` : ""}.`,
    );
    return true;
  }

  private applyExplicitMarker(ctx: CommandContext): boolean {
    if (ctx.isQuestion || !MARKER_PATTERN.test(ctx.lower)) return false;
    this.addReviewMarker(ctx, ctx.text.replace(MARKER_PATTERN, "").trim());
    return true;
  }

  private applyLaneSwap(ctx: CommandContext): void {
    if (!ctx.namedEnemy || !LANE_SWAP_PATTERN.test(ctx.lower)) return;
    this.overrides.laneOpponentOverride = ctx.namedEnemy.championName;
    ctx.actions.push(`🔄 Lane → ${ctx.namedEnemy.championName}`);
    ctx.replyParts.push(
      `Matchup auf ${ctx.namedEnemy.championName} umgestellt — Item-Empfehlung wird neu berechnet.`,
    );
    ctx.shouldReevaluate = true;
  }

  private applyCampedStatus(ctx: CommandContext): void {
    if (!CAMPED_PATTERN.test(ctx.lower)) return;
    const mode = ctx.lower.includes("weak") ? "weaksided" : "camped";
    this.overrides.campedStatus = mode;
    ctx.uiMutation.riskLevel = "safe";
    ctx.actions.push(`⛺ ${mode === "camped" ? "Camped" : "Weakside"} → Safe`);
    ctx.replyParts.push("Vermerkt — Build-Stil auf Safe gestellt.");
    ctx.shouldReevaluate = true;
  }

  private applyEnemyBuildOverrides(ctx: CommandContext): void {
    for (const clause of ctx.text.split(/[,;.]+/)) {
      const match = ENEMY_BUILD_PATTERN.exec(clause);
      const enemy = this.findMatchingEnemy(clause, ctx.state);
      if (!match || !enemy) continue;
      const style = match[1].toLowerCase() as "ad" | "ap" | "tank";
      this.overrides.enemyBuildOverrides[enemy.championName] = style;
      ctx.actions.push(`🎯 ${enemy.championName} → ${style.toUpperCase()}`);
      ctx.replyParts.push(
        `${enemy.championName} als ${style.toUpperCase()}-Threat registriert — Resistenz-Empfehlung angepasst.`,
      );
      ctx.shouldReevaluate = true;
    }
  }

  private applyHudAndBuildControls(ctx: CommandContext): void {
    if (PRO_HUD_PATTERN.test(ctx.lower)) {
      const disable = PRO_HUD_OFF_PATTERN.test(ctx.lower);
      ctx.uiMutation.proMode = !disable;
      ctx.actions.push(`🖥️ ${disable ? "Standard HUD" : "PRO HUD"}`);
      ctx.replyParts.push(disable ? "Standard-HUD aktiviert." : "Challenger Pro HUD aktiviert.");
    }

    const risk = RISK_COMMANDS.find(([pattern]) => pattern.test(ctx.lower));
    if (risk) {
      ctx.uiMutation.riskLevel = risk[1];
      ctx.actions.push(risk[2]);
      ctx.shouldReevaluate = true;
    }

    if (PASSIVE_ITEMS_PATTERN.test(ctx.lower)) {
      ctx.uiMutation.preferPassiveItems = true;
      ctx.actions.push("🖱️ Passive Items ON");
      ctx.shouldReevaluate = true;
    }

    const focus = BUILD_FOCUS_COMMANDS.find(([pattern]) => pattern.test(ctx.lower));
    if (focus) {
      ctx.uiMutation.buildFocus = focus[1];
      ctx.actions.push(focus[2]);
      ctx.shouldReevaluate = true;
    }
  }

  /** Unrecognised statements become review markers; questions query the matchup memory. */
  private async applyFallback(ctx: CommandContext): Promise<void> {
    if (!ctx.isQuestion) {
      if (ctx.text.length >= MIN_FREE_TEXT_MARKER_LENGTH) {
        this.addReviewMarker(ctx, ctx.text);
      } else {
        ctx.replyParts.push("Nicht erkannt — bitte genauer formulieren.");
      }
      return;
    }

    const oppChamp = ctx.namedEnemy?.championName ?? ctx.currentOpp?.championName;
    const memories = await this.vectorMemory.searchRelevantMemories(
      ctx.text,
      ctx.state?.localPlayer.championName,
      oppChamp,
      2,
    );
    if (memories.length === 0) {
      ctx.replyParts.push("Dazu ist noch nichts im Matchup-Gedächtnis gespeichert.");
      return;
    }
    ctx.actions.push("🧠 Vector-RAG Treffer");
    ctx.replyParts.push(`Erinnerung: ${memories[0]}`);
  }

  async executeCommand(
    rawText: string,
    state: ParsedGameState | null,
    clock: () => number = Date.now,
  ): Promise<CommandExecutionResult> {
    const text = rawText.trim();
    const lower = text.toLowerCase();
    const myPos = (state?.localPlayer.position || "UNKNOWN") as RolePosition;
    const ctx: CommandContext = {
      text,
      lower,
      state,
      namedEnemy: this.findMatchingEnemy(text, state),
      currentOpp: state
        ? findLaneOpponent(state, myPos, this.overrides.laneOpponentOverride)
        : undefined,
      isQuestion: lower.includes("?") || QUESTION_PATTERN.test(lower),
      actions: [],
      replyParts: [],
      uiMutation: {},
      shouldReevaluate: false,
    };

    const handled =
      (await this.applyRemember(ctx, clock)) || this.applyExplicitMarker(ctx);
    if (!handled) {
      this.applyLaneSwap(ctx);
      this.applyCampedStatus(ctx);
      this.applyEnemyBuildOverrides(ctx);
      this.applyHudAndBuildControls(ctx);
      if (ctx.actions.length === 0) await this.applyFallback(ctx);
    }

    const hasUiMutation = Object.keys(ctx.uiMutation).length > 0;
    const exchange: CoachExchange = {
      id: `cmd_${++this.exchangeCounter}`,
      userText: text,
      replyText: ctx.replyParts.join(" "),
      actionsExecuted: ctx.actions,
      ...(hasUiMutation ? { uiMutation: ctx.uiMutation } : {}),
      timestamp: clock(),
    };

    this.lastExchange = exchange;
    return { exchange, shouldReevaluate: ctx.shouldReevaluate };
  }
}
