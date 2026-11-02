"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildUserPrompt = exports.buildFocusDirective = exports.riskDirective = exports.SYSTEM_PROMPT = void 0;
exports.parseAnalysisResponse = parseAnalysisResponse;
exports.createLlmProvider = createLlmProvider;
const zod_1 = require("zod");
const claudeProvider_js_1 = require("./providers/claudeProvider.js");
const openaiProvider_js_1 = require("./providers/openaiProvider.js");
const geminiProvider_js_1 = require("./providers/geminiProvider.js");
const logger_js_1 = require("./logger.js");
const promptBuilder_js_1 = require("./promptBuilder.js");
Object.defineProperty(exports, "SYSTEM_PROMPT", { enumerable: true, get: function () { return promptBuilder_js_1.SYSTEM_PROMPT; } });
Object.defineProperty(exports, "riskDirective", { enumerable: true, get: function () { return promptBuilder_js_1.riskDirective; } });
Object.defineProperty(exports, "buildFocusDirective", { enumerable: true, get: function () { return promptBuilder_js_1.buildFocusDirective; } });
Object.defineProperty(exports, "buildUserPrompt", { enumerable: true, get: function () { return promptBuilder_js_1.buildUserPrompt; } });
const LlmResponseSchema = zod_1.z.object({
    itemReasoning: zod_1.z.string().optional(),
    situationalItems: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.number().catch(0),
        name: zod_1.z.string().catch(""),
        reason: zod_1.z.string().catch("")
    })).optional(),
    strategy: zod_1.z.object({
        winCondition: zod_1.z.enum(["early", "mid", "late"]).optional(),
        summary: zod_1.z.string().optional(),
        immediateAction: zod_1.z.string().optional(),
        lateGamePlan: zod_1.z.string().optional(),
        laneMatchupAnalysis: zod_1.z.string().optional(),
        counterPlay: zod_1.z.string().optional(),
    }).optional()
});
const DEFAULT_STRATEGY = {
    winCondition: "mid",
    summary: "",
    immediateAction: "",
    lateGamePlan: "",
};
function parseAnalysisResponse(raw) {
    try {
        const clean = raw.replace(/```(?:json)?\n?/g, "").trim();
        logger_js_1.Logger.info("[LLM] Raw response:\n" + clean);
        const parsedObj = JSON.parse(clean);
        const parsed = LlmResponseSchema.safeParse(parsedObj);
        if (!parsed.success) {
            logger_js_1.Logger.warn("[LLM] Failed to parse JSON according to schema:", parsed.error);
            return { reasoning: "", strategy: DEFAULT_STRATEGY };
        }
        const data = parsed.data;
        const situationalItems = (data.situationalItems ?? [])
            .slice(0, 4)
            .map((item) => ({
            id: item.id,
            name: item.name,
            reason: item.reason,
            priority: "situational",
        }))
            .filter((item) => item.id > 0 && item.name.length > 0);
        return {
            reasoning: data.itemReasoning ?? "",
            situationalItems,
            strategy: {
                winCondition: data.strategy?.winCondition ?? DEFAULT_STRATEGY.winCondition,
                summary: data.strategy?.summary ?? DEFAULT_STRATEGY.summary,
                immediateAction: data.strategy?.immediateAction ?? DEFAULT_STRATEGY.immediateAction,
                lateGamePlan: data.strategy?.lateGamePlan ?? DEFAULT_STRATEGY.lateGamePlan,
                laneMatchupAnalysis: data.strategy?.laneMatchupAnalysis,
                counterPlay: data.strategy?.counterPlay,
            },
        };
    }
    catch (err) {
        logger_js_1.Logger.warn("[LLM] Failed to parse raw LLM output as JSON:", err, "\nRaw was:\n" + raw);
        return { reasoning: "", strategy: DEFAULT_STRATEGY };
    }
}
/**
 * Factory function — creates the correct LlmProvider from a type string + API key.
 * Imports are now static so Webpack and pkg bundle them correctly for the .exe.
 */
async function createLlmProvider(type, apiKey, model) {
    switch (type) {
        case "claude":
            return new claudeProvider_js_1.ClaudeProvider(apiKey, model);
        case "openai":
            return new openaiProvider_js_1.OpenAiProvider(apiKey, model);
        case "gemini":
            return new geminiProvider_js_1.GeminiProvider(apiKey, model);
        default:
            throw new Error(`Unknown LLM provider: ${type}`);
    }
}
