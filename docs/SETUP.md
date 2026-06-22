# SETUP — développement & secrets

## Dépôt vs dossier chargé dans Chrome
- **Dépôt de travail (source de vérité, git)** : `~/workspace/new-tab-ext/` sur CT102.
- **Dossier chargé par Dorian dans Chrome** : `S:\Dorian\PROJETS\new_tab\nouvel-onglet-extension` (= CT101 `/home/dorian/partage/...`). C'est une **copie déployée**, pas la source.
- **Synchroniser dépôt → dossier S:** : `bash tools/deploy-share.sh` (tar over SSH, ne ship que les fichiers de l'extension). Puis recharger l'extension dans `chrome://extensions` (icône ↻).
- ⚠️ Toujours déployer après modif, sinon Chrome charge l'ancienne version.

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

## Aperçu visuel headless (Claude voit son rendu)
L'extension tourne dans un **Chromium headless** (sous xvfb) sur CT102, chargée comme vraie extension → les `chrome.*` et le service worker fonctionnent. Capture d'écran PNG lue ensuite par Claude.

Pré-requis (déjà installés sur CT102) : `chromium`, `xvfb`, `fonts-liberation`, et `playwright-core` (devDependency).

```
bash tools/shot.sh dark 1        # thème sombre, config sport pré-remplie -> docs/shots/newtab-dark.png
bash tools/shot.sh light 1       # thème clair
# vue plein écran d'un widget (clic) :
xvfb-run -a node tools/shot.mjs --theme=dark --seed=1 --click="#sport" --out=docs/shots/sport-view.png
```
Options `tools/shot.mjs` : `--theme=dark|light`, `--seed=0|1` (pré-remplit football + ligues), `--click=<sélecteur>` (ouvre une vue), `--out=<chemin>`.

Limites : profil Chrome **vierge** (pas de connexion Google → Gmail/Agenda en état vide, pas d'historique ni config synchronisée réelle). Suffisant pour valider mise en page, thèmes, widgets data-driven (sport, météo, bourse, actus). Les PNG (`docs/shots/`) sont régénérables et **non versionnés**.

## Secrets / clés API (ADR-007 — proxy serveur)
- Aucune clé n'est embarquée dans l'extension.
- Les sources à clé (football-data.org) passent par le **proxy `naerod-api`** (CT110, `/opt/apps/naerod-api/server.js`), exposé via `https://naerod.com/api/...`.
- Endpoints sport **déployés** sur le proxy (whitelist stricte, cache 5 min) :
  - `GET /api/football/competitions/{id}/standings`
  - `GET /api/football/competitions/{id}/matches`
  - `GET /api/football/teams/{id}/matches`
  - → le proxy ajoute l'en-tête `X-Auth-Token: <FOOTBALL_DATA_TOKEN>` (variable d'env serveur, jamais committée) et relaie la réponse football-data v4 telle quelle. Sans token : `500 {"error":"FOOTBALL_DATA_TOKEN not configured"}` (route stable, pas de crash).
- **Activer le token** : ajouter `FOOTBALL_DATA_TOKEN=<token>` dans `/opt/apps/naerod-api/.env` (CT110, chmod 600) puis `systemctl restart naerod-api`. Token aussi stocké dans **Bitwarden**. Jamais dans le dépôt ni dans `chrome.storage`.
- Sources sans clé (ESPN, Jolpica/Ergast, OpenF1, Open-Meteo) : appelées en direct depuis le service worker.

## Architecture du polling (service worker)
- `js/sw.js` (module) : `chrome.alarms` (`poll`, 1 min) → rafraîchit le cache des scoreboards des compétitions suivies → `chrome.storage.local` (clés `cache:sport:scoreboard:<code>`).
- Le newtab lit le cache d'abord et réécoute `chrome.storage.onChanged` ; il peut demander un refresh immédiat via `chrome.runtime.sendMessage({type:"refresh"})`.
- Tant qu'aucun sport n'est suivi (`config.follows` vide), le SW est un no-op.
