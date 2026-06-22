# CHANGELOG

Format inspiré de Keep a Changelog. Dates en heure locale Paris.

## [Non publié]

### Ajouté
- `git init` + checkpoint initial de l'extension (point de rollback).
- Phase 0 — Audit : `docs/AUDIT.md`, `docs/PLAN.md`, `docs/DECISIONS.md`, `ROADMAP.md`, `CHANGELOG.md`.

### Modifié
- **Accent global → indigo** (brief §0.3) : `--accent` dark `#7b83ff` / light `#4f55d6`, `--on-accent` ajouté. L'orange `#d97757` réservé au moteur Claude.
- **Accent barre de recherche par moteur (§3.6)** : `--search-accent` recalculé selon le moteur coché (Google `#e8eaed` / Gemini `#4285f4` / Claude `#d97757`), bordure + halo de focus. Moteur désormais **persisté** (sync, store `search.engine`).

### À venir
- Phase A (storage, service worker, providers, routing, onboarding, at-a-glance, Pro gating), Phase B (widget Sport — football d'abord).
