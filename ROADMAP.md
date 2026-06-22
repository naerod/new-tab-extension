# ROADMAP — Nouvel Onglet

## V1 (en cours)
- **Phase A — Architecture commune** : storage (config/cache), service worker + alarms, providers (types/adapters/registry/tier), routing mini-SPA, thèmes (clair/sombre), accent recherche par moteur, onboarding générique, "At a Glance" slider, Pro gating (sans paiement).
- **Phase B — Widget Sport** : football → basket → F1 → tennis ; widget compact paginé (auto/manuel) ; vue plein écran ; compétitions spéciales ; notifications.

## Différé (NE PAS coder en V1 — documenté ici)
- **Widget Gaming** (refonte cs2/premier) : vide par défaut ; activation de ~15 jeux populaires (CS2, Valorant, LoL, Dota 2, Fortnite, Apex, Rocket League, Overwatch 2, R6 Siege, CoD/Warzone, Minecraft, GTA Online, PUBG, TFT, EA FC). Par jeu : rang/élo perso (clé API type Faceit/Leetify) et/ou news & patchs. Mêmes principes transverses.
- **Widget e-sport** : mêmes principes que le widget sport.
- **Plus de sports** au-delà de foot/basket/F1/tennis.
- **Providers Pro payants** + **page d'abonnement Pro/Premium mensuel** (système de paiement à développer entièrement — couvre les API payantes : live seconde-par-seconde, stats joueur fines).
- **i18n EN complet** (les libellés des roues ⚙ par widget restent à traduire).
- **Publication Chrome Web Store** : vérification Google des scopes Gmail/Calendar (restricted/sensitive), captures, politique de confidentialité, .zip, compte dev.

## Décidé / non couvert par le brief
- Toute décision hors périmètre est consignée dans `docs/DECISIONS.md`.
