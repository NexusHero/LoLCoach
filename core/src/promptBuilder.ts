import type {
  ParsedGameState,
  RolePosition,
  RiskLevel,
  BuildFocus,
} from "./types.js";
import { DEFAULT_RISK_LEVEL, DEFAULT_BUILD_FOCUS } from "./types.js";
import { getGamePhase } from "./stateMinifier.js";
import { ddragon } from "./ddragonService.js";
import { computePrimaryThreat, computeTeamDamageProfile } from "./tacticalAnalyzer.js";
import { computeObjectives } from "./macroTracker.js";

export interface LlmContextOptions {
  buildFocus?: BuildFocus;
  preferPassiveItems?: boolean;
  habitWarnings?: string[];
}

export const SYSTEM_PROMPT = `You are an experienced League of Legends coach giving live in-game advice.
The player will glance at your output for a few seconds during a match, so every field must be SHORT and SCANNABLE.
Analyze the game state and respond ONLY with a JSON object — no markdown, no code blocks, no extra text.
Use this exact format:
{
  "itemReasoning": "1 short sentence (max ~15 words) on the recommended build direction for this champion vs this enemy comp",
  "situationalItems": [
    {"id": 3111, "name": "Mercury's Treads", "reason": "Max ~10 words on why this specific item fits right now"}
  ],
  "strategy": {
    "winCondition": "early" or "mid" or "late",
    "summary": "Max ~10 words: when and how the player wins this game",
    "immediateAction": "Max ~12 words: what to do RIGHT NOW, referencing their champion/stats",
    "lateGamePlan": "Max ~12 words: how to close out the game with the final build",
    "laneMatchupAnalysis": "Max ~15 words: the single most important matchup fact for this role",
    "counterPlay": "Max ~12 words: one concrete role-appropriate action to swing the matchup"
  }
}

Every field is a fragment — drop filler words and lead with the verb or key fact. Never exceed the word limits.

"situationalItems": Recommend 2–4 items that genuinely fit THIS champion vs THIS specific enemy comp.
Each enemy champion includes their official Riot tags (e.g. [Tank], [Mage, Assassin], [Marksman]) — use these to understand the threat profile. Analyze each enemy individually, not just AP/AD totals.
Recommend items appropriate for the player's champion class:
- Marksman/ADC: crit, attack speed, armor pen (Infinity Edge=3031, Kraken Slayer=6672, Lord Dominik's=3036, Mortal Reminder=3033, Bloodthirster=3072)
- Mage/AP: AP, mana, MR (Shadowflame=6675, Rabadon's=3089, Zhonya's=3157, Banshee's=3102, Void Staff=3135, Liandry's=6653)
- Tank: HP, armor, MR (Heartsteel=6664, Sunfire=3068, Thornmail=3075, Randuin's=3143, Force of Nature=4401, Kaenic Rookern=2504)
- Fighter/Bruiser: damage + survivability (Trinity Force=3078, Black Cleaver=3071, Sterak's=3053, Sundered Sky=6610, Maw=3156, Death's Dance=6333)
- Support: utility, auras (Locket=3190, Moonstone=6617, Redemption=3107, Knight's Vow=3109)
Common defensive counters: QSS=3140 (hard CC), Plated Steelcaps=3047 (AA-heavy), Merc Treads=3111 (CC+AP), Guardian Angel=3026 (burst assassins), GW items=3033/3165 (heavy healing).
Never repeat items already in the counter items list. Use [] only if the counter items already cover everything.

The "Counter items" shown are automated heuristic suggestions. You may override itemReasoning if they don't fit the champion.

Adjust analysis based on the player's role:
- UTILITY (Support): ignore CS. Focus on vision, assists, ADC protection, engage/disengage/peel.
- BOTTOM (ADC): CS lead/deficit matters most. Sustained DPS and positioning in fights.
- TOP: split-push vs teamfight timing for this champion, teleport plays, wave management.
- JUNGLE: Drake/Baron/Herald control, which lanes need ganks, when to invade.
- MIDDLE: roam timing, wave management before roaming, mid-tier objective priority.

Summoner spells: each enemy lists their summoner spells (e.g. [Flash, Ignite]).
Use them to judge kill threat and trade risk: Ignite = early all-in/kill pressure, Exhaust = anti-dive/anti-burst, Heal = sustain in 2v2, Teleport = map pressure, Cleanse = CC resistant.
HONESTY RULE: you do NOT know enemy cooldowns — never state that an enemy spell "is down" or "is on cooldown" as fact. If a play depends on it, phrase it conditionally: "if their Flash is down, …". The only certainty is a DEAD enemy (their cooldowns reset on respawn).

"immediateAction" is the single most important line the player reads — make it the concrete play for RIGHT NOW.

Be specific. Reference actual numbers (CS lead, kill lead, vision score, gold gap). Do not give generic advice.`;

