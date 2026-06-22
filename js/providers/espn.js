// espn.js — adapter for ESPN's public (unofficial, keyless) scoreboard API.
// Used for approximate near-live scores (polled 30-60s) and as a broad
// multi-sport fallback (brief §3.3). Wrapped cleanly behind our internal types.

import { makeTeam, winnerFromScore } from "./types.js";

const SOURCE = "espn";

// ESPN status state -> internal status
function mapStatus(ev) {
  const st = ev?.status?.type?.state;
  if (st === "pre") return "scheduled";
  if (st === "in") return "live";
  if (st === "post") return "finished";
  return "unknown";
}

function side(competitors, homeAway) {
  const c = (competitors || []).find((x) => x.homeAway === homeAway) || {};
  return {
    team: makeTeam({
      id: c.team?.id, name: c.team?.displayName, shortName: c.team?.shortDisplayName,
      tla: c.team?.abbreviation, crest: c.team?.logo, source: SOURCE,
    }),
    score: c.score === undefined || c.score === "" ? null : Number(c.score),
  };
}

/** @returns {import("./types.js").Match[]} */
export function normalizeScoreboard(json, { sport = "football" } = {}) {
  return (json?.events || []).map((ev) => {
    const comp = ev.competitions?.[0] || {};
    const home = side(comp.competitors, "home");
    const away = side(comp.competitors, "away");
    const status = mapStatus(ev);
    return {
      id: String(ev.id),
      sport,
      competition: ev.season?.slug || json?.leagues?.[0]?.abbreviation || "",
      utcDate: ev.date || "",
      status,
      minute: status === "live" ? (comp.status?.displayClock ? parseInt(comp.status.displayClock, 10) || null : null) : null,
      home, away,
      winner: status === "finished" ? winnerFromScore(home.score, away.score) : null,
      source: SOURCE,
    };
  });
}

export function createEspnAdapter({ httpGet, base = "https://site.api.espn.com/apis/site/v2/sports" } = {}) {
  if (typeof httpGet !== "function") throw new Error("httpGet required");
  // league path examples: soccer/eng.1, soccer/fra.1, basketball/nba
  return {
    source: SOURCE,
    async getScoreboard(leaguePath, { sport = "football" } = {}) {
      const json = await httpGet(`${base}/${leaguePath}/scoreboard`);
      return normalizeScoreboard(json, { sport });
    },
  };
}

export const espnProvider = {
  key: SOURCE,
  name: "ESPN (public)",
  sports: ["football", "basketball", "americanfootball", "hockey", "baseball"],
  capabilities: { standings: false, fixtures: true, results: true, liveScores: true, search: false },
  tier: "free",
  note: "API non officielle, scores quasi-live par polling 30-60s",
};
