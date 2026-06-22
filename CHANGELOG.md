# CHANGELOG

Format inspiré de Keep a Changelog. Dates en heure locale Paris.

## [Non publié]

### Ajouté
- `git init` + checkpoint initial de l'extension (point de rollback).
- Phase 0 — Audit : `docs/AUDIT.md`, `docs/PLAN.md`, `docs/DECISIONS.md`, `ROADMAP.md`, `CHANGELOG.md`.

### Modifié
- **Accent global → indigo** (brief §0.3) : `--accent` dark `#7b83ff` / light `#4f55d6`, `--on-accent` ajouté. L'orange `#d97757` réservé au moteur Claude.
- **Accent barre de recherche par moteur (§3.6)** : `--search-accent` recalculé selon le moteur coché (Google `#e8eaed` / Gemini `#4285f4` / Claude `#d97757`), bordure + halo de focus. Moteur désormais **persisté** (sync, store `search.engine`).

### Ajouté (socle Phase A)
- **A1 — couche storage** (`js/core/storage.js`) : `getConfig/setConfig` (sync, objet compact, debounce), `getCache/getCacheStale/setCache` (local, TTL), garde-fou 8 KB, listeners `onConfigChanged/onCacheChanged`. Tests Node (mock chrome).
- **A3 — couche providers** (`js/providers/`) : types internes (`types.js` : Team/Match/Standing/… + `toForm`/`formLabel`/`winnerFromScore`), `registry.js` (capacités + tier free/pro, `find`/`pick`), adapters `football-data.js` (via proxy, standings/fixtures/results, liveScores:false) et `espn.js` (scoreboard quasi-live keyless). Tests sur fixtures.
- Outillage de test : `package.json` (`npm test` → `node --test`), `tests/` (zéro dépendance). **21/21 verts.**

- **A2 — service worker** (`js/sw.js`, module) : `chrome.alarms` (polling 1 min), refresh cache-first des scoreboards des compétitions suivies, refresh à la demande par message. Manifest : `background.service_worker` + permission `alarms` + hôte `site.api.espn.com`. No-op tant qu'aucun sport n'est suivi.
- **A9 — gating Pro** (`js/core/entitlements.js`) : tier `free`/`pro` (V1 = free, aucun paiement), `hasFeature`, `providersFor`/`pickProvider` filtrés par tier. Tests inclus.
- `docs/SETUP.md` : chargement Chrome, tests, proxy & secrets (ADR-007), archi polling.

### À venir
- A4 routing mini-SPA, A5 thème clair (passe WCAG), A7 onboarding générique, A8 at-a-glance ; Phase B (widget Sport — football d'abord).
