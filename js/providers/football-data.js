// football-data.js — adapter for football-data.org (brief §3.3).
// Free token required -> the extension talks to OUR proxy (naerod-api, ADR-007),
// never to football-data directly, so no key ships in the bundle. The proxy
// forwards the football-data v4 JSON unchanged, so the normalizers below target
// the v4 shape.
//
// Capabilities: standings + fixtures + results (free). NO live scores (live is
// paid upstream) -> liveScores:false. Use ESPN for approximate live.

import { makeTeam, toForm, winnerFromScore } from "./types.js";

const SOURCE = "football-data";

// football-data v4 statuses -> internal status
const STATUS = {
  SCHEDULED: "scheduled", TIMED: "scheduled",
  IN_PLAY: "live", PAUSED: "live",
  FINISHED: "finished", AWARDED: "finished",
  POSTPONED: "postponed", SUSPENDED: "postponed", CANCELLED: "postponed",
};

export function normalizeTeam(t) {
  return makeTeam({ id: t.id, name: t.name, shortName: t.shortName, tla: t.tla, crest: t.crest, source: SOURCE });
}

/** @returns {import("./types.js").Standing|null} */
export function normalizeStandings(json, { competition } = {}) {
  const table = (json?.standings || []).find((s) => s.type === "TOTAL") || json?.standings?.[0];
  if (!table) return null;
  const comp = competition || json?.competition?.code || json?.competition?.name || "";
  const rows = (table.table || []).map((r) => ({
    position: r.position,
    team: normalizeTeam(r.team || {}),
    played: r.playedGames ?? 0,
    won: r.won ?? 0,
    draw: r.draw ?? 0,
    lost: r.lost ?? 0,
    goalsFor: r.goalsFor ?? 0,
    goalsAgainst: r.goalsAgainst ?? 0,
    goalDifference: r.goalDifference ?? (r.goalsFor ?? 0) - (r.goalsAgainst ?? 0),
    points: r.points ?? 0,
    form: toForm(r.form),
  }));
  return { competition: comp, rows, source: SOURCE };
}

/** @returns {import("./types.js").Team[]} */
export function normalizeTeams(json) {
  return (json?.teams || []).map(normalizeTeam);
}

/** @returns {import("./types.js").Match[]} */
export function normalizeMatches(json, { competition } = {}) {
  return (json?.matches || []).map((m) => {
    const home = m.score?.fullTime?.home ?? null;
    const away = m.score?.fullTime?.away ?? null;
    let winner = null;
    if (m.score?.winner === "HOME_TEAM") winner = "home";
    else if (m.score?.winner === "AWAY_TEAM") winner = "away";
    else if (m.score?.winner === "DRAW") winner = "draw";
    else winner = winnerFromScore(home, away);
    return {
      id: String(m.id),
      sport: "football",
      competition: competition || m.competition?.code || "",
      utcDate: m.utcDate || "",
      status: STATUS[m.status] || "unknown",
      minute: m.minute ?? null,
      home: { team: normalizeTeam(m.homeTeam || {}), score: home },
      away: { team: normalizeTeam(m.awayTeam || {}), score: away },
      winner,
      source: SOURCE,
    };
  });
}

// ---- live fetchers (httpGet injected: page/SW pass a proxy-aware getter) -----
export function createFootballDataAdapter({ httpGet, base = "/api/football" } = {}) {
  if (typeof httpGet !== "function") throw new Error("httpGet required");
  return {
    source: SOURCE,
    async getStandings(competitionId) {
      const json = await httpGet(`${base}/competitions/${competitionId}/standings`);
      return normalizeStandings(json, { competition: competitionId });
    },
    async getCompetitionMatches(competitionId, { dateFrom, dateTo, status } = {}) {
      const qs = new URLSearchParams();
      if (dateFrom) qs.set("dateFrom", dateFrom);
      if (dateTo) qs.set("dateTo", dateTo);
      if (status) qs.set("status", status);
      const q = qs.toString() ? `?${qs}` : "";
      const json = await httpGet(`${base}/competitions/${competitionId}/matches${q}`);
      return normalizeMatches(json, { competition: competitionId });
    },
    async getTeamMatches(teamId, { status = "FINISHED", limit = 5 } = {}) {
      const json = await httpGet(`${base}/teams/${teamId}/matches?status=${status}&limit=${limit}`);
      return normalizeMatches(json);
    },
    async getTeams(competitionId) {
      const json = await httpGet(`${base}/competitions/${competitionId}/teams`);
      return normalizeTeams(json);
    },
  };
}

export const footballDataProvider = {
  key: SOURCE,
  name: "football-data.org",
  sports: ["football"],
  capabilities: { standings: true, fixtures: true, results: true, liveScores: false, search: false },
  tier: "free",
  note: "via proxy naerod-api; scores différés (live = pro)",
};
