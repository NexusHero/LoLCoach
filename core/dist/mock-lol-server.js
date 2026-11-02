#!/usr/bin/env tsx
"use strict";
/**
 * Mock LoL Live Client API Server
 *
 * Simulates the Riot Games Live Client API (normally at https://127.0.0.1:2999)
 * so the bridge can be developed and manually tested without an active LoL game.
 *
 * Usage:
 *   npm run mock-lol
 *
 * Then start the bridge pointing at this server:
 *   LIVE_CLIENT_URL=http://localhost:2999/liveclientdata/allgamedata \
 *   SUMMONER_NAME=TestPlayer npm run dev
 *
 * The server cycles through a scripted game scenario and then simulates
 * game end by returning 503 until Ctrl-C.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const logger_js_1 = require("./logger.js");
const PORT = parseInt(process.env.MOCK_LOL_PORT ?? "2999");
const PATH = "/liveclientdata/allgamedata";
// ── ANSI colours ────────────────────────────────────────────────────────────
const C = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    cyan: "\x1b[36m",
    yellow: "\x1b[33m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    dim: "\x1b[2m",
};
function log(icon, msg) {
    const ts = new Date().toISOString().slice(11, 23);
    logger_js_1.Logger.info(`${C.dim}${ts}${C.reset}  ${icon}  ${msg}`);
}
function player(summonerName, championName, team, overrides = {}) {
    return {
        championName,
        isBot: false,
        isDead: false,
        items: [],
        level: 5,
        position: team === "ORDER" ? "MID" : "MID",
        rawChampionName: `game_character_${championName.toLowerCase()}`,
        scores: { assists: 0, creepScore: 45, deaths: 0, kills: 1, wardScore: 5 },
        skinID: 0,
        summonerName,
        summonerSpells: {
            summonerSpellOne: { displayName: "Flash" },
            summonerSpellTwo: { displayName: team === "CHAOS" ? "Ignite" : "Teleport" },
        },
        team,
        ...overrides,
    };
}
function item(id, name, slot) {
    return {
        canUse: false,
        consumable: false,
        count: 1,
        displayName: name,
        itemID: id,
        price: 2700,
        rawDescription: "",
        slot,
    };
}
function activePlayer(gold, level) {
    return {
        championStats: {
            abilityPower: level * 10,
            armor: 55,
            attackDamage: 90,
            critChance: 0,
            healthMax: 1200,
            magicResist: 40,
        },
        currentGold: gold,
        level,
        summonerName: "TestPlayer",
    };
}
function gameData(gameTime) {
    return {
        gameMode: "CLASSIC",
        gameTime,
        mapName: "Summoner's Rift",
        mapNumber: 11,
        mapTerrain: "Default",
    };
}
const THORNMAIL = item(3076, "Thornmail", 0);
const VOID_STAFF = item(3135, "Void Staff", 1);
const SYNDRA = (items = []) => player("Syndra", "Syndra", "CHAOS", { items });
const FRAMES = [
    {
        label: "Game detected — GAME_STARTED + RECOMMENDATION expected",
        data: {
            activePlayer: activePlayer(500, 5),
            allPlayers: [
                player("TestPlayer", "Ahri", "ORDER", { level: 5 }),
                player("Lulu", "Lulu", "ORDER"),
                SYNDRA(),
                player("Zed", "Zed", "CHAOS"),
                player("Thresh", "Thresh", "CHAOS"),
                player("Jinx", "Jinx", "CHAOS"),
                player("Malzahar", "Malzahar", "CHAOS"),
            ],
            gameData: gameData(60),
        },
    },
    {
        label: "30s tick — GAME_TICK expected",
        data: {
            activePlayer: activePlayer(650, 5),
            allPlayers: [
                player("TestPlayer", "Ahri", "ORDER", { level: 5 }),
                player("Lulu", "Lulu", "ORDER"),
                SYNDRA(),
                player("Zed", "Zed", "CHAOS"),
                player("Thresh", "Thresh", "CHAOS"),
                player("Jinx", "Jinx", "CHAOS"),
                player("Malzahar", "Malzahar", "CHAOS"),
            ],
            gameData: gameData(90),
        },
    },
    {
        label: "Syndra buys Thornmail — ITEM_PURCHASED + RECOMMENDATION expected",
        data: {
            activePlayer: activePlayer(650, 5),
            allPlayers: [
                player("TestPlayer", "Ahri", "ORDER", { level: 5 }),
                player("Lulu", "Lulu", "ORDER"),
                SYNDRA([THORNMAIL]),
                player("Zed", "Zed", "CHAOS"),
                player("Thresh", "Thresh", "CHAOS"),
                player("Jinx", "Jinx", "CHAOS"),
                player("Malzahar", "Malzahar", "CHAOS"),
            ],
            gameData: gameData(91),
        },
    },
    {
        label: "Level up + 30s tick — LEVEL_UP + GAME_TICK expected",
        data: {
            activePlayer: activePlayer(720, 6),
            allPlayers: [
                player("TestPlayer", "Ahri", "ORDER", { level: 6 }),
                player("Lulu", "Lulu", "ORDER"),
                SYNDRA([THORNMAIL]),
                player("Zed", "Zed", "CHAOS"),
                player("Thresh", "Thresh", "CHAOS"),
                player("Jinx", "Jinx", "CHAOS"),
                player("Malzahar", "Malzahar", "CHAOS"),
            ],
            gameData: gameData(120),
        },
    },
    {
        label: "Player dies — PLAYER_DIED + RECOMMENDATION expected",
        data: {
            activePlayer: activePlayer(720, 6),
            allPlayers: [
                player("TestPlayer", "Ahri", "ORDER", { level: 6, isDead: true }),
                player("Lulu", "Lulu", "ORDER"),
                SYNDRA([THORNMAIL]),
                player("Zed", "Zed", "CHAOS"),
                player("Thresh", "Thresh", "CHAOS"),
                player("Jinx", "Jinx", "CHAOS"),
                player("Malzahar", "Malzahar", "CHAOS"),
            ],
            gameData: gameData(121),
        },
    },
    {
        label: "Respawn + gold spike 720→1200 — HIGH_GOLD_REACHED + RECOMMENDATION expected",
        data: {
            activePlayer: activePlayer(1200, 6),
            allPlayers: [
                player("TestPlayer", "Ahri", "ORDER", { level: 6 }),
                player("Lulu", "Lulu", "ORDER"),
                SYNDRA([THORNMAIL]),
                player("Zed", "Zed", "CHAOS"),
                player("Thresh", "Thresh", "CHAOS"),
                player("Jinx", "Jinx", "CHAOS"),
                player("Malzahar", "Malzahar", "CHAOS"),
            ],
            gameData: gameData(122),
        },
    },
    {
        label: "Syndra buys Void Staff — ITEM_PURCHASED + RECOMMENDATION expected",
        data: {
            activePlayer: activePlayer(450, 7),
            allPlayers: [
                player("TestPlayer", "Ahri", "ORDER", { level: 7 }),
                player("Lulu", "Lulu", "ORDER"),
                SYNDRA([THORNMAIL, VOID_STAFF]),
                player("Zed", "Zed", "CHAOS"),
                player("Thresh", "Thresh", "CHAOS"),
                player("Jinx", "Jinx", "CHAOS"),
                player("Malzahar", "Malzahar", "CHAOS"),
            ],
            gameData: gameData(180),
        },
    },
    {
        label: "Stable state — no events expected",
        data: {
            activePlayer: activePlayer(450, 7),
            allPlayers: [
                player("TestPlayer", "Ahri", "ORDER", { level: 7 }),
                player("Lulu", "Lulu", "ORDER"),
                SYNDRA([THORNMAIL, VOID_STAFF]),
                player("Zed", "Zed", "CHAOS"),
                player("Thresh", "Thresh", "CHAOS"),
                player("Jinx", "Jinx", "CHAOS"),
                player("Malzahar", "Malzahar", "CHAOS"),
            ],
            gameData: gameData(181),
        },
    },
];
// ── HTTP server ──────────────────────────────────────────────────────────────
let frameIndex = 0;
let requestCount = 0;
const server = http_1.default.createServer((req, res) => {
    if (req.url !== PATH) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "not found" }));
        return;
    }
    requestCount++;
    if (frameIndex >= FRAMES.length) {
        // All frames consumed — simulate game ended
        if (requestCount === FRAMES.length + 1) {
            log(C.red + "✖" + C.reset, `${C.yellow}Game over — bridge will detect GAME_INACTIVE after 3 more polls${C.reset}`);
        }
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "game not running" }));
        return;
    }
    const frame = FRAMES[frameIndex];
    log(C.green + "→" + C.reset, `Frame ${C.bold}${frameIndex + 1}/${FRAMES.length}${C.reset}  t=${frame.data.gameData.gameTime}s  ${C.dim}${frame.label}${C.reset}`);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(frame.data));
    frameIndex++;
});
function printHeader() {
    logger_js_1.Logger.info("");
    logger_js_1.Logger.info(`${C.cyan}${C.bold}  LoL Mock Server${C.reset}  http://localhost:${PORT}`);
    logger_js_1.Logger.info("");
    logger_js_1.Logger.info(`  ${C.dim}Set this env var before starting the bridge:${C.reset}`);
    logger_js_1.Logger.info(`  ${C.yellow}LIVE_CLIENT_URL=http://localhost:${PORT}${PATH}${C.reset}`);
    logger_js_1.Logger.info(`  ${C.yellow}SUMMONER_NAME=TestPlayer${C.reset}`);
    logger_js_1.Logger.info("");
    logger_js_1.Logger.info(`  Scenario: ${C.bold}${FRAMES.length} frames${C.reset} — covers GAME_STARTED, GAME_TICK, ITEM_PURCHASED,`);
    logger_js_1.Logger.info(`            LEVEL_UP, PLAYER_DIED, HIGH_GOLD_REACHED`);
    logger_js_1.Logger.info("");
    logger_js_1.Logger.info(`  ${C.dim}Press Ctrl-C to stop.${C.reset}`);
    logger_js_1.Logger.info("");
}
server.listen(PORT, "127.0.0.1", () => {
    printHeader();
});
process.on("SIGINT", () => {
    logger_js_1.Logger.info(`\n${C.dim}Mock server stopped.${C.reset}`);
    server.close(() => process.exit(0));
});
