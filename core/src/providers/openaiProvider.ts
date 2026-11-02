import OpenAI from "openai";
import type { LlmProvider, LlmAnalysis, ModelInfo, TokenUsage, LlmContextOptions } from "../llmProvider.js";
import { SYSTEM_PROMPT, buildUserPrompt, parseAnalysisResponse } from "../llmProvider.js";
import type { ParsedGameState, RiskLevel } from "../types.js";
import { DEFAULT_RISK_LEVEL } from "../types.js";
import { Logger } from "../logger.js";

export const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";

export class OpenAiProvider implements LlmProvider {
  readonly name = "openai";
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string, model: string = OPENAI_DEFAULT_MODEL) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async listModels(): Promise<ModelInfo[]> {
    const page = await this.client.models.list();
    return page.data
      .filter((m) => /^(gpt-|o1|o3|o4)/.test(m.id) && !m.id.includes(":"))
      .sort((a, b) => b.created - a.created)
      .map((m) => ({ id: m.id, displayName: m.id }));
  }

  async getAnalysis(
    state: ParsedGameState,
    risk: RiskLevel = DEFAULT_RISK_LEVEL,
    options?: LlmContextOptions,
  ): Promise<LlmAnalysis> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: await buildUserPrompt(state, risk, options) },
        ],
      });

      const text = response.choices[0]?.message?.content;
      if (!text) return { reasoning: "", strategy: { winCondition: "mid", summary: "", immediateAction: "", lateGamePlan: "" } };

      const tokenUsage: TokenUsage = {
        input: response.usage?.prompt_tokens ?? 0,
        output: response.usage?.completion_tokens ?? 0,
      };
      Logger.info(
        `[LLM:OpenAI] Tokens: ${tokenUsage.input} in, ${tokenUsage.output} out`,
      );

      return { ...parseAnalysisResponse(text), tokenUsage };
    } catch (err) {
      throw new Error(`OpenAI: ${this.formatError(err)}`);
    }
  }

  private formatError(err: unknown): string {
    const e = err as Record<string, unknown>;
    const apiBodyMsg = (e?.error as Record<string, unknown> | undefined)?.message;
    if (typeof apiBodyMsg === "string" && apiBodyMsg.length > 0) {
      return apiBodyMsg.split("\n")[0].slice(0, 120);
    }
    const msg = err instanceof Error ? err.message : String(err);
    const status = e?.status as number | undefined;
    if (status === 401) return "401 · Invalid API key";
    if (status === 429) return "429 · Rate limit exceeded";
    return msg.split("\n")[0].slice(0, 120);
  }
}
