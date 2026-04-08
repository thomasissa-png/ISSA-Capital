# Orchestration Plan — ISSA Capital

> Plan d'exécution maître + mémo de reprise entre sessions.
> Maintenu par @orchestrator.
> Dernière mise à jour : **2026-04-08 — Session 5 Phase A LANCÉE**

<!-- SESSION: phases=0 tasks_prod=0 tasks_consult=0 -->

---

## SESSION 5 — Exécution 8 retours Thomas (en cours)

**Branche** : `claude/resume-issa-session-5-zZVP2`
**Date** : 2026-04-08
**Budget Tasks producteurs** : 0/18 utilisés (seuil ALERTE ROUGE = 18)

### Les 8 retours Thomas

| # | Page | Owner principal | Statut | Description |
|---|---|---|---|---|
| 1 | / (homepage) | @fullstack | À FAIRE | Ajout 2e CTA "Besoin d'être accompagné ?" hero (layout horizontal desktop, empilé mobile) → /accompagnement |
| 2 | / (homepage) | @fullstack | À FAIRE | INSISTANCE P0 — Limiter à 3 participations (Gradient One + Versi Immobilier + Versi Invest), reste sur /participations exclusivement |
| 3 | / section "Notre raison d'être" | @copywriter → @fullstack | À FAIRE | Réécriture : réduire "famille" (~9 occ) à 2-3 max + retirer "C'est" en ouverture du titre |
| 4 | nav top | @fullstack | À FAIRE | Ajouter item "À propos" dans nav top desktop+mobile |
| 5 | nav top | @fullstack | À FAIRE | Scroll-to-top au clic sur item du menu top (window.scrollTo top:0) |
| 6 | /accompagnement | @creative-strategy → @copywriter → @fullstack | EN COURS Phase A.1 | Supprimer verbatim fictif "J'ai besoin de quelqu'un qui l'a fait" attribué à un "entrepreneur accompagné" inexistant + restructurer pour Karim |
| 7 | /opportunites | @copywriter → @fullstack | À FAIRE | Remplacer "Vingt ans devant. Pas de sortie prévue." (cycle immo ≠ 20 ans) + audit cross-pages formulations décalées |
| 8 | /participations | @creative-strategy → @copywriter → @fullstack | EN COURS Phase A.2 | Consolider haut de page (Participation directe + Univers Gradient One + Au sein de Gradient One = 3 blocs redondants → 1 ou 2 blocs) |

### Phase A — Stratégie (PARALLÈLE — en cours)

- [LANCÉ] **Task A.1** — @creative-strategy → restructure /accompagnement → `docs/strategy/accompagnement-restructure.md`
- [LANCÉ] **Task A.2** — @creative-strategy → restructure /participations → `docs/strategy/participations-restructure.md`

### Phase B — Copy (À LANCER après A)
- @copywriter → réécriture homepage "Notre raison d'être" (#3)
- @copywriter → nouveau copy /accompagnement (#6) + remplacement /opportunites "Vingt ans" (#7) + copy /participations consolidé (#8) + audit P1 cross-pages

### Phase C — Implémentation (À LANCER après B)
- @fullstack → tous les retours (#1 #2 #3 #4 #5 #6 #7 #8) + régénération baselines Playwright

### Phase D — Tests (À LANCER après C)
- @testeur-karim → audit GP1-GP10 sur /accompagnement restructurée + /a-propos + /participations consolidée + homepage
- @qa → pipeline tsc + lint + vitest + next build + Playwright

### Phase E — Validation
- @reviewer → gates 32 sur livrables session 5

### Verrous Thomas — Q1-Q5 (info contexte)

- **Q1** Option B typo (52/32/26) : GARDÉE
- **Q2** Sony/TikTok/Adidas/Lego : **GO mention nominative** — exception explicite à CLAUDE.md n°14, validée par Thomas
- **Q3** OCC-11 "d'une famille libanaise" : GARDÉE
- **Q4** Versi Invest layout : caduque (intégrée dans #2 + #8)
- **Q5** Portraits : reportée

---

## SESSIONS PRÉCÉDENTES (archive)