/**
 * Per-request directive appended to the user prompt. Keeps the cached system
 * prompt intact while shifting only the aggressiveness of the single recommendation.
 */
export function riskDirective(risk: RiskLevel): string {
  switch (risk) {
    case "safe":
      return `Playstyle: SAFE. Bias toward survival and tempo over kills. Prefer disengage, safe farming, and objective trades. Only suggest an all-in when it is near risk-free. Lead "immediateAction" with the cautious play.`;
    case "risky":
      return `Playstyle: AGGRESSIVE. Reward proactive, high-upside plays. When an all-in, dive, or pick is realistic, call it explicitly in "immediateAction" (e.g. "Flash in, Ignite, Q — if their Flash is down they die"). Stay within the HONESTY RULE: conditional, never claiming enemy cooldowns as fact.`;
    case "normal":
    default:
      return `Playstyle: BALANCED. Weigh risk and reward normally for this game state.`;
  }
}

export function buildFocusDirective(
  focus: BuildFocus = DEFAULT_BUILD_FOCUS,
  preferPassive = false,
): string {
  const parts: string[] = [];
  switch (focus) {
    case "burst":
      parts.push("Build Focus: BURST / PICK. Prioritize upfront burst damage and magic/armor penetration.");
      break;
    case "dps":
      parts.push("Build Focus: SUSTAINED DPS / TANK-SHRED. Prioritize attack speed, %HP shred, and %penetration.");
      break;
    case "bruiser":
      parts.push("Build Focus: BRUISER / ANTI-BURST. Prioritize HP + resistances + tenacity to survive burst.");
      break;
    case "split":
      parts.push("Build Focus: SIDELANE / 1v1 DUEL. Prioritize 1v1 dueling power, waveclear, and tower pressure.");
      break;
    default:
      break;
  }
  if (preferPassive) {
    parts.push("Item Preference: PASSIVE ITEMS ONLY. Avoid items with complex active buttons (e.g. prefer Banshee's over Zhonya's, Frozen Heart over Randuin's, Sterak's/Mercs over QSS).");
  }
  return parts.join(" ");
}

function buildRoleContext(state: ParsedGameState, role: RolePosition): string {
  switch (role) {
    case "UTILITY": {
      const allyAdc = state.allies.find((a) => a.position === "BOTTOM");
      if (allyAdc) {
        return `Your ADC (protect): ${allyAdc.championName} — KDA ${allyAdc.scores.kills}/${allyAdc.scores.deaths}/${allyAdc.scores.assists}, Lvl ${allyAdc.level}${allyAdc.isDead ? ", DEAD" : ""}`;
      }
      return "Your ADC: not found in ally list";
    }
    case "JUNGLE": {
      const losingLanes = state.allies.filter(
        (a) => a.scores.deaths > a.scores.kills + a.scores.assists,
      );
      if (losingLanes.length > 0) {
        return `Lanes that may need a gank: ${losingLanes.map((a) => `${a.championName} (${a.position || "?"}, KDA ${a.scores.kills}/${a.scores.deaths}/${a.scores.assists})`).join(", ")}`;
      }
      return "";
    }
    default:
      return "";
  }
}

async function formatAbilities(championName: string): Promise<string> {
  const abilities = await ddragon.getChampionAbilities(championName);
  if (!abilities) return "";
  return ` | Abilities: Q=${abilities.q}, W=${abilities.w}, E=${abilities.e}, R=${abilities.r}`;
}

function findDirectLaneOpponent(state: ParsedGameState, myPos: RolePosition) {
  if (myPos === "UNKNOWN" || myPos === "") return undefined;
  const laneOpponent = state.enemies.find((e) => e.position === myPos);
  if (laneOpponent) return laneOpponent;
  const opponentPos = myPos === "UTILITY" ? "BOTTOM" : myPos;
  return state.enemies.find((e) => e.position === opponentPos);
}

function formatSpells(player: { summonerSpells?: { summonerSpellOne?: { displayName: string }; summonerSpellTwo?: { displayName: string } } }): string {
  const names = [
    player.summonerSpells?.summonerSpellOne?.displayName,
    player.summonerSpells?.summonerSpellTwo?.displayName,
  ].filter((n): n is string => !!n && n.length > 0);
  return names.length ? ` {${names.join(", ")}}` : "";
}

async function formatOpponent(primaryOpponent: any, myPos: RolePosition): Promise<string> {
  if (!primaryOpponent) return "Opponent: unknown (position data unavailable)";
  const opponentAbilityStr = await formatAbilities(primaryOpponent.championName);
  const tags = ddragon.getChampionTags(primaryOpponent.championName);
  const tagStr = tags.length ? ` [${tags.join(", ")}]` : "";
  const spellStr = formatSpells(primaryOpponent);
  const keystone = primaryOpponent.runes?.keystone?.displayName;
  const runeStr = keystone ? ` (Keystone: ${keystone})` : "";
  const oppItems = (primaryOpponent.items ?? [])
    .filter((i: any) => !i.consumable)
    .map((i: any) => i.displayName)
    .join(", ");
  const itemStr = oppItems ? ` | Items: ${oppItems}` : "";
  return `Opponent (${primaryOpponent.position || myPos}): ${primaryOpponent.championName}${tagStr}${runeStr}${spellStr} — KDA ${primaryOpponent.scores.kills}/${primaryOpponent.scores.deaths}/${primaryOpponent.scores.assists}, CS ${primaryOpponent.scores.creepScore}, Lvl ${primaryOpponent.level}${primaryOpponent.isDead ? ", DEAD" : ""}${itemStr}${opponentAbilityStr}`;
}

