/* sanitize.js — filtres pour les données externes ou stockées avant rendu.
 * Script classique (pas de module) : expose globalThis.NTSanitize, utilisé par
 * newtab.js. Testé dans tests/sanitize.test.js.
 */
(function (g) {
  "use strict";
  // Schémas autorisés pour un lien cliquable. Tout le reste (javascript:,
  // data:, vbscript:, file:…) devient "#".
  const SAFE_SCHEMES = /^(https?|mailto|chrome|chrome-extension):/i;
  function safeHref(u) {
    if (u == null) return "#";
    const s = String(u).trim().replace(/[\u0000-\u001F\u007F\s]+/g, "");
    if (!s) return "#";
    if (s === "#" || s.startsWith("/") || s.startsWith("./")) return String(u).trim();
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) return String(u).trim(); // relatif / domaine nu
    return SAFE_SCHEMES.test(s) ? String(u).trim() : "#";
  }
  // Source d'image : http(s), data:image (non SVG) ou chemin local uniquement.
  function safeImgSrc(u) {
    if (u == null) return "";
    const s = String(u).trim();
    if (/^https?:\/\//i.test(s) || /^\/(?!\/)/.test(s)) return s;
    if (/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(s)) return s;
    return "";
  }
  // Couleur CSS injectée dans un attribut style : #hex ou nom simple uniquement.
  function safeColor(c) {
    const s = c == null ? "" : String(c).trim();
    return /^#[0-9a-f]{3,8}$/i.test(s) || /^[a-z]{3,20}$/i.test(s) ? s : "";
  }
  g.NTSanitize = { safeHref, safeImgSrc, safeColor };
})(typeof globalThis !== "undefined" ? globalThis : this);
