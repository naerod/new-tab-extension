// sw.js — MV3 service worker (module). Single owner of periodic polling (brief §3.2).
//
// MV3 service workers are ephemeral: setInterval/setTimeout are unreliable for
// periodic work (killed on termination). We use chrome.alarms. The SW fetches
// providers and writes chrome.storage.local (cache); the newtab reads cache-first
// and re-renders on chrome.storage.onChanged. The newtab can also ask for an
// immediate refresh via a message.

import { storage } from "./core/storage.js";
import { buildRegistry } from "./providers/index.js";
import { COMP_TO_ESPN, BASKET_TO_ESPN } from "./providers/leagues.js";

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

// Refresh live scoreboards for the leagues/teams the user follows. No follows => no-op.
async function refreshFollowedSports() {
  const cfg = (await storage.getConfig()) || {};
  const follows = cfg.follows || {};
  const sports = cfg.sports || [];
  const espn = registry.get("espn")?.adapter;
  if (!espn) return;

  const fbLeagues = new Set();
  if (sports.indexOf("football") !== -1) (follows.football || []).forEach((f) => { if (f.comp) fbLeagues.add(f.comp); }); // leagues + team comps
  for (const code of fbLeagues) {
    const path = COMP_TO_ESPN[code]; if (!path) continue;
    try { await storage.setCache(`sport:scoreboard:${code}`, await espn.getScoreboard(path, { sport: "football" }), 60_000); }
    catch (e) { console.warn("[sw] football refresh failed", code, e.message); }
  }
  const bkLeagues = new Set();
  if (sports.indexOf("basketball") !== -1) (follows.basketball || []).forEach((f) => { if (f.comp) bkLeagues.add(f.comp); });
  for (const code of bkLeagues) {
    const path = BASKET_TO_ESPN[code]; if (!path) continue;
    try { await storage.setCache(`sport:bball:${code}`, await espn.getScoreboard(path, { sport: "basketball" }), 60_000); }
    catch (e) { console.warn("[sw] basket refresh failed", code, e.message); }
  }
  await checkNotifications(cfg, fbLeagues, bkLeagues);
}

// §4.6 — notifications par entité (cloche). Diff start / but / résultat final vs
// le dernier état connu. Aucune notif au premier passage (évite le spam au boot).
async function checkNotifications(cfg, fbLeagues, bkLeagues) {
  if (!chrome.notifications) return; // permission "notifications" non accordée
  const notif = cfg.notif || {};
  if (!Object.keys(notif).some((k) => notif[k])) return;
  const follows = cfg.follows || {};
  const teamNames = (follows.football || []).filter((f) => f.type === "team" && notif["T:" + f.id]).map((f) => (f.name || "").toLowerCase()).filter(Boolean);

  const cands = [];
  for (const code of fbLeagues) {
    const c = await storage.getCache("sport:scoreboard:" + code);
    (c ? c.value : []).forEach((m) => {
      const leagueOn = notif["L:" + code];
      const teamOn = teamNames.some((n) => (m.home.team.name || "").toLowerCase().includes(n) || (m.away.team.name || "").toLowerCase().includes(n));
      if (leagueOn || teamOn) cands.push(m);
    });
  }
  for (const code of bkLeagues) {
    if (!notif["B:" + code]) continue;
    const c = await storage.getCache("sport:bball:" + code);
    (c ? c.value : []).forEach((m) => cands.push(m));
  }

  const prevC = await storage.getCache("sport:notif:state");
  const prev = (prevC && prevC.value) || {};
  const next = {};
  const fire = (title, message) => { try { chrome.notifications.create("", { type: "basic", iconUrl: chrome.runtime.getURL("icons/icon128.png"), title, message, silent: false }); } catch (e) { /* ignore */ } };

  for (const m of cands) {
    const key = m.sport + ":" + m.id;
    const cur = { st: m.status, h: m.home.score, a: m.away.score };
    next[key] = cur;
    const p = prev[key];
    if (!p) continue; // première observation : pas de notif
    const hn = m.home.team.shortName || m.home.team.name || "?";
    const an = m.away.team.shortName || m.away.team.name || "?";
    const sc = (m.home.score != null && m.away.score != null) ? (m.home.score + "–" + m.away.score) : "";
    if (p.st !== "live" && cur.st === "live") fire(hn + " – " + an, "Coup d'envoi");
    else if (cur.st === "live" && p.st === "live" && (cur.h !== p.h || cur.a !== p.a)) fire("But ! " + hn + " " + sc + " " + an, "Score mis à jour");
    else if (p.st !== "finished" && cur.st === "finished") fire("Terminé : " + hn + " " + sc + " " + an, "Résultat final");
  }
  await storage.setCache("sport:notif:state", next, 24 * 3600_000);
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
