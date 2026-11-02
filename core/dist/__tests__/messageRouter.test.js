"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const messageRouter_1 = require("../messageRouter");
jest.mock("../llmProvider", () => ({
    createLlmProvider: jest.fn().mockResolvedValue({
        name: "mock-provider",
        listModels: jest.fn().mockResolvedValue([
            { id: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6" },
        ]),
    }),
}));
const llmProvider_1 = require("../llmProvider");
function makeOrchestrator() {
    return {
        setSummonerName: jest.fn(),
        triggerManualAnalysis: jest.fn().mockResolvedValue(undefined),
        setLlmProvider: jest.fn(),
        setTokenBudget: jest.fn(),
        setRiskLevel: jest.fn(),
    };
}
function makeWs() {
    return { send: jest.fn() };
}
const fakeWs = makeWs();
describe("MessageRouter", () => {
    describe("handle — SET_SUMMONER", () => {
        it("handle_SetSummonerWithValidName_CallsSetSummonerName", async () => {
            const orchestrator = makeOrchestrator();
            const router = new messageRouter_1.MessageRouter(orchestrator);
            await router.handle(fakeWs, { event: "SET_SUMMONER", summonerName: "Faker" });
            expect(orchestrator.setSummonerName).toHaveBeenCalledWith("Faker");
        });
        it("handle_SetSummonerWithNonStringName_DoesNotCallSetSummonerName", async () => {
            const orchestrator = makeOrchestrator();
            const router = new messageRouter_1.MessageRouter(orchestrator);
            await router.handle(fakeWs, { event: "SET_SUMMONER", summonerName: 42 });
            expect(orchestrator.setSummonerName).not.toHaveBeenCalled();
        });
        it("handle_SetSummonerWithMissingName_DoesNotCallSetSummonerName", async () => {
            const orchestrator = makeOrchestrator();
            const router = new messageRouter_1.MessageRouter(orchestrator);
            await router.handle(fakeWs, { event: "SET_SUMMONER" });
            expect(orchestrator.setSummonerName).not.toHaveBeenCalled();
        });
    });
    describe("handle — TRIGGER_ANALYSIS", () => {
        it("handle_TriggerAnalysisEvent_CallsTriggerManualAnalysis", async () => {
            const orchestrator = makeOrchestrator();
            const router = new messageRouter_1.MessageRouter(orchestrator);
            await router.handle(fakeWs, { event: "TRIGGER_ANALYSIS" });
            expect(orchestrator.triggerManualAnalysis).toHaveBeenCalledTimes(1);
        });
    });
    describe("handle — SET_LLM_PROVIDER", () => {
        beforeEach(() => {
            jest.clearAllMocks();
            llmProvider_1.createLlmProvider.mockResolvedValue({ name: "mock-provider" });
        });
        it("handle_SetLlmProviderWithValidKey_SetsProviderOnOrchestrator", async () => {
            const orchestrator = makeOrchestrator();
            const router = new messageRouter_1.MessageRouter(orchestrator);
            await router.handle(fakeWs, { event: "SET_LLM_PROVIDER", provider: "claude", apiKey: "sk-valid" });
            expect(llmProvider_1.createLlmProvider).toHaveBeenCalledWith("claude", "sk-valid", undefined);
            expect(orchestrator.setLlmProvider).toHaveBeenCalledWith({ name: "mock-provider" });
        });
        it("handle_SetLlmProviderWithoutApiKey_SetsProviderNull", async () => {
            const orchestrator = makeOrchestrator();
            const router = new messageRouter_1.MessageRouter(orchestrator);
            await router.handle(fakeWs, { event: "SET_LLM_PROVIDER", provider: "claude" });
            expect(llmProvider_1.createLlmProvider).not.toHaveBeenCalled();
            expect(orchestrator.setLlmProvider).toHaveBeenCalledWith(null);
        });
        it("handle_SetLlmProviderWithoutProviderType_SetsProviderNull", async () => {
            const orchestrator = makeOrchestrator();
            const router = new messageRouter_1.MessageRouter(orchestrator);
            await router.handle(fakeWs, { event: "SET_LLM_PROVIDER", apiKey: "sk-key" });
            expect(orchestrator.setLlmProvider).toHaveBeenCalledWith(null);
        });
        it("handle_SetLlmProviderCreateFails_FallsBackToNullProvider", async () => {
            llmProvider_1.createLlmProvider.mockRejectedValue(new Error("Invalid API key"));
            const orchestrator = makeOrchestrator();
            const router = new messageRouter_1.MessageRouter(orchestrator);
            await router.handle(fakeWs, { event: "SET_LLM_PROVIDER", provider: "claude", apiKey: "bad-key" });
            expect(orchestrator.setLlmProvider).toHaveBeenCalledWith(null);
        });
    });
    describe("handle — GET_MODELS", () => {
        beforeEach(() => {
            jest.clearAllMocks();
            llmProvider_1.createLlmProvider.mockResolvedValue({
                name: "mock-provider",
                listModels: jest.fn().mockResolvedValue([
                    { id: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6" },
                    { id: "claude-haiku-4-5-20251001", displayName: "Claude Haiku 4.5" },
                ]),
            });
        });
        it("handle_GetModels_SendsModelsAvailableWithProviderAndList", async () => {
            const ws = makeWs();
            const router = new messageRouter_1.MessageRouter(makeOrchestrator());
            await router.handle(ws, { event: "GET_MODELS", provider: "claude", apiKey: "sk-valid" });
            expect(ws.send).toHaveBeenCalledTimes(1);
            const sent = JSON.parse(ws.send.mock.calls[0][0]);
            expect(sent.event).toBe("MODELS_AVAILABLE");
            expect(sent.provider).toBe("claude");
            expect(sent.models).toHaveLength(2);
            expect(sent.models[0].id).toBe("claude-sonnet-4-6");
        });
        it("handle_GetModels_PassesModelAndApiKeyToCreateLlmProvider", async () => {
            const ws = makeWs();
            const router = new messageRouter_1.MessageRouter(makeOrchestrator());
            await router.handle(ws, { event: "GET_MODELS", provider: "openai", apiKey: "sk-openai" });
            expect(llmProvider_1.createLlmProvider).toHaveBeenCalledWith("openai", "sk-openai");
        });
        it("handle_GetModelsWithoutApiKey_SendsModelsError", async () => {
            const ws = makeWs();
            const router = new messageRouter_1.MessageRouter(makeOrchestrator());
            await router.handle(ws, { event: "GET_MODELS", provider: "claude" });
            const sent = JSON.parse(ws.send.mock.calls[0][0]);
            expect(sent.event).toBe("MODELS_ERROR");
            expect(typeof sent.error).toBe("string");
        });
        it("handle_GetModels_ListModelsThrows_SendsModelsError", async () => {
            llmProvider_1.createLlmProvider.mockResolvedValue({
                name: "mock-provider",
                listModels: jest.fn().mockRejectedValue(new Error("unauthorized")),
            });
            const ws = makeWs();
            const router = new messageRouter_1.MessageRouter(makeOrchestrator());
            await router.handle(ws, { event: "GET_MODELS", provider: "claude", apiKey: "bad-key" });
            const sent = JSON.parse(ws.send.mock.calls[0][0]);
            expect(sent.event).toBe("MODELS_ERROR");
            expect(sent.error).toBe("unauthorized");
        });
    });
    describe("handle — VALIDATE_KEY", () => {
        beforeEach(() => {
            jest.clearAllMocks();
            llmProvider_1.createLlmProvider.mockResolvedValue({
                name: "mock-provider",
                listModels: jest.fn().mockResolvedValue([]),
            });
        });
        it("handle_ValidateKeyWithValidKey_SendsKeyValid", async () => {
            const ws = makeWs();
            const router = new messageRouter_1.MessageRouter(makeOrchestrator());
            await router.handle(ws, { event: "VALIDATE_KEY", provider: "claude", apiKey: "sk-valid" });
            expect(ws.send).toHaveBeenCalledTimes(1);
            const sent = JSON.parse(ws.send.mock.calls[0][0]);
            expect(sent.event).toBe("KEY_VALID");
            expect(sent.provider).toBe("claude");
        });
        it("handle_ValidateKeyWithValidKey_DoesNotSetLlmProviderOnOrchestrator", async () => {
            const orchestrator = makeOrchestrator();
            const router = new messageRouter_1.MessageRouter(orchestrator);
            const ws = makeWs();
            await router.handle(ws, { event: "VALIDATE_KEY", provider: "claude", apiKey: "sk-valid" });
            expect(orchestrator.setLlmProvider).not.toHaveBeenCalled();
        });
        it("handle_ValidateKeyListModelsThrows_SendsKeyInvalidWithError", async () => {
            llmProvider_1.createLlmProvider.mockResolvedValue({
                name: "mock-provider",
                listModels: jest.fn().mockRejectedValue(new Error("401 · Invalid API key")),
            });
            const ws = makeWs();
            const router = new messageRouter_1.MessageRouter(makeOrchestrator());
            await router.handle(ws, { event: "VALIDATE_KEY", provider: "openai", apiKey: "bad-key" });
            const sent = JSON.parse(ws.send.mock.calls[0][0]);
            expect(sent.event).toBe("KEY_INVALID");
            expect(sent.provider).toBe("openai");
            expect(sent.error).toBe("401 · Invalid API key");
        });
        it("handle_ValidateKeyWithoutApiKey_SendsKeyInvalid", async () => {
            const ws = makeWs();
            const router = new messageRouter_1.MessageRouter(makeOrchestrator());
            await router.handle(ws, { event: "VALIDATE_KEY", provider: "claude" });
            const sent = JSON.parse(ws.send.mock.calls[0][0]);
            expect(sent.event).toBe("KEY_INVALID");
            expect(typeof sent.error).toBe("string");
        });
        it("handle_ValidateKeyWithoutProvider_SendsKeyInvalid", async () => {
            const ws = makeWs();
            const router = new messageRouter_1.MessageRouter(makeOrchestrator());
            await router.handle(ws, { event: "VALIDATE_KEY", apiKey: "sk-key" });
            const sent = JSON.parse(ws.send.mock.calls[0][0]);
            expect(sent.event).toBe("KEY_INVALID");
        });
    });
    describe("handle — SET_RISK_LEVEL", () => {
        it("handle_SetRiskLevelWithValidLevel_CallsSetRiskLevel", async () => {
            const orchestrator = makeOrchestrator();
            const router = new messageRouter_1.MessageRouter(orchestrator);
            await router.handle(fakeWs, { event: "SET_RISK_LEVEL", riskLevel: "risky" });
            expect(orchestrator.setRiskLevel).toHaveBeenCalledWith("risky");
        });
        it("handle_SetRiskLevelWithInvalidLevel_DoesNotCallSetRiskLevel", async () => {
            const orchestrator = makeOrchestrator();
            const router = new messageRouter_1.MessageRouter(orchestrator);
            await router.handle(fakeWs, { event: "SET_RISK_LEVEL", riskLevel: "yolo" });
            expect(orchestrator.setRiskLevel).not.toHaveBeenCalled();
        });
    });
    describe("handle — unknown event", () => {
        it("handle_UnknownEvent_DoesNotThrowAndIgnoresMessage", async () => {
            const orchestrator = makeOrchestrator();
            const router = new messageRouter_1.MessageRouter(orchestrator);
            await expect(router.handle(fakeWs, { event: "UNKNOWN_EVENT" })).resolves.toBeUndefined();
            expect(orchestrator.setSummonerName).not.toHaveBeenCalled();
            expect(orchestrator.triggerManualAnalysis).not.toHaveBeenCalled();
            expect(orchestrator.setLlmProvider).not.toHaveBeenCalled();
        });
    });
});
