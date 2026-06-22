/* Smoke test : exécute newtab.js dans un DOM minimal et déclenche tous les
   handlers click/change pour exercer les panneaux de réglages + onChange.
   But : attraper les erreurs runtime (ReferenceError/TypeError), pas valider le rendu. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ALL = [];           // { el, t, fn }
const errors = [];

function makeEl(tag) {
  const cls = new Set();
  const children = [];
  const listeners = [];
  const el = {
    tagName: (tag || "div").toUpperCase(),
    style: {}, dataset: {}, type: "", value: "", checked: false,
    textContent: "", innerHTML: "", _children: children,
    set className(v) { el._cn = v; cls.clear(); String(v || "").split(/\s+/).forEach((c) => c && cls.add(c)); },
    get className() { return el._cn || ""; },
    classList: {
      add: (...c) => c.forEach((x) => cls.add(x)),
      remove: (...c) => c.forEach((x) => cls.delete(x)),
      toggle: (c, f) => { const want = f === undefined ? !cls.has(c) : f; want ? cls.add(c) : cls.delete(c); return want; },
      contains: (c) => cls.has(c),
    },
    setAttribute() {}, getAttribute() { return ""; }, removeAttribute() {},
    appendChild: (c) => { children.push(c); return c; },
    insertBefore: (c) => { children.unshift(c); return c; },
    removeChild() {}, replaceChild() {}, remove() {}, replaceWith() {},
    addEventListener: (t, fn) => { listeners.push({ t, fn }); ALL.push({ el, t, fn }); },
    removeEventListener() {},
    querySelector: () => makeEl(), querySelectorAll: () => [],
    closest: () => makeEl(), focus() {}, blur() {},
    get firstChild() { return children[0] || null; },
    get previousElementSibling() { return makeEl(); },
    get parentNode() { return makeEl(); },
    get children() { return children; },
  };
  return el;
}

const document = {
  querySelector: () => makeEl(),
  querySelectorAll: () => [],
  createElement: (t) => makeEl(t),
  createTextNode: () => makeEl("#text"),
  addEventListener: (t, fn) => ALL.push({ el: "doc", t, fn }),
  body: makeEl("body"),
};

const store = {};
const chrome = {
  storage: { local: { get: (def, cb) => setTimeout(() => cb(Object.assign({}, def)), 0), set: () => {} } },
  history: { search: (q, cb) => setTimeout(() => cb([]), 0) },
  identity: { getAuthToken: (o, cb) => setTimeout(() => cb(null), 0), removeCachedAuthToken: (o, cb) => cb && cb() },
  runtime: { getURL: (p) => p, get lastError() { return new Error("no token (test)"); } },
};

const sandbox = {
  document, chrome, console,
  window: { open: () => {} },
  navigator: { geolocation: { getCurrentPosition: (ok, err) => err({ code: 1 }) } },
  fetch: () => Promise.resolve({ ok: false, status: 0, json: () => Promise.resolve({}), text: () => Promise.resolve("") }),
  DOMParser: class { parseFromString() { return { querySelectorAll: () => [] }; } },
  setInterval: () => 0, clearInterval: () => {}, setTimeout, clearTimeout,
  Intl, URL, Promise, Date, Math, JSON, encodeURIComponent, decodeURIComponent, parseInt, parseFloat, isNaN, Array, Object, String, Number, Set, Map,
};
sandbox.globalThis = sandbox;

const code = fs.readFileSync(path.join(__dirname, "..", "js", "newtab.js"), "utf8");
try {
  vm.runInNewContext(code, sandbox, { filename: "newtab.js" });
} catch (e) { errors.push("INIT: " + e.stack); }

const fired = new Set();
function fireAll(types) {
  for (let round = 0; round < 8; round++) {
    const batch = ALL.filter((h) => !fired.has(h) && types.indexOf(h.t) !== -1);
    if (!batch.length) break;
    batch.forEach((h) => {
      fired.add(h);
      const target = makeEl();
      const ev = { target, currentTarget: target, key: "Enter", preventDefault() {}, stopPropagation() {} };
      try { h.fn(ev); } catch (e) { errors.push(h.t + ": " + (e.stack || e.message)); }
    });
  }
}

setTimeout(() => {
  // 1er passage : storage prêt, widgets initialisés. On clique tout (ouvre les panneaux).
  fireAll(["click"]);
  // 2e : les contrôles des panneaux (toggles/segmented/select/stepper) -> onChange
  fireAll(["click", "change"]);
  setTimeout(() => {
    fireAll(["click", "change"]);
    const uniq = [...new Set(errors)];
    if (!uniq.length) { console.log("\n✅ SMOKE OK — handlers exercés:", ALL.length, "· aucune exception"); process.exit(0); }
    console.log("\n❌ " + uniq.length + " erreur(s):\n");
    uniq.slice(0, 25).forEach((e) => console.log("— " + e.split("\n").slice(0, 3).join("\n   ") + "\n"));
    process.exit(1);
  }, 50);
}, 50);
