"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiProvider = exports.GEMINI_DEFAULT_MODEL = void 0;
const genai_1 = require("@google/genai");
const llmProvider_js_1 = require("../llmProvider.js");
const types_js_1 = require("../types.js");
const logger_js_1 = require("../logger.js");
exports.GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";
class GeminiProvider {
    name = "gemini";
    client;
    modelId;
    apiKey;
    constructor(apiKey, model = exports.GEMINI_DEFAULT_MODEL) {
        this.client = new genai_1.GoogleGenAI({ apiKey });
        this.modelId = model;
        this.apiKey = apiKey;
    }
    async listModels() {
        const all = [];
        let pageToken;
        do {
            const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
            url.searchParams.set("key", this.apiKey);
            url.searchParams.set("pageSize", "100");
            if (pageToken)
                url.searchParams.set("pageToken", pageToken);
            const res = await fetch(url.toString());
            if (!res.ok)
                throw new Error(`Gemini models API returned ${res.status}`);
            const data = await res.json();
            all.push(...(data.models ?? []));
            pageToken = data.nextPageToken;
        } while (pageToken);
        const fetchedModels = all
            .filter((m) => m.supportedGenerationMethods.includes("generateContent"))
            .map((m) => ({
            id: m.name.replace("models/", ""),
            displayName: m.displayName,
        }));
        const extraModels = [
            { id: "gemini-3.1-pro-preview", displayName: "Gemini 3.1 Pro Preview" },
            { id: "gemini-3.5-flash", displayName: "Gemini 3.5 Flash" },
            { id: "gemini-3-flash-preview", displayName: "Gemini 3 Flash Preview" },
            { id: "gemini-3.1-flash-lite", displayName: "Gemini 3.1 Flash-Lite" },
            { id: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro" },
            { id: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash" },
            { id: "gemini-2.5-flash-lite", displayName: "Gemini 2.5 Flash-Lite" }
        ];
        const combined = [...fetchedModels];
        for (const extra of extraModels) {
            if (!combined.some((m) => m.id === extra.id)) {
                combined.push(extra);
            }
        }
        return combined;
    }
    async getAnalysis(state, risk = types_js_1.DEFAULT_RISK_LEVEL, options) {
        try {
            const result = await this.client.models.generateContent({
                model: this.modelId,
                contents: await (0, llmProvider_js_1.buildUserPrompt)(state, risk, options),
                config: {
                    systemInstruction: llmProvider_js_1.SYSTEM_PROMPT,
                    maxOutputTokens: 700,
                    responseMimeType: "application/json",
                    thinkingConfig: { thinkingBudget: 0 },
                },
            });
            const text = result.text;
            if (!text)
                return { reasoning: "", strategy: { winCondition: "mid", summary: "", immediateAction: "", lateGamePlan: "" } };
            const meta = result.usageMetadata;
            const tokenUsage = {
                input: meta?.promptTokenCount ?? 0,
                output: meta?.candidatesTokenCount ?? 0,
            };
            logger_js_1.Logger.info(`[LLM:Gemini] Tokens: ${tokenUsage.input} in, ${tokenUsage.output} out`);
            return { ...(0, llmProvider_js_1.parseAnalysisResponse)(text), tokenUsage };
        }
        catch (err) {
            throw new Error(`Gemini: ${this.formatError(err)}`);
        }
    }
    formatError(err) {
        const msg = err instanceof Error ? err.message : String(err);
        const jsonMatch = msg.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                const geminiMsg = parsed?.error?.message;
                if (typeof geminiMsg === "string" && geminiMsg.length > 0) {
                    return geminiMsg.slice(0, 120);
                }
            }
            catch { /* ignore */ }
        }
        const statusFromMsg = Number(msg.match(/\[(\d{3})\s/)?.[1]) || undefined;
        if (statusFromMsg === 401)
            return "401 · Invalid API key";
        if (statusFromMsg === 429)
            return "429 · Rate limit exceeded";
        return msg.split("\n")[0].slice(0, 120);
    }
}
exports.GeminiProvider = GeminiProvider;
