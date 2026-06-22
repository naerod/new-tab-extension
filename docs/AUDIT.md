# AUDIT — Extension Nouvel Onglet (Phase 0)

> Date : 2026-06-22 · Auteur : Claude Code · Source de vérité du périmètre : `CLAUDE_CODE_BRIEF_newtab.md`
> Dépôt réel : `~/workspace/new-tab-ext/` sur CT102 (le brief mentionnait `~/projets/newtab-extension`, inexistant ; la copie CT101 `nouvel-onglet-extension` est un export déployé).

---

## 1. Arborescence (état initial)

```
new-tab-ext/
├── manifest.json          MV3, name "Nouvel onglet", v1.0.0
├── newtab.html            223 lignes — hero + search + bento (12 widgets) + 2 modales
├── css/newtab.css         1158 lignes — :root (dark) + html[data-theme=light] (clair déjà là)
├── js/newtab.js           2614 lignes — UN SEUL IIFE, tout le code applicatif
├── js/gemini-inject.js    99 lignes — content script injecté sur gemini.google.com
├── fonts/                 Google Sans Code (woff2, locales)
├── icons/                 icon16/48/128 + icon.svg
├── README.md
├── claude/NOTES.md        journal de chantier (universalisation V1)
├── _backend/server.js     copie source du proxy naerod-api (déployé sur CT110)
└── _design/               artefacts de design (templates, smoke-test, font_map)
```

## 2. Stack réelle

- **Vanilla JS**, aucun framework. **Aucun bundler** (pas de Vite/esbuild/webpack/rollup). **JS pur**, pas de TypeScript.
- `js/newtab.js` = un unique IIFE `(function(){ ... })()` chargé via `<script src>` classique (PAS `type="module"`).
- Aucune étape de build : les fichiers sources SONT les fichiers livrés. Le `.zip` du Store = le dossier tel quel.
- Conséquence : pour introduire les couches `storage/` et `providers/` du brief, deux options — modules ES natifs (`type="module"`, supporté MV3) ou conserver le pattern IIFE en sous-modules globaux. → voir DECISIONS.

## 3. manifest.json

- `manifest_version: 3`, `chrome_url_overrides.newtab: "newtab.html"`.
- `key` figé → ID extension stable `ekpdcllabebccofbdifmeemflbncgiih`.
- **`permissions`** : history, storage, favicon, identity, geolocation, system.cpu, system.memory, system.storage.
- **`host_permissions`** : news.google.com, open-meteo (api + geocoding), gemini.google.com, query1/2.finance.yahoo.com, googleapis.com, **api.jolpi.ca** (F1), naerod.com.
- `optional_host_permissions` : `https://*/*`, `http://*/*` (demandées à la volée via `ensureHostAccess`).
- `oauth2` : client_id Google + scopes `calendar.readonly` + `gmail.readonly`.
- `content_scripts` : gemini-inject.js sur gemini.google.com.
- **⚠️ Pas de `background.service_worker`.** Aucun service worker déclaré.

## 4. Montage des widgets

Pas de système de composants. Chaque widget = un bloc dans l'IIFE qui :
1. récupère son hôte DOM (`$("#f1")`, `$("#cs2")`…),
2. lit sa config via `CFG.ready(...)` + `CFG.get(widget, key, def)`,
3. `fetch()` direct de sa source, `render()` en `innerHTML`,
4. câble sa roue ⚙ via `Settings.open(title, fields)`.

12 widgets : `shortcuts`, `ia`, `homelab/system`, `weather` (Open-Meteo), `stocks` (Yahoo Finance chart API), `gmail` (OAuth), `recent` (chrome.history), `agenda` (Google Calendar OAuth), `news` (Google News RSS), `cs2` (proxy Leetify), `f1` (Jolpica/Ergast), `sites` (moniteur ping no-cors).

- **cs2/premier** (l.2007) : `fetch` proxy naerod-api `/api/leetify?steamid=` ; ELO Premier + ratings. → deviendra widget **Gaming** (ROADMAP).
- **f1** (l.2395) : `fetch https://api.jolpi.ca/ergast/f1/current.json`, compte à rebours du prochain GP, `setInterval(render, 60000)`. → deviendra widget **Sport** (Phase B).

## 5. Couche stockage actuelle

- `DB` (l.323) : `dbSet/dbGet` au-dessus de `chrome.storage`. `SYNC` = `chrome.storage.sync` (repli local), `LOCAL` = `chrome.storage.local`.
- `CFG` (l.368) : store par widget sous la clé **unique** `widgetCfg` dans `sync`. `get/set(widget, key, val)` → réécrit tout l'objet `widgetCfg` à chaque `set`.
- Réconciliation thème/langue depuis `sync` au chargement (multi-PC déjà amorcé).
- **Écarts vs brief §3.1** :
  - Pas de séparation stricte **config (sync)** vs **cache live (local)**. Les données live ne sont pas cachées (refetch à chaque ouverture, flash possible).
  - Pas de **TTL**, pas de `getCache/setCache`.
  - Pas de **debounce** des écritures sync (chaque `CFG.set` écrit immédiatement → risque de plafond ~1 write/2s).
  - `shortcuts` (icônes/emoji custom) écrits dans `sync` → risque d'approcher 8 KB/item.
  - Langue stockée dans **`localStorage`** (interdit par brief §6 pour la donnée applicative).

