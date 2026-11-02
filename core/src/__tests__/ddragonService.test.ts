import { DDragonService } from "../ddragonService";

// --- Shared DDragon API response fixtures ---

const VERSIONS_RESPONSE = ["15.12.1", "15.11.1", "15.10.1"];

const ITEMS_RESPONSE = {
  data: {
    "3102": {
      name: "Banshee's Veil",
      plaintext: "Blocks a single negative ability",
      stats: { FlatMagicDamageMod: 80, FlatSpellBlockMod: 65 },
      inStore: true,
    },
    "3033": {
      name: "Mortal Reminder",
      plaintext: "Reduces healing received",
      description: "<mainText><stats><attention>30</attention> Attack Damage<br><attention>35%</attention> Armor Penetration<br><attention>15</attention> Ability Haste</stats></mainText>",
      stats: { FlatPhysicalDamageMod: 30 },
      inStore: true,
    },
    "9999": {
      // Stat mit Wert 0 — sollte nicht im Output erscheinen
      name: "Test Item",
      plaintext: "",
      stats: { FlatMagicDamageMod: 0, FlatArmorMod: 50 },
      inStore: true,
    },
    "8888": {
      // Prozent-Stat
      name: "Berserker's Greaves",
      plaintext: "Attack speed boots",
      stats: { PercentAttackSpeedMod: 0.35 },
      inStore: true,
    },
    "7777": {
      // inStore false — sollte übersprungen werden
      name: "Hidden Item",
      plaintext: "",
      stats: {},
      inStore: false,
    },
  },
};

const CHAMPIONS_RESPONSE = {
  data: {
    Lux: { id: "Lux", name: "Lux" },
    MonkeyKing: { id: "MonkeyKing", name: "Wukong" },
    Nunu: { id: "Nunu", name: "Nunu & Willump" },
  },
};

const LUX_DETAIL_RESPONSE = {
  data: {
    Lux: {
      spells: [
        { name: "Light Binding" },
        { name: "Prismatic Barrier" },
        { name: "Lucent Singularity" },
        { name: "Final Spark" },
      ],
    },
  },
};

// --- Mock fs/promises and fetch ---

jest.mock("node:fs/promises", () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn(),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("node:os", () => ({
  tmpdir: () => "/tmp",
  homedir: () => "/home/test",
}));

import * as fs from "node:fs/promises";

function mockFetch(responses: Record<string, unknown>) {
  global.fetch = jest.fn((url: string) => {
    const key = Object.keys(responses).find((k) => url.includes(k));
    if (!key) return Promise.reject(new Error(`Unmocked URL: ${url}`));
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(responses[key]),
    });
  }) as jest.Mock;
}

function makeFullFetchMock() {
  mockFetch({
    "versions.json": VERSIONS_RESPONSE,
    "/item.json": ITEMS_RESPONSE,
    "/champion.json": CHAMPIONS_RESPONSE,
    "/champion/Lux.json": LUX_DETAIL_RESPONSE,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: no cache on disk
  (fs.readFile as jest.Mock).mockRejectedValue(new Error("ENOENT"));
});

// ─── init ────────────────────────────────────────────────────────────────────

describe("DDragonService.init", () => {
  it("init_NoCacheOnDisk_FetchesVersionAndItems", async () => {
    makeFullFetchMock();
    const svc = new DDragonService();

    await svc.init();

    expect(svc.currentVersion).toBe("15.12.1");
    expect(svc.getItemInfo(3102)).toBeDefined();
    expect(svc.getItemInfo(3102)?.name).toBe("Banshee's Veil");
  });

  it("init_CacheExistsForCurrentVersion_DoesNotFetchNetwork", async () => {
    const cache = {
      version: "15.12.1",
      items: { "3102": { name: "Banshee's Veil", stats: "80 AP, 65 MR", plaintext: "Blocks a spell" } },
      championKeys: { Lux: "Lux" },
      champions: {},
    };
    (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(cache));
    mockFetch({ "versions.json": VERSIONS_RESPONSE });
    const svc = new DDragonService();

    await svc.init();

    // Only the version call should have been made — items and champions come from cache
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain("versions.json");
    expect(svc.getItemInfo(3102)?.name).toBe("Banshee's Veil");
  });

  it("init_CacheExistsForOlderVersion_FetchesFreshData", async () => {
    const staleCache = {
      version: "15.11.1",
      items: { "3102": { name: "Old Name", stats: "", plaintext: "" } },
      championKeys: {},
      champions: {},
    };
    (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(staleCache));
    makeFullFetchMock();
    const svc = new DDragonService();

    await svc.init();

    // Fresh data replaces stale cache — name from network response wins
    expect(svc.getItemInfo(3102)?.name).toBe("Banshee's Veil");
    // Network was called for items and champions (not just versions)
    expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(1);
  });

  it("init_NetworkFails_StillCompletesWithoutCrashing", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));
    const svc = new DDragonService();

    await expect(svc.init()).resolves.toBeUndefined();
    expect(svc.getItemInfo(3102)).toBeUndefined();
  });

  it("init_CalledConcurrently_OnlyFetchesOnce", async () => {
    makeFullFetchMock();
    const svc = new DDragonService();

    await Promise.all([svc.init(), svc.init(), svc.init()]);

    const versionCalls = (global.fetch as jest.Mock).mock.calls.filter((c: string[]) =>
      c[0].includes("versions.json"),
    );
    expect(versionCalls).toHaveLength(1);
  });

  it("init_CalledAfterFirstComplete_IsIdempotent", async () => {
    makeFullFetchMock();
    const svc = new DDragonService();

    await svc.init();
    const callCountAfterFirst = (global.fetch as jest.Mock).mock.calls.length;
    await svc.init();

    expect((global.fetch as jest.Mock).mock.calls.length).toBe(callCountAfterFirst);
  });
});

