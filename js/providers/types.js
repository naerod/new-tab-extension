// types.js — the app's OWN internal data model (brief §3.3).
// Every provider adapter translates upstream shapes into THESE types; the rest of
// the app never sees an upstream payload. Adding a Pro provider later = a new
// adapter, no UI change.
//
// Types are documented as JSDoc typedefs (vanilla JS, no TS) + tiny factories that
// normalize/guard fields.

/**
 * @typedef {Object} Team
 * @property {string} id          provider-scoped id
 * @property {string} name        full name
 * @property {string} [shortName] short label (e.g. "Arsenal")
 * @property {string} [tla]       three-letter abbreviation (e.g. "ARS")
 * @property {string} [crest]     logo URL
 * @property {string} source      provider key ("football-data", "espn"...)
 */

/**
 * @typedef {Object} MatchSide
 * @property {Team} team
 * @property {number|null} score
 */

/**
 * @typedef {Object} Match
 * @property {string} id
 * @property {string} sport            "football" | "basketball" | ...
 * @property {string} [competition]    competition code/name
 * @property {string} utcDate          ISO datetime (UTC)
 * @property {"scheduled"|"live"|"finished"|"postponed"|"unknown"} status
 * @property {number|null} [minute]    live minute when status === "live"
 * @property {MatchSide} home
 * @property {MatchSide} away
 * @property {"home"|"away"|"draw"|null} winner
 * @property {string} source
 */

/**
 * @typedef {Object} StandingRow
 * @property {number} position
 * @property {Team} team
 * @property {number} played
 * @property {number} won
 * @property {number} draw
 * @property {number} lost
 * @property {number} goalsFor
 * @property {number} goalsAgainst
 * @property {number} goalDifference
 * @property {number} points
 * @property {Array<"W"|"D"|"L">} form  most-recent-last
 */

/**
 * @typedef {Object} Standing
 * @property {string} competition
 * @property {StandingRow[]} rows
 * @property {string} source
 */

/**
 * @typedef {Object} Competition
 * @property {string} id
 * @property {string} name
 * @property {string} [code]
 * @property {string} [emblem]
 * @property {string} sport
 */

/** @typedef {Object} Driver  (F1 — filled in Phase B4)
 * @property {string} id @property {string} name @property {string} [code]
 * @property {string} [team] @property {number} [position] @property {number} [points] */

/** @typedef {Object} Player  (tennis/football — filled in Phase B4)
 * @property {string} id @property {string} name @property {number} [ranking] */

/** @typedef {Object} Session (F1/tennis session — filled in Phase B4)
 * @property {string} id @property {string} name @property {string} utcDate @property {string} [kind] */

// Upstream providers always report form in English (W/D/L). FR display (V/N/D) is
// a *rendering* concern, handled by formLabel() — never mix the two when parsing,
// because "D" means Draw in EN but Défaite (Loss) in FR.
const FORM_MAP = { W: "W", D: "D", L: "L" };

/** Normalize a provider form string/array into ["W","D","L",...] (most-recent-last). */
export function toForm(raw) {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : String(raw).split(/[,\s]+/);
  return arr.map((x) => FORM_MAP[String(x).trim().toUpperCase()]).filter(Boolean);
}

// Display label for a form result, per language (brief §4.3 colours handled in CSS:
// W=win/green, D=draw/white, L=loss/red).
const FORM_LABEL = { fr: { W: "V", D: "N", L: "D" }, en: { W: "W", D: "D", L: "L" } };
export function formLabel(code, lang = "fr") {
  return (FORM_LABEL[lang] || FORM_LABEL.fr)[code] || code;
}

/** @returns {Team} */
export function makeTeam(p) {
  return {
    id: String(p.id ?? ""),
    name: p.name ?? p.displayName ?? "",
    shortName: p.shortName ?? p.short ?? undefined,
    tla: p.tla ?? p.abbreviation ?? undefined,
    crest: p.crest ?? p.logo ?? undefined,
    source: p.source ?? "",
  };
}

const numOrNull = (x) => (x === null || x === undefined || x === "" ? null : Number(x));

/** @returns {Match} */
export function makeMatch(p) {
  return {
    id: String(p.id ?? ""),
    sport: p.sport ?? "football",
    competition: p.competition ?? undefined,
    utcDate: p.utcDate ?? "",
    status: p.status ?? "unknown",
    minute: p.minute ?? null,
    home: { team: makeTeam({ ...p.home?.team, source: p.source }), score: numOrNull(p.home?.score) },
    away: { team: makeTeam({ ...p.away?.team, source: p.source }), score: numOrNull(p.away?.score) },
    winner: p.winner ?? null,
    source: p.source ?? "",
  };
}

/** Derive winner from scores when upstream doesn't say. */
export function winnerFromScore(home, away) {
  if (home == null || away == null) return null;
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}
