// load-extension.mjs — charge l'extension non empaquetée dans Chromium (Playwright)
// et vérifie : service worker démarré, newtab.html rendu, aucune erreur CSP/JS,
// aucune requête vers un script distant. Le réseau externe est bloqué (stub).
// Usage : npm run test:e2e
import { createRequire } from "node:module";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("playwright-core"); }
const ext = new URL("../..", import.meta.url).pathname;
const ctx = await pw.chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "ntx-")), {
  headless: false,
  args: ["--headless=new", `--disable-extensions-except=${ext}`, `--load-extension=${ext}`, "--no-sandbox"],
});
const errors = [];
const remoteScripts = [];
try {
  await ctx.route(/^https?:\/\//, (route) => {
    if (route.request().resourceType() === "script") remoteScripts.push(route.request().url());
    route.fulfill({ status: 503, body: "" });
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent("serviceworker", { timeout: 15000 });
  const id = new URL(sw.url()).host;
  console.log("extension id:", id);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy|Refused to/i.test(m.text())) errors.push("csp: " + m.text());
  });
  await page.goto(`chrome-extension://${id}/newtab.html`);
  await page.waitForTimeout(2500);
  assert.equal(await page.evaluate(() => typeof globalThis.NTSanitize?.safeHref), "function");
  // XSS : un raccourci javascript: est neutralisé à l'affichage
  const href = await page.evaluate(() => NTSanitize.safeHref("javascript:alert(document.domain)"));
  assert.equal(href, "#");
  await page.goto(`chrome-extension://${id}/changelog.html`);
  await page.waitForTimeout(1000);
  assert.deepEqual(remoteScripts, [], "scripts distants chargés : " + remoteScripts.join(", "));
  assert.deepEqual(errors, [], errors.join("\n"));
  console.log("OK — extension chargée, aucune erreur CSP/JS, aucun script distant");
} finally {
  await ctx.close();
}
