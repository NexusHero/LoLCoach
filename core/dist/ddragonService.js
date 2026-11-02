"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ddragon = exports.DDragonService = void 0;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const node_os_1 = require("node:os");
const DDRAGON_BASE = "https://ddragon.leagueoflegends.com";
const CACHE_DIR = process.platform === "win32"
    ? (0, node_path_1.join)(process.env.LOCALAPPDATA ?? (0, node_os_1.tmpdir)(), "lolcoach", "ddragon")
    : (0, node_path_1.join)((0, node_os_1.homedir)(), ".cache", "lolcoach", "ddragon");
const STAT_LABELS = {
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
class DDragonService {
    version = "";
    items = {};
    championKeys = {};
    championTags = {};
    champions = {};
    cacheFile = "";
    initialized = false;
    initPromise = null;
    async init() {
        if (this.initialized)
            return;
        if (this.initPromise)
            return this.initPromise;
        this.initPromise = this._init();
        return this.initPromise;
    }
    async _init() {
        try {
            await (0, promises_1.mkdir)(CACHE_DIR, { recursive: true });
            const versions = await this.fetchJson(`${DDRAGON_BASE}/api/versions.json`);
            this.version = versions[0];
            this.cacheFile = (0, node_path_1.join)(CACHE_DIR, `${this.version}.json`);
            const cached = await this.loadCache();
            if (cached && cached.version === this.version) {
                this.items = Object.fromEntries(Object.entries(cached.items).map(([k, v]) => [Number(k), v]));
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
        }
        catch (err) {
            console.error("[DDragon] Init failed — continuing without DDragon data:", err);
        }
        this.initialized = true;
    }
    getItemInfo(id) {
        return this.items[id];
    }
    getAllItems() {
        return this.items;
    }
    /** Returns Riot's official champion tags (e.g. ["Mage","Assassin"], ["Tank"], ["Marksman"]). */
    getChampionTags(displayName) {
        return this.championTags[displayName] ?? [];
    }
    async getChampionAbilities(displayName) {
        if (this.champions[displayName])
            return this.champions[displayName];
        const key = this.championKeys[displayName];
        if (!key)
            return undefined;
        try {
            const url = `${DDRAGON_BASE}/cdn/${this.version}/data/en_US/champion/${key}.json`;
            const data = await this.fetchJson(url);
            const champ = Object.values(data.data)[0];
            if (!champ?.spells || champ.spells.length < 4)
                return undefined;
            const abilities = {
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
            this.saveCache().catch(() => { });
            return abilities;
        }
        catch {
            return undefined;
        }
    }
    get currentVersion() {
        return this.version;
    }
    async fetchItems() {
        const url = `${DDRAGON_BASE}/cdn/${this.version}/data/en_US/item.json`;
        const data = await this.fetchJson(url);
        for (const [id, item] of Object.entries(data.data)) {
            if (!item.name || item.inStore === false)
                continue;
            const stats = this.formatStats(item.stats ?? {});
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
            };
        }
    }
    async fetchChampionKeys() {
        const url = `${DDRAGON_BASE}/cdn/${this.version}/data/en_US/champion.json`;
        const data = await this.fetchJson(url);
        for (const [key, champ] of Object.entries(data.data)) {
            this.championKeys[champ.name] = key;
            if (champ.tags?.length)
                this.championTags[champ.name] = champ.tags;
        }
    }
    formatStats(stats) {
        const parts = [];
        for (const [key, val] of Object.entries(stats)) {
            const label = STAT_LABELS[key];
            if (!label || val === 0)
                continue;
            const formatted = key.startsWith("Percent")
                ? `${Math.round(val * 100)}% ${label}`
                : `${Math.round(val)} ${label}`;
            parts.push(formatted);
        }
        return parts.join(", ");
    }
    async fetchJson(url) {
        const res = await fetch(url);
        if (!res.ok)
            throw new Error(`DDragon fetch failed: ${url} — ${res.status}`);
        return res.json();
    }
    async loadCache() {
        try {
            const raw = await (0, promises_1.readFile)(this.cacheFile, "utf-8");
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    async saveCache() {
        const cache = {
            version: this.version,
            items: Object.fromEntries(Object.entries(this.items).map(([k, v]) => [k, v])),
            championKeys: this.championKeys,
            championTags: this.championTags,
            champions: this.champions,
        };
        await (0, promises_1.writeFile)(this.cacheFile, JSON.stringify(cache), "utf-8");
    }
}
exports.DDragonService = DDragonService;
exports.ddragon = new DDragonService();
