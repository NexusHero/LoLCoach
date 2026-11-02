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
exports.MessageRouter = void 0;
const tsyringe_1 = require("tsyringe");
const orchestrator_js_1 = require("./orchestrator.js");
const logger_js_1 = require("./logger.js");
const llmProvider_js_1 = require("./llmProvider.js");
const VALID_RISK_LEVELS = ["safe", "normal", "risky"];
const VALID_BUILD_FOCUSES = ["auto", "burst", "dps", "bruiser", "split"];
let MessageRouter = class MessageRouter {
    orchestrator;
    handlers;
    constructor(orchestrator) {
        this.orchestrator = orchestrator;
        this.handlers = new Map([
            ["SET_SUMMONE", this.handleSetSummoner],
            ["SET_SUMMONER", this.handleSetSummoner],
            ["TRIGGER_ANALYSIS", this.handleTriggerAnalysis],
            ["SET_LLM_PROVIDER", this.handleSetLlmProvider],
            ["SET_RISK_LEVEL", this.handleSetRiskLevel],
            ["SET_BUILD_FOCUS", this.handleSetBuildFocus],
            ["SET_PREFER_PASSIVE_ITEMS", this.handleSetPreferPassiveItems],
            ["COACH_COMMAND", this.handleCoachCommand],
            ["CLEAR_TACTICAL_OVERRIDE", this.handleClearTacticalOverride],
            ["GET_MODELS", this.handleGetModels],
            ["VALIDATE_KEY", this.handleValidateKey],
        ]);
    }
    async handle(ws, message) {
        const event = message.event;
        if (typeof event !== "string")
            return;
        const handler = this.handlers.get(event);
        if (!handler)
            return;
        await handler(ws, message);
    }
    handleSetSummoner = (_ws, message) => {
        if (typeof message.summonerName === "string") {
            this.orchestrator.setSummonerName(message.summonerName);
        }
    };
    handleTriggerAnalysis = async () => {
        await this.orchestrator.triggerManualAnalysis();
    };
    handleSetRiskLevel = (_ws, message) => {
        const level = message.riskLevel;
        if (typeof level === "string" && VALID_RISK_LEVELS.includes(level)) {
            this.orchestrator.setRiskLevel(level);
        }
        else {
            logger_js_1.Logger.warn(`[MessageRouter] Ignoring invalid risk level: ${String(level)}`);
        }
    };
    handleSetBuildFocus = (_ws, message) => {
        const focus = message.buildFocus;
        if (typeof focus === "string" && VALID_BUILD_FOCUSES.includes(focus)) {
            this.orchestrator.setBuildFocus(focus);
        }
        else {
            logger_js_1.Logger.warn(`[MessageRouter] Ignoring invalid build focus: ${String(focus)}`);
        }
    };
    handleSetPreferPassiveItems = (_ws, message) => {
        if (typeof message.preferPassiveItems === "boolean") {
            this.orchestrator.setPreferPassiveItems(message.preferPassiveItems);
        }
    };
    handleCoachCommand = async (_ws, message) => {
        if (typeof message.text === "string" && message.text.trim().length > 0) {
            await this.orchestrator.handleCoachCommand(message.text);
        }
    };
    handleClearTacticalOverride = async (_ws, message) => {
        if (typeof message.key === "string" && message.key.trim().length > 0) {
            await this.orchestrator.handleClearOverride(message.key);
        }
    };
    handleGetModels = async (ws, message) => {
        const providerType = message.provider;
        const apiKey = message.apiKey;
        if (!providerType || !apiKey) {
            ws.send(JSON.stringify({ event: "MODELS_ERROR", error: "Provider and API key are required" }));
            return;
        }
        try {
            const provider = await (0, llmProvider_js_1.createLlmProvider)(providerType, apiKey);
            const models = await provider.listModels();
            ws.send(JSON.stringify({ event: "MODELS_AVAILABLE", provider: providerType, models }));
        }
        catch (err) {
            ws.send(JSON.stringify({ event: "MODELS_ERROR", error: err instanceof Error ? err.message : String(err) }));
        }
    };
    handleValidateKey = async (ws, message) => {
        const providerType = message.provider;
        const apiKey = message.apiKey;
        if (!providerType || !apiKey) {
            ws.send(JSON.stringify({ event: "KEY_INVALID", error: "Provider and API key are required" }));
            return;
        }
        try {
            const provider = await (0, llmProvider_js_1.createLlmProvider)(providerType, apiKey);
            await provider.listModels();
            ws.send(JSON.stringify({ event: "KEY_VALID", provider: providerType }));
        }
        catch (err) {
            ws.send(JSON.stringify({ event: "KEY_INVALID", provider: providerType, error: err instanceof Error ? err.message : String(err) }));
        }
    };
    handleSetLlmProvider = async (_ws, message) => {
        const providerType = message.provider;
        const apiKey = message.apiKey;
        const model = message.model;
        const tokenBudget = typeof message.tokenBudget === "number" ? message.tokenBudget : 0;
        this.orchestrator.setTokenBudget(tokenBudget);
        if (!providerType || !apiKey) {
            logger_js_1.Logger.info("[MessageRouter] LLM provider disabled.");
            this.orchestrator.setLlmProvider(null);
            this.orchestrator.setEmbeddingConfig?.({ provider: "none" });
            return;
        }
        try {
            const provider = await (0, llmProvider_js_1.createLlmProvider)(providerType, apiKey, model);
            this.orchestrator.setLlmProvider(provider);
            this.orchestrator.setEmbeddingConfig?.({ provider: providerType, apiKey });
        }
        catch (err) {
            logger_js_1.Logger.error("[MessageRouter] Failed to create LLM provider:", err);
            this.orchestrator.setLlmProvider(null);
            this.orchestrator.setEmbeddingConfig?.({ provider: "none" });
        }
    };
};
exports.MessageRouter = MessageRouter;
exports.MessageRouter = MessageRouter = __decorate([
    (0, tsyringe_1.singleton)(),
    __param(0, (0, tsyringe_1.inject)(orchestrator_js_1.BridgeOrchestrator)),
    __metadata("design:paramtypes", [orchestrator_js_1.BridgeOrchestrator])
], MessageRouter);
