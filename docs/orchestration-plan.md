# Orchestration Plan — ISSA Capital

> Plan d'exécution maître + mémo de reprise entre sessions.
> Maintenu par @orchestrator.
> Dernière mise à jour : **2026-05-10 — Session 9 CLÔTURÉE (91 commits, 68 tests)**

<!-- SESSION: phases=completed tasks_prod=91_commits tasks_consult=0 -->
<!-- BRANCH ACTIVE: claude/resume-issa-session-9-Y9WBK -->

---

## Session 9 — CLÔTURÉE (2026-04-09 → 2026-05-10)

**Branche** : `claude/resume-issa-session-9-Y9WBK` (91 commits)

**Livrables majeurs** :
- ✅ Phase 0 : Propagation 8 learnings sessions 7-8 (10 fichiers agents)
- ✅ Site vitrine converti en monopage (nav vidé, 6 sections, FAQ JSON-LD)
- ✅ Bot Telegram "Anya" complet (webhook, Claude API, photos, PDF, Drive, 68 tests)
- ✅ SEO/GEO optimisés 10/10 (JSON-LD enrichi, robots.ts 11 bots IA, llms.txt)
- ✅ Claude Profile 9 fichiers (score @ia 9.96/10)
- ✅ Second cerveau Obsidian (vault complet + 7 templates + SETUP)
- ✅ Pipeline LinkedIn triple audit >= 9/10 établi
- ✅ Umami Analytics intégré (Plausible retiré)
- ✅ Clôture : propagation P0/P1 + archivage + docs/founder-preferences.md créé

**Phase 8 — Actions Thomas** : ⏳ NON DÉMARRÉES
- 12 actions documentées dans le mémo de reprise session 9 (project-context.md)

**Session 10** : branche recommandée `claude/issa-capital-s10-deploy-anya-[suffix]`
- Priorité 1 : déploiement bot Anya (webhook Telegram + Secrets Replit)
- Priorité 2 : si Phase 8 faite → activation production

---

## Session 7-8 — CLÔTURÉE (2026-04-08/09)

**Branche active session 7** : `claude/resume-issa-session-7-1SjaO` (imposée par la configuration git du harness, créée à partir de `claude/resume-issa-session-6-UDiOS`)

**Compteur session 7** : **0/18 Tasks producteurs** (Phase 0 propagation learnings = 0 Task, travail direct orchestrateur)

**Phase 0 — Propagation des 8 learnings session 6** : ✅ DONE
- L1 (P1) Date factuelle 2J 1994→2016 : CLAUDE.md règle 2 (déjà propagée session 6) + copywriter.md + creative-strategy.md (ajout section "Vérification des faits biographiques")
- L2 (P2) Parcours bio incomplet : n/a local (`templates/` inexistant) — propagé indirectement via copywriter.md point 3 "Enfance et jeunesse comptent"
- L3 (P2) Mode itération jusqu'à N/10 : creative-strategy.md + copywriter.md + design.md (nouvelle section dans chaque)
- L4 (P2) Pre-commit WIP Stop hook : orchestrator.md section "Gestion Stop hook + Tasks en background"
- L5 (P2) Parallélisation CS project-context.md : orchestrator.md + creative-strategy.md (nouvelles sections)
- L6 (P2) Volume biographique calibré : CLAUDE.md règle commune 16 + copywriter.md + creative-strategy.md
- L7 (P1) Anti-justifications explicites : copywriter.md section "Anti-justifications explicites" avec signaux + exemples. founder-preferences.md n/a local
- L8 (P3) Chiffres narratifs vs factuels : CLAUDE.md règle commune 17 + creative-strategy.md + copywriter.md

**Mise à jour nom de branche (règle 12 CLAUDE.md)** : ✅ DONE
- `project-context.md` mémo de reprise actualisé (ligne 728)
- `docs/orchestration-plan.md` (ce fichier) : section Session 7 ajoutée avec BRANCH ACTIVE
- Pas d'`index.html` / `INSTALL.md` / `install.sh` / `update.sh` dans ce repo projet

