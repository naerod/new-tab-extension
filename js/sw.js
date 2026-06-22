// sw.js — MV3 service worker (module). Single owner of periodic polling (brief §3.2).
//
// MV3 service workers are ephemeral: setInterval/setTimeout are unreliable for
// periodic work (killed on termination). We use chrome.alarms. The SW fetches
// providers and writes chrome.storage.local (cache); the newtab reads cache-first
// and re-renders on chrome.storage.onChanged. The newtab can also ask for an
// immediate refresh via a message.

import { storage } from "./core/storage.js";
import { buildRegistry } from "./providers/index.js";
import { COMP_TO_ESPN } from "./providers/leagues.js";

const ALARM = "poll";
const PERIOD_MIN = 1; // chrome.alarms minimum is ~30s; 1 min is courteous to free APIs

const httpGet = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json();
};
// Keyed sources go through our proxy (ADR-007). Absolute base so the SW can fetch it.
const PROXY_BASE = "https://naerod.com";
const proxyGet = async (path) => httpGet(path.startsWith("http") ? path : PROXY_BASE + path);

const registry = buildRegistry({ httpGet, proxyGet });

// Refresh live scoreboards for the leagues the user follows. No follows => no-op.
async function refreshFollowedSports() {
  const follows = (await storage.getConfig("follows", {})) || {};
  const football = follows.football || [];
  const leagues = new Set(football.map((f) => f.comp).filter(Boolean));
  const espn = registry.get("espn")?.adapter;
  if (!espn) return;
  for (const code of leagues) {
    const path = COMP_TO_ESPN[code];
    if (!path) continue;
    try {
      const matches = await espn.getScoreboard(path, { sport: "football" });
      await storage.setCache(`sport:scoreboard:${code}`, matches, 60_000);
    } catch (e) {
      console.warn("[sw] scoreboard refresh failed", code, e.message);
    }
  }
}

async function tick() {
  try { await refreshFollowedSports(); }
  catch (e) { console.warn("[sw] tick error", e); }
}

function ensureAlarm() {
  chrome.alarms.get(ALARM, (a) => {
    if (!a) chrome.alarms.create(ALARM, { periodInMinutes: PERIOD_MIN });
  });
}

chrome.runtime.onInstalled.addListener(() => { ensureAlarm(); tick(); });
chrome.runtime.onStartup.addListener(() => { ensureAlarm(); tick(); });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) tick(); });

// On-demand refresh from the newtab: chrome.runtime.sendMessage({type:"refresh"})
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "refresh") { tick().then(() => sendResponse({ ok: true })); return true; }
  return false;
});
