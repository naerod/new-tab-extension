import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeStandings, normalizeMatches, createFootballDataAdapter } from "../js/providers/football-data.js";
import { normalizeScoreboard } from "../js/providers/espn.js";
import { buildRegistry } from "../js/providers/index.js";
import { toForm, formLabel, winnerFromScore } from "../js/providers/types.js";

// ---- football-data fixtures (v4 shape, trimmed) ----------------------------
const FD_STANDINGS = {
  competition: { code: "PL", name: "Premier League" },
  standings: [
    {
      type: "TOTAL",
      table: [
        { position: 1, team: { id: 57, name: "Arsenal FC", shortName: "Arsenal", tla: "ARS", crest: "x.png" },
          playedGames: 10, won: 8, draw: 1, lost: 1, goalsFor: 22, goalsAgainst: 7, goalDifference: 15, points: 25, form: "W,W,D,W,L" },
        { position: 2, team: { id: 65, name: "Manchester City", tla: "MCI" },
          playedGames: 10, won: 7, draw: 2, lost: 1, goalsFor: 25, goalsAgainst: 10, goalDifference: 15, points: 23, form: "W,L,W,W,W" },
      ],
    },
    { type: "HOME", table: [] },
  ],
};

const FD_MATCHES = {
  matches: [
    { id: 1, utcDate: "2026-06-20T14:00:00Z", status: "FINISHED", matchday: 10,
      homeTeam: { id: 57, name: "Arsenal FC", tla: "ARS" }, awayTeam: { id: 61, name: "Chelsea FC", tla: "CHE" },
      score: { fullTime: { home: 2, away: 1 }, winner: "HOME_TEAM" } },
    { id: 2, utcDate: "2026-06-27T16:30:00Z", status: "TIMED",
      homeTeam: { id: 57, name: "Arsenal FC" }, awayTeam: { id: 64, name: "Liverpool FC" },
      score: { fullTime: { home: null, away: null }, winner: null } },
  ],
};

test("football-data: standings -> internal Standing with form parsed", () => {
  const s = normalizeStandings(FD_STANDINGS);
  assert.equal(s.competition, "PL");
  assert.equal(s.rows.length, 2);
  const ars = s.rows[0];
  assert.equal(ars.team.name, "Arsenal FC");
  assert.equal(ars.team.source, "football-data");
  assert.equal(ars.points, 25);
  assert.deepEqual(ars.form, ["W", "W", "D", "W", "L"]);
});

test("football-data: only the TOTAL table is used", () => {
  const s = normalizeStandings(FD_STANDINGS);
  assert.equal(s.rows.length, 2); // HOME table (empty) ignored
});

test("football-data: matches -> internal Match with status + winner", () => {
  const m = normalizeMatches(FD_MATCHES, { competition: "PL" });
  assert.equal(m[0].status, "finished");
  assert.equal(m[0].winner, "home");
  assert.equal(m[0].home.score, 2);
  assert.equal(m[1].status, "scheduled");
  assert.equal(m[1].home.score, null);
  assert.equal(m[1].winner, null);
  assert.equal(m[0].source, "football-data");
});

test("football-data adapter: builds proxy URLs and returns internal types", async () => {
  const calls = [];
  const httpGet = async (url) => { calls.push(url); return url.includes("standings") ? FD_STANDINGS : FD_MATCHES; };
  const ad = createFootballDataAdapter({ httpGet });
  const s = await ad.getStandings("PL");
  assert.equal(s.rows[0].position, 1);
  assert.ok(calls[0].endsWith("/api/football/competitions/PL/standings"));
  const tm = await ad.getTeamMatches("57", { status: "FINISHED", limit: 5 });
  assert.equal(tm[0].id, "1");
  assert.ok(calls[1].includes("/api/football/teams/57/matches?status=FINISHED&limit=5"));
});

