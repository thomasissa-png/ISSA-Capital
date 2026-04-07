# Orchestration Plan — ISSA Capital

> Plan d'exécution maître + mémo de reprise entre sessions.
> Maintenu par @orchestrator.
> Dernière mise à jour : **2026-04-07 — fin de session 2 (Phase 2b + Phase 2c COMPLETE)**

---

## 🎯 Objectif projet

Livrer le **site vitrine premium** d'ISSA Capital (holding patrimoniale famille aux racines libanaises, SAS française Nanterre). Principe directeur n°0 : **VITRINE, pas conversion**. 7 pages statiques Next.js déployées sur Replit.

---

## 🧭 Phases et statuts

### ✅ Phase 0 — Fondations stratégiques (COMPLETE)
- @creative-strategy → `docs/strategy/brand-platform.md` + `personas.md` + `competitive-benchmark.md`
- @product-manager → `docs/product/product-vision.md` + `functional-specs.md` + `execution-plan.md`
- @data-analyst → `docs/analytics/kpi-framework.md` + `tracking-plan.md`
- @legal → `docs/legal/legal-audit.md` + `rgpd-checklist.md`
- **Révision majeure** : personas Hélène+Sophie supprimés → remplacés par Karim + Leila + Marc
- Taglines verrouillées : baseline "Racines libanaises. Exigences sans exception." + hero "On décide. Pas un calendrier de fonds." (⚠️ avec réserves Thomas) + signature "Patient par choix. Exigeant par principe."

### ✅ Phase 1 — Conception éditoriale & visuelle (COMPLETE)
- @copywriter → 8 fichiers dans `docs/copy/` (brand-voice + 7 pages)
- @design → 4 fichiers dans `docs/design/` (system + tokens 3 tiers + 10 composants + compositions)
- @ux → 3 fichiers dans `docs/ux/` (user-flows + wireframes + ux-audit)
- **3 passes correctives** : (1) 2J Impression intégrée dans copy, (2) WCAG levant/crème corrigé (levant-500 → levant-600 pour texte <18px), (3) functional-specs aligné Karim/Leila/Marc
- **Principe VITRINE verrouillé** : gates testeur-persona recalibrées (GP7 = Respect inspiré, GP9 = Identité lisible, GP10 = Mémorabilité)

