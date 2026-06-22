import { test } from "node:test";
import assert from "node:assert/strict";
import { FOOTBALL_LEAGUES, COMP_TO_ESPN, leagueName } from "../js/providers/leagues.js";

test("every league has a code, name and ESPN soccer path", () => {
  for (const l of FOOTBALL_LEAGUES) {
    assert.ok(l.code && l.name, `bad league ${JSON.stringify(l)}`);
    assert.match(l.espn, /^soccer\//, `bad espn path for ${l.code}`);
  }
});

test("COMP_TO_ESPN maps codes to ESPN paths", () => {
  assert.equal(COMP_TO_ESPN.PL, "soccer/eng.1");
  assert.equal(COMP_TO_ESPN.FL1, "soccer/fra.1");
});

test("leagueName resolves, falls back to the code", () => {
  assert.equal(leagueName("PL"), "Premier League");
  assert.equal(leagueName("ZZZ"), "ZZZ");
});
