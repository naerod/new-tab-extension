# RÉCAP — Extension Nouvel Onglet (chantier V1)

> Dépôt : `~/workspace/new-tab-ext/` (CT102, git). Déploiement vers le dossier chargé
> dans Chrome : `bash tools/deploy-share.sh`. Aperçu headless : `bash tools/shot.sh`.
> 18 versions taguées (`git checkout vX.Y.Z` pour revenir en arrière).

## 1. Ce qu'on a construit

**Socle (Phase A)**
- Couche **storage** (`js/core/storage.js`) : config `chrome.storage.sync` (objet compact, debounce) + cache `local` avec TTL. Tests Node.
- **Service worker** (`js/sw.js`) + `chrome.alarms` : polling cache-first (football, basket, notifications).
- Couche **providers** (`js/providers/`) : types internes + registry (capacités + tier free/pro) + adapters football-data / ESPN / Jolpica / TheSportsDB.
- **Bridge** (`js/app-bridge.js`) : expose `window.NT` (storage + providers) au script legacy `js/newtab.js`.
- **Routing** : vue détaillée en **grande pop-up** (clic dehors / Échap / ×) pour TOUS les widgets (sauf agenda) ; le sport a une vue dédiée riche.
- **Thèmes** sombre + clair, **accent de recherche** par moteur, **onboarding** (avec étape sports), barre **At a Glance** (score live), **Pro gating** (sans paiement).
- **Composant `multiSelect`** façon Discord (recherche + tags + logos) réutilisable (onboarding + réglages).

**Widget Sport (Phase B)**
- **Football** : ligues + **équipes** suivies (recherche), compact §4.2 (équipe + voisins + top/bottom), vue plein écran (résultats / à venir / **classement complet** + forme V/N/D), drapeaux/logos.
- **F1** (Jolpica) : 2 championnats + **séances en heure de Paris**, pilote suivi surligné.
- **Basket** (NBA/WNBA), **Tennis** (ATP/WTA, événements).
- Widget paginé **≤9 pages**, **rotation auto**, ordre **For You / manuel**.
- **Mode par défaut** (rien de suivi) : **affiches du jour** + **actualités sport/esport** (Coupe du monde / France en priorité).
- **Notifications** par entité (cloche, SW diff coup d'envoi / but / résultat).

**Backend** : proxy `naerod-api` (CT110) étendu — endpoints football-data (`/api/football/*`), token **server-side** (Bitwarden + `.env`), whitelist + cache.

**Infra de dev** : tests Node (`npm test`, 27 verts) ; aperçu visuel headless (Chromium+xvfb sur CT102) ; déploiement scripté.

## 2. ⚠️ Bug connu — bouton « Connecter Google »
- Au clic, il affiche **« Connecté » immédiatement** mais **rien ne se passe** (Gmail/Agenda restent vides).
- Cause probable : `chrome.identity.getAuthToken` exige un **client OAuth de type « Extension Chrome »** enregistré avec l'**ID de l'extension** (`ekpdcllabebccofbdifmeemflbncgiih`). Le `client_id` actuel du manifest provient d'un client **web/desktop** → incompatible. De plus l'onboarding affiche « Connecté » de façon optimiste sans vérifier que le token fonctionne.
- APIs déjà activées côté GCP (projet `dorianjulien-claude-mcp`) : **Gmail, Calendar, People** ✅.
- **À faire** : créer le bon client OAuth (voir `docs/SETUP-OAUTH.md`), le mettre dans `manifest.json`, configurer l'écran de consentement (scopes + utilisateur test), et faire vérifier le token au bouton avant d'afficher « Connecté ».

## 3. Améliorations principales par version
- **0.1.0** : socle Phase A (storage, providers, SW, gating) + accent orange Claude + thème clair refait.
- **0.1.1** : thème clair inversé (fond blanc, widgets gris uniformes).
- **0.2.0** : widget Sport (football via ESPN) + routing plein écran.
- **0.3.0** : classements football (football-data via proxy) + forme V/N/D.
- **0.3.1** : vue détaillée en grande **pop-up** (clic dehors/Échap/×).
- **0.4.0 / 0.4.1** : pop-up générique pour **tous les widgets** + widget entièrement cliquable + arrière-plan statique.
- **0.5.0** : **suivi d'équipe** (compact §4.2) + rotation auto + ordre For You/manuel.
- **0.6.0** : **Formule 1** (2 championnats + séances heure Paris).
- **0.7.0** : barre **At a Glance** (score live).
- **0.8.0** : onboarding — **étape Sports**.
- **0.9.0** : **Basket** (NBA/WNBA).
- **0.10.0** : **Notifications** par entité.
- **0.11.0** : **Tennis** (ATP/WTA).
- **0.12.0** : cap 9 pages + cœur V1 complet.
- **0.13.0** : **affiches du jour par défaut** (+ Coupe du monde / Euro).
- **0.14.0** : contenu défaut riche (matchs + actus sport/esport, France priorité) + **drapeaux/logos** dans les matchs + fix croix pop-up.
- **0.15.0** : **fin des cases à cocher** → emojis sports + logos compétitions.
- **0.16.0** : **multiselect façon Discord** (recherche) pour les ligues.
- **0.17.0** : multiselect **généralisé** aux réglages (ligues/équipes/basket/tennis).

## 4. Points à travailler ensuite
**Bloquant / important**
- 🔴 **OAuth Google** (bouton Connecter) — voir §2 + `docs/SETUP-OAUTH.md`. Débloque Gmail + Agenda.

**Données (sources gratuites limitées)**
- Classements **ATP/WTA** + tableau (draw) tennis ; **classements basket** ; **F1 live** (timing OpenF1).

**Fonctionnel / UX**
- **Compétitions spéciales §4.5** : bracket (élimination), habillage événementiel (accents CDM/RG), apparition auto d'un major non suivi + bouton désactiver.
- **Réordonnancement manuel** des suivis (retiré en 0.17.0 au profit du multiselect) — à réintroduire (drag&drop).
- **Passe couleur/images** sur les autres widgets (vignettes d'actus, logos d'entreprises en Bourse, etc.).
- **Polish du thème clair** + passe **WCAG AA** complète.
- Widgets nécessitant une donnée perso sans contenu par défaut : **CS2** (Steam ID), **Sites web** (URLs), **Gmail/Agenda** (OAuth).

**Hors V1 (documenté, ne pas coder sans validation)**
- Widget **Gaming** (refonte cs2/premier, ~15 jeux), widget **e-sport**, **page d'abonnement Pro** (paiement), **i18n EN** complet, **publication Chrome Web Store** (vérif Google des scopes).

## 5. Repères techniques
- Tout le code applicatif legacy : `js/newtab.js` (IIFE). Nouvelles couches : `js/core/`, `js/providers/`, `js/sw.js`, `js/app-bridge.js`.
- Config sport stockée via la couche storage (`config` : `sports`, `follows.{football,basketball,tennis}`, `f1cfg`, `sportCfg`, `notif`).
- Décisions d'archi : `docs/DECISIONS.md` (ADR-001…009). Périmètre : `ROADMAP.md`. Détail versions : `CHANGELOG.md`.