**CHECKPOINT #5 en attente Thomas** : 🔴 BLOQUANT
- Décision 1 — Direction favicon (Sceau ⭐ / Cèdre / I monumental / libre)
- Décision 2 — /accompagnement variante A duo opérationnel (9.5/10) vs C maison et héritier (9.4/10)

**Prochaine étape** : après réponses Thomas → Phase 7 mega-passe @fullstack (1 Task consolidée) → Phase Favicon (2 Tasks) → Phase QA (2 Tasks). Budget projeté ~5/18.

---

## Session 6 — CLÔTURE (2026-04-08)

**Verdict session 6** : **CLÔTURÉE SANS IMPLÉMENTATION PHASE 7** — à la demande de Thomas en fin de session ("non finissons proprement puis changeons de session"). Les 3 livrables stratégiques (mission RICHE v2 + participations Variante A + accompagnement A ou C) sont produits et committés mais NON appliqués dans le TSX. Ils seront implémentés en début de session 7 après tranche des 2 décisions bloquantes.

**Branche finale** : `claude/resume-issa-session-6-UDiOS` (HEAD `01bd819` + commit de clôture à venir)

**Compteur Tasks producteurs utilisés** : **15/18** (marge 3 sous seuil ALERTE ROUGE)

**Pipeline G28 final session 6** :
- `tsc --noEmit` : **0 erreur**
- `eslint .` : **0 erreur**
- `vitest run` : **7/7 PASS**
- `next build` : non re-testé en fin de clôture (dernier check Phase 6a = 15 routes PASS)
- Playwright : 21 baselines régénérées en Phase 3+5 fusion + 6 baselines supplémentaires en Phase 6a

### Les 6 retours Thomas session 6 — STATUT FINAL

| # | Page(s) | Action Thomas | Statut final |
|---|---|---|---|
| 1 | / homepage incipit "Notre raison d'être" | Suppression "Cette holding n'est pas née en 2026." | ✅ DONE (Phase 2 vague 2.1) — commit `0b1c42a` |
| 2 | / homepage "Participation phare" Gradient One | Réécriture "3 générations" | ✅ DONE v1 (Phase 2+3+5) puis RECORRECTION Phase 6a (stats 2020/6/3 remises, label "Participation phare" retiré) — mais Thomas a ensuite demandé de RETIRER aussi le texte éditorial Prop 1 + sous-titre + description → **EN ATTENTE Phase 7** (homepage stats-only strict, sans texte) |
| 3 | / homepage "Notre écosystème" Gradient One + Versi Invest | Reformulation + "et financières" + Versi simplifié | ✅ DONE (Phase 6a) — commit `60ef82b` — label "Holding intermédiaire" gardé, ajout "et financières", Versi Invest simplifié à "Conseil en investissement immobilier et co-investissement sur sélection." |
| 4 | / + /mission + /opportunites Filtres décision | Réécriture A/B | ✅ DONE (Phase 2+3+5) — Filtre 1 B principiel + Filtre 2 A pragmatique + Filtre 3 Horizon inchangé |
| 5 | /mission vs /a-propos | Fusion — suppression /a-propos + refonte /mission | ✅ DONE v1 (Phase 3+5) puis REFONTE RICHE v2 10/10 produite (Phase 6b) → **EN ATTENTE Phase 7 implémentation TSX** (décision Sonia OUI déjà tranchée) |
| 6 | Toutes pages | Audit + correction justifications explicites | ✅ DONE (Phase 1bis audit + Phase 2 vague 2.2 corrections) — 5 occurrences traitées (2 SUPPRIMER + 3 REFORMULER) |

### 2 nouveaux retours Thomas ajoutés mi-session 6

