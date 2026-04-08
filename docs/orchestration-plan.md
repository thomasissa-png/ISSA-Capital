# Orchestration Plan — ISSA Capital

> Plan d'exécution maître + mémo de reprise entre sessions.
> Maintenu par @orchestrator.
> Dernière mise à jour : **2026-04-08 — Session 6 démarrée (Étape 2 propagation learnings session 5 DONE, plan retours Thomas en attente validation)**

<!-- SESSION: phases=0 tasks_prod=1 tasks_consult=0 -->

---

## Session 6 — Plan d'exécution retours Thomas

**Branche** : `claude/resume-issa-session-6-XXXX` (à confirmer)
**Date** : 2026-04-08
**État au lancement** : Étape 2 (propagation 6 learnings session 5) DONE, committée `9bde9ef`. Compteur 1/18 Task producteur.
**Mode** : autopilot avec checkpoints Thomas (2 blocages tranchage explicites)
**Principe directeur #0** : VITRINE (non-conversion) — calibration de tous les copy/UX
**Verrous transverses** : identité libanaise jamais française · zéro mention nom agence Thomas · UTF-8 réel · Simplicité > Démonstration > Élégance (P0 verrouillée — vigilance point 4 sur l'écueil "trop littéraire/pompeux")

### Les 5 retours Thomas — synthèse

| # | Page(s) | Nature | Owner principal | Bloque sur |
|---|---|---|---|---|
| 1 | / homepage "Notre raison d'être" | Edit copy court (suppression incipit) | @fullstack + @copywriter (sync copy) | Aucun (action chirurgicale) |
| 2 | / homepage "Participation phare" Gradient One | Réécriture éditoriale "3 générations" | @creative-strategy → @copywriter → @fullstack | Décision Thomas (2-3 options) |
| 3 | / homepage "Notre écosystème" Gradient One + Versi Invest | Reformulation 2 blocs | @copywriter → @fullstack | Décision Thomas point 2 (cohérence Gradient One inter-sections) |
| 4 | / + /participations Filtres "Préservation environnement" + "Éthique humaine" | Réécriture de fond — 2 options A/B par filtre | @copywriter → @fullstack | Décision Thomas (4 options à trancher) |
| 5 | /mission vs /a-propos | Audit différentiel + recommandation fusion ou maintien | @creative-strategy → (si fusion) @copywriter + @fullstack | Décision Thomas (structurelle, impact nav + sitemap) |

### Ordre d'exécution proposé

**Phase 1 — Audits stratégiques parallèles (2 Tasks producteurs simultanés)**

Lancement dans le même message :
- **Task A** — `@creative-strategy` : audit différentiel `/mission` vs `/a-propos` → livrable `docs/strategy/mission-vs-apropos-audit.md` (point 5)
  - Lit `src/app/mission/page.tsx` + `src/app/a-propos/page.tsx`
  - Produit : tableau comparatif sections, diagnostic doublon, recommandation tranchée (fusion / maintien refondu), plan de migration si fusion (éléments à conserver/couper, impact nav, sitemap, liens internes)
- **Task B** — `@creative-strategy` : options narratives "3 générations / filiation / héritage" pour la "Participation phare" Gradient One → livrable court `docs/strategy/gradient-one-angle-options.md` (point 2)
  - Lit `docs/strategy/brand-platform.md` + `docs/strategy/personas.md` + section actuelle `src/app/page.tsx`
  - Produit : 2-3 reformulations orientées 3 générations (pas data corporate), avec justification éditoriale par option, alignement voix marque

**→ CHECKPOINT THOMAS #1** : remontée des 2 livrables. Thomas tranche :
- (a) fusion vs maintien Mission/À propos
- (b) option narrative Gradient One retenue (A/B/C)

**Phase 2 — Production copy + Edit chirurgical TSX (3 Tasks producteurs)**

Lancement dans le même message (3 Tasks max conformément règle anti-timeout) :
- **Task C** — `@copywriter` : réécriture des 2 filtres "Préservation environnement" + "Éthique humaine" — 2 options A/B par filtre (4 textes au total) → ajout dans `docs/copy/landing-page-copy.md` section dédiée + handoff structuré (point 4)
  - Contraintes : conserver fermeté du filtre non négociable, éviter ton "mots d'enfant", cohérence brand-voice (retenue, gravité sobre, zéro pathos), éviter écueil inverse "trop littéraire/pompeux" (P0 Simplicité > Démonstration > Élégance)
- **Task D** — `@copywriter` : reformulation blocs "Notre écosystème" Gradient One (suppression "50% ISSA Capital") + Versi Invest ("Co-acquisitions format type club deal + accompagnement") + intégration de l'option Gradient One tranchée par Thomas pour la "Participation phare" → édits dans `docs/copy/landing-page-copy.md` (points 2 + 3)
- **Task E** — `@fullstack` : Edit chirurgical TSX point 1 uniquement (suppression incipit "Cette holding n'est pas née en 2026.") + propagation `docs/copy/landing-page-copy.md` correspondante + régénération baselines Playwright section impactée + pipeline G28 vert (point 1)
  - Indépendant des autres tasks, action courte, ne pas attendre

**→ CHECKPOINT THOMAS #2** : remontée des 4 textes filtres + 3 textes Gradient One/Versi Invest. Thomas tranche :
- (c) option A ou B pour chaque filtre (2 décisions)
- (d) validation textes Gradient One / Versi Invest (ou ajustement)

**Phase 3 — Propagation TSX consolidée (1 Task producteur)**

- **Task F** — `@fullstack` : propagation TSX en un seul passage des points 2, 3, 4 (homepage + page participations si filtres dupliqués) + régénération de TOUTES les baselines impactées sur 3 devices + pipeline G28 vert
  - Vérifie identité libanaise + UTF-8 réel + zéro mention agence
  - Vérifie cohérence copy `docs/copy/landing-page-copy.md` ↔ TSX (gate G7)

**Phase 4 — QA + revue testeur-persona (2 Tasks consultation/producteur)**

- **Task G** — `@qa` : tests E2E sur les sections modifiées + re-run pipeline complet (tsc/lint/vitest/next build/playwright)
- **Task H** — `@testeur-karim` : ré-évaluation gates GP1-GP10 sur les sections retouchées (focus GP3 crédibilité + GP8 look & feel + GP9 outputs utiles pour les filtres)

**Phase 5 — CONDITIONNELLE : chantier fusion Mission/À propos (si Thomas tranche "fusion")**

Si Thomas valide la fusion en checkpoint #1 :
- **Task I** — `@copywriter` : refonte page Mission absorbant les éléments uniques d'À propos
- **Task J** — `@fullstack` : suppression `src/app/a-propos/page.tsx` + retrait nav `siteConfig.nav` + mise à jour `sitemap.ts` + redirections 301 si nécessaire + grep liens internes orphelins + baselines + pipeline G28
- **Task K** — `@qa` : vérification non-régression nav + sitemap + liens internes

Si Thomas tranche "maintien refondu" : Phase 5 = chantier copy léger sur les 2 pages (différenciation narrative claire), à scoper en sortie de checkpoint #1.

### Budget Tasks producteurs estimé

| Phase | Tasks | Cumul session 6 |
|---|---|---|
| Étape 2 propagation learnings (DONE) | 1 | 1/18 |
| Phase 1 audits | 2 | 3/18 |
| Phase 2 copy + edit chirurgical | 3 | 6/18 |
| Phase 3 propagation TSX | 1 | 7/18 |
| Phase 4 QA + testeur | 2 | 9/18 |
| Phase 5 (si fusion) | 3 | 12/18 |
| **Total max** | **12** | **12/18** ✅ marge 6 |

Marge confortable sous le seuil ALERTE ROUGE (18). Pas de risque de saturation contexte sur cette session.

### Risques et points d'attention

- **R1** : point 4 (filtres) — risque que les options A/B tombent dans l'écueil inverse "trop littéraire/pompeux". Brief @copywriter doit explicitement citer P0 Simplicité > Démonstration > Élégance + exemple anti-pattern à éviter.
- **R2** : point 5 (Mission/À propos) — décision structurelle qui peut invalider du contenu déjà produit en sessions 1-5. @creative-strategy doit lister ce qui serait perdu en cas de fusion.
- **R3** : point 2 (Gradient One narratif) — risque d'incohérence si l'option "3 générations" choisie ne se raccroche pas à la lignée déjà narrée en homepage Section "Notre raison d'être" (issue session 5 retour #3). @creative-strategy doit vérifier l'alignement avec `landing-page-copy.md` Modif 3.
- **R4** : régénération baselines Playwright — Phase 2 (Task E) régénère certaines baselines, Phase 3 (Task F) en régénère d'autres. Risque de drift si les deux phases touchent les mêmes sections. À séquencer strictement Phase 2 → Phase 3 (pas de chevauchement).
- **R5** : déterminer si les "Filtres de décision" sont sur homepage uniquement, page `/participations`, ou les deux — Grep nécessaire en début Phase 2 par @copywriter pour cartographier tous les emplacements avant édit.

### Status

**EN ATTENTE VALIDATION main thread / Thomas avant lancement Phase 1.**

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

