/* Compte ae (Authentik) — connexion OIDC + PKCE via chrome.identity.launchWebAuthFlow.
   Même identité que tout l'écosystème (auth.naerod.com) ; « Continuer avec Google » y est proposé.
   Expose window.NRDAccount. Les jetons ne vivent que dans chrome.storage.local (jamais sync). */
(function () {
  "use strict";
  const ISSUER = "https://auth.naerod.com/application/o/";
  const AUTHORIZE = ISSUER + "authorize/";
  const TOKEN = ISSUER + "token/";
  const USERINFO = ISSUER + "userinfo/";
  const CLIENT_ID = "newtab-ext";
  const SCOPE = "openid profile email offline_access";
  const KEY = "ae_account";
  // Profil central / synchro (naerod-profile). Preprod tant que la prod n'est pas validée.
  const API_BASE = "https://preprod-auth.naerod.com";

  const hasChrome = typeof chrome !== "undefined" && chrome.storage && chrome.identity;
  const store = {
    get: () => new Promise((res) => hasChrome ? chrome.storage.local.get(KEY, (o) => res((o && o[KEY]) || null)) : res(null)),
    set: (v) => new Promise((res) => hasChrome ? chrome.storage.local.set({ [KEY]: v }, res) : res()),
    del: () => new Promise((res) => hasChrome ? chrome.storage.local.remove(KEY, res) : res()),
  };
  const listeners = [];
  function emit(acc) { listeners.forEach((f) => { try { f(acc && acc.user ? acc.user : null); } catch (e) { /* ignore */ } }); }

  const b64url = (buf) => btoa(String.fromCharCode.apply(null, new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const rand = (n) => b64url(crypto.getRandomValues(new Uint8Array(n)));
  async function challenge(verifier) { return b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))); }

  function tokenRequest(params) {
    return fetch(TOKEN, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(Object.assign({ client_id: CLIENT_ID }, params)).toString(),
    }).then((r) => r.json().then((j) => { if (!r.ok || !j.access_token) throw new Error(j.error_description || j.error || ("HTTP " + r.status)); return j; }));
  }
  function pack(j, prev) {
    return {
      access: j.access_token, refresh: j.refresh_token || (prev && prev.refresh) || null,
      exp: Date.now() + (j.expires_in || 3600) * 1000 - 30000, user: prev && prev.user || null,
    };
  }
  function loadUser(access) {
    return fetch(USERINFO, { headers: { Authorization: "Bearer " + access } }).then((r) => {
      if (!r.ok) throw new Error("userinfo " + r.status);
      return r.json();
    }).then((u) => ({ sub: u.sub, username: u.preferred_username || u.sub, name: u.name || u.preferred_username || "", email: u.email || "" }));
  }

  async function login() {
    if (!hasChrome || !chrome.identity.launchWebAuthFlow) throw new Error("no identity");
    const redirect = chrome.identity.getRedirectURL();
    const verifier = rand(48), state = rand(16);
    const url = AUTHORIZE + "?" + new URLSearchParams({
      client_id: CLIENT_ID, response_type: "code", redirect_uri: redirect, scope: SCOPE,
      state, code_challenge: await challenge(verifier), code_challenge_method: "S256",
    });
    const back = await new Promise((res, rej) => chrome.identity.launchWebAuthFlow({ url, interactive: true }, (u) => {
      const err = chrome.runtime.lastError; if (err || !u) return rej(err || new Error("cancelled")); res(u);
    }));
    const q = new URL(back).searchParams;
    if (q.get("error")) throw new Error(q.get("error_description") || q.get("error"));
    if (q.get("state") !== state || !q.get("code")) throw new Error("state mismatch");
    const j = await tokenRequest({ grant_type: "authorization_code", code: q.get("code"), redirect_uri: redirect, code_verifier: verifier });
    const acc = pack(j, null);
    acc.user = await loadUser(acc.access);   // vérifie réellement le jeton avant de dire « connecté »
    await store.set(acc); emit(acc);
    return acc.user;
  }

  /* Jeton d'accès valide (rafraîchi si besoin) ; null si déconnecté / session expirée. */
  async function getAccessToken() {
    const acc = await store.get();
    if (!acc) return null;
    if (Date.now() < acc.exp) return acc.access;
    if (!acc.refresh) { await logout(); return null; }
    try {
      const n = pack(await tokenRequest({ grant_type: "refresh_token", refresh_token: acc.refresh }), acc);
      await store.set(n); return n.access;
    } catch (e) { await logout(); return null; }
  }
  async function getUser() { const acc = await store.get(); return acc && acc.user ? acc.user : null; }
  async function logout() { await store.del(); emit(null); }

  /* Appel authentifié vers l'API ae (profil, synchro). */
  async function api(path, opts) {
    const tok = await getAccessToken();
    if (!tok) throw new Error("not signed in");
    const o = Object.assign({}, opts); o.headers = Object.assign({ Authorization: "Bearer " + tok }, o.headers);
    return fetch(API_BASE + path, o);
  }

  window.NRDAccount = { login, logout, getUser, getAccessToken, api, onChange: (f) => listeners.push(f), API_BASE };
})();
