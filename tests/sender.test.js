import { test } from "node:test";
import assert from "node:assert/strict";
import { isExtensionPage } from "../js/core/sender.js";
const ID = "abc", ORIGIN = "chrome-extension://abc/";

test("message de newtab.html accepté", () => {
  assert.equal(isExtensionPage({ id: ID, url: ORIGIN + "newtab.html", tab: { id: 1 } }, ID, ORIGIN), true);
});
test("content script sur gemini.google.com refusé", () => {
  assert.equal(isExtensionPage({ id: ID, url: "https://gemini.google.com/app", tab: { id: 2 } }, ID, ORIGIN), false);
});
test("autre extension refusée", () => {
  assert.equal(isExtensionPage({ id: "zzz", url: "chrome-extension://zzz/x.html" }, ID, ORIGIN), false);
  assert.equal(isExtensionPage(null, ID, ORIGIN), false);
});
