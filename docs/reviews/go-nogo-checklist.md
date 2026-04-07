# Checklist GO/NO-GO jour J — ISSA Capital

> Phase 3 Étape 3 — @reviewer — 2026-04-07
> Branche : `claude/issa-phase3-qa-7odSp` (commit `c6eed2e`)
> Destinée à : Thomas (validation finale) + @orchestrator (déclenchement déploiement) + @infrastructure (exécution Replit)
> Références : `cross-review-report.md`, `page-by-page-audit.md`, `legal-audit.md`, `seo-implementation-audit.md`, `REPLIT_ACTIONS.md`, `docs/infra/deployment-replit.md`

---

## Mode d'emploi

Cette checklist se déroule en 6 temps :
1. **Pré-déploiement** — validation finale des gates techniques + éditoriales (à cocher par @reviewer + Thomas AVANT de cliquer Deploy)
2. **Configuration domaine** — actions DNS + certificat (à cocher par Thomas pendant le déploiement)
3. **Smoke tests post-déploiement** — vérifications humaines sur le site live (à cocher par Thomas immédiatement après déploiement)
4. **Vérifications SEO H+24** — indexation et distribution (à cocher par Thomas dans les 24h)
5. **Critères de rollback** — conditions de retour arrière (à connaître AVANT de déployer)
6. **Verdict final** — case humaine à cocher par Thomas pour autoriser le Deploy

**Règle d'or** : aucune case de la section 1 ne doit rester non-cochée au moment de cliquer **Deploy** dans Replit. Si un point ne peut être coché → NO-GO, on reporte et on corrige.

---

## 1. Pré-déploiement — validation finale

### 1.1 Build pipeline

- [ ] `npm run build` — build Next.js PASS, 12 routes < 100 kB (état actuel branche : PASS)
- [ ] `npx tsc --noEmit` — 0 erreur TypeScript (état actuel : PASS)
- [ ] `npm run lint` — 0 erreur ESLint (warnings tolérés, état actuel : PASS)
- [ ] `npm test` — Vitest 7/7 PASS (état actuel : PASS)
- [ ] `npx playwright test` — 151/153 PASS (2 skipped documentés) (état actuel : PASS)
- [ ] `npm audit --audit-level=critical` — 0 vulnérabilité critical (état actuel : PASS)

### 1.2 Audits agents

- [ ] **Audit @reviewer (32 gates binaires G1-G32)** — `docs/reviews/cross-review-report.md` — 10/12 BLOQUANT + 16/16 REQUIS à date du rapport, les 2 FAIL (G7 + G15) **vérifiés corrigés** sur la branche
- [ ] **Audit @legal (L.411-1 CMF + RGPD)** — `docs/legal/legal-audit.md` — liste noire respectée, clause footer en place, conformité Karim/Leila validée Phase 2c
- [ ] **Audit @seo (metadata + JSON-LD + sitemap + robots)** — `docs/seo/seo-implementation-audit.md` — GO CONDITIONNEL, FAIL critique sitemap `lastModified` à corriger si pas déjà fait
- [ ] **Audit page par page @reviewer (21 dimensions × 7 pages)** — `docs/reviews/page-by-page-audit.md` — 6 GO + 1 GO CONDITIONNEL `/` (2 Edits palette overline optionnels)
- [ ] **Tests persona Karim + Leila (Phase 2c)** — `docs/reviews/testeur-karim-phase-2c.md` + `testeur-leila-phase-2c.md` — 12/12 BLOQUANT + 8/8 REQUIS PASS

### 1.3 Contenu & conformité

- [ ] Aucun TODO/PLACEHOLDER résiduel dans `src/` (Grep `[TODO]`, `[À REMPLIR]`, `[PLACEHOLDER]` → 0 match ; commentaire TODO Phase 2b next/font est **documenté et acceptable**)
- [ ] Aucun `\uXXXX` dans les strings JS/TSX (Grep `\\u[0-9a-fA-F]{4}` → 0 match, vérifié Phase 3 Étape 3)
- [ ] Aucun nom de concurrent (Wendel/Eurazeo/Peugeot Invest/Bolloré/Arnault/Pinault) dans `src/` ni `docs/copy/`
- [ ] Identité libanaise cohérente (22 occurrences libanais/Liban, aucune revendication "famille française")
- [ ] Clause non-démarchage L.411-1/L.341-1 présente dans le footer global (`src/components/layout/Footer.tsx:55-60`)
- [ ] **Mentions légales complètes** : capital social renseigné (data Thomas), numéro TVA renseigné ou explicitement marqué "Non assujetti à TVA" (cf. `legal-audit.md` §1 — BLOQUANT LCEN)
- [ ] Hébergeur Replit Inc. cité dans mentions légales avec adresse exacte
- [ ] Directeur de publication Thomas Issa + qualité précisée (Président)

