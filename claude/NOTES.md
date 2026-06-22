# NOTES — new-tab-ext (chantier universalisation V1)

_Mis à jour : 2026-06-21_

## Objectif (goal de session)
Finaliser l'extension Chrome « Nouvel onglet », la rendre **universelle** (utilisable par
n'importe qui, pas seulement Dorian), ajouter un **onboarding**, puis préparer une **V1**
publiable sur le Chrome Web Store.

## Décisions produit (validées par l'utilisateur le 2026-06-21)
1. **Widgets Google (Gmail + Agenda)** : on les GARDE. L'onboarding propose de connecter le
   compte Google. Si l'utilisateur refuse/ignore → widget vide + bouton « Se connecter ».
   ⚠️ Pour la publication : scopes `gmail.readonly` (restricted) + `calendar.readonly` (sensitive)
   → vérification Google requise, sinon plafond 100 users + écran « non vérifiée ». À gérer à la fin.
2. **Homelab** : par défaut → métriques du **PC local** (CPU/RAM via `chrome.system.*`).
   Personnalisable pour pointer vers un serveur distant (URL API + token). Même design.
3. **Publication** : je prépare tout (.zip, fiche, captures, politique de confidentialité),
   l'utilisateur fera l'upload final avec son compte dev. À traiter **tout à la fin**, sur sa demande.

## Plan de travail
### Phase A — Universalisation cœur
- [x] Homelab → PC local par défaut (`chrome.system.cpu`/`memory`), remote configurable. Token via CFG (plus de secret en dur).
- [x] CS2 / Leetify : Steam ID configurable → `leetify?steamid=` (proxy étendu). Plus de fuite de mes stats.
- [x] Faceit : endpoint proxy ouvert (plus de clé) → aucun secret embarqué.
- [x] Statut sites : moniteur d'URL client-side (ping no-cors), zéro backend/clé/permission.
- [x] Retirer `API_KEY` et toutes les valeurs perso/secrets du code livré (hub naerod retiré).
- [ ] Prénom dans la salutation (collecté à l'onboarding) — fait en Phase B.
- [ ] (mineur) Repli météo « Dijon » → repli plus neutre / invite à régler la ville.

### Backend (CT110 /opt/apps/naerod-api/server.js) — déployé 2026-06-21
- `/api/leetify?steamid=<id17>` : accepte un SteamID64, cache par id, défaut = STEAM_ID serveur.
- `/api/faceit?nick=` : clé HOMELAB_KEY retirée (données publiques) → utilisable sans secret.
- `/api/homelab` + `/api/sites` : restent protégés par HOMELAB_KEY (mes données ; build public n'y touche plus).
- Backup serveur : `server.js.bak-*` sur CT110. Copie source : `_backend/server.js` (repo extension).

### Phase B — Onboarding (assistant premier lancement) — FAIT
- [x] Overlay multi-étapes : Bienvenue · Prénom · Ville (météo) · Compte Google · Widgets · Terminé.
- [x] Écrit la config (user.name, weather.place, layout.disabled) puis `location.reload()`.
- [x] Flag `onboarded` dans chrome.storage.local. Relançable via réglages généraux (bouton).
- [x] Prénom dans la salutation (hero) + éditable dans réglages généraux.
- Module `Onboarding` exposé sur `window.Onboarding`. CSS `.ob-*` en fin de newtab.css.
- À TESTER en vrai dans Chrome (impossible depuis le conteneur) : rendu, autocomplete ville,
  bouton Google, sélection widgets, reload, non-réaffichage.

### Phase C — Polish / bugs
- [ ] Revue de tous les widgets, états vides, erreurs réseau, responsive.

### Phase D — i18n FR/EN — décision : FR + EN avec toggle (validé)
- [x] Cœur i18n : `STRINGS{fr,en}`, `t(key,vars)`, `LANG` (localStorage, détection navigator), `applyI18n`, `setLang` (reload), `LOCALE()`.
- [x] HTML statique via `data-i18n` / `-ph` / `-al` (titres cartes, recherche, modales, jours, aria).
- [x] Correctif : suppression du `<b>Dorian</b>` en dur dans la salutation (doublon prénom).
- [x] Salutations, dates/mois/jours (Intl LOCALE()), météo (conditions WMO + jours + ressenti/vent).
- [x] Onboarding 100% i18n. Réglages généraux i18n + **sélecteur de langue FR/EN**.
- [x] États vides + libellés dashboard : CS2, Système, Sites, F1, Gmail, stats.
- [ ] **RESTE** : libellés des panneaux de réglages par widget (raccourcis, IA, agenda, bourse,
      météo, actus, historique, CS2, système, sites, F1, gmail) + petits textes (pager aria,
      gmail FLABEL, agenda « Connecter », stocks « à l'instant »). Tout dans les roues ⚙ (peu visible).
- Toggle langue = `location.reload()`. Langue stockée dans `localStorage.lang`.

### ⚠️ À FAIRE TESTER PAR L'UTILISATEUR (impossible depuis le conteneur)
Charger `new-tab-ext/` dans chrome://extensions (mode dev) → ouvrir un nouvel onglet :
1. L'onboarding s'affiche (1er lancement) — parcourir les 6 étapes, autocomplete ville, bouton Google.
2. Dashboard : météo (PC = Système CPU/RAM/disque), pas d'erreur console.
3. Roue ⚙ en haut à droite → basculer la langue EN ↔ FR (reload), vérifier la traduction.
4. CS2 ⚙ → Steam ID ; Sites ⚙ → ajouter une URL ; vérifier les statuts.

### Phase E — Store prep (avec l'utilisateur, à la fin)
- [ ] manifest version, description EN, captures, politique de confidentialité, .zip, compte dev.

## Notes techniques
- `chrome.system.storage` ne donne PAS l'espace libre → en mode local, le disque affiche la
  capacité totale seulement (pas de %). CPU/RAM ont de vrais %.
- CPU% = delta (total-idle)/total entre deux échantillons `chrome.system.cpu.getInfo`.
- Framework Settings réutilisable : types info/toggle/segmented/select/stepper/text/city/checks/list/button.
- ID extension figé via `key` du manifest : `ekpdcllabebccofbdifmeemflbncgiih`.
