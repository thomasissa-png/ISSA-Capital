# Plan d'exécution — ISSA Capital
> @product-manager — 2026-04-07
> Source : project-context.md + functional-specs.md + product-vision.md
> Principe : dépendances strictes uniquement — pas de sprint, pas de timeline humaine (Règle n°5 framework)

---

## Résumé exécutif

- **Objectif** : Livrer le site vitrine ISSA Capital complet, de la stratégie au déploiement
- **Décisions clés** : 5 phases par dépendances, parallélisation maximale dans chaque phase, gates de validation binaires avant passage de phase
- **Dépendances** : Phase 1 alimente Phase 2, Phase 2 alimente Phase 3 et 4 en parallèle, Phase 5 est la validation finale

---

## Principe de séquencement

En contexte équipe 100% IA, les seules contraintes qui imposent un séquencement sont les **dépendances de livrable** : l'agent Y ne peut pas travailler si le livrable de l'agent X n'existe pas encore.

Tous les agents indépendants dans une même phase sont lancés en parallèle par @orchestrator.

---

## Phase 0 — Stratégie et fondations (TERMINÉE)

**Statut : COMPLÈTE** — validée par Thomas le 2026-04-07

**Ce qui a été produit :**
- project-context.md : identité, personas, positionnement, hypothèses validées, ADN dur
- docs/lessons-learned.md : mémoire organisationnelle initialisée
- docs/product/product-vision.md : vision, promesses fonctionnelles, anti-features, KPIs
- docs/product/functional-specs.md : specs 6 pages, 8 user stories
- docs/product/execution-plan.md : ce fichier

**Dépendance pour Phase 1 :** product-vision.md + functional-specs.md doivent être disponibles.

---

## Phase 1 — UX + Design + Stratégie de marque

**Agents mobilisés (en parallèle) :**

| Agent | Mission | Livrable principal | Lit |
|---|---|---|---|
| @creative-strategy | Brand-platform, personas enrichis, competitive benchmark | docs/strategy/brand-platform.md, docs/strategy/personas.md, docs/strategy/competitive-benchmark.md | project-context.md, product-vision.md |
| @ux | Parcours utilisateurs, wireframes, onboarding flow | docs/ux/user-flows.md, docs/ux/wireframes.md | functional-specs.md, product-vision.md |
| @design | Design system, tokens, composants | docs/design/design-system.md, docs/design/design-tokens.json, docs/design/page-compositions.md | functional-specs.md, product-vision.md (brand-platform.md dès disponible) |

**Dépendances internes à la phase :**
- @design peut démarrer en parallèle de @creative-strategy en se basant sur project-context.md (direction design déjà documentée : typo + espace blanc + éditorial)
- @design lit brand-platform.md dès qu'il est disponible pour aligner les tokens de couleur avec la palette de marque

**Livrables attendus :**
- docs/strategy/brand-platform.md
- docs/strategy/personas.md
- docs/strategy/competitive-benchmark.md
- docs/ux/user-flows.md
- docs/ux/wireframes.md
- docs/design/design-system.md
- docs/design/design-tokens.json
- docs/design/page-compositions.md

**Gates de validation (Phase 1 → Phase 2) :**
- [ ] G5 PASS : personas dans brand-platform.md = Hélène (persona principal validé Phase 0)
- [ ] G6 PASS : KPI North Star = demandes de contact qualifiées/mois dans les livrables
- [ ] G7 PASS : aucune contradiction entre brand-platform.md, wireframes.md et functional-specs.md
- [ ] G21 PASS : les 5 états UI documentés dans wireframes.md pour chaque écran interactif (formulaires)
- [ ] G22 PASS : contrastes WCAG 2.2 AA vérifiés dans design-tokens.json
- [ ] G29 PASS : chaque section de chaque page a un pattern de layout dans page-compositions.md

---

## Phase 2 — Copy + Développement frontend

**Agents mobilisés (en parallèle) :**

| Agent | Mission | Livrable principal | Lit |
|---|---|---|---|
| @copywriter | Textes de toutes les pages, brand voice, UX writing | docs/copy/landing-page-copy.md, docs/copy/brand-voice.md, docs/copy/ux-writing-guide.md | brand-platform.md, personas.md, functional-specs.md, wireframes.md |
| @fullstack | Implémentation Next.js + API route + intégration Resend | src/ (code complet), docs/api-documentation.md | functional-specs.md, design-system.md, page-compositions.md, wireframes.md |

