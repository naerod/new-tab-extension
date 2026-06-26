# CHANGELOG

Format inspiré de Keep a Changelog + SemVer dev (`0.MINOR.PATCH`, voir ADR-008).
Chaque version est taguée dans git (`git checkout vX.Y.Z` pour y revenir). Dates en heure locale Paris.

## [0.18.16] — 2026-06-26 — Glisser-déposer sur les listes réordonnables (`cfg-list`)
- Composant partagé `cfg-list` (Agendas affichés, fuseaux horaires, etc.) : ajout du glisser-déposer (HTML5 drag-and-drop natif) en plus des flèches haut/bas déjà présentes — les deux méthodes coexistent. Poignée visuelle (icône grip) + retour visuel pendant le glisser (opacité réduite sur l'élément déplacé, bordure accentuée sur la cible).
- Le bouton masquer/afficher (œil) est inchangé.

## [0.18.15] — 2026-06-26 — Agenda : ordre de priorité des agendas réordonnable
- Le réglage « Agendas affichés » passe d'un multiselect (sans ordre) à une **liste réordonnable** (flèches haut/bas + œil pour masquer, composant déjà utilisé pour les fuseaux horaires) — persisté via `CFG agenda.calendarOrder`.
- Cet ordre devient déterminant pour la troncature des chips (« +N ») dans la grille mois/semaine et l'ordre d'affichage dans la pop-up de détail jour : les agendas en haut de la liste passent en priorité avant l'heure de l'évènement.
- Fix annexe : le tri par jour était auparavant non déterministe (récupération en parallèle de plusieurs agendas, ordre d'arrivée variable) — désormais trié explicitement (priorité d'agenda → journée entière avant horaire → heure).

## [0.18.14] — 2026-06-26 — Fix décalage de la page à l'ouverture d'une pop-up
- **Cause** : `body.in-view{ overflow:hidden }` (Router/Detail) masque la barre de défilement à l'ouverture d'une pop-up, ce qui élargit la page de la largeur de l'ancienne barre → léger décalage visuel de l'arrière-plan.
- **Fix** : `scrollbar-gutter: stable` sur `html` — réserve toujours la place de la barre, qu'elle soit affichée ou non. Solution standard, CSS pur, sans JS ; safe puisque l'extension cible exclusivement Chrome.

## [0.18.13] — 2026-06-26 — Pop-up jour : bouton « Voir la journée » repensé
- Déplacé du corps de la pop-up vers l'en-tête, sur la même ligne que la date (entre le titre et le ×).
- Devenu une icône seule (flèche de redirection `SVGI.extLink`, nouvelle icône) au lieu d'un bouton texte souligné.
- `Router.open` accepte un 5ᵉ paramètre optionnel `headerHtml` pour ce genre d'action contextuelle dans l'en-tête (réutilisable par d'autres pop-up à l'avenir).

## [0.18.12] — 2026-06-26 — Clic sur une chip d'évènement → détail du jour (plus le lien direct)
- Dans la grille mois/semaine, cliquer sur une chip d'évènement ouvre désormais la pop-up de détail du jour (comme cliquer ailleurs sur la journée), au lieu d'ouvrir directement le lien Google Calendar.
- Le lien direct reste accessible **depuis la pop-up** : cliquer sur l'évènement à l'intérieur du détail du jour redirige vers Google Calendar, comme avant.

## [0.18.11] — 2026-06-26 — Pop-up jour : bouton « Voir la journée » + taille réduite
- Bouton **« Voir la journée sur Google Agenda »** en haut de la pop-up de détail (lien direct vers la vue jour Google Calendar — comportement qu'avait l'ancien clic direct sur un jour, avant la pop-up de détail en v0.18.9).
- `Router.open` accepte un paramètre optionnel de classe CSS pour personnaliser la taille du panneau par appelant ; la pop-up jour utilise un panneau plus compact (560px) que celle du widget Sport (1280px, inchangée).

## [0.18.10] — 2026-06-26 — Agenda : évènements « journée entière » multi-jours
- **Bug** : un évènement journée entière de plusieurs jours (ex. "WE" du samedi au dimanche) n'apparaissait que sur son jour de début — la date de fin (exclusive côté API Google) n'était jamais utilisée.
- **Fix** : l'évènement est désormais répété sur chaque jour de sa plage (samedi ET dimanche pour "WE"). La pop-up de détail (v0.18.9) indique "Toute la journée · plusieurs jours" pour ces évènements.

## [0.18.9] — 2026-06-26 — Agenda : pop-up de détail au clic sur un jour
- Clic sur un jour (vue mois ou semaine) → pop-up listant tous les évènements de cette journée : titre complet, horaire, lieu (icône SVG maison, pas de police externe), invités (avec statut de réponse en tooltip), agenda d'origine. Remplace l'ancien comportement (ouverture directe de la vue jour Google Calendar dans un nouvel onglet).
- Clic sur une chip d'évènement (déjà existant) continue d'ouvrir le lien direct vers l'évènement.
- Nouvelle icône `SVGI.pin` (lieu), dans le même style inline-SVG que les autres icônes du projet.

## [0.18.8] — 2026-06-26 — Agenda : tous les calendriers, pas que le principal
- **Bug** : le widget ne récupérait que `calendars/primary/events`, ignorant les agendas secondaires/partagés (ex. agendas d'événements, agendas partagés par des amis).
- **Fix** : récupération de la liste complète des agendas (`calendarList`), fusion des événements de tous les agendas affichés (couleur de chaque agenda reprise sur les chips, comme dans Google Calendar natif).
- **Nouveau réglage** : "Agendas affichés" (multiselect) dans les réglages du widget Agenda, pour masquer ceux qu'on ne veut pas voir.

## [0.18.7] — 2026-06-26 — Projet Google Cloud dédié pour l'Agenda (`naerod-newtab`)
- **Problème découvert** : le client OAuth de l'Agenda partageait le même écran de consentement Google que mon propre accès Claude/MCP (projet `dorianjulien-claude-mcp`), tous deux affichés sous le nom « Claude MCP » dans les permissions Google de l'utilisateur — impossible de les distinguer ou de révoquer l'un sans l'autre.
- **Fix** : nouveau projet Google Cloud dédié `naerod-newtab` (API Calendar activée), écran de consentement « Naerod's new tab », scope `calendar.readonly`, statut **Production**, nouveau client OAuth « Extension Chrome ». `manifest.json` mis à jour avec ce nouveau `client_id`.
- L'ancien client (dans `dorianjulien-claude-mcp`) reste à supprimer une fois la bascule confirmée en usage réel.

## [0.18.6] — 2026-06-25 — Fix vérification Agenda : 401 à tort sur userinfo
- Diagnostic (logs ajoutés en 0.18.5) : `getAuthToken` fonctionnait déjà correctement (nouveau client OAuth « Extension Chrome » OK), mais la vérification du bouton appelait `oauth2/v3/userinfo`, qui exige les scopes `openid`/`email`/`profile` — absents puisque seul `calendar.readonly` est demandé. Résultat : 401 systématique, bouton bloqué sur « Réessayer » malgré une connexion réussie.
- **Fix** : vérification basée sur `calendar/v3/users/me/calendarList` — l'API réellement couverte par le scope accordé.

## [0.18.5] — 2026-06-24 — Debug : log de l'erreur réelle au clic « Connecter Google »
- Le bouton « Connecter » avalait silencieusement l'erreur retournée par `chrome.identity.getAuthToken` (`chrome.runtime.lastError`). Ajout d'un `console.error` pour voir le vrai message dans les DevTools de la page nouvel onglet (F12 → Console) — nécessaire pour diagnostiquer le « Réessayer » quasi instantané malgré le nouveau client OAuth « Extension Chrome ».

## [0.18.4] — 2026-06-23 — OAuth Agenda corrigé (vrai client « Extension Chrome »)
- **Cause du bug** : le `client_id` du manifest était un client OAuth de type Web/Desktop, incompatible avec `chrome.identity.getAuthToken` qui exige un client de type « Extension Chrome » lié à l'ID de l'extension. Conséquence : le bouton « Connecter Google » de l'onboarding affichait directement « Connecté » sans jamais montrer le vrai popup de consentement Google.
- **Fix** : nouveau client OAuth créé sur la console Google Cloud (type Extension Chrome, Application ID = `ekpdcllabebccofbdifmeemflbncgiih`), écran de consentement passé en Production avec uniquement le scope `calendar.readonly` (vérification Google gratuite — scope « sensible », pas « restreint »).
- **Gmail isolé** : le scope `gmail.readonly` est retiré de ce client/manifest. Le widget Gmail est temporairement déconnecté en attendant un **second projet Google Cloud dédié**, gardé en mode Testing (gratuit) tant que l'audit de sécurité Google (CASA, payant) requis pour les scopes Gmail en production n'est pas budgété. Voir BACKLOG (`[new_tab] Widget Gmail = avantage de la version Pro`).
- **Pourquoi séparer** : un seul écran de consentement OAuth par projet Google Cloud, statut unique (Testing/Production) pour tous les scopes déclarés — impossible d'avoir l'Agenda public ET Gmail limité aux testeurs sur le même client.

## [0.18.3] — 2026-06-23 — Pop-up de réglages agrandie + pilules widgets resserrées
- **Toutes les pop-up de réglages** (`.cfg-card`, communes à chaque widget) : largeur 400px → 520px, hauteur max 560px → 720px.
- **Pilules à cocher** (widgets, métriques…) : espacement vertical entre lignes réduit (8px → 5px), espacement horizontal inchangé.

## [0.18.2] — 2026-06-23 — Onboarding sport évolutif (étape conditionnelle + club/équipe nationale)
- **Étape Sports désormais conditionnelle** : si aucun widget Sport n'est coché à l'étape précédente, l'étape sports est sautée entièrement (avant : toujours affichée, même avec tous les widgets décochés).
- **Profondeur ligue → club/équipe nationale** : après avoir choisi une ou plusieurs compétitions football, un sélecteur permet de choisir un club ou une équipe nationale à suivre dans chacune (réutilise `footballTeams()`, même mécanisme que les réglages). Une équipe nationale est techniquement une équipe au sein d'une compétition comme la Coupe du monde/l'Euro — pas de nouvelle donnée nécessaire.
- **Suivi par joueur** : non inclus — aucune donnée joueur n'existe dans l'app (ni API, ni affichage). Noté en BACKLOG comme fonctionnalité à part.

## [0.18.1] — 2026-06-23 — Onboarding : ville pré-remplie par géolocalisation
- **Étape 3 (ville)** : géolocalisation auto + reverse-geocoding (BigDataCloud, sans clé) recoupé avec Open-Meteo → champ pré-rempli avec la ville détectée. La saisie manuelle reste prioritaire si l'utilisateur tape avant la réponse.

## [0.18.0] — 2026-06-22 — Récap + bouton Google honnête
- **Docs** : `docs/RECAP.md` (bilan complet + versions + points à travailler) et `docs/SETUP-OAUTH.md` (procédure OAuth).
- **Fix bouton « Connecter Google »** : vérifie réellement le token (appel `userinfo`) avant d'afficher « Connecté » ; sinon « Réessayer ». Fin du faux « Connecté ». ⚠️ OAuth fonctionnel nécessite encore un client de type « Extension Chrome » (voir SETUP-OAUTH.md).

## [0.17.0] — 2026-06-22 — Multi-select généralisé (réglages)
- Composant `multiSelect` **sorti au niveau global** + **nouveau type de champ Settings `multiselect`** (réutilisable par tous les widgets).
- **Réglages du widget Sport** : ligues football / basket / tennis et **équipes** passent au multiselect (recherche + tags + logos) au lieu des listes + menus. Logos NBA/WNBA ajoutés.
- Note : le réordonnancement manuel des suivis (ancienne liste) est retiré au profit du multiselect ; le mode « manuel » suit l'ordre d'ajout (réordonnancement UI à réintroduire si besoin).

## [0.16.0] — 2026-06-22 — Multi-select façon Discord (ligues)
- **Onboarding ligues** : remplacé la grille de chips par un **menu déroulant avec recherche** (style Discord) — tags retirables (logo + ×), champ de recherche, liste filtrable avec logos + coche. Composant `multiSelect` réutilisable.
- Titre de section plus **évocateur** (« Quelles ligues de football suivre ? ») mis en avant avec une **vraie ligne** de séparation.

## [0.15.0] — 2026-06-22 — Fini les cases à cocher : emojis + logos
- **Suppression des cases à cocher** dans l'onboarding (les pilules `.on` orange suffisent ; case masquée).
- **Sports en emoji** : ⚽ Football · 🏎️ Formule 1 · 🏀 Basket · 🎾 Tennis (+ basket/tennis désormais proposés à l'onboarding).
- **Compétitions en logo** : chaque ligue affiche son **emblème** (football-data crests), repli ⚽ si indispo.
- Les listes de réglages (`cfg-check`) étaient déjà en pilules sans case → cohérent partout.

## [0.14.0] — 2026-06-22 — Contenu par défaut riche + couleur (sport)
- **Mode défaut « For You »** : les 9 pages se remplissent d'un **mix matchs + actualités sport/esport** (Google News RSS, requêtes foot + esport), **équipe de France en priorité**. Ex. France-Iraq en une + une actu type « Falcons 3-0 Furia (major) ».
- **Couleur / drapeaux / logos** : écussons de club et **drapeaux nationaux** ajoutés dans les lignes de match (compact + vue) — gros gain visuel, notamment Coupe du monde.
- Vue détaillée par défaut : sections matchs par compétition **+ section « Actualités sport & esport »**.
- **Fix** : la **croix ×** de la pop-up ne pivote plus comme une roue crantée (héritait de l'animation `.gear`).

## [0.13.0] — 2026-06-22 — Affiches du jour par défaut (§4.5)
- **Football activé sans aucun suivi → affiches du jour** : le widget montre les matchs du jour des grandes compétitions, **majors en cours en priorité**. La **Coupe du monde** et l'**Euro** sont ajoutés (ESPN `fifa.world` / `uefa.euro`). Ex. « Coupe du monde — France 0–0 Iraq · En direct » sans rien configurer.
- Compact + vue plein écran en mode défaut (live > imminent > récent), triés par pertinence.
- **Fix** : `compactPage` rendait une page vide pour une ligue non « suivie » (clé dérivée de la compétition désormais).
- **Fix** : barre At a Glance — le bandeau live s'alternait mal (`.hero-glance` écrasait `hidden`) → bascule par classe `glance-on`.

## [0.12.0] — 2026-06-22 — Cœur V1 complet
- **Cap à 9 pages** dans le widget compact (§4.1).
- ROADMAP mise à jour : Phase A + Phase B faites ; bornés/différés documentés (tennis rankings/draw, basket standings, bracket §4.5, habillage événementiel, F1 live OpenF1).

## [0.11.0] — 2026-06-22 — Tennis (ATP / WTA, bornée)
- **Tennis** activable dans ⚙ : suivre les circuits **ATP / WTA** (TheSportsDB, clé publique). Compact + vue = événements (live/à venir/récents). **Classements ATP/WTA et tableau (draw) différés** (non dispo en clé gratuite — §4.4 « contenu délégué »).

## [0.10.0] — 2026-06-22 — Notifications par entité (§4.6)
- **Cloche par entité** (ligue / équipe / basket / F1) dans la vue détaillée, **off par défaut**. Permission `notifications` demandée **à l'activation** (optionnelle).
- Le **service worker** diffuse les notifs en comparant l'état des matchs à chaque cycle : **coup d'envoi**, **but** (changement de score), **résultat final**. Le SW poll désormais aussi les ligues des équipes suivies + le basket. (Déclenchement réel vérifiable pendant un match en direct.)

## [0.9.0] — 2026-06-22 — Basket (NBA / WNBA)
- **Basket** activable dans ⚙ : suivre des ligues (NBA, WNBA) via ESPN (sans clé). Compact = match pertinent (live/prochain/dernier), vue plein écran = matchs en direct / à venir / récents par ligue. Classements basket : ultérieurement.

## [0.8.0] — 2026-06-22 — Onboarding : étape Sports (§3.7)
- Nouvelle étape d'onboarding **« Quels sports suis-tu ? »** : multi-select (Football, F1) avec **sections dynamiques** — cocher Football fait apparaître les **ligues à suivre**. Écrit la config sport (sports + ligues) lue par le widget. Suivi d'une équipe précise renvoyé aux réglages.

## [0.7.0] — 2026-06-22 — Barre « At a Glance » (§3.8)
- La barre hero **alterne avec le score d'un match suivi EN DIRECT** (toutes les 8 s) : tag ● DIRECT + minute + score. Hors match live, salutation/heure/date normales.
- Le widget Sport expose le match live courant (`window.__ntHeadline`) ; contrôleur `glance` dans le hero. (Vérifiable pendant un match en direct.)

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
