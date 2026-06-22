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

### À venir
- A2 service worker + alarms, A4 routing mini-SPA, A5 thème clair (WCAG), A7 onboarding générique, A8 at-a-glance, A9 Pro gating ; Phase B (widget Sport — football d'abord).
