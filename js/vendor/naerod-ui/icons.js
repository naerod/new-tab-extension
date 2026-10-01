/* Adaptation extension : le module partage appelle ensureIconFont() (Google Fonts, distant).
   Ici la police Material Symbols est embarquee localement (fonts/material-symbols-changelog.ttf,
   declaree dans css/changelog.css) — aucun appel reseau. */
export function ensureIconFont() {}
