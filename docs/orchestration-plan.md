# Orchestration Plan — ISSA Capital

> Plan d'exécution maître + mémo de reprise entre sessions.
> Maintenu par @orchestrator.
> Dernière mise à jour : **2026-04-08 — Session 5 COMPLETE — GO CONDITIONNEL 9.4/10**

<!-- SESSION: phases=8 tasks_prod=10 tasks_consult=0 -->

---

## SESSION 5 — Exécution 8 retours Thomas + favicon refonte (COMPLETE)

**Branche** : `claude/resume-issa-session-5-zZVP2`
**Date** : 2026-04-08
**Verdict final** : **GO CONDITIONNEL 9.4/10** (@reviewer Phase E)
**Budget Tasks producteurs** : 10/18 utilisés (Phase A.2 + B + C + D×2 + C2copy + C2tsx + C3design + C3tsx + E)
**Pipeline G28 final** : tsc 0 / lint 0 / vitest 7/7 / next build 16 routes / playwright 154 PASS 2 skipped 0 failed

### Les 8 retours Thomas — STATUT FINAL

| # | Page | Owner | Statut | Commit |
|---|---|---|---|---|
| 1 | / homepage hero | @fullstack | ✅ DONE | `65c274c` (2e CTA "Être accompagné" variant secondary) |
| 2 | / homepage participations | @fullstack | ✅ DONE | `65c274c` (limite 3 cards : Gradient One + Versi Immobilier + Versi Invest) |
| 3 | / section "Notre raison d'être" | @copywriter → @fullstack | ✅ DONE | `338ca33` + `65c274c` (1 occurrence "famille", titre "Une holding née d'une lignée.") |
| 4 | nav top "À propos" | @fullstack | ✅ DONE | `65c274c` (item dans siteConfig.nav) |
| 5 | nav top scroll-to-top | @fullstack | ✅ DONE | `65c274c` (Header.tsx onClick) |
| 6 | /accompagnement verbatim fictif | @creative-strategy → @copywriter → @fullstack | ✅ DONE | `c66186a` + `338ca33` + `65c274c` + correction Phase C2 (P1-1) `4d41f48` + `1c29011` |
| 7 | /opportunites "Vingt ans devant" | @copywriter → @fullstack | ✅ DONE | `338ca33` + `65c274c` ("La pierre s'inscrit dans le temps long...") |
| 8 | /participations consolidation | @creative-strategy → @copywriter → @fullstack | ✅ DONE | `98fadcc` + `338ca33` + `65c274c` (architecture 5 sections, grid 12 col, suppression redondance) |

### Phases exécutées

| Phase | Owner | Livrables | Commit | Statut |
|---|---|---|---|---|
| A.1 | @creative-strategy | accompagnement-restructure.md | `c66186a` | ✅ DONE |
| A.2 | @creative-strategy | participations-restructure.md | `98fadcc` | ✅ DONE |
| B | @copywriter | 4 copy édités + audit-p1-session5.md | `338ca33` | ✅ DONE |
| C | @fullstack | 5 TSX modifiés + 24 baselines régénérées + pipeline G28 green | `65c274c` | ✅ DONE |
| D testeur-karim | @testeur-karim | testeur-karim-session5.md (GO CONDITIONNEL 8.5/10) | `ce5491a` | ✅ DONE |
| D qa | @qa | qa-session5-report.md (GO intégral) | `ac212c4` | ✅ DONE |
| C2 copy corrective | @copywriter | about-page-copy.md (P0-1 Option B) + page-accompagnement.md (P1-1 Option α) | `4d41f48` | ✅ DONE |
| C2 propagation TSX | @fullstack | a-propos/page.tsx + accompagnement/page.tsx + 6 baselines + pipeline green | `1c29011` | ✅ DONE |
| C3 favicon design | @design | favicon-redesign-session5.md + favicon.svg Direction A | `1f6dc27` | ✅ DONE |
| C3 favicon propagation | @fullstack | 8 SVG sync + binaires régénérés + apple-touch-icon.svg créé + pipeline green | `3304597` | ✅ DONE |
| E reviewer | @reviewer | cross-review-session5.md (GO CONDITIONNEL 9.4/10) | `3cfc3c3` | ✅ DONE |

### Frictions résiduelles reportées session 6

| ID | Sévérité | Description | Action requise |
|---|---|---|---|
| P1-2 | P1 valeur perçue | Section 4 Filiation Jean-Pierre absente du code homepage TSX (existe dans landing-page-copy.md Modif 3) | Décision Thomas : ajouter en homepage TSX OU maintenir delta éditorial copy/TSX |
| P1-3 | P1 narratif | /a-propos Section C : "Il rejoint Sony, puis TEOS" laisse penser à 2 étapes alors que TEOS est né chez Sony | 1 Edit copy + TSX |
| P2-1 | P2 | /participations Versi Invest "Participation phare" sans contexte (créée 2026, pas de site) | Phrase d'explication ou repositionnement éditorial |
| P2-2 | P2 | Homepage Section 6 répète bifurcation hero | Audit @ux si retour confirme |
| P2-3 | P2 cosmétique | docs/qa/TESTING.md ligne 54 "21 baselines/7 pages" → réalité "24 baselines/8 pages" | 1 Edit @qa |

### Verrous Thomas — Q1-Q5 (info contexte)

- **Q1** Option B typo (52/32/26) : GARDÉE
- **Q2** Sony/TikTok/Adidas/Lego : **GO mention nominative** — exception explicite à CLAUDE.md n°14, validée par Thomas
- **Q3** OCC-11 "d'une famille libanaise" : GARDÉE
- **Q4** Versi Invest layout : caduque (intégrée dans #2 + #8)
- **Q5** Portraits : reportée

---

## SESSIONS PRÉCÉDENTES (archive)

