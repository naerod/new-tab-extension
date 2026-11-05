import { test } from "node:test";
import assert from "node:assert/strict";
await import("../js/core/sanitize.js");
const { safeHref, safeImgSrc, safeColor } = globalThis.NTSanitize;

test("safeHref neutralise les schémas dangereux", () => {
  for (const bad of ["javascript:alert(1)", " JaVaScRiPt:alert(1)", "java\tscript:alert(1)",
    "data:text/html,<script>alert(1)</script>", "vbscript:x", "file:///etc/passwd"]) {
    assert.equal(safeHref(bad), "#", bad);
  }
});
test("safeHref conserve les liens légitimes", () => {
  for (const ok of ["https://example.com/a?b=1", "http://x.fr", "mailto:a@b.c",
    "chrome://extensions", "#", "/x", "example.com"]) assert.equal(safeHref(ok), ok);
  assert.equal(safeHref(null), "#");
  assert.equal(safeHref(""), "#");
});
test("safeImgSrc : http(s), local ou data:image raster seulement", () => {
  assert.equal(safeImgSrc("https://a.b/i.png"), "https://a.b/i.png");
  assert.equal(safeImgSrc("data:image/png;base64,AAAA"), "data:image/png;base64,AAAA");
  assert.equal(safeImgSrc("data:image/svg+xml,<svg onload=x>"), "");
  assert.equal(safeImgSrc("javascript:x"), "");
  assert.equal(safeImgSrc("//evil.com/x"), "");
});
test("safeColor bloque l'injection CSS", () => {
  assert.equal(safeColor("#a1b2c3"), "#a1b2c3");
  assert.equal(safeColor("red"), "red");
  assert.equal(safeColor("red;background:url(https://x)"), "");
});
