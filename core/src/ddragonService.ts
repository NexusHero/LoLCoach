import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";

const DDRAGON_BASE = "https://ddragon.leagueoflegends.com";

const CACHE_DIR =
  process.platform === "win32"
    ? join(process.env.LOCALAPPDATA ?? tmpdir(), "lolcoach", "ddragon")
    : join(homedir(), ".cache", "lolcoach", "ddragon");

const STAT_LABELS: Record<string, string> = {
  FlatMagicDamageMod: "AP",
  FlatPhysicalDamageMod: "AD",
  FlatArmorMod: "Armor",
  FlatSpellBlockMod: "MR",
  FlatHPPoolMod: "HP",
  FlatCritChanceMod: "Crit",
  FlatMovementSpeedMod: "MS",
  PercentAttackSpeedMod: "AS",
  PercentLifeStealMod: "Lifesteal",
  FlatMPPoolMod: "Mana",
  FlatHPRegenMod: "HP5",
};

export interface ItemNumericStats {
  ad: number;
  ap: number;
  armor: number;
  mr: number;
  hp: number;
  attackSpeed: number;
  crit: number;
  abilityHaste: number;
  percentPen: number;
}

export interface ItemInfo {
  name: string;
  stats: string;
  plaintext: string;
  totalGold?: number;
  baseGold?: number;
  from?: number[];
  into?: number[];
  tags?: string[];
  numericStats?: ItemNumericStats;
}

export interface ChampionAbilities {
  q: string;
  w: string;
  e: string;
  r: string;
  qCooldown?: number[];
  wCooldown?: number[];
  eCooldown?: number[];
  rCooldown?: number[];
}

interface CacheFile {
  version: string;
  items: Record<string, ItemInfo>;
  championKeys: Record<string, string>;
  championTags: Record<string, string[]>;
  champions: Record<string, ChampionAbilities>;
}

interface DDragonItem {
  name: string;
  plaintext?: string;
  description?: string;
  stats?: Record<string, number>;
  inStore?: boolean;
  maps?: Record<string, boolean>;
  gold?: {
    base?: number;
    total?: number;
    purchasable?: boolean;
  };
  from?: string[];
  into?: string[];
  tags?: string[];
}

interface DDragonChampionSummary {
  id: string;
  name: string;
  tags: string[];
}

interface DDragonChampionDetail {
  spells: Array<{
    name: string;
    cooldown?: number[];
    range?: number[];
  }>;
}

