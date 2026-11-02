import type { AllGameData, ParsedGameState } from "./types.js";
import { Logger } from "./logger.js";
import { ok, err, type Result } from "./utils/result.js";

export function parseGameState(
  raw: AllGameData,
  localSummonerName: string
): Result<ParsedGameState> {
  // activePlayer.summonerName is always the local player per Riot API contract.
  // We use it to find the matching entry in allPlayers (which has champion/items/team).
  // The user-configured localSummonerName is only a fallback for spectator mode where
  // activePlayer is absent.
  if (!raw.activePlayer || !raw.allPlayers) {
    return err(new Error("Missing activePlayer or allPlayers in game data."));
  }

  const activeName = raw.activePlayer.summonerName;
  const localPlayer =
    raw.allPlayers.find((p) => p.summonerName === activeName) ??
    raw.allPlayers.find((p) => p.summonerName === localSummonerName);

  if (!localPlayer) {
    Logger.warn(
      `[Parser] Local player not found (activePlayer='${activeName}', configured='${localSummonerName}') — falling back to first player.`
    );
  }

  const player = localPlayer ?? raw.allPlayers[0];
  if (!player) {
    return err(new Error("No players found in game data."));
  }

  const localTeam = player.team;

  const allies = raw.allPlayers.filter(
    (p) => p.team === localTeam && p.summonerName !== player.summonerName
  );
  const enemies = raw.allPlayers.filter((p) => p.team !== localTeam);

  return ok({
    gameTime: Math.floor(raw.gameData?.gameTime ?? 0),
    gameMode: raw.gameData?.gameMode ?? "UNKNOWN",
    localPlayer: player,
    allies,
    enemies,
    activePlayer: raw.activePlayer,
    ...(raw.events?.Events ? { mapEvents: raw.events.Events } : {}),
  });
}
