import { test } from "node:test";
import assert from "node:assert/strict";
import { createStorage, byteSize } from "../js/core/storage.js";
import { makeChromeMock } from "./mock-chrome.js";

function freshStorage() {
  const chrome = makeChromeMock();
  const storage = createStorage({ chrome, debounceMs: 5 });
  return { chrome, storage };
}

test("config: set then get round-trips after flush", async () => {
  const { storage } = freshStorage();
  storage.setConfig("theme", "light");
  await storage.flush();
  assert.equal(await storage.getConfig("theme"), "light");
});

test("config: get returns default for missing key", async () => {
  const { storage } = freshStorage();
  assert.equal(await storage.getConfig("missing", "fallback"), "fallback");
});

test("config: writes are debounced into a single sync.set", async () => {
  const { chrome, storage } = freshStorage();
  let writes = 0;
  const realSet = chrome.storage.sync.set.bind(chrome.storage.sync);
  chrome.storage.sync.set = (obj, cb) => { writes++; return realSet(obj, cb); };
  storage.setConfig("a", 1);
  storage.setConfig("b", 2);
  const p = storage.setConfig("c", 3);
  await p; // resolves on flush
  assert.equal(writes, 1, "three setConfig calls collapse into one write");
  assert.deepEqual(await storage.getConfig(), { a: 1, b: 2, c: 3 });
});

test("config: persisted across a fresh storage instance (same areas)", async () => {
  const chrome = makeChromeMock();
  const s1 = createStorage({ chrome, debounceMs: 1 });
  s1.setConfig("engine", "claude");
  await s1.flush();
  const s2 = createStorage({ chrome, debounceMs: 1 });
  assert.equal(await s2.getConfig("engine"), "claude");
});

test("config: rejects when serialized config exceeds 8 KB (sync per-item limit)", async () => {
  const { storage } = freshStorage();
  const p = storage.setConfig("blob", "x".repeat(9000));
  await assert.rejects(() => storage.flush(), /config too large for sync/);
  await assert.rejects(p, /config too large for sync/); // the pending write rejects too
});

test("config: a realistic multi-follow sport config stays well under 8 KB", () => {
  const cfg = {
    theme: "dark", lang: "fr", engine: "google",
    sports: ["football", "f1", "tennis", "basketball"],
    follows: {
      football: [
        { type: "team", id: "57", name: "Arsenal", comp: "PL" },
        { type: "team", id: "524", name: "PSG", comp: "FL1" },
        { type: "team", id: "773", name: "France", comp: "WC" },
      ],
      f1: [{ type: "constructor", id: "ferrari" }, { type: "driver", id: "max_verstappen" }],
      tennis: [{ type: "player", id: "alcaraz" }],
    },
    widgetOrder: ["sport", "weather", "stocks", "news", "agenda"],
    notif: { "team:57": true },
  };
  assert.ok(byteSize(cfg) < 8192, `config is ${byteSize(cfg)} bytes`);
});

test("cache: setCache/getCache round-trips and respects TTL", async () => {
  const { storage } = freshStorage();
  await storage.setCache("weather", { t: 21 }, 50);
  const hit = await storage.getCache("weather");
  assert.deepEqual(hit.value, { t: 21 });
  assert.equal(hit.stale, false);
});

test("cache: getCache returns null past TTL, getCacheStale flags it", async () => {
  const { storage } = freshStorage();
  await storage.setCache("scores", [1, 2, 3], -1); // already expired
  assert.equal(await storage.getCache("scores"), null);
  const stale = await storage.getCacheStale("scores");
  assert.deepEqual(stale.value, [1, 2, 3]);
  assert.equal(stale.stale, true);
});

test("cache: never leaks into the sync (config) area", async () => {
  const { chrome, storage } = freshStorage();
  await storage.setCache("big", "y".repeat(20000), 1000);
  assert.equal(chrome.storage.sync._store.size, 0, "sync area untouched by cache writes");
});

test("onConfigChanged fires with the new config object", async () => {
  const { chrome, storage } = freshStorage();
  await storage.loadConfig();
  let received = null;
  storage.onConfigChanged((cfg) => { received = cfg; });
  // simulate a write coming from another machine
  chrome.storage.sync.set({ config: { theme: "light" } });
  assert.deepEqual(received, { theme: "light" });
});
