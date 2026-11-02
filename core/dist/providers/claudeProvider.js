"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeProvider = exports.CLAUDE_DEFAULT_MODEL = void 0;
const sdk_1 = require("@anthropic-ai/sdk");
const llmProvider_js_1 = require("../llmProvider.js");
const types_js_1 = require("../types.js");
const logger_js_1 = require("../logger.js");
exports.CLAUDE_DEFAULT_MODEL = "claude-haiku-4-5-20251001";
class ClaudeProvider {
    name = "claude";
    client;
    model;
    constructor(apiKey, model = exports.CLAUDE_DEFAULT_MODEL) {
        this.client = new sdk_1.Anthropic({ apiKey });
        this.model = model;
    }
    async listModels() {
        const page = await this.client.models.list();
        return page.data.map((m) => ({
            id: m.id,
            displayName: m.display_name ?? m.id,
        }));
    }
    async getAnalysis(state, risk = types_js_1.DEFAULT_RISK_LEVEL, options) {
        try {
            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: 700,
                system: [
                    {
                        type: "text",
                        text: llmProvider_js_1.SYSTEM_PROMPT,
                        cache_control: { type: "ephemeral" },
                    },
                ],
                messages: [
                    { role: "user", content: await (0, llmProvider_js_1.buildUserPrompt)(state, risk, options) },
                ],
            });
            if (response.content.length === 0)
                return { reasoning: "", strategy: { winCondition: "mid", summary: "", immediateAction: "", lateGamePlan: "" } };
            const block = response.content[0];
            if (block.type !== "text")
                return { reasoning: "", strategy: { winCondition: "mid", summary: "", immediateAction: "", lateGamePlan: "" } };
            const cacheHit = response.usage.cache_read_input_tokens ?? 0;
            const tokenUsage = {
                input: response.usage.input_tokens,
                output: response.usage.output_tokens,
                cacheHit,
            };
            logger_js_1.Logger.info(`[LLM:Claude] Input tokens: ${tokenUsage.input} (cache hit: ${cacheHit}), output tokens: ${tokenUsage.output}`);
            return { ...(0, llmProvider_js_1.parseAnalysisResponse)(block.text), tokenUsage };
        }
        catch (err) {
            throw new Error(`Claude: ${this.formatError(err)}`);
        }
    }
    formatError(err) {
        const e = err;
        const nestedMsg = e?.error?.error?.message;
        if (typeof nestedMsg === "string" && nestedMsg.length > 0) {
            return nestedMsg.split("\n")[0].slice(0, 120);
        }
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
exports.ClaudeProvider = ClaudeProvider;