### ✅ Phase 2a — SEO + Infrastructure + Agents testeurs (COMPLETE)
- @agent-factory → `.claude/agents/testeur-karim.md` + `testeur-leila.md` (créés par orchestrator après blocage Write de l'agent)
- @seo → `docs/seo/` : seo-strategy + keyword-map + metadata-templates + structured-data
- @infrastructure → `docs/infra/` : infrastructure + performance-audit + security-checklist + deployment-replit + `REPLIT_ACTIONS.md` à la racine (produit par orchestrator après erreur d'agent)

### ✅ Phase 2b — Implémentation (COMPLETE — session 2)

**Exécutée par @orchestrator session 2** :
- ✅ **Propagation locale 4 learnings P0** dans `.claude/agents/*.md` (creative-strategy, copywriter, design, orchestrator, ux, growth, _base-agent-protocol) — gate bloquante session 1 résolue (commit `382cb3b`)
- ✅ **@design — assets finaux** : logo (3 variantes SVG), favicon SVG, og-image source SVG (1200×630, baseline "Racines libanaises. Exigences sans exception."), webmanifest, `docs/design/assets-handoff.md` avec template `scripts/generate-assets.mjs` (commit `147151c`)
- ✅ **@fullstack initial** : bootstrap Next.js 14 + tokens 3 tiers + composants (Button, Container, Section, Overline, Header, Footer, ContactForm) + lib (env, rateLimit, sanitize, cn, resend, contactSchema) + 7 pages App Router + API `/api/contact` + robots.ts + sitemap.ts + JSON-LD Organization + error/loading/not-found (commit `d63b443`)
- ✅ **@fullstack finalisation** : build check PASS (tsc + lint + next build, 12 routes < 100 kB), 21 baselines Playwright (3 devices × 7 pages), `scripts/generate-assets.mjs` exécuté → 5 binaires PNG/ICO produits, décision #8 mise à jour (levant-600 → levant-700 WCAG AA) (commit `f5da8fe`)
- ✅ **@qa** : 5 livrables `docs/qa/` (qa-strategy, TESTING.md matrice G27 100% 11/11 US, visual-baselines-review, security-audit, a11y-audit), 127 Playwright + 5 Vitest PASS, axe-core sur 7 pages (commit `28010db`)
- ✅ **@fullstack mode fix** : 3 bugs bloquants QA résolus — (1) levant-700 WCAG AA propagé sur 9 pages + composants, (2) footer sémantique /accompagnement déjà conforme, (3) `npm install next@14.2.35 + vitest@2.1.9` 0 critical (commit `5c27064`)

**Verdict QA Phase 2b** : GO CONDITIONNEL → GO après fix → 127/127 Playwright + 5/5 Vitest PASS, build green, 0 critical, axe-core PASS sur 7 pages.

### ✅ Phase 2c — Tests persona (COMPLETE — session 2)

- ✅ **@testeur-karim** sur `/`, `/mission`, `/accompagnement` → `docs/reviews/testeur-karim-phase-2c.md` — verdict **GO CONDITIONNEL**, gates 6/6 BLOQUANT + 4/4 REQUIS PASS, 2 P1 + 2 P2 + 1 P3, taglines validées (réserves Thomas sur "On décide. Pas un calendrier de fonds." infondées de son point de vue), identité libanaise dosage exact (commit `998276e`)
- ✅ **@testeur-leila** sur `/`, `/opportunites`, `/participations` → `docs/reviews/testeur-leila-phase-2c.md` — verdict **GO CONDITIONNEL**, gates 6/6 BLOQUANT + 4/4 REQUIS PASS (GP5 PASS avec réserve), 2 P1 + 3 P2 + 1 P3, conformité L.411-1 CMF PASS, simulation parcours mercredi 9h30 deal Montreuil 980 K€

### Frictions résiduelles à arbitrer Phase 3 (avant déploiement)

| Priorité | Page | Friction | Owner |
|---|---|---|---|
| P1 | /accompagnement | Séquence signature/formulaire à inverser (signature AVANT formulaire) | @fullstack ou @copywriter |
| P1 | /accompagnement | Dissonance "pas de formulaire 10 champs" vs formulaire réel | @copywriter |
| P1 | /opportunites | Message succès sans rappel délai "dans la journée" | @fullstack + @copywriter |
| P1 | /opportunites | Ticket minimum absent pour participations minoritaires | @copywriter (validation Thomas) |
| P2 | / | CTA final home trop orienté Leila — pas d'accroche symétrique Karim | @fullstack + @copywriter |
| P2 | /accompagnement | 7 domaines en liste plate, pas séparés patrimonial/corporate | @copywriter |
| P2 | /opportunites | Label "Email" vs "Email professionnel" | @fullstack |
| P2 | /opportunites | Champ Localisation non obligatoire pour deals immo | @fullstack + @copywriter |
| P2 | / | Stat "50%" sans contexte immédiat | @copywriter |
| P3 | toutes | Répétition baseline hero/footer | @copywriter |
| P3 | /participations | 2/4 filiales sans URL live (Versi Immobilier + Versi Invest) | suivi futur |

---

### 🗑️ Phase 2b — Plan d'origine (archivé pour traçabilité)

**Initialement prévu (cf. exécution réelle ci-dessus)** :
1. **@fullstack** (priorité 1 — le plus gros chunk)
   - Code des 7 pages Next.js App Router + TypeScript + Tailwind selon `docs/design/page-compositions.md`
   - Composant `<ContactForm variant="accompagnement|opportunite|contact">`
   - API `/api/contact/route.ts` avec validation Zod, honeypot, rate limit, sanitization
   - Intégration Resend (`lib/resend.ts`)
   - Intégration Plausible via `next-plausible`
   - Fonts self-hosted via `next/font/local` (Cormorant Garamond + Inter)
   - Headers de sécurité dans `next.config.js` (cf. `docs/infra/infrastructure.md`)
   - robots.ts + sitemap.ts
   - Structured data JSON-LD (Organization + Person Thomas)
   - **Boucle visuelle Playwright obligatoire** : screenshots sur 3 devices (iPhone 13 375px / iPad 768px / Desktop Chrome 1280px), comparaison avec `page-compositions.md`, correction avant passage page suivante, baselines sauvegardées dans `tests/screenshots/`
   - Pre-commit build check : `tsc --noEmit && next lint && npm run build` obligatoire
2. **@design — passe d'assets finaux**
   - favicon.ico + favicon.svg + apple-touch-icon.png (180×180) + android-chrome-192×192 + 512×512
   - og-image.png (1200×630) — fond ink-950 + logo + baseline "Racines libanaises. Exigences sans exception." en Cormorant Garamond italic
   - logo.svg (référencé dans Organization JSON-LD)
   - site.webmanifest
3. **@qa** (après @fullstack)
   - Tests unitaires Vitest
   - Tests E2E Playwright (couvrir les 11 user stories de `functional-specs.md` — matrice traçabilité G27)
   - Audit accessibilité automatisé (axe-core)
   - Checklist security-checklist.md exécutée
4. **@testeur-karim + @testeur-leila** (Phase 2c — après @qa)
   - Retest persona sur le site codé (pas les docs)
   - Évaluation gates GP1-GP10 recalibrées VITRINE
   - Verdict GO / NO-GO pour la page d'accompagnement (testeur-karim) et la page d'opportunités (testeur-leila)

### 🔜 Phase 3 — Corrections frictions Phase 2c + QA final (PROCHAINE SESSION)
- **Corrections frictions Phase 2c** : @fullstack + @copywriter traitent les 4 P1 + 5 P2 listés ci-dessus
- @reviewer → audit final 32 gates binaires sur TOUS les livrables
- @legal → relecture finale copy vs liste noire L.411-1 CMF (note : Leila a déjà validé /opportunites conforme)
- @seo → vérification implémentation (metadata, JSON-LD, sitemap, robots.txt)

### 🔜 Phase 4 — Sales enablement & earned media (après Phase 3)
- **Note vitrine** : à recalibrer fortement vu le principe directeur #0 (pas conversion). Possiblement à sauter ou réduire à un minimum (@copywriter produit juste un press kit + 1 page LinkedIn optimisée pour Thomas).

### 🔜 Phase 5 — Revue finale page par page + lancement
- Audit page par page (21 dimensions)
- Correction P0+P1+P2
- Checklist GO/NO-GO jour J
- Déploiement Replit via `docs/infra/deployment-replit.md` + `REPLIT_ACTIONS.md`
- Monitoring post-launch

---

## 📊 Compteur session 2

- **Phases terminées** : 2 (Phase 2b + Phase 2c)
- **Tasks producteurs** : 8 / 18 (seuil ALERTE ROUGE) — propagation, design, fullstack-1, fullstack-2, qa, fullstack-3 fix, karim, leila
- **Livrables session 2** :
  - Code Next.js complet (30+ fichiers `src/`)
  - 5 livrables `docs/qa/` + 2 livrables `docs/reviews/`
  - 21 baselines Playwright + 5 binaires assets PNG/ICO + 9 SVG
  - 9 commits poussés sur `claude/propagate-learnings-9PntQ`
- **Build green** : tsc + lint + next build PASS, 12 routes < 100 kB, 127/127 Playwright + 5/5 Vitest PASS, 0 critical
- **Learnings P0/P1 propagés** : 4/4 en local — propagation cross-projets repo Agent-Team à faire par Thomas en meta-maintenance

## 📊 Compteur session 1

- **Phases terminées** : 3 (Phase 0, Phase 1, Phase 2a)
- **Tasks producteurs** : ~16-17 / 18 (seuil ALERTE ROUGE) — session 1 clôturée à temps
- **Livrables produits** : 30+ fichiers dans `docs/` + 2 agents testeurs dans `.claude/agents/`

---

## 🧾 Décisions verrouillées (à ne PAS questionner en session suivante)

1. **Mission** : "faire fructifier le patrimoine familial dans la durée et organiser sa transmission"
2. **Promesse** : "La holding patrimoniale d'une famille aux racines libanaises qui investit pour les générations à venir, dans des projets qu'elle peut transmettre fièrement."
3. **Baseline** : **"Racines libanaises. Exigences sans exception."**
4. **Hero** : "On décide. Pas un calendrier de fonds." (⚠️ avec réserves Thomas — à retester en Phase 2c)
5. **Signature page Accompagnement** : "Patient par choix. Exigeant par principe."
6. **Personas** : Karim (A — conseil) + Leila (B — opportunités) + Marc (secondaire — earned media)
7. **Archétype** : Ruler/Outlaw modéré
8. **Palette** : noir #0A0A0A + crème #F5F0E8 + ocre levantin (**levant-700** #8B5E2A pour texte <18px sur fond clair — ratio ≥ 5:1 WCAG AA PASS, levant-500 pour texte ≥18px/accent et bordures interactives) — *révisé Phase 2b après mesure axe-core : levant-600 #A87340 mesuré 3.56-4.04:1, sous le seuil 4.5:1*
9. **Typographie** : Cormorant Garamond (headings) + Inter (corps), self-hosted
10. **Stack** : Next.js App Router + TypeScript + Tailwind + Replit
11. **Email unique** : contact@issa-capital.com
12. **Pricing** : non affiché sur le site
13. **Format accompagnement** : mission ponctuelle + advisoring (pas d'abonnement, pas de one-shot)
14. **Délai réponse opportunités** : "dans la journée"
15. **Architecture** : 2 pages distinctes /accompagnement + /opportunites
16. **Principe directeur #0** : VITRINE, pas conversion
17. **Anti-personas** : 7 filtres validés (pas de first-time founders, pas crypto, pas cold, ticket mini 200k, pas mission <1 mois, pas anti-éthique, pas spéculatif court-terme)

---

## 👨‍👩‍👧‍👦 Famille Issa — éléments verrouillés (à honorer dans le copy)

- **Jean-Pierre Issa** (père, 1958 Dakar, famille libanaise, IBM → Lexmark early team → 2J Impression co-repreneur 17 pays toujours Co-Managing Director) — **nommage public VALIDÉ**
- **Sonia Issa** (mère, 1959 Le Caire, famille libanaise, architecte d'intérieur) — nommage public recommandé par orchestrator, à confirmer si Thomas refuse
- **Thomas Issa** (fondateur SAS 2026, ex-Sony 15 ans + co-founder TEOS + advisor startups, HEC + UC Irvine + IMT, quadrilingue)
- **3 enfants** (Antoine 2015 + Noémie 2018 + Lucas 2023) — **JAMAIS nominatifs publiquement** (RGPD art. 8 mineurs), utiliser "trois enfants" / "la génération à venir"
- **Exode années 1970** : Jean-Pierre + Sonia quittent le Liban à cause de la guerre civile → finissent leurs études en France. Angle narratif d'authenticité, à raconter en UNE phrase sobre.
- **Asset confidentiel** (usage interne uniquement) : Thomas a créé une agence de com (1 500€ → 3,4M€ CA → exit 2M€). NE PAS publier tant que Thomas n'a pas levé le NDA. Clients agence (TikTok, Adidas, Lego) citables comme "clients de Thomas" sans révéler la source.
- **Clients Sony TEOS citables** : Lego, Siemens, Netflix, Cap Gemini, Suzuki, Hilton, Mango

---

## 📂 Écosystème participations — verrouillé

1. **Gradient One** (holding, 50% ISSA, 3 actionnaires, depuis 2020, pas de site public)
2. **Versi Immobilier** (marchand de biens, 2025, actionnaire co-gérant via Gradient One)
3. **Versi Invest** (club deal, 2026, co-gérant via Gradient One, ⚠️ legal L.411-1 CMF)
4. **Immocrew** (marketing mandataires immo, via Gradient One, live sur immocrew.fr, 100-150€/mois)
5. **Versimo** (home staging IA, via Gradient One, live sur versimo.fr)
6. **Immobilier direct** (15 lots résidentiels IDF, traitement discret dans le copy)

---

## 🚀 Commande de reprise session 3

Copie-colle exactement ceci dans la prochaine session :

> **@orchestrator — reprise ISSA Capital session 3**
>
> Lis project-context.md et docs/orchestration-plan.md. Continue où on s'était arrêté : Phase 3 (corrections frictions Phase 2c + QA final).
>
> **Étape 1 — Corrections P1/P2 frictions Phase 2c** (cf. tableau "Frictions résiduelles" dans Phase 2c) :
> - Lance @copywriter pour traiter les corrections copy : intro formulaire /accompagnement, restructuration 7 domaines, ticket minimum participations (validation Thomas requise), CTA final home Karim, stat 50%, label Email professionnel, variation baseline hero/footer
> - Lance @fullstack en parallèle pour les corrections code : déplacer signature AVANT formulaire /accompagnement, message succès /opportunites avec rappel délai "dans la journée", localisation requise pour deals immo, label Email
> - Re-run pre-commit build check + Playwright après corrections
>
> **Étape 2 — QA final + conformité** :
> - Lance @reviewer pour audit final 32 gates binaires sur TOUS les livrables docs/ + src/
> - Lance @legal pour relecture finale copy vs liste noire L.411-1 CMF (note : Leila a déjà validé /opportunites conforme — focus sur les pages /accompagnement, /participations, /mission)
> - Lance @seo pour vérification implémentation (metadata, JSON-LD, sitemap, robots.txt)
>
> **Étape 3 — Phase 4 (réduite vu VITRINE) + Phase 5** : à arbitrer en fin de session 3 selon temps disponible.
>
> Respecte le Principe directeur #0 : VITRINE, pas conversion. Zéro CTAs agressifs, ton éditorial.

## 🚀 Commande de reprise session 2 (archivée)

> @orchestrator — reprise ISSA Capital session 2 — Phase 2b implémentation. (Cette session est désormais COMPLETE — voir compteurs ci-dessus.)

---

## 🔗 Index rapide des livrables existants

### Stratégie
- `docs/strategy/brand-platform.md`
- `docs/strategy/personas.md`
- `docs/strategy/competitive-benchmark.md`

### Produit
- `docs/product/product-vision.md`
- `docs/product/functional-specs.md` (11 user stories, matrice traçabilité)
- `docs/product/execution-plan.md`

### Analytics
- `docs/analytics/kpi-framework.md`
- `docs/analytics/tracking-plan.md`

### Legal
- `docs/legal/legal-audit.md` (liste noire L.411-1 CMF)
- `docs/legal/rgpd-checklist.md`

### Copy
- `docs/copy/brand-voice.md`
- `docs/copy/landing-page-copy.md`
- `docs/copy/page-mission.md` (arc Jean-Pierre → Thomas → enfants + 2J Impression)
- `docs/copy/page-accompagnement.md`
- `docs/copy/page-opportunites.md`
- `docs/copy/page-participations.md`
- `docs/copy/page-contact.md`
- `docs/copy/page-legal.md`

### Design
- `docs/design/design-system.md`
- `docs/design/design-tokens.json`
- `docs/design/component-library.md`
- `docs/design/page-compositions.md`

### UX
- `docs/ux/user-flows.md`
- `docs/ux/wireframes.md`
- `docs/ux/ux-audit.md`

### SEO
- `docs/seo/seo-strategy.md`
- `docs/seo/keyword-map.md`
- `docs/seo/metadata-templates.md`
- `docs/seo/structured-data.md`

### Infrastructure
- `docs/infra/infrastructure.md`
- `docs/infra/performance-audit.md`
- `docs/infra/security-checklist.md`
- `docs/infra/deployment-replit.md`
- `REPLIT_ACTIONS.md` (racine)

### Agents spécialisés
- `.claude/agents/testeur-karim.md`
- `.claude/agents/testeur-leila.md`

### Mémoire
- `docs/lessons-learned.md` (format v2, 3 learnings P0 + 1 learning P1)
- `docs/orchestration-plan.md` (ce fichier)
- `project-context.md` (source de vérité projet)
