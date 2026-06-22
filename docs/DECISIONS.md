# DECISIONS — ADR léger

Format : décision · contexte · choix · conséquences.

---

## ADR-001 — Dépôt de travail
- **Contexte** : le brief cite `~/projets/newtab-extension` (inexistant). Le code réel vit dans `~/workspace/new-tab-ext/` (CT102). La copie CT101 `nouvel-onglet-extension` est un export.
- **Choix** : on travaille dans `~/workspace/new-tab-ext/`, désormais sous git (checkpoint initial).
- **Conséquences** : déploiement/export vers CT101 = étape séparée, hors périmètre du code.

## ADR-002 — Pas de bundler, modules ES natifs
- **Contexte** : projet vanilla JS, aucun bundler, IIFE unique. Le brief impose une couche `storage/` et `providers/` mais interdit de réécrire l'archi de build sans justification (§0.2).
- **Choix** : introduire des **modules ES natifs** (`type="module"`) pour les nouvelles couches (`js/core/`, `js/providers/`). On n'ajoute PAS de bundler (futureproof, zéro dette de toolchain ; MV3 supporte les modules dans la page et le service worker via `"type": "module"`).
- **Conséquences** : migration progressive du monolithe vers des modules ; `newtab.html` chargera `js/newtab.js` en module. Le code legacy reste dans l'IIFE le temps de la migration.

## ADR-003 — Stratégie incrémentale (pas de réécriture)
- **Contexte** : monolithe fonctionnel de 2614 lignes, 12 widgets ; brief §1 interdit la réécriture totale et impose des commits-checkpoints.
- **Choix** : nouveau socle construit à côté, widget Sport branché dessus en premier, migration des autres widgets ensuite. Aucun widget existant cassé pendant la transition.
- **Conséquences** : cohabitation temporaire ancien/nouveau code ; dette transitoire documentée et résorbée widget par widget.

## ADR-004 — Séparation storage : config (sync) vs cache (local)
- **Contexte** : brief §3.1. Actuellement `CFG` met tout dans `sync` (clé `widgetCfg`), pas de TTL, pas de debounce.
- **Choix** : `core/storage.js` expose `getConfig/setConfig` (sync, objet compact unique, debounce ~1 s) et `getCache/setCache` (local, TTL). Données live JAMAIS en sync.
- **Conséquences** : migration douce des clés existantes ; garde-fou taille < 8 KB/item testé.

## ADR-005 — Service worker pour tout le polling
- **Contexte** : brief §3.2. Pas de SW aujourd'hui ; fetch en page + setInterval.
- **Choix** : `js/sw.js` (module) déclaré `background.service_worker` ; `chrome.alarms` pour le polling ; écriture cache ; newtab cache-first + `storage.onChanged`.
- **Conséquences** : ajout permission `alarms` au manifest ; OAuth (`chrome.identity`) reste utilisable depuis le SW.

## ADR-006 — Accent global = orange Claude (révisé par Dorian 2026-06-22)
- **Contexte** : le brief §0.3 imposait indigo unique. Indigo a d'abord été appliqué (v pré-0.1.0) ; après essai en conditions réelles, **Dorian préfère l'orange Claude d'origine** et demande le retour.
- **Choix** : **orange Claude** (préférence du pilote, prime sur le brief). Dark `--accent:#d97757` ; Light `--accent:#c2552f` (coral plus profond pour le contraste sur blanc). `--on-accent` = `#17191a` (dark) / `#fff` (light). L'accent recherche §3.6 reste par moteur (Google gris / Gemini bleu / Claude orange).
- **Écart au brief assumé** : §0.3 (indigo) non suivi, sur décision explicite de Dorian.
- **Conséquences** : surfaces d'accent inchangées (tout via `var(--accent*)`), bascule en une fois.

## ADR-008 — Versioning sémantique de dev + tags git (2026-06-22)
- **Contexte** : Dorian veut un vrai versioning et pouvoir revenir à une version par son numéro.
- **Choix** : **SemVer en phase dev → `0.MINOR.PATCH`**. Baseline = **0.1.0**. `MINOR` = nouvelle fonctionnalité / évolution notable ; `PATCH` = correctif/ajustement. Chaque version est **taguée dans git** (`vX.Y.Z`) → revenir en arrière = `git checkout vX.Y.Z`. `manifest.json` et `package.json` portent le même numéro. Passage en `1.0.0` réservé à la première publication Store.
- **Conséquences** : git conserve l'historique complet (chaque commit = état complet) ; les tags donnent des points de retour nommés. Le `CHANGELOG.md` mappe version → contenu.

## ADR-007 — Clés API providers : proxy serveur (tranché par Dorian 2026-06-22)
- **Contexte** : football-data.org exige un token ; une clé embarquée dans une extension publiée est visible de tous. Brief §3.3/§6.
- **Choix** : **proxy serveur** — on étend le proxy existant `naerod-api` (CT110, déjà utilisé pour Leetify/Faceit) avec les endpoints sport. Les clés restent côté serveur, jamais dans l'extension ni en `sync`.
- **Conséquences** : la couche providers tape les endpoints du proxy, pas les API tierces directement (pour les sources à clé). Les sources sans clé (ESPN, Jolpica, OpenF1, Open-Meteo) peuvent rester en direct. `docs/SETUP.md` documentera la config du proxy. host_permissions : ajouter le domaine du proxy.