| # | Page | Action Thomas | Statut final |
|---|---|---|---|
| 7 | /accompagnement | Refonte duo Jean-Pierre + Thomas | 📄 LIVRABLE STRATÉGIQUE PRODUIT (Phase 6d) — Variante A duo opérationnel 9.5/10 OU Variante C maison et héritier 9.4/10 → **EN ATTENTE décision Thomas CHECKPOINT #5** puis Phase 7 implémentation TSX |
| 8 | Favicon + icônes | Refonte complète | 📄 BRIEF STRATÉGIQUE PRODUIT (Phase 6e) — Direction 1 Sceau recommandée parmi 3 → **EN ATTENTE décision Thomas CHECKPOINT #5** puis implémentation graphique @design + propagation @fullstack en session 7 |

### Corrections factuelles verrouillées session 6

| # | Correction | Source | Impact |
|---|---|---|---|
| F1 | 2J Impression rachat = **2016** (pas 1994) | Retour Thomas post-Phase 6c | Corrigé dans `src/app/mission/page.tsx` l.131 + section "Corrections factuelles verrouillées par Thomas" ajoutée en fin de `project-context.md` |
| F2 | Thomas jeunesse en **Afrique du Sud** (avant Inde et US) | Retour Thomas post-Phase 6c | Corrigé dans `src/app/mission/page.tsx` l.163-170 (ordre chronologique) + section verrouillages |

### Ordre d'exécution session 6 (historique)

