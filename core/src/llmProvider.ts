import { z } from "zod";
import type {
  ParsedGameState,
  RecommendedItem,
  Strategy,
  RiskLevel,
} from "./types.js";
import { ClaudeProvider } from "./providers/claudeProvider.js";
import { OpenAiProvider } from "./providers/openaiProvider.js";
import { GeminiProvider } from "./providers/geminiProvider.js";
import { Logger } from "./logger.js";
import {
  type LlmContextOptions,
  SYSTEM_PROMPT,
  riskDirective,
  buildFocusDirective,
  buildUserPrompt,
} from "./promptBuilder.js";

export {
  type LlmContextOptions,
  SYSTEM_PROMPT,
  riskDirective,
  buildFocusDirective,
  buildUserPrompt,
};

const LlmResponseSchema = z.object({
  itemReasoning: z.string().optional(),
  situationalItems: z.array(z.object({
    id: z.number().catch(0),
    name: z.string().catch(""),
    reason: z.string().catch("")
  })).optional(),
  strategy: z.object({
    winCondition: z.enum(["early", "mid", "late"]).optional(),
    summary: z.string().optional(),
    immediateAction: z.string().optional(),
    lateGamePlan: z.string().optional(),
    laneMatchupAnalysis: z.string().optional(),
    counterPlay: z.string().optional(),
  }).optional()
});

export interface TokenUsage {
  input: number;
  output: number;
  cacheHit?: number;
}

export interface LlmAnalysis {
  reasoning: string;
  strategy: Strategy;
  situationalItems?: RecommendedItem[];
  tokenUsage?: TokenUsage;
}

export interface ModelInfo {
  id: string;
  displayName: string;
}

export interface LlmProvider {
  readonly name: string;
  listModels(): Promise<ModelInfo[]>;
  getAnalysis(
    state: ParsedGameState,
    risk?: RiskLevel,
    options?: LlmContextOptions,
  ): Promise<LlmAnalysis>;
}

export type ProviderType = "claude" | "openai" | "gemini";

const DEFAULT_STRATEGY: Strategy = {
  winCondition: "mid",
  summary: "",
  immediateAction: "",
  lateGamePlan: "",
};

export function parseAnalysisResponse(raw: string): LlmAnalysis {
  try {
    const clean = raw.replace(/```(?:json)?\n?/g, "").trim();
    Logger.info("[LLM] Raw response:\n" + clean);
    const parsedObj = JSON.parse(clean);
    const parsed = LlmResponseSchema.safeParse(parsedObj);

    if (!parsed.success) {
      Logger.warn("[LLM] Failed to parse JSON according to schema:", parsed.error);
      return { reasoning: "", strategy: DEFAULT_STRATEGY };
    }

    const data = parsed.data;

    const situationalItems: RecommendedItem[] = (data.situationalItems ?? [])
      .slice(0, 4)
      .map((item) => ({
        id: item.id,
        name: item.name,
        reason: item.reason,
        priority: "situational" as const,
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
  } catch (err) {
    Logger.warn("[LLM] Failed to parse raw LLM output as JSON:", err, "\nRaw was:\n" + raw);
    return { reasoning: "", strategy: DEFAULT_STRATEGY };
  }
}

/**
 * Factory function — creates the correct LlmProvider from a type string + API key.
 * Imports are now static so Webpack and pkg bundle them correctly for the .exe.
 */
export async function createLlmProvider(
  type: ProviderType,
  apiKey: string,
  model?: string,
): Promise<LlmProvider> {
  switch (type) {
    case "claude":
      return new ClaudeProvider(apiKey, model);
    case "openai":
      return new OpenAiProvider(apiKey, model);
    case "gemini":
      return new GeminiProvider(apiKey, model);
    default:
      throw new Error(`Unknown LLM provider: ${type}`);
  }
}
