# CHANGELOG

Format inspiré de Keep a Changelog + SemVer dev (`0.MINOR.PATCH`, voir ADR-008).
Chaque version est taguée dans git (`git checkout vX.Y.Z` pour y revenir). Dates en heure locale Paris.

## [0.1.1] — 2026-06-22 — Thème clair inversé
- **Fond de page blanc pur `#ffffff`** (plus de fond crème/grisâtre).
- **Widgets sur une surface unique gris clair** (`#f4f2ee`) légèrement accentuée sur le blanc, avec ombre douce — inversion du fonctionnement précédent.
- **Uniformité** : Raccourcis / IA / Cet ordinateur (cartes `soft`) ont désormais **exactement la même couleur** que les autres widgets.
- Tuiles internes (raccourcis, IA, dossiers) en **blanc** pour ressortir sur les widgets gris.

## [0.1.0] — 2026-06-22 — Socle Phase A + design de base
Première version versionnée/testée. Baseline du chantier V1.

### Architecture (Phase A — socle, testé `npm test`)
- **A1 — couche storage** (`js/core/storage.js`) : `getConfig/setConfig` (sync, objet compact, debounce), `getCache/getCacheStale/setCache` (local, TTL), garde-fou 8 KB, listeners `onConfigChanged/onCacheChanged`.
- **A3 — couche providers** (`js/providers/`) : types internes (Team/Match/Standing/… + `toForm`/`formLabel`/`winnerFromScore`), `registry.js` (capacités + tier free/pro), adapters `football-data.js` (via proxy) et `espn.js` (scoreboard quasi-live keyless).
- **A2 — service worker** (`js/sw.js`, module) : `chrome.alarms` (polling 1 min), refresh cache-first, refresh par message. Manifest : `background.service_worker` + `alarms` + hôte ESPN. No-op tant qu'aucun sport suivi.
- **A9 — gating Pro** (`js/core/entitlements.js`) : tier free/pro (V1 = free, sans paiement).
- Outillage : `package.json` (`npm test`), `tests/` zéro dépendance — **24/24 verts**.

### Design
- **Accent global = orange Claude** (dark `#d97757` / light `#c2552f`) — retour à l'orange après essai indigo (ADR-006).
- **Accent barre de recherche par moteur (§3.6)** : contour + halo suivent le moteur (Google gris / Gemini `#4285f4` / Claude `#d97757`), au repos et au focus, couleurs alignées sur les boutons. Moteur **persisté** (sync).
- **Thème clair refait** : surfaces blanches sur fond crème, ombres douces, contraste renforcé, tuiles IA/dossiers retintées (l'ancien clair « warm paper » était illisible).

### Docs
- Phase 0 : `docs/AUDIT.md`, `docs/PLAN.md`, `docs/DECISIONS.md`, `docs/SETUP.md`, `ROADMAP.md`.
- `tools/deploy-share.sh` : déploiement dépôt CT102 → dossier S: chargé dans Chrome.

### À venir (prochaines versions)
- A4 routing mini-SPA, A7 onboarding générique, A8 at-a-glance ; **Phase B — widget Sport (football d'abord)**.