export class DDragonService {
  private version = "";
  private items: Record<number, ItemInfo> = {};
  private championKeys: Record<string, string> = {};
  private championTags: Record<string, string[]> = {};
  private champions: Record<string, ChampionAbilities> = {};
  private cacheFile = "";
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._init();
    return this.initPromise;
  }

  private async _init(): Promise<void> {
    try {
      await mkdir(CACHE_DIR, { recursive: true });

      const versions = await this.fetchJson<string[]>(`${DDRAGON_BASE}/api/versions.json`);
      this.version = versions[0];
      this.cacheFile = join(CACHE_DIR, `${this.version}.json`);

      const cached = await this.loadCache();
      if (cached && cached.version === this.version) {
        this.items = Object.fromEntries(
          Object.entries(cached.items).map(([k, v]) => [Number(k), v]),
        );
        this.championKeys = cached.championKeys ?? {};
        this.championTags = cached.championTags ?? {};
        this.champions = cached.champions ?? {};
        console.log(`[DDragon] Loaded from cache (patch ${this.version})`);
        this.initialized = true;
        return;
      }

      await Promise.all([this.fetchItems(), this.fetchChampionKeys()]);
      await this.saveCache();
      console.log(`[DDragon] Fetched patch ${this.version} from network`);
    } catch (err) {
      console.error("[DDragon] Init failed — continuing without DDragon data:", err);
    }
    this.initialized = true;
  }

  getItemInfo(id: number): ItemInfo | undefined {
    return this.items[id];
  }

  getAllItems(): Record<number, ItemInfo> {
    return this.items;
  }

  /** Returns Riot's official champion tags (e.g. ["Mage","Assassin"], ["Tank"], ["Marksman"]). */
  getChampionTags(displayName: string): string[] {
    return this.championTags[displayName] ?? [];
  }

  async getChampionAbilities(displayName: string): Promise<ChampionAbilities | undefined> {
    if (this.champions[displayName]) return this.champions[displayName];

    const key = this.championKeys[displayName];
    if (!key) return undefined;

    try {
      const url = `${DDRAGON_BASE}/cdn/${this.version}/data/en_US/champion/${key}.json`;
      const data = await this.fetchJson<{ data: Record<string, DDragonChampionDetail> }>(url);
      const champ = Object.values(data.data)[0];
      if (!champ?.spells || champ.spells.length < 4) return undefined;

      const abilities: ChampionAbilities = {
        q: champ.spells[0].name,
        w: champ.spells[1].name,
        e: champ.spells[2].name,
        r: champ.spells[3].name,
        ...(champ.spells[0].cooldown ? { qCooldown: champ.spells[0].cooldown } : {}),
        ...(champ.spells[1].cooldown ? { wCooldown: champ.spells[1].cooldown } : {}),
        ...(champ.spells[2].cooldown ? { eCooldown: champ.spells[2].cooldown } : {}),
        ...(champ.spells[3].cooldown ? { rCooldown: champ.spells[3].cooldown } : {}),
      };
      this.champions[displayName] = abilities;
      this.saveCache().catch(() => {});
      return abilities;
    } catch {
      return undefined;
    }
  }

  get currentVersion(): string {
    return this.version;
  }

  private async fetchItems(): Promise<void> {
    const url = `${DDRAGON_BASE}/cdn/${this.version}/data/en_US/item.json`;
    const data = await this.fetchJson<{ data: Record<string, DDragonItem> }>(url);

    for (const [id, item] of Object.entries(data.data)) {
      if (!item.name || item.inStore === false) continue;
      const rawStats = item.stats ?? {};
      const stats = this.formatStats(rawStats);
      const numericStats = this.extractNumericStats(rawStats, item.description ?? "");
      const fromIds = item.from?.map(Number).filter((n) => !Number.isNaN(n) && n > 0);
      const intoIds = item.into?.map(Number).filter((n) => !Number.isNaN(n) && n > 0);
      this.items[Number(id)] = {
        name: item.name,
        stats,
        plaintext: item.plaintext ?? "",
        ...(item.gold?.total !== undefined ? { totalGold: item.gold.total } : {}),
        ...(item.gold?.base !== undefined ? { baseGold: item.gold.base } : {}),
        ...(fromIds?.length ? { from: fromIds } : {}),
        ...(intoIds?.length ? { into: intoIds } : {}),
        ...(item.tags?.length ? { tags: item.tags } : {}),
        numericStats,
      };
    }
  }

  private extractNumericStats(rawStats: Record<string, number>, description: string): ItemNumericStats {
    const ahMatch = description.match(/(\d+)\s*(?:<\/attention>\s*)?Ability Haste/i);
    const penMatch = description.match(/(\d+)%\s*(?:<\/attention>\s*)?(?:Armor|Magic) Penetration/i);
    return {
      ad: Math.round(rawStats.FlatPhysicalDamageMod ?? 0),
      ap: Math.round(rawStats.FlatMagicDamageMod ?? 0),
      armor: Math.round(rawStats.FlatArmorMod ?? 0),
      mr: Math.round(rawStats.FlatSpellBlockMod ?? 0),
      hp: Math.round(rawStats.FlatHPPoolMod ?? 0),
      attackSpeed: Math.round((rawStats.PercentAttackSpeedMod ?? 0) * 100),
      crit: Math.round((rawStats.FlatCritChanceMod ?? 0) * 100),
      abilityHaste: ahMatch ? Number(ahMatch[1]) : 0,
      percentPen: penMatch ? Number(penMatch[1]) : 0,
    };
  }

  private async fetchChampionKeys(): Promise<void> {
    const url = `${DDRAGON_BASE}/cdn/${this.version}/data/en_US/champion.json`;
    const data = await this.fetchJson<{ data: Record<string, DDragonChampionSummary> }>(url);

    for (const [key, champ] of Object.entries(data.data)) {
      this.championKeys[champ.name] = key;
      if (champ.tags?.length) this.championTags[champ.name] = champ.tags;
    }
  }

  private formatStats(stats: Record<string, number>): string {
    const parts: string[] = [];
    for (const [key, val] of Object.entries(stats)) {
      const label = STAT_LABELS[key];
      if (!label || val === 0) continue;
      const formatted = key.startsWith("Percent")
        ? `${Math.round(val * 100)}% ${label}`
        : `${Math.round(val)} ${label}`;
      parts.push(formatted);
    }
    return parts.join(", ");
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`DDragon fetch failed: ${url} — ${res.status}`);
    return res.json() as Promise<T>;
  }

  private async loadCache(): Promise<CacheFile | null> {
    try {
      const raw = await readFile(this.cacheFile, "utf-8");
      return JSON.parse(raw) as CacheFile;
    } catch {
      return null;
    }
  }

  private async saveCache(): Promise<void> {
    const cache: CacheFile = {
      version: this.version,
      items: Object.fromEntries(Object.entries(this.items).map(([k, v]) => [k, v])),
      championKeys: this.championKeys,
      championTags: this.championTags,
      champions: this.champions,
    };
    await writeFile(this.cacheFile, JSON.stringify(cache), "utf-8");
  }
}

export const ddragon = new DDragonService();
