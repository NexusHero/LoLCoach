import { readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AnalysisSnapshot } from "../analysisTypes";
import { AnalysisStore } from "../analysisStore";
import { AnalysisService } from "../analysisService";
import { BenchmarkAggregator, SAMPLES_PER_TIER, toBenchmark } from "../benchmarkAggregator";
import type { LlmProvider } from "../llmProvider";
import { RateLimiter, RiotApiError, type RiotApiClient, type RiotMatch, type RiotTimeline } from "../riotApi";
import type { TierAggregate } from "../analysisStore";

const baseMatch = JSON.parse(readFileSync(join(__dirname, "fixtures", "match.json"), "utf8")) as RiotMatch;
const timeline = JSON.parse(readFileSync(join(__dirname, "fixtures", "timeline.json"), "utf8")) as RiotTimeline;

function matchWithId(id: string, start: number): RiotMatch {
  return {
    ...baseMatch,
    metadata: { ...baseMatch.metadata, matchId: id },
    info: { ...baseMatch.info, gameStartTimestamp: start },
  };
}

function fakeClient(matchIds: string[], overrides: Partial<Record<keyof RiotApiClient, unknown>> = {}): RiotApiClient {
  return {
    accountByRiotId: async () => ({ puuid: "PUUID_8", gameName: "Tester", tagLine: "EUW" }),
    leagueEntriesByPuuid: async () => [
      { queueType: "RANKED_SOLO_5x5", tier: "PLATINUM", rank: "II", leaguePoints: 9, wins: 10, losses: 9 },
    ],
    matchIdsByPuuid: async () => matchIds,
    match: async (id: string) => matchWithId(id, 1_000 + matchIds.indexOf(id) * -10),
    timeline: async () => timeline,
    ladderPuuids: async () => [],
    ...overrides,
  } as unknown as RiotApiClient;
}

function fakeLlm(reply: string): LlmProvider & { calls: string[] } {
  const calls: string[] = [];
  return {
    name: "fake",
    calls,
    listModels: async () => [],
    getAnalysis: async () => ({ reasoning: "", strategy: { winCondition: "mid", summary: "", lateGamePlan: "" } }),
    completeText: async (system: string) => {
      calls.push(system.slice(0, 40));
      return { text: reply };
    },
  };
}

function setup(client: RiotApiClient, llm: LlmProvider | null = null) {
  const store = new AnalysisStore(mkdtempSync(join(tmpdir(), "lolcoach-analysis-")));
  const snapshots: AnalysisSnapshot[] = [];
  const notes: string[] = [];
  const service = new AnalysisService({
    store,
    broadcast: (s) => snapshots.push(s),
    items: () => undefined,
    isGameActive: () => false,
    storeMatchupNote: async (_c, note) => notes.push(note),
    clientFactory: () => client,
    readKey: () => "RGAPI-test",
    now: () => 5_000,
    schedule: () => {},
  });
  service.setLlmProvider(llm);
  return { service, store, snapshots, notes };
}

