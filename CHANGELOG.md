# CHANGELOG

Format inspiré de Keep a Changelog + SemVer dev (`0.MINOR.PATCH`, voir ADR-008).
Chaque version est taguée dans git (`git checkout vX.Y.Z` pour y revenir). Dates en heure locale Paris.

## [0.6.0] — 2026-06-22 — Formule 1 dans le widget Sport
- **F1** (Jolpica/Ergast, sans clé) : activable dans ⚙. Compact = prochain GP + **prochaine séance en heure de Paris** + compte à rebours + leader.
- **Vue plein écran F1** : championnat **pilotes** + **constructeurs** (top 12) + **calendrier** (séances EL/Quali/Sprint/Course en heure de Paris).
- **Pilote suivi** optionnel → surligné dans le championnat pilotes.
- Bridge `f1Schedule`/`f1Standings` (cache 6 h). Fix : les suivis football n'apparaissent plus quand le sport football est désactivé.

## [0.5.0] — 2026-06-22 — Suivi d'équipe (§4.2) + rotation + For You
- **Suivre une équipe précise** (en plus des ligues) via réglages ⚙ : choisir une ligue → choisir l'équipe (autocomplétion via football-data, proxy `/competitions/{id}/teams`).
- **Compact §4.2** : pour une équipe suivie, mini-classement (équipe surlignée + voisins + top2/bottom2 : Rang, Club, MJ, DB, Pts) + match pertinent.
- **Vue plein écran par entité** : équipe → derniers résultats / prochains matchs / classement complet (équipe surlignée + forme V/N/D).
- **Rotation auto** des pages (défaut 60 s, configurable, 0 = off) + **ordre auto (For You)** (live > match imminent > résultat récent) **ou manuel** (réordonnable).
- Suivis réordonnables/supprimables ; bridge `footballTeams`/`footballTeamMatches` (cache).

## [0.4.1] — 2026-06-22 — Corrections pop-up widgets
- **Widget entièrement cliquable** : la liste d'exclusion est réduite aux vrais contrôles (`a, button, input, select, textarea`) — fini les « quelques pixels cliquables » / double-clic.
- **Plus de réalignement de l'arrière-plan** : le placeholder reprend la classe de colonne (`col*`) et la hauteur du widget → il réserve exactement sa cellule de grille, invisible ; les autres widgets restent statiques.

## [0.4.0] — 2026-06-22 — Pop-up détaillée pour TOUS les widgets
- **Clic sur n'importe quel widget → grande pop-up** (sauf l'**agenda**, déjà grand, et le **sport** qui garde sa vue dédiée plus riche).
- Mécanisme générique `Detail` : on déplace le **vrai widget** dans la pop-up (données live, réglages ⚙, pagination conservés) puis on le remet en place à la fermeture.
- Pop-up **adaptée au contenu** (hauteur auto, max 90vh puis scroll) — pas de grand vide pour les petits widgets. Fermeture : clic dehors / Échap / ×. Les clics sur éléments interactifs (liens, tuiles, réglages, flèches) gardent leur action normale.

## [0.3.1] — 2026-06-22 — Vue détaillée en grande pop-up
- La vue détaillée d'un widget est maintenant une **grande pop-up** au-dessus de l'accueil assombri (au lieu d'un remplacement plein écran). **Fermeture facile** : clic sur le fond, **Échap**, ou bouton **×**. Décision Dorian, écart assumé au brief §3.4 (ADR-009).

## [0.3.0] — 2026-06-22 — Classements football (football-data via proxy)
### Ajouté
- **Classements complets** dans la vue plein écran Sport : tableau par ligue (Rang, Club + logo, MJ, G, N, P, DB, Pts, **Forme** V/N/D colorée §4.2/4.3), scrollable.
- **Backend** : endpoints proxy `naerod-api` (CT110) `/api/football/competitions/{id}/standings|matches`, `/api/football/teams/{id}/matches` — token football-data **server-side** (jamais embarqué), whitelist + cache 5 min. Token stocké dans Bitwarden + `.env` serveur.
- `app-bridge` : `footballStandings(code)` (proxy → types internes, cache local 10 min).

### Note sécurité
- Le token football-data a fuité une fois dans la session (bug de parsing d'une commande) → **rotation recommandée** (cf. échange). Clé à faible sensibilité (gratuite, lecture seule, 10 req/min).

## [0.2.0] — 2026-06-22 — Widget Sport (football) + routing plein écran
### Ajouté
- **A4 — Router mini-SPA** (`#viewLayer`) : clic sur un widget → vue plein écran (flèche retour, Échap pour fermer), barre de recherche épinglée. Accueil masqué pendant la vue.
- **Phase B — widget Sport** (remplace l'ancien widget F1) :
  - Multi-ligues football via **ESPN (sans clé)**, lecture **cache-first** (rempli par le service worker) avec repli fetch direct.
  - Compact **paginé** (1 ligue/page, flèches) ; par ligue, match le plus pertinent : **en direct > prochain > dernier résultat**.
  - **Vue plein écran** : par ligue, matchs en direct / à venir / résultats récents (classements via football-data à venir).
  - Réglages ⚙ : activer **Football**, **ajouter/retirer/réordonner** les ligues suivies (11 ligues : PL, Liga, Bundesliga, Serie A, Ligue 1, Eredivisie, Primeira, Championship, LDC, Europa, Brasileirão).
  - Config (`sports`, `follows`) écrite via la **couche storage** (sync) → vue par le service worker.
- `js/app-bridge.js` (module) : passerelle exposant `window.NT` (storage, providers) au script classique ; `js/providers/leagues.js` (mapping ligues partagé SW/page).

### Note
- L'ancien **compte à rebours F1** est retiré pour l'instant ; **F1 reviendra comme sport** dans le widget Sport (phase B4, prochaine version), avec les 2 championnats + séances en heure Paris.

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
