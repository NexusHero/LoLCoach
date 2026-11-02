import type {
  ParsedGameState,
  Player,
  LiveTacticalOverrides,
  CoachExchange,
  RiskLevel,
  BuildFocus,
  RolePosition,
} from "./types.js";
import { computeEnemyCooldowns, findLaneOpponent } from "./tacticalAnalyzer.js";
import { computeSummonerSpellCooldown } from "./tacticalCatalog.js";
import { VectorMemoryService } from "./vectorMemoryService.js";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export interface CommandExecutionResult {
  exchange: CoachExchange;
  shouldReevaluate: boolean;
}

export class TacticalCommandService {
  private overrides: LiveTacticalOverrides = {
    enemyBuildOverrides: {},
    tacticalNotes: [],
    activeTimers: [],
  };
  private exchangeCounter = 0;
  private lastExchange: CoachExchange | undefined;

  constructor(private readonly vectorMemory: VectorMemoryService) {}

  getOverrides(currentGameTime = 0): LiveTacticalOverrides {
    this.pruneExpiredTimers(currentGameTime);
    return {
      ...(this.overrides.laneOpponentOverride
        ? { laneOpponentOverride: this.overrides.laneOpponentOverride }
        : {}),
      ...(this.overrides.campedStatus && this.overrides.campedStatus !== "normal"
        ? { campedStatus: this.overrides.campedStatus }
        : {}),
      enemyBuildOverrides: { ...this.overrides.enemyBuildOverrides },
      tacticalNotes: [...this.overrides.tacticalNotes],
      activeTimers: this.overrides.activeTimers.map((t) => ({
        ...t,
        remainingSeconds:
          currentGameTime > 0
            ? Math.max(0, Math.round(t.expiresAtGameTime - currentGameTime))
            : t.remainingSeconds,
      })),
    };
  }

  getLastExchange(): CoachExchange | undefined {
    return this.lastExchange;
  }

