import { GoogleGenAI } from "@google/genai";
import type { LlmProvider, LlmAnalysis, ModelInfo, TokenUsage, LlmContextOptions } from "../llmProvider.js";
import { SYSTEM_PROMPT, buildUserPrompt, parseAnalysisResponse } from "../llmProvider.js";
import type { ParsedGameState, RiskLevel } from "../types.js";
import { DEFAULT_RISK_LEVEL } from "../types.js";
import { Logger } from "../logger.js";


export const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

export class GeminiProvider implements LlmProvider {
  readonly name = "gemini";
  private readonly client: GoogleGenAI;
  private readonly modelId: string;
  private readonly apiKey: string;

  constructor(apiKey: string, model: string = GEMINI_DEFAULT_MODEL) {
    this.client = new GoogleGenAI({ apiKey });
    this.modelId = model;
    this.apiKey = apiKey;
  }

  async listModels(): Promise<ModelInfo[]> {
    type GeminiModel = { name: string; displayName: string; supportedGenerationMethods: string[] };
    const all: GeminiModel[] = [];
    let pageToken: string | undefined;

    do {
      const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
      url.searchParams.set("key", this.apiKey);
      url.searchParams.set("pageSize", "100");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`Gemini models API returned ${res.status}`);
      const data = await res.json() as { models?: GeminiModel[]; nextPageToken?: string };
      all.push(...(data.models ?? []));
      pageToken = data.nextPageToken;
    } while (pageToken);

    const fetchedModels = all
      .filter((m) => m.supportedGenerationMethods.includes("generateContent"))
      .map((m) => ({
        id: m.name.replace("models/", ""),
        displayName: m.displayName,
      }));

    const extraModels: ModelInfo[] = [
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

  async getAnalysis(
    state: ParsedGameState,
    risk: RiskLevel = DEFAULT_RISK_LEVEL,
    options?: LlmContextOptions,
  ): Promise<LlmAnalysis> {
    try {
      const result = await this.client.models.generateContent({
        model: this.modelId,
        contents: await buildUserPrompt(state, risk, options),
        config: {
          systemInstruction: SYSTEM_PROMPT,
          maxOutputTokens: 700,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      const text = result.text;
      if (!text) return { reasoning: "", strategy: { winCondition: "mid", summary: "", immediateAction: "", lateGamePlan: "" } };

      const meta = result.usageMetadata;
      const tokenUsage: TokenUsage = {
        input: meta?.promptTokenCount ?? 0,
        output: meta?.candidatesTokenCount ?? 0,
      };
      Logger.info(`[LLM:Gemini] Tokens: ${tokenUsage.input} in, ${tokenUsage.output} out`);

      return { ...parseAnalysisResponse(text), tokenUsage };
    } catch (err) {
      throw new Error(`Gemini: ${this.formatError(err)}`);
    }
  }

  private formatError(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err);
    const jsonMatch = msg.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        const geminiMsg = (parsed?.error as Record<string, unknown> | undefined)?.message;
        if (typeof geminiMsg === "string" && geminiMsg.length > 0) {
          return geminiMsg.slice(0, 120);
        }
      } catch { /* ignore */ }
    }
    const statusFromMsg = Number(msg.match(/\[(\d{3})\s/)?.[1]) || undefined;
    if (statusFromMsg === 401) return "401 · Invalid API key";
    if (statusFromMsg === 429) return "429 · Rate limit exceeded";
    return msg.split("\n")[0].slice(0, 120);
  }
}
