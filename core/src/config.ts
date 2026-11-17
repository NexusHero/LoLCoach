export interface AppConfig {
  riot: {
    liveClientUrl: string;
    maxPollFailures: number;
  };
  game: {
    highGoldThreshold: number;
  };
  llm: {
    defaultCooldownMs: number;
    defaultTokenBudget: number;
  };
  ws: {
    port: number;
    host: string;
  };
}

export const config: AppConfig = {
  riot: {
    liveClientUrl: process.env.LIVE_CLIENT_URL || "https://127.0.0.1:2999/liveclientdata/allgamedata",
    maxPollFailures: Number.parseInt(process.env.MAX_POLL_FAILURES || "3", 10),
  },
  game: {
    highGoldThreshold: Number.parseInt(process.env.HIGH_GOLD_THRESHOLD || "1000", 10),
  },
  llm: {
    defaultCooldownMs: Number.parseInt(process.env.DEFAULT_LLM_COOLDOWN_MS || String(7 * 60 * 1000), 10),
    defaultTokenBudget: Number.parseInt(process.env.DEFAULT_TOKEN_BUDGET || "0", 10),
  },
  ws: {
    port: Number.parseInt(process.env.PORT || "8765", 10),
    host: process.env.WS_HOST || "127.0.0.1",
  },
};
