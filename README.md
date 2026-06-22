# Nouvel onglet — extension Chrome (MV3)

Remplace la page « Nouvel onglet » de Chrome par le tableau de bord issu du design Claude :
horloge + fuseaux, recherche (Google / Gemini / Claude), météo, bourse, agenda Google,
actualités, favoris, historique et raccourcis.

ID d'extension figé : **`ekpdcllabebccofbdifmeemflbncgiih`** (via le champ `key` du manifest —
nécessaire pour l'OAuth Google, voir §3).

---

## 1. Charger l'extension

1. Ouvrir `chrome://extensions`
2. Activer **Mode développeur** (interrupteur en haut à droite)
3. **Charger l'extension non empaquetée** → sélectionner le dossier `new-tab-ext/`
4. Ouvrir un nouvel onglet : le tableau de bord s'affiche.

### Réglage Chrome conseillé
- `chrome://settings/onStartup` → **Ouvrir la page Nouvel onglet** (pour retrouver le dashboard au démarrage).
- La page « Nouvel onglet » est déjà remplacée automatiquement par l'override du manifest.

---

## 2. Sources de données & personnalisation

Chaque carte tombe en panne **indépendamment** : si une source échoue, la carte affiche un repli
discret, jamais d'erreur qui casse la page. Plusieurs cartes sont **configurables** via la roue
crantée (⚙) de leur en-tête.

Chaque carte a une **roue crantée (⚙)** ouvrant un **panneau de réglages** propre, dont les options
s'appliquent **immédiatement** (pas de bouton « Enregistrer ») et sont persistées dans
`chrome.storage.local` (clé `widgetCfg`).

| Carte | Source | Réglages (⚙) |
|---|---|---|
| Horloge / fuseaux / salutation | JS local | **roue globale (⚙ en haut à droite)** : horloge principale (locale ou ville) · fuseaux secondaires par villes |
| Recherche | Google / Gemini / Claude (voir §4) | — |
| **Météo** | Open-Meteo (gratuit, sans clé), **géolocalisée** (repli Dijon) | unité °C/°F · vent km/h·m/s·mph · géoloc ou **ville** (géocodage Open-Meteo) · nb de jours (3–6) |
| **Bourse** | Yahoo Finance (gratuit, sans clé) | **devise** $/€/£/origine (conversion auto) · **période** 1J/7J/30J/1A · réordonner / retirer / ajouter des valeurs |
| **Agenda** | **Google Calendar** (ton compte, OAuth) | **vue mois/semaine** · début de semaine lun/dim · événements « journée entière » · (re)connexion |
| **Actualités** | Google News RSS — « À la une » ou par **thèmes** | centres d'intérêt · nombre d'articles (3–12) |
| **Récemment consultées** | `chrome.history` | nombre (3–12) · afficher l'heure · domaines exclus |
| **Raccourcis** | éditables, stockés dans `chrome.storage.local` | mode édition · libellés · nouvel onglet · tuile « + » |
| **IA rapide** | catalogue de 16 services, logos = favicons | choisir / réordonner les services affichés · nouvel onglet |
| **Gmail** | API Gmail (`gmail.readonly`) | filtre non lus/récents/importants/principaux · nombre (1–8) · changer de compte |
| **Homelab** | `naerod.com/api/homelab` (Proxmox) | métriques CPU/RAM/Disque · rafraîchissement (manuel/15/30/60 s) |
| **CS2 · Premier** | `naerod.com/api/leetify` | afficher les stats Leetify · afficher la section Faceit |
| **Formule 1** | `api.jolpi.ca` (Ergast) | nb de courses (1–3) · afficher circuit · afficher date exacte |
| **Statut sites web** | `naerod.com/api/sites` | réordonner / masquer des sites · afficher le temps de réponse |

> Clic sur l'**Agenda** : un jour → vue jour Google Agenda, un événement → sa fiche, ailleurs → vue mois.
> Clic sur **Statut sites** : une ligne → le site, ailleurs → `hub.naerod.com`.

**Sélecteurs de ville** (météo + horloges) : champ « ville ou code postal » avec **autocomplétion**
(géocodage Open-Meteo). Format `Dijon - 21000` ; les suggestions sont triées France d'abord puis par
population (taper « P » propose Paris, Perpignan… ; mondial possible : Tokyo, New York…).

> **Honnêteté technique.** Google n'expose **aucune API** pour : une météo « de ton compte »,
> un flux Google Actualités personnalisé par compte, ou Google Finance (déprécié depuis ~2012).
> On utilise donc les meilleurs équivalents : Open-Meteo géolocalisé, Google News par thèmes,
> Yahoo Finance pour ta watchlist. **Seul l'Agenda est une vraie connexion à ton compte Google.**

---

## 3. Connecter Google Agenda (OAuth — une seule fois)

L'agenda lit ton Google Calendar via `chrome.identity`. Il faut un **client OAuth « Extension Chrome »**
lié à l'ID de l'extension. La création de ce client **ne se scripte pas en `gcloud`** — c'est l'unique
étape manuelle dans la console GCP.

1. Console GCP → projet **`dorianjulien-claude-mcp`** → *API et services* → **Identifiants**
   👉 https://console.cloud.google.com/apis/credentials?project=dorianjulien-claude-mcp
2. **Créer des identifiants** → **ID client OAuth** → type d'application : **Extension Chrome**
3. Champ **ID de l'application** : coller
   ```
   ekpdcllabebccofbdifmeemflbncgiih
   ```
