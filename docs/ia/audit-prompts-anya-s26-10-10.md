# Audit prompts Anya S26 — Itération 10/10

> Auteur : agent @ia (session S26)
> Date : 2026-05-29
> Scope : `extractChat` WhatsApp (cible principale) + extension aux autres prompts Anya du repo
> Statut : RAPPORT D'AUDIT — aucun `.ts` modifié, Thomas valide avant application

---

## Goal Thomas (verbatim, intégré dans la rubrique)

> « N'oublie pas que mon goal est d'avoir un contexte toujours à jour que ce soit projet, contacts ou autres, **de manière automatisée**. Vérifie également que ces changements ne sont pas applicables à d'autres endroits liés à Anya. »

→ Anya = mémoire automatique de Thomas. Pas de dichotomie pro/perso. Pas de demande manuelle. Tout flux (WhatsApp, email, CR, notes) alimente le vault — c'est l'objectif fondamental qui pilote toutes les notes de cette rubrique.

---

## Section 1 — Rubrique de scoring 10/10

Chaque critère vaut 1 point. Tout point requiert que le critère soit **explicite dans le prompt système** (pas juste « implicite »), sauf C8 où un ancrage dans le rapport est admis.

| # | Critère | Définition pour passer le point |
|---|---|---|
| C1 | **Identité explicite** | Le prompt nomme Anya, sa mission (assistante personnelle IA de Thomas Issa) et sa relation au vault Obsidian (mémoire automatique). |
| C2 | **Périmètre pro + perso** | Le prompt énumère explicitement les domaines pro (ISSA Capital, Gradient One, Versi Immo/Invest/Versimo, Sarani Studio, Immocrew) ET le perso (famille, amis, santé, voyages, organisation). « Un contact perso vaut une fiche au même titre qu'un contact pro. » |
| C3 | **Mémoire automatique (goal Thomas)** | Le prompt énonce qu'Anya alimente le vault automatiquement, sans demande manuelle. Le verbe d'action « inscrire dans le vault » ou « conserver pour dans 3 mois » est présent. |
| C4 | **Specs par champ JSON** | Chaque champ du JSON de sortie a une règle opérationnelle dédiée (1 puce par champ minimum), pas de flou résiduel. |
| C5 | **Tie-breakers explicites** | En cas de doute, le prompt indique CLAIREMENT quoi faire (ex : « En cas de doute, mets true »). Au moins 1 tie-breaker par champ ambigu. |
| C6 | **Red lines préservées** | « N'INVENTE JAMAIS d'email », todos = Thomas (pas Anya, pas l'interlocuteur), pas d'envoi auto, pas d'invention de contact. Présent verbatim. |
| C7 | **Robustesse JSON** | Format strict annoncé, clés exactes listées, types explicites (bool, string, array), valeur de fallback (`null` / `[]`) précisée pour chaque champ. |
| C8 | **Exemples / contre-exemples** | Le prompt OU le rapport inclut au moins 1 exemple concret « relevant=true » et 1 contre-exemple « relevant=false » pour ancrer le jugement. |
| C9 | **Cohérence founder-preferences** | Refus dichotomie pro/perso (S20 + S23), autonomie totale (S24), vault = SOT (R1), pas de questions parasites (R12). Visible dans le prompt. |
| C10 | **Concision** | Pas de redite, pas de phrase morte, le prompt fait son boulot en ≤ 35 lignes denses. Chaque phrase porte une règle opérationnelle. |

**Méta-règle** : on ne valide un point que si on pourrait montrer un extrait verbatim du prompt qui le porte. Pas de point « par défaut ».

---

## Section 2 — Inventaire des prompts Anya du repo

(rempli dans la passe suivante)

---

## Section 3 — Itération du prompt WhatsApp jusqu'à 10/10

(rempli dans la passe suivante)

---

## Section 4 — Prompt WhatsApp final 10/10

(rempli dans la passe suivante)

---

## Section 5 — Recommandations pour les AUTRES prompts Anya

(rempli dans la passe suivante)
