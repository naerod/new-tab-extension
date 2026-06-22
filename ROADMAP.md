# ROADMAP — Nouvel Onglet

## V1 — FAIT (cœur du brief, v0.1.0 → v0.12.0)
### Phase A — Architecture commune
- ✅ Couche **storage** (config sync compacte/debounce + cache local TTL).
- ✅ **Service worker** + `chrome.alarms` (polling cache-first, football + basket + notifs).
- ✅ Couche **providers** (types internes, registry capacités + tier free/pro, adapters football-data/ESPN/Jolpica/TheSportsDB).
- ✅ **Routing** : vue détaillée en **grande pop-up** pour tous les widgets (sauf agenda) ; sport a une vue dédiée riche.
- ✅ **Thèmes** sombre + clair (clair refait, validé).
- ✅ **Accent de recherche** par moteur (§3.6).
- ✅ **Onboarding** générique + **étape Sports** (§3.7).
- ✅ Barre **At a Glance** (§3.8) — score live alterné.
- ✅ **Pro gating** (capacités + tier ; aucun paiement).

### Phase B — Widget Sport
- ✅ **Football** : ligues + **équipes** (suivi, autocomplétion), compact **§4.2** (équipe + voisins + top/bottom), vue plein écran (résultats/à venir/classement complet), **forme V/N/D** colorée.
- ✅ **F1** : 2 championnats + **séances en heure de Paris**, pilote suivi surligné.
- ✅ **Basket** (NBA/WNBA, ESPN).
- ✅ **Tennis** (ATP/WTA, TheSportsDB — événements ; bornée).
- ✅ Widget paginé (**≤9 pages**), **rotation auto** (configurable), ordre **For You/manuel** réordonnable.
- ✅ **Notifications** par entité (cloche off par défaut, permission à l'activation, diff start/but/résultat dans le SW).
- ✅ Compétitions : suivre **CL/EL** = classement de phase de ligue + matchs ; affiches/résultats du jour via le suivi de la compétition.

## À retravailler / borné — différé (justifié)
- **Thème clair** : validé provisoirement (v0.1.1), polish + passe WCAG complète à refaire plus tard.
- **Tennis** : classements ATP/WTA + tableau (draw) — non disponibles en clé gratuite TheSportsDB (§4.4 « contenu délégué »).
- **Basket** : classements (ESPN standings) — à ajouter.
- **Compétitions spéciales (§4.5)** — parties « léger et borné » non faites : **bracket** (arbre d'élimination), **habillage événementiel** (accents CDM/RG…), **apparition automatique** d'un major non suivi + bouton désactiver. Le cœur (suivi CL/EL avec classement de phase + matchs du jour) est fait.
- **F1 live** : timing séance en direct (OpenF1) — différé ; les horaires/championnats (Jolpica) sont faits.
- **Player follow football** (stats joueur) — la mécanique équipe/pilote existe ; joueur foot à étoffer.

## Hors V1 (NE PAS coder — documenté)
- **Widget Gaming** (refonte cs2/premier) : ~15 jeux, rang/élo perso + news/patchs.
- **Widget e-sport** : mêmes principes que le sport.
- **Plus de sports** (au-delà de foot/basket/F1/tennis).
- **Providers Pro payants** + **page d'abonnement Pro/Premium** (paiement à développer).
- **i18n EN complet** (libellés des roues ⚙ par widget).
- **Publication Chrome Web Store** : vérif Google scopes Gmail/Calendar, captures, politique de confidentialité, .zip, compte dev.

## Décisions
- Voir `docs/DECISIONS.md` (ADR-001…009).
