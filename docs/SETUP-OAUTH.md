# SETUP OAuth Google (Gmail + Agenda) — chrome.identity

## État
- ✅ APIs activées (projet `dorianjulien-claude-mcp`) : Gmail, Calendar, People.
- ❌ **Client OAuth incorrect** : le `manifest.json` utilise un `client_id` de type **web/desktop** (`55984010336-…`). `chrome.identity.getAuthToken` exige un client de type **« Extension Chrome »** lié à l'ID de l'extension. → le bouton « Connecter » échoue silencieusement / affiche un état faux.
- ⚠️ **gcloud ne peut PAS créer de client OAuth** (opération console uniquement). Les étapes ci-dessous se font dans https://console.cloud.google.com (projet `dorianjulien-claude-mcp`).

## Données utiles
- ID extension (figé par la `key` du manifest) : `ekpdcllabebccofbdifmeemflbncgiih`
- Scopes : `https://www.googleapis.com/auth/gmail.readonly`, `https://www.googleapis.com/auth/calendar.readonly`

## Procédure (option recommandée — getAuthToken)
1. **Écran de consentement OAuth** (APIs & Services → OAuth consent screen) :
   - Type **External**, statut **Testing**.
   - Ajouter les 2 scopes ci-dessus.
   - Ajouter **dorianjulien26@gmail.com** comme **utilisateur de test**.
2. **Identifiants** (APIs & Services → Credentials → Create credentials → OAuth client ID) :
   - Type d'application : **Extension Chrome** (ou « Chrome App » selon l'UI).
   - **Application ID** = `ekpdcllabebccofbdifmeemflbncgiih`.
   - Copier le **client_id** généré.
3. Mettre ce client_id dans `manifest.json` → `oauth2.client_id`, puis redéployer (`bash tools/deploy-share.sh`) + recharger l'extension.
4. Tester : bouton « Connecter » → un vrai popup Google doit apparaître ; après consentement, Gmail + Agenda se remplissent.

## Amélioration de robustesse (code)
- Le bouton doit **vérifier le token** par un appel test (ex. `GET https://www.googleapis.com/oauth2/v3/userinfo`) avant d'afficher « Connecté », et afficher une erreur sinon. (Évite le faux « Connecté ».)

## Alternative (launchWebAuthFlow + client Web)
- Réutiliser un client **Web** en ajoutant l'URI de redirection `https://ekpdcllabebccofbdifmeemflbncgiih.chromiumapp.org/` et en passant à `chrome.identity.launchWebAuthFlow` (flux implicite `response_type=token`, pas de secret embarqué). Plus de code, à éviter si l'option getAuthToken est possible.

## Note publication (plus tard)
- Les scopes Gmail (restricted) + Calendar (sensitive) imposent une **vérification Google** pour publier au-delà de 100 utilisateurs / sortir du mode test.
