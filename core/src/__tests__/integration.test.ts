import { BridgeOrchestrator } from "../orchestrator.js";
import { EventDetector } from "../eventDetector.js";
import { RecommendationEngine } from "../recommendationEngine.js";
import type { IWsBroadcaster } from "../interfaces.js";
import { makeRawGameData, makePlayer, makeActivePlayer } from "./fixtures.js";
import type { LlmProvider } from "../llmProvider.js";
import type { WsMessage } from "../types.js";

describe("Integration: Match Progressions", () => {
  function setup() {
    let currentTime = 1000;
    const clock = () => currentTime;
    const advanceTime = (ms: number) => { currentTime += ms; };

    const broadcasts: WsMessage[] = [];
    const wsServer = {
      broadcast: jest.fn((msg: WsMessage) => broadcasts.push(msg)),
      clientCount: 1,
      close: jest.fn(),
    } as unknown as IWsBroadcaster;

    const llmProvider = {
      name: "mock-llm",
      getAnalysis: jest.fn().mockResolvedValue({
        reasoning: "Mock Integration Reason",
        strategy: {
          winCondition: "mid",
          summary: "Scale into mid game.",
          lateGamePlan: "Fight with full build.",
        },
      }),
    } as unknown as LlmProvider;

    const orchestrator = new BridgeOrchestrator(
      wsServer,
      new EventDetector(),
      new RecommendationEngine(),
      llmProvider,
      { summonerName: "TestPlayer", llmCooldownMs: 7 * 60 * 1000 },
      clock,
    );

    return { orchestrator, wsServer, llmProvider, broadcasts, advanceTime };
  }

  const makeEnemy = (championName: string, kills: number, deaths: number, level: number) =>
    makePlayer({
      team: "CHAOS",
      summonerName: championName + "Player",
      championName,
      level,
      scores: { kills, deaths, assists: 0, creepScore: level * 10, wardScore: 0 },
    });

  const getLatestLlmCallArg = (llmProvider: any): any => {
    const calls = llmProvider.getAnalysis.mock.calls;
    if (calls.length === 0) return null;
    return calls[calls.length - 1][0];
  };

  it("handleGameData_PlayerLosingHard_LlmCalledOnGameStartAndEachDeath", async () => {
    const { orchestrator, advanceTime, llmProvider } = setup();

    await orchestrator.handleGameData(makeRawGameData([
      makePlayer({ championName: "Lux", level: 5, scores: { kills: 0, deaths: 3, assists: 0, creepScore: 20, wardScore: 0 } }),
      makeEnemy("Zed", 3, 0, 6),
    ]));
    expect(llmProvider.getAnalysis).toHaveBeenCalledTimes(1);

    advanceTime(10 * 60 * 1000);

    const rawMid = makeRawGameData([
      makePlayer({ championName: "Lux", level: 9, isDead: true, scores: { kills: 0, deaths: 8, assists: 1, creepScore: 60, wardScore: 0 } }),
      makeEnemy("Zed", 10, 0, 12),
    ]);
    rawMid.activePlayer = makeActivePlayer({ currentGold: 1200 });
    await orchestrator.handleGameData(rawMid);

    expect(llmProvider.getAnalysis).toHaveBeenCalledTimes(2);
    expect(getLatestLlmCallArg(llmProvider).localPlayer.scores.deaths).toBe(8);
  });

  it("handleGameData_PlayerWinningHard_LlmCalledOnGameStartAndDeath", async () => {
    const { orchestrator, advanceTime, llmProvider } = setup();

    await orchestrator.handleGameData(makeRawGameData([
      makePlayer({ championName: "Draven", level: 5, scores: { kills: 4, deaths: 0, assists: 0, creepScore: 40, wardScore: 0 } }),
      makeEnemy("Vayne", 0, 4, 4),
    ]));

    advanceTime(10 * 60 * 1000);

    const rawMid = makeRawGameData([
      makePlayer({ championName: "Draven", level: 11, isDead: true, scores: { kills: 12, deaths: 0, assists: 2, creepScore: 120, wardScore: 0 } }),
      makeEnemy("Vayne", 0, 8, 8),
    ]);
    rawMid.activePlayer = makeActivePlayer({ currentGold: 3000 });
    await orchestrator.handleGameData(rawMid);

    expect(llmProvider.getAnalysis).toHaveBeenCalledTimes(2);
    expect(getLatestLlmCallArg(llmProvider).localPlayer.scores.kills).toBe(12);
  });

  it("handleGameData_WinEarlyLoseMidWinLate_LlmCalledOnEachDeath", async () => {
    const { orchestrator, advanceTime, llmProvider } = setup();

    await orchestrator.handleGameData(makeRawGameData([
      makePlayer({ championName: "Ahri", level: 6, scores: { kills: 2, deaths: 0, assists: 0, creepScore: 50, wardScore: 0 } }),
      makeEnemy("Yasuo", 0, 2, 5),
    ]));

    advanceTime(15 * 60 * 1000);

    const rawMid = makeRawGameData([
      makePlayer({ championName: "Ahri", level: 12, isDead: true, scores: { kills: 2, deaths: 5, assists: 1, creepScore: 100, wardScore: 0 } }),
      makeEnemy("Yasuo", 6, 2, 13),
    ]);
    rawMid.activePlayer = makeActivePlayer({ currentGold: 1100 });
    await orchestrator.handleGameData(rawMid);
    expect(getLatestLlmCallArg(llmProvider).localPlayer.scores.deaths).toBe(5);

    advanceTime(20 * 60 * 1000);
    orchestrator.resetDetector();

    const rawLate = makeRawGameData([
      makePlayer({ championName: "Ahri", level: 18, isDead: true, scores: { kills: 10, deaths: 5, assists: 8, creepScore: 250, wardScore: 0 } }),
      makeEnemy("Yasuo", 7, 7, 17),
    ]);
    rawLate.activePlayer = makeActivePlayer({ currentGold: 2500 });
    await orchestrator.handleGameData(rawLate);
    expect(getLatestLlmCallArg(llmProvider).localPlayer.scores.kills).toBe(10);
  });

  it("handleGameData_LoseEarlyLoseMidWinLate_LlmTracksScalingChampion", async () => {
    const { orchestrator, advanceTime, llmProvider } = setup();

    await orchestrator.handleGameData(makeRawGameData([
      makePlayer({ championName: "Kayle", level: 4, scores: { kills: 0, deaths: 2, assists: 0, creepScore: 20, wardScore: 0 } }),
      makeEnemy("Renekton", 2, 0, 5),
    ]));

    advanceTime(15 * 60 * 1000);

    const rawMid = makeRawGameData([
      makePlayer({ championName: "Kayle", level: 10, isDead: true, scores: { kills: 0, deaths: 6, assists: 0, creepScore: 80, wardScore: 0 } }),
      makeEnemy("Renekton", 7, 0, 12),
    ]);
    rawMid.activePlayer = makeActivePlayer({ currentGold: 1200 });
    await orchestrator.handleGameData(rawMid);
    expect(getLatestLlmCallArg(llmProvider).localPlayer.scores.deaths).toBe(6);

    advanceTime(20 * 60 * 1000);
    orchestrator.resetDetector();

    const rawLate = makeRawGameData([
      makePlayer({ championName: "Kayle", level: 16, isDead: true, scores: { kills: 8, deaths: 6, assists: 4, creepScore: 300, wardScore: 0 } }),
      makeEnemy("Renekton", 8, 5, 15),
    ]);
    rawLate.activePlayer = makeActivePlayer({ currentGold: 3000 });
    await orchestrator.handleGameData(rawLate);
    expect(getLatestLlmCallArg(llmProvider).localPlayer.scores.kills).toBe(8);
  });

  it("handleGameData_WinAllThreePhases_LlmCalledForEachDeathEvent", async () => {
    const { orchestrator, advanceTime, llmProvider } = setup();

    await orchestrator.handleGameData(makeRawGameData([
      makePlayer({ championName: "Lee Sin", level: 5, scores: { kills: 3, deaths: 0, assists: 0, creepScore: 40, wardScore: 0 } }),
      makeEnemy("Amumu", 0, 2, 4),
    ]));

    advanceTime(15 * 60 * 1000);

    const rawMid = makeRawGameData([
      makePlayer({ championName: "Lee Sin", level: 13, isDead: true, scores: { kills: 9, deaths: 1, assists: 5, creepScore: 120, wardScore: 0 } }),
      makeEnemy("Amumu", 0, 5, 10),
    ]);
    rawMid.activePlayer = makeActivePlayer({ currentGold: 1500 });
    await orchestrator.handleGameData(rawMid);

    advanceTime(15 * 60 * 1000);
    orchestrator.resetDetector();

    const rawLate = makeRawGameData([
      makePlayer({ championName: "Lee Sin", level: 18, isDead: true, scores: { kills: 15, deaths: 2, assists: 10, creepScore: 200, wardScore: 0 } }),
      makeEnemy("Amumu", 1, 9, 15),
    ]);
    rawLate.activePlayer = makeActivePlayer({ currentGold: 2000 });
    await orchestrator.handleGameData(rawLate);
    expect(getLatestLlmCallArg(llmProvider).localPlayer.scores.kills).toBe(15);
  });

  it("handleGameData_ThreeConsecutiveDeaths_EachDeathTriggersLlmWithoutCooldown", async () => {
    // Each death uses a different gold amount so cache keys differ → fresh LLM call each time
    const { orchestrator, llmProvider } = setup();

    const raw1 = makeRawGameData([makePlayer({ championName: "Yasuo", isDead: false })]);
    raw1.activePlayer = makeActivePlayer({ currentGold: 500 });
    await orchestrator.handleGameData(raw1);
    expect(llmProvider.getAnalysis).toHaveBeenCalledTimes(1);

    const raw2 = makeRawGameData([makePlayer({ championName: "Yasuo", isDead: true })]);
    raw2.activePlayer = makeActivePlayer({ currentGold: 1100 });
    await orchestrator.handleGameData(raw2);
    expect(llmProvider.getAnalysis).toHaveBeenCalledTimes(2);

    const raw3 = makeRawGameData([makePlayer({ championName: "Yasuo", isDead: false })]);
    raw3.activePlayer = makeActivePlayer({ currentGold: 1100 });
    await orchestrator.handleGameData(raw3);
    expect(llmProvider.getAnalysis).toHaveBeenCalledTimes(2);

    const raw4 = makeRawGameData([makePlayer({ championName: "Yasuo", isDead: true })]);
    raw4.activePlayer = makeActivePlayer({ currentGold: 1700 });
    await orchestrator.handleGameData(raw4);
    expect(llmProvider.getAnalysis).toHaveBeenCalledTimes(3);

    const raw5 = makeRawGameData([makePlayer({ championName: "Yasuo", isDead: false })]);
    raw5.activePlayer = makeActivePlayer({ currentGold: 1700 });
    await orchestrator.handleGameData(raw5);
    const raw6 = makeRawGameData([makePlayer({ championName: "Yasuo", isDead: true })]);
    raw6.activePlayer = makeActivePlayer({ currentGold: 2300 });
    await orchestrator.handleGameData(raw6);
    expect(llmProvider.getAnalysis).toHaveBeenCalledTimes(4);
  });

  it("triggerManualAnalysis_MidGame_BroadcastsCorrectChampionState", async () => {
    const { orchestrator, broadcasts, llmProvider } = setup();

    await orchestrator.handleGameData(makeRawGameData([
      makePlayer({ championName: "Jinx", level: 10, scores: { kills: 5, deaths: 1, assists: 3, creepScore: 150, wardScore: 0 } }),
      makeEnemy("Malphite", 1, 3, 10),
    ]));
    expect(llmProvider.getAnalysis).toHaveBeenCalledTimes(1);
    broadcasts.length = 0;

    await orchestrator.triggerManualAnalysis();

    // Cache serves the result (same state) — LLM update is still broadcast
    const update = broadcasts.find((b) => b.event === "RECOMMENDATION_UPDATE");
    expect(update).toBeDefined();
    expect(update?.recommendation?.source).toBe("llm");
    expect(update?.gameState?.localPlayer.championName).toBe("Jinx");
  });

  it("triggerManualAnalysis_BeforeGameStart_BroadcastsNothing", async () => {
    const { orchestrator, broadcasts, llmProvider } = setup();

    await orchestrator.triggerManualAnalysis();

    expect(llmProvider.getAnalysis).not.toHaveBeenCalled();
    expect(broadcasts).toHaveLength(0);
  });
});