// ─── getItemInfo ─────────────────────────────────────────────────────────────

describe("DDragonService.getItemInfo", () => {
  it("getItemInfo_KnownItem_ReturnsNameStatsAndPlaintext", async () => {
    makeFullFetchMock();
    const svc = new DDragonService();
    await svc.init();

    const info = svc.getItemInfo(3102);

    expect(info?.name).toBe("Banshee's Veil");
    expect(info?.stats).toContain("AP");
    expect(info?.stats).toContain("MR");
    expect(info?.plaintext).toBe("Blocks a single negative ability");
  });

  it("getItemInfo_UnknownId_ReturnsUndefined", async () => {
    makeFullFetchMock();
    const svc = new DDragonService();
    await svc.init();

    expect(svc.getItemInfo(9999999)).toBeUndefined();
  });

  it("getItemInfo_InStoreIsFalse_ItemIsNotIncluded", async () => {
    makeFullFetchMock();
    const svc = new DDragonService();
    await svc.init();

    expect(svc.getItemInfo(7777)).toBeUndefined();
  });

  it("getItemInfo_StatWithZeroValue_ZeroIsOmittedFromStats", async () => {
    makeFullFetchMock();
    const svc = new DDragonService();
    await svc.init();

    const info = svc.getItemInfo(9999);

    // FlatMagicDamageMod is 0 — should not appear; FlatArmorMod 50 should appear
    expect(info?.stats).not.toContain("AP");
    expect(info?.stats).toContain("50 Armor");
  });

  it("getItemInfo_PercentStat_FormatsAsPercent", async () => {
    makeFullFetchMock();
    const svc = new DDragonService();
    await svc.init();

    const info = svc.getItemInfo(8888);

    expect(info?.stats).toBe("35% AS");
  });

  it("getItemInfo_ItemWithDescriptionStats_ExtractsNumericAbilityHasteAndPercentPen", async () => {
    makeFullFetchMock();
    const svc = new DDragonService();
    await svc.init();

    const info = svc.getItemInfo(3033);

    expect(info?.numericStats?.ad).toBe(30);
    expect(info?.numericStats?.abilityHaste).toBe(15);
    expect(info?.numericStats?.percentPen).toBe(35);
  });
});

// ─── getChampionAbilities ─────────────────────────────────────────────────────

describe("DDragonService.getChampionAbilities", () => {
  it("getChampionAbilities_KnownChampion_ReturnsQWER", async () => {
    makeFullFetchMock();
    const svc = new DDragonService();
    await svc.init();

    const abilities = await svc.getChampionAbilities("Lux");

    expect(abilities?.q).toBe("Light Binding");
    expect(abilities?.w).toBe("Prismatic Barrier");
    expect(abilities?.e).toBe("Lucent Singularity");
    expect(abilities?.r).toBe("Final Spark");
  });

  it("getChampionAbilities_CalledTwice_OnlyFetchesOnce", async () => {
    makeFullFetchMock();
    const svc = new DDragonService();
    await svc.init();

    await svc.getChampionAbilities("Lux");
    const callCount = (global.fetch as jest.Mock).mock.calls.length;
    await svc.getChampionAbilities("Lux");

    expect((global.fetch as jest.Mock).mock.calls.length).toBe(callCount);
  });

  it("getChampionAbilities_UnknownChampion_ReturnsUndefined", async () => {
    makeFullFetchMock();
    const svc = new DDragonService();
    await svc.init();

    const abilities = await svc.getChampionAbilities("FakeChampion");

    expect(abilities).toBeUndefined();
  });

  it("getChampionAbilities_FetchFails_ReturnsUndefined", async () => {
    mockFetch({
      "versions.json": VERSIONS_RESPONSE,
      "/item.json": ITEMS_RESPONSE,
      "/champion.json": CHAMPIONS_RESPONSE,
    });
    // Champion detail fetch throws
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("champion/Lux.json")) {
        return Promise.reject(new Error("Network error"));
      }
      const key = ["versions.json", "/item.json", "/champion.json"].find((k) => url.includes(k));
      if (!key) return Promise.reject(new Error(`Unmocked: ${url}`));
      const data: Record<string, unknown> = {
        "versions.json": VERSIONS_RESPONSE,
        "/item.json": ITEMS_RESPONSE,
        "/champion.json": CHAMPIONS_RESPONSE,
      };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(data[key]) });
    });

    const svc = new DDragonService();
    await svc.init();

    const abilities = await svc.getChampionAbilities("Lux");
    expect(abilities).toBeUndefined();
  });

  it("getChampionAbilities_BeforeInit_ReturnsUndefined", async () => {
    const svc = new DDragonService();

    const abilities = await svc.getChampionAbilities("Lux");

    expect(abilities).toBeUndefined();
  });
});
