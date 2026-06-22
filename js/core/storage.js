// storage.js — single access point to persistence (brief §3.1).
//
//   CONFIG  -> chrome.storage.sync  : travels across the user's machines through
//             their Google account. ONE compact object, < 8 KB, debounced writes.
//   CACHE   -> chrome.storage.local : live data (scores, weather, news...). Per
//             machine, ~10 MB, with TTL. NEVER goes to sync.
//
// No other module touches chrome.storage directly.

const CONFIG_KEY = "config"; // distinct from the legacy `widgetCfg` item (no clobber)
const CACHE_PREFIX = "cache:";
const SYNC_ITEM_LIMIT = 8192; // chrome.storage.sync QUOTA_BYTES_PER_ITEM
const WRITE_DEBOUNCE_MS = 800;

// --- low-level chrome.storage adapter (promise-based, with an in-memory fallback
//     used by Node tests and non-extension contexts). ----------------------------
function makeArea(area) {
  if (area && typeof area.get === "function") {
    return {
      get: (keys) =>
        new Promise((resolve, reject) => {
          try {
            const p = area.get(keys, (r) => {
              const err = globalThis.chrome?.runtime?.lastError;
              if (err) reject(new Error(err.message));
              else resolve(r || {});
            });
            if (p && typeof p.then === "function") p.then(resolve, reject);
          } catch (e) { reject(e); }
        }),
      set: (obj) =>
        new Promise((resolve, reject) => {
          try {
            const p = area.set(obj, () => {
              const err = globalThis.chrome?.runtime?.lastError;
              if (err) reject(new Error(err.message));
              else resolve();
            });
            if (p && typeof p.then === "function") p.then(resolve, reject);
          } catch (e) { reject(e); }
        }),
      remove: (keys) =>
        new Promise((resolve, reject) => {
          try {
            const p = area.remove(keys, () => {
              const err = globalThis.chrome?.runtime?.lastError;
              if (err) reject(new Error(err.message));
              else resolve();
            });
            if (p && typeof p.then === "function") p.then(resolve, reject);
          } catch (e) { reject(e); }
        }),
    };
  }
  // in-memory fallback (tests / no extension API)
  const mem = new Map();
  return {
    get: (keys) => {
      const out = {};
      const list = keys == null ? [...mem.keys()]
        : Array.isArray(keys) ? keys
        : typeof keys === "object" ? Object.keys(keys) : [keys];
      for (const k of list) {
        if (mem.has(k)) out[k] = mem.get(k);
        else if (keys && typeof keys === "object" && !Array.isArray(keys)) out[k] = keys[k];
      }
      return Promise.resolve(out);
    },
    set: (obj) => { for (const k of Object.keys(obj)) mem.set(k, obj[k]); return Promise.resolve(); },
    remove: (keys) => { (Array.isArray(keys) ? keys : [keys]).forEach((k) => mem.delete(k)); return Promise.resolve(); },
  };
}

export function byteSize(value) {
  // Byte length of the JSON serialization (matches how chrome counts sync quota).
  const s = typeof value === "string" ? value : JSON.stringify(value);
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(s).length;
  return Buffer.byteLength(s, "utf8");
}