function formatEnemiesWithTags(enemies: ParsedGameState["enemies"]): string {
  if (enemies.length === 0) return "None";
  return enemies.map((e) => {
    const tags = ddragon.getChampionTags(e.championName);
    const tagStr = tags.length ? ` [${tags.join(", ")}]` : "";
    const pos = e.position ? ` (${e.position})` : "";
    const spellStr = formatSpells(e);
    const keystone = e.runes?.keystone?.displayName;
    const runeStr = keystone ? ` (${keystone})` : "";
    const items = e.items.filter((i) => !i.consumable).map((i) => i.displayName);
    const itemStr = items.length ? ` [Items: ${items.join(", ")}]` : "";
    return `${e.championName}${tagStr}${runeStr}${spellStr}${pos} Lvl ${e.level} ${e.scores.kills}/${e.scores.deaths}/${e.scores.assists}${itemStr}`;
  }).join(", ");
}

export async function buildUserPrompt(
  state: ParsedGameState,
  risk: RiskLevel = DEFAULT_RISK_LEVEL,
  options: LlmContextOptions = {},
): Promise<string> {
  const phase = getGamePhase(state.gameTime);
  const myPos = (state.localPlayer.position || "UNKNOWN") as RolePosition;
  const myVision = state.localPlayer.scores.wardScore;

  const primaryOpponent = findDirectLaneOpponent(state, myPos);
  const myTags = ddragon.getChampionTags(state.localPlayer.championName);
  const myTagStr = myTags.length ? ` [${myTags.join(", ")}]` : "";
  const mySpellStr = formatSpells(state.localPlayer);
  const myKeystone =
    state.activePlayer.fullRunes?.keystone?.displayName ||
    state.localPlayer.runes?.keystone?.displayName;
  const myRuneStr = myKeystone ? ` (Keystone: ${myKeystone})` : "";

  const [myAbilityStr, opponentStr] = await Promise.all([
    formatAbilities(state.localPlayer.championName),
    formatOpponent(primaryOpponent, myPos)
  ]);

  const roleContext = buildRoleContext(state, myPos);
  const enemiesWithTags = formatEnemiesWithTags(state.enemies);
  const threat = computePrimaryThreat(state);
  const dmgProfile = computeTeamDamageProfile(state);
  const objectives = computeObjectives(state);

  const threatLine = threat
    ? `Primary Threat: ${threat.championName} (${threat.reason}) | Enemy Comp: ${dmgProfile.adPercent}% AD / ${dmgProfile.apPercent}% AP${dmgProfile.heavyHealing ? " [HEAVY HEALING]" : ""}${dmgProfile.armorStacking ? " [ARMOR STACKING]" : ""}${dmgProfile.mrStacking ? " [MR STACKING]" : ""}`
    : "";

  const objLine =
    objectives.length > 0
      ? `Objectives: ${objectives.map((o) => `${o.label}: ${o.secondsUntilSpawn === 0 ? "ALIVE" : `${o.secondsUntilSpawn}s`}`).join(" | ")}`
      : "";

  const focusLine = buildFocusDirective(options.buildFocus, options.preferPassiveItems);
  const habitsLine =
    options.habitWarnings && options.habitWarnings.length > 0
      ? options.habitWarnings.join(" ")
      : "";

  const extraLines = [threatLine, objLine, roleContext, focusLine, habitsLine]
    .filter((l) => l.length > 0)
    .join("\n");

  return `Game Phase: ${phase} | Time: ${Math.floor(state.gameTime / 60)}m
My champion: ${state.localPlayer.championName}${myTagStr}${myRuneStr}${mySpellStr}${myAbilityStr}
My role: ${myPos}${myPos === "UTILITY" ? ` (Vision: ${Math.round(myVision)})` : ""}
My stats: Lvl ${state.localPlayer.level}, Gold ${state.activePlayer.currentGold}, KDA ${state.localPlayer.scores.kills}/${state.localPlayer.scores.deaths}/${state.localPlayer.scores.assists}, CS ${state.localPlayer.scores.creepScore}
My items: ${state.localPlayer.items.map(i => i.displayName).join(", ") || "None"}

Enemies: ${enemiesWithTags}

${opponentStr}
${extraLines}
${riskDirective(risk)}
Respond with the JSON object as instructed.`;
}
