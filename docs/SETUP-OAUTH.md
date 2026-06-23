# SETUP OAuth Google (Gmail + Agenda) — chrome.identity

## État (2026-06-23)
- ✅ **Agenda (`calendar.readonly`) — RÉSOLU.** Client OAuth de type « Extension Chrome » créé dans le projet `dorianjulien-claude-mcp`, lié à l'ID d'extension `ekpdcllabebccofbdifmeemflbncgiih`. Écran de consentement en **Production**, scope `calendar.readonly` uniquement (scope « sensible », pas « restreint » → pas d'audit payant requis). `manifest.json` mis à jour.
- ⏳ **Gmail (`gmail.readonly`) — EN ATTENTE.** Retiré du client/manifest ci-dessus. Nécessite un **second projet Google Cloud séparé** (voir « Pourquoi deux projets » ci-dessous), gardé en mode **Testing** (gratuit, testeurs ajoutés à la main, max 100) tant que l'audit de sécurité Google (CASA, payant, requis pour les scopes Gmail au-delà du mode test) n'est pas budgété. Voir BACKLOG : Gmail est prévu comme avantage de la version Pro.
- ⚠️ **gcloud ne peut PAS créer de client OAuth** (vérifié — `gcloud alpha iap oauth-clients` est limité à un usage IAP différent et déprécié). Toute création/modification de client OAuth ou d'écran de consentement se fait dans https://console.cloud.google.com (opération console uniquement).

## Pourquoi deux projets Google Cloud distincts
Un projet Google Cloud n'a **qu'un seul écran de consentement OAuth**, avec **un seul statut** (Testing ou Production) qui s'applique à **tous les scopes déclarés** sur cet écran. Impossible d'avoir l'Agenda public (Production) ET Gmail limité à des testeurs (Testing) sur le même écran/projet : dès qu'un scope restreint (Gmail) est déclaré sur un écran en Production, Google le bloque pour tout utilisateur hors testeurs jusqu'à vérification + audit CASA.
→ Solution : projet A (`dorianjulien-claude-mcp`, existant) pour l'Agenda, en Production. Projet B (à créer) pour Gmail, en Testing.

## Données utiles
- ID extension (figé par la `key` du manifest) : `ekpdcllabebccofbdifmeemflbncgiih`
- Redirect URI pour `launchWebAuthFlow` (nécessaire pour Gmail, voir plus bas) : `https://ekpdcllabebccofbdifmeemflbncgiih.chromiumapp.org/`

## Procédure Gmail (à faire — projet B séparé)
1. Créer un **nouveau projet Google Cloud** (ex. `newtab-gmail`).
2. Activer l'API Gmail sur ce nouveau projet.
3. **Écran de consentement OAuth** : type **External**, statut **Testing**, scope `gmail.readonly`, ajouter `dorianjulien26@gmail.com` (+ testeurs futurs) comme utilisateurs de test.
4. **Identifiants → Créer → ID client OAuth** : type **Application Web** (pas Extension Chrome — `launchWebAuthFlow` n'a pas cette contrainte), ajouter l'URI de redirection ci-dessus.
5. Récupérer le `client_id` (pas besoin du secret, flux implicite `response_type=token`).
6. Code : ajouter un second flux d'auth dans `js/newtab.js` (widget Gmail) utilisant `chrome.identity.launchWebAuthFlow` avec ce client_id, distinct du `getToken()` existant (qui reste dédié à l'Agenda via le manifest).

## Amélioration de robustesse (code) — déjà fait (v0.18.0)
- Le bouton « Connecter » vérifie le token par un appel test (`GET https://www.googleapis.com/oauth2/v3/userinfo`) avant d'afficher « Connecté », sinon affiche une erreur.

## Note publication (plus tard)
- `calendar.readonly` (sensible) : vérification Google gratuite recommandée pour retirer l'écran « application non vérifiée » côté utilisateurs externes — pas obligatoire pour fonctionner.
- `gmail.readonly` (restreint) : vérification Google **+ audit de sécurité tiers payant (CASA)**, à renouveler chaque année, obligatoire pour sortir du mode Testing.
