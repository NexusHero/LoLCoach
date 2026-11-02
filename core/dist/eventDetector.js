"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventDetector = exports.HIGH_GOLD_THRESHOLD = void 0;
const tsyringe_1 = require("tsyringe");
const config_js_1 = require("./config.js");
const TICK_INTERVAL_SEC = 30;
exports.HIGH_GOLD_THRESHOLD = config_js_1.config.game.highGoldThreshold;
let EventDetector = class EventDetector {
    lastState = null;
    detect(current) {
        const events = [];
        const prev = this.lastState;
        if (!prev) {
            events.push({ type: "GAME_STARTED", state: current });
            this.lastState = current;
            return events;
        }
        for (const enemy of current.enemies) {
            const prevEnemy = prev.enemies.find((p) => p.summonerName === enemy.summonerName);
            if (!prevEnemy)
                continue;
            const prevItemIds = new Set(prevEnemy.items.map((i) => i.itemID));
            if (enemy.items.some((i) => !prevItemIds.has(i.itemID))) {
                events.push({ type: "ITEM_PURCHASED", player: enemy, state: current });
            }
        }
        if (current.localPlayer.level > prev.localPlayer.level) {
            events.push({
                type: "LEVEL_UP",
                player: current.localPlayer,
                newLevel: current.localPlayer.level,
                state: current,
            });
        }
        const prevTick = Math.floor(prev.gameTime / TICK_INTERVAL_SEC);
        const currTick = Math.floor(current.gameTime / TICK_INTERVAL_SEC);
        if (currTick > prevTick) {
            events.push({ type: "GAME_TICK", state: current });
        }
        if (!prev.localPlayer.isDead && current.localPlayer.isDead) {
            events.push({ type: "PLAYER_DIED", state: current });
        }
        if (prev.activePlayer.currentGold < exports.HIGH_GOLD_THRESHOLD &&
            current.activePlayer.currentGold >= exports.HIGH_GOLD_THRESHOLD) {
            events.push({ type: "HIGH_GOLD_REACHED", state: current });
        }
        this.lastState = current;
        return events;
    }
    reset() {
        this.lastState = null;
    }
};
exports.EventDetector = EventDetector;
exports.EventDetector = EventDetector = __decorate([
    (0, tsyringe_1.singleton)()
], EventDetector);