// ---- ESPN fixture ----------------------------------------------------------
const ESPN_SB = {
  leagues: [{ abbreviation: "ENG.1" }],
  events: [
    { id: "401", date: "2026-06-22T18:30Z", season: { slug: "2025-2026" },
      status: { type: { state: "in", completed: false } },
      competitions: [{
        status: { displayClock: "67'" },
        competitors: [
          { homeAway: "home", team: { id: "359", displayName: "Arsenal", abbreviation: "ARS", logo: "a.png" }, score: "1" },
          { homeAway: "away", team: { id: "364", displayName: "Liverpool", abbreviation: "LIV" }, score: "0" },
        ],
      }] },
    { id: "402", date: "2026-06-22T20:45Z",
      status: { type: { state: "post", completed: true } },
      competitions: [{ competitors: [
        { homeAway: "home", team: { id: "360", displayName: "Chelsea" }, score: "2" },
        { homeAway: "away", team: { id: "361", displayName: "Spurs" }, score: "3" },
      ] }] },
  ],
};

test("espn: scoreboard -> internal Match (live minute + finished winner)", () => {
  const m = normalizeScoreboard(ESPN_SB, { sport: "football" });
  assert.equal(m[0].status, "live");
  assert.equal(m[0].minute, 67);
  assert.equal(m[0].home.team.name, "Arsenal");
  assert.equal(m[1].status, "finished");
  assert.equal(m[1].winner, "away"); // Spurs 3-2
  assert.equal(m[0].source, "espn");
});

// ---- registry --------------------------------------------------------------
test("registry: find by capability + tier gating", () => {
  const reg = buildRegistry({ httpGet: async () => ({}) });
  const live = reg.find({ sport: "football", capability: "liveScores", maxTier: "free" });
  assert.deepEqual(live.map((p) => p.key), ["espn"]); // football-data has liveScores:false
  const standings = reg.find({ sport: "football", capability: "standings" });
  assert.deepEqual(standings.map((p) => p.key), ["football-data"]);
});

test("registry: free user never receives a pro provider", () => {
  const reg = buildRegistry({ httpGet: async () => ({}) });
  reg.register({ key: "pro-live", name: "Pro Live", sports: ["football"],
    capabilities: { liveScores: true }, tier: "pro" });
  const free = reg.find({ sport: "football", capability: "liveScores", maxTier: "free" });
  assert.ok(!free.some((p) => p.key === "pro-live"));
  const pro = reg.find({ sport: "football", capability: "liveScores", maxTier: "pro" });
  assert.ok(pro.some((p) => p.key === "pro-live"));
});

test("registry: pick prefers free over pro", () => {
  const reg = buildRegistry({ httpGet: async () => ({}) });
  reg.register({ key: "pro-live", name: "Pro", sports: ["football"], capabilities: { liveScores: true }, tier: "pro" });
  const best = reg.pick({ sport: "football", capability: "liveScores", maxTier: "pro" });
  assert.equal(best.key, "espn"); // free wins
});

// ---- type helpers ----------------------------------------------------------
test("toForm parses provider EN form (W/D/L), case-insensitive", () => {
  assert.deepEqual(toForm("W,D,L,W,W"), ["W", "D", "L", "W", "W"]);
  assert.deepEqual(toForm(["W", "l", "d"]), ["W", "L", "D"]);
  assert.deepEqual(toForm(""), []);
});

test("formLabel maps to FR (V/N/D) for display, EN passthrough", () => {
  assert.deepEqual(["W", "D", "L"].map((c) => formLabel(c, "fr")), ["V", "N", "D"]);
  assert.deepEqual(["W", "D", "L"].map((c) => formLabel(c, "en")), ["W", "D", "L"]);
});

test("winnerFromScore", () => {
  assert.equal(winnerFromScore(2, 1), "home");
  assert.equal(winnerFromScore(0, 0), "draw");
  assert.equal(winnerFromScore(null, 1), null);
});