export function createStorage(opts = {}) {
  const chromeApi = opts.chrome ?? globalThis.chrome;
  const sync = makeArea(opts.syncArea ?? chromeApi?.storage?.sync ?? chromeApi?.storage?.local);
  const local = makeArea(opts.localArea ?? chromeApi?.storage?.local);
  const debounceMs = opts.debounceMs ?? WRITE_DEBOUNCE_MS;

  let configCache = null;       // in-memory mirror of the config object
  let loadPromise = null;
  let pendingTimer = null;
  let pendingResolvers = [];

  async function loadConfig() {
    if (configCache) return configCache;
    if (!loadPromise) {
      loadPromise = sync.get({ [CONFIG_KEY]: {} }).then((r) => {
        configCache = (r && r[CONFIG_KEY]) || {};
        return configCache;
      });
    }
    return loadPromise;
  }

  function scheduleFlush() {
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => { flush().catch(() => {}); }, debounceMs);
  }

  async function flush() {
    if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
    const resolvers = pendingResolvers; pendingResolvers = [];
    const size = byteSize(configCache || {});
    if (size > SYNC_ITEM_LIMIT) {
      const err = new Error(`config too large for sync: ${size} > ${SYNC_ITEM_LIMIT} bytes`);
      resolvers.forEach((r) => r.reject(err));
      throw err;
    }
    try {
      await sync.set({ [CONFIG_KEY]: configCache || {} });
      resolvers.forEach((r) => r.resolve());
    } catch (e) {
      resolvers.forEach((r) => r.reject(e));
      throw e;
    }
  }

  // ---- CONFIG (sync) --------------------------------------------------------
  async function getConfig(key, def) {
    const cfg = await loadConfig();
    if (key === undefined) return cfg;
    return cfg[key] !== undefined ? cfg[key] : def;
  }

  function setConfig(key, val) {
    // Optimistic in-memory update + debounced sync write. Returns a promise that
    // resolves once the (debounced) write lands.
    if (!configCache) configCache = {};
    if (val === undefined) delete configCache[key];
    else configCache[key] = val;
    const p = new Promise((resolve, reject) => pendingResolvers.push({ resolve, reject }));
    scheduleFlush();
    return p;
  }

  // ---- CACHE (local, TTL) ---------------------------------------------------
  async function setCache(key, value, ttlMs) {
    const entry = { v: value, ts: Date.now(), ttl: ttlMs ?? null };
    await local.set({ [CACHE_PREFIX + key]: entry });
    return entry;
  }

  async function getCache(key) {
    const r = await local.get(CACHE_PREFIX + key);
    const entry = r[CACHE_PREFIX + key];
    if (!entry) return null;
    if (entry.ttl != null && Date.now() - entry.ts > entry.ttl) return null; // expired
    return { value: entry.v, ts: entry.ts, age: Date.now() - entry.ts, stale: false };
  }

  // Like getCache but also returns expired entries flagged stale (for cache-first
  // rendering: show stale instantly, refresh in background).
  async function getCacheStale(key) {
    const r = await local.get(CACHE_PREFIX + key);
    const entry = r[CACHE_PREFIX + key];
    if (!entry) return null;
    const stale = entry.ttl != null && Date.now() - entry.ts > entry.ttl;
    return { value: entry.v, ts: entry.ts, age: Date.now() - entry.ts, stale };
  }

  async function removeCache(key) { await local.remove(CACHE_PREFIX + key); }

  function onConfigChanged(cb) {
    const api = chromeApi?.storage?.onChanged;
    if (!api?.addListener) return () => {};
    const listener = (changes, areaName) => {
      if (areaName === "sync" && changes[CONFIG_KEY]) {
        configCache = changes[CONFIG_KEY].newValue || {};
        cb(configCache);
      }
    };
    api.addListener(listener);
    return () => api.removeListener?.(listener);
  }

  function onCacheChanged(cb) {
    const api = chromeApi?.storage?.onChanged;
    if (!api?.addListener) return () => {};
    const listener = (changes, areaName) => {
      if (areaName !== "local") return;
      for (const k of Object.keys(changes)) {
        if (k.startsWith(CACHE_PREFIX)) cb(k.slice(CACHE_PREFIX.length), changes[k].newValue?.v);
      }
    };
    api.addListener(listener);
    return () => api.removeListener?.(listener);
  }

  return {
    loadConfig, getConfig, setConfig, flush,
    getCache, getCacheStale, setCache, removeCache,
    onConfigChanged, onCacheChanged,
    CONFIG_KEY, CACHE_PREFIX, SYNC_ITEM_LIMIT,
  };
}

// Default singleton bound to the live chrome API (used by page + service worker).
export const storage = createStorage();
