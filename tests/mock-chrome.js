// Minimal in-memory chrome.storage mock for unit tests.
export function makeChromeMock() {
  const listeners = [];
  function area(name) {
    const store = new Map();
    function fire(changes) { listeners.forEach((l) => l(changes, name)); }
    return {
      _store: store,
      get(keys, cb) {
        const out = {};
        if (keys == null) { for (const [k, v] of store) out[k] = v; }
        else if (Array.isArray(keys)) keys.forEach((k) => { if (store.has(k)) out[k] = store.get(k); });
        else if (typeof keys === "object") for (const k of Object.keys(keys)) out[k] = store.has(k) ? store.get(k) : keys[k];
        else if (store.has(keys)) out[keys] = store.get(keys);
        cb(out);
      },
      set(obj, cb) {
        const changes = {};
        for (const k of Object.keys(obj)) { changes[k] = { oldValue: store.get(k), newValue: obj[k] }; store.set(k, obj[k]); }
        fire(changes); cb && cb();
      },
      remove(keys, cb) {
        const list = Array.isArray(keys) ? keys : [keys];
        const changes = {};
        list.forEach((k) => { changes[k] = { oldValue: store.get(k), newValue: undefined }; store.delete(k); });
        fire(changes); cb && cb();
      },
    };
  }
  return {
    runtime: { lastError: null },
    storage: {
      sync: area("sync"),
      local: area("local"),
      onChanged: {
        addListener: (l) => listeners.push(l),
        removeListener: (l) => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); },
      },
    },
  };
}
