// app-bridge.js — exposes the ES-module layers (storage, providers) to the legacy
// classic script (js/newtab.js), which cannot `import`. The page reads cache-first
// (filled by the service worker) and falls back to a direct keyless fetch.
//
// Module scripts are deferred, so this runs AFTER newtab.js. Consumers wait for the
// `nt:ready` event (or check window.NT).

import { storage } from "./core/storage.js";
import { buildRegistry } from "./providers/index.js";
import { formLabel } from "./providers/types.js";
import { COMP_TO_ESPN, FOOTBALL_LEAGUES, leagueName } from "./providers/leagues.js";

const httpGet = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
};
const registry = buildRegistry({ httpGet });
const espn = registry.get("espn").adapter;

async function footballScoreboard(code) {
  const key = "sport:scoreboard:" + code;
  const cached = await storage.getCacheStale(key);
  if (cached && !cached.stale) return cached.value;        // fresh cache (from SW)
  const path = COMP_TO_ESPN[code];
  if (!path) return cached ? cached.value : [];
  try {
    const matches = await espn.getScoreboard(path, { sport: "football" });
    await storage.setCache(key, matches, 60_000);
    return matches;
  } catch (e) {
    return cached ? cached.value : [];                     // network down -> stale better than nothing
  }
}

window.NT = {
  storage,
  formLabel,
  FOOTBALL_LEAGUES,
  leagueName,
  footballScoreboard,
  refresh() { try { chrome.runtime.sendMessage({ type: "refresh" }); } catch (e) { /* SW asleep */ } },
};
window.dispatchEvent(new CustomEvent("nt:ready"));