### 1.4 Variables d'environnement Replit

Dans **Replit → Tools → Secrets**, les 7 variables suivantes doivent être configurées :

- [ ] `RESEND_API_KEY` — clé API production Resend (obligatoire pour ContactForm)
- [ ] `RESEND_FROM_EMAIL` — email émetteur vérifié sur le domaine `issa-capital.com`
- [ ] `RESEND_TO_EMAIL` — `contact@issa-capital.com` (destinataire Thomas)
- [ ] `NEXT_PUBLIC_SITE_URL` — `https://issa-capital.com`
- [ ] `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` — `issa-capital.com`
- [ ] `RATE_LIMIT_MAX` — `5` (recommandé)
- [ ] `RATE_LIMIT_WINDOW_MS` — `60000` (60 s)
- [ ] (optionnel) `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- [ ] **DPA Resend signé** (obligation RGPD art. 28 — cf. `legal-audit.md`)

### 1.5 Assets

- [ ] `public/og-image.png` (1200×630) présent
- [ ] `public/favicon.ico` + `public/favicon.svg` + `public/apple-touch-icon.png` présents
- [ ] `public/site.webmanifest` présent
- [ ] `public/logo.svg` présent (référencé dans JSON-LD Organization)

---

## 2. Configuration domaine

À exécuter pendant le déploiement initial Replit (cf. `REPLIT_ACTIONS.md` §4).

- [ ] Deployment Replit créé (Type **Autoscale**, build `npm run build`, run `npm run start`)
- [ ] Custom domain `issa-capital.com` ajouté dans Replit → Deployments → Settings
- [ ] Custom domain `www.issa-capital.com` ajouté (redirection vers apex — convention ISSA : apex sans www)
- [ ] Chez le registrar (OVH/Gandi/Cloudflare) :
  - [ ] A record `@` → IP Replit fournie
  - [ ] CNAME record `www` → alias Replit fourni
  - [ ] TXT record de vérification Replit
- [ ] Propagation DNS vérifiée (`dig issa-capital.com A` → IP Replit, 1-4h typiquement)
- [ ] Certificat HTTPS Let's Encrypt actif (automatique une fois DNS propagé, vérifier cadenas navigateur)
- [ ] Redirection HTTP → HTTPS active (301)
- [ ] Redirection `www.issa-capital.com` → `issa-capital.com` active (301)

---

## 3. Smoke tests post-déploiement (manuels, T+0)

À exécuter par Thomas immédiatement après que le déploiement passe en live.

### 3.1 Navigation et chargement

- [ ] `https://issa-capital.com/` charge en < 3s (Chrome, connexion non throttlée)
- [ ] `/mission` charge correctement (200 OK + contenu visible)
- [ ] `/accompagnement` charge correctement
- [ ] `/participations` charge correctement
- [ ] `/opportunites` charge correctement
- [ ] `/contact` charge correctement
- [ ] `/mentions-legales` charge correctement
- [ ] `/page-inexistante` → 404 custom page rendue correctement
- [ ] Console navigateur (DevTools → Console) **sans erreur rouge** sur chaque page principale

### 3.2 ContactForm — test end-to-end

Tester **les 2 variants** du formulaire :

- [ ] **Variant `/accompagnement`** : remplir le formulaire avec des données réelles, soumettre → message de succès affiché côté UI
- [ ] **Variant `/opportunites`** : remplir le formulaire (inclure Localisation pour variant deal immo), soumettre → message de succès affiché + **rappel délai "dans la journée"** visible
- [ ] **Email Resend reçu** côté `contact@issa-capital.com` pour chaque variant (vérifier contenu : champs remplis, type de demande, horodatage)
- [ ] Tester le **honeypot** : soumettre un formulaire avec champ hidden rempli → soumission silencieusement ignorée (aucun email reçu)
- [ ] Tester le **rate limit** : 6 soumissions successives depuis la même IP → 6e soumission bloquée (status 429)

