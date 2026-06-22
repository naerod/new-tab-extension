import { test } from "node:test";
import assert from "node:assert/strict";
import { createStorage } from "../js/core/storage.js";
import { createEntitlements } from "../js/core/entitlements.js";
import { buildRegistry } from "../js/providers/index.js";
import { makeChromeMock } from "./mock-chrome.js";

function setup(tier) {
  const chrome = makeChromeMock();
  if (tier) chrome.storage.sync._store.set("config", { tier });
  const storage = createStorage({ chrome, debounceMs: 1 });
  const registry = buildRegistry({ httpGet: async () => ({}) });
  registry.register({ key: "pro-live", name: "Pro", sports: ["football"], capabilities: { liveScores: true }, tier: "pro" });
  return createEntitlements({ storage, registry });
}

test("default tier is free", async () => {
  assert.equal(await setup().getTier(), "free");
});

test("free feature always available; pro feature gated", async () => {
  const free = setup();
  assert.equal(await free.hasFeature("anything"), true);
  assert.equal(await free.hasFeature("liveScoresRealtime"), false);
  const pro = setup("pro");
  assert.equal(await pro.hasFeature("liveScoresRealtime"), true);
});

test("providersFor respects the user's tier", async () => {
  const free = setup();
  const fp = await free.providersFor({ sport: "football", capability: "liveScores" });
  assert.ok(!fp.some((p) => p.key === "pro-live"));
  const pro = setup("pro");
  const pp = await pro.providersFor({ sport: "football", capability: "liveScores" });
  assert.ok(pp.some((p) => p.key === "pro-live"));
});
