"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = void 0;
const tsyringe_1 = require("tsyringe");
const types_js_1 = require("./types.js");
const stateMinifier_js_1 = require("./stateMinifier.js");
const CACHE_TTL_MS = 10 * 60 * 1000;
let CacheService = class CacheService {
    store = new Map();
    get(key) {
        const entry = this.store.get(key);
        if (!entry)
            return undefined;
        if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
            this.store.delete(key);
            return undefined;
        }
        return entry.analysis;
    }
    set(key, analysis) {
        this.store.set(key, { analysis, cachedAt: Date.now() });
    }
    clear() {
        this.store.clear();
    }
    buildKey(state, risk = types_js_1.DEFAULT_RISK_LEVEL, buildFocus = types_js_1.DEFAULT_BUILD_FOCUS, preferPassive = false, overrideSig = "") {
        const goldBucket = Math.floor(state.activePlayer.currentGold / 500);
        const phase = (0, stateMinifier_js_1.getGamePhase)(state.gameTime);
        const killsBucket = Math.floor(state.localPlayer.scores.kills / 3);
        // Deaths are exact (not bucketed): each death changes the live situation
        // meaningfully, so consecutive deaths must not collapse into one cache entry.
        const deaths = state.localPlayer.scores.deaths;
        const enemyNames = state.enemies.map((e) => e.championName).sort().join(",");
        const enemyCoreItems = state.enemies
            .flatMap((e) => e.items.filter((i) => i.price >= 2400).map((i) => i.itemID))
            .sort()
            .join(",");
        const myItems = state.localPlayer.items.map((i) => i.itemID).sort().join(",");
        return [
            state.localPlayer.championName,
            phase,
            `g${goldBucket}`,
            `k${killsBucket}`,
            `d${deaths}`,
            `r:${risk}`,
            `f:${buildFocus}`,
            `p:${preferPassive ? 1 : 0}`,
            `e:${enemyNames}`,
            `eitems:${enemyCoreItems}`,
            `myitems:${myItems}`,
            ...(overrideSig ? [`ov:${overrideSig}`] : []),
        ].join("|");
    }
};
exports.CacheService = CacheService;
exports.CacheService = CacheService = __decorate([
    (0, tsyringe_1.injectable)()
], CacheService);
