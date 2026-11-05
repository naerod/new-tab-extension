// sender.js — n'accepte les messages runtime que des pages de l'extension
// (pas des content scripts injectés dans des sites tiers comme gemini.google.com).
export function isExtensionPage(sender, extId, extOrigin) {
  if (!sender || sender.id !== extId) return false;
  if (sender.tab && !String(sender.url || "").startsWith(extOrigin)) return false;
  return typeof sender.url !== "string" || sender.url.startsWith(extOrigin);
}