**Dépendances strictes Phase 2 :**
- @copywriter DOIT lire brand-platform.md (Phase 1) avant de rédiger — pour aligner le ton
- @fullstack DOIT lire page-compositions.md et design-tokens.json (Phase 1) avant de coder les composants
- @fullstack peut démarrer les fondations techniques (structure Next.js, composants de base, API route) avant que @copywriter termine, puis intégrer le copy en fin de phase

**Livrables attendus :**
- docs/copy/landing-page-copy.md (textes finaux de toutes les pages)
- docs/copy/brand-voice.md
- docs/copy/ux-writing-guide.md (messages d'erreur, confirmations, labels formulaires)
- src/app/page.tsx (Accueil)
- src/app/mission/page.tsx
- src/app/participations/page.tsx
- src/app/opportunites/page.tsx
- src/app/contact/page.tsx
- src/app/mentions-legales/page.tsx
- src/app/api/contact/route.ts (endpoint POST)
- src/data/participations.ts (config statique)
- src/components/ (composants réutilisables : Navigation, Footer, ContactForm, ParticipationCard)

**Gates de validation (Phase 2 → Phase 3) :**
- [ ] G15 PASS : 0 placeholder dans le code (grep "[À REMPLIR", "[TODO")
- [ ] G24 PASS : registre "vous" uniforme dans tout le copy (cohérence ton institutionnel)
- [ ] G28 PASS : tsc --noEmit 0 erreur + ESLint 0 erreur + tests unitaires PASS
- [ ] US-10 implémentée : soumission formulaire → email reçu par Thomas (test réel avec Resend)
- [ ] Boucle visuelle @fullstack : screenshot par page, comparaison avec page-compositions.md — 0 divergence bloquante

---

## Phase 3 — QA + Legal + SEO (en parallèle)

**Agents mobilisés (en parallèle) :**

| Agent | Mission | Livrable principal | Lit |
|---|---|---|---|
| @qa | Stratégie de test, matrice traçabilité US→tests, tests E2E Playwright | docs/qa/qa-strategy.md, docs/qa/TESTING.md | functional-specs.md, src/ (code Phase 2) |
| @legal | Audit légal, CGU si applicable, politique de confidentialité, conformité RGPD | docs/legal/legal-audit.md, docs/legal/privacy-policy.md, docs/legal/rgpd-checklist.md | functional-specs.md (US-13), project-context.md |
| @seo | Audit SEO technique, keyword map, métadonnées finales | docs/seo/seo-strategy.md, docs/seo/keyword-map.md, docs/seo/metadata-templates.md | functional-specs.md (contraintes SEO par page), src/ |

**Dépendances strictes Phase 3 :**
- @qa DOIT avoir accès au code (src/) produit en Phase 2
- @legal peut démarrer dès la Phase 2 (il lit functional-specs.md, pas le code)
- @seo peut démarrer dès la Phase 2 (il lit les specs SEO et le code HTML généré)

**Livrables attendus :**
- docs/qa/qa-strategy.md (stratégie complète, matrice traçabilité US-01→US-13)
- docs/qa/TESTING.md (tests E2E Playwright, tests unitaires)
- docs/legal/legal-audit.md (validation conformité)
- docs/legal/privacy-policy.md (texte final politique de confidentialité)
- docs/legal/rgpd-checklist.md (conformité RGPD cochée)
- docs/seo/seo-strategy.md
- docs/seo/keyword-map.md
- docs/seo/metadata-templates.md

**Gates de validation (Phase 3 → Phase 4) :**
- [ ] G27 PASS : 100% des US-01 à US-13 ont un test Playwright correspondant dans TESTING.md
- [ ] G26 PASS : screenshots CI vs baselines sur iPhone 13 (375px), iPad (768px), Desktop 1280px — diff <0.5%
- [ ] @legal valide page Mentions légales : mentions LCEN complètes, droits RGPD documentés, Resend mentionné comme processeur
- [ ] @legal valide formulaire : consentement RGPD conforme art. 6.1.a, information art. 13 présente
- [ ] @seo valide : métadonnées par page présentes (title, description, OG), noindex sur /mentions-legales, pas de contenus dupliqués

---

## Phase 4 — Growth + Data + GEO (en parallèle)

**Agents mobilisés (en parallèle) :**

| Agent | Mission | Livrable principal | Lit |
|---|---|---|---|
| @data-analyst | KPI framework, tracking plan Plausible, dashboard specs | docs/analytics/kpi-framework.md, docs/analytics/tracking-plan.md, docs/analytics/dashboard-specs.md | functional-specs.md (events analytics), product-vision.md (KPIs) |
| @growth | Stratégie de distribution post-lancement (LinkedIn Thomas, réseaux partenaires) | docs/growth/growth-strategy.md, docs/growth/acquisition-plan.md | product-vision.md, brand-platform.md, personas.md |
| @geo | Optimisation visibilité LLM (ChatGPT, Perplexity) pour "holding patrimoniale familiale" | docs/geo/geo-strategy.md | functional-specs.md, brand-platform.md |

**Dépendances strictes Phase 4 :**
- @data-analyst DOIT lire les events analytics définis dans functional-specs.md
- @growth et @geo peuvent démarrer en parallèle de @qa (Phase 3) — ils lisent les specs, pas le code
- @fullstack implémente le script Plausible selon les specs de @data-analyst (peut être fait à la fin de Phase 2 ou début Phase 4)

**Livrables attendus :**
- docs/analytics/kpi-framework.md (formules KPI, seuils d'alerte)
- docs/analytics/tracking-plan.md (events Plausible par page et par interaction)
- docs/analytics/dashboard-specs.md
- docs/growth/growth-strategy.md
- docs/growth/acquisition-plan.md
- docs/geo/geo-strategy.md

**Gates de validation (Phase 4 → Phase 5) :**
- [ ] @data-analyst : KPI North Star (demandes qualifiées/mois) a une formule de calcul ET un seuil d'alerte dans kpi-framework.md (G25 PASS)
- [ ] @data-analyst : tracking-plan.md couvre les 12 events définis dans functional-specs.md (form_start, form_submit_success, etc.)
- [ ] @growth : plan de distribution post-lancement documenté avec au moins 3 canaux actionnables

---

## Phase 5 — Revue finale + Lancement

**Agents mobilisés (séquence) :**

| Étape | Agent | Mission | Livrable |
|---|---|---|---|
| 5a | @reviewer | Revue croisée complète (32 gates) sur tous les livrables | docs/reviews/cross-review-report.md |
| 5b | @infrastructure | Configuration Replit, monitoring post-launch, performance | docs/infra/infrastructure.md |
| 5c | @fullstack | Corrections issues @reviewer + @qa + déploiement | src/ (version finale) |
| 5d | @orchestrator | Go/No-Go final + mémo de reprise | docs/project-synthesis.md |

**Dépendances strictes Phase 5 :**
- @reviewer ne peut démarrer qu'après les Phases 1, 2, 3, 4 terminées
- @infrastructure peut démarrer en parallèle de @reviewer (préparer la config Replit ne dépend pas de la review)
- @fullstack Phase 5c dépend des corrections identifiées par @reviewer et @qa

**Gate Go/No-Go finale (Phase 5 → Lancement) :**
- [ ] 100% gates BLOQUANT PASS sur tous les livrables docs/
- [ ] 100% gates REQUIS PASS sur tous les livrables docs/
- [ ] Tests E2E Playwright : 0 test en échec
- [ ] Pipeline pre-deploy PASS : tsc --noEmit + lint + tests (G28)
- [ ] Formulaire contact testé en production (email réel reçu par Thomas)
- [ ] @legal : validation finale page Mentions légales + politique de confidentialité
- [ ] Performance : LCP <2.5s sur Replit (mobile + desktop)

---

## Parallélisation — Résumé visuel

```
Phase 0 [TERMINÉE]
  ↓ (tous les livrables Phase 0 disponibles)
Phase 1 [PARALLÈLE] : @creative-strategy // @ux // @design
  ↓ (brand-platform + wireframes + design-system disponibles)
Phase 2 [PARALLÈLE] : @copywriter // @fullstack
  ↓ (copy final + code disponibles)
Phase 3 [PARALLÈLE] : @qa // @legal // @seo
Phase 4 [PARALLÈLE] : @data-analyst // @growth // @geo
  [Phases 3 et 4 peuvent démarrer ensemble après Phase 2]
  ↓ (tous les livrables disponibles)
Phase 5 [SÉQUENCÉ] : @reviewer → @infrastructure → @fullstack (corrections) → lancement
```

---

## Données manquantes bloquantes (à résoudre avant Phase 2)

Ces données sont nécessaires avant que @copywriter puisse rédiger le contenu final et que @fullstack intègre les textes :

| Donnée | Bloquant pour | Action requise | Owner |
|---|---|---|---|
| Description Gradient One | Page Participations (US-04) | Thomas fournit 1-3 lignes | Thomas |
| Description Versi Immobilier | Page Participations (US-04) | Thomas fournit 1-3 lignes | Thomas |
| Description Versi Invest | Page Participations (US-04) | Thomas fournit 1-3 lignes | Thomas |
| Description Immobilier en direct | Page Participations (US-04) | Thomas fournit 1-3 lignes | Thomas |
| Email de contact public (ou uniquement formulaire ?) | Page Contact, Mentions légales (US-12, US-13) | Thomas confirme | Thomas |
| Directeur de publication (Thomas Issa ?) | Mentions légales (US-13) | Thomas confirme | Thomas |
| Délai de réponse affiché ("7 jours ouvrés" ?) | Page Opportunités (US-10) | Thomas confirme | Thomas |
| Secteurs exclus explicitement (éthique humaine) | Page Opportunités | Thomas confirme ou indique "ne pas lister" | Thomas |

[HYPOTHÈSE : @copywriter produira des textes sobres institutionnels pour les participations non documentées, en attente de validation Thomas. Ces textes seront marqués dans le livrable copy comme [À VALIDER PAR THOMAS] — jamais visibles en production.]

---

## Agents spécialisés recommandés pour @agent-factory

| Agent proposé | Type | Rôle | Justification | Priorité |
|---|---|---|---|---|
| @testeur-helene | Testeur persona | Évaluer chaque page et le formulaire du point de vue d'Hélène (fondatrice PME cherchant adossement long-terme) — gates GP1-GP10 | US-01, US-10 : la conversion d'Hélène est le KPI North Star. Un testeur qui simule son comportement réel est plus précis qu'un test E2E générique pour valider "ça donne confiance" et "le formulaire ne m'intimide pas" | Haute |
| @testeur-sophie | Testeur persona secondaire | Évaluer la crédibilité institutionnelle du point de vue de Sophie (avocate d'affaires / banquier privé) — gates GC1-GC10 | US-04, US-12 : Sophie est le second persona. Sa validation "ce site suffit pour présenter ISSA à un client" est un critère de succès explicite dans product-vision.md | Moyenne |

**Specs pour @agent-factory :**

**@testeur-helene**
- Inputs : page-compositions.md (Phase 1), landing-page-copy.md (Phase 2), site déployé (Phase 5)
- Outputs : rapport de test GP1-GP10 avec verdicts PASS/FAIL et verbatims simulés depuis la perspective d'Hélène
- Critère de succès : GP1 (compréhension en 5s), GP4 (parcours fluide vers formulaire), GP9 (formulaire utile et non intimidant) tous PASS

**@testeur-sophie**
- Inputs : page-compositions.md, landing-page-copy.md, page Participations déployée
- Outputs : rapport GC1-GC10 avec verdict "ce site suffit pour présenter ISSA à un client : oui/non + raisons"
- Critère de succès : GC1 (professionnalisme), GC3 (confiance), GC4 (action) tous PASS

---

**Handoff → @orchestrator**
- Fichiers produits :
  - `docs/product/product-vision.md`
  - `docs/product/functional-specs.md`
  - `docs/product/execution-plan.md`
- Décisions prises :
  - Plan en 5 phases par dépendances strictes
  - Phase 1 : 3 agents en parallèle (@creative-strategy, @ux, @design)
  - Phase 2 : 2 agents en parallèle (@copywriter, @fullstack)
  - Phases 3 et 4 : 6 agents en parallèle total
  - Phase 5 : séquencement @reviewer → @infrastructure → @fullstack
  - 2 agents spécialisés à créer : @testeur-helene + @testeur-sophie
- Points d'attention :
  - 8 données manquantes bloquantes pour Phase 2 (tableau ci-dessus) — Thomas doit les fournir avant le démarrage du copy
  - @legal doit démarrer tôt (Phase 3) pour valider les mentions légales et le formulaire RGPD avant lancement
  - Formulaire Opportunités (US-10) = pièce maîtresse — @ux, @copywriter et @fullstack doivent coordonner
  - Identité libanaise = règle absolue dans TOUS les livrables copy (@copywriter, @creative-strategy, @copywriter)
