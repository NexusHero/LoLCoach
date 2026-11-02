"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAiProvider = exports.OPENAI_DEFAULT_MODEL = void 0;
const openai_1 = __importDefault(require("openai"));
const llmProvider_js_1 = require("../llmProvider.js");
const types_js_1 = require("../types.js");
const logger_js_1 = require("../logger.js");
exports.OPENAI_DEFAULT_MODEL = "gpt-4o-mini";
class OpenAiProvider {
    name = "openai";
    client;
    model;
    constructor(apiKey, model = exports.OPENAI_DEFAULT_MODEL) {
        this.client = new openai_1.default({ apiKey });
        this.model = model;
    }
    async listModels() {
        const page = await this.client.models.list();
        return page.data
            .filter((m) => /^(gpt-|o1|o3|o4)/.test(m.id) && !m.id.includes(":"))
            .sort((a, b) => b.created - a.created)
            .map((m) => ({ id: m.id, displayName: m.id }));
    }
    async getAnalysis(state, risk = types_js_1.DEFAULT_RISK_LEVEL, options) {
        try {
            const response = await this.client.chat.completions.create({
                model: this.model,
                max_tokens: 700,
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: llmProvider_js_1.SYSTEM_PROMPT },
                    { role: "user", content: await (0, llmProvider_js_1.buildUserPrompt)(state, risk, options) },
                ],
            });
            const text = response.choices[0]?.message?.content;
            if (!text)
                return { reasoning: "", strategy: { winCondition: "mid", summary: "", immediateAction: "", lateGamePlan: "" } };
            const tokenUsage = {
                input: response.usage?.prompt_tokens ?? 0,
                output: response.usage?.completion_tokens ?? 0,
            };
            logger_js_1.Logger.info(`[LLM:OpenAI] Tokens: ${tokenUsage.input} in, ${tokenUsage.output} out`);
            return { ...(0, llmProvider_js_1.parseAnalysisResponse)(text), tokenUsage };
        }
        catch (err) {
            throw new Error(`OpenAI: ${this.formatError(err)}`);
        }
    }
    formatError(err) {
        const e = err;
        const apiBodyMsg = e?.error?.message;
        if (typeof apiBodyMsg === "string" && apiBodyMsg.length > 0) {
            return apiBodyMsg.split("\n")[0].slice(0, 120);
        }
        const msg = err instanceof Error ? err.message : String(err);
        const status = e?.status;
        if (status === 401)
            return "401 · Invalid API key";
        if (status === 429)
            return "429 · Rate limit exceeded";
        return msg.split("\n")[0].slice(0, 120);
    }
}
exports.OpenAiProvider = OpenAiProvider;