4. Créer → copier l'**ID client** généré (`xxxxx.apps.googleusercontent.com`)
5. Le coller dans `manifest.json`, champ `oauth2.client_id`, à la place de
   `REMPLACER_PAR_VOTRE_CLIENT_ID.apps.googleusercontent.com`
6. `chrome://extensions` → **Recharger** l'extension.
7. Si l'écran de consentement OAuth est en mode **Test** : ajouter `dorianjulien26@gmail.com`
   comme **utilisateur test** (l'API Calendar est déjà activée sur le projet).
8. Nouvel onglet → carte Agenda → **Connecter** → autoriser l'accès en lecture au calendrier.

Tant que ce client n'est pas configuré, l'agenda affiche simplement la grille du mois (sans events)
avec un bouton « Connecter » — rien ne casse.

---

## 4. Recherche Gemini (note technique)

`?prompt=` / `?q=` ne sont **pas** lus nativement par Gemini. À la soumission, la requête est
stockée (`chrome.storage.local`, durée de vie 60 s, à usage unique) puis `gemini.google.com/app`
s'ouvre ; le content-script `js/gemini-inject.js` injecte le texte dans le champ en simulant les
events natifs (`beforeinput` / `insertText` / `input`) attendus par le framework de Gemini.
Auto-focus, **pas** d'envoi automatique.

> Le manifest demandait `chrome.storage.session` : un content-script ne peut pas y accéder sans
> service worker fixant le niveau d'accès. On utilise donc `storage.local` (effacé après lecture) —
> plus robuste et sans service worker.

---

## 5. Arborescence

```
new-tab-ext/
├── manifest.json          # MV3 — newtab override, permissions, oauth2, key, content_script Gemini
├── newtab.html            # design nettoyé pour la CSP (aucun JS inline, CSS/police externes)
├── README.md
├── css/
│   └── newtab.css         # CSS du design + @font-face → ../fonts (aucune police distante)
├── js/
│   ├── newtab.js          # logique de la page (toutes les cartes)
│   └── gemini-inject.js   # content-script gemini.google.com
├── fonts/                 # Google Sans Code (woff2) embarqués localement
└── icons/                 # 16 / 48 / 128
```

## 6. Contraintes MV3 respectées
- **Aucun JS inline / distant** : tout le JS est dans `js/` ; pas de `onclick`, pas de `onerror=`,
  pas de `<script src>` distant.
- **Police locale** : `Google Sans Code` embarquée en woff2 + `@font-face` (chargement instantané,
  hors-ligne). Aucun lien Google Fonts.
- **CSP par défaut** : seul `script-src 'self'` est imposé ; les styles inline du design sont conservés.
- `host_permissions` couvre : Open-Meteo (+ géocodage), Yahoo Finance, Google News, Google APIs (Calendar/Gmail), Gemini, Jolpica (F1), naerod.com.

---

## 7. Widgets de données ajoutés (CS2 · Homelab · Gmail · F1)

| Widget | Source | Accès |
|---|---|---|
| **CS2 · Premier** | `https://naerod.com/api/leetify` (proxy `naerod-api`, données Leetify) | public, partout |
| **CS2 · Faceit** | `https://naerod.com/api/faceit?k=<token>&nick=<pseudo>` (proxy `naerod-api`) | protégé par token |
| **Homelab** | `https://naerod.com/api/homelab?k=<token>` → Proxmox `cluster/resources` (token PVEAuditor lecture seule, côté serveur) | public **mais protégé par token**, partout |
| **Gmail** | API Gmail (`gmail.readonly`) via `chrome.identity` | ton compte Google |
| **Formule 1** | `api.jolpi.ca` (Ergast) — prochain GP + compte à rebours | public |

### Faceit (widget CS2)
Le pseudo Faceit se saisit dans la roue crantée du widget CS2 ; l'affichage se choisit entre
**Premier / Faceit / Les deux**. Le backend `/api/faceit` récupère les données en deux modes :
- **sans clé** (par défaut) : API web interne de faceit.com → **ELO + niveau** fiables. Les stats
  détaillées (K/D, win %, HS %, matchs) sont **bloquées par le Cloudflare de faceit.com** (403).
- **avec clé officielle** : si `FACEIT_KEY` est défini dans `/opt/apps/naerod-api/.env` (clé gratuite
  depuis <https://developers.faceit.com>), le backend bascule sur l'**API Data officielle**
  (`open.faceit.com`) → **stats complètes et stables**. Déposer la clé dans le `.env` puis
  `systemctl restart naerod-api` — aucune autre modif nécessaire (le code détecte la clé tout seul).

### Endpoint homelab — sécurité
- `/api/homelab` est exposé publiquement (pour fonctionner hors LAN) **mais exige `?k=<token>`** : un scanner internet sans le token reçoit `401`. `/api/leetify` reste ouvert (le site web en dépend, l'ELO n'est pas sensible).
- Le token est un **garde lecture seule de faible sensibilité** (noms de CT + charge CPU/RAM). Il vit :
  - côté serveur dans `/opt/apps/naerod-api/.env` (`HOMELAB_KEY`, CT110, chmod 600) ;
  - côté client dans `js/newtab.js` (inhérent à un appel client-side, comme une clé d'API front) ;
  - copie de référence : `/home/claude/.config/newtab-homelab-key.txt` (CT102, chmod 600).
- Token Proxmox dédié : `root@pam!newtab`, rôle **PVEAuditor** (lecture seule), jamais root-full.
- Routage : `naerod.com/api/` → nginx (`/opt/apps/nginx/nginx.conf`) → `naerod-api` (CT110:3742) via le tunnel Cloudflare existant. Aucun nouveau DNS ni port public.
