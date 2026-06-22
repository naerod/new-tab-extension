# SETUP — développement & secrets

## Charger l'extension dans Chrome (test manuel)
1. `chrome://extensions` → activer le **Mode développeur**.
2. **Charger l'extension non empaquetée** → sélectionner le dossier `new-tab-ext/`.
3. Ouvrir un **nouvel onglet**. Le service worker apparaît dans la fiche de l'extension (lien « service worker » → console du SW).
4. Console : page (DevTools de l'onglet) **et** service worker (lien dédié) — vérifier qu'il n'y a pas d'erreur.

> Impossible de charger l'extension depuis le conteneur CT102 (pas de Chrome). Les couches `storage` et `providers` sont validées par tests Node (`npm test`). Le rendu, le service worker et le routing se valident dans Chrome — **délégué à Dorian**.

## Tests
```
npm test          # node --test tests/*.test.js — couches storage, providers, entitlements
```

## Secrets / clés API (ADR-007 — proxy serveur)
- Aucune clé n'est embarquée dans l'extension.
- Les sources à clé (football-data.org) passent par le **proxy `naerod-api`** (CT110, `/opt/apps/naerod-api/server.js`), exposé via `https://naerod.com/api/...`.
- Endpoints sport à ajouter au proxy (Phase B) :
  - `GET /api/football/competitions/{id}/standings`
  - `GET /api/football/competitions/{id}/matches`
  - `GET /api/football/teams/{id}/matches`
  - → le proxy ajoute l'en-tête `X-Auth-Token: <FOOTBALL_DATA_TOKEN>` (variable d'env serveur, jamais committée) et relaie la réponse football-data v4 telle quelle.
- Le token football-data est stocké côté serveur (`.env` CT110) + **Bitwarden**. Jamais dans le dépôt ni dans `chrome.storage`.
- Sources sans clé (ESPN, Jolpica/Ergast, OpenF1, Open-Meteo) : appelées en direct depuis le service worker.

## Architecture du polling (service worker)
- `js/sw.js` (module) : `chrome.alarms` (`poll`, 1 min) → rafraîchit le cache des scoreboards des compétitions suivies → `chrome.storage.local` (clés `cache:sport:scoreboard:<code>`).
- Le newtab lit le cache d'abord et réécoute `chrome.storage.onChanged` ; il peut demander un refresh immédiat via `chrome.runtime.sendMessage({type:"refresh"})`.
- Tant qu'aucun sport n'est suivi (`config.follows` vide), le SW est un no-op.