describe("AnalysisService", () => {
  it("setRiotId_FirstSync_BackfillsWithoutPerGameReviewsAndWritesSummaryAndGoal", async () => {
    const llm = fakeLlm('{"review":"r","insight":"i"}');
    const { service } = setup(fakeClient(["EUW1_2", "EUW1_1"]), llm);

    await service.setRiotId("Tester#EUW", "EUW");
    const snap = service.snapshot();

    expect(snap.rank).toMatchObject({ tier: "PLATINUM", division: "II" });
    expect(snap.nextTier).toBe("EMERALD");
    expect(snap.matches.map((m) => m.matchId)).toEqual(["EUW1_2", "EUW1_1"]);
    expect(snap.matches.every((m) => m.aiReview === undefined)).toBe(true);
    expect(snap.backfillSummary).toBeDefined();
    expect(snap.goal).toBeUndefined(); // no benchmark collected yet
    expect(snap.sync.state).toBe("idle");
  });

  it("refresh_NewGameAfterBackfill_GetsAiReviewAndStoresMatchupInsight", async () => {
    const ids = ["EUW1_1"];
    const llm = fakeLlm('{"review":"You lost lane after two deaths.","insight":"Respect Hwei level 6."}');
    const { service, notes } = setup(fakeClient(ids, { matchIdsByPuuid: async () => [...ids] }), llm);
    await service.setRiotId("Tester#EUW", "EUW");

    ids.unshift("EUW1_9");
    await service.refresh();

    const newest = service.snapshot().matches.find((m) => m.matchId === "EUW1_9");
    expect(newest?.aiReview).toBe("You lost lane after two deaths.");
    expect(notes).toContain("Respect Hwei level 6.");
  });

  it("refresh_RiotRejectsKey_ReportsKeyProblem", async () => {
    const client = fakeClient([], {
      accountByRiotId: async () => {
        throw new RiotApiError("Riot API 403", 403);
      },
    });
    const { service } = setup(client);

    await service.setRiotId("Tester#EUW", "EUW");

    expect(service.snapshot().keyProblem).toBe("invalid_or_expired");
    expect(service.snapshot().sync.state).toBe("error");
  });

  it("refresh_NoLlmProvider_StillComputesMetrics", async () => {
    const { service } = setup(fakeClient(["EUW1_1"]));

    await service.setRiotId("Tester#EUW", "EUW");

    expect(service.snapshot().matches[0].csDiff10).toBe(22);
  });

  it("aggregation_NextTierBenchmarkReady_CreatesTemplateGoalWithoutProvider", async () => {
    // Every ladder game is the fixture, so EMERALD fills up with mirrored mid-lane samples.
    let n = 0;
    const client = fakeClient(["EUW1_1"], {
      ladderPuuids: async () => Array.from({ length: 200 }, (_, i) => `p${i}`),
      matchIdsByPuuid: async (puuid: string) => (puuid === "PUUID_8" ? ["EUW1_1"] : [`L_${n++}`]),
    });
    const { service } = setup(client);

    await service.setRiotId("Tester#EUW", "EUW");
    // Collection runs in the background; wait until the goal appears (bounded).
    for (let i = 0; i < 200 && !service.snapshot().goal; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }

    const snap = service.snapshot();
    const emerald = snap.benchmarks.find((b) => b.tier === "EMERALD");
    expect(emerald?.sampleSize).toBeGreaterThanOrEqual(100);
    expect(snap.goal?.basedOnTier).toBe("EMERALD");
    expect(snap.goal?.text).toMatch(/^Next 5 games/);
  });

  it("ask_WithoutProvider_ReturnsError", async () => {
    const { service } = setup(fakeClient(["EUW1_1"]));
    await service.setRiotId("Tester#EUW", "EUW");

    const answer = await service.ask("Why do I lose lane?", "q1");

    expect(answer).toEqual({ requestId: "q1", error: "No AI provider configured" });
  });

  it("ask_WithProvider_ReturnsAnswerForRequestId", async () => {
    const { service } = setup(fakeClient(["EUW1_1"]), fakeLlm("Because of early deaths."));
    await service.setRiotId("Tester#EUW", "EUW");

    const answer = await service.ask("Why do I lose lane?", "q2");

    expect(answer).toEqual({ requestId: "q2", answer: "Because of early deaths." });
  });
});

describe("BenchmarkAggregator", () => {
  it("run_LadderGames_AggregatesBothLanersOfTheRoleAndStopsWhenLadderExhausted", async () => {
    let saved: TierAggregate[] = [];
    const client = fakeClient([], {
      ladderPuuids: async () => ["p1"],
      matchIdsByPuuid: async () => ["EUW1_100"],
    });
    const aggregator = new BenchmarkAggregator({
      client: () => client,
      isGameActive: () => false,
      load: async () => [],
      save: async (a) => {
        saved = a;
      },
      onProgress: () => {},
    });

    await aggregator.run(["MASTER"], "MIDDLE", "16.22");

    expect(saved[0].samples).toBe(2);
    expect(saved[0].seenMatchIds).toEqual(["EUW1_100"]);
    const benchmark = toBenchmark(saved[0]);
    expect(benchmark?.cs10).toBe((95 + 73) / 2); // Malzahar and Hwei at 10:00
    expect(aggregator.getProgress().state).toBe("done");
    expect(aggregator.getProgress().tiers[0]).toEqual({ tier: "MASTER", samples: 2, target: SAMPLES_PER_TIER });
  });

  it("run_OtherPatch_SkipsMatches", async () => {
    let saved: TierAggregate[] = [];
    const client = fakeClient([], {
      ladderPuuids: async () => ["p1"],
      matchIdsByPuuid: async () => ["EUW1_100"],
    });
    const aggregator = new BenchmarkAggregator({
      client: () => client,
      isGameActive: () => false,
      load: async () => [],
      save: async (a) => {
        saved = a;
      },
      onProgress: () => {},
    });

    await aggregator.run(["MASTER"], "MIDDLE", "16.21");

    expect(saved[0].samples).toBe(0);
  });
});

describe("RateLimiter", () => {
  it("acquire_BeyondShortWindow_WaitsUntilWindowFrees", async () => {
    let t = 0;
    const waits: number[] = [];
    const limiter = new RateLimiter(
      [{ limit: 2, windowMs: 1_000 }],
      () => t,
      async (ms) => {
        waits.push(ms);
        t += ms;
      },
    );

    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();

    expect(waits).toEqual([1_005]);
  });
});