  resetMatch(): void {
    this.overrides = {
      enemyBuildOverrides: {},
      tacticalNotes: [],
      activeTimers: [],
    };
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
      const champ = key.slice("enemyBuild:".length);
      delete this.overrides.enemyBuildOverrides[champ];
      return true;
    }
    if (key.startsWith("note:")) {
      const noteText = key.slice("note:".length);
      this.overrides.tacticalNotes = this.overrides.tacticalNotes.filter((n) => n !== noteText);
      return true;
    }
    if (key.startsWith("timer:")) {
      const timerKey = key.slice("timer:".length);
      this.overrides.activeTimers = this.overrides.activeTimers.filter((t) => t.key !== timerKey);
      return true;
    }
    if (key === "all") {
      this.resetMatch();
      return true;
    }
    return false;
  }

  private pruneExpiredTimers(currentGameTime: number): void {
    if (currentGameTime <= 0) return;
    this.overrides.activeTimers = this.overrides.activeTimers.filter(
      (t) => t.expiresAtGameTime > currentGameTime,
    );
  }

  private findMatchingEnemy(text: string, state: ParsedGameState | null): Player | undefined {
    if (!state) return undefined;
    const normText = normalize(text);
    for (const enemy of state.enemies) {
      const normChamp = normalize(enemy.championName);
      if (normChamp.length >= 3 && normText.includes(normChamp)) {
        return enemy;
      }
    }
    return undefined;
  }

  private computeEnemySummonerHaste(opp: Player): number {
    let haste = 0;
    if (opp.items.some((i) => i.itemID === 3158)) haste += 10;
    const p = opp.runes?.primaryRuneTree?.displayName ?? "";
    const s = opp.runes?.secondaryRuneTree?.displayName ?? "";
    if (p.includes("Inspiration") || s.includes("Inspiration")) haste += 18;
    return haste;
  }

  async executeCommand(
    rawText: string,
    state: ParsedGameState | null,
    clock: () => number = Date.now,
  ): Promise<CommandExecutionResult> {
    const text = rawText.trim();
    const lower = text.toLowerCase();
    const actions: string[] = [];
    const uiMutation: NonNullable<CoachExchange["uiMutation"]> = {};
    let shouldReevaluate = false;
    let replyParts: string[] = [];

    const myPos = (state?.localPlayer.position || "UNKNOWN") as RolePosition;
    const currentOpp = state
      ? findLaneOpponent(state, myPos, this.overrides.laneOpponentOverride)
      : undefined;
    const namedEnemy = this.findMatchingEnemy(text, state);

    // 1. Check Vector Memory Save ("Merk dir ...", "Remember ...")
    const rememberMatch = text.match(/^(?:merk\s+dir|remember|notiere)[:\s]+(.+)$/i);
    if (rememberMatch) {
      const note = rememberMatch[1].trim();
      const myChamp = state?.localPlayer.championName ?? "General";
      const oppChamp = namedEnemy?.championName ?? currentOpp?.championName;
      await this.vectorMemory.storeMatchupNote(myChamp, note, oppChamp, clock());
      actions.push(`🧠 Memory: ${oppChamp ?? myChamp}`);
      replyParts.push(`Gespeichert im Vektor-Gedächtnis für ${myChamp}${oppChamp ? ` vs ${oppChamp}` : ""}.`);
    }

    // 2. Check Spell / Summoner Cooldown Callout ("Ahri Flash", "Zed Ult", "Flash down", "Blitz Q")
    const spellMatch = lower.match(
      /\b(flash|ignite|teleport|tp|exhaust|ghost|cleanse|heal|barrier|smite|ult|ultimate|\br\b|\bq\b|\bw\b|\be\b)\b/,
    );
    const isQuestion = lower.includes("?") || /^(wie|warum|was|wann|soll|kann|who|what|why|how|should|can)\b/.test(lower);

    if (spellMatch && (!isQuestion || /\b(timer|cd|down|weg|raus|used|benutzt|setz)\b/.test(lower))) {
      const targetEnemy = namedEnemy ?? currentOpp;
      if (targetEnemy && state) {
        const rawSpell = spellMatch[1];
        const gameTime = state.gameTime;
        let label = rawSpell.toUpperCase();
        let cdSec = 0;
        let slotKey = label;

        if (["q", "w", "e", "r", "ult", "ultimate"].includes(rawSpell)) {
          const slot = rawSpell.startsWith("u") ? "R" : rawSpell.toUpperCase();
          slotKey = slot;
          label = slot;
          const cds = await computeEnemyCooldowns(state, targetEnemy.championName);
          cdSec = slot === "Q" ? (cds?.q ?? 8) : slot === "W" ? (cds?.w ?? 14) : slot === "E" ? (cds?.e ?? 15) : (cds?.r ?? 100);
        } else {
          const spellName = rawSpell === "tp" ? "Teleport" : rawSpell;
          const haste = this.computeEnemySummonerHaste(targetEnemy);
          const parsed = computeSummonerSpellCooldown(spellName, targetEnemy.level, gameTime, haste);
          if (parsed) {
            label = parsed.name.toUpperCase();
            cdSec = parsed.cooldown;
            slotKey = `SUM_${parsed.name.toUpperCase()}`;
          }
        }

        if (cdSec > 0) {
          const timerKey = `${targetEnemy.championName}_${slotKey}`;
          this.overrides.activeTimers = this.overrides.activeTimers.filter((t) => t.key !== timerKey);
          this.overrides.activeTimers.push({
            key: timerKey,
            label,
            championName: targetEnemy.championName,
            remainingSeconds: cdSec,
            totalSeconds: cdSec,
            expiresAtGameTime: gameTime + cdSec,
          });
          actions.push(`⏱ ${targetEnemy.championName} ${label} (${cdSec}s)`);
          replyParts.push(`${targetEnemy.championName} ${label} Timer läuft (${cdSec}s) — Fenster ausnutzen!`);
        }
      }
    }

    // 3. Check Lane Swap Override ("Swap Vayne", "Lane gegen Vayne", "Vayne ist Top/Mid")
    if (/\b(swap|lane\s+gegen|spiele\s+gegen|vs\b|opponent|gegner\s+ist)\b/i.test(lower) && namedEnemy) {
      this.overrides.laneOpponentOverride = namedEnemy.championName;
      actions.push(`🔄 Lane → ${namedEnemy.championName}`);
      replyParts.push(`Matchup auf ${namedEnemy.championName} umgestellt — Cooldowns & Konter werden neu berechnet.`);
      shouldReevaluate = true;
    }

    // 4. Check Camped / Weakside Override
    if (/\b(camp|gecampt|camping|weakside|weak\s+side|2v1|3v1|dauernd\s+gegankt)\b/i.test(lower)) {
      const mode = lower.includes("weak") ? "weaksided" : "camped";
      this.overrides.campedStatus = mode;
      uiMutation.riskLevel = "safe";
      actions.push(`⛺ ${mode === "camped" ? "Camped" : "Weakside"} → Safe`);
      replyParts.push("Anti-Camp-Protokoll aktiv: Risiko auf Safe, Wave vor eigenem Turm halten.");
      shouldReevaluate = true;
    }

    // 5. Check Enemy Build Override ("Kai'Sa geht AP", "Varus AP", "Diana Tank")
    const buildOverrideMatch = lower.match(/\b(geht\s+auf|baut|ist\s+voll|buildet|playing|going)?\s*\b(ap|ad|tank)\b/i);
    if (buildOverrideMatch && namedEnemy && !/\b(ich|my|mein)\b/.test(lower)) {
      const style = buildOverrideMatch[2].toLowerCase() as "ad" | "ap" | "tank";
      this.overrides.enemyBuildOverrides[namedEnemy.championName] = style;
      actions.push(`🎯 ${namedEnemy.championName} → ${style.toUpperCase()}`);
      replyParts.push(`${namedEnemy.championName} als ${style.toUpperCase()}-Threat registriert — Resistenz-Empfehlung angepasst.`);
      shouldReevaluate = true;
    }

    // 6. Check App / HUD Mode Controls
    if (/\b(pro\s*mode|pro\s*hud|challenger\s*hud)\b/i.test(lower)) {
      const disable = /\b(aus|off|standard|normal)\b/i.test(lower);
      uiMutation.proMode = !disable;
      actions.push(`🖥️ ${disable ? "Standard HUD" : "PRO HUD"}`);
      replyParts.push(disable ? "Standard-HUD aktiviert." : "Challenger Pro HUD aktiviert.");
    }
    if (/\b(play\s+safe|safe\s+mode|spiel\s+safe|defensiv)\b/i.test(lower)) {
      uiMutation.riskLevel = "safe" as RiskLevel;
      actions.push("🛡️ Risk → Safe");
      shouldReevaluate = true;
    } else if (/\b(aggressive|aggressiv|risky|all\s*in)\b/i.test(lower)) {
      uiMutation.riskLevel = "risky" as RiskLevel;
      actions.push("⚔️ Risk → Risky");
      shouldReevaluate = true;
    }
    if (/\b(passive\s+items|nur\s+passive|keine\s+aktiven)\b/i.test(lower)) {
      uiMutation.preferPassiveItems = true;
      actions.push("🖱️ Passive Items ON");
      shouldReevaluate = true;
    }
    if (/\b(tank\s*shred|dps\s*build)\b/i.test(lower)) {
      uiMutation.buildFocus = "dps" as BuildFocus;
      actions.push("🎯 Focus → DPS");
      shouldReevaluate = true;
    } else if (/\b(burst\s*build|one\s*shot)\b/i.test(lower)) {
      uiMutation.buildFocus = "burst" as BuildFocus;
      actions.push("🎯 Focus → Burst");
      shouldReevaluate = true;
    } else if (/\b(bruiser|anti\s*burst)\b/i.test(lower)) {
      uiMutation.buildFocus = "bruiser" as BuildFocus;
      actions.push("🎯 Focus → Bruiser");
      shouldReevaluate = true;
    } else if (/\b(split\s*push|sidelane|1v1)\b/i.test(lower)) {
      uiMutation.buildFocus = "split" as BuildFocus;
      actions.push("🎯 Focus → Split");
      shouldReevaluate = true;
    }

    // 7. If the user shared non-trivial tactical info or asked a question, store note & query Vector RAG
    if (actions.length === 0 || isQuestion) {
      if (!isQuestion && text.length >= 8 && !rememberMatch) {
        this.overrides.tacticalNotes = [...this.overrides.tacticalNotes.slice(-3), text];
        actions.push("📌 Live-Fakt aktiv");
        shouldReevaluate = true;
      }

      const myChamp = state?.localPlayer.championName;
      const oppChamp = namedEnemy?.championName ?? currentOpp?.championName;
      const memories = await this.vectorMemory.searchRelevantMemories(text, myChamp, oppChamp, 2);

      if (memories.length > 0 && isQuestion) {
        actions.push("🧠 Vector-RAG Treffer");
      }

      if (replyParts.length === 0) {
        if (memories.length > 0) {
          replyParts.push(`Erinnerung: ${memories[0]}`);
        } else if (state && currentOpp) {
          const gold = Math.floor(state.activePlayer.currentGold);
          replyParts.push(
            `Verstanden (${state.localPlayer.championName} vs ${currentOpp.championName}, ${gold}g). Empfehlung wird mit deinem Callout aktualisiert.`,
          );
          shouldReevaluate = true;
        } else {
          replyParts.push("Verstanden — taktischer Kontext ist gespeichert.");
        }
      }
    }

    const hasUiMutation = Object.keys(uiMutation).length > 0;
    const exchange: CoachExchange = {
      id: `cmd_${++this.exchangeCounter}`,
      userText: text,
      replyText: replyParts.join(" "),
      actionsExecuted: actions,
      ...(hasUiMutation ? { uiMutation } : {}),
      timestamp: clock(),
    };

    this.lastExchange = exchange;
    return { exchange, shouldReevaluate };
  }
}
