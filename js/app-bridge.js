// app-bridge.js — exposes the ES-module layers (storage, providers) to the legacy
// classic script (js/newtab.js), which cannot `import`. The page reads cache-first
// (filled by the service worker) and falls back to a direct keyless fetch.
//
// Module scripts are deferred, so this runs AFTER newtab.js. Consumers wait for the
// `nt:ready` event (or check window.NT).

import { storage } from "./core/storage.js";
import { buildRegistry } from "./providers/index.js";
import { formLabel } from "./providers/types.js";
import { COMP_TO_ESPN, FOOTBALL_LEAGUES, leagueName, DEFAULT_FOOTBALL, BASKET_TO_ESPN, BASKET_LEAGUES, basketName, TENNIS_TOURS, tennisName, tennisId } from "./providers/leagues.js";

const PROXY_BASE = "https://naerod.com";
const httpGet = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
};
// keyed sources (football-data) go through our proxy; absolute URL for the page
const proxyGet = (path) => httpGet(path.startsWith("http") ? path : PROXY_BASE + path);
const registry = buildRegistry({ httpGet, proxyGet });
const espn = registry.get("espn").adapter;
const footballData = registry.get("football-data").adapter;

async function footballStandings(code) {
  const key = "sport:standings:" + code;
  const cached = await storage.getCacheStale(key);
  if (cached && !cached.stale) return cached.value;
  try {
    const standing = await footballData.getStandings(code); // normalized Standing
    await storage.setCache(key, standing, 10 * 60_000);
    return standing;
  } catch (e) {
    return cached ? cached.value : null; // no token / off-season / rate-limited
  }
}

async function footballTeams(code) {
  const key = "sport:teams:" + code;
  const cached = await storage.getCacheStale(key);
  if (cached && !cached.stale) return cached.value;
  try {
    const teams = await footballData.getTeams(code);
    await storage.setCache(key, teams, 24 * 3600_000); // teams rarely change
    return teams;
  } catch (e) {
    return cached ? cached.value : [];
  }
}

async function footballTeamMatches(teamId, opts) {
  const key = "sport:team:" + teamId + ":" + ((opts && opts.status) || "ALL");
  const cached = await storage.getCacheStale(key);
  if (cached && !cached.stale) return cached.value;
  try {
    const matches = await footballData.getTeamMatches(teamId, opts);
    await storage.setCache(key, matches, 5 * 60_000);
    return matches;
  } catch (e) {
    return cached ? cached.value : [];
  }
}

