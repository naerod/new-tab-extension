/* Synchro des réglages via le compte ae (naerod-profile, /api/profile/sync/new-tab).
   Un instantané de chrome.storage.sync (tous les réglages) est poussé après chaque modification
   et récupéré à la connexion / à l'ouverture. Les jetons (chrome.storage.local) n'en font jamais partie.
   Règle : jamais synchronisé sur ce navigateur + document distant existant → le distant gagne ;
   modifications locales non poussées → le local gagne ; sinon on suit le distant. */
(function () {
  "use strict";
  const A = window.NRDAccount;
  const hasChrome = typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync;
  if (!A || !hasChrome) { window.NRDSync = { sync: () => Promise.resolve("off"), start() {}, reset: () => Promise.resolve() }; return; }
  const PATH = "/api/profile/sync/new-tab";
  const META = "ae_sync_meta";                 // { updated_at, dirty } — chrome.storage.local (propre à ce navigateur)
  const local = chrome.storage.local, sync = chrome.storage.sync;
  const p = (area, fn) => new Promise((res) => fn(res));
  const getMeta = () => p(0, (r) => local.get(META, (o) => r((o && o[META]) || null)));
  const setMeta = (m) => p(0, (r) => local.set({ [META]: m }, r));
  const snapshot = () => p(0, (r) => sync.get(null, (o) => r(o || {})));
  let applying = false, timer = null, busy = Promise.resolve();

  async function pull() { const r = await A.api(PATH); if (!r.ok) throw new Error("sync get " + r.status); return r.json(); }
  async function push(data, base) {
    const r = await A.api(PATH, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data, base }) });
    if (r.status === 409) return { conflict: true };
    if (!r.ok) throw new Error("sync put " + r.status);
    return r.json();
  }
  async function apply(data, updatedAt) {
    applying = true;
    await p(0, (r) => sync.clear(r));
    await p(0, (r) => sync.set(data, r));
    await setMeta({ updated_at: updatedAt, dirty: false });
    return "applied";
  }

  /* Réconcilie ce navigateur et le compte. Résout "applied" (page à recharger), "pushed", "same", "off". */
  function run() {
    return A.getUser().then(async (u) => {
      if (!u) return "off";
      const meta = await getMeta();
      const remote = await pull();
      const same = meta && remote.updated_at && meta.updated_at === remote.updated_at;
      if (remote.data && !meta) return apply(remote.data, remote.updated_at);              // 1re synchro ici : le compte gagne
      if (remote.data && !same && !(meta && meta.dirty)) return apply(remote.data, remote.updated_at);
      if (!remote.data || (meta && meta.dirty)) {                                         // rien côté compte, ou local plus récent
        const res = await push(await snapshot(), remote.updated_at);
        if (res.conflict) return run();
        await setMeta({ updated_at: res.updated_at, dirty: false });
        return "pushed";
      }
      return "same";
    });
  }
  const sync_ = () => (busy = busy.catch(() => {}).then(run));

  function schedulePush() {
    clearTimeout(timer);
    timer = setTimeout(() => { A.getUser().then((u) => { if (u) sync_().catch((e) => console.warn("[sync]", e)); }); }, 3000);
  }
  function start() {
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== "sync" || applying) return;
      A.getUser().then((u) => { if (!u) return; getMeta().then((m) => setMeta({ updated_at: m && m.updated_at, dirty: true }).then(schedulePush)); });
    });
    sync_().then((r) => { if (r === "applied") location.reload(); }).catch((e) => console.warn("[sync]", e));
  }
  window.NRDSync = { sync: sync_, start, reset: () => p(0, (r) => local.remove(META, r)) };
  A.onChange((u) => { if (!u) window.NRDSync.reset(); });
})();
