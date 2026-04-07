# TESTING — Matrice de traçabilité ISSA Capital

> **Gate G27 — 100% des user stories couvertes par au moins 1 test E2E ou intégration.**
> Maintenu par @qa — Phase 2b — 2026-04-07
> Source : `docs/product/functional-specs.md` (11 user stories)

---

## Verdict G27 : **PASS — 11/11 user stories couvertes**

---

## Matrice US → tests

| US     | Description                                                          | Persona | Page              | Fichier de test                                | Ligne(s)        | Statut |
|--------|----------------------------------------------------------------------|---------|-------------------|------------------------------------------------|-----------------|--------|
| US-01  | Comprendre l'identité ISSA Capital (hero + CTAs double entrée)       | Karim   | `/`               | `tests/e2e/us-pages.spec.ts`                   | 9-30            | PASS   |
| US-01  | + smoke H1 / footer / skip-link                                      | Karim   | `/`               | `tests/e2e/smoke.spec.ts`                      | 19-27           | PASS   |
| US-02  | Naviguer vers Opportunités depuis Accueil (clic CTA)                 | Leila   | `/` → `/opportunites` | `tests/e2e/us-pages.spec.ts`               | 32-40           | PASS   |
| US-03  | Comprendre la mission et l'identité familiale libanaise              | Karim   | `/mission`        | `tests/e2e/us-pages.spec.ts`                   | 42-57           | PASS   |
| US-04  | Explorer les 6 participations + liens externes sécurisés             | Leila   | `/participations` | `tests/e2e/us-pages.spec.ts`                   | 59-83           | PASS   |
| US-A1  | Comprendre l'offre d'accompagnement en 30s (Thomas + CTA)            | Karim   | `/accompagnement` | `tests/e2e/us-pages.spec.ts`                   | 85-95           | PASS   |
| US-A1  | + smoke H1 + skip-link + footer global                               | Karim   | `/accompagnement` | `tests/e2e/smoke.spec.ts`                      | 19-27           | PASS   |
| US-A2  | Ouvrir une conversation via formulaire 4 champs accompagnement       | Karim   | `/accompagnement` | `tests/e2e/forms.spec.ts`                      | 13-37           | PASS   |
| US-A2  | + validation Zod côté API (consent/email/message)                    | Karim   | `POST /api/contact` | `tests/e2e/api-contact.spec.ts`              | 22-72           | PASS   |
| US-A2  | + validation schema unitaire                                         | Karim   | lib               | `src/lib/contactSchema.test.ts`                | full            | PASS   |
| US-B1  | Lire les critères d'investissement (page Opportunités)               | Leila   | `/opportunites`   | `tests/e2e/us-pages.spec.ts`                   | 97-106          | PASS   |
| US-10  | Soumettre une opportunité (formulaire 7 champs)                      | Leila   | `/opportunites`   | `tests/e2e/forms.spec.ts`                      | 39-65           | PASS   |
| US-10  | + payload contract (POST /api/contact, variant=opportunite)          | Leila   | `POST /api/contact` | `tests/e2e/api-contact.spec.ts`              | 22-72           | PASS   |
| US-11  | Protection anti-spam (honeypot + rate-limit + Zod)                   | système | `POST /api/contact` | `tests/e2e/api-contact.spec.ts`              | 79-127          | PASS   |
| US-11  | + honeypot offscreen côté front                                      | système | tous formulaires  | `tests/e2e/forms.spec.ts`                      | 96-115          | PASS   |
| US-11  | + rate limiter unitaire                                              | système | lib               | `src/lib/rateLimit.test.ts`                    | full            | PASS   |
| US-12  | Envoyer un message de contact générique (formulaire 4 champs + sujet)| Marc    | `/contact`        | `tests/e2e/forms.spec.ts`                      | 67-93           | PASS   |
| US-12  | + smoke validation consent obligatoire                               | Marc    | `/contact`        | `tests/e2e/smoke.spec.ts`                      | 32-40           | PASS   |
| US-13  | Consulter les mentions légales (sections obligatoires + footer link) | tous    | `/mentions-legales` | `tests/e2e/us-pages.spec.ts`                 | 110-126         | PASS   |

---

## Tests transversaux (non liés à 1 US — qualité globale)

| Domaine        | Fichier                                  | Couverture                                                    |
|----------------|------------------------------------------|---------------------------------------------------------------|
| Accessibilité  | `tests/e2e/a11y.spec.ts`                 | axe-core sur 7 pages (WCAG 2.1 A/AA, hors color-contrast — bug connu) |
| Visuel         | `tests/visual/screenshots.spec.ts`       | Screenshots full page sur 3 devices, baselines `tests/screenshots/` |
| API contract   | `tests/e2e/api-contact.spec.ts`          | 400 / 429 / honeypot / JSON malformé                         |
| Schema Zod     | `src/lib/contactSchema.test.ts`          | 4 tests : variants + validations                             |
| Rate-limiter   | `src/lib/rateLimit.test.ts`              | 1 test : compteur in-memory                                  |

---

## Statistiques

- **User stories couvertes** : 11/11 (100%)
- **Tests E2E Playwright** : 24 tests actifs (+ 2 skipped/fixme volontaires)
- **Tests unitaires Vitest** : 5 tests
- **Tests visuels** : 21 baselines (7 pages × 3 devices)
- **Couverture pages** : 7/7 (toutes les routes)

## Comment exécuter

```bash
# Tests unitaires (rapide, 0.5s)
npm test

# Tests E2E sur un seul device (recommandé en dev — 15s)
npx playwright test tests/e2e --project=desktop-chrome

# Suite complète sur les 3 devices (~1 min)
npx playwright test

# Baselines visuelles uniquement
npm run test:visual

# Pipeline pre-deploy complet
npm run verify && npm test && npx playwright test
```

## Tests volontairement skipped

| Test                                                | Raison                                                                 |
|-----------------------------------------------------|------------------------------------------------------------------------|
| `a11y.spec.ts` — REGRESSION sentinel color-contrast | Sentinel `.fixme` qui passera quand @fullstack aura corrigé `levant-600` (bug bloquant — voir `a11y-audit.md`) |
| `a11y.spec.ts` — touch targets ≥ 44px (mobile only) | Skip conditionnel sur projets non-mobile (le test s'active sur `iphone-13`) |

---

**Verdict G27 : PASS** — chaque user story de `functional-specs.md` a au moins un test correspondant. Les bugs détectés au passage sont documentés dans `security-audit.md` et `a11y-audit.md`.