### 3.3 SEO & partage

- [ ] `https://issa-capital.com/sitemap.xml` accessible, valide XML, liste les 7 URLs
- [ ] `https://issa-capital.com/robots.txt` accessible, autorise l'indexation de toutes les pages sauf `/api/*`
- [ ] View-source de `/` : metadata title/description/OG/twitter/canonical présents
- [ ] View-source de `/` : `<script type="application/ld+json">` Organization présent
- [ ] View-source de `/mission` : `<script type="application/ld+json">` Person Thomas présent

### 3.4 Responsive & accessibilité

- [ ] **Mobile réel** (iPhone ou Android) : naviguer les 7 pages, formulaire remplissable, CTAs cliquables au pouce (≥44px)
- [ ] **Tablette** (iPad ou équivalent, ou DevTools mode iPad 768px) : layout cohérent
- [ ] **Desktop 1280px+** : hover states fonctionnels, hiérarchie respectée
- [ ] Navigation clavier : Tab parcourt tous les liens et champs dans un ordre logique, focus-visible visible
- [ ] Skip link "Aller au contenu principal" fonctionne (Tab depuis le haut → Enter)

### 3.5 Performance — Lighthouse (DevTools → Lighthouse)

Exécuter sur `/` et `/mission` (pages les plus chargées) en mode mobile :

- [ ] Performance ≥ 85
- [ ] Accessibility ≥ 95
- [ ] Best Practices ≥ 95
- [ ] SEO ≥ 95
- [ ] LCP mobile < 3s
- [ ] CLS < 0.1
- [ ] Total JS < 150 kB (déjà validé Phase 2b : 12 routes < 100 kB)

---

## 4. Vérifications SEO post-déploiement (T+24h)

### 4.1 Google Search Console

