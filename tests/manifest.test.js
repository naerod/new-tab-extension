// manifest.test.js — garde-fous de sécurité du manifest MV3 (audit 2026-11).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));

function listFiles(dir, exts) {
  const out = [];
  for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
    const rel = join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(rel, exts));
    else if (exts.some((x) => e.name.endsWith(x))) out.push(rel);
  }
  return out;
}
const shipped = [...listFiles("js", [".js"]), "newtab.html", "changelog.html"];
const code = shipped.map((f) => readFileSync(join(root, f), "utf8")).join("\n");

test("CSP explicite : scripts locaux uniquement, pas d'unsafe-*", () => {
  const csp = manifest.content_security_policy?.extension_pages || "";
  assert.match(csp, /script-src 'self'(;|$)/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'none'/);
  assert.doesNotMatch(csp, /unsafe-(inline|eval)|https?:|\*/);
});

test("aucun script distant chargé par les pages", () => {
  for (const f of ["newtab.html", "changelog.html"]) {
    const html = readFileSync(join(root, f), "utf8");
    assert.doesNotMatch(html, /<script[^>]+src=["']?(https?:)?\/\//i, f);
  }
  assert.doesNotMatch(code, /\beval\s*\(|new Function\s*\(/);
  assert.doesNotMatch(code, /createElement\(\s*["']script["']\s*\)/);
});

test("chaque permission API déclarée est utilisée dans le code", () => {
  const used = {
    history: /chrome\.history\./, storage: /chrome\.storage\./, alarms: /chrome\.alarms\./,
    favicon: /\/_favicon\//, identity: /chrome\.identity\./, geolocation: /navigator\.geolocation/,
    "system.cpu": /chrome\.system\.cpu/, "system.memory": /chrome\.system\.memory/,
    "system.storage": /chrome\.system\.storage/, notifications: /chrome\.notifications\./,
  };
  for (const p of [...manifest.permissions, ...(manifest.optional_permissions || [])]) {
    assert.ok(used[p], `permission non justifiée dans le test : ${p}`);
    assert.match(code, used[p], `permission inutilisée : ${p}`);
  }
  assert.ok(!manifest.permissions.includes("tabs"), "tabs n'est pas nécessaire");
});

test("chaque host_permission correspond à un hôte référencé dans le code", () => {
  for (const pat of manifest.host_permissions) {
    const host = pat.replace(/^https:\/\//, "").replace(/\/\*$/, "");
    assert.ok(!host.includes("*"), `joker interdit dans host_permissions : ${pat}`);
    assert.ok(code.includes(host), `host_permission inutilisée : ${pat}`);
  }
});

test("pas de clé/IP privée/hôte .local dans les fichiers livrés", () => {
  assert.doesNotMatch(code, /\b(10|192\.168|172\.(1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/);
  assert.doesNotMatch(code, /AIza[0-9A-Za-z_-]{20,}|ghp_[A-Za-z0-9]{20,}|GOCSPX-|-----BEGIN [A-Z ]*PRIVATE KEY/);
});
