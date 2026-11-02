"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BridgeOrchestrator = void 0;
const tsyringe_1 = require("tsyringe");
const parser_js_1 = require("./parser.js");
const types_js_1 = require("./types.js");
const logger_js_1 = require("./logger.js");
const tokens_js_1 = require("./tokens.js");
const tacticalAnalyzer_js_1 = require("./tacticalAnalyzer.js");
const macroTracker_js_1 = require("./macroTracker.js");
const playerProfileService_js_1 = require("./playerProfileService.js");
let BridgeOrchestrator = class BridgeOrchestrator {
    wsServer;
    eventDetector;
    engine;
    config;
    clock;
    lastState = null;
    correlationCounter = 0;
    buildFocus = types_js_1.DEFAULT_BUILD_FOCUS;
    preferPassiveItems = false;
    lastObjectiveTriggerKey = "";
    profileService = new playerProfileService_js_1.PlayerProfileService();
    constructor(wsServer, eventDetector, engine, llmProvider, config, clock = Date.now) {
        this.wsServer = wsServer;
        this.eventDetector = eventDetector;
        this.engine = engine;
        this.config = config;
        this.clock = clock;
        this.engine.setLlmProvider(llmProvider);
        if (this.config.tokenBudget) {
            this.engine.setTokenBudget(this.config.tokenBudget);
        }
        this.profileService.load().catch(() => { });
    }
    async computeTacticalInsights(state) {
        const telemetry = this.profileService.observeTick(state);
        const objectives = (0, macroTracker_js_1.computeObjectives)(state);
        const macroAlerts = (0, macroTracker_js_1.computeMacroAlerts)(state, objectives, telemetry.goldHoardingSeconds);
        const primaryThreat = (0, tacticalAnalyzer_js_1.computePrimaryThreat)(state);
        const teamDamageProfile = (0, tacticalAnalyzer_js_1.computeTeamDamageProfile)(state);
        const recommendedItems = this.engine.getLastRecommendedItems?.() ?? [];
        const nextBestBuy = (0, tacticalAnalyzer_js_1.computeNextBestBuy)(state, recommendedItems);
        const enemyCooldowns = await (0, tacticalAnalyzer_js_1.computeEnemyCooldowns)(state);
        return {
            ...(primaryThreat ? { primaryThreat } : {}),
            teamDamageProfile,
            ...(nextBestBuy ? { nextBestBuy } : {}),
            ...(enemyCooldowns ? { enemyCooldowns } : {}),
            macroAlerts,
            objectives,
            csPerMin: telemetry.csPerMin,
            targetCsPerMin: telemetry.targetCsPerMin,
            buildFocus: this.buildFocus,
            preferPassiveItems: this.preferPassiveItems,
        };
    }
    async handleGameData(raw) {
        const stateResult = (0, parser_js_1.parseGameState)(raw, this.config.summonerName);
        if (!stateResult.ok) {
            logger_js_1.Logger.warn(`[Orchestrator] Failed to parse game state: ${stateResult.error.message}`);
            return;
        }
        const state = stateResult.value;
        this.lastState = state;
        const profile = this.profileService.getProfile();
        this.engine.setHabitWarnings?.(profile.habitWarnings);
        let insights = await this.computeTacticalInsights(state);
        const events = this.eventDetector.detect(state);
        // Check Objective T-60s Setup Window trigger
        const setupObj = (0, macroTracker_js_1.findObjectiveSetupTrigger)(insights.objectives);
        if (setupObj) {
            const spawnMinuteBucket = Math.floor((state.gameTime + setupObj.secondsUntilSpawn) / 60);
            const triggerKey = `${setupObj.type}_${spawnMinuteBucket}`;
            if (triggerKey !== this.lastObjectiveTriggerKey) {
                this.lastObjectiveTriggerKey = triggerKey;
                await this.sendRecommendation(state, "OBJECTIVE_SETUP_WINDOW", insights);
            }
        }
        for (const event of events) {
            logger_js_1.Logger.info(`[Event] ${event.type}`);
            const shouldRecommend = event.type === "GAME_STARTED" ||
                event.type === "ITEM_PURCHASED" ||
                event.type === "PLAYER_DIED" ||
                event.type === "HIGH_GOLD_REACHED";
            if (shouldRecommend) {
                await this.sendRecommendation(event.state, event.type, insights);
                const updatedNextBuy = (0, tacticalAnalyzer_js_1.computeNextBestBuy)(state, this.engine.getLastRecommendedItems?.() ?? []);
                if (updatedNextBuy) {
                    insights = { ...insights, nextBestBuy: updatedNextBuy };
                }
            }
            this.wsServer.broadcast({
                event: event.type,
                timestamp: this.clock(),
                gameState: event.state,
                tacticalInsights: insights,
                playerProfile: profile,
            });
        }
    }
    async sendRecommendation(state, eventType, insights) {
        const correlationId = `${eventType}_${++this.correlationCounter}`;
        const hasClients = this.wsServer.clientCount > 0;
        await this.engine.process(state, eventType, hasClients, {
            onLlmBudgetExceeded: (sessionTokens, budget) => {
                this.wsServer.broadcast({
                    event: "LLM_BUDGET_EXCEEDED",
                    timestamp: this.clock(),
                    sessionInputTokens: sessionTokens,
                    budget,
                });
            },
            onLlmError: (msg) => {
                this.wsServer.broadcast({ event: "LLM_ERROR", timestamp: this.clock(), error: msg });
            },
            onLlmSuccess: (rec, tokenUsage) => {
                const nextBestBuy = (0, tacticalAnalyzer_js_1.computeNextBestBuy)(state, rec.items);
                const enrichedInsights = insights
                    ? { ...insights, ...(nextBestBuy ? { nextBestBuy } : {}) }
                    : undefined;
                this.wsServer.broadcast({
                    event: "RECOMMENDATION_UPDATE",
                    timestamp: this.clock(),
                    gameState: state,
                    recommendation: rec,
                    ...(enrichedInsights ? { tacticalInsights: enrichedInsights } : {}),
                    correlationId,
                    triggerEvent: eventType,
                    tokenUsage,
                });
            },
        });
    }
    async triggerManualAnalysis() {
        if (!this.lastState) {
            logger_js_1.Logger.info("[Orchestrator] Manual analysis requested but no game state available.");
            return;
        }
        logger_js_1.Logger.info("[Orchestrator] Manual analysis triggered.");
        const insights = await this.computeTacticalInsights(this.lastState);
        await this.sendRecommendation(this.lastState, "MANUAL", insights);
    }
    resetDetector() {
        const autopsy = this.profileService.finalizeMatch(this.clock());
        this.lastState = null;
        this.lastObjectiveTriggerKey = "";
        this.eventDetector.reset();
        this.engine.reset();
        return autopsy;
    }
    getPlayerProfile() {
        return this.profileService.getProfile();
    }
    setTokenBudget(budget) {
        this.config.tokenBudget = budget;
        this.engine.setTokenBudget(budget);
    }
    setSummonerName(name) {
        if (this.config.summonerName !== name) {
            logger_js_1.Logger.info(`[Orchestrator] Changing summoner name to '${name}'`);
            this.config.summonerName = name;
            this.resetDetector();
        }
    }
    setLlmProvider(provider) {
        this.engine.setLlmProvider(provider);
    }
    setRiskLevel(level) {
        this.engine.setRiskLevel(level);
    }
    setBuildFocus(focus) {
        this.buildFocus = focus;
        this.engine.setBuildFocus?.(focus);
    }
    setPreferPassiveItems(prefer) {
        this.preferPassiveItems = prefer;
        this.engine.setPreferPassiveItems?.(prefer);
    }
};
exports.BridgeOrchestrator = BridgeOrchestrator;
exports.BridgeOrchestrator = BridgeOrchestrator = __decorate([
    (0, tsyringe_1.singleton)(),
    __param(0, (0, tsyringe_1.inject)(tokens_js_1.WS_BROADCASTER_TOKEN)),
    __param(1, (0, tsyringe_1.inject)(tokens_js_1.EVENT_DETECTOR_TOKEN)),
    __param(2, (0, tsyringe_1.inject)(tokens_js_1.RECOMMENDATION_ENGINE_TOKEN)),
    __param(3, (0, tsyringe_1.inject)(tokens_js_1.LLM_PROVIDER_TOKEN)),
    __param(4, (0, tsyringe_1.inject)(tokens_js_1.ORCHESTRATOR_CONFIG_TOKEN)),
    __param(5, (0, tsyringe_1.inject)(tokens_js_1.CLOCK_TOKEN)),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object, Function])
], BridgeOrchestrator);