// ---- Sport headlines (Google News RSS) — actus foot + esport ----------------
async function sportsHeadlines() {
  const key = "sport:news";
  const cached = await storage.getCacheStale(key);
  if (cached && !cached.stale) return cached.value;
  const queries = ["football actualité", "esport CS2 Counter-Strike Valorant League of Legends"];
  try {
    const all = [];
    for (const q of queries) {
      const url = "https://news.google.com/rss/search?q=" + encodeURIComponent(q) + "&hl=fr&gl=FR&ceid=FR:fr";
      const r = await fetch(url); if (!r.ok) continue;
      const doc = new DOMParser().parseFromString(await r.text(), "text/xml");
      Array.prototype.slice.call(doc.querySelectorAll("item"), 0, 8).forEach((it) => {
        const g = (s) => { const e = it.querySelector(s); return e ? e.textContent : ""; };
        const title = g("title");
        if (title) all.push({ title, link: g("link"), source: g("source"), date: g("pubDate") });
      });
    }
    const seen = new Set();
    const out = all.filter((n) => { const k = n.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
    await storage.setCache(key, out, 15 * 60_000);
    return out;
  } catch (e) { return cached ? cached.value : []; }
}

// ---- Basketball (ESPN, keyless) --------------------------------------------
async function basketScoreboard(code) {
  const key = "sport:bball:" + code;
  const cached = await storage.getCacheStale(key);
  if (cached && !cached.stale) return cached.value;
  const path = BASKET_TO_ESPN[code];
  if (!path) return cached ? cached.value : [];
  try {
    const matches = await espn.getScoreboard(path, { sport: "basketball" });
    await storage.setCache(key, matches, 60_000);
    return matches;
  } catch (e) { return cached ? cached.value : []; }
}

// ---- Tennis (TheSportsDB, public test key ; events only) -------------------
const TSDB = "https://www.thesportsdb.com/api/v1/json/3";
function tsdbToMatch(e) {
  const raw = (e.strStatus || "").toLowerCase();
  const st = /finish|ft|aet|after|match finished/.test(raw) ? "finished"
    : /(in play|live|1st|2nd|set)/.test(raw) ? "live"
    : "scheduled";
  const time = e.strTime && e.strTime !== "00:00:00" ? e.strTime : "12:00:00";
  const utcDate = e.dateEvent ? (e.dateEvent + "T" + time + "Z") : "";
  const n = (x) => (x != null && x !== "" ? Number(x) : null);
  return {
    id: e.idEvent, sport: "tennis", competition: e.strLeague || "", utcDate, status: st, minute: null,
    home: { team: { id: e.idHomeTeam || "", name: e.strHomeTeam || e.strEvent || "?", source: "thesportsdb" }, score: n(e.intHomeScore) },
    away: { team: { id: e.idAwayTeam || "", name: e.strAwayTeam || "", source: "thesportsdb" }, score: n(e.intAwayScore) },
    winner: null, source: "thesportsdb",
  };
}
async function tennisEvents(code) {
  const id = tennisId(code); if (!id) return [];
  const key = "sport:tennis:" + code;
  const cached = await storage.getCacheStale(key);
  if (cached && !cached.stale) return cached.value;
  try {
    const [past, next] = await Promise.all([
      httpGet(`${TSDB}/eventspastleague.php?id=${id}`).catch(() => ({})),
      httpGet(`${TSDB}/eventsnextleague.php?id=${id}`).catch(() => ({})),
    ]);
    const ev = [].concat(past.events || [], next.events || []).map(tsdbToMatch);
    await storage.setCache(key, ev, 10 * 60_000);
    return ev;
  } catch (e) { return cached ? cached.value : []; }
}

// ---- F1 (Jolpica / Ergast, keyless, direct) --------------------------------
const F1_BASE = "https://api.jolpi.ca/ergast/f1";
async function f1Get(path, key, ttl) {
  const cached = await storage.getCacheStale(key);
  if (cached && !cached.stale) return cached.value;
  try {
    const j = await httpGet(F1_BASE + path);
    await storage.setCache(key, j, ttl);
    return j;
  } catch (e) { return cached ? cached.value : null; }
}
async function f1Schedule() {
  const j = await f1Get("/current.json", "sport:f1:sched", 6 * 3600_000);
  return (j && j.MRData && j.MRData.RaceTable && j.MRData.RaceTable.Races) || [];
}
async function f1Standings(kind) {
  const path = kind === "constructor" ? "/current/constructorStandings.json" : "/current/driverStandings.json";
  const j = await f1Get(path, "sport:f1:" + kind, 6 * 3600_000);
  const lst = j && j.MRData && j.MRData.StandingsTable && j.MRData.StandingsTable.StandingsLists && j.MRData.StandingsTable.StandingsLists[0];
  if (!lst) return [];
  return kind === "constructor" ? (lst.ConstructorStandings || []) : (lst.DriverStandings || []);
}

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
  DEFAULT_FOOTBALL,
  BASKET_LEAGUES,
  basketName,
  basketScoreboard,
  TENNIS_TOURS,
  tennisName,
  tennisEvents,
  footballScoreboard,
  sportsHeadlines,
  footballStandings,
  footballTeams,
  footballTeamMatches,
  f1Schedule,
  f1Standings,
  refresh() { try { chrome.runtime.sendMessage({ type: "refresh" }); } catch (e) { /* SW asleep */ } },
};
window.dispatchEvent(new CustomEvent("nt:ready"));
