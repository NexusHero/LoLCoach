"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const llmProvider_1 = require("../llmProvider");
const fixtures_1 = require("./fixtures");
// jest.mock wird gehoisted — factory darf keine äußeren Variablen nutzen
jest.mock("../ddragonService", () => ({
    ddragon: {
        init: jest.fn().mockResolvedValue(undefined),
        getItemInfo: jest.fn().mockReturnValue(undefined),
        getChampionAbilities: jest.fn().mockResolvedValue(undefined),
        getChampionTags: jest.fn().mockReturnValue([]),
        currentVersion: "test",
    },
}));
// Zugriff auf die gemockte Instanz nach dem Hoist
const mockDdragon = jest.requireMock("../ddragonService").ddragon;
describe("createLlmProvider", () => {
    it("createLlmProvider_Claude_ReturnsProviderWithCorrectName", async () => {
        const provider = await (0, llmProvider_1.createLlmProvider)("claude", "test-key");
        expect(provider.name).toBe("claude");
    });
    it("createLlmProvider_OpenAi_ReturnsProviderWithCorrectName", async () => {
        const provider = await (0, llmProvider_1.createLlmProvider)("openai", "test-key");
        expect(provider.name).toBe("openai");
    });
    it("createLlmProvider_Gemini_ReturnsProviderWithCorrectName", async () => {
        const provider = await (0, llmProvider_1.createLlmProvider)("gemini", "test-key");
        expect(provider.name).toBe("gemini");
    });
    it("createLlmProvider_UnknownProvider_ThrowsUnknownProviderError", async () => {
        await expect((0, llmProvider_1.createLlmProvider)("unknown", "test-key")).rejects.toThrow(/Unknown LLM provider/);
    });
});
describe("buildUserPrompt", () => {
    beforeEach(() => {
        mockDdragon.getItemInfo.mockReturnValue(undefined);
        mockDdragon.getChampionAbilities.mockResolvedValue(undefined);
    });
    it("buildUserPrompt_StandardGameState_ContainsChampionTimeAndPhaseInfo", async () => {
        const state = (0, fixtures_1.makeGameState)({
            localPlayer: { ...(0, fixtures_1.makeGameState)().localPlayer, championName: "Lux" },
            enemies: [{ ...(0, fixtures_1.makeGameState)().localPlayer, championName: "Soraka", team: "CHAOS" }],
            gameTime: 125,
        });
        const prompt = await (0, llmProvider_1.buildUserPrompt)(state);
        expect(prompt).toContain("My champion: Lux");
        expect(prompt).toContain("Enemies: Soraka");
        expect(prompt).toContain("Time: 2m");
        expect(prompt).toContain("Game Phase: early");
    });
    it("buildUserPrompt_MidGameTime_ContainsMidPhase", async () => {
        const state = (0, fixtures_1.makeGameState)({ gameTime: 15 * 60 });
        const prompt = await (0, llmProvider_1.buildUserPrompt)(state);
        expect(prompt).toContain("Game Phase: mid");
    });
    it("buildUserPrompt_LateGameTime_ContainsLatePhase", async () => {
        const state = (0, fixtures_1.makeGameState)({ gameTime: 26 * 60 });
        const prompt = await (0, llmProvider_1.buildUserPrompt)(state);
        expect(prompt).toContain("Game Phase: late");
    });
    it("buildUserPrompt_DDragonHasChampionAbilities_NoHeuristicSection", async () => {
        const state = (0, fixtures_1.makeGameState)();
        const prompt = await (0, llmProvider_1.buildUserPrompt)(state);
        expect(prompt).not.toContain("Heuristic counter items");
        expect(prompt).not.toContain("Counter items");
    });
    it("buildUserPrompt_DDragonHasChampionAbilities_AbilitiesInPrompt", async () => {
        mockDdragon.getChampionAbilities.mockImplementation((name) => {
            if (name === "Lux")
                return Promise.resolve({ q: "Light Binding", w: "Prismatic Barrier", e: "Lucent Singularity", r: "Final Spark" });
            if (name === "Zed")
                return Promise.resolve({ q: "Razor Shuriken", w: "Living Shadow", e: "Shadow Slash", r: "Death Mark" });
            return Promise.resolve(undefined);
        });
        const state = (0, fixtures_1.makeGameState)({
            localPlayer: (0, fixtures_1.makePlayer)({ championName: "Lux", position: "MID" }),
            enemies: [(0, fixtures_1.makePlayer)({ championName: "Zed", position: "MID", team: "CHAOS" })],
        });
        const prompt = await (0, llmProvider_1.buildUserPrompt)(state);
        expect(prompt).toContain("Q=Light Binding");
        expect(prompt).toContain("R=Final Spark");
        expect(prompt).toContain("Q=Razor Shuriken");
        expect(prompt).toContain("R=Death Mark");
    });
    it("buildUserPrompt_EnemyHasSummonerSpells_SpellsInPrompt", async () => {
        const state = (0, fixtures_1.makeGameState)({
            localPlayer: (0, fixtures_1.makePlayer)({ championName: "Ahri", position: "MID" }),
            enemies: [(0, fixtures_1.makePlayer)({
                    championName: "Zed",
                    position: "MID",
                    team: "CHAOS",
                    summonerSpells: {
                        summonerSpellOne: { displayName: "Flash" },
                        summonerSpellTwo: { displayName: "Ignite" },
                    },
                })],
        });
        const prompt = await (0, llmProvider_1.buildUserPrompt)(state);
        expect(prompt).toContain("{Flash, Ignite}");
    });
    it("buildUserPrompt_RiskyLevel_ContainsAggressiveDirective", async () => {
        const state = (0, fixtures_1.makeGameState)();
        const prompt = await (0, llmProvider_1.buildUserPrompt)(state, "risky");
        expect(prompt).toContain("Playstyle: AGGRESSIVE");
    });
    it("buildUserPrompt_SafeLevel_ContainsCautiousDirective", async () => {
        const state = (0, fixtures_1.makeGameState)();
        const prompt = await (0, llmProvider_1.buildUserPrompt)(state, "safe");
        expect(prompt).toContain("Playstyle: SAFE");
    });
    it("buildUserPrompt_DefaultLevel_ContainsBalancedDirective", async () => {
        const state = (0, fixtures_1.makeGameState)();
        const prompt = await (0, llmProvider_1.buildUserPrompt)(state);
        expect(prompt).toContain("Playstyle: BALANCED");
    });
    it("buildUserPrompt_NoOpponent_ShowsUnknown", async () => {
        const state = (0, fixtures_1.makeGameState)({
            localPlayer: (0, fixtures_1.makePlayer)({ position: "TOP" }),
            enemies: [],
        });
        const prompt = await (0, llmProvider_1.buildUserPrompt)(state);
        expect(prompt).toContain("Opponent: unknown");
    });
    it("buildUserPrompt_DDragonUnavailableForAll_PromptStillBuilds", async () => {
        mockDdragon.getItemInfo.mockReturnValue(undefined);
        mockDdragon.getChampionAbilities.mockResolvedValue(undefined);
        const state = (0, fixtures_1.makeGameState)({
            localPlayer: (0, fixtures_1.makePlayer)({ championName: "Ahri" }),
            enemies: [(0, fixtures_1.makePlayer)({ championName: "Zed", team: "CHAOS" })],
        });
        const prompt = await (0, llmProvider_1.buildUserPrompt)(state);
        // Prompt muss trotzdem gebaut werden — nur ohne Stats und Abilities
        expect(prompt).toContain("My champion: Ahri");
        expect(prompt).not.toContain("Q=");
    });
});
describe("parseAnalysisResponse", () => {
    it("parseAnalysisResponse_ValidJson_ExtractsReasoningAndStrategy", () => {
        const raw = JSON.stringify({
            itemReasoning: "Buy this now",
            strategy: {
                winCondition: "late",
                summary: "Scale hard.",
                immediateAction: "Farm under tower.",
                lateGamePlan: "Destroy with full build.",
            },
        });
        const result = (0, llmProvider_1.parseAnalysisResponse)(raw);
        expect(result.reasoning).toBe("Buy this now");
        expect(result.strategy.winCondition).toBe("late");
        expect(result.strategy.summary).toBe("Scale hard.");
    });
    it("parseAnalysisResponse_JsonWithMarkdownCodeBlock_StillParses", () => {
        const raw = "```json\n{\"itemReasoning\":\"Good items\",\"strategy\":{\"winCondition\":\"mid\",\"summary\":\"s\",\"immediateAction\":\"a\",\"lateGamePlan\":\"b\"}}\n```";
        const result = (0, llmProvider_1.parseAnalysisResponse)(raw);
        expect(result.reasoning).toBe("Good items");
    });
    it("parseAnalysisResponse_InvalidJson_ReturnsEmptyReasoning", () => {
        const result = (0, llmProvider_1.parseAnalysisResponse)("not json at all");
        expect(result.reasoning).toBe("");
        expect(result.strategy.winCondition).toBe("mid");
    });
    it("parseAnalysisResponse_MissingFields_UsesDefaultValues", () => {
        const raw = JSON.stringify({ itemReasoning: "partial" });
        const result = (0, llmProvider_1.parseAnalysisResponse)(raw);
        expect(result.reasoning).toBe("partial");
        expect(result.strategy.winCondition).toBe("mid");
    });
    it("parseAnalysisResponse_SituationalItems_ExtractedAndCappedAtFour", () => {
        const raw = JSON.stringify({
            itemReasoning: "Good items",
            situationalItems: [
                { id: 3111, name: "Mercurial Scimitar", reason: "Heavy CC" },
                { id: 3102, name: "Banshee's Veil", reason: "Poke comp" },
                { id: 3047, name: "Plated Steelcaps", reason: "AD heavy" },
            ],
            strategy: { winCondition: "mid", summary: "s", immediateAction: "a", lateGamePlan: "b" },
        });
        const result = (0, llmProvider_1.parseAnalysisResponse)(raw);
        expect(result.situationalItems).toHaveLength(3);
        expect(result.situationalItems[0]).toEqual({ id: 3111, name: "Mercurial Scimitar", reason: "Heavy CC", priority: "situational" });
    });
    it("parseAnalysisResponse_EmptySituationalItems_ReturnsEmptyArray", () => {
        const raw = JSON.stringify({
            itemReasoning: "Good items",
            situationalItems: [],
            strategy: { winCondition: "mid", summary: "s", immediateAction: "a", lateGamePlan: "b" },
        });
        const result = (0, llmProvider_1.parseAnalysisResponse)(raw);
        expect(result.situationalItems).toEqual([]);
    });
    it("parseAnalysisResponse_InvalidSituationalItem_Filtered", () => {
        const raw = JSON.stringify({
            itemReasoning: "Good items",
            situationalItems: [{ id: 0, name: "", reason: "bad" }],
            strategy: { winCondition: "mid", summary: "s", immediateAction: "a", lateGamePlan: "b" },
        });
        const result = (0, llmProvider_1.parseAnalysisResponse)(raw);
        expect(result.situationalItems).toEqual([]);
    });
});
