import type { ParsedGameState, Player, ActivePlayer, Item, AllGameData, Strategy, ItemRecommendation } from "../types.js";

export function makeStrategy(partial: Partial<Strategy> = {}): Strategy {
  return {
    winCondition: "mid",
    summary: "Scale into your mid-game power spike.",
    immediateAction: "Farm safely and secure Drake when possible.",
    lateGamePlan: "Fight with full build and group for Baron.",
    ...partial,
  };
}

export function makeBaseRec(partial: Partial<ItemRecommendation> = {}): ItemRecommendation {
  return {
    items: [{ id: 3033, name: "Mortal Reminder", reason: "vs healers", priority: "core" }],
    reasoning: "heuristic reasoning",
    source: "heuristic",
    provider: "heuristic",
    strategy: makeStrategy(),
    ...partial,
  };
}

export function makeItem(partial: Partial<Item> = {}): Item {
  return {
    canUse: false,
    consumable: false,
    count: 1,
    displayName: "Test Item",
    itemID: 1001,
    price: 500,
    rawDescription: "",
    slot: 0,
    ...partial,
  };
}

export function makePlayer(partial: Partial<Player> = {}): Player {
  return {
    championName: "Ahri",
    isBot: false,
    isDead: false,
    items: [],
    level: 1,
    position: "MID",
    rawChampionName: "game_character_ahri",
    scores: { assists: 0, creepScore: 0, deaths: 0, kills: 0, wardScore: 0 },
    skinID: 0,
    summonerName: "TestPlayer",
    team: "ORDER",
    ...partial,
  };
}

export function makeActivePlayer(partial: Partial<ActivePlayer> = {}): ActivePlayer {
  return {
    championStats: {
      abilityPower: 0,
      armor: 50,
      attackDamage: 100,
      critChance: 0,
      healthMax: 1000,
      magicResist: 50,
      abilityHaste: 0,
      attackSpeed: 0.7,
      moveSpeed: 335,
      magicPenetrationFlat: 0,
      magicPenetrationPercent: 0,
      armorPenetrationFlat: 0,
      armorPenetrationPercent: 0,
      lifeSteal: 0,
      omnivamp: 0,
      currentHealth: 1000,
    },
    currentGold: 500,
    level: 1,
    summonerName: "TestPlayer",
    ...partial,
  };
}

export function makeGameState(partial: Partial<ParsedGameState> = {}): ParsedGameState {
  return {
    gameTime: 0,
    gameMode: "CLASSIC",
    localPlayer: makePlayer(),
    allies: [],
    enemies: [],
    activePlayer: makeActivePlayer(),
    ...partial,
  };
}

export function makeRawGameData(players: Player[] = [makePlayer()]): AllGameData {
  return {
    activePlayer: makeActivePlayer(),
    allPlayers: players,
    gameData: {
      gameMode: "CLASSIC",
      gameTime: 60,
      mapName: "Summoner's Rift",
      mapNumber: 11,
      mapTerrain: "Default",
    },
  };
}
