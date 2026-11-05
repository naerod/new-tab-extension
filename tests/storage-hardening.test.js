// Données stockées corrompues ou falsifiées (audit sécurité 2026-11).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createStorage } from "../js/core/storage.js";
import { makeChromeMock } from "./mock-chrome.js";

test("config corrompue (chaîne, tableau, null) -> objet vide", async () => {
  for (const bad of ["oops", [1, 2], null, 42]) {
    const chrome = makeChromeMock();
    chrome.storage.sync._store.set("config", bad);
    const s = createStorage({ chrome, debounceMs: 1 });
    assert.deepEqual(await s.getConfig(), {});
    assert.equal(await s.getConfig("x", "def"), "def");
    await s.setConfig("x", 1);
    assert.equal(await s.getConfig("x"), 1);
  }
});

test("getConfig ignore les clés héritées du prototype", async () => {
  const s = createStorage({ chrome: makeChromeMock(), debounceMs: 1 });
  assert.equal(await s.getConfig("__proto__", "d"), "d");
  assert.equal(await s.getConfig("toString", "d"), "d");
  assert.equal(await s.getConfig("constructor", "d"), "d");
});

test("setConfig refuse __proto__ (pollution de prototype)", async () => {
  const s = createStorage({ chrome: makeChromeMock(), debounceMs: 1 });
  await assert.rejects(s.setConfig("__proto__", { polluted: true }));
  assert.equal({}.polluted, undefined);
});

test("entrée de cache mal formée -> null (pas servie comme fraîche)", async () => {
  const chrome = makeChromeMock();
  const s = createStorage({ chrome, debounceMs: 1 });
  for (const bad of ["str", { v: 1 }, { v: 1, ts: "now" }, { v: 1, ts: Date.now(), ttl: "x" }]) {
    chrome.storage.local._store.set("cache:k", bad);
    assert.equal(await s.getCache("k"), null);
    assert.equal(await s.getCacheStale("k"), null);
  }
});