**Branche** : `claude/resume-issa-session-6-UDiOS`
**Date** : 2026-04-08
**État au lancement** : Étape 2 (propagation 6 learnings session 5) DONE, committée `9bde9ef`. Compteur 1/18 Task producteur.
**Mode** : autopilot avec checkpoints Thomas (2 blocages tranchage explicites)
**Principe directeur #0** : VITRINE (non-conversion) — calibration de tous les copy/UX
**Verrous transverses** : identité libanaise jamais française · zéro mention nom agence Thomas · UTF-8 réel · Simplicité > Démonstration > Élégance (P0 verrouillée — vigilance point 4 sur l'écueil "trop littéraire/pompeux")

### Les 6 retours Thomas — synthèse

| # | Page(s) | Nature | Owner principal | Bloque sur |
|---|---|---|---|---|
| 1 | / homepage "Notre raison d'être" | Edit copy court (suppression incipit) | @fullstack + @copywriter (sync copy) | Aucun (action chirurgicale) |
| 2 | / homepage "Participation phare" Gradient One | Réécriture éditoriale "3 générations" | @creative-strategy → @copywriter → @fullstack | Décision Thomas (2-3 options) |
| 3 | / homepage "Notre écosystème" Gradient One + Versi Invest | Reformulation 2 blocs | @copywriter → @fullstack | Décision Thomas point 2 (cohérence Gradient One inter-sections) |
| 4 | / + /participations Filtres "Préservation environnement" + "Éthique humaine" | Réécriture de fond — 2 options A/B par filtre | @copywriter → @fullstack | Décision Thomas (4 options à trancher) |
| 5 | /mission vs /a-propos | Audit différentiel + recommandation fusion ou maintien | @creative-strategy → (si fusion) @copywriter + @fullstack | Décision Thomas (structurelle, impact nav + sitemap) |
| 6 | TRANSVERSE — toutes pages | Audit + correction pattern "justification noir sur blanc" (ex : "Dans les deux cas : aucun tarif affiché. La mission commence par un échange de qualification.") | @copywriter (audit Phase 1bis) → @copywriter (corrections Phase 2) → @fullstack | Décision Thomas par occurrence (REFORMULER vs SUPPRIMER) |

### Ordre d'exécution proposé

**Phase 1 — Audits stratégiques parallèles (2 Tasks producteurs simultanés)**

Lancement dans le même message :
- **Task A** — `@creative-strategy` : audit différentiel `/mission` vs `/a-propos` → livrable `docs/strategy/mission-vs-apropos-audit.md` (point 5)
  - Lit `src/app/mission/page.tsx` + `src/app/a-propos/page.tsx`
  - Produit : tableau comparatif sections, diagnostic doublon, recommandation tranchée (fusion / maintien refondu), plan de migration si fusion (éléments à conserver/couper, impact nav, sitemap, liens internes)
- **Task B** — `@creative-strategy` : options narratives "3 générations / filiation / héritage" pour la "Participation phare" Gradient One → livrable court `docs/strategy/gradient-one-angle-options.md` (point 2)
  - Lit `docs/strategy/brand-platform.md` + `docs/strategy/personas.md` + section actuelle `src/app/page.tsx`
  - Produit : 2-3 reformulations orientées 3 générations (pas data corporate), avec justification éditoriale par option, alignement voix marque

**Phase 1bis — Audit transverse justifications explicites (1 Task producteur, lancée en parallèle des Phase 1)**

- **Task A'** — `@copywriter` : audit transverse du pattern "justification noir sur blanc" (point 6) → livrable `docs/copy/audit-justifications-explicites-session6.md`
  - Lit séquentiellement tous les `src/app/**/page.tsx` + `src/components/sections/**` + `docs/copy/landing-page-copy.md`
  - Inventaire chaque occurrence : verbatim + diagnostic + verdict (REFORMULER / SUPPRIMER / GARDER) + reformulation suggérée + sévérité P0/P1/P2
  - Ignore /mission, /a-propos et bloc Gradient One homepage (en cours de refonte par Tasks A et B) — section "Zones en cours de refonte" pour mémoire
  - Symptômes à détecter : phrases qui expliquent une absence ("Pas de X, mais Y"), annoncent un processus ("La mission commence par..."), ressemblent à des FAQ collées ("Dans les deux cas : ..."), registre méta, transcription verbatim Thomas/agent

**→ CHECKPOINT THOMAS #1** : remontée des 3 livrables (audit Mission/À propos + options Gradient One + audit justifications). Thomas tranche :
- (a) fusion vs maintien Mission/À propos
- (b) option narrative Gradient One retenue (A/B/C)
- (c) arbitrage par occurrence ou en bloc des justifications explicites (REFORMULER / SUPPRIMER / GARDER)

**Phase 2 — Production copy + Edit chirurgical TSX (4 Tasks producteurs, séquencés en 2 vagues de 3 max)**

Vague 2.1 (3 Tasks parallèles) :
- **Task C** — `@copywriter` : réécriture des 2 filtres "Préservation environnement" + "Éthique humaine" — 2 options A/B par filtre (4 textes au total) → ajout dans `docs/copy/landing-page-copy.md` section dédiée + handoff structuré (point 4)
  - Contraintes : conserver fermeté du filtre non négociable, éviter ton "mots d'enfant", cohérence brand-voice (retenue, gravité sobre, zéro pathos), éviter écueil inverse "trop littéraire/pompeux" (P0 Simplicité > Démonstration > Élégance)
- **Task D** — `@copywriter` : reformulation blocs "Notre écosystème" Gradient One (suppression "50% ISSA Capital") + Versi Invest ("Co-acquisitions format type club deal + accompagnement") + intégration de l'option Gradient One tranchée par Thomas pour la "Participation phare" → édits dans `docs/copy/landing-page-copy.md` (points 2 + 3)
- **Task E** — `@fullstack` : Edit chirurgical TSX point 1 uniquement (suppression incipit "Cette holding n'est pas née en 2026.") + propagation `docs/copy/landing-page-copy.md` correspondante + régénération baselines Playwright section impactée + pipeline G28 vert (point 1)
  - Indépendant des autres tasks, action courte, ne pas attendre

Vague 2.2 (1 Task séquentiel après Vague 2.1) :
- **Task C'** — `@copywriter` : application des corrections justifications explicites validées par Thomas en CHECKPOINT #1 (point 6) → édits dans `docs/copy/landing-page-copy.md` + production de la liste consolidée des Edits TSX à appliquer en Phase 3
  - Séquencée APRÈS Vague 2.1 pour éviter conflits sur `landing-page-copy.md`

**→ CHECKPOINT THOMAS #2** : remontée des 4 textes filtres + 3 textes Gradient One/Versi Invest + corrections justifications appliquées. Thomas tranche :
- (d) option A ou B pour chaque filtre (2 décisions)
- (e) validation textes Gradient One / Versi Invest (ou ajustement)
- (f) validation reformulations justifications (ou retour ajustement)

**Phase 3 — Propagation TSX consolidée (1 Task producteur)**

- **Task F** — `@fullstack` : propagation TSX en un seul passage des points 2, 3, 4, 6 (homepage + page participations si filtres dupliqués + toutes les pages avec justifications explicites corrigées) + régénération de TOUTES les baselines impactées sur 3 devices + pipeline G28 vert
  - Vérifie identité libanaise + UTF-8 réel + zéro mention agence
  - Vérifie cohérence copy `docs/copy/landing-page-copy.md` ↔ TSX (gate G7)
  - Liste des Edits venant en partie de `docs/copy/audit-justifications-explicites-session6.md` (post-validation Thomas)

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
| Phase 1 audits stratégiques | 2 | 3/18 |
| Phase 1bis audit transverse justifications | 1 | 4/18 |
| Phase 2 vague 2.1 copy + edit chirurgical | 3 | 7/18 |
| Phase 2 vague 2.2 corrections justifications | 1 | 8/18 |
| Phase 3 propagation TSX | 1 | 9/18 |
| Phase 4 QA + testeur | 2 | 11/18 |
| Phase 5 (si fusion) | 3 | 14/18 |
| **Total max** | **14** | **14/18** ✅ marge 4 |

Marge confortable sous le seuil ALERTE ROUGE (18). Pas de risque de saturation contexte sur cette session.

### Risques et points d'attention

- **R1** : point 4 (filtres) — risque que les options A/B tombent dans l'écueil inverse "trop littéraire/pompeux". Brief @copywriter doit explicitement citer P0 Simplicité > Démonstration > Élégance + exemple anti-pattern à éviter.
- **R2** : point 5 (Mission/À propos) — décision structurelle qui peut invalider du contenu déjà produit en sessions 1-5. @creative-strategy doit lister ce qui serait perdu en cas de fusion.
- **R3** : point 2 (Gradient One narratif) — risque d'incohérence si l'option "3 générations" choisie ne se raccroche pas à la lignée déjà narrée en homepage Section "Notre raison d'être" (issue session 5 retour #3). @creative-strategy doit vérifier l'alignement avec `landing-page-copy.md` Modif 3.
- **R4** : régénération baselines Playwright — Phase 2 (Task E) régénère certaines baselines, Phase 3 (Task F) en régénère d'autres. Risque de drift si les deux phases touchent les mêmes sections. À séquencer strictement Phase 2 → Phase 3 (pas de chevauchement).
- **R5** : déterminer si les "Filtres de décision" sont sur homepage uniquement, page `/participations`, ou les deux — Grep nécessaire en début Phase 2 par @copywriter pour cartographier tous les emplacements avant édit.

### Status session 6

**CLÔTURÉE sans implémentation Phase 7** — Thomas a demandé en fin de session de "finir proprement puis changer de session". Les 15 Tasks producteurs ont été utilisés sur Phases 1-6. Phase 7 (@fullstack mega-passe implementation) et Phase 4 (QA + testeur) sont reportées en session 7.

---

## Session 7 — À démarrer

### 🔴 Décisions Thomas BLOQUANTES en début de session 7 (CHECKPOINT #5)

**Décision 1 — Favicon direction** (Phase 6e brief disponible `docs/design/favicon-brief-session6.md`)
- Direction 1 Sceau / Cachet patrimonial ⭐ (recommandation @creative-strategy)
- Direction 2 Cèdre géométrique (identité libanaise explicite)
- Direction 3 I monumental (rigueur structurelle)
- Ou Direction 4 libre
- **Impact** : détermine le brief de @design session 7 pour production des 8 SVG + binaires + apple-touch-icon

**Décision 2 — /accompagnement opérationnel vs maison** (Phase 6d livrable disponible `docs/strategy/accompagnement-refonte-10-10-session6.md`)
- Variante A duo opérationnel (Jean-Pierre dans les réunions, 9.5/10)
- Variante C maison et héritier (Thomas opère, Jean-Pierre figure tutélaire, 9.4/10)
- Question Thomas (verbatim @creative-strategy) : *"Quand tu dis 'tous les deux on accompagne', est-ce que Jean-Pierre intervient directement dans les missions clients — réunions, recommandations, échanges — ou est-ce qu'il est présent au sens de 'la maison Issa accompagne via sa méthode et son héritage', et c'est toi qui opères ?"*
- **Impact** : détermine l'architecture exacte de la page /accompagnement (A = 8 sections 2 bios distinctes, C = structure maison-et-héritier)

### Phase 7 session 7 — Mega-passe @fullstack (estimation 1 Task)

Après les 2 décisions tranchées, une seule Task @fullstack applique **en une seule passe** :

1. **Homepage stats-only strict** — retirer le texte éditorial Gradient One (titre Prop 1 + sous-titre + description) ajouté en Phase 3+5, garder UNIQUEMENT les stats 2020/6/3 proprement présentées
2. **/mission** — implémenter Version RICHE v2 6 sections (bio Thomas 4 phrases, bio Jean-Pierre 4 phrases sans dates/titres, Sonia gardée 1 phrase italique, prénoms+dates enfants coupés, Florimont/Irvine/Sony/TEOS/TikTok/Adidas/Lego coupés, nouvelle section "L'horizon", JSON-LD Person `alumniOf` supprimé)
3. **/participations** — implémenter Variante A par domaine d'activité (H1 remanié, 5 sections Immobilier en direct / Accompagnement et co-investissement / Technologie au service de l'immobilier / Une thèse pas un portefeuille, Gradient One relégué en attribution "via Gradient One" dans les fiches, suppression featured/border-2/col-span-2 sur Versi Invest)
4. **/accompagnement** — implémenter la variante retenue (A ou C) avec respect des faits biographiques 2J 2016 + Afrique du Sud

**Pipeline G28** complet + régénération baselines (21 baselines sur 3 devices pour les 4 pages modifiées).

### Phase favicon session 7 — 2 Tasks séparés

1. **@design** production des 8 SVG + binaires selon la Direction Thomas
2. **@fullstack** propagation `public/` + `app/layout.tsx` + vérification des references + régénération éventuelle des baselines Playwright

### Phase 4 session 7 — QA finale (2 Tasks)

1. **@qa** tests E2E sur toutes les pages refondues + pipeline G28 complet
2. **@testeur-karim** ré-évaluation gates GP1-GP10 sur les pages refondues

### Budget session 7 estimé

| Phase | Tasks | Cumul session 7 |
|---|---|---|
| Phase 7 mega-passe implementation | 1 | 1/18 |
| Phase favicon (@design + @fullstack) | 2 | 3/18 |
| Phase 4 QA + testeur | 2 | 5/18 |
| **Marge restante** | | **13/18** |

Marge très confortable en session 7 — pourra inclure d'autres chantiers (ex : démarrage agent secrétariat ISSA Capital si Thomas débloque les actions Phase 8).

### Prochains chantiers importants (hors session 6-7)

- **Agent secrétariat ISSA Capital** : 12-18h de dev, 8 phases, non démarré (spec @ia 1856 lignes prête)
- **Actions Thomas Phase 8** : DPA Anthropic, DPA Replit, email RGPD Carl/Maxime, NDA signatures, numéro WhatsApp pro, complétion secretariat-contacts-database
- **Propagation cross-projets** des 6 learnings session 5 (déjà propagés localement en début session 6)

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

