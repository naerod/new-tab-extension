# PLAN — Découpage en phases

> Source : `CLAUDE_CODE_BRIEF_newtab.md`. Stratégie : **incrémentale** (brief §1 — pas de réécriture totale, commit à chaque frontière).

## Principe directeur

On NE réécrit PAS le monolithe d'un bloc. On construit le **nouveau socle** (storage / providers / service worker / routing) à côté, on y branche d'abord le **widget Sport**, puis on migre les widgets existants au fil de l'eau. Chaque widget actuel reste fonctionnel pendant la transition.

---

## Phase 0 — Audit (FAIT)
- `docs/AUDIT.md`, `docs/PLAN.md`, `ROADMAP.md`, `CHANGELOG.md`, `docs/DECISIONS.md`.
- `git init` + checkpoint initial.

## Phase A — Architecture commune
Ordre interne (du plus structurant au plus visible) :

- **A1. Couche storage** (`js/core/storage.js`)
  - `getConfig()/setConfig()` → `sync`, objet unique compact, **debounce** des écritures.
  - `getCache(key)/setCache(key,val,ttl)` → `local`, avec TTL.
  - Migration langue `localStorage` → config. Tests sérialisation config < 8 KB.
- **A2. Service worker** (`js/sw.js` + `background.service_worker` au manifest)
  - `chrome.alarms` pour le polling (≥30 s). Fetch providers → `setCache`.
  - Newtab lit le cache d'abord, écoute `chrome.storage.onChanged`, refresh à l'ouverture.
- **A3. Couche providers** (`js/providers/`)
  - Types internes (`Match`, `Team`, `Standing`, `Player`, `Driver`, `Competition`, `Session`).
  - Adapters par source. Registry avec `capabilities` + `tier: free|pro`.
- **A4. Routing mini-SPA** (`js/core/router.js`)
  - Vues : `home` ↔ `sport`/`bourse`/… plein écran. Flèche retour. **Search épinglée en haut partout.**
- **A5. Thèmes** : valider/raffiner le clair (WCAG AA), toggle dans réglages globaux (persisté sync).
- **A6. Accent recherche §3.6** : `--search-accent` recalculé par moteur (Google `#e8eaed` / Gemini `#4285f4` / Claude `#d97757`), focus-ring + bordure. Persisté sync.
- **A7. Onboarding générique** : moteur de steps déclaratifs piloté par config ; multi-select sports + sections dynamiques avec autocomplete API ; re-consultable depuis réglages globaux.
- **A8. "At a Glance" slider** (§3.8) : hero alterné salutation/heure/date ↔ score live d'un match suivi.
- **A9. Tier Pro gating** (§3.9) : feature flags + `requiresPro` sur providers/features. **Pas de paiement.**

## Phase B — Widget Sport (football d'abord)
- **B1. Foot** : adapter football-data.org + ESPN (fallback live ~30-60 s). Entité Équipe : dernier résultat, prochain match, position, forme V-N-D (5 derniers). Classement compact (équipe + voisins + top2/bottom2).
- **B2. Widget compact paginé** (≤9 pages, 1 info/page, flèches + rotation auto 60 s, auto "For You" + manuel drag&drop).
- **B3. Vue plein écran Sport** (fiches façon Google : derniers résultats, prochains matchs, classement complet scroll).
- **B4. Basket** (ESPN), **F1** (Jolpica + OpenF1 live, séances heure Paris, 2 championnats), **Tennis** (TheSportsDB : ranking, prochain match, draw).
- **B5. Compétitions spéciales** (CDM/Euro/CL/EL/RG) : apparition auto + désactivable, habillage événementiel léger, bracket secondaire.
- **B6. Notifications** (cloche par entité, off par défaut, `chrome.notifications`).

## Phases ultérieures (ROADMAP — pas en V1)
- Widget Gaming (refonte cs2/premier), widget e-sport, plus de sports, providers Pro payants + page d'abonnement, i18n EN complet.

---

## Points d'incertitude (à lever)

1. **Accent global indigo (brief §0.3) vs orange Anthropic existant** → question Dorian.
2. **Hébergement des clés API providers** (football-data token) : per-user (settings) vs proxy type naerod-api. Affecte la sécurité d'un build public. À trancher au câblage B1.
3. **Modules ES natifs vs IIFE globaux** pour les nouvelles couches → voir DECISIONS (choix : ES modules natifs).
4. **Live foot réel** : payant chez les providers sérieux ; V1 = polling 30-60 s ESPN (approx.), vrai temps réel = capacité `pro` non vendue.
5. **Testabilité** : impossible de charger l'extension dans Chrome depuis le conteneur → tests manuels délégués à Dorian (procédure dans NOTES/SETUP).
