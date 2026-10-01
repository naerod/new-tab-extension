// Synchro des réglages (js/sync.js) : navigateur neuf, push, conflit, restauration.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../js/sync.js", import.meta.url), "utf8");

function area(init = {}) {
  const d = { ...init };
  return {
    d,
    get: (k, cb) => cb(k === null ? { ...d } : Object.fromEntries([].concat(k).filter((x) => x in d).map((x) => [x, d[x]]))),
    set: (o, cb) => { Object.assign(d, o); cb && cb(); },
    remove: (k, cb) => { delete d[k]; cb && cb(); },
    clear: (cb) => { Object.keys(d).forEach((k) => delete d[k]); cb && cb(); },
  };
}
function server() {
  const s = { doc: null, at: null, n: 0 };
  s.api = async (path, o = {}) => {
    if (!o.method) return { ok: true, status: 200, json: async () => ({ data: s.doc, updated_at: s.at }) };
    const b = JSON.parse(o.body);
    if (s.at && b.base !== s.at) return { ok: false, status: 409 };
    s.doc = b.data; s.at = "v" + ++s.n;
    return { ok: true, status: 200, json: async () => ({ updated_at: s.at }) };
  };
  return s;
}
function boot(srv, syncData, user = { username: "u" }) {
  const sy = area(syncData), lo = area();
  const ctx = { console, setTimeout, clearTimeout, location: { reload() {} },
    chrome: { storage: { sync: sy, local: lo, onChanged: { addListener() {} } } },
    NRDAccount: { getUser: async () => user, api: srv.api, onChange() {} } };
  ctx.window = ctx;
  vm.runInNewContext(src, ctx);
  return { ctx, sy, lo };
}

test("compte vide : le navigateur pousse ses réglages", async () => {
  const srv = server(); const b = boot(srv, { widgetCfg: { a: 1 }, onboarded: true });
  assert.equal(await b.ctx.NRDSync.sync(), "pushed");
  assert.deepEqual(srv.doc, { widgetCfg: { a: 1 }, onboarded: true });
});
test("navigateur neuf + compte existant : le compte gagne (restauration)", async () => {
  const srv = server(); srv.doc = { widgetCfg: { a: 9 }, onboarded: true }; srv.at = "v0";
  const b = boot(srv, {});
  assert.equal(await b.ctx.NRDSync.sync(), "applied");
  assert.deepEqual(b.sy.d, { widgetCfg: { a: 9 }, onboarded: true });
  assert.equal(await b.ctx.NRDSync.sync(), "same");
});
test("réglages modifiés ailleurs : le navigateur propre suit le compte", async () => {
  const srv = server(); const b = boot(srv, { x: 1 });
  await b.ctx.NRDSync.sync();
  srv.doc = { x: 2 }; srv.at = "ext";
  assert.equal(await b.ctx.NRDSync.sync(), "applied");
  assert.equal(b.sy.d.x, 2);
});
test("déconnecté : aucune synchro", async () => {
  const srv = server(); const b = boot(srv, { x: 1 }, null);
  assert.equal(await b.ctx.NRDSync.sync(), "off");
  assert.equal(srv.doc, null);
});