## 6. Récupération des données live

- Tout en page (pas de SW). `fetch` direct + `setInterval` (F1). **Conflit brief §3.2** : MV3 SW éphémère, polling à migrer vers `chrome.alarms`.
- Sources : Open-Meteo (météo + geocoding), Yahoo Finance (bourse), Google News RSS (actus), Jolpica/Ergast (F1), proxy naerod-api CT110 (CS2/Leetify), Google APIs (Gmail/Agenda via OAuth `chrome.identity`).

## 7. Système de thème

- Variables CSS dans `:root` (dark) et **`html[data-theme="light"]`** (clair "warm paper" `#f5f3ec`, déjà présent).
- `applyTheme(v)` pose `data-theme` sur `<html>` ; `setTheme(v)` persiste (localStorage + sync).
- **Couleurs en dur quasi absentes** : tout passe par les variables (`--bg`, `--ink*`, `--accent`, `--up`, `--down`…) — conforme brief §0.4.
- **⚠️ Accent global `--accent: #d97757` (orange Anthropic)**, pas indigo (brief §0.3). Décision à trancher (voir questions).
- `--up:#5fd0a0` / `--down:#f07a7a` réservés aux indicateurs — conforme à l'esprit du brief.
- **Accent de recherche §3.6** : `applyEngineAccent()` ajoute `.eng-google/gemini/claude` sur le form, **mais aucune règle CSS associée** → non implémenté visuellement. `--search-accent` n'existe pas.

## 8. Briques du brief ABSENTES (à construire)

| Brief | État |
|---|---|
| §3.2 Service worker + `chrome.alarms` | **Absent** |
| §3.3 Couche providers (types internes, adapters, registry, free/pro) | **Absent** (fetch direct par widget) |
| §3.1 Cache TTL local + debounce sync + config compacte | **Partiel** (DB/CFG existent, pas de TTL/debounce/séparation) |
| §3.4 Routing mini-SPA (vues plein écran, flèche retour, search épinglée) | **Absent** (uniquement la grille home) |
| §3.5 Thème clair | **Déjà là** → à raffiner/valider WCAG AA |
| §3.6 Accent recherche par moteur | **Absent en CSS** (classes posées, pas stylées) |
| §3.7 Onboarding piloté par config (type Discord, sections dynamiques + autocomplete) | **Partiel** : onboarding en dur existe (prénom/ville/google/widgets), pas générique ni multi-select sports |
| §3.8 Barre "At a Glance" slider (score live alterné) | **Absent** (hero statique) |
| §3.9 Tier Pro gating (capabilities, requiresPro) | **Absent** |
| §4 Widget Sport (foot d'abord) | **Absent** (F1 = compte à rebours seul) |

## 9. Risques de régression

1. **Introduction du service worker** : déplacer le fetch en SW peut casser les widgets qui dépendent du contexte page (OAuth `chrome.identity` se gère bien en SW, mais l'ordre cache-first/onChanged doit être respecté).
2. **Refactor storage** : migrer `CFG`/`shortcuts` vers la séparation config/cache sans perdre les configs existantes des testeurs (prévoir migration douce / mêmes clés).
3. **Migration langue localStorage → chrome.storage** : éviter un flash de langue (résolution synchrone actuelle via localStorage).
4. **Routing mini-SPA** : la grille bento et les modales existantes doivent cohabiter avec les nouvelles vues plein écran sans casser focus/clavier.
5. **Changement d'accent (si indigo)** : impact visuel global, beaucoup de surfaces à revérifier (focus-ring, boutons, états actifs, badges).
6. **Monolithe 2614 lignes** : tout vit dans un IIFE ; extraire en modules sans casser les fermetures/`window.*` exposés (`window.Onboarding`).
7. **Quotas sync** : si la config grossit (multi-suivis sport), surveiller 8 KB/item et 100 KB total.

## 10. Conformité aux règles transverses (§0)

- ✅ Variables CSS partout (pas de couleurs en dur).
- ✅ Police Google Sans.
- ⚠️ Accent unique : actuellement orange, brief demande indigo → à trancher.
- ⚠️ Clés API : le proxy naerod-api évite d'embarquer des clés ; à généraliser pour les nouveaux providers (football-data token).
- ⚠️ Pas de `localStorage` pour la donnée applicative : violé pour la langue → à migrer.
