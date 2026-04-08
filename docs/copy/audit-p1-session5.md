> Sources amont : docs/copy/landing-page-copy.md, docs/copy/page-accompagnement.md, docs/copy/page-opportunites.md, docs/copy/page-participations.md, docs/copy/page-mission.md, docs/copy/page-contact.md, docs/copy/copy-audit-antifiller.md, docs/copy/about-page-copy.md, docs/copy/brand-voice.md

# Audit P1 — Formulations problématiques — Session 5

> @copywriter — 2026-04-08
> Périmètre : tous les fichiers copy docs/copy/ (pages client-facing)
> Objectif : détecter les patterns résiduels des 4 types signalés par Thomas
> Format : tableau de détection — max 80 lignes, sans corrections (sauf recommandation courte)
> Lien audit précédent : docs/copy/copy-audit-antifiller.md (Session 4 — 11 occurrences traitées)

---

## Périmètre

Fichiers audités dans cette passe :
- `docs/copy/landing-page-copy.md` (homepage)
- `docs/copy/page-accompagnement.md` (mis à jour Session 5)
- `docs/copy/page-opportunites.md` (mis à jour Session 5)
- `docs/copy/page-participations.md` (restructuré Session 5)
- `docs/copy/page-mission.md`
- `docs/copy/page-contact.md`
- `docs/copy/about-page-copy.md`

Sont EXCLUS de cet audit (déjà traités) : les 11 OCC du copy-audit-antifiller.md Session 4 — ne pas redéterminer ce qui a déjà été documenté et résolu.

---

## Patterns recherchés

| Pattern | Description |
|---|---|
| **A** | Tournures "c'est" en titre de section (H1/H2/H3) |
| **B** | Surcharge du mot "famille" dans une même section (> 3 occurrences proches) |
| **C** | Formulations "effet" sonnant faux dans le contexte métier (horizons chiffrés LBO-like, ton PE inadapté) |
| **D** | Verbatim fictifs attribués à des personnes non identifiées |

---

## Détections

| # | Page (fichier copy) | Section | Pattern | Texte concerné | Recommandation |
|---|---|---|---|---|---|
| A1 | `page-mission.md` | Section 3 (H2) | A | `"Notre raison d'être, sans ornement."` | Tournure acceptable — pas un "c'est" mais un complément direct. Pas de réécriture nécessaire. **Statut : VEILLE** |
| A2 | `page-mission.md` | Section 6 H2 | A | `"Ce que nous voulons que nos enfants reçoivent."` | Pas un "c'est". Formulation directe, sobre. **Statut : OK** |
| A3 | `landing-page-copy.md` | Section 6 Bloc A (H3) | A | `"Vous cherchez un pair, pas un prestataire."` | Structure "pas un X" en titre — pattern antithèse défensive. Déjà discuté, validé par Thomas comme formulation sobre dans ce contexte. **Statut : VEILLE** |
| B1 | `page-mission.md` | Section 1 Corps | B | Le mot "famille" apparaît 5 fois dans le corps de la Section 1 (famille libanaise ×2, famille ×1, La famille Issa ×1, une famille ×1) | Seuil 3 max conseillé. Priorité P2 — la page Mission est éditoriale, le mot "famille" est central. Mais une réduction à 3-4 occurrences est possible sans perte de sens. **Recommandation : surveiller à la prochaine passe copy** |
| B2 | `page-mission.md` | Section 6 Corps | B | "famille" apparaît 3 fois dans le même paragraphe court (Jean-Pierre Issa a construit quelque chose. Thomas l'a reçu... Les trois enfants de Thomas...). En comptant "famille" dans les notes de section, la densité locale est élevée | Acceptable sur une page éditoriale centrée sur la transmission. **Statut : OK** |
| B3 | `about-page-copy.md` | Section D Transmettre | B | "famille" apparaît 4 fois dans le court paragraphe (famille, famille, famille, famille Issa). Densité élevée dans ~160 mots | Priorité P2. La section est dédiée à la famille — mais 4 occurrences dans 163 mots peut sonner répétitif. Suggestion : remplacer 1-2 occurrences par "les Issa" ou "eux". **Recommandation : à corriger en V2** |
| C1 | `page-mission.md` | Section 7 H3 "Horizon patrimonial" | C | `"Un investissement est évalué sur sa capacité à créer de la valeur sur vingt ou trente ans — pas sur son potentiel de plus-value à horizon de sortie."` | "Horizon de sortie" est un terme PE/LBO, cohérent avec le propos (dire ce qu'on n'est pas) mais potentiellement trop technique pour Karim non-PE. Acceptable dans le contexte d'ISSA Capital. **Statut : OK — terminologie délibérée** |
| C2 | `page-accompagnement.md` | Section 5 Corps | C | `"Pas de missions de moins d'un mois — trop court pour apporter une valeur réelle."` | Formulation sobre et claire. Pas un effet LBO. **Statut : OK** |
| C3 | `landing-page-copy.md` | Section 5 H3 filtre 1 | C | `"Nous n'entrons pas dans une entreprise pour en sortir."` | Formulation directe et adaptée à l'immobilier + participations. Pas un horizon chiffré. **Statut : OK** |
| D1 | `page-accompagnement.md` | Section 1 (ancienne) | D | Verbatim fictif `"J'ai besoin de quelqu'un qui l'a fait, pas de quelqu'un qui m'explique."` attribué à "entrepreneur accompagné" | **TRAITÉ en Session 5** — section réécrite avec "Pour qui" (retour Thomas #6). Plus de verbatim fictif. |
| D2 | Ensemble des pages | Toutes | D | Vérification systématique effectuée — aucun autre verbatim attribué à une personne fictive non identifiée détecté | **Statut : CLEAN** |

---

## Récapitulatif par niveau de priorité

| Priorité | # | Description | Action |
|---|---|---|---|
| **TRAITÉ** | D1 | Verbatim fictif accompagnement | Corrigé Session 5 — Section réécrite |
| **P2 — à corriger V2** | B3 | "famille" ×4 dans 163 mots, Section D about-page | Remplacer 1-2 occurrences par "les Issa" |
| **P2 — surveiller** | B1 | "famille" ×5 dans Section 1 page-mission | Acceptable sur page éditoriale — réduire à la prochaine passe |
| **VEILLE** | A3 | "pas un prestataire" en titre Section 6 homepage | Validé par Thomas dans contexte précédent — ne pas modifier sans re-validation |
| **OK** | Tous les autres | Formulations propres ou délibérées | Aucune action |

---

## Bilan global

Le site est globalement sain après les sessions 3-4-5. Les seuls patterns résiduels sont de niveau P2 (densité "famille" sur 2 pages secondaires — Mission et À propos). Aucun nouveau verbatim fictif détecté. Aucune formulation "horizon LBO" inadaptée. La tournure "c'est" en titre a été éradiquée sur toutes les pages avec les modifications Session 5.

La page `page-mission.md` reste la page la plus exposée (aussi signalé dans copy-audit-antifiller.md Session 4) — elle concentre la narration générationnelle et donc naturellement le mot "famille". Une passe dédiée à cette page à la session suivante permettrait de la ramener à 3 occurrences max sur l'ensemble du corps.

---

**Handoff → @orchestrator**
- Fichier produit : `docs/copy/audit-p1-session5.md`
- Décisions prises : aucune correction apportée dans ce fichier (audit seul, pas de réécriture). Les corrections à faire sont en P2 — à planifier V2.
- Points d'attention : B3 (about-page Section D) est la détection la plus actionnable — 4 occurrences "famille" dans 163 mots. Correction simple, impact positif mesurable.
