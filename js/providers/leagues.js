// leagues.js — curated football competitions for V1 (brief §3.3 stack).
// `code` is football-data.org's competition code (used for the proxy / standings
// later); `espn` is ESPN's keyless league path (used now for matches).
// Shared by the service worker and the page bridge so the mapping lives in ONE place.

const CR = "https://crests.football-data.org/";
export const FOOTBALL_LEAGUES = [
  { code: "PL",  name: "Premier League",        espn: "soccer/eng.1",          logo: CR + "PL.png" },
  { code: "PD",  name: "La Liga",               espn: "soccer/esp.1",          logo: CR + "laliga.png" },
  { code: "BL1", name: "Bundesliga",            espn: "soccer/ger.1",          logo: CR + "BL1.png" },
  { code: "SA",  name: "Serie A",               espn: "soccer/ita.1",          logo: CR + "c111.png" },
  { code: "FL1", name: "Ligue 1",               espn: "soccer/fra.1",          logo: CR + "FL1.png" },
  { code: "DED", name: "Eredivisie",            espn: "soccer/ned.1",          logo: CR + "ED.png" },
  { code: "PPL", name: "Primeira Liga",         espn: "soccer/por.1",          logo: CR + "PPL.png" },
  { code: "ELC", name: "Championship",          espn: "soccer/eng.2",          logo: CR + "ELC.png" },
  { code: "CL",  name: "Ligue des Champions",   espn: "soccer/uefa.champions", logo: CR + "CL.png" },
  { code: "EL",  name: "Ligue Europa",          espn: "soccer/uefa.europa",    logo: CR + "EL.png" },
  { code: "BSA", name: "Brasileirão",           espn: "soccer/bra.1",          logo: CR + "bsa.png" },
  { code: "WC",  name: "Coupe du monde",        espn: "soccer/fifa.world",     logo: CR + "wm26.png" },
  { code: "EC",  name: "Euro",                  espn: "soccer/uefa.euro",      logo: CR + "EC.png" },
];
export const leagueLogo = (code) => (FOOTBALL_LEAGUES.find((l) => l.code === code) || {}).logo || "";

// Compétitions affichées par défaut (football activé, aucun suivi) → affiches du
// jour. Les majors en cours (CDM/Euro) priment ; off-saison → simplement vides.
export const DEFAULT_FOOTBALL = ["WC", "EC", "CL", "EL", "PL", "PD", "SA", "BL1", "FL1"];

export const COMP_TO_ESPN = Object.fromEntries(FOOTBALL_LEAGUES.map((l) => [l.code, l.espn]));
export const leagueName = (code) => (FOOTBALL_LEAGUES.find((l) => l.code === code) || {}).name || code;

// Basketball — keyless ESPN scoreboards (matches only ; standings later).
export const BASKET_LEAGUES = [
  { code: "NBA", name: "NBA", espn: "basketball/nba" },
  { code: "WNBA", name: "WNBA", espn: "basketball/wnba" },
];
export const BASKET_TO_ESPN = Object.fromEntries(BASKET_LEAGUES.map((l) => [l.code, l.espn]));
export const basketName = (code) => (BASKET_LEAGUES.find((l) => l.code === code) || {}).name || code;

// Tennis — TheSportsDB tours (events only ; rankings/draw later). id = TheSportsDB idLeague.
export const TENNIS_TOURS = [
  { code: "ATP", name: "ATP", id: "4464" },
  { code: "WTA", name: "WTA", id: "4517" },
];
export const tennisName = (code) => (TENNIS_TOURS.find((l) => l.code === code) || {}).name || code;
export const tennisId = (code) => (TENNIS_TOURS.find((l) => l.code === code) || {}).id;
