"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecommendationEngine = void 0;
const tsyringe_1 = require("tsyringe");
const cacheService_js_1 = require("./cacheService.js");
const types_js_1 = require("./types.js");
const logger_js_1 = require("./logger.js");
const ddragonService_js_1 = require("./ddragonService.js");
const tacticalAnalyzer_js_1 = require("./tacticalAnalyzer.js");
const SECONDARY_TRIGGER_COOLDOWN_SEC = 45;
let RecommendationEngine = class RecommendationEngine {
    llmProvider = null;
    cache = new cacheService_js_1.CacheService();
    sessionInputTokens = 0;
    sessionOutputTokens = 0;
    tokenBudget = 0;
    riskLevel = types_js_1.DEFAULT_RISK_LEVEL;
    buildFocus = types_js_1.DEFAULT_BUILD_FOCUS;
    preferPassiveItems = false;
    habitWarnings = [];
    liveOverrides;
    vectorMemories = [];
    lastRecommendedItems = [];
    lastLlmGameTime = -999;
    setRiskLevel(level) {
        if (this.riskLevel !== level) {
            logger_js_1.Logger.info(`[Engine] Risk level changed: ${this.riskLevel} → ${level}`);
            this.riskLevel = level;
        }
    }
    setBuildFocus(focus) {
        if (this.buildFocus !== focus) {
            logger_js_1.Logger.info(`[Engine] Build focus changed: ${this.buildFocus} → ${focus}`);
            this.buildFocus = focus;
        }
    }
    setPreferPassiveItems(prefer) {
        if (this.preferPassiveItems !== prefer) {
            logger_js_1.Logger.info(`[Engine] Prefer passive items changed: ${this.preferPassiveItems} → ${prefer}`);
            this.preferPassiveItems = prefer;
        }
    }
    setHabitWarnings(warnings) {
        this.habitWarnings = warnings;
    }
    setLiveOverrides(overrides) {
        this.liveOverrides = overrides;
    }
    setVectorMemories(memories) {
        this.vectorMemories = memories;
    }
    getLastRecommendedItems() {
        return this.lastRecommendedItems;
    }
    setLlmProvider(provider) {
        const oldName = this.llmProvider?.name ?? "none";
        const newName = provider?.name ?? "none";
        if (oldName !== newName) {
            logger_js_1.Logger.info(`[Engine] LLM provider changed: ${oldName} → ${newName}`);
        }
        this.llmProvider = provider;
    }
    setTokenBudget(budget) {
        this.tokenBudget = budget;
    }
    reset() {
        this.cache.clear();
        this.sessionInputTokens = 0;
        this.sessionOutputTokens = 0;
        this.liveOverrides = undefined;
        this.vectorMemories = [];
        this.lastRecommendedItems = [];
        this.lastLlmGameTime = -999;
    }
    shouldTriggerLlm(state, eventType) {
        if (eventType === "GAME_STARTED" ||
            eventType === "PLAYER_DIED" ||
            eventType === "MANUAL") {
            return true;
        }
        const elapsedGameSec = state.gameTime - this.lastLlmGameTime;
        if (elapsedGameSec < SECONDARY_TRIGGER_COOLDOWN_SEC) {
            return false;
        }
        if (eventType === "HIGH_GOLD_REACHED") {
            return state.activePlayer.currentGold >= 1400;
        }
        if (eventType === "OBJECTIVE_SETUP_WINDOW") {
            return true;
        }
        if (eventType === "ITEM_PURCHASED") {
            return state.enemies.some((e) => e.items.some((i) => i.price >= 2600));
        }
        return false;
    }
    async process(state, eventType, hasClients, callbacks) {
        const useLlm = this.llmProvider !== null &&
            hasClients &&
            this.shouldTriggerLlm(state, eventType);
        if (!useLlm)
            return;
        if (this.tokenBudget > 0 && this.sessionInputTokens >= this.tokenBudget) {
            logger_js_1.Logger.warn(`[Engine] Session token budget exhausted (${this.sessionInputTokens}/${this.tokenBudget}). Skipping LLM.`);
            callbacks.onLlmBudgetExceeded(this.sessionInputTokens, this.tokenBudget);
            return;
        }
        const hasOverrides = this.liveOverrides !== undefined &&
            (Boolean(this.liveOverrides.laneOpponentOverride) ||
                Boolean(this.liveOverrides.campedStatus) ||
                Object.keys(this.liveOverrides.enemyBuildOverrides).length > 0 ||
                this.liveOverrides.tacticalNotes.length > 0);
        const overrideSig = hasOverrides
            ? JSON.stringify({
                l: this.liveOverrides?.laneOpponentOverride,
                c: this.liveOverrides?.campedStatus,
                b: this.liveOverrides?.enemyBuildOverrides,
                n: this.liveOverrides?.tacticalNotes,
            })
            : "";
        const cacheKey = this.cache.buildKey(state, this.riskLevel, this.buildFocus, this.preferPassiveItems, overrideSig);
        const cached = this.cache.get(cacheKey);
        let llmAnalysis;
        if (cached) {
            logger_js_1.Logger.info(`[Engine] Cache HIT (${eventType})`);
            llmAnalysis = cached;
        }
        else {
            try {
                const hasExtraOptions = this.buildFocus !== types_js_1.DEFAULT_BUILD_FOCUS ||
                    this.preferPassiveItems ||
                    this.habitWarnings.length > 0 ||
                    hasOverrides ||
                    this.vectorMemories.length > 0;
                llmAnalysis = hasExtraOptions
                    ? await this.llmProvider.getAnalysis(state, this.riskLevel, {
                        buildFocus: this.buildFocus,
                        preferPassiveItems: this.preferPassiveItems,
                        habitWarnings: this.habitWarnings,
                        ...(hasOverrides && this.liveOverrides ? { liveOverrides: this.liveOverrides } : {}),
                        ...(this.vectorMemories.length > 0 ? { vectorMemories: this.vectorMemories } : {}),
                    })
                    : await this.llmProvider.getAnalysis(state, this.riskLevel);
                this.lastLlmGameTime = state.gameTime;
                if (llmAnalysis.tokenUsage) {
                    this.sessionInputTokens += llmAnalysis.tokenUsage.input;
                    this.sessionOutputTokens += llmAnalysis.tokenUsage.output;
                }
                this.cache.set(cacheKey, llmAnalysis);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                logger_js_1.Logger.error(`[Engine] LLM failed for ${eventType}:`, msg);
                callbacks.onLlmError(msg);
                return;
            }
        }
        const ownedItemIds = new Set(state.localPlayer.items.map((i) => i.itemID));
        const seenIds = new Set();
        const rawItems = (llmAnalysis.situationalItems ?? []).map((i) => {
            if (this.preferPassiveItems && tacticalAnalyzer_js_1.PASSIVE_ITEM_ALTERNATIVES[i.id]) {
                const alt = tacticalAnalyzer_js_1.PASSIVE_ITEM_ALTERNATIVES[i.id];
                return { ...i, id: alt.id, name: alt.name, reason: alt.reason };
            }
            return i;
        });
        const filteredItems = rawItems.filter((i) => {
            if (ownedItemIds.has(i.id))
                return false;
            if (!ddragonService_js_1.ddragon.getItemInfo(i.id)) {
                logger_js_1.Logger.warn(`[Rec] Dropping hallucinated item id=${i.id} name="${i.name}"`);
                return false;
            }
            if (seenIds.has(i.id))
                return false;
            seenIds.add(i.id);
            return true;
        });
        this.lastRecommendedItems = filteredItems;
        const rec = {
            items: filteredItems,
            reasoning: llmAnalysis.reasoning,
            strategy: llmAnalysis.strategy,
            source: "llm",
            provider: this.llmProvider.name,
        };
        const tokenUsageInfo = llmAnalysis.tokenUsage
            ? {
                lastInput: llmAnalysis.tokenUsage.input,
                lastOutput: llmAnalysis.tokenUsage.output,
                sessionInput: this.sessionInputTokens,
                sessionOutput: this.sessionOutputTokens,
            }
            : undefined;
        callbacks.onLlmSuccess(rec, tokenUsageInfo);
        logger_js_1.Logger.info(`[Rec] llm (Trigger: ${eventType}): ${rec.items.map((i) => i.name).join(", ")}`);
    }
};
exports.RecommendationEngine = RecommendationEngine;
exports.RecommendationEngine = RecommendationEngine = __decorate([
    (0, tsyringe_1.singleton)()
], RecommendationEngine);
