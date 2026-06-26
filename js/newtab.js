/* newtab.js — page logic for the "Nouvel onglet" extension.
 *
 * Ported from the Claude Design export (clock / zones / search / IA / agenda /
 * sparkline helpers kept verbatim) and extended with live data wiring:
 *   - Météo        : Open-Meteo (Dijon)
 *   - Bourse       : Yahoo Finance chart API (no key) + fallback
 *   - Actualités   : Google News RSS
 *   - Récemment    : chrome.history
 *   - Raccourcis   : user-editable, persisted in chrome.storage.local
 *   - Gemini       : query hand-off via chrome.storage.local -> content script
 *
 * Robustness rule: every card runs in its own try/catch. A failed fetch leaves
 * the design's static placeholder in place — never an error that breaks the page.
 */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const hasChrome = typeof chrome !== "undefined";

  /* ============================================================
     I18N — FR / EN. Langue résolue de façon synchrone via localStorage
     (lecture immédiate au chargement, avant tout rendu). Dictionnaire en bas
     du module (const STRINGS). t(key, vars) interpole {var}. Changement de
     langue = location.reload() (toutes les cartes se re-rendent proprement).
     ============================================================ */
  const STRINGS = {
    fr: {
      "title": "Nouvel onglet",
      "lang.label": "Langue", "lang.fr": "Français", "lang.en": "English",
      "theme.label": "Thème", "theme.dark": "Sombre", "theme.light": "Clair",
      // recherche
      "search.ph": "Rechercher sur le web…",
      "aria.search": "Recherche", "aria.engine": "Moteur de recherche", "aria.settings": "Réglages",
      "aria.prevMonth": "Mois précédent", "aria.nextMonth": "Mois suivant", "aria.iconType": "Type d'icône",
      // titres de cartes
      "card.shortcuts": "Raccourcis", "card.weather": "Météo", "card.stocks": "Bourse",
      "card.recent": "Récemment consultées", "card.agenda": "Agenda", "card.news": "Actualités",
      "card.f1": "Formule 1", "card.sport": "Sport", "card.sites": "Sites web",
      // jours (abrégés, lun-dim)
      "wd.mon": "Lun", "wd.tue": "Mar", "wd.wed": "Mer", "wd.thu": "Jeu", "wd.fri": "Ven", "wd.sat": "Sam", "wd.sun": "Dim",
      // commun
      "common.cancel": "Annuler", "common.add": "Ajouter", "common.save": "Enregistrer",
      "common.connect": "Connecter", "common.refresh": "Actualiser", "common.later": "Plus tard",
      // salutations
      "greet.night": "Bonne nuit", "greet.morning": "Bonjour", "greet.afternoon": "Bon après-midi", "greet.evening": "Bonsoir",
      // météo
      "wx.feels": "Ressenti", "wx.wind": "Vent", "wx.now": "maintenant",
      "wmo.clear": "Ensoleillé", "wmo.mclear": "Plutôt clair", "wmo.pcloudy": "Partiellement nuageux", "wmo.overcast": "Couvert",
      "wmo.fog": "Brouillard", "wmo.rfog": "Brouillard givrant", "wmo.ldrizzle": "Bruine légère", "wmo.drizzle": "Bruine",
      "wmo.hdrizzle": "Bruine forte", "wmo.fdrizzle": "Bruine verglaçante", "wmo.lrain": "Pluie faible", "wmo.rain": "Pluie",
      "wmo.hrain": "Pluie forte", "wmo.frain": "Pluie verglaçante", "wmo.lsnow": "Neige faible", "wmo.snow": "Neige",
      "wmo.hsnow": "Neige forte", "wmo.snowgrains": "Grains de neige", "wmo.showers": "Averses", "wmo.hshowers": "Averses fortes",
      "wmo.snowshowers": "Averses de neige", "wmo.thunder": "Orage", "wmo.thunderhail": "Orage, grêle",
      // modales raccourci / bourse
      "modal.sc.title": "Nouveau raccourci", "modal.sc.name": "Nom", "modal.sc.addr": "Adresse",
      "modal.sc.folder": "Dossier", "modal.sc.folderNew": "Nom du nouveau dossier", "modal.sc.folderNewPh": "Travail, Perso…",
      "modal.sc.icon": "Icône", "modal.sc.auto": "Auto", "modal.sc.emoji": "Emoji", "modal.sc.image": "Image",
      "modal.sc.iconUrlPh": "https://…/mon-icone.png",
      "modal.sc.faviconHint": "Par défaut, le logo du site (favicon) est récupéré automatiquement.",
      "modal.sc.edit": "Modifier le raccourci",
      "modal.stk.title": "Ajouter une valeur", "modal.stk.sym": "Symbole Yahoo Finance",
      "modal.stk.name": "Nom affiché (optionnel)",
      "modal.stk.hint": "Le symbole est celui de finance.yahoo.com (ex. AAPL, ^GSPC, ETH-EUR, ESE.PA).",
      // onboarding
      "ob.welcome.title": "Bienvenue",
      "ob.welcome.sub": "Ton nouveau tableau de bord : horloge, météo, agenda, actualités, bourse, raccourcis et plus. Personnalisons-le en quelques secondes.",
      "ob.start": "Commencer", "ob.continue": "Continuer", "ob.back": "Retour",
      "ob.name.title": "Comment t'appelles-tu ?", "ob.name.sub": "Pour personnaliser ta salutation.", "ob.name.ph": "Prénom",
      "ob.city.title": "Où es-tu ?", "ob.city.sub": "Pour la météo locale. Sinon, ta géolocalisation sera utilisée.", "ob.city.ph": "Ville ou code postal", "ob.city.detecting": "Détection en cours…",
      "ob.google.title": "Ton compte Google",
      "ob.google.sub": "Connecte-toi pour afficher ton Agenda Google et tes mails Gmail (lecture seule). Tu peux aussi le faire plus tard.",
      "ob.google.btn": "Connecter Google", "ob.google.connecting": "Connexion…", "ob.google.ok": "✓ Connecté", "ob.google.retry": "Réessayer",
      "ob.widgets.title": "Tes widgets", "ob.widgets.sub": "Active ce que tu veux voir. Modifiable à tout moment via la roue ⚙ en haut à droite.",
      "ob.sports.title": "Quels sports suis-tu ?", "ob.sports.sub": "Coche tes sports — le widget Sport s'adapte. Tu pourras suivre une équipe précise dans les réglages.",
      "ob.sports.leagues": "Quelles ligues de football suivre ?", "ob.sports.leaguesPh": "Rechercher une ligue…",
      "ob.sports.teams": "Des clubs ou équipes nationales en particulier ?", "common.loading": "Chargement…",
      "ob.done.title": "Tout est prêt{name} !",
      "ob.done.sub": "Chaque carte a une roue ⚙ pour la personnaliser : Steam ID pour CS2, tes URL pour les Sites, ta watchlist pour la Bourse…",
      "ob.done.btn": "Lancer mon tableau de bord",
      // réglages généraux
      "card.ia": "IA", "card.system": "Système",
      "set.general": "Réglages généraux", "set.name": "Ton prénom", "set.name.sub": "Affiché dans la salutation.",
      "set.clock.info": "Horloge principale et fuseaux horaires secondaires.",
      "set.clock.local": "Horloge principale : heure locale", "set.clock.city": "Ville de l'horloge principale",
      "set.zones": "Fuseaux secondaires", "set.zones.add": "Ajouter un fuseau",
      "set.widgets.info": "Widgets affichés — décocher pour masquer, la page se réorganise automatiquement.",
      "set.widgets": "Widgets",
      "set.reconfig.info": "Rejoue l'assistant de configuration initial (prénom, ville, compte Google, widgets).",
      "set.reconfig.btn": "Relancer la configuration",
      // états vides / libellés dashboard
      "empty.loading": "Chargement…",
      "empty.cs2.steam": "Renseigne ton Steam ID (⚙).", "empty.cs2.premier": "Stats Premier indisponibles.",
      "empty.cs2.nick": "Renseigne ton pseudo Faceit (⚙).", "empty.cs2.faceitLoading": "Chargement Faceit…",
      "empty.cs2.faceitNA": "Faceit indisponible pour « {n} ».",
      "cs2.elo": "ELO Premier", "cs2.peak": "peak", "cs2.level": "niveau", "cs2.levelShort": "niv.",
      "stat.leetify": "Leetify", "stat.aim": "Visée", "stat.position": "Position", "stat.utility": "Utilité",
      "stat.kd": "K/D", "stat.win": "Win %", "stat.hs": "HS %", "stat.matches": "Matchs",
      "empty.sys.none": "Aucune métrique.", "empty.sys.browser": "Indisponible sur ce navigateur.",
      "empty.sys.url": "Renseigne l'URL de ton serveur (⚙).", "empty.sys.server": "Serveur indisponible.",
      "sys.cpu": "CPU", "sys.ram": "RAM", "sys.disk": "Disque",
      "empty.sites.add": "Ajoute des sites à surveiller (⚙).",
      "empty.f1": "F1 indisponible.", "empty.gmail": "Gmail indisponible.",
      // Widget Sport (Phase B)
      "empty.sport": "Ajoute un sport via ⚙.",
      "sport.football": "Football", "sport.addLeague": "Ajouter une ligue suivie",
      "sport.leagues": "Ligues suivies", "sport.live": "En direct",
      "sport.noMatch": "Aucun match à venir.", "sport.more": "Tous les matchs",
      "sport.today": "Aujourd'hui", "sport.upcoming": "À venir", "sport.recent": "Résultats récents",
      "sport.standings.soon": "Classements bientôt (via football-data).",
      "sport.noToday": "Aucune affiche aujourd'hui.",
      "sport.pick": "Choisir…",
      "sport.follows": "Suivis", "sport.addTeamLeague": "Suivre une équipe — ligue",
      "sport.addTeam": "Équipe à suivre", "sport.rotate": "Rotation auto (s)",
      "sport.rotate.sub": "0 = désactivée", "sport.mode": "Ordre des pages",
      "sport.mode.auto": "Auto (For You)", "sport.mode.manual": "Manuel",
    },
    en: {
      "title": "New tab",
      "lang.label": "Language", "lang.fr": "Français", "lang.en": "English",
      "theme.label": "Theme", "theme.dark": "Dark", "theme.light": "Light",
      "search.ph": "Search the web…",
      "aria.search": "Search", "aria.engine": "Search engine", "aria.settings": "Settings",
      "aria.prevMonth": "Previous month", "aria.nextMonth": "Next month", "aria.iconType": "Icon type",
      "card.shortcuts": "Shortcuts", "card.weather": "Weather", "card.stocks": "Markets",
      "card.recent": "Recently visited", "card.agenda": "Calendar", "card.news": "News",
      "card.f1": "Formula 1", "card.sport": "Sport", "card.sites": "Websites",
      "wd.mon": "Mon", "wd.tue": "Tue", "wd.wed": "Wed", "wd.thu": "Thu", "wd.fri": "Fri", "wd.sat": "Sat", "wd.sun": "Sun",
      "common.cancel": "Cancel", "common.add": "Add", "common.save": "Save",
      "common.connect": "Connect", "common.refresh": "Refresh", "common.later": "Later",
      "greet.night": "Good night", "greet.morning": "Good morning", "greet.afternoon": "Good afternoon", "greet.evening": "Good evening",
      "wx.feels": "Feels like", "wx.wind": "Wind", "wx.now": "now",
      "wmo.clear": "Sunny", "wmo.mclear": "Mostly clear", "wmo.pcloudy": "Partly cloudy", "wmo.overcast": "Overcast",
      "wmo.fog": "Fog", "wmo.rfog": "Freezing fog", "wmo.ldrizzle": "Light drizzle", "wmo.drizzle": "Drizzle",
      "wmo.hdrizzle": "Heavy drizzle", "wmo.fdrizzle": "Freezing drizzle", "wmo.lrain": "Light rain", "wmo.rain": "Rain",
      "wmo.hrain": "Heavy rain", "wmo.frain": "Freezing rain", "wmo.lsnow": "Light snow", "wmo.snow": "Snow",
      "wmo.hsnow": "Heavy snow", "wmo.snowgrains": "Snow grains", "wmo.showers": "Showers", "wmo.hshowers": "Heavy showers",
      "wmo.snowshowers": "Snow showers", "wmo.thunder": "Thunderstorm", "wmo.thunderhail": "Thunderstorm, hail",
      "modal.sc.title": "New shortcut", "modal.sc.name": "Name", "modal.sc.addr": "Address",
      "modal.sc.folder": "Folder", "modal.sc.folderNew": "New folder name", "modal.sc.folderNewPh": "Work, Personal…",
      "modal.sc.icon": "Icon", "modal.sc.auto": "Auto", "modal.sc.emoji": "Emoji", "modal.sc.image": "Image",
      "modal.sc.iconUrlPh": "https://…/my-icon.png",
      "modal.sc.faviconHint": "By default, the site logo (favicon) is fetched automatically.",
      "modal.sc.edit": "Edit shortcut",
      "modal.stk.title": "Add a symbol", "modal.stk.sym": "Yahoo Finance symbol",
      "modal.stk.name": "Display name (optional)",
      "modal.stk.hint": "The symbol is the one on finance.yahoo.com (e.g. AAPL, ^GSPC, ETH-EUR, ESE.PA).",
      "ob.welcome.title": "Welcome",
      "ob.welcome.sub": "Your new dashboard: clock, weather, calendar, news, markets, shortcuts and more. Let's set it up in a few seconds.",
      "ob.start": "Get started", "ob.continue": "Continue", "ob.back": "Back",
      "ob.name.title": "What's your name?", "ob.name.sub": "To personalize your greeting.", "ob.name.ph": "First name",
      "ob.city.title": "Where are you?", "ob.city.sub": "For local weather. Otherwise your geolocation is used.", "ob.city.ph": "City or postal code", "ob.city.detecting": "Detecting…",
      "ob.google.title": "Your Google account",
      "ob.google.sub": "Connect to show your Google Calendar and Gmail messages (read-only). You can also do it later.",
      "ob.google.btn": "Connect Google", "ob.google.connecting": "Connecting…", "ob.google.ok": "✓ Connected", "ob.google.retry": "Try again",
      "ob.widgets.title": "Your widgets", "ob.widgets.sub": "Turn on what you want to see. Change it anytime from the ⚙ gear at the top right.",
      "ob.sports.title": "Which sports do you follow?", "ob.sports.sub": "Tick your sports — the Sport widget adapts. You can follow a specific team in settings.",
      "ob.sports.leagues": "Which football leagues to follow?", "ob.sports.leaguesPh": "Search a league…",
      "ob.sports.teams": "Any specific clubs or national teams?", "common.loading": "Loading…",
      "ob.done.title": "All set{name}!",
      "ob.done.sub": "Every card has a ⚙ gear to personalize it: Steam ID for CS2, your URLs for Websites, your watchlist for Markets…",
      "ob.done.btn": "Open my dashboard",
      "card.ia": "AI", "card.system": "System",
      "set.general": "General settings", "set.name": "Your name", "set.name.sub": "Shown in the greeting.",
      "set.clock.info": "Main clock and secondary time zones.",
      "set.clock.local": "Main clock: local time", "set.clock.city": "Main clock city",
      "set.zones": "Secondary time zones", "set.zones.add": "Add a time zone",
      "set.widgets.info": "Visible widgets — uncheck to hide; the page reflows automatically.",
      "set.widgets": "Widgets",
      "set.reconfig.info": "Replay the initial setup assistant (name, city, Google account, widgets).",
      "set.reconfig.btn": "Run setup again",
      "empty.loading": "Loading…",
      "empty.cs2.steam": "Add your Steam ID (⚙).", "empty.cs2.premier": "Premier stats unavailable.",
      "empty.cs2.nick": "Add your Faceit nickname (⚙).", "empty.cs2.faceitLoading": "Loading Faceit…",
      "empty.cs2.faceitNA": "Faceit unavailable for “{n}”.",
      "cs2.elo": "Premier ELO", "cs2.peak": "peak", "cs2.level": "level", "cs2.levelShort": "lvl",
      "stat.leetify": "Leetify", "stat.aim": "Aim", "stat.position": "Positioning", "stat.utility": "Utility",
      "stat.kd": "K/D", "stat.win": "Win %", "stat.hs": "HS %", "stat.matches": "Matches",
      "empty.sys.none": "No metric.", "empty.sys.browser": "Not available in this browser.",
      "empty.sys.url": "Add your server URL (⚙).", "empty.sys.server": "Server unavailable.",
      "sys.cpu": "CPU", "sys.ram": "RAM", "sys.disk": "Disk",
      "empty.sites.add": "Add sites to monitor (⚙).",
      "empty.f1": "F1 unavailable.", "empty.gmail": "Gmail unavailable.",
      // Sport widget (Phase B)
      "empty.sport": "Add a sport via ⚙.",
      "sport.football": "Football", "sport.addLeague": "Add a followed league",
      "sport.leagues": "Followed leagues", "sport.live": "Live",
      "sport.noMatch": "No upcoming match.", "sport.more": "All matches",
      "sport.today": "Today", "sport.upcoming": "Upcoming", "sport.recent": "Recent results",
      "sport.standings.soon": "Standings coming soon (via football-data).",
      "sport.noToday": "No fixtures today.",
      "sport.pick": "Pick…",
      "sport.follows": "Follows", "sport.addTeamLeague": "Follow a team — league",
      "sport.addTeam": "Team to follow", "sport.rotate": "Auto-rotate (s)",
      "sport.rotate.sub": "0 = off", "sport.mode": "Page order",
      "sport.mode.auto": "Auto (For You)", "sport.mode.manual": "Manual",
    },
  };

  let LANG = "fr";
  try {
    const stored = localStorage.getItem("lang");
    LANG = (stored === "fr" || stored === "en") ? stored
      : ((navigator.language || "fr").toLowerCase().indexOf("fr") === 0 ? "fr" : "en");
    if (!stored) localStorage.setItem("lang", LANG);
  } catch (e) { /* localStorage indispo → fr */ }
  const LOCALE = () => (LANG === "fr" ? "fr-FR" : "en-US");
  function t(key, vars) {
    const table = STRINGS[LANG] || STRINGS.fr;
    let s = (table[key] != null ? table[key] : (STRINGS.fr[key] != null ? STRINGS.fr[key] : key));
    if (vars) Object.keys(vars).forEach((k) => { s = s.split("{" + k + "}").join(vars[k]); });
    return s;
  }
  function applyI18n(root) {
    root = root || document;
    root.querySelectorAll("[data-i18n]").forEach((e) => { e.textContent = t(e.getAttribute("data-i18n")); });
    root.querySelectorAll("[data-i18n-ph]").forEach((e) => { e.setAttribute("placeholder", t(e.getAttribute("data-i18n-ph"))); });
    root.querySelectorAll("[data-i18n-al]").forEach((e) => { e.setAttribute("aria-label", t(e.getAttribute("data-i18n-al"))); });
  }
  function setLang(l) {
    if (l === LANG) return;
    try { localStorage.setItem("lang", l); } catch (e) { /* ignore */ }
    dbSet({ lang: l }, () => location.reload());
  }
  try { document.documentElement.lang = LANG; document.title = t("title"); applyI18n(); } catch (e) { /* DOM pas prêt */ }

  /* THÈME — sombre (défaut) / clair. Appliqué de façon synchrone (localStorage,
     pas de flash) ; mémorisé aussi dans la config synchronisée (multi-appareils). */
  let THEME = "dark";
  try { const s = localStorage.getItem("theme"); THEME = (s === "light" || s === "dark") ? s : "dark"; } catch (e) { /* ignore */ }
  function applyTheme(v) { try { document.documentElement.setAttribute("data-theme", v); } catch (e) { /* ignore */ } }
  applyTheme(THEME);
  function setTheme(v) {
    if (v !== "light" && v !== "dark") v = "dark";
    THEME = v; try { localStorage.setItem("theme", v); } catch (e) { /* ignore */ }
    applyTheme(v); dbSet({ theme: v });
  }

  /* favicon served by Chrome's own cache (needs "favicon" permission) */
  function faviconUrl(pageUrl, size) {
    try {
      return chrome.runtime.getURL(
        "/_favicon/?pageUrl=" + encodeURIComponent(pageUrl) + "&size=" + (size || 32)
      );
    } catch (e) {
      return "";
    }
  }
  function domainOf(u) {
    try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return u; }
  }
  // Site logo for ANY domain (not just visited ones) via Google's favicon service.
  // Loaded as a plain <img> (no host_permission needed); letter fallback on error.
  function siteIcon(url, size) {
    if (!url || url === "#") return "";
    return "https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=" +
      (size || 64) + "&url=" + encodeURIComponent(url);
  }
  function escHtml(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
  // CSP forbids inline onerror=; wire favicon fallbacks (img[data-fb]) after render.
  // Supporte une chaîne de sources via data-next (ex. favicone → service Google → lettre).
  function wireImgFallback(root) {
    root.querySelectorAll("img[data-fb]").forEach((img) => {
      img.addEventListener("error", function onErr() {
        const next = img.getAttribute("data-next");
        if (next) { img.removeAttribute("data-next"); img.src = next; return; }  // l'écouteur reste pour l'erreur suivante
        img.removeEventListener("error", onErr);
        img.replaceWith(document.createTextNode(img.getAttribute("data-fb") || "?"));
      });
    });
  }

  // icônes Google Material Symbols (Apache 2.0, libres) — flèches, croix, œil
  const SVGI = (function () {
    const w = (p) => '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' + p + "</svg>";
    return {
      chevL: w('<path d="M15.41 16.59 10.83 12l4.58-4.59L14 6l-6 6 6 6z"/>'),
      chevR: w('<path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z"/>'),
      chevU: w('<path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/>'),
      chevD: w('<path d="M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z"/>'),
      close: w('<path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>'),
      eye: w('<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zM12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>'),
      eyeOff: w('<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75C21.27 7.61 17 4.5 12 4.5c-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65a3 3 0 0 0 3 3c.22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53a5 5 0 0 1-5-5c0-.79.2-1.53.53-2.2zm4.31-.78 3.15 3.15.02-.16a3 3 0 0 0-3-3l-.17.01z"/>'),
      pin: w('<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/>'),
      extLink: w('<path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3zM5 5v2h6V5H5zm0 4v10h14v-9h-2v7H7V9H5z"/>'),
      grip: w('<circle cx="9" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="18" r="1.5"/>'),
    };
  })();

  /* Géocodage de ville (Open-Meteo) — partagé par tous les sélecteurs de ville.
     Renvoie jusqu'à 6 lieux { name, label, lat, lon, tz, country, pop }, triés
     France d'abord puis par population. Libellé « Dijon - 21000 » (FR) ou « Tokyo - Japon ». */
  function geocodeCity(query) {
    const url = "https://geocoding-api.open-meteo.com/v1/search?count=10&language=fr&name=" + encodeURIComponent(query);
    return fetch(url).then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then((j) => {
      const res = (j && j.results) || [];
      const cleanPostal = (pcs) => { if (!Array.isArray(pcs)) return null; const m = pcs.find((p) => /^\d{5}$/.test(p)); return m || null; };
      const places = res.map((r) => {
        const fr = r.country_code === "FR" || r.country === "France";
        const pc = fr ? cleanPostal(r.postcodes) : null;
        const right = pc || r.country || r.admin1 || "";
        return {
          name: r.name, label: r.name + (right ? " - " + right : ""),
          lat: +(+r.latitude).toFixed(3), lon: +(+r.longitude).toFixed(3),
          tz: r.timezone || "UTC", country: r.country || "", pop: r.population || 0, fr: fr, hasPc: !!pc,
        };
      });
      // tri : France d'abord · entrée avec code postal d'abord · puis population
      places.sort((a, b) => (a.fr !== b.fr) ? (a.fr ? -1 : 1) : (a.hasPc !== b.hasPc) ? (a.hasPc ? -1 : 1) : b.pop - a.pop);
      // dédoublonnage universel : une seule entrée par ville+pays, et jamais deux libellés identiques.
      // clé normalisée (accents/casse/espaces ignorés) → couvre toutes les villes, pas de doublon visible.
      const norm = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
      const seen = new Set(); const seenLabel = new Set(); const out = [];
      for (const p of places) {
        const key = norm(p.name) + "|" + norm(p.country);
        const lkey = norm(p.label);
        if (seen.has(key) || seenLabel.has(lkey)) continue;
        seen.add(key); seenLabel.add(lkey); out.push(p);
      }
      return out.slice(0, 6);
    });
  }

  /* Reverse-géocodage (BigDataCloud, sans clé) → nom de ville depuis lat/lon,
     puis recoupé avec geocodeCity() pour obtenir un objet place au même format
     (coordonnées Open-Meteo, libellé cohérent). Utilisé pour pré-remplir la ville
     détectée par géolocalisation (onboarding). */
  function reverseGeocodeCity(lat, lon) {
    const url = "https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=" + lat + "&longitude=" + lon + "&localityLanguage=fr";
    return fetch(url).then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then((j) => {
      const name = j.city || j.locality || (j.localityInfo && j.localityInfo.administrative && j.localityInfo.administrative.length && j.localityInfo.administrative[j.localityInfo.administrative.length - 1].name);
      if (!name) throw new Error("no city");
      return geocodeCity(name).then((places) => {
        if (!places.length) throw new Error("no match");
        const best = places.find((p) => !j.countryName || p.country === j.countryName) || places[0];
        return best;
      });
    });
  }

  /* OAuth (chrome.identity) — Google access token for Calendar API.
     Returns a Promise<string>; rejects if unavailable / user declines. */
  function getToken(interactive) {
    return new Promise((resolve, reject) => {
      if (!(hasChrome && chrome.identity && chrome.identity.getAuthToken)) return reject(new Error("no identity"));
      chrome.identity.getAuthToken({ interactive: !!interactive }, (t) => {
        const err = chrome.runtime.lastError;
        const tok = typeof t === "string" ? t : t && t.token;
        if (err || !tok) return reject(err || new Error("no token"));
        resolve(tok);
      });
    });
  }
  function dropToken(tok) {
    try { chrome.identity.removeCachedAuthToken({ token: tok }, () => {}); } catch (e) { /* ignore */ }
  }

  /* Demande l'accès à un hôte arbitraire (serveurs distants saisis par l'utilisateur),
     via optional_host_permissions. Résout true si l'origine est (déjà) autorisée. */
  function ensureHostAccess(url) {
    return new Promise((resolve) => {
      try {
        if (!/^https?:\/\//i.test(url)) return resolve(false);
        const origin = new URL(url).origin + "/*";
        if (!(hasChrome && chrome.permissions && chrome.permissions.request)) return resolve(true);
        chrome.permissions.contains({ origins: [origin] }, (has) => {
          if (chrome.runtime.lastError) return resolve(true);
          if (has) return resolve(true);
          chrome.permissions.request({ origins: [origin] }, (granted) => resolve(!!granted));
        });
      } catch (e) { resolve(false); }
    });
  }

  /* ============================================================
     DB — stockage synchronisé multi-appareils (chrome.storage.sync).
     La config suit le compte Google connecté à Chrome (sync activé) — l'app est
     identique sur tous les PC de l'utilisateur, sans compte ni serveur tiers.
     Migration automatique par clé : une valeur encore en local est lue puis
     recopiée vers sync (aucune perte des réglages existants). Repli local si
     sync indisponible (ou quota dépassé).
     ============================================================ */
  const SYNC = (hasChrome && chrome.storage && chrome.storage.sync) ? chrome.storage.sync : (hasChrome && chrome.storage ? chrome.storage.local : null);
  const LOCAL = (hasChrome && chrome.storage) ? chrome.storage.local : null;
  function dbSet(obj, cb) {
    if (!SYNC) { if (cb) cb(); return; }
    try {
      SYNC.set(obj, () => {
        if (chrome.runtime.lastError && LOCAL && LOCAL !== SYNC) { try { LOCAL.set(obj, cb); return; } catch (e) { /* ignore */ } }
        if (cb) cb();
      });
    } catch (e) { if (LOCAL && LOCAL !== SYNC) { try { LOCAL.set(obj, cb); return; } catch (e2) { /* ignore */ } } if (cb) cb(); }
  }
  function dbGet(defaults, cb) {
    const names = Object.keys(defaults);
    if (!SYNC) { cb(Object.assign({}, defaults)); return; }
    const finish = (sr, lr) => {
      const out = {}, toSync = {};
      names.forEach((k) => {
        if (sr && k in sr) out[k] = sr[k];
        else if (lr && k in lr) { out[k] = lr[k]; toSync[k] = lr[k]; }   // migration local -> sync
        else out[k] = defaults[k];
      });
      if (Object.keys(toSync).length) { try { SYNC.set(toSync); } catch (e) { /* ignore */ } }
      cb(out);
    };
    try {
      SYNC.get(names, (sr) => {
        if (chrome.runtime.lastError) sr = null;
        if (LOCAL && LOCAL !== SYNC) LOCAL.get(names, (lr) => finish(sr || {}, lr || {}));
        else finish(sr || {}, {});
      });
    } catch (e) { cb(Object.assign({}, defaults)); }
  }

  /* ============================================================
     CFG — store de configuration par widget (chrome.storage.sync via DB)
     Toutes les options des roues crantées sont persistées sous "widgetCfg".
     ============================================================ */
  const CFG = (function () {
    let data = {}, ready = false; const queue = [];
    if (SYNC) {
      dbGet({ widgetCfg: {} }, (r) => {
        data = (r && r.widgetCfg) || {};
        ready = true; queue.splice(0).forEach((fn) => { try { fn(); } catch (e) { console.warn("[cfg]", e); } });
      });
    } else { ready = true; }
    return {
      ready(fn) { if (ready) fn(); else queue.push(fn); },
      get(widget, key, def) {
        return (data[widget] && data[widget][key] !== undefined) ? data[widget][key] : def;
      },
      set(widget, key, val) {
        (data[widget] = data[widget] || {})[key] = val;
        dbSet({ widgetCfg: data });
      },
    };
  })();

  /* Réconciliation thème/langue depuis la config synchronisée (autre PC de l'utilisateur).
     Le thème s'applique à chaud ; un changement de langue déclenche un reload unique. */
  if (SYNC) {
    dbGet({ theme: null, lang: null }, (r) => {
      if (r.theme && r.theme !== THEME) { try { localStorage.setItem("theme", r.theme); } catch (e) { /* ignore */ } THEME = r.theme; applyTheme(r.theme); }
      if ((r.lang === "fr" || r.lang === "en") && r.lang !== LANG) {
        try { localStorage.setItem("lang", r.lang); } catch (e) { /* ignore */ }
        location.reload();
      }
    });
  }

  /* ============================================================
     SETTINGS — pop-up de réglages générique (un seul shell réutilisé)
     fields: tableau de descripteurs { type, label, sub, value, options, onChange, ... }
     types: info · toggle · segmented · select · stepper · text · checks · list · button
     Toutes les options s'appliquent immédiatement (live), pas de bouton « Enregistrer ».
     ============================================================ */
  const Settings = (function () {
    let modal, titleEl, bodyEl, cardEl;
    function ensure() {
      if (modal) return;
      modal = document.createElement("div");
      modal.className = "modal cfg-modal";
      modal.innerHTML =
        '<div class="modal-card cfg-card">' +
        '  <div class="cfg-head"><h3></h3><button type="button" class="cfg-x" aria-label="Fermer">' + SVGI.close + "</button></div>" +
        '  <div class="cfg-body"></div>' +
        "</div>";
      document.body.appendChild(modal);
      titleEl = modal.querySelector("h3");
      bodyEl = modal.querySelector(".cfg-body");
      cardEl = modal.querySelector(".cfg-card");
      modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
      modal.querySelector(".cfg-x").addEventListener("click", close);
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("open")) close(); });
    }
    function close() { modal && modal.classList.remove("open"); }

    function row(labelHtml, control, col) {
      const div = document.createElement("div");
      div.className = "cfg-field" + (col ? " col" : "");
      if (labelHtml != null) {
        const t = document.createElement("div"); t.className = "cfg-ftext"; t.innerHTML = labelHtml;
        div.appendChild(t);
      }
      if (control) div.appendChild(control);
      return div;
    }
    const lab = (f) => `<div class="cfg-flabel">${escHtml(f.label)}</div>` + (f.sub ? `<div class="cfg-fsub">${escHtml(f.sub)}</div>` : "");

    function build(f) {
      if (f.type === "info") {
        const p = document.createElement("p"); p.className = "cfg-info"; p.textContent = f.text; return p;
      }
      if (f.type === "toggle") {
        const sw = document.createElement("label"); sw.className = "cfg-switch";
        const inp = document.createElement("input"); inp.type = "checkbox"; inp.checked = !!f.value;
        const tr = document.createElement("span"); tr.className = "track";
        sw.appendChild(inp); sw.appendChild(tr);
        inp.addEventListener("change", () => f.onChange(inp.checked));
        return row(lab(f), sw);
      }
      if (f.type === "segmented") {
        const seg = document.createElement("div"); seg.className = "cfg-seg";
        f.options.forEach((o) => {
          const b = document.createElement("button"); b.type = "button"; b.textContent = o.t;
          b.setAttribute("aria-pressed", String(o.v === f.value));
          b.addEventListener("click", () => {
            seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", "false"));
            b.setAttribute("aria-pressed", "true"); f.onChange(o.v);
          });
          seg.appendChild(b);
        });
        return row(lab(f), seg);
      }
      if (f.type === "select") {
        const sel = document.createElement("select"); sel.className = "cfg-select";
        f.options.forEach((o) => { const op = document.createElement("option"); op.value = o.v; op.textContent = o.t; if (o.v === f.value) op.selected = true; sel.appendChild(op); });
        sel.addEventListener("change", () => f.onChange(sel.value));
        return row(lab(f), sel);
      }
      if (f.type === "stepper") {
        const wrap = document.createElement("div"); wrap.className = "cfg-step";
        const dec = document.createElement("button"); dec.type = "button"; dec.textContent = "−";
        const val = document.createElement("span"); val.className = "val tnum"; val.textContent = f.value;
        const inc = document.createElement("button"); inc.type = "button"; inc.textContent = "+";
        let v = f.value;
        const clamp = (x) => Math.max(f.min, Math.min(f.max, x));
        dec.addEventListener("click", () => { v = clamp(v - 1); val.textContent = v; f.onChange(v); });
        inc.addEventListener("click", () => { v = clamp(v + 1); val.textContent = v; f.onChange(v); });
        wrap.appendChild(dec); wrap.appendChild(val); wrap.appendChild(inc);
        return row(lab(f), wrap);
      }
      if (f.type === "text") {
        const inp = document.createElement("input"); inp.type = "text"; inp.value = f.value || ""; if (f.placeholder) inp.placeholder = f.placeholder;
        const commit = () => f.onChange(inp.value.trim());
        inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { commit(); inp.blur(); } });
        inp.addEventListener("blur", commit);
        const r = row(lab(f), null, true); r.appendChild(inp); return r;
      }
      if (f.type === "city") {
        const r = row(lab(f), null, true);
        const inp = document.createElement("input"); inp.type = "text";
        inp.value = f.value || ""; inp.placeholder = f.placeholder || "Ville ou code postal"; inp.setAttribute("autocomplete", "off");
        r.appendChild(inp);
        // dropdown flottant ancré à la carte (hors du flux de .cfg-body → pas de clipping ni de reflow)
        const ac = document.createElement("div"); ac.className = "cfg-ac";
        cardEl.appendChild(ac);
        let timer = null, items = [], active = -1;
        const close = () => { ac.classList.remove("open"); ac.innerHTML = ""; items = []; active = -1; };
        const choose = (p) => { if (!p) return; inp.value = p.label; close(); f.onPick(p); };
        function place() {
          const ir = inp.getBoundingClientRect(), cr = cardEl.getBoundingClientRect();
          ac.style.top = (ir.bottom - cr.top + 5) + "px";
          ac.style.left = (ir.left - cr.left) + "px";
          ac.style.width = ir.width + "px";
        }
        function paintAc(places) {
          items = places; active = -1;
          if (!places.length) { close(); return; }
          ac.innerHTML = places.map((p, i) => `<div class="cfg-ac-item" data-i="${i}">${escHtml(p.label)}</div>`).join("");
          place(); ac.classList.add("open");
          ac.querySelectorAll(".cfg-ac-item").forEach((el) => el.addEventListener("mousedown", (e) => { e.preventDefault(); choose(places[+el.dataset.i]); }));
        }
        inp.addEventListener("input", () => {
          const q = inp.value.trim();
          if (timer) clearTimeout(timer);
          if (q.length < 1) { close(); return; }
          timer = setTimeout(() => { geocodeCity(q).then(paintAc).catch(() => close()); }, 250);
        });
        inp.addEventListener("keydown", (e) => {
          if (!items.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(active + 1, items.length - 1); }
          else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); }
          else if (e.key === "Enter") { e.preventDefault(); choose(items[active >= 0 ? active : 0]); return; }
          else if (e.key === "Escape") { close(); return; }
          else return;
          ac.querySelectorAll(".cfg-ac-item").forEach((el, i) => el.classList.toggle("active", i === active));
        });
        inp.addEventListener("blur", () => setTimeout(close, 150));
        bodyEl.addEventListener("scroll", () => { if (ac.classList.contains("open")) place(); });
        return r;
      }
      if (f.type === "checks") {
        const wrap = document.createElement("div"); wrap.className = "cfg-checks";
        f.options.forEach((o) => {
          const on = f.value.indexOf(o.v) !== -1;
          const l = document.createElement("label"); l.className = "cfg-check" + (on ? " on" : "");
          const c = document.createElement("input"); c.type = "checkbox"; c.checked = on;
          const sp = document.createElement("span"); sp.textContent = o.t;
          l.appendChild(c); l.appendChild(sp);
          c.addEventListener("change", () => { l.classList.toggle("on", c.checked); f.onChange(o.v, c.checked); });
          wrap.appendChild(l);
        });
        const r = row(lab(f), null, true); r.appendChild(wrap); return r;
      }
      if (f.type === "list") {
        const r = row(lab(f), null, true);
        const list = document.createElement("div"); list.className = "cfg-list";
        let dragIndex = null;
        const clearIndicators = () => list.querySelectorAll(".cfg-litem").forEach((el) => el.classList.remove("drag-over-top", "drag-over-bottom"));
        function paint() {
          list.innerHTML = "";
          f.items.forEach((it, i) => {
            if (!it) return;
            const li = document.createElement("div"); li.className = "cfg-litem" + (it.hidden ? " off" : "");
            li.draggable = true;
            li.innerHTML = `<span class="grip" aria-hidden="true">${SVGI.grip}</span>` +
              `<span class="nm">${escHtml(it.label)}${it.sub ? "<small>" + escHtml(it.sub) + "</small>" : ""}</span>` +
              (f.onToggle ? `<button type="button" class="vis" aria-label="Afficher/masquer">${it.hidden ? SVGI.eyeOff : SVGI.eye}</button>` : "") +
              (f.onRemove ? `<button type="button" class="rm" aria-label="Supprimer">${SVGI.close}</button>` : "");
            if (f.onToggle) li.querySelector(".vis").addEventListener("click", () => { f.onToggle(it, i); paint(); });
            if (f.onRemove) li.querySelector(".rm").addEventListener("click", () => { f.onRemove(it, i); f.items.splice(i, 1); paint(); });
            li.addEventListener("dragstart", (e) => { dragIndex = i; e.dataTransfer.effectAllowed = "move"; li.classList.add("dragging"); });
            li.addEventListener("dragend", () => { clearIndicators(); li.classList.remove("dragging"); dragIndex = null; });
            li.addEventListener("dragover", (e) => {
              e.preventDefault();
              if (dragIndex === null || dragIndex === i) return;
              clearIndicators();
              const before = (e.clientY - li.getBoundingClientRect().top) < li.offsetHeight / 2;
              li.classList.add(before ? "drag-over-top" : "drag-over-bottom");
            });
            li.addEventListener("drop", (e) => {
              e.preventDefault();
              clearIndicators();
              if (dragIndex === null || dragIndex === i) return;
              const before = (e.clientY - li.getBoundingClientRect().top) < li.offsetHeight / 2;
              let to = before ? i : i + 1;
              if (dragIndex < to) to -= 1;   // l'élément retiré décale les index suivants
              if (to === dragIndex) return;
              const x = f.items.splice(dragIndex, 1)[0]; f.items.splice(to, 0, x); f.move(dragIndex, to); paint();
            });
            list.appendChild(li);
          });
        }
        paint(); r.appendChild(list);
        if (f.addLabel && f.onAdd) {
          const add = document.createElement("button"); add.type = "button"; add.className = "btn cfg-add"; add.textContent = f.addLabel;
          add.addEventListener("click", () => f.onAdd());
          r.appendChild(add);
        }
        return r;
      }
      if (f.type === "multiselect") {
        const r = row(lab(f), null, true);
        r.appendChild(multiSelect({ items: f.items, isSelected: f.isSelected, onToggle: f.onToggle, placeholder: f.placeholder }));
        return r;
      }
      if (f.type === "button") {
        const b = document.createElement("button"); b.type = "button"; b.className = "btn" + (f.primary ? " primary" : "");
        b.textContent = f.label; b.addEventListener("click", () => f.onClick());
        const r = row(null, null, true); r.appendChild(b); return r;
      }
      return null;
    }

    function open(title, fields) {
      ensure();
      cardEl.querySelectorAll(".cfg-ac").forEach((e) => e.remove());   // purge des dropdowns du panneau précédent
      titleEl.textContent = title;
      bodyEl.innerHTML = "";
      fields.filter(Boolean).forEach((f) => { const el = build(f); if (el) bodyEl.appendChild(el); });
      modal.classList.add("open");
    }
    return { open, close };
  })();

  /* ============================================================
     LAYOUT — activer/désactiver des widgets ; la grille bento se réorganise
     (display:none → le grid auto-flow réordonne en gardant l'ordre source).
     ============================================================ */
  const Layout = (function () {
    // ordre = priorité actuelle de la page (source order)
    const WIDGETS = [
      { k: "shortcuts", t: "Raccourcis", sel: "#shortcuts" },
      { k: "ia", t: "IA", sel: "#aiMini" },
      { k: "homelab", t: "Système", sel: "#homelabCard" },
      { k: "weather", t: "Météo", sel: "#wxDays" },
      { k: "stocks", t: "Bourse", sel: "#stocks" },
      { k: "gmail", t: "Gmail", sel: "#gmailCard" },
      { k: "recent", t: "Récemment", sel: "#recent" },
      { k: "agenda", t: "Agenda", sel: "#agendaCard" },
      { k: "news", t: "Actualités", sel: "#news" },
      { k: "cs2", t: "CS2", sel: "#cs2Card" },
      { k: "sport", t: "Sport", sel: "#sportCard" },
      { k: "sites", t: "Sites web", sel: "#sitesCard" },
    ];
    const disabled = () => CFG.get("layout", "disabled", []) || [];
    const cardOf = (w) => { const el = $(w.sel); return el ? el.closest(".card") : null; };
    function isOn(k) { return disabled().indexOf(k) === -1; }
    function apply() {
      const d = disabled();
      WIDGETS.forEach((w) => { const c = cardOf(w); if (c) c.classList.toggle("widget-off", d.indexOf(w.k) !== -1); });
    }
    function setOn(k, on) {
      let d = disabled().slice();
      if (on) d = d.filter((x) => x !== k); else if (d.indexOf(k) === -1) d.push(k);
      CFG.set("layout", "disabled", d); apply();
    }
    return { WIDGETS, isOn, setOn, apply };
  })();
  CFG.ready(() => Layout.apply());

  /* ============================================================
     PAGER — pagination par tranches avec flèches (‹ ›) + slide animé.
     Page = sous-ensemble de la liste du widget. Flèche grisée en bout de course.
     opts: { pageSize (nombre|fn), renderSlice(slice,pageIdx)->html, afterRender?(pageEl,slice,pageIdx) }
     ============================================================ */
  function makePager(card, host, opts) {
    const head = card && card.querySelector(".head-right");
    const nav = document.createElement("span");
    nav.className = "pager";
    nav.innerHTML = '<button type="button" class="pg-arrow pg-prev" aria-label="Précédent">' + SVGI.chevL + "</button>"
      + '<span class="pg-ind tnum"></span>'
      + '<button type="button" class="pg-arrow pg-next" aria-label="Suivant">' + SVGI.chevR + "</button>";
    if (head) head.insertBefore(nav, head.firstChild);
    const prevB = nav.querySelector(".pg-prev"), nextB = nav.querySelector(".pg-next"), ind = nav.querySelector(".pg-ind");
    host.classList.add("pg-viewport");
    const track = document.createElement("div"); track.className = "pg-track";
    host.appendChild(track);
    let items = [], page = 0;
    const ps = () => Math.max(1, typeof opts.pageSize === "function" ? opts.pageSize() : opts.pageSize);
    const npages = () => Math.max(1, Math.ceil(items.length / ps()));
    function update() {
      const n = npages();
      track.style.transform = "translateX(-" + (page * (100 / n)) + "%)";
      prevB.disabled = page <= 0; nextB.disabled = page >= n - 1;
      ind.textContent = (page + 1) + "/" + n;
    }
    function build() {
      const n = npages(), size = ps();
      if (page > n - 1) page = n - 1; if (page < 0) page = 0;
      track.style.width = (n * 100) + "%"; track.innerHTML = "";
      for (let p = 0; p < n; p++) {
        const slice = items.slice(p * size, (p + 1) * size);
        const pg = document.createElement("div"); pg.className = "pg-page"; pg.style.width = (100 / n) + "%";
        pg.innerHTML = opts.renderSlice(slice, p);
        track.appendChild(pg);
        if (opts.afterRender) opts.afterRender(pg, slice, p);
      }
      nav.style.display = n > 1 ? "" : "none";
      update();
    }
    prevB.addEventListener("click", () => { if (page > 0) { page--; update(); } });
    nextB.addEventListener("click", () => { if (page < npages() - 1) { page++; update(); } });
    return {
      set(arr) { items = arr || []; build(); },
      message(html) { items = []; track.style.width = "100%"; track.innerHTML = '<div class="pg-page" style="width:100%">' + html + "</div>"; nav.style.display = "none"; },
      next() { const n = npages(); if (n <= 1) return; page = (page + 1) % n; update(); },   // wraps (auto-rotation)
      count() { return npages(); },
      page() { return page; },
    };
  }

  /* ============================================================
     MULTISELECT — composant réutilisable façon Discord (tags retirables +
     menu déroulant avec recherche + logos). Utilisé par l'onboarding ET les
     réglages des widgets. opts: { items:[{value,label,logo,emoji}], isSelected(v),
     onToggle(v), placeholder }.
     ============================================================ */
  const MS_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  function multiSelect(opts) {
    const mk = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
    const icon = (it) => {
      const ic = mk("span", "ms-ic");
      if (it.logo) { const img = mk("img"); img.src = it.logo; img.alt = ""; img.addEventListener("error", () => { ic.textContent = it.emoji || "•"; }); ic.appendChild(img); }
      else ic.textContent = it.emoji || "•";
      return ic;
    };
    const root = mk("div", "ms"), field = mk("div", "ms-field"), tags = mk("div", "ms-tags");
    const input = mk("input", "ms-input"); input.type = "text"; input.placeholder = opts.placeholder || (LANG === "fr" ? "Rechercher…" : "Search…");
    const caret = mk("span", "ms-caret", SVGI.chevD);
    field.appendChild(tags); field.appendChild(input); field.appendChild(caret);
    const menu = mk("div", "ms-menu");
    root.appendChild(field); root.appendChild(menu);
    const setOpen = (v) => { root.classList.toggle("open", v); if (v) paintMenu(input.value); };
    function paintTags() {
      tags.innerHTML = "";
      opts.items.filter((it) => opts.isSelected(it.value)).forEach((it) => {
        const tg = mk("span", "ms-tag"); tg.appendChild(icon(it)); tg.appendChild(mk("span", "ms-tag-l", escHtml(it.label)));
        const x = mk("button", "ms-x"); x.type = "button"; x.innerHTML = SVGI.close;
        x.addEventListener("click", (e) => { e.stopPropagation(); opts.onToggle(it.value); paintTags(); paintMenu(input.value); });
        tg.appendChild(x); tags.appendChild(tg);
      });
    }
    function paintMenu(q) {
      const f = (q || "").trim().toLowerCase();
      const list = opts.items.filter((it) => !f || it.label.toLowerCase().indexOf(f) !== -1);
      menu.innerHTML = "";
      if (!list.length) { menu.appendChild(mk("div", "ms-empty", LANG === "fr" ? "Aucun résultat" : "No result")); return; }
      list.forEach((it) => {
        const on = opts.isSelected(it.value);
        const o = mk("div", "ms-opt" + (on ? " on" : "")); o.appendChild(icon(it)); o.appendChild(mk("span", "ms-opt-l", escHtml(it.label)));
        o.appendChild(mk("span", "ms-check", on ? MS_CHECK : ""));
        o.addEventListener("mousedown", (e) => { e.preventDefault(); opts.onToggle(it.value); paintTags(); paintMenu(input.value); });
        menu.appendChild(o);
      });
    }
    field.addEventListener("click", () => { input.focus(); setOpen(true); });
    input.addEventListener("input", () => { setOpen(true); paintMenu(input.value); });
    input.addEventListener("focus", () => setOpen(true));
    document.addEventListener("click", (e) => { if (!root.contains(e.target)) setOpen(false); });
    paintTags();
    return root;
  }

  /* ============================================================
     HERO — horloge principale + salutation + date + fuseaux secondaires
     Tout est configurable via la roue crantée globale (#pageGear).
     ============================================================ */
  CFG.ready(function hero() {
    const greetEl = $("#greet"), hmEl = $("#hm"), secEl = $("#sec"), dateEl = $("#date"), zonesEl = $("#zones");
    const pad = (n) => String(n).padStart(2, "0");
    const greetingFor = (h) => t(h < 5 ? "greet.night" : h < 12 ? "greet.morning" : h < 18 ? "greet.afternoon" : "greet.evening");
    const DEFAULT_ZONES = [
      { label: "Paris", tz: "Europe/Paris" },
      { label: "New York", tz: "America/New_York" },
      { label: "Tokyo", tz: "Asia/Tokyo" },
    ];

    // config
    let useLocal = CFG.get("clock", "local", true);
    let mainCity = CFG.get("clock", "main", null);     // { label, tz }
    let zones = CFG.get("clock", "zones", DEFAULT_ZONES);
    let userName = CFG.get("user", "name", "");         // prénom pour la salutation (onboarding)

    const mainTz = () => (!useLocal && mainCity && mainCity.tz) ? mainCity.tz : undefined;  // undefined = heure locale
    function hmIn(tz) {
      const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).formatToParts(new Date());
      const h = (parts.find((p) => p.type === "hour") || {}).value || "00";
      const m = (parts.find((p) => p.type === "minute") || {}).value || "00";
      return { h, m, n: parseInt(h, 10) };
    }
    function tzOffset(tz) {
      try {
        const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(new Date());
        return (p.find((x) => x.type === "timeZoneName") || {}).value || "";
      } catch (e) { return ""; }
    }

    let tickMain = function () {};
    if (greetEl && hmEl) {
      tickMain = function () {
        const now = new Date();
        const tz = mainTz();
        const { h, m, n } = hmIn(tz);
        hmEl.textContent = h + ":" + m;
        secEl.textContent = pad(now.getSeconds());        // secondes identiques quel que soit le fuseau
        greetEl.textContent = greetingFor(n) + (userName ? ", " + userName : "");
        dateEl.textContent = new Intl.DateTimeFormat(LOCALE(), { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: tz }).format(now);
      };
      tickMain(); setInterval(tickMain, 1000);
    }

    function renderZones() {
      if (!zonesEl) return;
      zonesEl.innerHTML = zones.map((z) => `
        <div class="zone">
          <div class="city">${escHtml(z.label)}</div>
          <div class="ztime tnum" data-tz="${escHtml(z.tz)}">--:--</div>
          <div class="zmeta">${escHtml(tzOffset(z.tz))}</div>
        </div>`).join("");
      tickZones();
    }
    function tickZones() {
      if (!zonesEl) return;
      zonesEl.querySelectorAll(".ztime").forEach((el) => { const { h, m } = hmIn(el.dataset.tz); el.textContent = h + ":" + m; });
    }
    renderZones(); setInterval(tickZones, 15000);

    // panneau de réglages globaux
    const WLBL = { shortcuts: "card.shortcuts", ia: "card.ia", homelab: "card.system", weather: "card.weather", stocks: "card.stocks", recent: "card.recent", agenda: "card.agenda", news: "card.news", sport: "card.sport", sites: "card.sites" };
    const widgetLabel = (w) => WLBL[w.k] ? t(WLBL[w.k]) : w.t;
    function openSettings() {
      Settings.open(t("set.general"), [
        { type: "segmented", label: t("lang.label"), value: LANG,
          options: [{ v: "fr", t: t("lang.fr") }, { v: "en", t: t("lang.en") }],
          onChange: (v) => setLang(v) },
        { type: "segmented", label: t("theme.label"), value: THEME,
          options: [{ v: "dark", t: t("theme.dark") }, { v: "light", t: t("theme.light") }],
          onChange: (v) => setTheme(v) },
        { type: "text", label: t("set.name"), sub: t("set.name.sub"), placeholder: t("ob.name.ph"), value: userName,
          onChange: (v) => { userName = v; CFG.set("user", "name", v); tickMain(); } },
        { type: "info", text: t("set.clock.info") },
        { type: "toggle", label: t("set.clock.local"), value: useLocal,
          onChange: (v) => { useLocal = v; CFG.set("clock", "local", v); tickMain(); openSettings(); } },
        !useLocal ? { type: "city", label: t("set.clock.city"), value: mainCity ? mainCity.label : "",
          placeholder: t("ob.city.ph"),
          onPick: (p) => { mainCity = { label: p.name, tz: p.tz }; CFG.set("clock", "main", mainCity); tickMain(); } } : null,
        { type: "list", label: t("set.zones"), items: zones.map((z) => ({ label: z.label, sub: tzOffset(z.tz) })),
          move: (from, to) => { const x = zones.splice(from, 1)[0]; zones.splice(to, 0, x); CFG.set("clock", "zones", zones); renderZones(); },
          onRemove: (it, i) => { zones.splice(i, 1); CFG.set("clock", "zones", zones); renderZones(); } },
        { type: "city", label: t("set.zones.add"), placeholder: t("ob.city.ph"),
          onPick: (p) => { zones.push({ label: p.name, tz: p.tz }); CFG.set("clock", "zones", zones); renderZones(); openSettings(); } },
        { type: "info", text: t("set.widgets.info") },
        { type: "checks", label: t("set.widgets"),
          value: Layout.WIDGETS.filter((w) => Layout.isOn(w.k)).map((w) => w.k),
          options: Layout.WIDGETS.map((w) => ({ v: w.k, t: widgetLabel(w) })),
          onChange: (k, on) => Layout.setOn(k, on) },
        { type: "info", text: t("set.reconfig.info") },
        { type: "button", label: t("set.reconfig.btn"), onClick: () => { Settings.close(); if (window.Onboarding) window.Onboarding.start(); } },
      ]);
    }
    const pg = $("#pageGear");
    if (pg) { pg.setAttribute("aria-label", t("set.general")); pg.addEventListener("click", openSettings); }
  });

  /* ============================================================
     SEARCH — Google / Gemini / Claude
     ============================================================ */
  try {
    let engine = "google";
    const searchForm = $("#searchForm");
    const segBtns = $$(".seg button");
    // accent de la barre selon le moteur : google (gris) · gemini (bleu) · claude (orange)
    function applyEngineAccent() {
      if (!searchForm) return;
      searchForm.classList.remove("eng-google", "eng-gemini", "eng-claude");
      searchForm.classList.add("eng-" + engine);
    }
    applyEngineAccent();
    // Restore the persisted engine (synced across the user's machines, §3.6).
    CFG.ready(function () {
      const saved = CFG.get("search", "engine", "google");
      if (saved && saved !== engine) {
        engine = saved;
        segBtns.forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.engine === engine)));
        applyEngineAccent();
      }
    });
    segBtns.forEach((b) =>
      b.addEventListener("click", () => {
        engine = b.dataset.engine;
        segBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        applyEngineAccent();
        CFG.set("search", "engine", engine);
        $("#q").focus();
      })
    );
    $("#searchForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const raw = $("#q").value.trim();
      if (!raw) return;
      const q = encodeURIComponent(raw);
      if (engine === "gemini") {
        // ?prompt= / ?q= are not read natively by Gemini. Hand the query off via
        // storage.local; the gemini.google.com content script injects it.
        const open = () => window.open("https://gemini.google.com/app", "_blank", "noopener");
        if (hasChrome && chrome.storage) {
          chrome.storage.local.set({ geminiQuery: { q: raw, ts: Date.now() } }, open);
        } else { open(); }
      } else if (engine === "claude") {
        window.open("https://claude.ai/new?q=" + q, "_blank", "noopener");
      } else {
        window.open("https://www.google.com/search?q=" + q, "_blank", "noopener");
      }
    });
  } catch (e) { console.warn("[search]", e); }

  /* ============================================================
     SETTINGS GEARS   (design) — Raccourcis gear toggles edit mode
     ============================================================ */
  const GEAR = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="3.1" stroke="currentColor" stroke-width="1.6"/><path d="M19.4 12c0-.5-.05-1-.13-1.47l1.86-1.4-1.9-3.3-2.2.89a7.2 7.2 0 0 0-2.54-1.47L14.08 2.8H9.92l-.32 2.45a7.2 7.2 0 0 0-2.54 1.47l-2.2-.89-1.9 3.3 1.86 1.4c-.08.47-.13.97-.13 1.47s.05 1 .13 1.47l-1.86 1.4 1.9 3.3 2.2-.89a7.2 7.2 0 0 0 2.54 1.47l.32 2.45h4.16l.32-2.45a7.2 7.2 0 0 0 2.54-1.47l2.2.89 1.9-3.3-1.86-1.4c.08-.47.13-.97.13-1.47Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  try {
    $$(".head-right").forEach((hr) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "gear"; b.setAttribute("aria-label", "Paramètres du panneau");
      b.innerHTML = GEAR; hr.appendChild(b);
    });
    // (la roue de réglages IA est une tuile dans la grille — voir le widget ia)
    const pg = $("#pageGear"); if (pg) pg.innerHTML = GEAR;
  } catch (e) { console.warn("[gears]", e); }

  /* ============================================================
     RACCOURCIS — editable, persisted in chrome.storage.local
     ============================================================ */
  const IC = {
    mail: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"/><path d="m3.5 7 8.5 6 8.5-6"/>',
    play: '<polygon points="9 6 19 12 9 18"/>',
    code: '<path d="m9 8-4 4 4 4"/><path d="m15 8 4 4-4 4"/>',
    server: '<rect x="4" y="4" width="16" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="16" height="6.5" rx="1.6"/><path d="M7.5 7.25h.01M7.5 16.75h.01"/>',
    drive: '<polygon points="12 5 20 19 4 19"/>',
    doc: '<rect x="5.5" y="3.5" width="13" height="17" rx="2"/><path d="M9 8.5h6M9 12h6M9 15.5h4"/>',
    chat: '<path d="M4 5.5h16v9.5h-6.5L10 19v-4H4z"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9.5h16M8.5 3v4M15.5 3v4"/>',
    music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    cloud: '<path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 5.8 9.2 3.5 3.5 0 0 0 7 18Z"/>',
    terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/>',
    game: '<rect x="3" y="7.5" width="18" height="9" rx="4.5"/><path d="M7.5 11v2.5M6.25 12.25h2.5"/><circle cx="16" cy="11.6" r=".9"/><circle cx="17.6" cy="13.4" r=".9"/>',
    bag: '<path d="M6 8h12l-1 12H7z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
    pin: '<path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
    image: '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m5 17 5-4 4 3 3-2 2 2"/>',
    globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.5 2.5 13 0 16M12 4c-2.5 2.5-2.5 13 0 16"/>',
    star: '<path d="m12 4 2.3 5 5.2.5-3.9 3.5 1.2 5.1L12 20l-4.8 2.6 1.2-5.1L4.5 13l5.2-.5z"/>',
    bolt: '<path d="M13 3 5 13h6l-1 8 8-10h-6z"/>',
    plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  };
  const svg = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

  // Raccourcis start empty — the user adds their own (logo = site favicon, auto).
  const DEFAULT_SHORTCUTS = [];

  CFG.ready(function shortcuts() {
    const host = $("#shortcuts");
    if (!host) return;
    const card = host.closest(".card");
    let items = [];                 // [{l,url} | {l,folder:true,items:[{l,url}]}]
    let editing = false;
    let labels = CFG.get("shortcuts", "labels", false);
    let newTab = CFG.get("shortcuts", "newTab", false);

    const isFolder = (s) => !!(s && s.folder);
    const letterOf = (s) => ((s && (s.l || domainOf(s.url || ""))) || "?").trim().charAt(0).toUpperCase();
    // favicon : favicone.com suit les redirections (gmail.com → enveloppe Gmail) ;
    // repli sur le service Google (couverture universelle) ; puis la lettre.
    function favHtml(s) {
      if (s.emoji) return `<span class="sc-emoji-ic">${escHtml(s.emoji)}</span>`;   // emoji choisi
      const letter = letterOf(s);
      if (s.icon) return `<img src="${escHtml(s.icon)}" alt="" data-fb="${escHtml(letter)}">`;  // URL d'icône perso
      if (!s.url || s.url === "#") return escHtml(letter);
      // base = service Google (couverture universelle : renvoie toujours une icône sensée, ex. X).
      // data-fav = favicone.com (suit les redirections, ex. gmail→enveloppe) → upgrade si réellement dispo.
      const google = siteIcon(s.url, 64);
      const favicone = "https://favicone.com/" + encodeURIComponent(domainOf(s.url)) + "?s=64";
      return `<img src="${google}" alt="" data-fav="${escHtml(favicone)}" data-fb="${escHtml(letter)}">`;
    }

    // logo monochrome sombre sur fond transparent (ex. GitHub noir) → éclairci en blanc.
    function isDarkLogo(src) {
      try {
        const N = 32, cv = document.createElement("canvas"); cv.width = N; cv.height = N;
        const ctx = cv.getContext("2d", { willReadFrequently: true });
        ctx.clearRect(0, 0, N, N); ctx.drawImage(src, 0, 0, N, N);
        const d = ctx.getImageData(0, 0, N, N).data;
        let opaque = 0, transparent = 0, lum = 0, sat = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 32) { transparent++; continue; }
          opaque++;
          const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
          lum += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
          sat += mx ? (mx - mn) / mx : 0;
        }
        if (!opaque) return false;
        return transparent / (opaque + transparent) > 0.25 && (lum / opaque) < 0.42 && (sat / opaque) < 0.22;
      } catch (e) { return false; }
    }
    // favicone CORS:* → on vérifie qu'il a VRAIMENT l'icône (200, pas un placeholder 404) avant d'upgrader,
    // et on en profite pour analyser le blob (détection logo sombre) sans tainting.
    function upgradeFavicons(root) {
      root.querySelectorAll("img[data-fav]").forEach((img) => {
        const url = img.getAttribute("data-fav");
        fetch(url, { cache: "force-cache" }).then((r) => {
          if (!r.ok) return null;            // favicone ne l'a pas → on garde l'icône Google
          return r.blob();
        }).then((blob) => {
          if (!blob || blob.size < 70) return;
          img.removeAttribute("data-fb");    // favicone valide → plus de repli lettre nécessaire
          img.src = url;                     // upgrade (cache déjà chaud)
          if (typeof createImageBitmap === "function") {
            createImageBitmap(blob).then((bmp) => { if (isDarkLogo(bmp)) img.classList.add("fav-dark"); }).catch(() => {});
          }
        }).catch(() => {});
      });
    }
    function tileInner(s) {
      if (isFolder(s)) {
        const mini = (s.items || []).slice(0, 4).map((k) => `<span class="fmini">${favHtml(k)}</span>`).join("");
        return `<span class="folder-grid">${mini}</span>`;
      }
      return favHtml(s);
    }

    function render() {
      host.classList.toggle("editing", editing);
      if (card) card.classList.toggle("show-labels", labels);
      const tiles = items.map((s, idx) => {
        const lbl = escHtml(s.l || domainOf(s.url || ""));
        const tgt = (!isFolder(s) && newTab) ? ' target="_blank" rel="noopener"' : "";
        const href = isFolder(s) ? "#" : escHtml(s.url || "#");
        return `<a class="sc${isFolder(s) ? " folder" : ""}" href="${href}"${tgt} draggable="true" data-idx="${idx}" title="${lbl}" aria-label="${lbl}">
            <button type="button" class="del" data-del="${idx}" aria-label="Supprimer ${lbl}">${SVGI.close}</button>
            <span class="tile">${tileInner(s)}</span>
            <span class="lbl">${lbl}</span>
          </a>`;
      }).join("");
      const add = `<a class="sc add" href="#" id="scAdd" title="Ajouter" aria-label="Ajouter un raccourci">
          <span class="tile">${svg(IC.plus)}</span>
          <span class="lbl">Ajouter</span>
        </a>`;
      host.innerHTML = tiles + add;
      wireImgFallback(host); upgradeFavicons(host);
    }

    function save() { dbSet({ shortcuts: items }); }

    // clics : supprimer · ajouter · ouvrir dossier · éditer (mode édition) · naviguer
    host.addEventListener("click", (e) => {
      const del = e.target.closest("[data-del]");
      if (del) { e.preventDefault(); items.splice(+del.dataset.del, 1); save(); render(); return; }
      if (e.target.closest("#scAdd")) { e.preventDefault(); openModal("add", {}); return; }
      const a = e.target.closest(".sc:not(.add)");
      if (!a) return;
      const idx = +a.dataset.idx, s = items[idx];
      if (isFolder(s)) { e.preventDefault(); openFolder(idx); return; }
      if (editing) { e.preventDefault(); openModal("edit", { ref: { top: idx } }); return; }
      if (a.getAttribute("href") === "#") e.preventDefault();
    });

    /* ---- glisser-déposer : centre = créer/alimenter un dossier · bord = réordonner ---- */
    let dragIdx = -1, drop = null;   // drop = { idx, mode:'merge'|'before'|'after'|'end' }
    const clearMarks = () => host.querySelectorAll(".sc").forEach((el) => el.classList.remove("drop-merge", "drop-before", "drop-after"));
    host.addEventListener("dragstart", (e) => {
      const a = e.target.closest(".sc:not(.add)");
      if (!a) return;
      dragIdx = +a.dataset.idx;
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", String(dragIdx)); } catch (_) { /* Safari */ }
      a.classList.add("dragging");
    });
    host.addEventListener("dragend", () => {
      dragIdx = -1; drop = null; clearMarks();
      host.querySelectorAll(".sc.dragging").forEach((el) => el.classList.remove("dragging"));
    });
    host.addEventListener("dragover", (e) => {
      if (dragIdx < 0) return;
      e.preventDefault(); e.dataTransfer.dropEffect = "move";
      clearMarks();
      const a = e.target.closest(".sc:not(.add)");
      if (!a) { drop = { idx: items.length, mode: "end" }; return; }
      const t = +a.dataset.idx;
      if (t === dragIdx) { drop = null; return; }
      const rect = a.getBoundingClientRect();
      const frac = (e.clientX - rect.left) / rect.width;
      const canMerge = !isFolder(items[dragIdx]);   // un dossier ne se met pas dans un dossier
      if (canMerge && frac > 0.28 && frac < 0.72) { drop = { idx: t, mode: "merge" }; a.classList.add("drop-merge"); }
      else if (frac < 0.5) { drop = { idx: t, mode: "before" }; a.classList.add("drop-before"); }
      else { drop = { idx: t, mode: "after" }; a.classList.add("drop-after"); }
    });
    host.addEventListener("drop", (e) => {
      if (dragIdx < 0 || !drop) return;
      e.preventDefault();
      const s = dragIdx, moved = items[s];
      if (drop.mode === "end") { items.splice(s, 1); items.push(moved); }
      else {
        const tgtIdx = drop.idx;
        items.splice(s, 1);
        let ti = tgtIdx; if (s < tgtIdx) ti--;
        if (drop.mode === "merge") {
          const tgt = items[ti];
          if (isFolder(tgt)) tgt.items.push(moved);
          else items[ti] = { l: "Dossier", folder: true, items: [tgt, moved] };
        } else {
          items.splice(drop.mode === "before" ? ti : ti + 1, 0, moved);
        }
      }
      dragIdx = -1; drop = null;
      save(); render();
    });

    // roue crantée -> réglages
    const gear = card && card.querySelector(".head-right .gear");
    if (gear) {
      gear.setAttribute("aria-label", "Réglages des raccourcis");
      gear.addEventListener("click", () => Settings.open("Raccourcis", [
        { type: "toggle", label: "Mode édition", sub: "Éditer (clic), supprimer (×), organiser en dossiers", value: editing,
          onChange: (v) => { editing = v; render(); } },
        { type: "toggle", label: "Afficher les libellés", sub: "Nom du site sous chaque tuile", value: labels,
          onChange: (v) => { labels = v; CFG.set("shortcuts", "labels", v); render(); } },
        { type: "toggle", label: "Ouvrir dans un nouvel onglet", value: newTab,
          onChange: (v) => { newTab = v; CFG.set("shortcuts", "newTab", v); render(); } },
        { type: "button", label: "+ Ajouter un raccourci", primary: true, onClick: () => { Settings.close(); openModal("add", {}); } },
      ]));
    }

    /* ---- modal ajout / édition (avec affectation à un dossier) ---- */
    const modal = $("#scModal"), nameEl = $("#scName"), urlEl = $("#scUrl"),
      folderSel = $("#scFolder"), newFolderRow = $("#scFolderNewRow"), newFolderEl = $("#scFolderNew"),
      modalTitle = $("#scModalTitle"), saveBtn = $("#scSave");
    let modalMode = "add", editRef = null;

    /* ---- icône personnalisée : auto · emoji · image (URL) ---- */
    const iconSeg = $("#scIconSeg"), iconPrev = $("#scIconPrev"), emojiBox = $("#scEmoji"),
      emojiCats = $("#scEmojiCats"), emojiGrid = $("#scEmojiGrid"), iconUrlRow = $("#scIconUrlRow"), iconUrlEl = $("#scIconUrl");
    let iconMode = "auto", iconEmoji = "";
    // catalogue d'emojis par catégorie (séparés par espaces → split sûr même pour drapeaux/séquences)
    const EMOJI = [
      { c: "😀", e: "😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😶‍🌫️ 😱 😨 😰 😥 😓 🤗 🤔 🤭 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 😵‍💫 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👿 👹 👺 🤡 💩 👻 💀 ☠️ 👽 👾 🤖 🎃".split(" ") },
      { c: "🧑", e: "👋 🤚 🖐 ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🙏 ✍️ 💅 🤳 💪 🦾 🦵 🦶 👂 👃 🧠 🫀 🫁 🦷 🦴 👀 👁 👅 👄 💋 🩸 👶 🧒 👦 👧 🧑 👨 👩 🧓 👴 👵 🙍 🙎 🙅 🙆 💁 🙋 🧏 🙇 🤦 🤷 👮 🕵️ 💂 👷 🤴 👸 👳 👲 🧕 🤵 👰 🤰 🤱 👼 🎅 🤶 🦸 🦹 🧙 🧚 🧛 🧜 🧝 🧞 🧟".split(" ") },
      { c: "🐻", e: "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐒 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐜 🦗 🕷 🦂 🐢 🐍 🦎 🦖 🦕 🐙 🦑 🦐 🦞 🦀 🐡 🐠 🐟 🐬 🐳 🐋 🦈 🐊 🐅 🐆 🦓 🦍 🦧 🐘 🦛 🦏 🐪 🐫 🦒 🦘 🐃 🐂 🐄 🐎 🐖 🐏 🐑 🦙 🐐 🦌 🐕 🐩 🐈 🐓 🦃 🦚 🦜 🦢 🕊 🐇 🦝 🦔 🐉 🌵 🎄 🌲 🌳 🌴 🌱 🌿 ☘️ 🍀 🍃 🍂 🍁 🍄 🌾 💐 🌷 🌹 🥀 🌺 🌸 🌼 🌻".split(" ") },
      { c: "🍔", e: "🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆 🥑 🥦 🥬 🥒 🌶 🫑 🌽 🥕 🧄 🧅 🥔 🍠 🥐 🥯 🍞 🥖 🥨 🧀 🥚 🍳 🧈 🥞 🧇 🥓 🥩 🍗 🍖 🌭 🍔 🍟 🍕 🥪 🥙 🧆 🌮 🌯 🥗 🥘 🫕 🥫 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🦪 🍤 🍙 🍚 🍘 🍥 🥠 🥮 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍮 🍭 🍬 🍫 🍿 🍩 🍪 🌰 🥜 🍯 🥛 🍼 ☕ 🫖 🍵 🧃 🥤 🧋 🍶 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🧉 🍾 🧊 🥄 🍴 🍽 🥣 🥡 🥢".split(" ") },
      { c: "⚽", e: "⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🪀 🏓 🏸 🏒 🏑 🥍 🏏 🥅 ⛳ 🪁 🏹 🎣 🤿 🥊 🥋 🎽 🛹 🛼 🛷 ⛸ 🥌 🎿 ⛷ 🏂 🏋️ 🤼 🤸 ⛹️ 🤺 🤾 🏌️ 🏇 🧘 🏄 🏊 🤽 🚣 🧗 🚵 🚴 🏆 🥇 🥈 🥉 🏅 🎖 🏵 🎗 🎫 🎟 🎪 🤹 🎭 🩰 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🎸 🪕 🎻 🎲 ♟ 🎯 🎳 🎮 🎰 🧩".split(" ") },
      { c: "🚗", e: "🚗 🚕 🚙 🚌 🚎 🏎 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🛴 🚲 🛵 🏍 🛺 🚨 🚔 🚍 🚘 🚖 🚡 🚠 🚟 🚃 🚋 🚞 🚝 🚄 🚅 🚈 🚂 🚆 🚇 🚊 🚉 ✈️ 🛫 🛬 🛩 💺 🛰 🚀 🛸 🚁 🛶 ⛵ 🚤 🛥 🛳 ⛴ 🚢 ⚓ ⛽ 🚧 🚦 🚥 🗺 🗿 🗽 🗼 🏰 🏯 🏟 🎡 🎢 🎠 ⛲ ⛱ 🏖 🏝 🏜 🌋 ⛰ 🏔 🗻 🏕 ⛺ 🏠 🏡 🏘 🏚 🏗 🏭 🏢 🏬 🏣 🏥 🏦 🏨 🏪 🏫 🏩 💒 🏛 ⛪ 🕌 🕍 🛕 🕋 ⛩ 🗾 🎑 🏞 🌅 🌄 🌠 🎇 🎆 🌇 🌆 🏙 🌃 🌌 🌉 🌁".split(" ") },
      { c: "💡", e: "⌚ 📱 📲 💻 ⌨️ 🖥 🖨 🖱 🖲 🕹 🗜 💽 💾 💿 📀 📼 📷 📸 📹 🎥 📽 🎞 📞 ☎️ 📟 📠 📺 📻 🎙 🎚 🎛 🧭 ⏱ ⏲ ⏰ 🕰 ⌛ ⏳ 📡 🔋 🔌 💡 🔦 🕯 🧯 🛢 💸 💵 💴 💶 💷 🪙 💰 💳 🧾 💎 ⚖️ 🧰 🔧 🔨 ⚒ 🛠 ⛏ 🔩 ⚙️ 🧱 ⛓ 🧲 🔫 💣 🧨 🪓 🔪 🗡 ⚔️ 🛡 🚬 ⚰️ ⚱️ 🏺 🔮 📿 🧿 💈 ⚗️ 🔭 🔬 🕳 💊 💉 🩸 🧬 🦠 🧫 🧪 🌡 🧹 🧺 🧻 🚽 🚰 🚿 🛁 🛀 🧼 🪥 🪒 🧽 🧴 🛎 🔑 🗝 🚪 🛋 🛏 🛌 🧸 🖼 🛍 🛒 🎁 🎈 🎏 🎀 🎊 🎉 🎎 🏮 🎐 ✉️ 📩 📨 📧 💌 📦 🏷 📫 📮 📜 📃 📄 📑 📊 📈 📉 🗒 🗓 📆 📅 🗑 📇 🗃 🗳 🗄 📋 📁 📂 🗂 🗞 📰 📓 📔 📒 📕 📗 📘 📙 📚 📖 🔖 🔗 📎 🖇 📐 📏 🧮 📌 📍 ✂️ 🖊 🖋 ✒️ 🖌 🖍 📝 ✏️ 🔍 🔎 🔏 🔐 🔒 🔓".split(" ") },
      { c: "❤️", e: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ☮️ ✝️ ☪️ 🕉 ☸️ ✡️ 🔯 🕎 ☯️ ☦️ 🛐 ⛎ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ 🆔 ⚛️ 🉑 ☢️ ☣️ 📴 📳 🈶 🈚 🈸 🈺 🈷️ ✴️ 🆚 💮 🉐 ㊙️ ㊗️ 🈴 🈵 🈹 🈲 🅰️ 🅱️ 🆎 🆑 🅾️ 🆘 ❌ ⭕ 🛑 ⛔ 📛 🚫 💯 💢 ♨️ 🚷 🚯 🚳 🚱 🔞 📵 🚭 ❗ ❕ ❓ ❔ ‼️ ⁉️ 🔅 🔆 〽️ ⚠️ 🚸 🔱 ⚜️ 🔰 ♻️ ✅ 🈯 💹 ❇️ ✳️ ❎ 🌐 💠 Ⓜ️ 🌀 💤 🏧 🚾 ♿ 🅿️ 🛗 🈳 🈂️ 🛂 🛃 🛄 🛅 🚹 🚺 🚼 🚻 🚮 🎦 📶 🈁 🔣 ℹ️ 🔤 🔡 🔠 🆖 🆗 🆙 🆒 🆕 🆓 0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟 🔢 #️⃣ *️⃣ ▶️ ⏸ ⏯ ⏹ ⏺ ⏭ ⏮ ⏩ ⏪ ⏫ ⏬ ◀️ 🔼 🔽 ➡️ ⬅️ ⬆️ ⬇️ ↗️ ↘️ ↙️ ↖️ ↕️ ↔️ ↪️ ↩️ ⤴️ ⤵️ 🔀 🔁 🔂 🔄 🔃 🎵 🎶 ➕ ➖ ➗ ✖️ 🟰 ♾️ 💲 💱 ™️ ©️ ®️ 〰️ ➰ ➿ 🔚 🔙 🔛 🔝 🔜 ✔️ ☑️ 🔘 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤 🔺 🔻 🔸 🔹 🔶 🔷 🔳 🔲 ▪️ ▫️ ◾ ◽ ◼️ ◻️ 🟥 🟧 🟨 🟩 🟦 🟪 ⬛ ⬜ 🟫 🔈 🔇 🔉 🔊 🔔 🔕 📣 📢 💬 💭 🗯 ♠️ ♣️ ♥️ ♦️ 🃏 🎴 🀄 🕐 🕑 🕒 🕓 🕔 🕕 🕖 🕗 🕘 🕙 🕚 🕛".split(" ") },
      { c: "🏳️", e: "🏳️ 🏴 🏁 🚩 🏳️‍🌈 🏴‍☠️ 🇫🇷 🇧🇪 🇨🇭 🇨🇦 🇺🇸 🇬🇧 🇩🇪 🇪🇸 🇮🇹 🇵🇹 🇳🇱 🇯🇵 🇨🇳 🇰🇷 🇷🇺 🇧🇷 🇮🇳 🇦🇺 🇲🇽 🇸🇪 🇳🇴 🇩🇰 🇫🇮 🇵🇱 🇬🇷 🇮🇪 🇦🇹 🇪🇺 🇲🇦 🇩🇿 🇹🇳 🇸🇳 🇨🇮 🇱🇺 🇨🇿 🇭🇺 🇷🇴 🇺🇦 🇹🇷 🇹🇭 🇻🇳 🇮🇩 🇵🇭 🇸🇬 🇿🇦 🇦🇷 🇨🇱 🇨🇴 🇵🇪 🇳🇿".split(" ") },
    ];
    let emojiBuilt = false;
    function updateIconPreview() {
      if (!iconPrev) return;
      if (iconMode === "emoji") { iconPrev.textContent = iconEmoji || "🙂"; return; }
      if (iconMode === "url") { iconPrev.innerHTML = iconUrlEl.value.trim() ? `<img src="${escHtml(iconUrlEl.value.trim())}" alt="">` : "🖼️"; return; }
      // auto : aperçu = le vrai favicon qui s'afficherait (même logique que la tuile)
      const u = urlEl.value.trim();
      if (!u) { iconPrev.textContent = "🌐"; return; }
      iconPrev.innerHTML = favHtml({ url: /^https?:\/\//i.test(u) ? u : "https://" + u });
      wireImgFallback(iconPrev); upgradeFavicons(iconPrev);
    }
    function renderEmojiGrid(ci) {
      emojiGrid.innerHTML = EMOJI[ci].e.map((e) => `<button type="button" class="sc-emoji-btn">${e}</button>`).join("");
      emojiGrid.querySelectorAll(".sc-emoji-btn").forEach((b) => b.addEventListener("click", () => { iconEmoji = b.textContent; updateIconPreview(); }));
    }
    function buildEmojiPicker() {
      emojiBuilt = true;
      emojiCats.innerHTML = EMOJI.map((cat, i) => `<button type="button" data-ci="${i}"${i === 0 ? ' class="on"' : ""}>${cat.c}</button>`).join("");
      emojiCats.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
        emojiCats.querySelectorAll("button").forEach((x) => x.classList.remove("on"));
        b.classList.add("on"); renderEmojiGrid(+b.dataset.ci);
      }));
      renderEmojiGrid(0);
    }
    function setIconMode(m) {
      iconMode = m;
      if (iconSeg) iconSeg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.im === m)));
      if (emojiBox) emojiBox.style.display = m === "emoji" ? "" : "none";
      if (iconUrlRow) iconUrlRow.style.display = m === "url" ? "" : "none";
      if (m === "emoji" && !emojiBuilt) buildEmojiPicker();
      updateIconPreview();
    }

    function buildFolderSelect() {
      const names = items.filter(isFolder).map((f) => f.l);
      folderSel.innerHTML = '<option value="">(aucun)</option>'
        + names.map((n) => `<option value="${escHtml(n)}">${escHtml(n)}</option>`).join("")
        + '<option value="__new__">+ Nouveau dossier…</option>';
    }
    function toggleNewFolder() { if (newFolderRow) newFolderRow.style.display = (folderSel.value === "__new__") ? "" : "none"; }

    function openModal(mode, opts) {
      if (!modal) return;
      opts = opts || {};
      modalMode = mode; editRef = opts.ref || null;
      buildFolderSelect();
      if (mode === "edit" && editRef) {
        const s = editRef.folder != null ? items[editRef.folder].items[editRef.item] : items[editRef.top];
        nameEl.value = (s && s.l) || ""; urlEl.value = (s && s.url) || "";
        folderSel.value = editRef.folder != null ? items[editRef.folder].l : "";
      } else {
        nameEl.value = ""; urlEl.value = "";
        folderSel.value = opts.folder || "";
      }
      if (newFolderEl) newFolderEl.value = "";
      toggleNewFolder();
      // icône (auto / emoji / url) d'après l'élément édité
      const cur = (mode === "edit" && editRef) ? (editRef.folder != null ? items[editRef.folder].items[editRef.item] : items[editRef.top]) : null;
      iconEmoji = (cur && cur.emoji) || "";
      if (iconUrlEl) iconUrlEl.value = (cur && cur.icon) || "";
      setIconMode(cur && cur.emoji ? "emoji" : (cur && cur.icon ? "url" : "auto"));
      if (modalTitle) modalTitle.textContent = mode === "edit" ? "Modifier le raccourci" : "Nouveau raccourci";
      if (saveBtn) saveBtn.textContent = mode === "edit" ? "Enregistrer" : "Ajouter";
      modal.classList.add("open"); setTimeout(() => urlEl.focus(), 30);
    }
    function closeModal() { modal && modal.classList.remove("open"); }

    function removeRef(ref) {
      if (!ref) return;
      if (ref.folder != null) { const f = items[ref.folder]; if (f && f.items) f.items.splice(ref.item, 1); }
      else if (ref.top != null) items.splice(ref.top, 1);
    }
    function placeLink(link, folderName) {
      if (!folderName) { items.push(link); return; }
      const f = items.find((x) => isFolder(x) && x.l === folderName);
      if (f) f.items.push(link); else items.push({ l: folderName, folder: true, items: [link] });
    }
    function commit() {
      const name = nameEl.value.trim();
      let url = urlEl.value.trim();
      if (!name && !url) return closeModal();
      if (url && !/^https?:\/\//i.test(url) && url !== "#") url = "https://" + url;
      const link = { l: name || domainOf(url), url: url || "#" };
      if (iconMode === "emoji" && iconEmoji) link.emoji = iconEmoji;
      else if (iconMode === "url" && iconUrlEl.value.trim()) link.icon = iconUrlEl.value.trim();
      if (modalMode === "edit") removeRef(editRef);
      let folderName = null;
      if (folderSel.value === "__new__") folderName = (newFolderEl.value.trim() || null);
      else if (folderSel.value) folderName = folderSel.value;
      placeLink(link, folderName);
      save(); render(); closeModal();
    }
    if (modal) {
      saveBtn.addEventListener("click", commit);
      $("#scCancel").addEventListener("click", closeModal);
      modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
      folderSel.addEventListener("change", toggleNewFolder);
      urlEl.addEventListener("keydown", (e) => { if (e.key === "Enter") commit(); });
      urlEl.addEventListener("input", () => { if (iconMode === "auto") updateIconPreview(); });
      nameEl.addEventListener("keydown", (e) => { if (e.key === "Enter") urlEl.focus(); });
      if (iconSeg) iconSeg.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => setIconMode(b.dataset.im)));
      if (iconUrlEl) iconUrlEl.addEventListener("input", updateIconPreview);
    }

    /* ---- bulle dossier (grille 3×3 type Android) ---- */
    let fbModal = null, fbIdx = -1, fbDragJ = -1;
    function ensureFb() {
      if (fbModal) return;
      fbModal = document.createElement("div"); fbModal.className = "modal sc-fb-modal";
      fbModal.innerHTML =
        '<div class="modal-card sc-fb-card">' +
        '  <div class="sc-fb-head"><input type="text" class="sc-fb-name" disabled><button type="button" class="cfg-x sc-fb-x" aria-label="Fermer">' + SVGI.close + "</button></div>" +
        '  <div class="sc-fb-grid"></div>' +
        '  <div class="sc-fb-actions"></div>' +
        "</div>";
      document.body.appendChild(fbModal);
      fbModal.addEventListener("click", (e) => { if (e.target === fbModal) closeFb(); });
      fbModal.querySelector(".sc-fb-x").addEventListener("click", closeFb);
      fbModal.querySelector(".sc-fb-name").addEventListener("change", () => {
        const f = items[fbIdx]; if (!f) return;
        const v = fbModal.querySelector(".sc-fb-name").value.trim();
        if (v) { f.l = v; save(); render(); }
      });
      fbModal.querySelector(".sc-fb-grid").addEventListener("click", (e) => {
        const f = items[fbIdx]; if (!isFolder(f)) return;
        const del = e.target.closest("[data-fdel]");
        if (del) { e.preventDefault(); f.items.splice(+del.dataset.fdel, 1); save(); render(); openFolder(fbIdx); return; }
        if (e.target.closest("#fbAdd")) { e.preventDefault(); closeFb(); openModal("add", { folder: f.l }); return; }
        const a = e.target.closest(".fb-item:not(.add)");
        if (!a) return;
        if (editing) { e.preventDefault(); closeFb(); openModal("edit", { ref: { folder: fbIdx, item: +a.dataset.j } }); return; }
        if (a.getAttribute("href") === "#") e.preventDefault();
      });
      // glisser-déposer dans la bulle : hors de la carte = sortir le raccourci (style Android) ; sur un item = réordonner
      fbModal.querySelector(".sc-fb-grid").addEventListener("dragstart", (e) => {
        const it = e.target.closest(".fb-item:not(.add)");
        if (!it) return;
        fbDragJ = +it.dataset.j;
        e.dataTransfer.effectAllowed = "move";
        try { e.dataTransfer.setData("text/plain", "fb"); } catch (_) { /* Safari */ }
        it.classList.add("dragging");
      });
      fbModal.addEventListener("dragover", (e) => {
        if (fbDragJ < 0) return;
        e.preventDefault();
        fbModal.classList.toggle("fb-dragout", !e.target.closest(".sc-fb-card"));
      });
      fbModal.addEventListener("drop", (e) => {
        if (fbDragJ < 0) return;
        e.preventDefault();
        const f = items[fbIdx], j = fbDragJ;
        fbDragJ = -1; fbModal.classList.remove("fb-dragout");
        if (!f || !isFolder(f)) return;
        if (!e.target.closest(".sc-fb-card")) {
          // SORTIR : le raccourci revient dans la liste de base ; dossier vide → supprimé
          const moved = f.items.splice(j, 1)[0];
          if (moved) items.push(moved);
          if (!f.items.length) { items.splice(fbIdx, 1); save(); render(); closeFb(); return; }
          save(); render(); openFolder(fbIdx);
        } else {
          // RÉORDONNER dans le dossier
          const target = e.target.closest(".fb-item:not(.add)");
          if (!target) return;
          const tj = +target.dataset.j;
          if (tj === j) return;
          const moved = f.items.splice(j, 1)[0];
          let ti = tj; if (j < tj) ti--;
          const r = target.getBoundingClientRect();
          f.items.splice((e.clientX - r.left) > r.width / 2 ? ti + 1 : ti, 0, moved);
          save(); render(); openFolder(fbIdx);
        }
      });
      fbModal.addEventListener("dragend", () => {
        fbDragJ = -1; fbModal.classList.remove("fb-dragout");
        fbModal.querySelectorAll(".fb-item.dragging").forEach((el) => el.classList.remove("dragging"));
      });
    }
    function closeFb() { if (fbModal) fbModal.classList.remove("open"); }
    function openFolder(idx) {
      ensureFb(); fbIdx = idx;
      const f = items[idx]; if (!isFolder(f)) return;
      const nameInput = fbModal.querySelector(".sc-fb-name");
      nameInput.value = f.l || "Dossier"; nameInput.disabled = !editing;
      const tgt = newTab ? ' target="_blank" rel="noopener"' : "";
      const grid = fbModal.querySelector(".sc-fb-grid");
      grid.innerHTML = (f.items || []).map((k, j) => {
        const lbl = escHtml(k.l || domainOf(k.url || ""));
        return `<a class="fb-item" href="${escHtml(k.url || "#")}"${tgt} draggable="true" data-j="${j}" title="${lbl}">
            <button type="button" class="del" data-fdel="${j}" aria-label="Retirer ${lbl}">${SVGI.close}</button>
            <span class="tile">${favHtml(k)}</span><span class="lbl">${lbl}</span>
          </a>`;
      }).join("") + `<a class="fb-item add" href="#" id="fbAdd" title="Ajouter"><span class="tile">${svg(IC.plus)}</span><span class="lbl">Ajouter</span></a>`;
      wireImgFallback(grid); upgradeFavicons(grid);
      fbModal.querySelector(".sc-fb-card").classList.toggle("editing", editing);
      const actions = fbModal.querySelector(".sc-fb-actions");
      actions.innerHTML = editing ? '<button type="button" class="btn sc-fb-del">Supprimer le dossier</button>' : "";
      if (editing) actions.querySelector(".sc-fb-del").addEventListener("click", () => { items.splice(idx, 1); save(); render(); closeFb(); });
      const firstOpen = !fbModal.classList.contains("open");
      fbModal.classList.add("open");
      positionBubble(idx);
      // animation pop seulement à la 1re ouverture (pas sur un refresh interne)
      if (firstOpen) { const c = fbModal.querySelector(".sc-fb-card"); c.classList.remove("fb-pop"); void c.offsetWidth; c.classList.add("fb-pop"); }
    }
    // place la bulle juste au-dessus de la tuile du dossier cliqué (style Android), bornée à l'écran
    function positionBubble(idx) {
      const tile = host.querySelector('.sc[data-idx="' + idx + '"]');
      const cardBubble = fbModal.querySelector(".sc-fb-card");
      if (!tile || !cardBubble) return;
      const tr = tile.getBoundingClientRect();
      const cw = cardBubble.offsetWidth, ch = cardBubble.offsetHeight, m = 10;
      let left = tr.left + tr.width / 2 - cw / 2;
      left = Math.max(m, Math.min(left, window.innerWidth - cw - m));
      let top = tr.top - ch - 12;                                   // au-dessus de la tuile
      if (top < m) top = Math.min(tr.bottom + 12, window.innerHeight - ch - m);   // sinon en dessous
      top = Math.max(m, top);
      cardBubble.style.left = left + "px";
      cardBubble.style.top = top + "px";
    }

    // chargement (sync multi-appareils ; défauts pour un premier lancement)
    if (SYNC) {
      dbGet({ shortcuts: null }, (r) => {
        items = Array.isArray(r.shortcuts) ? r.shortcuts : DEFAULT_SHORTCUTS.slice();
        render();
      });
    } else { items = DEFAULT_SHORTCUTS.slice(); render(); }
  });

  /* ============================================================
     IA RAPIDE — services IA, logos = favicons (sélection + ordre configurables)
     ============================================================ */
  CFG.ready(function ia() {
    // Catalogue complet ; l'utilisateur choisit lesquels afficher et dans quel ordre.
    const CATALOG = [
      { id: "chatgpt", n: "ChatGPT", u: "https://chatgpt.com" },
      { id: "claude", n: "Claude", u: "https://claude.ai" },
      { id: "gemini", n: "Gemini", u: "https://gemini.google.com", bare: true },
      { id: "perplexity", n: "Perplexity", u: "https://www.perplexity.ai" },
      { id: "grok", n: "Grok", u: "https://grok.com" },
      { id: "mistral", n: "Mistral", u: "https://chat.mistral.ai" },
      { id: "deepseek", n: "DeepSeek", u: "https://chat.deepseek.com" },
      { id: "kimi", n: "Kimi", u: "https://www.kimi.com" },
      { id: "qwen", n: "Qwen", u: "https://chat.qwen.ai", bare: true },
      { id: "copilot", n: "Copilot", u: "https://copilot.microsoft.com" },
      { id: "lmarena", n: "LM Arena", u: "https://lmarena.ai" },
      { id: "poe", n: "Poe", u: "https://poe.com" },
      { id: "you", n: "You.com", u: "https://you.com" },
      { id: "phind", n: "Phind", u: "https://www.phind.com" },
      { id: "notebooklm", n: "NotebookLM", u: "https://notebooklm.google.com" },
    ];
    const byId = (id) => CATALOG.find((a) => a.id === id);
    const DEFAULT_IDS = CATALOG.slice(0, 11).map((a) => a.id);   // 11 services + 1 case réglages = grille 3×4
    const MAX_SERVICES = 11;
    const mini = $("#aiMini");
    if (!mini) return;
    let order = CFG.get("ia", "order", DEFAULT_IDS).filter(byId);
    if (!order.length) order = DEFAULT_IDS.slice();
    // par défaut : ouvre dans l'onglet courant (remplace « Nouvel onglet ») ; clic molette / Ctrl = nouvel onglet (natif)
    let newTab = CFG.get("ia", "newTab", false);

    function render() {
      const tgt = newTab ? ' target="_blank" rel="noopener"' : "";
      const tiles = order.slice(0, MAX_SERVICES).map((id) => {
        const a = byId(id); if (!a) return "";
        const letter = a.n.charAt(0).toUpperCase();
        return `<a class="${a.bare ? "bare" : ""}" href="${a.u}"${tgt} title="${escHtml(a.n)}" aria-label="${escHtml(a.n)}">
            <img src="${siteIcon(a.u, 64)}" alt="" data-fb="${escHtml(letter)}">
          </a>`;
      }).join("");
      // dernière case = roue de réglages (remplace l'ancienne roue flottante)
      const gearTile = `<button type="button" class="ai-gear" aria-label="Paramètres IA">${GEAR}</button>`;
      mini.innerHTML = tiles + gearTile;
      wireImgFallback(mini);
    }
    function save() { CFG.set("ia", "order", order); }

    function openSettings() {
      const items = order.map((id) => { const a = byId(id); return { id, label: a ? a.n : id }; });
      const available = CATALOG.filter((a) => order.indexOf(a.id) === -1);
      Settings.open("IA rapide", [
        { type: "info", text: "Choisis les services affichés et leur ordre (11 max : la 12ᵉ case est la roue de réglages)." },
        { type: "list", label: "Services affichés", items,
          move: (from, to) => { const x = order.splice(from, 1)[0]; order.splice(to, 0, x); save(); render(); },
          onRemove: (it) => { order = order.filter((id) => id !== it.id); save(); render(); } },
        available.length ? { type: "select", label: "Ajouter un service", value: "",
          options: [{ v: "", t: "— choisir —" }].concat(available.map((a) => ({ v: a.id, t: a.n }))),
          onChange: (v) => { if (v) { order.push(v); save(); render(); openSettings(); } } } : null,
        { type: "toggle", label: "Ouvrir dans un nouvel onglet", value: newTab,
          onChange: (v) => { newTab = v; CFG.set("ia", "newTab", v); render(); } },
      ]);
    }
    mini.addEventListener("click", (e) => { if (e.target.closest(".ai-gear")) { e.preventDefault(); openSettings(); } });
    render();
  });

  /* ============================================================
     AGENDA — Google Calendar (chrome.identity OAuth)
     Falls back to an empty grid + "Connecter" pill if not authorized.
     ============================================================ */
  CFG.ready(function agenda() {
    const grid = $("#calGrid"); if (!grid) return;
    const card = $("#agendaCard");
    const monthLbl = $("#calMonth");
    const weekdaysEl = grid.previousElementSibling && grid.previousElementSibling.classList.contains("cal-weekdays")
      ? grid.previousElementSibling : null;
    const MOIS = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(LOCALE(), { month: "long" }).format(new Date(2021, i, 1)));
    const MOISC = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(LOCALE(), { month: "short" }).format(new Date(2021, i, 1)));
    const DOW_MON = ["wd.mon", "wd.tue", "wd.wed", "wd.thu", "wd.fri", "wd.sat", "wd.sun"].map((k) => t(k));
    const DOW_SUN = ["wd.sun", "wd.mon", "wd.tue", "wd.wed", "wd.thu", "wd.fri", "wd.sat"].map((k) => t(k));
    const esc = escHtml;
    const monthCache = {};   // "y-m" -> { day: [ {label, link, allDay} ] }
    let connected = false;
    let calY, calM;          // mois affiché (vue mois)
    let weekAnchor;          // un jour de la semaine affichée (vue semaine)

    // config
    let view = CFG.get("agenda", "view", "month");          // month | week
    let weekStart = CFG.get("agenda", "weekStart", "mon");   // mon | sun
    let showAllDay = CFG.get("agenda", "allDay", true);
    let calendars = null;                                    // [{id,summary,color}] — tous les agendas du compte
    let hiddenCalendars = CFG.get("agenda", "hiddenCalendars", []);   // ids désactivés (par défaut : tous affichés)

    const pad2 = (n) => String(n).padStart(2, "0");
    const frTime = (d) => { const h = d.getHours(), mn = d.getMinutes(); return mn ? h + "h" + String(mn).padStart(2, "0") : h + "h"; };
    const startOffset = (dow) => weekStart === "sun" ? dow : (dow + 6) % 7;   // 0..6 depuis le 1er jour
    const dowLabels = () => weekStart === "sun" ? DOW_SUN : DOW_MON;

    function evForDate(d) {
      const key = d.getFullYear() + "-" + d.getMonth();
      let evs = (monthCache[key] || {})[d.getDate()] || [];
      if (!showAllDay) evs = evs.filter((e) => !e.allDay);
      return evs;
    }

    function setWeekdaysHeader() {
      if (!weekdaysEl) return;
      if (view === "week") { weekdaysEl.style.display = "none"; return; }
      weekdaysEl.style.display = "";
      weekdaysEl.innerHTML = dowLabels().map((d) => `<span>${d}</span>`).join("");
    }

    function renderMonth(y, m) {
      grid.classList.remove("week-mode");
      monthLbl.textContent = MOIS[m] + " " + y;
      const evMap = monthCache[y + "-" + m] || {};
      const off = startOffset(new Date(y, m, 1).getDay());
      const dim = new Date(y, m + 1, 0).getDate();
      const weeks = Math.ceil((off + dim) / 7);
      const t = new Date();
      let html = "";
      for (let i = 0; i < weeks * 7; i++) {
        const dn = i - off + 1;
        if (dn < 1 || dn > dim) { html += '<div class="cal-day out"></div>'; continue; }
        const today = y === t.getFullYear() && m === t.getMonth() && dn === t.getDate();
        let evs = evMap[dn] || [];
        if (!showAllDay) evs = evs.filter((e) => !e.allDay);
        const chips = evs.slice(0, 2)
          .map((e) => `<a class="cal-ev" href="${esc(e.link)}" target="_blank" rel="noopener" title="${esc(e.label)}"${e.color ? ` style="background:${esc(e.color)}22;border-color:${esc(e.color)}55;color:${esc(e.color)}"` : ""}>${esc(e.label)}</a>`).join("");
        const more = evs.length > 2 ? `<span class="cal-more">+${evs.length - 2}</span>` : "";
        const date = y + "-" + pad2(m + 1) + "-" + pad2(dn);
        html += `<div class="cal-day${today ? " today" : ""}" data-date="${date}"><span class="num tnum">${dn}</span>${chips}${more}</div>`;
      }
      grid.innerHTML = html;
    }

    function weekDays(anchor) {
      const off = startOffset(anchor.getDay());
      const first = new Date(anchor); first.setDate(anchor.getDate() - off);
      const days = [];
      for (let i = 0; i < 7; i++) { const d = new Date(first); d.setDate(first.getDate() + i); days.push(d); }
      return days;
    }

    function renderWeek(anchor) {
      grid.classList.add("week-mode");
      const days = weekDays(anchor);
      const a = days[0], b = days[6];
      monthLbl.textContent = a.getMonth() === b.getMonth()
        ? a.getDate() + "–" + b.getDate() + " " + MOISC[a.getMonth()]
        : a.getDate() + " " + MOISC[a.getMonth()] + " – " + b.getDate() + " " + MOISC[b.getMonth()];
      const lbls = dowLabels();
      const t = new Date(); const todayKey = t.toDateString();
      grid.innerHTML = '<div class="cal-week">' + days.map((d, i) => {
        const today = d.toDateString() === todayKey;
        const evs = evForDate(d);
        const evHtml = evs.map((e) => `<a class="cal-wev" href="${esc(e.link)}" target="_blank" rel="noopener" title="${esc(e.label)}"${e.color ? ` style="background:${esc(e.color)}22;border-color:${esc(e.color)}55;color:${esc(e.color)}"` : ""}>${esc(e.label)}</a>`).join("");
        const date = d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
        return `<div class="cal-wday${today ? " today" : ""}" data-date="${date}">
            <div class="wd-h">${lbls[i]}<b class="tnum">${d.getDate()}</b></div>
            <div class="wd-evs">${evHtml}</div>
          </div>`;
      }).join("") + "</div>";
    }

    function paint() {
      setWeekdaysHeader();
      if (view === "week") renderWeek(weekAnchor); else renderMonth(calY, calM);
    }

    async function apiGet(url, tok) {
      const r = await fetch(url, { headers: { Authorization: "Bearer " + tok } });
      if (r.status === 401) { dropToken(tok); throw new Error("401"); }
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }

    async function ensureCalendarList(tok) {
      if (calendars) return calendars;
      const j = await apiGet("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250", tok);
      const list = (j.items || []).map((c) => ({ id: c.id, summary: c.summaryOverride || c.summary || c.id, color: c.backgroundColor || "" }));
      const order = CFG.get("agenda", "calendarOrder", []) || [];
      list.sort((a, b) => {
        const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
        if (ia === -1 && ib === -1) return 0;
        if (ia === -1) return 1; if (ib === -1) return -1;
        return ia - ib;
      });
      calendars = list;
      return calendars;
    }
    function visibleCalendars() { return (calendars || []).filter((c) => hiddenCalendars.indexOf(c.id) === -1); }
    function calIndex(id) { return Math.max(0, (calendars || []).findIndex((c) => c.id === id)); }
    function saveCalendarOrder() { CFG.set("agenda", "calendarOrder", (calendars || []).map((c) => c.id)); }

    async function fetchMonth(y, m, interactive) {
      const key = y + "-" + m;
      if (monthCache[key]) return;
      const tok = await getToken(interactive);
      connected = true;
      await ensureCalendarList(tok);
      const timeMin = new Date(y, m, 1).toISOString();
      const timeMax = new Date(y, m + 1, 1).toISOString();
      const bucket = {};
      await Promise.all(visibleCalendars().map(async (cal) => {
        const url = "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(cal.id) + "/events"
          + "?singleEvents=true&orderBy=startTime&maxResults=100"
          + "&timeMin=" + encodeURIComponent(timeMin) + "&timeMax=" + encodeURIComponent(timeMax);
        let j;
        try { j = await apiGet(url, tok); } catch (e) { console.warn("[agenda] calendar", cal.id, e); return; }
        (j.items || []).forEach((ev) => {
          const s = ev.start || {}, e2 = ev.end || {};
          const title = ev.summary || "(sans titre)";
          const attendees = (ev.attendees || []).filter((a) => !a.resource).map((a) => ({ name: a.displayName || a.email, status: a.responseStatus, self: !!a.self }));
          const addDay = (day, label, allDay, start, end, multi) => {
            (bucket[day] = bucket[day] || []).push({
              label, link: ev.htmlLink || "https://calendar.google.com", allDay, color: cal.color,
              title, location: ev.location || "", attendees, start, end, calendar: cal.summary, calendarId: cal.id, multi,
            });
          };
          if (s.dateTime) {
            const d = new Date(s.dateTime), end = e2.dateTime ? new Date(e2.dateTime) : null;
            addDay(d.getDate(), title + " · " + frTime(d), false, d, end, false);
          } else if (s.date) {
            // évènement « journée entière » — peut s'étaler sur plusieurs jours (fin exclusive côté Google).
            const startDate = new Date(s.date + "T00:00:00");
            const endDate = e2.date ? new Date(e2.date + "T00:00:00") : new Date(startDate.getTime() + 86400000);
            const multi = (endDate - startDate) > 86400000;
            for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
              if (d.getFullYear() === y && d.getMonth() === m) addDay(d.getDate(), title, true, null, null, multi);
            }
          }
        });
      }));
      // ordre déterministe (l'appel parallèle ci-dessus ne garantit pas l'ordre d'arrivée) :
      // priorité d'agenda (réglages) d'abord, puis journée entière avant les horaires, puis heure.
      Object.keys(bucket).forEach((day) => {
        bucket[day].sort((a, b) => {
          const ia = calIndex(a.calendarId), ib = calIndex(b.calendarId);
          if (ia !== ib) return ia - ib;
          if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
          if (a.start && b.start) return a.start - b.start;
          return 0;
        });
      });
      monthCache[key] = bucket;
    }

    // mois à charger pour la vue courante (1 pour mois, 1–2 pour semaine à cheval)
    function neededMonths() {
      if (view === "month") return [[calY, calM]];
      const ds = weekDays(weekAnchor), set = {};
      ds.forEach((d) => { set[d.getFullYear() + "-" + d.getMonth()] = [d.getFullYear(), d.getMonth()]; });
      return Object.keys(set).map((k) => set[k]);
    }

    function setConnectPill(show) {
      const head = card.querySelector(".head-right");
      let pill = head && head.querySelector(".cal-connect");
      if (show && head && !pill) {
        pill = document.createElement("button");
        pill.type = "button"; pill.className = "btn cal-connect"; pill.textContent = "Connecter";
        pill.addEventListener("click", () => { load(true).then(() => pill.remove()).catch((e) => console.warn("[agenda] connect", e)); });
        head.insertBefore(pill, head.firstChild);
      } else if (!show && pill) { pill.remove(); }
    }

    async function load(interactive) {
      try {
        await Promise.all(neededMonths().map(([y, m]) => fetchMonth(y, m, interactive)));
        paint();
        setConnectPill(false);
      } catch (e) {
        paint();                          // grille vide (aujourd'hui surligné)
        if (!connected) setConnectPill(true);
        if (String(e.message) === "401") { Object.keys(monthCache).forEach((k) => delete monthCache[k]); }
        console.warn("[agenda]", e);
      }
    }

    function navigate(dir) {
      if (view === "week") { weekAnchor = new Date(weekAnchor); weekAnchor.setDate(weekAnchor.getDate() + dir * 7); }
      else { calM += dir; if (calM < 0) { calM = 11; calY--; } if (calM > 11) { calM = 0; calY++; } }
      paint();
      if (connected) load(false);
    }

    function openSettings() {
      Settings.open("Agenda", [
        { type: "segmented", label: "Vue", value: view,
          options: [{ v: "month", t: "Mois" }, { v: "week", t: "Semaine" }],
          onChange: (v) => { view = v; CFG.set("agenda", "view", v); paint(); if (connected) load(false); } },
        { type: "segmented", label: "Début de semaine", value: weekStart,
          options: [{ v: "mon", t: "Lundi" }, { v: "sun", t: "Dimanche" }],
          onChange: (v) => { weekStart = v; CFG.set("agenda", "weekStart", v); paint(); } },
        { type: "toggle", label: "Afficher les événements « journée entière »", value: showAllDay,
          onChange: (v) => { showAllDay = v; CFG.set("agenda", "allDay", v); paint(); } },
        calendars && calendars.length > 1
          ? { type: "list", label: "Agendas affichés", sub: "Ordre de priorité — décide quels agendas survivent au « +N » dans la grille.",
              items: calendars.map((c) => ({ id: c.id, label: c.summary, hidden: hiddenCalendars.indexOf(c.id) !== -1 })),
              move: (from, to) => {
                const x = calendars.splice(from, 1)[0]; calendars.splice(to, 0, x);
                saveCalendarOrder();
                Object.keys(monthCache).forEach((k) => delete monthCache[k]);
                paint(); load(false);
              },
              onToggle: (it) => {
                it.hidden = !it.hidden;
                const idx = hiddenCalendars.indexOf(it.id);
                if (idx === -1) hiddenCalendars.push(it.id); else hiddenCalendars.splice(idx, 1);
                CFG.set("agenda", "hiddenCalendars", hiddenCalendars);
                Object.keys(monthCache).forEach((k) => delete monthCache[k]);
                paint(); load(false);
              } }
          : null,
        { type: "button", label: connected ? "Reconnecter Google Agenda" : "Connecter Google Agenda", primary: !connected,
          onClick: () => { Settings.close(); load(true).catch((e) => console.warn("[agenda] connect", e)); } },
      ]);
    }

    // init
    const n = new Date(); calY = n.getFullYear(); calM = n.getMonth(); weekAnchor = new Date(n);
    paint();
    load(false);

    $$(".cal-nav").forEach((b) => b.addEventListener("click", () => navigate(parseInt(b.dataset.cal, 10))));

    // la roue de réglages = le .gear injecté (les flèches ‹ › portent .gear.cal-nav)
    const gear = card.querySelector(".head-right .gear:not(.cal-nav)");
    if (gear) { gear.setAttribute("aria-label", "Réglages de l'agenda"); gear.addEventListener("click", openSettings); }

    // clic jour → pop-up détail des évènements ; clic évènement (chip) → son lien direct
    const STATUS = { accepted: "✓ Présent", declined: "✗ Décliné", tentative: "? Peut-être", needsAction: "En attente" };
    function dayDetailHtml(dateStr) {
      const [y, m, dn] = dateStr.split("-").map((x) => parseInt(x, 10));
      const key = y + "-" + (m - 1);
      let evs = (monthCache[key] || {})[dn] || [];
      if (!showAllDay) evs = evs.filter((e) => !e.allDay);
      // déjà trié par priorité d'agenda (voir fetchMonth) — on conserve cet ordre ici.
      if (!evs.length) return '<div class="dd-list"><div class="empty">Aucun évènement ce jour-là.</div></div>';
      return '<div class="dd-list">' + evs.map((e) => {
        const time = e.allDay ? (e.multi ? "Toute la journée · plusieurs jours" : "Toute la journée") : (e.start ? frTime(e.start) + (e.end ? " – " + frTime(e.end) : "") : "");
        const attendeesHtml = e.attendees && e.attendees.length
          ? '<div class="dd-attendees">' + e.attendees.map((a) => `<span class="dd-att${a.self ? " self" : ""}" title="${esc(STATUS[a.status] || "")}">${esc(a.name)}</span>`).join("") + '</div>' : "";
        return `<a class="dd-ev" href="${esc(e.link)}" target="_blank" rel="noopener"${e.color ? ` style="border-left-color:${esc(e.color)}"` : ""}>
          <div class="dd-time">${esc(time)}</div>
          <div class="dd-title">${esc(e.title)}</div>
          ${e.location ? `<div class="dd-loc">${SVGI.pin}${esc(e.location)}</div>` : ""}
          ${attendeesHtml}
          <div class="dd-cal">${esc(e.calendar)}</div>
        </a>`;
      }).join("") + '</div>';
    }
    grid.addEventListener("click", (e) => {
      const day = e.target.closest("[data-date]");
      if (!day) return;
      const chip = e.target.closest("a.cal-ev, a.cal-wev");
      if (chip) e.preventDefault();   // une chip d'évènement ouvre aussi le détail du jour, pas son lien direct
      const [y, m, dn] = day.dataset.date.split("-").map((x) => parseInt(x, 10));
      const lbl = new Intl.DateTimeFormat(LOCALE(), { weekday: "long", day: "numeric", month: "long" }).format(new Date(y, m - 1, dn));
      const gcalLink = `<a class="dd-gcal" href="https://calendar.google.com/calendar/r/day/${y}/${m}/${dn}" target="_blank" rel="noopener" aria-label="Voir la journée sur Google Agenda">${SVGI.extLink}</a>`;
      Router.open(lbl, dayDetailHtml(day.dataset.date), null, "day-panel", gcalLink);
    });

    // clic ailleurs sur la carte → vue mois aujourd'hui
    if (card) card.addEventListener("click", (e) => {
      if (e.target.closest("a, button, [data-date]")) return;
      const t = new Date();
      window.open("https://calendar.google.com/calendar/r/month/" + t.getFullYear() + "/" + (t.getMonth() + 1) + "/" + t.getDate(), "_blank", "noopener");
    });
  });

  /* ============================================================
     BOURSE — Yahoo Finance chart API (no key) + static fallback
     ============================================================ */
  function spark(data, dir) {
    const w = 74, h = 30, pad = 3, lo = Math.min(...data), hi = Math.max(...data), rng = (hi - lo) || 1;
    const pts = data.map((v, i) => {
      const x = pad + (i * (w - 2 * pad)) / (data.length - 1);
      const y = h - pad - ((v - lo) / rng) * (h - 2 * pad);
      return x.toFixed(1) + "," + y.toFixed(1);
    });
    const col = dir === "up" ? "var(--up)" : "var(--down)";
    const fill = dir === "up" ? "rgba(95,208,160,.13)" : "rgba(240,122,122,.13)";
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <polyline points="${pad},${h} ${pts.join(" ")} ${w - pad},${h}" fill="${fill}" stroke="none"/>
      <polyline points="${pts.join(" ")}" fill="none" stroke="${col}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>`;
  }
  CFG.ready(function stocks() {
    const host = $("#stocks"); if (!host) return;
    const fr = (n, dec) => new Intl.NumberFormat(LOCALE(), { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
    const DEFAULT_WATCH = [
      { sym: "^FCHI", name: "CAC 40" },
      { sym: "CW8.PA", name: "MSCI World" },
      { sym: "BTC-EUR", name: "Bitcoin" },
      { sym: "ETH-EUR", name: "Ethereum" },
      { sym: "^GSPC", name: "S&P 500" },
      { sym: "GOOGL", name: "Alphabet" },
    ];
    const placeholder = '<svg class="spark" viewBox="0 0 74 30" aria-hidden="true"></svg>';
    const PERIODS = {
      "1d": { range: "1d", interval: "15m", label: "1 j" },
      "7d": { range: "5d", interval: "60m", label: "7 j" },
      "30d": { range: "1mo", interval: "1d", label: "30 j" },
      "1y": { range: "1y", interval: "1wk", label: "1 an" },
    };
    const SYM = { USD: " $", EUR: " €", GBP: " £", JPY: " ¥", CHF: " CHF", CAD: " $", AUD: " $", GBp: " p" };
    let watch = [];
    let currency = CFG.get("stocks", "currency", "usd");   // usd | eur | gbp | orig
    let period = CFG.get("stocks", "period", "7d");

    // taux de change Yahoo, caché par paire "FROM>TO"
    const rateCache = {};
    async function fetchRate(from, to) {
      if (!from || from === to) return 1;
      const key = from + ">" + to;
      if (rateCache[key] != null) return rateCache[key];
      try {
        const url = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(from + to + "=X") + "?range=1d&interval=1d";
        const r = await fetch(url, { credentials: "omit" });
        const j = await r.json();
        const res = j && j.chart && j.chart.result && j.chart.result[0];
        rateCache[key] = (res && res.meta && res.meta.regularMarketPrice) || 1;
      } catch (e) { rateCache[key] = 1; }
      return rateCache[key];
    }

    function metaEl() { const c = host.closest(".card"); return c && c.querySelector(".head-right .meta"); }
    const rowHtml = (s, idx) => `
        <div class="row" data-idx="${idx}">
          <div class="name">${escHtml(s.name || s.sym)}<small>${escHtml(s.sub || s.sym)}</small></div>
          ${placeholder}
          <div class="right"><div class="price tnum">—</div><div class="chg tnum"></div></div>
        </div>`;
    const addRowHtml = '<button type="button" class="stk-addrow">+ Ajouter une valeur</button>';
    const pager = makePager(host.closest(".card"), host, {
      pageSize: 4,
      renderSlice: (slice, p) => slice.map((s, i) => s.__add ? addRowHtml : rowHtml(s, p * 4 + i)).join(""),
      afterRender: (pg, slice, p) => {
        slice.forEach((s, i) => { if (!s.__add) updateRow(s, p * 4 + i); });
        const ab = pg.querySelector(".stk-addrow"); if (ab) ab.addEventListener("click", openModal);
      },
    });
    function render() {
      const me = metaEl(); if (me) me.textContent = PERIODS[period].label + " · cours";
      pager.set(watch.concat([{ __add: true }]));   // « + Ajouter » en dernière position
    }
    function save() { dbSet({ watchlist: watch }); }

    async function fetchQuote(sym) {
      const P = PERIODS[period];
      const url = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(sym) + "?range=" + P.range + "&interval=" + P.interval;
      const r = await fetch(url, { credentials: "omit" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      const res = j && j.chart && j.chart.result && j.chart.result[0];
      if (!res) throw new Error("no result");
      const meta = res.meta;
      const closes = ((res.indicators.quote[0] || {}).close || []).filter((v) => v != null);
      const price = meta.regularMarketPrice != null ? meta.regularMarketPrice : closes[closes.length - 1];
      if (price == null) throw new Error("no price");
      const base = closes.length ? closes[0] : (meta.chartPreviousClose || price);
      return {
        price, pct: base ? ((price - base) / base) * 100 : 0,
        dec: meta.priceHint != null ? Math.min(meta.priceHint, 4) : 2,
        currency: meta.currency || "USD",
        series: closes.slice(-30), exch: meta.fullExchangeName || meta.exchangeName || sym,
      };
    }
    async function updateRow(s, idx) {
      const row = host.querySelector(`.row[data-idx="${idx}"]`);
      if (!row) return;
      try {
        const q = await fetchQuote(s.sym);
        const dir = q.pct >= 0 ? "up" : "down";
        if (!s.sub) row.querySelector(".name small").textContent = q.exch;
        if (q.series.length >= 2) row.querySelector(".spark").outerHTML = spark(q.series, dir);
        let price = q.price, cur = q.currency;
        if (cur === "GBp") { price /= 100; cur = "GBP"; }   // pence → livres avant conversion
        let suf;
        if (currency === "orig") { suf = SYM[q.currency] || (" " + q.currency); }
        else { const tgt = currency.toUpperCase(); price *= await fetchRate(cur, tgt); suf = SYM[tgt] || (" " + tgt); }
        row.querySelector(".price").textContent = fr(price, q.dec) + suf;
        const chg = row.querySelector(".chg");
        chg.textContent = (q.pct >= 0 ? "+" : "−") + fr(Math.abs(q.pct), 2) + " %";
        chg.className = "chg tnum " + dir;
      } catch (e) {
        const chg = row.querySelector(".chg");
        if (chg) { chg.textContent = "indispo"; chg.className = "chg tnum"; }
      }
    }

    // add-stock modal (réutilisé par le panneau)
    const modal = $("#stkModal"), symEl = $("#stkSym"), nameEl = $("#stkName");
    function openModal() { if (!modal) return; symEl.value = ""; nameEl.value = ""; modal.classList.add("open"); setTimeout(() => symEl.focus(), 30); }
    function closeModal() { modal && modal.classList.remove("open"); }
    function commit() {
      const sym = symEl.value.trim();
      if (!sym) return closeModal();
      watch.push({ sym, name: nameEl.value.trim() || sym });
      save(); render(); closeModal();
    }
    if (modal) {
      $("#stkSave").addEventListener("click", commit);
      $("#stkCancel").addEventListener("click", closeModal);
      modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
      symEl.addEventListener("keydown", (e) => { if (e.key === "Enter") nameEl.focus(); });
      nameEl.addEventListener("keydown", (e) => { if (e.key === "Enter") commit(); });
    }

    function openSettings() {
      Settings.open("Bourse", [
        { type: "segmented", label: "Devise d'affichage", value: currency,
          options: [{ v: "usd", t: "$" }, { v: "eur", t: "€" }, { v: "gbp", t: "£" }, { v: "orig", t: "Origine" }],
          onChange: (v) => { currency = v; CFG.set("stocks", "currency", v); render(); } },
        { type: "segmented", label: "Période", value: period,
          options: [{ v: "1d", t: "1J" }, { v: "7d", t: "7J" }, { v: "30d", t: "30J" }, { v: "1y", t: "1A" }],
          onChange: (v) => { period = v; CFG.set("stocks", "period", v); render(); } },
        { type: "list", label: "Valeurs suivies",
          items: watch.map((s) => ({ label: s.name || s.sym, sub: s.sym })),
          move: (from, to) => { const x = watch.splice(from, 1)[0]; watch.splice(to, 0, x); save(); render(); },
          onRemove: (it, i) => { watch.splice(i, 1); save(); render(); },
          addLabel: "+ Ajouter une valeur", onAdd: () => { Settings.close(); openModal(); } },
        { type: "info", text: "Symboles Yahoo Finance (ex. AAPL, ^GSPC, GOOGL, BTC-EUR, ESE.PA)." },
      ]);
    }
    const gear = host.closest(".card") && host.closest(".card").querySelector(".head-right .gear");
    if (gear) { gear.setAttribute("aria-label", "Réglages de la bourse"); gear.addEventListener("click", openSettings); }

    if (SYNC) {
      dbGet({ watchlist: null }, (r) => {
        watch = Array.isArray(r.watchlist) ? r.watchlist : DEFAULT_WATCH.slice();
        if (!Array.isArray(r.watchlist)) save();
        render();
      });
    } else { watch = DEFAULT_WATCH.slice(); render(); }
  });

  /* ============================================================
     MÉTÉO — Open-Meteo, géolocalisée (repli Dijon)
     ============================================================ */
  CFG.ready(function weather() {
    // code WMO → [clé d'icône, clé i18n de libellé]
    const WMO = {
      0: ["sun", "wmo.clear"], 1: ["suncloud", "wmo.mclear"], 2: ["suncloud", "wmo.pcloudy"], 3: ["cloud", "wmo.overcast"],
      45: ["fog", "wmo.fog"], 48: ["fog", "wmo.rfog"],
      51: ["drizzle", "wmo.ldrizzle"], 53: ["drizzle", "wmo.drizzle"], 55: ["drizzle", "wmo.hdrizzle"],
      56: ["sleet", "wmo.fdrizzle"], 57: ["sleet", "wmo.fdrizzle"],
      61: ["rain", "wmo.lrain"], 63: ["rain", "wmo.rain"], 65: ["rain", "wmo.hrain"],
      66: ["sleet", "wmo.frain"], 67: ["sleet", "wmo.frain"],
      71: ["snow", "wmo.lsnow"], 73: ["snow", "wmo.snow"], 75: ["snow", "wmo.hsnow"], 77: ["snow", "wmo.snowgrains"],
      80: ["showers", "wmo.showers"], 81: ["showers", "wmo.showers"], 82: ["showers", "wmo.hshowers"],
      85: ["snow", "wmo.snowshowers"], 86: ["snow", "wmo.snowshowers"],
      95: ["thunder", "wmo.thunder"], 96: ["thunder", "wmo.thunderhail"], 99: ["thunder", "wmo.thunderhail"],
    };
    const WK = ["wd.sun", "wd.mon", "wd.tue", "wd.wed", "wd.thu", "wd.fri", "wd.sat"];
    const wmo = (c) => WMO[c] || ["cloud", "—"];

    // jeu d'icônes météo SVG maison (échelle 1em → suit la taille du conteneur). Variantes nuit gérées via wxIcon().
    const P = {
      cloud: "<path d='M9 24h13.2a4.6 4.6 0 0 0 .3-9.2A6.4 6.4 0 0 0 9.6 13.4 4.4 4.4 0 0 0 9 24Z' fill='#e7e8ee'/>",
      cloudHi: "<path d='M9 22h13.2a4.6 4.6 0 0 0 .3-9.2A6.4 6.4 0 0 0 9.6 11.4 4.4 4.4 0 0 0 9 22Z' fill='#e7e8ee'/>",
      cloudDark: "<path d='M9 22h13.2a4.6 4.6 0 0 0 .3-9.2A6.4 6.4 0 0 0 9.6 11.4 4.4 4.4 0 0 0 9 22Z' fill='#bfc2cc'/>",
      sun: "<g stroke='#f4b740' stroke-width='2.2' stroke-linecap='round'><path d='M16 4v3M16 25v3M4 16h3M25 16h3M7.5 7.5l2.1 2.1M22.4 22.4l2.1 2.1M24.5 7.5l-2.1 2.1M9.6 22.4l-2.1 2.1'/></g><circle cx='16' cy='16' r='6.2' fill='#f7c948'/>",
      smallSun: "<g stroke='#f4b740' stroke-width='1.8' stroke-linecap='round'><path d='M21 3.5v2.1M28 7.7l-1.5 1.5M29.5 14.5h-2.1M14 7.7l1.5 1.5'/></g><circle cx='21' cy='10.5' r='4.2' fill='#f7c948'/>",
      moon: "<path d='M21.5 4.5a8 8 0 1 0 6.4 12.8A6.4 6.4 0 0 1 21.5 4.5Z' fill='#f4d36b'/>",
      smallMoon: "<path d='M22.5 4a6.4 6.4 0 1 0 5.2 10.2A5.1 5.1 0 0 1 22.5 4Z' fill='#f4d36b'/>",
      rain: "<g stroke='#5b9be0' stroke-width='2' stroke-linecap='round'><path d='M11 25l-1.6 3.5M16 25l-1.6 3.5M21 25l-1.6 3.5'/></g>",
      drizzle: "<g fill='#5b9be0'><circle cx='11.5' cy='26.5' r='1.2'/><circle cx='16' cy='28' r='1.2'/><circle cx='20.5' cy='26.5' r='1.2'/></g>",
      snow: "<g fill='#dbe6f2'><circle cx='11.5' cy='26.5' r='1.5'/><circle cx='16' cy='28.2' r='1.5'/><circle cx='20.5' cy='26.5' r='1.5'/></g>",
      bolt: "<path d='M16.5 23l-3.5 5.5h3l-1.5 4 5.5-6.5h-3l1.5-3z' fill='#f4c430'/>",
      fog: "<g stroke='#b7b2a6' stroke-width='2' stroke-linecap='round'><path d='M8 25.5h15M10 28.5h12'/></g>",
      sleet: "<g stroke='#5b9be0' stroke-width='2' stroke-linecap='round'><path d='M12 25l-1.5 3'/></g><circle cx='19' cy='27' r='1.4' fill='#dbe6f2'/>",
    };
    const ICON = {
      sun: P.sun, moon: P.moon, cloud: P.cloudDark,
      suncloud: P.smallSun + P.cloud, mooncloud: P.smallMoon + P.cloud,
      rain: P.cloudHi + P.rain, drizzle: P.cloudHi + P.drizzle, snow: P.cloudHi + P.snow,
      thunder: P.cloudDark + P.bolt, showers: P.smallSun + P.cloud + P.rain,
      fog: P.cloudHi + P.fog, sleet: P.cloudHi + P.sleet,
    };
    const NIGHT = { sun: "moon", suncloud: "mooncloud", showers: "rain" };  // variantes de nuit
    function wxIcon(key, night) {
      const k = (night && NIGHT[key]) ? NIGHT[key] : key;
      return "<svg viewBox='0 0 32 32' width='1em' height='1em' aria-hidden='true'>" + (ICON[k] || ICON.cloud) + "</svg>";
    }
    const DIJON = { lat: 47.32, lon: 5.04, label: "Dijon" };
    const daysEl = $("#wxDays");

    // config
    let unit = CFG.get("weather", "unit", "c");          // c | f
    let windU = CFG.get("weather", "wind", "kmh");        // kmh | ms | mph
    let useGeo = CFG.get("weather", "geo", true);
    let place = CFG.get("weather", "place", null);        // { lat, lon, label }
    let nDays = CFG.get("weather", "days", 4);            // 3..6
    const WINDLBL = { kmh: "km/h", ms: "m/s", mph: "mph" };
    const tunit = () => (unit === "f" ? "fahrenheit" : "celsius");

    function load(lat, lon, label) {
      const url = "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon +
        "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day" +
        "&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=" + (nDays + 1) +
        "&temperature_unit=" + tunit() + "&wind_speed_unit=" + windU;
      fetch(url)
        .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then((j) => {
          const cur = j.current, d = j.daily;
          const [key, lbl] = wmo(cur.weather_code);
          $("#wxTemp").textContent = Math.round(cur.temperature_2m) + "°";
          $("#wxCond").textContent = t(lbl);
          $("#wxSub").textContent = t("wx.feels") + " " + Math.round(cur.apparent_temperature) + "° · " + t("wx.wind") + " " + Math.round(cur.wind_speed_10m) + " " + WINDLBL[windU];
          const wxG = $("#wxGlyph"); if (wxG) wxG.innerHTML = wxIcon(key, cur.is_day === 0);   // icône SVG (variante nuit si is_day=0)
          const loc = $("#wxLoc"); if (loc && label) loc.textContent = label + " · " + t("wx.now");
          let html = "";
          for (let i = 1; i <= nDays && i < d.time.length; i++) {
            const dt = new Date(d.time[i] + "T00:00:00");
            const [g] = wmo(d.weather_code[i]);
            html += `<div class="wx-day"><div class="d">${t(WK[dt.getDay()])}</div><div class="g">${wxIcon(g, false)}</div>
              <div class="t tnum"><b>${Math.round(d.temperature_2m_max[i])}°</b> <span>${Math.round(d.temperature_2m_min[i])}°</span></div></div>`;
          }
          if (html && daysEl) { daysEl.style.gridTemplateColumns = "repeat(" + nDays + ",1fr)"; daysEl.innerHTML = html; }
        })
        .catch((e) => { console.warn("[weather]", e); /* keep design fallback */ });
    }

    function reload() {
      if (!useGeo && place) { load(place.lat, place.lon, place.label); return; }
      if (useGeo && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => load(pos.coords.latitude.toFixed(3), pos.coords.longitude.toFixed(3), "Ma position"),
          () => load(DIJON.lat, DIJON.lon, DIJON.label),
          { timeout: 6000, maximumAge: 600000 }
        );
      } else { load(DIJON.lat, DIJON.lon, DIJON.label); }
    }

    function openSettings() {
      Settings.open("Météo", [
        { type: "segmented", label: "Température", value: unit,
          options: [{ v: "c", t: "°C" }, { v: "f", t: "°F" }],
          onChange: (v) => { unit = v; CFG.set("weather", "unit", v); reload(); } },
        { type: "segmented", label: "Vent", value: windU,
          options: [{ v: "kmh", t: "km/h" }, { v: "ms", t: "m/s" }, { v: "mph", t: "mph" }],
          onChange: (v) => { windU = v; CFG.set("weather", "wind", v); reload(); } },
        { type: "toggle", label: "Géolocalisation automatique", sub: "Sinon, utilise la ville ci-dessous", value: useGeo,
          onChange: (v) => { useGeo = v; CFG.set("weather", "geo", v); reload(); } },
        { type: "city", label: "Ville", placeholder: "Ville ou code postal", value: place ? place.label : "",
          onPick: (p) => { place = { lat: p.lat, lon: p.lon, label: p.name }; useGeo = false; CFG.set("weather", "place", place); CFG.set("weather", "geo", false); reload(); } },
        { type: "stepper", label: "Jours de prévision", value: nDays, min: 3, max: 6,
          onChange: (v) => { nDays = v; CFG.set("weather", "days", v); reload(); } },
      ]);
    }
    const gear = (daysEl && daysEl.closest(".card") && daysEl.closest(".card").querySelector(".head-right .gear")) || null;
    if (gear) { gear.setAttribute("aria-label", "Réglages de la météo"); gear.addEventListener("click", openSettings); }

    reload();
  });

  /* ============================================================
     ACTUALITÉS — Google News RSS, par thèmes (configurables)
     Aucune API "perso" Google n'existe ; on cible des thèmes/recherches.
     Vide => "À la une" FR. Sinon => recherche RSS par thème, fusionnée.
     ============================================================ */
  CFG.ready(function news() {
    const host = $("#news"); if (!host) return;
    const esc = escHtml;
    let count = CFG.get("news", "count", 8);
    const rel = (date) => {
      const m = Math.round((Date.now() - date.getTime()) / 60000);
      if (isNaN(m)) return "";
      if (m < 1) return "à l'instant";
      if (m < 60) return "il y a " + m + " min";
      const h = Math.round(m / 60);
      if (h < 24) return "il y a " + h + " h";
      return "il y a " + Math.round(h / 24) + " j";
    };
    const TOP = "https://news.google.com/rss?hl=fr&gl=FR&ceid=FR:fr";
    const search = (q) => "https://news.google.com/rss/search?q=" + encodeURIComponent(q) + "&hl=fr&gl=FR&ceid=FR:fr";

    function parse(txt) {
      const doc = new DOMParser().parseFromString(txt, "text/xml");
      return Array.from(doc.querySelectorAll("item")).map((it) => {
        const link = (it.querySelector("link") || {}).textContent || "#";
        const src = (it.querySelector("source") || {}).textContent || "";
        let title = (it.querySelector("title") || {}).textContent || "";
        if (src && title.endsWith(" - " + src)) title = title.slice(0, -(" - " + src).length);
        const pub = it.querySelector("pubDate");
        return { link, src, title, ts: pub ? new Date(pub.textContent).getTime() : 0 };
      });
    }
    const getFeed = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); }).then(parse);

    let lastItems = [];
    const newsItemHtml = (it) => {
      const when = it.ts ? rel(new Date(it.ts)) : "";
      return `<a class="news-item" href="${esc(it.link)}" target="_blank" rel="noopener">
          <div class="t">${esc(it.title)}</div>
          <div class="m">${it.src ? "<b>" + esc(it.src) + "</b>" : ""}${it.src && when ? " · " : ""}${when}</div>
        </a>`;
    };
    const pager = makePager(host.closest(".card"), host, {
      pageSize: () => count,
      renderSlice: (slice) => slice.map(newsItemHtml).join(""),
    });
    function paint(items) {
      if (items) lastItems = items;
      if (!lastItems.length) { pager.message('<div class="empty">Actualités indisponibles.</div>'); return; }
      pager.set(lastItems.slice(0, 24));   // pagination par tranches de "count"
    }

    function loadTopics(topics) {
      let p;
      if (!topics || !topics.length) {
        p = getFeed(TOP);
      } else {
        p = Promise.allSettled(topics.slice(0, 6).map((t) => getFeed(search(t)))).then((rs) => {
          const seen = new Set();
          const merged = [];
          // round-robin first items from each topic, then by recency
          rs.forEach((r) => { if (r.status === "fulfilled") r.value.slice(0, 4).forEach((it) => { const k = it.link || it.title; if (!seen.has(k)) { seen.add(k); merged.push(it); } }); });
          merged.sort((a, b) => b.ts - a.ts);
          if (!merged.length) throw new Error("empty");
          return merged;
        });
      }
      p.then(paint).catch((e) => {
        console.warn("[news]", e);
        if (!lastItems.length) pager.message('<div class="empty">Actualités indisponibles.</div>');
      });
    }

    // réglages (roue crantée)
    let current = [];
    function applyTopics(topics) {
      current = topics;
      dbSet({ newsTopics: topics });
      loadTopics(topics);
    }
    function openSettings() {
      Settings.open("Actualités", [
        { type: "text", label: "Centres d'intérêt", sub: "Séparés par des virgules. Vide = « À la une » France.",
          placeholder: "intelligence artificielle, Dijon, Formule 1", value: current.join(", "),
          onChange: (val) => applyTopics(val.split(",").map((s) => s.trim()).filter(Boolean)) },
        { type: "stepper", label: "Nombre d'articles", value: count, min: 3, max: 12,
          onChange: (v) => { count = v; CFG.set("news", "count", v); if (lastItems.length) paint(); } },
      ]);
    }
    const sec = host.closest(".card");
    const gear = sec && sec.querySelector(".head-right .gear");
    if (gear) { gear.setAttribute("aria-label", "Réglages des actualités"); gear.addEventListener("click", openSettings); }

    if (SYNC) {
      dbGet({ newsTopics: [] }, (r) => { current = Array.isArray(r.newsTopics) ? r.newsTopics : []; loadTopics(current); });
    } else { loadTopics([]); }
  });

  /* ============================================================
     RÉCEMMENT CONSULTÉES — chrome.history
     ============================================================ */
  CFG.ready(function recent() {
    const host = $("#recent"); if (!host) return;
    if (!(hasChrome && chrome.history)) { host.innerHTML = '<div class="empty">Historique indisponible.</div>'; return; }
    const hm = (ts) => new Intl.DateTimeFormat(LOCALE(), { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ts));
    let count = CFG.get("recent", "count", 5);
    let showTime = CFG.get("recent", "time", true);
    let excludes = CFG.get("recent", "exclude", []);    // domaines à masquer

    const recentHtml = (it) => {
      const dom = domainOf(it.url);
      const title = it.title || dom;
      const letter = dom.charAt(0).toUpperCase();
      const fav = faviconUrl(it.url, 32);
      const favHtml = fav ? `<img src="${fav}" alt="" data-fb="${escHtml(letter)}">` : escHtml(letter);
      return `<a class="recent" href="${escHtml(it.url)}">
          <span class="fav">${favHtml}</span>
          <span class="info"><span class="rt">${escHtml(title)}</span><span class="rd">${escHtml(dom)}</span></span>
          ${showTime ? `<span class="rtime tnum">${hm(it.lastVisitTime)}</span>` : ""}
        </a>`;
    };
    const pager = makePager(host.closest(".card"), host, {
      pageSize: () => count,
      renderSlice: (slice) => slice.map(recentHtml).join(""),
      afterRender: (pg) => wireImgFallback(pg),
    });
    function render() {
      // on récupère plusieurs pages d'historique puis on filtre les domaines exclus
      chrome.history.search({ text: "", maxResults: Math.max(count * 6, 40), startTime: 0 }, (items) => {
        const list = (items || []).filter((it) => { const d = domainOf(it.url); return !excludes.some((x) => d === x || d.endsWith("." + x)); });
        if (!list.length) { pager.message('<div class="empty">Aucun historique récent.</div>'); return; }
        pager.set(list);
      });
    }

    function openSettings() {
      Settings.open("Récemment consultées", [
        { type: "stepper", label: "Nombre d'éléments", value: count, min: 3, max: 12,
          onChange: (v) => { count = v; CFG.set("recent", "count", v); render(); } },
        { type: "toggle", label: "Afficher l'heure", value: showTime,
          onChange: (v) => { showTime = v; CFG.set("recent", "time", v); render(); } },
        { type: "text", label: "Domaines exclus", sub: "Séparés par des virgules (ex. mail.google.com, youtube.com)",
          value: excludes.join(", "),
          onChange: (val) => { excludes = val.split(",").map((s) => s.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "")).filter(Boolean); CFG.set("recent", "exclude", excludes); render(); } },
      ]);
    }
    const gear = host.closest(".card") && host.closest(".card").querySelector(".head-right .gear");
    if (gear) { gear.setAttribute("aria-label", "Réglages de l'historique"); gear.addEventListener("click", openSettings); }

    render();
  });

  /* ============================================================
     CS2 — ELO Premier + ratings (proxy Leetify naerod-api, LAN)
     ============================================================ */
  CFG.ready(function cs2() {
    const host = $("#cs2"); if (!host) return;
    let premier = null, faceit = null, faceitState = "idle";   // idle | loading | error
    let premierState = "idle";                                 // idle | loading | error
    let mode = CFG.get("cs2", "mode", "premier");              // premier | faceit | both
    let faceitNick = CFG.get("cs2", "nick", "");
    let steamId = CFG.get("cs2", "steam", "");                 // SteamID64 (17 chiffres) du joueur
    const nf = (n) => Number(n).toLocaleString(LOCALE());
    const stat = (l, v) => (v != null ? `<div class="cs2-stat"><span>${l}</span><b>${v}</b></div>` : "");
    const titleMeta = (txt) => { const nm = $("#cs2Name"); if (nm) nm.textContent = txt || ""; };

    function premierBlock(d) {
      return `<div class="cs2-elo tnum">${nf(d.elo)}</div>
         <div class="cs2-sub">${t("cs2.elo")}${d.peakElo ? " · " + t("cs2.peak") + " " + nf(d.peakElo) : ""}</div>
         <div class="cs2-stats">
           ${stat(t("stat.leetify"), d.leetifyRating)}${stat(t("stat.aim"), d.aim)}${stat(t("stat.position"), d.positioning)}${stat(t("stat.utility"), d.utility)}
         </div>`;
    }
    function faceitStats(f) {
      return `<div class="cs2-stats">${stat(t("stat.kd"), f.kd)}${stat(t("stat.win"), f.winrate)}${stat(t("stat.hs"), f.hs)}${stat(t("stat.matches"), f.matches)}</div>`;
    }
    function faceitMain(f) {
      return `<div class="cs2-elo tnum">${nf(f.elo)}</div>
         <div class="cs2-sub">Faceit · ${t("cs2.level")} ${escHtml(String(f.level || "?"))}</div>${faceitStats(f)}`;
    }
    function faceitSection(f) {
      return `<div class="cs2-faceit">
          <div class="cs2-fc-head"><span class="lvl">Faceit · ${t("cs2.levelShort")} ${escHtml(String(f.level || "?"))}</span><b class="tnum">${nf(f.elo)}</b></div>
          ${faceitStats(f)}
        </div>`;
    }
    function faceitEmpty() {
      if (!faceitNick) return '<div class="empty">' + t("empty.cs2.nick") + '</div>';
      if (faceitState === "loading") return '<div class="empty">' + t("empty.cs2.faceitLoading") + '</div>';
      return '<div class="empty">' + escHtml(t("empty.cs2.faceitNA", { n: faceitNick })) + '</div>';
    }

    function premierEmpty() {
      if (!steamId) return '<div class="empty">' + t("empty.cs2.steam") + '</div>';
      if (premierState === "loading") return '<div class="empty">' + t("empty.loading") + '</div>';
      return '<div class="empty">' + t("empty.cs2.premier") + '</div>';
    }

    function render() {
      if (mode === "faceit") {
        host.innerHTML = (faceit && faceit.elo) ? faceitMain(faceit) : faceitEmpty();
        titleMeta(faceit ? faceit.nickname : faceitNick);
        return;
      }
      if (!premier) { host.innerHTML = premierEmpty(); titleMeta(""); return; }
      let html = premierBlock(premier);
      if (mode === "both") html += (faceit && faceit.elo) ? faceitSection(faceit) : faceitEmpty();
      host.innerHTML = html;
      titleMeta(premier.name);
    }

    function loadFaceit() {
      faceit = null;
      if (!faceitNick) { faceitState = "idle"; render(); return; }
      faceitState = "loading"; render();
      fetch("https://naerod.com/api/faceit?nick=" + encodeURIComponent(faceitNick))
        .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then((d) => { if (!d || d.error || d.elo == null) throw new Error("no faceit"); faceit = d; faceitState = "ok"; render(); })
        .catch((e) => { console.warn("[faceit]", e); faceit = null; faceitState = "error"; render(); });
    }

    function loadPremier() {
      premier = null;
      if (!steamId) { premierState = "idle"; render(); return; }
      premierState = "loading"; render();
      fetch("https://naerod.com/api/leetify?steamid=" + encodeURIComponent(steamId))
        .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then((d) => { if (!d || d.error || d.elo == null) throw new Error("no data"); premier = d; premierState = "ok"; render(); })
        .catch((e) => { console.warn("[cs2]", e); premierState = "error"; render(); });
    }

    function openSettings() {
      Settings.open("CS2", [
        { type: "select", label: "Affichage", value: mode,
          options: [{ v: "premier", t: "Premier" }, { v: "faceit", t: "Faceit" }, { v: "both", t: "Les deux" }],
          onChange: (v) => {
            mode = v; CFG.set("cs2", "mode", v);
            if (v !== "faceit" && !premier && steamId && premierState !== "loading") loadPremier();
            if (v !== "premier" && faceitNick && !faceit && faceitState !== "loading") loadFaceit();
            render();
          } },
        { type: "text", label: "Steam ID (Premier)", sub: "Ton SteamID64 (17 chiffres). Trouve-le sur steamid.io ou dans l'URL de ton profil Steam.",
          placeholder: "7656119...", value: steamId,
          onChange: (val) => { steamId = (val || "").replace(/\D/g, ""); CFG.set("cs2", "steam", steamId); loadPremier(); } },
        { type: "text", label: "Pseudo Faceit", sub: "Récupère ELO + niveau Faceit.",
          placeholder: "ton_pseudo_faceit", value: faceitNick,
          onChange: (val) => { faceitNick = val; CFG.set("cs2", "nick", val); loadFaceit(); } },
      ]);
    }
    const gear = host.closest(".card") && host.closest(".card").querySelector(".head-right .gear");
    if (gear) { gear.setAttribute("aria-label", "Réglages CS2"); gear.addEventListener("click", openSettings); }

    // init selon le mode (on évite tout fetch inutile et tout flash d'erreur)
    if (mode === "faceit") {
      if (faceitNick) loadFaceit(); else render();
    } else {
      if (steamId) loadPremier(); else render();       // Premier requiert un Steam ID (sinon état vide)
      if (faceitNick && mode === "both") loadFaceit();
    }
  });

  /* ============================================================
     SYSTÈME / HOMELAB — par défaut les ressources du PC local
     (chrome.system.cpu/memory/storage) ; option serveur distant (URL + token).
     ============================================================ */
  CFG.ready(function homelab() {
    const host = $("#homelab"); if (!host) return;
    const card = host.closest(".card");
    const titleEl = card && card.querySelector(".card-title");
    let hostData = null;
    let source = CFG.get("homelab", "source", "local");   // local | remote
    let remoteUrl = CFG.get("homelab", "url", "");
    let remoteToken = CFG.get("homelab", "token", "");
    let label = CFG.get("homelab", "label", "");
    let metrics = CFG.get("homelab", "metrics", ["cpu", "ram", "disk"]);
    let refresh = CFG.get("homelab", "refresh", 30);   // secondes (0 = off)
    let timer = null, prevCpu = null;

    const sysOk = hasChrome && chrome.system && chrome.system.cpu;
    const pct = (f) => Math.round((f || 0) * 100);
    const gb = (b) => (b / 1073741824).toFixed(1).replace(".", ",");
    const sizeStr = (b) => b >= 1099511627776 ? (b / 1099511627776).toFixed(1).replace(".", ",") + " To" : gb(b) + " Go";
    const cls = (p) => (p >= 85 ? "hot" : p >= 65 ? "warn" : "");
    const bar = (lbl, p, sub) =>
      `<div class="hl-g">
         <div class="hl-g-top"><span>${lbl}</span><span class="v">${sub ? "<small>" + sub + "</small>" : ""}<b>${p}%</b></span></div>
         <div class="hl-bar"><i class="${cls(p)}" style="width:${p}%"></i></div>
       </div>`;
    // capacité seule (mode local : Chrome n'expose pas l'espace disque libre)
    const capRow = (lbl, bytes) =>
      `<div class="hl-g">
         <div class="hl-g-top"><span>${lbl}</span><span class="v"><b>${sizeStr(bytes)}</b></span></div>
         <div class="hl-bar"><i style="width:100%;opacity:.22"></i></div>
       </div>`;

    function applyTitle() {
      if (titleEl) titleEl.textContent = label || (source === "local" ? "Cet ordinateur" : "Homelab");
    }

    function render() {
      const h = hostData; if (!h) return;
      const parts = [];
      if (metrics.indexOf("cpu") !== -1 && h.cpu != null) parts.push(bar(t("sys.cpu"), pct(h.cpu), h.cores ? h.cores + "c" : ""));
      if (metrics.indexOf("ram") !== -1 && h.memTotal) parts.push(bar(t("sys.ram"), pct(h.mem), gb(h.memUsed) + "/" + gb(h.memTotal) + "Go"));
      if (metrics.indexOf("disk") !== -1) {
        if (h.disk != null) parts.push(bar(t("sys.disk"), pct(h.disk), gb(h.diskUsed) + "/" + gb(h.diskTotal) + "Go"));
        else if (h.diskTotal) parts.push(capRow(t("sys.disk"), h.diskTotal));
      }
      host.innerHTML = parts.length ? `<div class="hl-glob">${parts.join("")}</div>` : '<div class="empty">' + t("empty.sys.none") + '</div>';
    }

    // ---- CPU local : delta entre deux échantillons cumulés ----
    function readCpu(cb) {
      chrome.system.cpu.getInfo((info) => {
        if (chrome.runtime.lastError || !info) return cb(null, null);
        const sum = (pr) => pr.reduce((a, p) => { a.busy += p.usage.user + p.usage.kernel; a.total += p.usage.total; return a; }, { busy: 0, total: 0 });
        const cur = sum(info.processors);
        if (prevCpu && cur.total > prevCpu.total) {
          const c = (cur.busy - prevCpu.busy) / (cur.total - prevCpu.total);
          prevCpu = cur; return cb(c, info.numOfProcessors);
        }
        prevCpu = cur;   // premier échantillon → on en reprend un après 600 ms
        setTimeout(() => chrome.system.cpu.getInfo((i2) => {
          if (chrome.runtime.lastError || !i2) return cb(null, info.numOfProcessors);
          const c2 = sum(i2.processors);
          const c = (c2.total - cur.total) > 0 ? (c2.busy - cur.busy) / (c2.total - cur.total) : 0;
          prevCpu = c2; cb(c, i2.numOfProcessors);
        }), 600);
      });
    }

    function fetchLocal() {
      if (!sysOk) { host.innerHTML = '<div class="empty">' + t("empty.sys.browser") + '</div>'; return; }
      const data = {};
      const jobs = [
        new Promise((res) => { try { readCpu((c, cores) => { if (c != null) data.cpu = c; if (cores) data.cores = cores; res(); }); } catch (e) { res(); } }),
        new Promise((res) => { try { chrome.system.memory.getInfo((m) => { if (!chrome.runtime.lastError && m) { data.memTotal = m.capacity; data.memUsed = m.capacity - m.availableCapacity; data.mem = m.capacity ? data.memUsed / m.capacity : 0; } res(); }); } catch (e) { res(); } }),
        new Promise((res) => { try {
          if (!chrome.system.storage) return res();
          chrome.system.storage.getInfo((units) => {
            if (!chrome.runtime.lastError && units && units.length) {
              const fixed = units.filter((u) => u.type !== "removable");
              data.diskTotal = (fixed.length ? fixed : units).reduce((s, u) => s + (u.capacity || 0), 0);
            }
            res();
          });
        } catch (e) { res(); } }),
      ];
      Promise.all(jobs).then(() => { hostData = data; render(); });
    }

    function fetchRemote() {
      if (!remoteUrl) { host.innerHTML = '<div class="empty">' + t("empty.sys.url") + '</div>'; return; }
      const u = remoteUrl + (remoteUrl.indexOf("?") === -1 ? "?" : "&") + (remoteToken ? "k=" + encodeURIComponent(remoteToken) : "");
      fetch(u)
        .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then((d) => { const h = (d && d.host) || d; if (!h) throw new Error("no host"); hostData = h; render(); })
        .catch((e) => { console.warn("[homelab]", e); if (!hostData) host.innerHTML = '<div class="empty">' + t("empty.sys.server") + '</div>'; });
    }
    function fetchData() { if (source === "remote") fetchRemote(); else fetchLocal(); }
    function schedule() { if (timer) clearInterval(timer); if (refresh > 0) timer = setInterval(fetchData, refresh * 1000); }

    function openSettings() {
      Settings.open("Système", [
        { type: "info", text: "Par défaut : ressources de cet ordinateur. Tu peux aussi suivre un serveur distant (homelab, NAS, VPS…)." },
        { type: "segmented", label: "Source", value: source,
          options: [{ v: "local", t: "Cet ordinateur" }, { v: "remote", t: "Serveur distant" }],
          onChange: (v) => { source = v; CFG.set("homelab", "source", v); prevCpu = null; hostData = null; applyTitle(); fetchData(); schedule(); openSettings(); } },
        source === "remote" ? { type: "text", label: "URL de l'API", sub: "JSON attendu : { cpu, mem, memUsed, memTotal, disk, diskUsed, diskTotal, cores }", placeholder: "https://monserveur/api/homelab", value: remoteUrl,
          onChange: (val) => { remoteUrl = val; CFG.set("homelab", "url", val); ensureHostAccess(val).then(fetchData); } } : null,
        source === "remote" ? { type: "text", label: "Token (optionnel)", placeholder: "clé d'accès", value: remoteToken,
          onChange: (val) => { remoteToken = val; CFG.set("homelab", "token", val); fetchData(); } } : null,
        { type: "text", label: "Titre de la carte", placeholder: source === "local" ? "Cet ordinateur" : "Homelab", value: label,
          onChange: (val) => { label = val; CFG.set("homelab", "label", val); applyTitle(); } },
        { type: "checks", label: "Métriques affichées", value: metrics,
          options: [{ v: "cpu", t: "CPU" }, { v: "ram", t: "RAM" }, { v: "disk", t: "Disque" }],
          onChange: (v, on) => { metrics = on ? metrics.concat([v]) : metrics.filter((x) => x !== v); CFG.set("homelab", "metrics", metrics); render(); } },
        { type: "select", label: "Rafraîchissement", value: String(refresh),
          options: [{ v: "0", t: "Manuel" }, { v: "15", t: "15 s" }, { v: "30", t: "30 s" }, { v: "60", t: "1 min" }],
          onChange: (v) => { refresh = parseInt(v, 10); CFG.set("homelab", "refresh", refresh); schedule(); } },
        { type: "button", label: "Actualiser maintenant", onClick: fetchData },
      ]);
    }
    const gear = card && card.querySelector(".head-right .gear");
    if (gear) { gear.setAttribute("aria-label", "Réglages système"); gear.addEventListener("click", openSettings); }

    applyTitle();
    fetchData();
    schedule();
  });

  /* ============================================================
     STATUT SITES WEB — moniteur d'URL défini par l'utilisateur.
     Ping client-side (fetch no-cors) : pas de backend, pas de clé, pas de permission d'hôte.
     ============================================================ */
  CFG.ready(function sites() {
    const host = $("#sites"); if (!host) return;
    const card = $("#sitesCard");
    let list = CFG.get("sites", "list", []);             // [{ name, url }]
    let showMs = CFG.get("sites", "ms", true);
    const results = {};                                   // url -> { status:'up'|'down', ms }

    const normUrl = (u) => /^https?:\/\//i.test(u) ? u : "https://" + u;
    const nameFor = (s) => s.name || domainOf(normUrl(s.url));

    const siteRowHtml = (s) => {
      const r = results[s.url] || {};
      const up = r.status === "up";
      const meta = r.status ? (up ? (r.ms != null ? r.ms + " ms" : "OK") : "down") : "…";
      return `<a class="site-row" href="${escHtml(normUrl(s.url))}" target="_blank" rel="noopener" title="${escHtml(normUrl(s.url))}">
          <span class="site-dot ${r.status ? (up ? "up" : "down") : ""}"></span>
          <span class="site-name">${escHtml(nameFor(s))}</span>
          ${showMs ? `<span class="site-meta">${escHtml(String(meta))}</span>` : ""}
        </a>`;
    };
    const pager = makePager(card, host, { pageSize: 5, renderSlice: (slice) => slice.map(siteRowHtml).join("") });
    function render() {
      if (!list.length) { pager.message('<div class="empty">' + t("empty.sites.add") + '</div>'); return; }
      pager.set(list);
    }

    // ping : un fetch no-cors réussi (réponse opaque) = joignable ; une erreur réseau = down.
    function ping(s) {
      const url = normUrl(s.url);
      const t0 = Date.now();
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 8000);
      return fetch(url, { mode: "no-cors", cache: "no-store", redirect: "follow", signal: ctrl.signal })
        .then(() => { results[s.url] = { status: "up", ms: Date.now() - t0 }; })
        .catch(() => { results[s.url] = { status: "down", ms: null }; })
        .then(() => { clearTimeout(to); render(); });
    }
    function pingAll() { list.forEach(ping); }

    let nName = "", nUrl = "";
    function openSettings() {
      nName = ""; nUrl = "";
      const items = list.map((s) => ({ name: s.url, label: nameFor(s), sub: normUrl(s.url) }));
      Settings.open("Sites web", [
        { type: "info", text: "Surveille la disponibilité de tes sites. Le statut est testé depuis ton navigateur." },
        { type: "toggle", label: "Afficher le temps de réponse", value: showMs,
          onChange: (v) => { showMs = v; CFG.set("sites", "ms", v); render(); } },
        { type: "list", label: "Sites suivis", items,
          move: (from, to) => { const x = list.splice(from, 1)[0]; list.splice(to, 0, x); CFG.set("sites", "list", list); render(); },
          onRemove: (it, i) => { delete results[list[i].url]; list.splice(i, 1); CFG.set("sites", "list", list); render(); } },
        { type: "text", label: "Nom (optionnel)", placeholder: "Mon site", value: "", onChange: (v) => { nName = v; } },
        { type: "text", label: "URL", placeholder: "exemple.com", value: "", onChange: (v) => { nUrl = v; } },
        { type: "button", label: "Ajouter le site", primary: true, onClick: () => {
            const u = (nUrl || "").trim(); if (!u) return;
            const s = { name: nName.trim(), url: u };
            list.push(s); CFG.set("sites", "list", list);
            render(); ping(s); openSettings();
          } },
      ]);
    }
    const gear = card && card.querySelector(".head-right .gear");
    if (gear) { gear.setAttribute("aria-label", "Réglages des sites"); gear.addEventListener("click", openSettings); }

    render();
    pingAll();
  });

  /* ============================================================
     GMAIL — non-lus + 3 derniers objets (OAuth chrome.identity)
     ============================================================ */
  CFG.ready(function gmail() {
    const host = $("#gmail"); if (!host) return;
    if (!(hasChrome && chrome.identity)) { host.innerHTML = '<div class="empty">' + t("empty.gmail") + '</div>'; return; }
    const GBASE = "https://www.googleapis.com/gmail/v1/users/me/";
    let connected = false;
    let filter = CFG.get("gmail", "filter", "unread");   // unread | recent | important | primary
    let count = CFG.get("gmail", "count", 3);
    const QUERIES = { unread: "is:unread in:inbox", recent: "in:inbox", important: "is:important in:inbox", primary: "category:primary in:inbox" };
    const FLABEL = { unread: "non lus", recent: "récents", important: "importants", primary: "principaux" };
    // structure stable : en-tête (compteur) fixe + liste paginée
    host.innerHTML = '<div class="gm-top"><span class="gm-count tnum">0</span><span class="gm-lbl">non lus</span></div><div class="gm-rows"></div>';
    const topCount = host.querySelector(".gm-count"), topLbl = host.querySelector(".gm-lbl"), rowsHost = host.querySelector(".gm-rows");
    const gmItemHtml = (m) => `<a class="gm-item" href="https://mail.google.com/mail/u/0/#inbox" target="_blank" rel="noopener"><div class="f">${escHtml(m.from)}</div><div class="s">${escHtml(m.subject)}</div></a>`;
    const pager = makePager(host.closest(".card"), rowsHost, { pageSize: () => count, renderSlice: (slice) => slice.map(gmItemHtml).join("") });

    async function api(path, tok) {
      const r = await fetch(GBASE + path, { headers: { Authorization: "Bearer " + tok } });
      if (r.status === 401 || r.status === 403) { dropToken(tok); throw new Error(String(r.status)); }
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }
    function setPill(show) {
      const head = host.closest(".card").querySelector(".head-right");
      let pill = head && head.querySelector(".gm-connect");
      if (show && head && !pill) {
        pill = document.createElement("button");
        pill.type = "button"; pill.className = "btn gm-connect cal-connect"; pill.textContent = "Connecter";
        pill.addEventListener("click", () => load(true).then(() => pill.remove()).catch((e) => console.warn("[gmail] connect", e)));
        head.appendChild(pill);
      } else if (!show && pill) { pill.remove(); }
    }
    async function load(interactive) {
      const tok = await getToken(interactive);
      connected = true;
      const inbox = await api("labels/INBOX", tok);
      const unread = inbox.messagesUnread || 0;
      const q = encodeURIComponent(QUERIES[filter] || QUERIES.unread);
      const list = await api("messages?q=" + q + "&maxResults=" + Math.max(count * 3, 12), tok);
      const ids = (list.messages || []).map((m) => m.id);
      const msgs = await Promise.all(ids.map((id) =>
        api("messages/" + id + "?format=metadata&metadataHeaders=Subject&metadataHeaders=From", tok)
      ));
      const items = msgs.map((m) => {
        const h = (m.payload && m.payload.headers) || [];
        const get = (n) => { const x = h.find((z) => z.name === n); return x ? x.value : ""; };
        let from = get("From").replace(/<[^>]*>/, "").replace(/"/g, "").trim();
        return { from: from || get("From"), subject: get("Subject") || "(sans objet)" };
      });
      render(unread, items);
      setPill(false);
    }
    function render(unread, items) {
      topCount.textContent = unread; topCount.classList.toggle("zero", !unread);
      topLbl.textContent = "non lus · " + FLABEL[filter];
      pager.set(items);
    }
    function reload() { if (connected) load(false).catch((e) => console.warn("[gmail] reload", e)); }
    function openSettings() {
      Settings.open("Gmail", [
        { type: "select", label: "Mails affichés", value: filter,
          options: [{ v: "unread", t: "Non lus" }, { v: "recent", t: "Récents" }, { v: "important", t: "Importants" }, { v: "primary", t: "Principaux" }],
          onChange: (v) => { filter = v; CFG.set("gmail", "filter", v); reload(); } },
        { type: "stepper", label: "Nombre de mails", value: count, min: 1, max: 8,
          onChange: (v) => { count = v; CFG.set("gmail", "count", v); reload(); } },
        { type: "button", label: connected ? "Changer de compte" : "Connecter Google", primary: !connected,
          onClick: () => { Settings.close(); load(true).catch((e) => console.warn("[gmail] connect", e)); } },
      ]);
    }
    const gear = host.closest(".card") && host.closest(".card").querySelector(".head-right .gear");
    if (gear) { gear.setAttribute("aria-label", "Réglages Gmail"); gear.addEventListener("click", openSettings); }

    load(false).catch((e) => { console.warn("[gmail]", e); if (!connected) { setPill(true); pager.message('<div class="empty">Connecte ton compte Google.</div>'); } });
  });

  /* ============================================================
     ROUTER — vue détaillée en GRANDE POP-UP au-dessus de l'accueil assombri.
     Fermeture facile : clic en dehors (backdrop), touche Échap, ou bouton ×.
     ============================================================ */
  const Router = (function () {
    const layer = $("#viewLayer");
    function open(title, bodyHtml, afterRender, panelClass, headerHtml) {
      if (!layer) return;
      const closeLbl = LANG === "fr" ? "Fermer" : "Close";
      layer.innerHTML = '<div class="view-backdrop"></div>'
        + '<div class="view-panel' + (panelClass ? " " + panelClass : "") + '" role="dialog" aria-modal="true" aria-label="' + escHtml(title) + '">'
        + '<div class="view-head"><h2 class="view-title">' + escHtml(title) + '</h2>'
        + (headerHtml || "")
        + '<button type="button" class="view-close gear" aria-label="' + closeLbl + '">' + SVGI.close + '</button></div>'
        + '<div class="view-body">' + bodyHtml + '</div></div>';
      document.body.classList.add("in-view");
      layer.querySelector(".view-backdrop").addEventListener("click", close);
      layer.querySelector(".view-close").addEventListener("click", close);
      if (afterRender) afterRender(layer.querySelector(".view-body"));
    }
    function close() { document.body.classList.remove("in-view"); if (layer) layer.innerHTML = ""; }
    return { open, close };
  })();

  /* ============================================================
     DETAIL — applique le principe « grande pop-up » à TOUS les widgets (sauf
     l'agenda, déjà grand, et le sport qui a sa vue dédiée). Réutilise le VRAI
     widget : on le déplace dans la pop-up (données live, réglages, pagination
     intacts), on le remet en place à la fermeture. Clic dehors / Échap / ×.
     ============================================================ */
  const Detail = (function () {
    let placeholder = null, moved = null;
    function active() { return !!moved; }
    function expand(card) {
      const layer = $("#viewLayer");
      if (!card || moved || !layer) return;
      const closeLbl = LANG === "fr" ? "Fermer" : "Close";
      const title = (card.querySelector(".card-title") || {}).textContent || "";
      layer.innerHTML = '<div class="view-backdrop"></div>'
        + '<div class="view-panel detail-panel" role="dialog" aria-modal="true" aria-label="' + escHtml(title) + '">'
        + '<button type="button" class="view-close gear" aria-label="' + closeLbl + '">' + SVGI.close + '</button>'
        + '<div class="detail-host"></div></div>';
      placeholder = document.createElement("div");
      // keep the SAME grid cell (col span + height) so the other widgets don't reflow
      const colCls = [].slice.call(card.classList).filter((c) => /^col\d+$/.test(c));
      placeholder.className = "card-placeholder " + colCls.join(" ");
      placeholder.style.height = card.offsetHeight + "px";
      card.parentNode.insertBefore(placeholder, card);
      layer.querySelector(".detail-host").appendChild(card);
      card.classList.add("expanded");
      moved = card;
      document.body.classList.add("in-view");
      layer.querySelector(".view-backdrop").addEventListener("click", collapse);
      layer.querySelector(".view-close").addEventListener("click", collapse);
    }
    function collapse() {
      const layer = $("#viewLayer");
      if (moved && placeholder) {
        placeholder.parentNode.insertBefore(moved, placeholder);
        moved.classList.remove("expanded");
        placeholder.remove();
      }
      placeholder = null; moved = null;
      document.body.classList.remove("in-view");
      if (layer) layer.innerHTML = "";
    }
    // ignore ONLY real interactive controls; the whole rest of the widget is clickable
    const IGNORE = "a,button,input,select,textarea";
    function attach(card) {
      if (!card) return;
      card.classList.add("expandable");
      card.addEventListener("click", (e) => {
        if (e.target.closest(IGNORE)) return;     // laisse les éléments interactifs faire leur action
        if (document.body.classList.contains("in-view")) return;
        expand(card);
      });
    }
    return { attach, collapse, active };
  })();

  // Échap ferme la surcouche active (pop-up sport OU widget agrandi)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("in-view")) {
      if (Detail.active()) Detail.collapse(); else Router.close();
    }
  });

  // Rend chaque widget cliquable en grande pop-up — sauf l'agenda (déjà grand)
  // et le sport (vue dédiée plus riche).
  try {
    $$(".bento > .card").forEach((card) => {
      if (card.id === "agendaCard" || card.id === "sportCard") return;
      Detail.attach(card);
    });
  } catch (e) { console.warn("[detail]", e); }

  /* ============================================================
     SPORT — widget multi-suivis paginé (football : ligues ET équipes).
     Compact : match d'une ligue, ou snippet de classement §4.2 (équipe + voisins
     + top/bottom). Vue plein écran dédiée (Router). Rotation auto + ordre
     auto(For You)/manuel. F1/basket/tennis : fournisseurs de pages additionnels.
     ============================================================ */
  (function sport() {
    const host = $("#sport"); if (!host) return;
    const card = host.closest(".card");
    const meta = $("#sportMeta");
    const gear = card && card.querySelector(".head-right .gear");
    if (gear) gear.setAttribute("aria-label", t("card.sport"));

    const tfmt = new Intl.DateTimeFormat(LOCALE(), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

    let cfg = { sports: [], follows: { football: [] }, f1: { driver: null }, sport: { rotate: 60, mode: "auto" } };
    let boards = {};      // league code -> Match[] (ESPN scoreboard)
    let standings = {};   // comp -> Standing (football-data)
    let teamMx = {};      // teamId -> Match[] (football-data, finished + scheduled)
    let teamsByComp = {}; // comp -> Team[] (settings autocomplete)
    let f1sched = [], f1drv = [], f1con = []; // F1 schedule + driver/constructor standings
    let bballBoards = {}; // basket league code -> Match[]
    let tnBoards = {};    // tennis tour code -> Match[]
    let defNews = [], defItems = []; // mode défaut : actus sport + items mixés (matchs/actus)
    let pager = null, rotTimer = null, pendingTeamLeague = null;

    const footballOn = () => cfg.sports.indexOf("football") !== -1;
    // football activé mais aucun suivi → affiches du jour par défaut (§4.5)
    const footballDefault = () => footballOn() && follows().length === 0;
    const f1On = () => cfg.sports.indexOf("f1") !== -1;
    const basketOn = () => cfg.sports.indexOf("basketball") !== -1;
    const basketFollows = () => (cfg.follows && cfg.follows.basketball) || [];
    const basketNameOf = (code) => (window.NT && window.NT.basketName) ? window.NT.basketName(code) : code;
    const tennisOn = () => cfg.sports.indexOf("tennis") !== -1;
    const tennisFollows = () => (cfg.follows && cfg.follows.tennis) || [];
    const tennisNameOf = (code) => (window.NT && window.NT.tennisName) ? window.NT.tennisName(code) : code;
    const follows = () => (cfg.follows && cfg.follows.football) || [];
    const leagueFollows = () => follows().filter((f) => f.type !== "team");
    const teamFollows = () => follows().filter((f) => f.type === "team");
    const nameOf = (code) => (window.NT && window.NT.leagueName) ? window.NT.leagueName(code) : code;
    const teamLabel = (s) => escHtml(s.team.shortName || s.team.name || "?");
    const scoreOf = (m) => (m.home.score != null && m.away.score != null) ? (m.home.score + " – " + m.away.score) : "";
    const fl = (c) => (window.NT && window.NT.formLabel) ? window.NT.formLabel(c, LANG) : c;
    const ts = (d) => new Date(d).getTime();
    function whenNT(cb) { if (window.NT) cb(window.NT); else window.addEventListener("nt:ready", () => cb(window.NT), { once: true }); }

    async function loadData() {
      if (!window.NT) return;
      const NT = window.NT;
      const leagueComps = leagueFollows().map((f) => f.comp);
      const teamComps = teamFollows().map((f) => f.comp);
      if (footballDefault()) {
        const def = NT.DEFAULT_FOOTBALL || [];
        await Promise.all(def.map(async (c) => { boards[c] = await NT.footballScoreboard(c); }));
        defNews = (await NT.sportsHeadlines()) || [];
      }
      await Promise.all([].concat(
        leagueComps.map(async (c) => { boards[c] = await NT.footballScoreboard(c); }),
        Array.from(new Set(leagueComps.concat(teamComps))).map(async (c) => { standings[c] = await NT.footballStandings(c); }),
        teamFollows().map(async (f) => {
          const fin = await NT.footballTeamMatches(f.id, { status: "FINISHED", limit: 6 });
          const sc = await NT.footballTeamMatches(f.id, { status: "SCHEDULED", limit: 6 });
          teamMx[f.id] = (fin || []).concat(sc || []);
        })
      ));
      if (basketOn()) {
        await Promise.all(basketFollows().map(async (f) => { bballBoards[f.comp] = await NT.basketScoreboard(f.comp); }));
      }
      if (tennisOn()) {
        await Promise.all(tennisFollows().map(async (f) => { tnBoards[f.comp] = await NT.tennisEvents(f.comp); }));
      }
      if (f1On()) {
        const [sc, dr, co] = await Promise.all([NT.f1Schedule(), NT.f1Standings("driver"), NT.f1Standings("constructor")]);
        f1sched = sc || []; f1drv = dr || []; f1con = co || [];
      }
    }

    // ---- F1 (Jolpica) : prochaine séance en heure de Paris + 2 championnats ----
    const F1_SESSIONS = [
      { k: "FirstPractice", fr: "EL1", en: "FP1" }, { k: "SecondPractice", fr: "EL2", en: "FP2" },
      { k: "ThirdPractice", fr: "EL3", en: "FP3" }, { k: "SprintQualifying", fr: "Qualifs Sprint", en: "Sprint Quali" },
      { k: "Sprint", fr: "Sprint", en: "Sprint" }, { k: "Qualifying", fr: "Qualifs", en: "Quali" },
    ];
    const parisFmt = new Intl.DateTimeFormat(LOCALE(), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
    const raceDT = (r) => new Date(r.date + "T" + (r.time || "13:00:00Z"));
    function f1Sessions(r) {
      const out = [];
      F1_SESSIONS.forEach((s) => { if (r[s.k] && r[s.k].date) out.push({ label: LANG === "fr" ? s.fr : s.en, when: new Date(r[s.k].date + "T" + (r[s.k].time || "12:00:00Z")) }); });
      out.push({ label: LANG === "fr" ? "Course" : "Race", when: raceDT(r) });
      return out.sort((a, b) => a.when - b.when);
    }
    function f1NextSession() {
      const now = Date.now();
      for (const r of f1sched) for (const s of f1Sessions(r)) if (s.when.getTime() > now - 2 * 3600e3) return { race: r, session: s };
      return null;
    }
    function f1Countdown(diff) {
      const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000), m = Math.floor((diff % 3600000) / 60000);
      return (d > 0 ? d + "j " : "") + h + "h " + m + "min";
    }
    function f1Compact() {
      const head = '<div class="sp-league">' + (LANG === "fr" ? "Formule 1" : "Formula 1") + '</div>';
      const nx = f1NextSession();
      if (!nx) return '<div class="sp-page">' + head + '<div class="empty">' + t("empty.f1") + '</div></div>';
      const diff = nx.session.when.getTime() - Date.now();
      const cd = diff > 0 ? f1Countdown(diff) : (LANG === "fr" ? "En cours" : "Live");
      const leader = f1drv[0];
      return '<div class="sp-page">' + head
        + '<div class="sp-match"><div class="sp-teams"><span class="sp-team">' + escHtml(nx.race.raceName) + '</span></div>'
        + '<div class="sp-meta"><span class="sp-live">' + escHtml(nx.session.label) + '</span></div></div>'
        + '<div class="f1-line"><span class="f1-when">' + escHtml(parisFmt.format(nx.session.when)) + '</span><span class="f1-cd tnum">' + cd + '</span></div>'
        + (leader ? '<div class="f1-leader">' + (LANG === "fr" ? "Leader" : "Leader") + ' : ' + escHtml(leader.Driver.familyName) + ' · ' + leader.points + ' pts</div>' : '')
        + '</div>';
    }
    function f1Section() {
      const drvId = cfg.f1.driver;
      const drvRows = f1drv.slice(0, 12).map((s) => '<tr' + (drvId && s.Driver.driverId === drvId ? ' class="sv-hl"' : '') + '><td>' + s.position + '</td><td class="l">' + escHtml(s.Driver.givenName[0] + ". " + s.Driver.familyName) + '</td><td class="l">' + escHtml((s.Constructors && s.Constructors[0] && s.Constructors[0].name) || "") + '</td><td class="sv-pts">' + s.points + '</td><td>' + s.wins + '</td></tr>').join("");
      const conRows = f1con.slice(0, 12).map((s) => '<tr><td>' + s.position + '</td><td class="l">' + escHtml(s.Constructor.name) + '</td><td class="sv-pts">' + s.points + '</td><td>' + s.wins + '</td></tr>').join("");
      const sched = f1sched.filter((r) => raceDT(r).getTime() > Date.now() - 4 * 3600e3).slice(0, 4).map((r) => {
        const sessions = f1Sessions(r).filter((s) => s.when.getTime() > Date.now() - 2 * 3600e3).slice(0, 5);
        return '<div class="f1-gp"><div class="f1-gp-h">M' + r.round + ' · ' + escHtml(r.raceName) + '</div>'
          + sessions.map((s) => '<div class="f1-srow"><span>' + escHtml(s.label) + '</span><span class="f1-when">' + escHtml(parisFmt.format(s.when)) + '</span></div>').join("") + '</div>';
      }).join("");
      const tbl = (head, body) => '<div class="sv-table-wrap"><table class="sv-table tnum"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
      return '<div class="sv-league">' + svHead((LANG === "fr" ? "Formule 1" : "Formula 1"), "F1")
        + '<div class="sv-group"><div class="sv-grouptitle">' + (LANG === "fr" ? "Championnat pilotes" : "Drivers' championship") + '</div>'
        + tbl('<tr><th>#</th><th class="l">' + (LANG === "fr" ? "Pilote" : "Driver") + '</th><th class="l">' + (LANG === "fr" ? "Écurie" : "Team") + '</th><th>Pts</th><th>V</th></tr>', drvRows) + '</div>'
        + '<div class="sv-group"><div class="sv-grouptitle">' + (LANG === "fr" ? "Championnat constructeurs" : "Constructors' championship") + '</div>'
        + tbl('<tr><th>#</th><th class="l">' + (LANG === "fr" ? "Écurie" : "Team") + '</th><th>Pts</th><th>V</th></tr>', conRows) + '</div>'
        + '<div class="sv-group"><div class="sv-grouptitle">' + (LANG === "fr" ? "Calendrier (heure de Paris)" : "Schedule (Paris time)") + '</div>' + (sched || '<div class="sv-soon">' + t("empty.f1") + '</div>') + '</div></div>';
    }

    function pickMatch(matches) {
      const now = Date.now();
      const live = (matches || []).find((m) => m.status === "live");
      if (live) return { m: live, kind: "live" };
      const up = (matches || []).filter((m) => m.status === "scheduled" && ts(m.utcDate) > now - 2 * 3600e3).sort((a, b) => ts(a.utcDate) - ts(b.utcDate));
      if (up[0]) return { m: up[0], kind: "next" };
      const fin = (matches || []).filter((m) => m.status === "finished").sort((a, b) => ts(b.utcDate) - ts(a.utcDate));
      if (fin[0]) return { m: fin[0], kind: "last" };
      return null;
    }
    function matchRow(m, kind) {
      const score = scoreOf(m);
      const mid = (kind === "finished" || kind === "last" || kind === "live") ? (score || "–") : "vs";
      const right = kind === "live" ? '<span class="sp-live">' + t("sport.live") + (m.minute ? " " + m.minute + "'" : "") + '</span>'
        : (kind === "finished" || kind === "last") ? ''
        : '<span class="sp-time">' + escHtml(tfmt.format(new Date(m.utcDate))) + '</span>';
      const crest = (s) => s.team.crest ? '<img class="sp-crest" src="' + escHtml(s.team.crest) + '" alt="" loading="lazy">' : '';
      return '<div class="sp-match' + (kind === "live" ? " is-live" : "") + '">'
        + '<div class="sp-teams"><span class="sp-team">' + crest(m.home) + teamLabel(m.home) + '</span>'
        + '<span class="sp-vs tnum">' + mid + '</span>'
        + '<span class="sp-team">' + crest(m.away) + teamLabel(m.away) + '</span></div>'
        + (right ? '<div class="sp-meta">' + right + '</div>' : '') + '</div>';
    }
    function formCell(form) {
      return '<span class="sv-form">' + (form || []).slice(-5).map((c) => '<i class="frm frm-' + c + '">' + fl(c) + '</i>').join("") + '</span>';
    }
    function standRowFull(r, hl) {
      return '<tr' + (hl ? ' class="sv-hl"' : '') + '><td>' + r.position + '</td>'
        + '<td class="l sv-club">' + (r.team.crest ? '<img src="' + escHtml(r.team.crest) + '" alt="" loading="lazy">' : '') + escHtml(r.team.shortName || r.team.name) + '</td>'
        + '<td>' + r.played + '</td><td>' + r.won + '</td><td>' + r.draw + '</td><td>' + r.lost + '</td>'
        + '<td>' + (r.goalDifference > 0 ? "+" : "") + r.goalDifference + '</td>'
        + '<td class="sv-pts">' + r.points + '</td><td class="l">' + formCell(r.form) + '</td></tr>';
    }
    function standingsTable(std, hlId) {
      if (!std || !std.rows || !std.rows.length) return '<div class="sv-soon">' + t("sport.standings.soon") + '</div>';
      const head = '<tr><th>#</th><th class="l">Club</th><th>MJ</th><th>G</th><th>N</th><th>P</th><th>DB</th><th>Pts</th><th class="l">' + (LANG === "fr" ? "Forme" : "Form") + '</th></tr>';
      const rows = std.rows.map((r) => standRowFull(r, hlId && String(r.team.id) === String(hlId))).join("");
      return '<div class="sv-table-wrap"><table class="sv-table tnum"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div>';
    }
    // §4.2 compact : équipe suivie + voisins + top2 + bottom2
    function compactStanding(std, teamId) {
      if (!std || !std.rows || !std.rows.length) return null;
      const rows = std.rows;
      const idx = rows.findIndex((r) => String(r.team.id) === String(teamId));
      if (idx === -1) return null;
      const wanted = new Set();
      [0, 1, idx - 1, idx, idx + 1, rows.length - 2, rows.length - 1].forEach((i) => { if (i >= 0 && i < rows.length) wanted.add(i); });
      const sorted = Array.from(wanted).sort((a, b) => a - b);
      let prev = -1; const trs = [];
      sorted.forEach((i) => {
        if (prev !== -1 && i > prev + 1) trs.push('<tr class="sv-gap"><td colspan="5">⋯</td></tr>');
        const r = rows[i];
        trs.push('<tr' + (i === idx ? ' class="sv-hl"' : '') + '><td>' + r.position + '</td>'
          + '<td class="l sv-club">' + (r.team.crest ? '<img src="' + escHtml(r.team.crest) + '" alt="">' : '') + escHtml(r.team.shortName || r.team.name) + '</td>'
          + '<td>' + r.played + '</td><td>' + (r.goalDifference > 0 ? "+" : "") + r.goalDifference + '</td><td class="sv-pts">' + r.points + '</td></tr>');
        prev = i;
      });
      return '<table class="sp-mini tnum"><thead><tr><th>#</th><th class="l">Club</th><th>MJ</th><th>DB</th><th>Pts</th></tr></thead><tbody>' + trs.join("") + '</tbody></table>';
    }

    function relevance(f) {
      const now = Date.now();
      const matches = f.type === "team" ? (teamMx[f.id] || []) : (boards[f.comp] || []);
      if (matches.some((m) => m.status === "live")) return 1000;
      const up = matches.filter((m) => m.status === "scheduled").map((m) => ts(m.utcDate)).filter((x) => x > now).sort((a, b) => a - b)[0];
      if (up) return 800 - Math.min((up - now) / 3600e3, 720);
      const last = matches.filter((m) => m.status === "finished").map((m) => ts(m.utcDate)).sort((a, b) => b - a)[0];
      if (last) return 400 - Math.min((now - last) / 3600e3, 360);
      return 100;
    }
    function orderedFollows() {
      const list = follows().slice();
      if (cfg.sport.mode === "manual") return list;
      return list.sort((a, b) => relevance(b) - relevance(a));
    }
    // mode par défaut : compétitions avec des matchs aujourd'hui, triées par pertinence
    function defaultComps() {
      const list = (window.NT && window.NT.DEFAULT_FOOTBALL) || [];
      const score = (c) => {
        const ms = boards[c] || []; const now = Date.now();
        if (ms.some((m) => m.status === "live")) return 1000;
        const up = ms.filter((m) => m.status === "scheduled").map((m) => ts(m.utcDate)).filter((x) => x > now).sort((a, b) => a - b)[0];
        if (up) return 800 - Math.min((up - now) / 3600e3, 720);
        const last = ms.filter((m) => m.status === "finished").map((m) => ts(m.utcDate)).sort((a, b) => b - a)[0];
        if (last) return 300 - Math.min((now - last) / 3600e3, 240);
        return 0;
      };
      return list.filter((c) => (boards[c] || []).length).sort((a, b) => score(b) - score(a));
    }
    function defaultSection(comp) {
      const matches = (boards[comp] || []).slice().sort((a, b) => ts(a.utcDate) - ts(b.utcDate));
      const now = Date.now();
      const live = matches.filter((m) => m.status === "live");
      const up = matches.filter((m) => m.status === "scheduled" && ts(m.utcDate) > now);
      const fin = matches.filter((m) => m.status === "finished").reverse();
      const grp = (label, arr, kind) => arr.length ? '<div class="sv-group"><div class="sv-grouptitle">' + label + '</div>' + arr.map((m) => matchRow(m, kind)).join("") + '</div>' : '';
      return '<div class="sv-league"><h3>' + escHtml(nameOf(comp)) + '</h3>'
        + grp(t("sport.live"), live, "live") + grp(t("sport.upcoming"), up, "next") + grp(t("sport.recent"), fin, "last") + '</div>';
    }
    // mode par défaut « For You » : items mixés (matchs du jour France-en-tête + actus sport/esport)
    const isFrance = (m) => (m.home.team.name || "").toLowerCase() === "france" || (m.away.team.name || "").toLowerCase() === "france";
    function defaultItems() {
      const comps = (window.NT && window.NT.DEFAULT_FOOTBALL) || [];
      let all = []; comps.forEach((c) => (boards[c] || []).forEach((m) => all.push(Object.assign({ _comp: c }, m))));
      const seen = new Set(); all = all.filter((m) => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
      const now = Date.now();
      const frFirst = (arr) => arr.filter(isFrance).concat(arr.filter((m) => !isFrance(m)));
      const live = frFirst(all.filter((m) => m.status === "live"));
      const today = frFirst(all.filter((m) => m.status === "scheduled" && ts(m.utcDate) > now).sort((a, b) => ts(a.utcDate) - ts(b.utcDate)));
      const recent = frFirst(all.filter((m) => m.status === "finished").sort((a, b) => ts(b.utcDate) - ts(a.utcDate)));
      const items = [];
      live.forEach((m) => items.push({ kind: "match", m, k: "live" }));
      today.forEach((m) => items.push({ kind: "match", m, k: "next" }));
      (defNews || []).slice(0, 4).forEach((n) => items.push({ kind: "news", n }));
      recent.slice(0, 6).forEach((m) => items.push({ kind: "match", m, k: "last" }));
      return items.slice(0, 9);
    }
    function defItemPage(it) {
      if (it.kind === "news") {
        const n = it.n;
        return '<div class="sp-page"><div class="sp-league">' + (LANG === "fr" ? "Actu sport & esport" : "Sport & esports") + '</div>'
          + '<a class="sp-newsitem" href="' + escHtml(n.link) + '" target="_blank" rel="noopener"><div class="t">' + escHtml(n.title) + '</div>' + (n.source ? '<div class="s">' + escHtml(n.source) + '</div>' : '') + '</a></div>';
      }
      const m = it.m;
      return '<div class="sp-page"><div class="sp-league">' + escHtml(nameOf(m._comp)) + '</div>' + matchRow(m, it.k) + '</div>';
    }
    function newsSection() {
      if (!defNews.length) return "";
      const items = defNews.slice(0, 8).map((n) => '<a class="sv-news" href="' + escHtml(n.link) + '" target="_blank" rel="noopener"><span class="t">' + escHtml(n.title) + '</span>' + (n.source ? '<span class="s">' + escHtml(n.source) + '</span>' : '') + '</a>').join("");
      return '<div class="sv-league"><h3>' + (LANG === "fr" ? "Actualités sport & esport" : "Sport & esports news") + '</h3>' + items + '</div>';
    }
    function keyOf(f) { return f.type === "team" ? ("T" + f.id) : ("L" + f.comp); }
    function followByKey(k) { return follows().find((f) => keyOf(f) === k); }

    function compactPage(k) {
      if (k[0] === "D") { const i = +k.slice(1); return defItems[i] ? defItemPage(defItems[i]) : ""; }
      if (k === "F1") return f1Compact();
      if (k[0] === "B") {
        const code = k.slice(1); const pick = pickMatch(bballBoards[code]);
        return '<div class="sp-page"><div class="sp-league">' + escHtml(basketNameOf(code)) + '</div>'
          + (pick ? matchRow(pick.m, pick.kind) : '<div class="empty">' + t("sport.noMatch") + '</div>') + '</div>';
      }
      if (k[0] === "N") {
        const code = k.slice(1); const pick = pickMatch(tnBoards[code]);
        return '<div class="sp-page"><div class="sp-league">' + escHtml(tennisNameOf(code)) + '</div>'
          + (pick ? matchRow(pick.m, pick.kind) : '<div class="empty">' + t("sport.noMatch") + '</div>') + '</div>';
      }
      if (k[0] === "T") {
        const f = teamFollows().find((x) => ("T" + x.id) === k); if (!f) return "";
        const snip = compactStanding(standings[f.comp], f.id);
        const pm = pickMatch(teamMx[f.id]);
        return '<div class="sp-page"><div class="sp-league">' + escHtml(f.name || "") + ' · ' + escHtml(nameOf(f.comp)) + '</div>'
          + (pm ? matchRow(pm.m, pm.kind) : '')
          + (snip || ('<div class="sv-soon">' + t("sport.standings.soon") + '</div>')) + '</div>';
      }
      // ligue (suivie OU compétition par défaut) — comp dérivée de la clé
      const comp = k.slice(1);
      const pick = pickMatch(boards[comp]);
      return '<div class="sp-page"><div class="sp-league">' + escHtml(nameOf(comp)) + '</div>'
        + (pick ? matchRow(pick.m, pick.kind) : '<div class="empty">' + t("sport.noMatch") + '</div>') + '</div>';
    }

    function ensurePager() {
      if (pager) return;
      pager = makePager(card, host, { pageSize: 1, renderSlice: (slice) => slice.length ? compactPage(slice[0]) : "" });
      host.addEventListener("click", (e) => { if (e.target.closest(".pg-arrow, a")) return; if (footballDefault() || (footballOn() && follows().length) || (basketOn() && basketFollows().length) || (tennisOn() && tennisFollows().length) || f1On()) openView(); });
    }
    function startRotation() {
      if (rotTimer) { clearInterval(rotTimer); rotTimer = null; }
      const sec = cfg.sport.rotate;
      if (sec && sec > 0 && pager) rotTimer = setInterval(() => { if (!document.body.classList.contains("in-view")) pager.next(); }, sec * 1000);
    }
    function render() {
      ensurePager();
      const hasFb = footballOn() && follows().length;
      const hasBk = basketOn() && basketFollows().length;
      const hasTn = tennisOn() && tennisFollows().length;
      const dflt = footballDefault();
      defItems = dflt ? defaultItems() : [];
      if (!hasFb && !hasBk && !hasTn && !f1On() && !defItems.length) {
        if (meta) meta.textContent = "";
        pager.message('<div class="empty">' + (dflt ? t("sport.noToday") : t("empty.sport")) + '</div>');
        if (rotTimer) { clearInterval(rotTimer); rotTimer = null; }
        return;
      }
      let keys = dflt ? defItems.map((_, i) => "D" + i) : (footballOn() ? orderedFollows().map(keyOf) : []);
      if (basketOn()) basketFollows().forEach((f) => keys.push("B" + f.comp));
      if (tennisOn()) tennisFollows().forEach((f) => keys.push("N" + f.comp));
      if (f1On()) keys.push("F1");
      keys = keys.slice(0, 9); // §4.1 — 9 pages max dans le compact
      if (meta) meta.textContent = dflt ? (LANG === "fr" ? "Aujourd'hui" : "Today") : keys.length + (LANG === "fr" ? (keys.length > 1 ? " suivis" : " suivi") : (keys.length > 1 ? " follows" : " follow"));
      pager.set(keys);
      startRotation();
      computeHeadline();
    }
    // §3.8 — expose a LIVE followed match for the hero "At a Glance" slider
    function computeHeadline() {
      let cands = [];
      if (footballDefault()) defaultComps().forEach((c) => { cands = cands.concat(boards[c] || []); });
      else if (footballOn()) {
        leagueFollows().forEach((f) => { cands = cands.concat(boards[f.comp] || []); });
        teamFollows().forEach((f) => { cands = cands.concat(teamMx[f.id] || []); });
      }
      if (basketOn()) basketFollows().forEach((f) => { cands = cands.concat(bballBoards[f.comp] || []); });
      if (tennisOn()) tennisFollows().forEach((f) => { cands = cands.concat(tnBoards[f.comp] || []); });
      const live = cands.find((m) => m.status === "live");
      window.__ntHeadline = live ? { home: live.home, away: live.away, minute: live.minute, comp: live.competition } : null;
    }

    // §4.6 — cloche de notifications par entité (off par défaut)
    function bellBtn(key) {
      const on = !!(cfg.notif && cfg.notif[key]);
      return '<button type="button" class="sv-bell' + (on ? " on" : "") + '" data-nk="' + key + '" aria-label="Notifications" title="Notifications">'
        + '<svg viewBox="0 0 24 24" fill="' + (on ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg></button>';
    }
    function svHead(titleHtml, key) { return '<div class="sv-head"><h3>' + titleHtml + '</h3>' + bellBtn(key) + '</div>'; }
    function toggleBell(key, btn) {
      cfg.notif = cfg.notif || {};
      const enabling = !cfg.notif[key];
      const apply = (granted) => {
        if (enabling && granted !== false) cfg.notif[key] = true; else delete cfg.notif[key];
        if (window.NT) { window.NT.storage.setConfig("notif", cfg.notif); window.NT.refresh(); }
        if (btn) { const on = !!cfg.notif[key]; btn.classList.toggle("on", on); const svg = btn.querySelector("svg"); if (svg) svg.setAttribute("fill", on ? "currentColor" : "none"); }
      };
      if (enabling && hasChrome && chrome.permissions) chrome.permissions.request({ permissions: ["notifications"] }, (g) => apply(g));
      else apply(true);
    }

    function teamSection(f) {
      const ms = (teamMx[f.id] || []).slice().sort((a, b) => ts(a.utcDate) - ts(b.utcDate));
      const now = Date.now();
      const live = ms.filter((m) => m.status === "live");
      const up = ms.filter((m) => m.status === "scheduled" && ts(m.utcDate) > now).slice(0, 5);
      const fin = ms.filter((m) => m.status === "finished").reverse().slice(0, 5);
      const grp = (label, arr, kind) => arr.length ? '<div class="sv-group"><div class="sv-grouptitle">' + label + '</div>' + arr.map((m) => matchRow(m, kind)).join("") + '</div>' : '';
      return '<div class="sv-league">' + svHead(escHtml(f.name || "") + ' <span class="sv-sub">' + escHtml(nameOf(f.comp)) + '</span>', "T:" + f.id)
        + grp(t("sport.live"), live, "live") + grp(t("sport.upcoming"), up, "next") + grp(t("sport.recent"), fin, "last")
        + '<div class="sv-group"><div class="sv-grouptitle">' + (LANG === "fr" ? "Classement" : "Standings") + '</div>' + standingsTable(standings[f.comp], f.id) + '</div></div>';
    }
    function leagueSection(f) {
      const matches = (boards[f.comp] || []).slice().sort((a, b) => ts(a.utcDate) - ts(b.utcDate));
      const now = Date.now();
      const live = matches.filter((m) => m.status === "live");
      const up = matches.filter((m) => m.status === "scheduled" && ts(m.utcDate) > now);
      const fin = matches.filter((m) => m.status === "finished").reverse();
      const grp = (label, arr, kind) => arr.length ? '<div class="sv-group"><div class="sv-grouptitle">' + label + '</div>' + arr.map((m) => matchRow(m, kind)).join("") + '</div>' : '';
      return '<div class="sv-league">' + svHead(escHtml(nameOf(f.comp)), "L:" + f.comp)
        + grp(t("sport.live"), live, "live") + grp(t("sport.upcoming"), up, "next") + grp(t("sport.recent"), fin, "last")
        + '<div class="sv-group"><div class="sv-grouptitle">' + (LANG === "fr" ? "Classement" : "Standings") + '</div>' + standingsTable(standings[f.comp]) + '</div></div>';
    }
    function basketSection(f) {
      const matches = (bballBoards[f.comp] || []).slice().sort((a, b) => ts(a.utcDate) - ts(b.utcDate));
      const now = Date.now();
      const live = matches.filter((m) => m.status === "live");
      const up = matches.filter((m) => m.status === "scheduled" && ts(m.utcDate) > now);
      const fin = matches.filter((m) => m.status === "finished").reverse();
      const grp = (label, arr, kind) => arr.length ? '<div class="sv-group"><div class="sv-grouptitle">' + label + '</div>' + arr.map((m) => matchRow(m, kind)).join("") + '</div>' : '';
      return '<div class="sv-league">' + svHead(escHtml(basketNameOf(f.comp)), "B:" + f.comp)
        + grp(t("sport.live"), live, "live") + grp(t("sport.upcoming"), up, "next") + grp(t("sport.recent"), fin, "last") + '</div>';
    }
    function tennisSection(f) {
      const matches = (tnBoards[f.comp] || []).slice().sort((a, b) => ts(a.utcDate) - ts(b.utcDate));
      const now = Date.now();
      const live = matches.filter((m) => m.status === "live");
      const up = matches.filter((m) => m.status === "scheduled" && ts(m.utcDate) > now).slice(0, 8);
      const fin = matches.filter((m) => m.status === "finished").reverse().slice(0, 10);
      const grp = (label, arr, kind) => arr.length ? '<div class="sv-group"><div class="sv-grouptitle">' + label + '</div>' + arr.map((m) => matchRow(m, kind)).join("") + '</div>' : '';
      return '<div class="sv-league">' + svHead(escHtml(tennisNameOf(f.comp)), "N:" + f.comp)
        + grp(t("sport.live"), live, "live") + grp(t("sport.upcoming"), up, "next") + grp(t("sport.recent"), fin, "last")
        + (matches.length ? '' : '<div class="sv-soon">' + t("sport.noMatch") + '</div>') + '</div>';
    }
    function openView() {
      let sections = footballDefault()
        ? (defaultComps().map(defaultSection).join("") + newsSection())
        : (footballOn() ? orderedFollows().map((f) => f.type === "team" ? teamSection(f) : leagueSection(f)).join("") : "");
      if (basketOn()) sections += basketFollows().map(basketSection).join("");
      if (tennisOn()) sections += tennisFollows().map(tennisSection).join("");
      if (f1On()) sections += f1Section();
      Router.open(t("card.sport"), sections || ('<div class="empty">' + t("sport.noMatch") + '</div>'), (body) => {
        body.querySelectorAll(".sv-bell").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); toggleBell(b.dataset.nk, b); }));
      });
    }

    function saveCfg() {
      if (!window.NT) return;
      window.NT.storage.setConfig("sports", cfg.sports);
      window.NT.storage.setConfig("follows", cfg.follows);
      window.NT.storage.setConfig("sportCfg", cfg.sport);
      window.NT.storage.setConfig("f1cfg", cfg.f1);
      window.NT.refresh();
    }
    async function refreshAll() { await loadData(); render(); }

    function openSettings() {
      if (!window.NT) return;
      const leagues = window.NT.FOOTBALL_LEAGUES || [];
      const fields = [
        { type: "toggle", label: t("sport.football"), value: footballOn(),
          onChange: (v) => { cfg.sports = v ? Array.from(new Set(cfg.sports.concat("football"))) : cfg.sports.filter((s) => s !== "football"); saveCfg(); render(); openSettings(); } },
      ];
      if (footballOn()) {
        // Ligues — multiselect façon Discord (recherche + tags + logos)
        fields.push({ type: "multiselect", label: t("sport.leagues"), placeholder: t("ob.sports.leaguesPh"),
          items: leagues.map((l) => ({ value: l.code, label: l.name, logo: l.logo, emoji: "⚽" })),
          isSelected: (v) => leagueFollows().some((f) => f.comp === v),
          onToggle: (v) => { const arr = cfg.follows.football; const i = arr.findIndex((f) => f.type !== "team" && f.comp === v); if (i === -1) arr.push({ type: "league", comp: v }); else arr.splice(i, 1); saveCfg(); refreshAll(); } });
        // Équipes — choisir une ligue puis multiselect des équipes (recherche)
        fields.push({ type: "select", label: t("sport.addTeamLeague"), value: pendingTeamLeague || "",
          options: [{ v: "", t: t("sport.pick") }].concat(leagues.map((l) => ({ v: l.code, t: l.name }))),
          onChange: async (code) => { pendingTeamLeague = code || null; if (code && !teamsByComp[code]) teamsByComp[code] = await window.NT.footballTeams(code); openSettings(); } });
        if (pendingTeamLeague && teamsByComp[pendingTeamLeague]) {
          fields.push({ type: "multiselect", label: t("sport.addTeam"), placeholder: (LANG === "fr" ? "Rechercher une équipe…" : "Search a team…"),
            items: teamsByComp[pendingTeamLeague].map((tm) => ({ value: String(tm.id), label: tm.shortName || tm.name, logo: tm.crest, emoji: "⚽" })),
            isSelected: (v) => teamFollows().some((f) => String(f.id) === String(v)),
            onToggle: (v) => { const arr = cfg.follows.football; const i = arr.findIndex((f) => f.type === "team" && String(f.id) === String(v)); if (i === -1) { const tm = teamsByComp[pendingTeamLeague].find((x) => String(x.id) === String(v)); arr.push({ type: "team", id: String(v), name: tm ? (tm.shortName || tm.name) : v, comp: pendingTeamLeague, crest: tm ? tm.crest : "" }); } else arr.splice(i, 1); saveCfg(); refreshAll(); } });
        }
        fields.push({ type: "stepper", label: t("sport.rotate"), sub: t("sport.rotate.sub"), value: cfg.sport.rotate, min: 0, max: 120,
          onChange: (v) => { cfg.sport.rotate = v; saveCfg(); startRotation(); } });
        fields.push({ type: "segmented", label: t("sport.mode"), value: cfg.sport.mode,
          options: [{ v: "auto", t: t("sport.mode.auto") }, { v: "manual", t: t("sport.mode.manual") }],
          onChange: (v) => { cfg.sport.mode = v; saveCfg(); render(); } });
      }
      // Basket (toggle + multiselect ligues NBA/WNBA)
      fields.push({ type: "toggle", label: LANG === "fr" ? "Basket" : "Basketball", value: basketOn(),
        onChange: (v) => { cfg.sports = v ? Array.from(new Set(cfg.sports.concat("basketball"))) : cfg.sports.filter((s) => s !== "basketball"); if (v && !cfg.follows.basketball) cfg.follows.basketball = []; saveCfg(); refreshAll(); openSettings(); } });
      if (basketOn()) {
        const bl = (window.NT && window.NT.BASKET_LEAGUES) || [];
        fields.push({ type: "multiselect", label: LANG === "fr" ? "Ligues basket" : "Basket leagues", placeholder: t("sport.pick"),
          items: bl.map((l) => ({ value: l.code, label: l.name, logo: l.logo, emoji: "🏀" })),
          isSelected: (v) => basketFollows().some((f) => f.comp === v),
          onToggle: (v) => { if (!cfg.follows.basketball) cfg.follows.basketball = []; const arr = cfg.follows.basketball; const i = arr.findIndex((f) => f.comp === v); if (i === -1) arr.push({ type: "league", comp: v }); else arr.splice(i, 1); saveCfg(); refreshAll(); } });
      }
      // Tennis (toggle + multiselect circuits ATP/WTA)
      fields.push({ type: "toggle", label: "Tennis", value: tennisOn(),
        onChange: (v) => { cfg.sports = v ? Array.from(new Set(cfg.sports.concat("tennis"))) : cfg.sports.filter((s) => s !== "tennis"); if (v && !cfg.follows.tennis) cfg.follows.tennis = []; saveCfg(); refreshAll(); openSettings(); } });
      if (tennisOn()) {
        const tt = (window.NT && window.NT.TENNIS_TOURS) || [];
        fields.push({ type: "multiselect", label: LANG === "fr" ? "Circuits tennis" : "Tennis tours", placeholder: t("sport.pick"),
          items: tt.map((l) => ({ value: l.code, label: l.name, emoji: "🎾" })),
          isSelected: (v) => tennisFollows().some((f) => f.comp === v),
          onToggle: (v) => { if (!cfg.follows.tennis) cfg.follows.tennis = []; const arr = cfg.follows.tennis; const i = arr.findIndex((f) => f.comp === v); if (i === -1) arr.push({ type: "tour", comp: v }); else arr.splice(i, 1); saveCfg(); refreshAll(); } });
      }
      // F1 (toggle indépendant + pilote suivi optionnel)
      fields.push({ type: "toggle", label: LANG === "fr" ? "Formule 1" : "Formula 1", value: f1On(),
        onChange: (v) => { cfg.sports = v ? Array.from(new Set(cfg.sports.concat("f1"))) : cfg.sports.filter((s) => s !== "f1"); saveCfg(); refreshAll(); openSettings(); } });
      if (f1On() && f1drv.length) {
        fields.push({ type: "select", label: LANG === "fr" ? "Pilote suivi (surligné)" : "Followed driver", value: cfg.f1.driver || "",
          options: [{ v: "", t: t("sport.pick") }].concat(f1drv.map((s) => ({ v: s.Driver.driverId, t: s.Driver.givenName + " " + s.Driver.familyName }))),
          onChange: (id) => { cfg.f1.driver = id || null; saveCfg(); render(); } });
      }
      Settings.open(t("card.sport"), fields);
    }
    if (gear) gear.addEventListener("click", openSettings);

    let lastLoad = 0;
    whenNT(async function (NT) {
      try {
        cfg.sports = (await NT.storage.getConfig("sports", [])) || [];
        cfg.follows = (await NT.storage.getConfig("follows", { football: [] })) || { football: [] };
        if (!cfg.follows.football) cfg.follows.football = [];
        if (!cfg.follows.basketball) cfg.follows.basketball = [];
        if (!cfg.follows.tennis) cfg.follows.tennis = [];
        cfg.sport = Object.assign({ rotate: 60, mode: "auto" }, (await NT.storage.getConfig("sportCfg", {})) || {});
        cfg.f1 = Object.assign({ driver: null }, (await NT.storage.getConfig("f1cfg", {})) || {});
        cfg.notif = (await NT.storage.getConfig("notif", {})) || {};
        await loadData(); lastLoad = Date.now();
        render();
        NT.storage.onCacheChanged((key) => { if (key.indexOf("sport:") === 0 && Date.now() - lastLoad > 3000) { lastLoad = Date.now(); refreshAll(); } });
        setInterval(() => { lastLoad = Date.now(); refreshAll(); }, 90000);
      } catch (e) { console.warn("[sport]", e); render(); }
    });
  })();

  /* ============================================================
     AT A GLANCE (§3.8) — la barre hero alterne avec le score d'un match suivi
     EN DIRECT (exposé par le widget Sport via window.__ntHeadline).
     ============================================================ */
  (function glance() {
    const hero = document.querySelector(".hero"); const g = $("#glance");
    if (!hero || !g) return;
    let on = false, tick = 0;
    const nm = (s) => escHtml(s.team.shortName || s.team.name || "?");
    function fmt(h) {
      const sc = (h.home.score != null && h.away.score != null) ? (h.home.score + " – " + h.away.score) : "–";
      return '<div class="gl-tag">● ' + (LANG === "fr" ? "DIRECT" : "LIVE") + (h.minute ? " " + h.minute + "'" : "") + '</div>'
        + '<div class="gl-score"><span class="gl-team">' + nm(h.home) + '</span><b class="tnum">' + sc + '</b><span class="gl-team">' + nm(h.away) + '</span></div>';
    }
    function setOn(v) { if (v === on) return; on = v; hero.classList.toggle("glance-on", v); }
    setInterval(() => {
      const h = window.__ntHeadline;
      if (!h) { setOn(false); tick = 0; return; }
      g.innerHTML = fmt(h);
      tick++;
      setOn(Math.floor(tick / 8) % 2 === 1); // 8s horloge / 8s score live
    }, 1000);
  })();

  /* ============================================================
     ONBOARDING — assistant de premier lancement (universel).
     Collecte prénom · ville (météo) · compte Google · widgets, écrit la config
     puis recharge la page. Relançable depuis les réglages généraux.
     ============================================================ */
  const Onboarding = (function () {
    let overlay, step = 0;
    const state = { name: "", place: null, google: false, widgets: null };
    const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

    // autocomplétion ville inline (réutilise geocodeCity)
    function cityField(onPick) {
      const wrap = el("div", "ob-city");
      const inp = el("input", "ob-input"); inp.type = "text"; inp.placeholder = t("ob.city.ph"); inp.setAttribute("autocomplete", "off");
      const ac = el("div", "ob-ac");
      wrap.appendChild(inp); wrap.appendChild(ac);
      let timer = null, items = [], active = -1;
      const close = () => { ac.classList.remove("open"); ac.innerHTML = ""; items = []; active = -1; };
      const choose = (p) => { if (!p) return; inp.value = p.label; close(); onPick(p); };
      function paint(places) {
        items = places; active = -1;
        if (!places.length) { close(); return; }
        ac.innerHTML = places.map((p, i) => `<div class="ob-ac-item" data-i="${i}">${escHtml(p.label)}</div>`).join("");
        ac.classList.add("open");
        ac.querySelectorAll(".ob-ac-item").forEach((d) => d.addEventListener("mousedown", (e) => { e.preventDefault(); choose(places[+d.dataset.i]); }));
      }
      inp.addEventListener("input", () => {
        const q = inp.value.trim(); if (timer) clearTimeout(timer);
        if (q.length < 1) { close(); return; }
        timer = setTimeout(() => geocodeCity(q).then(paint).catch(close), 250);
      });
      inp.addEventListener("keydown", (e) => {
        if (!items.length) return;
        if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(active + 1, items.length - 1); }
        else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); }
        else if (e.key === "Enter") { e.preventDefault(); choose(items[active >= 0 ? active : 0]); return; }
        else return;
        ac.querySelectorAll(".ob-ac-item").forEach((d, i) => d.classList.toggle("active", i === active));
      });
      return wrap;
    }

    function stepWelcome(body, nav) {
      const img = el("img", "ob-logo"); img.src = (hasChrome && chrome.runtime) ? chrome.runtime.getURL("icons/icon128.png") : "icons/icon128.png"; img.alt = "";
      body.appendChild(img);
      body.appendChild(el("h2", "ob-title", t("ob.welcome.title")));
      body.appendChild(el("p", "ob-sub", t("ob.welcome.sub")));
      nav.next.textContent = t("ob.start");
    }
    function stepName(body) {
      body.appendChild(el("h2", "ob-title", t("ob.name.title")));
      body.appendChild(el("p", "ob-sub", t("ob.name.sub")));
      const inp = el("input", "ob-input"); inp.type = "text"; inp.placeholder = t("ob.name.ph"); inp.value = state.name;
      inp.addEventListener("input", () => { state.name = inp.value; });
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") overlay.querySelector(".ob-next").click(); });
      body.appendChild(inp); setTimeout(() => inp.focus(), 60);
    }
    function stepCity(body, nav) {
      body.appendChild(el("h2", "ob-title", t("ob.city.title")));
      body.appendChild(el("p", "ob-sub", t("ob.city.sub")));
      let userPicked = false;
      const field = cityField((p) => { state.place = p; userPicked = true; });
      body.appendChild(field);
      nav.skip.style.display = "";
      if (!state.place && navigator.geolocation) {
        const inp = field.querySelector(".ob-input");
        const ph = inp.placeholder;
        inp.placeholder = t("ob.city.detecting");
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            reverseGeocodeCity(pos.coords.latitude, pos.coords.longitude)
              .then((p) => { inp.placeholder = ph; if (userPicked) return; inp.value = p.label; state.place = p; })
              .catch(() => { inp.placeholder = ph; });
          },
          () => { inp.placeholder = ph; },
          { timeout: 5000, maximumAge: 600000 }
        );
      }
    }
    function stepGoogle(body, nav) {
      body.appendChild(el("h2", "ob-title", t("ob.google.title")));
      body.appendChild(el("p", "ob-sub", t("ob.google.sub")));
      const btn = el("button", "ob-gbtn" + (state.google ? " ok" : "")); btn.type = "button"; btn.textContent = state.google ? t("ob.google.ok") : t("ob.google.btn");
      btn.addEventListener("click", () => {
        btn.disabled = true; btn.textContent = t("ob.google.connecting");
        // vérifie réellement le token (appel API) avant d'afficher « Connecté »
        getToken(true)
          // vérifie le token sur l'API réellement autorisée par son scope (calendar.readonly) —
          // l'endpoint userinfo exige openid/email/profile, absents de ce scope, et renvoie 401 à tort.
          .then((tok) => fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1", { headers: { Authorization: "Bearer " + tok } })
            .then((r) => { if (!r.ok) { try { dropToken(tok); } catch (e) {} throw new Error("verify " + r.status); } }))
          .then(() => { state.google = true; btn.textContent = t("ob.google.ok"); btn.classList.add("ok"); btn.disabled = false; })
          .catch((e) => { console.error("[onboarding] Google connect failed:", e && e.message ? e.message : e); state.google = false; btn.textContent = t("ob.google.retry"); btn.classList.remove("ok"); btn.disabled = false; });
      });
      body.appendChild(btn);
      nav.skip.style.display = "";
    }
    function stepWidgets(body) {
      body.appendChild(el("h2", "ob-title", t("ob.widgets.title")));
      body.appendChild(el("p", "ob-sub", t("ob.widgets.sub")));
      if (!state.widgets) {
        const off = ["cs2", "sites"];   // niches → décochés par défaut
        state.widgets = {}; Layout.WIDGETS.forEach((w) => { state.widgets[w.k] = off.indexOf(w.k) === -1; });
      }
      const grid = el("div", "ob-grid");
      Layout.WIDGETS.forEach((w) => {
        const lbl = el("label", "ob-chip" + (state.widgets[w.k] ? " on" : ""));
        const c = el("input"); c.type = "checkbox"; c.checked = state.widgets[w.k];
        c.addEventListener("change", () => { state.widgets[w.k] = c.checked; lbl.classList.toggle("on", c.checked); });
        lbl.appendChild(c); lbl.appendChild(el("span", null, w.t)); grid.appendChild(lbl);
      });
      body.appendChild(grid);
    }
    // §3.7 — choix des sports (multi-select) + sections dynamiques (ligues football)
    function stepSports(body) {
      body.appendChild(el("h2", "ob-title", t("ob.sports.title")));
      body.appendChild(el("p", "ob-sub", t("ob.sports.sub")));
      if (!state.sports) state.sports = [];
      if (!state.leagues) state.leagues = [];
      const SPORTS = [
        { k: "football", t: t("sport.football"), emoji: "⚽" },
        { k: "f1", t: (LANG === "fr" ? "Formule 1" : "Formula 1"), emoji: "🏎️" },
        { k: "basketball", t: (LANG === "fr" ? "Basket" : "Basketball"), emoji: "🏀" },
        { k: "tennis", t: "Tennis", emoji: "🎾" },
      ];
      const grid = el("div", "ob-grid");
      SPORTS.forEach((s) => {
        const on = state.sports.indexOf(s.k) !== -1;
        const lbl = el("label", "ob-chip" + (on ? " on" : ""));
        const c = el("input"); c.type = "checkbox"; c.checked = on;
        c.addEventListener("change", () => { if (c.checked) { if (state.sports.indexOf(s.k) === -1) state.sports.push(s.k); } else state.sports = state.sports.filter((x) => x !== s.k); render(); });
        lbl.appendChild(c); lbl.appendChild(el("span", "ob-ic", s.emoji)); lbl.appendChild(el("span", null, s.t)); grid.appendChild(lbl);
      });
      body.appendChild(grid);
      if (state.sports.indexOf("football") !== -1) {
        const sec = el("div", "ob-section");
        sec.appendChild(el("h3", "ob-section-t", t("ob.sports.leagues")));
        const leagues = (window.NT && window.NT.FOOTBALL_LEAGUES) || [];
        const items = leagues.map((l) => ({ value: l.code, label: l.name, logo: l.logo, emoji: "⚽" }));
        sec.appendChild(multiSelect({
          items,
          placeholder: t("ob.sports.leaguesPh"),
          isSelected: (v) => state.leagues.indexOf(v) !== -1,
          onToggle: (v) => { const i = state.leagues.indexOf(v); if (i === -1) state.leagues.push(v); else { state.leagues.splice(i, 1); state.teams = (state.teams || []).filter((tm) => tm.comp !== v); render(); } },
        }));
        body.appendChild(sec);
        // Clubs / équipes nationales — uniquement parmi les compétitions déjà choisies
        // ci-dessus (une « équipe nationale » est juste une équipe au sein d'une
        // compétition comme la Coupe du monde ou l'Euro — même mécanisme que les clubs).
        if (state.leagues.length) {
          if (!state.teams) state.teams = [];
          const sec2 = el("div", "ob-section");
          sec2.appendChild(el("h3", "ob-section-t", t("ob.sports.teams")));
          const sel = el("select", "cfg-select");
          sel.innerHTML = '<option value="">' + escHtml(t("sport.pick")) + "</option>" +
            state.leagues.map((c) => '<option value="' + c + '"' + (c === state.pendingTeamLeague ? " selected" : "") + ">" + escHtml(leagues.find((l) => l.code === c) ? leagues.find((l) => l.code === c).name : c) + "</option>").join("");
          sec2.appendChild(sel);
          const slot = el("div", "ob-team-slot");
          sec2.appendChild(slot);
          function paintTeams() {
            slot.innerHTML = "";
            const code = state.pendingTeamLeague;
            if (!code) return;
            if (!state.teamsByComp) state.teamsByComp = {};
            if (state.teamsByComp[code]) {
              const tms = state.teamsByComp[code];
              slot.appendChild(multiSelect({
                items: tms.map((tm) => ({ value: String(tm.id), label: tm.shortName || tm.name, logo: tm.crest, emoji: "⚽" })),
                placeholder: t("sport.addTeam"),
                isSelected: (v) => state.teams.some((f) => String(f.id) === String(v)),
                onToggle: (v) => {
                  const i = state.teams.findIndex((f) => String(f.id) === String(v));
                  if (i === -1) { const tm = tms.find((x) => String(x.id) === String(v)); state.teams.push({ id: String(v), name: tm ? (tm.shortName || tm.name) : v, comp: code, crest: tm ? tm.crest : "" }); }
                  else state.teams.splice(i, 1);
                },
              }));
            } else {
              slot.textContent = t("common.loading");
              const ready = (NT) => { NT.footballTeams(code).then((tms) => { state.teamsByComp[code] = tms; paintTeams(); }).catch(() => { slot.textContent = ""; }); };
              if (window.NT) ready(window.NT); else window.addEventListener("nt:ready", () => ready(window.NT), { once: true });
            }
          }
          sel.addEventListener("change", () => { state.pendingTeamLeague = sel.value || null; paintTeams(); });
          if (!state.pendingTeamLeague) state.pendingTeamLeague = state.leagues[0];
          sel.value = state.pendingTeamLeague || "";
          paintTeams();
          body.appendChild(sec2);
        }
      }
    }
    function stepDone(body, nav) {
      body.appendChild(el("h2", "ob-title", t("ob.done.title", { name: state.name ? ", " + escHtml(state.name.trim()) : "" })));
      body.appendChild(el("p", "ob-sub", t("ob.done.sub")));
      nav.next.textContent = t("ob.done.btn");
    }

    // chaque étape évolue selon les choix précédents (ex: §3.7) ; `skip` masque
    // une étape devenue sans objet (widget désactivé) sans casser l'indexation.
    const STEPS = [
      { fn: stepWelcome },
      { fn: stepName },
      { fn: stepCity },
      { fn: stepGoogle },
      { fn: stepWidgets },
      { fn: stepSports, skip: () => !state.widgets || !state.widgets.sport },
      { fn: stepDone },
    ];
    const visibleSteps = () => STEPS.filter((s) => !s.skip || !s.skip());

    function finish() {
      if (state.name) CFG.set("user", "name", state.name.trim());
      if (state.place) { CFG.set("weather", "geo", false); CFG.set("weather", "place", { lat: state.place.lat, lon: state.place.lon, label: state.place.name }); }
      if (state.widgets) CFG.set("layout", "disabled", Layout.WIDGETS.filter((w) => !state.widgets[w.k]).map((w) => w.k));
      if (window.NT && state.widgets && state.widgets.sport) {
        if (state.sports) window.NT.storage.setConfig("sports", state.sports);
        const follows = { football: [] };
        if (state.leagues) follows.football = follows.football.concat(state.leagues.map((c) => ({ type: "league", comp: c })));
        if (state.teams) follows.football = follows.football.concat(state.teams.map((tm) => ({ type: "team", id: tm.id, name: tm.name, comp: tm.comp, crest: tm.crest })));
        window.NT.storage.setConfig("follows", follows);
      }
      if (SYNC) dbSet({ onboarded: true }, () => location.reload());
      else location.reload();
    }

    function render() {
      const body = overlay.querySelector(".ob-body");
      const nav = { back: overlay.querySelector(".ob-back"), skip: overlay.querySelector(".ob-skip"), next: overlay.querySelector(".ob-next") };
      body.innerHTML = "";
      const vis = visibleSteps();
      nav.back.style.display = step > 0 ? "" : "none";
      nav.skip.style.display = "none";
      nav.next.textContent = t("ob.continue");
      STEPS[step].fn(body, nav);
      const curIdx = vis.indexOf(STEPS[step]);
      overlay.querySelector(".ob-dots").innerHTML = vis.map((_, i) => `<i class="${i === curIdx ? "on" : ""}"></i>`).join("");
    }
    function go(d) {
      if (d > 0 && step === STEPS.length - 1) return finish();
      let s = step + d;
      while (s > 0 && s < STEPS.length - 1 && STEPS[s].skip && STEPS[s].skip()) s += d;
      step = Math.max(0, Math.min(STEPS.length - 1, s));
      render();
    }
    function build() {
      overlay = el("div", "ob-overlay");
      overlay.innerHTML =
        '<div class="ob-card">' +
        '  <div class="ob-body"></div>' +
        '  <div class="ob-dots"></div>' +
        '  <div class="ob-nav">' +
        '    <button type="button" class="ob-back">' + escHtml(t("ob.back")) + "</button>" +
        '    <span class="ob-spacer"></span>' +
        '    <button type="button" class="ob-skip">' + escHtml(t("common.later")) + "</button>" +
        '    <button type="button" class="ob-next">' + escHtml(t("ob.continue")) + "</button>" +
        '  </div>' +
        "</div>";
      document.body.appendChild(overlay);
      overlay.querySelector(".ob-back").addEventListener("click", () => go(-1));
      overlay.querySelector(".ob-skip").addEventListener("click", () => go(1));
      overlay.querySelector(".ob-next").addEventListener("click", () => go(1));
    }
    function start() {
      step = 0;
      state.name = CFG.get("user", "name", "") || "";
      state.place = null; state.google = false; state.widgets = null;
      state.sports = null; state.leagues = null; state.teams = null; state.teamsByComp = null; state.pendingTeamLeague = null;
      if (!overlay) build();
      overlay.classList.add("open");
      render();
    }

    // auto-lancement au tout premier démarrage
    if (SYNC) {
      dbGet({ onboarded: false }, (r) => { if (!r.onboarded) CFG.ready(start); });
    }
    return { start };
  })();
  window.Onboarding = Onboarding;
})();