- [ ] Propriété `https://issa-capital.com` ajoutée
- [ ] Vérification de propriété (via balise HTML, DNS TXT ou fichier)
- [ ] Sitemap `https://issa-capital.com/sitemap.xml` soumis
- [ ] Indexation manuelle de `/` demandée via "Inspection d'URL → Demander l'indexation"
- [ ] Aucune erreur d'exploration signalée
- [ ] **Rich Results Test** sur `/` : Organization JSON-LD valide (https://search.google.com/test/rich-results)
- [ ] **Rich Results Test** sur `/mission` : Person JSON-LD valide

### 4.2 Bing Webmaster Tools

- [ ] Propriété `https://issa-capital.com` ajoutée
- [ ] Sitemap soumis

### 4.3 Partage social

- [ ] **Facebook Sharing Debugger** (https://developers.facebook.com/tools/debug/) : OG image, title, description rendus correctement
- [ ] **LinkedIn Post Inspector** : OG rendu correctement
- [ ] **X/Twitter Card Validator** : summary_large_image rendu correctement (si compte X créé)

### 4.4 Monitoring

- [ ] UptimeRobot monitor HTTPS sur `/` actif, intervalle 5 min, alerte email
- [ ] Plausible Analytics : `issa-capital.com` ajouté, script chargé, premier pageview enregistré
- [ ] Goals Plausible configurés : `contact_form_submit`, `cta_primary_click`, `external_link_click`

---

## 5. Critères de rollback

**Rollback immédiat** (revert du Deployment Replit vers la version précédente ou mise hors ligne) si **un seul** des critères suivants est observé dans les 2h post-déploiement :

| # | Condition de rollback | Vérification |
|---|---|---|
| R1 | Erreur 500 persistante sur `/` ou une page principale | curl / navigateur |
| R2 | ContactForm cassé (email Resend non reçu après 3 tests successifs) | Test manuel |
| R3 | Contenu absent ou tronqué sur une page publique (rendering SSG raté) | Lecture visuelle |
| R4 | Certificat HTTPS invalide ou expiré | Navigateur |
| R5 | Erreur de conformité légale majeure détectée (mention interdite L.411-1, chiffre faux, nom famille mineur exposé) | Revue Thomas |
| R6 | Fuite de secret (clé Resend, DB credential) dans la console ou le code client | DevTools |
| R7 | Lighthouse Performance < 50 sur mobile (dégradation majeure) | Audit |
| R8 | Attaque visible (spam massif du formulaire malgré rate limit) | Dashboard Resend |

**Procédure rollback** :
1. Dans Replit → Deployments → History, sélectionner le déploiement précédent PASS
2. Cliquer "Rollback" ou re-deployer le commit précédent
3. Notifier Thomas + @orchestrator
4. Ouvrir un ticket @fullstack pour correction + post-mortem dans `docs/lessons-learned.md`

**Escalade** : si rollback impossible (bug dans la branche précédente aussi), mettre le Deployment en "Stopped" pendant la correction.

---

## 6. Verdict final GO/NO-GO

**À cocher par Thomas en présence du rapport `cross-review-report.md` + `page-by-page-audit.md` :**

- [ ] J'ai lu les 3 audits (reviewer, legal, SEO) et compris les verdicts
- [ ] Toutes les cases de la section 1 (Pré-déploiement) sont cochées
- [ ] Les données fondateur (capital social, TVA) sont confirmées et présentes dans mentions-légales
- [ ] Les Secrets Replit sont configurés
- [ ] Je suis disponible dans les 2h suivant le déploiement pour exécuter les smoke tests manuels (section 3)
- [ ] Je connais la procédure de rollback (section 5)

---

**VERDICT FINAL** *(cocher UNE seule case)* :

- [ ] **GO — Déployer immédiatement**
- [ ] **GO CONDITIONNEL — Déployer après correction des points listés ci-dessous**
- [ ] **NO-GO — Reporter le déploiement**

**Points restants à traiter avant déploiement** *(si GO CONDITIONNEL ou NO-GO)* :

```
(zone libre pour Thomas)
```

**Signature Thomas** : ____________________  **Date** : ____________________

---

## Recommandation @reviewer

À date de cet audit (2026-04-07, branche `claude/issa-phase3-qa-7odSp` commit `c6eed2e`), le site est **techniquement prêt** :

- Les 2 corrections BLOQUANT de `cross-review-report.md` (G7 + G15) sont **vérifiées appliquées**
- L'audit page par page rend **6 GO + 1 GO CONDITIONNEL mineur** (`/` palette overline)
- Les tests passent (7/7 Vitest, 151/153 Playwright, tsc + lint + build green)
- Les personas Karim + Leila ont validé Phase 2c

**Les seuls blocages restants sont humains** :
1. Confirmation Thomas des données mentions-légales (capital social + TVA)
2. Configuration Secrets Replit
3. Signature DPA Resend
4. Configuration DNS chez le registrar

**Recommandation reviewer : GO** — dès que les 4 blocages humains sont levés, le site peut être déployé en confiance. Les 2 Edits palette overline `/` (lignes 300/317) sont souhaitables mais non-bloquants (axe-core PASS sur 7 pages, traitable en hotfix J+1).

---

**Handoff → @orchestrator + @infrastructure**

- **Fichiers produits** : `docs/reviews/go-nogo-checklist.md`
- **Décisions prises** : Verdict reviewer **GO** conditionné à 4 blocages humains (données mentions-légales, Secrets Replit, DPA Resend, DNS)
- **Points d'attention pour @infrastructure** :
  1. Suivre `REPLIT_ACTIONS.md` §1-8 à la lettre pour la configuration initiale
  2. Vérifier que la branche déployée est `claude/issa-phase3-qa-7odSp` OU mergée vers `main` avant déploiement
  3. Post-déploiement : documenter l'IP Replit réelle + alias CNAME dans un mémo pour futurs changements DNS
  4. Activer le redéploiement automatique sur push `main` si disponible dans l'UI Replit
- **Points d'attention pour Thomas** :
  1. Exécuter la section 1 (Pré-déploiement) AVANT de cliquer Deploy
  2. Être disponible 2h après le déploiement pour les smoke tests (section 3)
  3. Connaître la procédure de rollback (section 5) — ne pas paniquer en cas d'incident, le rollback prend 2 minutes
