import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";
import type { PostGameAutopsy } from "./types.js";

const MEMORY_DIR =
  process.platform === "win32"
    ? join(process.env.LOCALAPPDATA ?? tmpdir(), "lolcoach")
    : join(homedir(), ".cache", "lolcoach");

const VECTOR_FILE = join(MEMORY_DIR, "vector_memory.json");
const LOCAL_DIM = 64;

export interface VectorMemoryDocument {
  id: string;
  type: "autopsy" | "matchup_note";
  myChampion: string;
  opponentChampion?: string;
  text: string;
  vector: number[];
  timestamp: number;
}

export interface EmbeddingConfig {
  provider: "openai" | "gemini" | "claude" | "none";
  apiKey?: string;
}

export function computeLocalEmbedding(text: string): number[] {
  const vec = new Array<number>(LOCAL_DIM).fill(0);
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const tokens = normalized.split(/\s+/).filter((t) => t.length >= 2);

  for (const token of tokens) {
    let hash = 2166136261;
    for (let i = 0; i < token.length; i++) {
      hash ^= token.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const idx = Math.abs(hash) % LOCAL_DIM;
    const sign = (hash & 1) === 0 ? 1 : -1;
    vec[idx] += sign * 1.5;

    // Character trigram features for fuzzy morphological similarity
    for (let i = 0; i <= token.length - 3; i++) {
      const tri = token.slice(i, i + 3);
      let triHash = 5381;
      for (let j = 0; j < 3; j++) {
        triHash = ((triHash << 5) + triHash) ^ tri.charCodeAt(j);
      }
      const triIdx = Math.abs(triHash) % LOCAL_DIM;
      vec[triIdx] += 0.5;
    }
  }

  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vec;
  return vec.map((v) => Number((v / norm).toFixed(5)));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export class VectorMemoryService {
  private docs: VectorMemoryDocument[] = [];
  private loaded = false;
  private embeddingConfig: EmbeddingConfig = { provider: "none" };
  private readonly persistToDisk: boolean;

  constructor(persistToDisk: boolean = process.env.NODE_ENV !== "test") {
    this.persistToDisk = persistToDisk;
  }

  setEmbeddingConfig(config: EmbeddingConfig): void {
    this.embeddingConfig = config;
  }

  async load(): Promise<void> {
    if (this.loaded || !this.persistToDisk) return;
    this.loaded = true;
    try {
      const raw = await readFile(VECTOR_FILE, "utf-8");
      const parsed = JSON.parse(raw) as { docs?: VectorMemoryDocument[] };
      if (Array.isArray(parsed.docs)) {
        this.docs = parsed.docs.slice(-200);
      }
    } catch {
      // Fresh vector store
    }
  }

  private async save(): Promise<void> {
    if (!this.persistToDisk) return;
    try {
      await mkdir(MEMORY_DIR, { recursive: true });
      await writeFile(
        VECTOR_FILE,
        JSON.stringify({ docs: this.docs.slice(-200) }, null, 2),
        "utf-8",
      );
    } catch {
      // Ignore write errors in restricted environments
    }
  }

  async embedText(text: string): Promise<number[]> {
    const { provider, apiKey } = this.embeddingConfig;
    if (!apiKey || process.env.NODE_ENV === "test") {
      return computeLocalEmbedding(text);
    }

    try {
      if (provider === "openai") {
        const res = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "text-embedding-3-small",
            input: text,
          }),
        });
        if (res.ok) {
          const json = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
          const emb = json.data?.[0]?.embedding;
          if (emb && emb.length > 0) return emb;
        }
      } else if (provider === "gemini") {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "models/text-embedding-004",
            content: { parts: [{ text }] },
          }),
        });
        if (res.ok) {
          const json = (await res.json()) as { embedding?: { values?: number[] } };
          const emb = json.embedding?.values;
          if (emb && emb.length > 0) return emb;
        }
      }
    } catch {
      // Fall through to deterministic local vector embedding
    }

    return computeLocalEmbedding(text);
  }

  async storeMatchupNote(
    myChampion: string,
    noteText: string,
    opponentChampion?: string,
    timestamp: number = Date.now(),
  ): Promise<VectorMemoryDocument> {
    await this.load();
    const fullText = opponentChampion
      ? `[${myChampion} vs ${opponentChampion}] ${noteText}`
      : `[${myChampion}] ${noteText}`;
    const vector = await this.embedText(fullText);
    const doc: VectorMemoryDocument = {
      id: `note_${timestamp}_${this.docs.length + 1}`,
      type: "matchup_note",
      myChampion,
      ...(opponentChampion ? { opponentChampion } : {}),
      text: fullText,
      vector,
      timestamp,
    };
    this.docs.push(doc);
    await this.save();
    return doc;
  }

  async storeAutopsy(
    autopsy: PostGameAutopsy,
    opponentChampion?: string,
  ): Promise<VectorMemoryDocument> {
    await this.load();
    const vsPart = opponentChampion ? ` vs ${opponentChampion}` : "";
    const text = `Match ${autopsy.championName} (${autopsy.role}${vsPart}): KDA ${autopsy.kda}, ${autopsy.csPerMin} CS/m. ${autopsy.praise} Mistakes: ${autopsy.mistakes.join(" ")}`;
    const vector = await this.embedText(text);
    const doc: VectorMemoryDocument = {
      id: `autopsy_${autopsy.timestamp}`,
      type: "autopsy",
      myChampion: autopsy.championName,
      ...(opponentChampion ? { opponentChampion } : {}),
      text,
      vector,
      timestamp: autopsy.timestamp,
    };
    this.docs.push(doc);
    await this.save();
    return doc;
  }

  async searchRelevantMemories(
    query: string,
    myChampion?: string,
    opponentChampion?: string,
    topK = 3,
  ): Promise<string[]> {
    await this.load();
    if (this.docs.length === 0) return [];

    const queryVector = await this.embedText(query);
    const localQueryVec = computeLocalEmbedding(query);

    const scored = this.docs.map((doc) => {
      const sim =
        doc.vector.length === queryVector.length
          ? cosineSimilarity(queryVector, doc.vector)
          : cosineSimilarity(localQueryVec, computeLocalEmbedding(doc.text));

      let matchupBoost = 0;
      if (myChampion && doc.myChampion.toLowerCase() === myChampion.toLowerCase()) {
        matchupBoost += 0.25;
      }
      if (
        opponentChampion &&
        doc.opponentChampion &&
        doc.opponentChampion.toLowerCase() === opponentChampion.toLowerCase()
      ) {
        matchupBoost += 0.45;
      }
      if (doc.type === "matchup_note") {
        matchupBoost += 0.1;
      }

      return { doc, score: sim + matchupBoost };
    });

    return scored
      .filter((s) => s.score >= 0.15)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((s) => s.doc.text);
  }

  getAllDocuments(): VectorMemoryDocument[] {
    return [...this.docs];
  }
}
