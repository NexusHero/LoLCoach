import { Anthropic } from "@anthropic-ai/sdk";
import type { LlmProvider, LlmAnalysis, ModelInfo, TokenUsage, LlmContextOptions } from "../llmProvider.js";
import { SYSTEM_PROMPT, buildUserPrompt, parseAnalysisResponse } from "../llmProvider.js";
import type { ParsedGameState, RiskLevel } from "../types.js";
import { DEFAULT_RISK_LEVEL } from "../types.js";
import { Logger } from "../logger.js";

export const CLAUDE_DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export class ClaudeProvider implements LlmProvider {
  readonly name = "claude";
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(apiKey: string, model: string = CLAUDE_DEFAULT_MODEL) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async listModels(): Promise<ModelInfo[]> {
    const page = await this.client.models.list();
    return page.data.map((m) => ({
      id: m.id,
      displayName: (m as unknown as Record<string, string>).display_name ?? m.id,
    }));
  }

  async getAnalysis(
    state: ParsedGameState,
    risk: RiskLevel = DEFAULT_RISK_LEVEL,
    options?: LlmContextOptions,
  ): Promise<LlmAnalysis> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 700,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          { role: "user", content: await buildUserPrompt(state, risk, options) },
        ],
      });

      if (response.content.length === 0) return { reasoning: "", strategy: { winCondition: "mid", summary: "", immediateAction: "", lateGamePlan: "" } };
      const block = response.content[0];
      if (block.type !== "text") return { reasoning: "", strategy: { winCondition: "mid", summary: "", immediateAction: "", lateGamePlan: "" } };

      const cacheHit = (response.usage as unknown as Record<string, unknown>).cache_read_input_tokens as number ?? 0;
      const tokenUsage: TokenUsage = {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        cacheHit,
      };
      Logger.info(
        `[LLM:Claude] Input tokens: ${tokenUsage.input} (cache hit: ${cacheHit}), output tokens: ${tokenUsage.output}`,
      );

      return { ...parseAnalysisResponse(block.text), tokenUsage };
    } catch (err) {
      throw new Error(`Claude: ${this.formatError(err)}`);
    }
  }

  private formatError(err: unknown): string {
    const e = err as Record<string, unknown>;
    const nestedMsg = ((e?.error as Record<string, unknown>)?.error as Record<string, unknown> | undefined)?.message;
    if (typeof nestedMsg === "string" && nestedMsg.length > 0) {
      return nestedMsg.split("\n")[0].slice(0, 120);
    }
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
