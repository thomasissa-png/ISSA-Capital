# QA Strategy — ISSA Capital

> Stratégie globale qualité pour le site vitrine ISSA Capital.
> Maintenu par @qa — Phase 2b — 2026-04-07.
> Source : `docs/product/functional-specs.md`, `docs/infra/security-checklist.md`,
> `docs/dev-decisions.md`, principe directeur n°0 = **VITRINE, pas conversion**.

---

## 1. Contexte et objectifs

ISSA Capital est un site vitrine premium de 7 pages statiques (Next.js App Router) avec une seule API : `/api/contact`. L'enjeu qualité n'est PAS la conversion — c'est :

1. **Crédibilité institutionnelle** : aucun bug visible, aucune erreur typographique, accessibilité irréprochable.
2. **Conformité juridique RGPD + L.411-1 CMF** : honeypot, rate-limit, consentement, mentions, pas de mots interdits.
3. **Identité éditoriale verrouillée** : copy alignée (libanais, signature, anti-personas) — un bug typo ou un mot interdit = bug bloquant.
4. **Fiabilité du formulaire de contact** : le seul point d'interaction ; il doit fonctionner à 100% sur les 3 variants.

Risk-based testing : la criticité maximale est sur (a) `/api/contact` + Resend, (b) accessibilité WCAG AA (Karim/Marc lecteurs exigeants), (c) conformité L.411-1 CMF (legal-audit.md).

## 2. Périmètre des tests

| Niveau         | Outil                  | Périmètre                                                                 |
|----------------|------------------------|---------------------------------------------------------------------------|
| Unit           | Vitest                 | `lib/contactSchema.ts` (Zod), `lib/rateLimit.ts` (compteur in-memory)     |
| Integration    | Playwright `request`   | `POST /api/contact` : validation Zod, honeypot, rate-limit, JSON malformé |
| E2E pages      | Playwright `page`      | 7 pages : H1, sections, footer, navigation, formulaires, contenu critique |
| Visual         | Playwright screenshots | 7 pages × 3 devices (iphone-13 / ipad / desktop-chrome) — gate G26        |
| Accessibilité  | @axe-core/playwright   | WCAG 2.1 / 2.2 niveau A et AA sur les 7 pages                             |
| Sécurité       | npm audit + manual     | OWASP Top 10 light + checklist `security-checklist.md`                    |
| Build          | tsc + next lint + build | Pre-deploy gate G28                                                       |

## 3. Outillage déjà en place

- **Vitest 2.1.4** + **@playwright/test 1.48.2** + **@axe-core/playwright 4.11**
- **Playwright config** : 3 projects (`iphone-13`, `ipad`, `desktop-chrome`) — voir `playwright.config.ts`
- **Baselines visuelles** : `tests/screenshots/{iphone-13,ipad,desktop-chrome}/*.png` (21 fichiers)
- **Pipeline manuel** : `npm run verify` = `tsc --noEmit && next lint && next build`

## 4. Distribution et structure des tests

```
tests/
├── e2e/
│   ├── smoke.spec.ts          # Smoke 7 routes + form consent
│   ├── us-pages.spec.ts       # US-01..US-04, US-A1, US-B1, US-13
│   ├── forms.spec.ts          # US-A2, US-10, US-12, US-11 (front)
│   ├── api-contact.spec.ts    # US-11 (API), validation Zod, rate-limit
│   └── a11y.spec.ts           # axe-core 7 pages + skip-link + touch targets
└── visual/
    └── screenshots.spec.ts    # Baselines G26
src/lib/
├── contactSchema.test.ts      # Vitest — schema Zod
└── rateLimit.test.ts          # Vitest — rate-limiter
```

Distribution Testing Trophy effective : statique (TS strict + ESLint) → 5 unit → 24 E2E (dont 7 a11y, 7 API, 7 forms) → 21 visual baselines.

## 5. Compromis et dette technique

### iPhone 13 sur Chromium (au lieu de WebKit)

**Compromis assumé** : `playwright.config.ts` utilise un Chromium en viewport `375×667 + isMobile + hasTouch + DPR=3` au lieu du device `iPhone 13` natif Playwright (qui force WebKit).

**Cause** : l'environnement sandbox d'exécution ne dispose pas des dépendances système nécessaires à WebKit (`libwoff1`, `libgles2-mesa`, `libavif…`). Voir le commentaire de `playwright.config.ts` lignes 22-32.

**Risque** : un bug spécifique WebKit (Safari mobile) peut passer sous le radar — par exemple un layout flex/grid qui rend différemment, ou un comportement de scroll iOS. **Pas un risque bloquant** pour un site vitrine 100% statique avec très peu de JS interactif (uniquement le formulaire de contact).

**Dette à lever** : sur le runner CI réel (GitHub Actions hosted runner ubuntu-latest, ou Replit Nix), `npx playwright install --with-deps webkit` doit fonctionner. Migrer alors le project `iphone-13` vers `devices['iPhone 13']` natif. **Ticket à ouvrir : `qa-001 — réactiver WebKit en CI`**.

### Vulnérabilités npm héritées

11 vulnérabilités au moment de l'audit (4 moderate / 5 high / 2 critical). Détails et arbitrage dans `security-audit.md`.

### Bug `color-contrast` levant-600 (BLOQUANT)

Le token `levant-600` (#a87340) ne respecte pas le ratio WCAG AA 4.5:1 sur fond crème/blanc pour le texte petit (12px et 16px). Détails dans `a11y-audit.md`. Bug bloquant à corriger par @fullstack avant Phase 2c.

## 6. Pipeline CI/CD recommandé

GitHub Actions — `.github/workflows/qa.yml` (à créer par @infrastructure) :

```yaml
name: QA
on: [push, pull_request]
jobs:
  qa:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run verify          # tsc + lint + build (gate G28)
      - run: npm test                # vitest unit
      - run: npx playwright install --with-deps chromium webkit
      - run: npx playwright test     # E2E + visual + a11y sur 3 devices
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: playwright-report/ }
```

**Branch protection** : merge bloqué si la CI est rouge sur `main`. Sur `claude/*` branches : warning seulement.

## 7. Critères d'acceptation des gates QA

### Gate G26 — Conformité visuelle

- **Source de vérité** : `tests/screenshots/{device}/*.png` (21 baselines générées par @fullstack lors de la boucle visuelle)
- **Vérification** : review humaine documentée dans `visual-baselines-review.md`
- **Seuil CI** : Playwright `toHaveScreenshot` avec `maxDiffPixelRatio: 0.005` (0.5%) — à activer en CI quand les baselines auront été review humain et committées
- **Verdict actuel** : voir `visual-baselines-review.md`

### Gate G27 — Matrice traçabilité 100%

- Chaque US de `functional-specs.md` a au moins 1 test E2E ou intégration
- Tableau exhaustif dans `TESTING.md`
- **Verdict actuel : PASS — 11/11**

### Gate G28 — Pipeline pre-deploy

1. `tsc --noEmit` : 0 erreur
2. `next lint` : 0 erreur (warnings tolérés)
3. Tests unitaires : PASS
4. Tests E2E sur happy path : PASS
5. Grep placeholders (`sk_test_`, `pk_test_`, `=xxx`, `=placeholder`) : 0 résultat dans `src/`

**Verdict actuel** : 4/5 PASS — voir `security-audit.md` pour le détail (item 5 à vérifier en Replit avant deploy).

### Gate G22 — WCAG 2.2 AA

- Contrastes ≥ 4.5:1 texte / 3:1 interactifs : **FAIL** (levant-600 — voir `a11y-audit.md`)
- Focus-visible : PASS (présent sur tous les inputs/boutons)
- Touch targets ≥ 44×44px mobile : à confirmer en exécution `iphone-13`
- prefers-reduced-motion : à valider visuellement (composants peu animés)

**Verdict actuel : GO CONDITIONNEL** — bloqué sur le contraste levant-600 jusqu'au fix @fullstack.

## 8. Plan d'évolution

| Itération | Action                                               | Owner         |
|-----------|------------------------------------------------------|---------------|
| Phase 2c  | Fix levant-600 → réactiver test color-contrast       | @fullstack    |
| Phase 2c  | Fix bugs détectés (footer imbriqué, honeypot Zod)    | @fullstack    |
| Phase 3   | Workflow GitHub Actions QA                           | @infrastructure |
| Phase 3   | `npm audit` clean (next 14.2.35 + vitest 2.1.9)      | @fullstack    |
| Post-launch | Migrer iphone-13 → WebKit natif sur CI runner       | @qa           |
| Post-launch | Lighthouse CI (LCP/CLS/INP) en pipeline             | @infrastructure |

---

## Handoff → @fullstack

**Bugs bloquants à corriger avant Phase 2c (testeur-karim / testeur-leila)** :

1. **`levant-600` non WCAG AA** : remplacer par `levant-700` (ou plus foncé) dans tous les usages text < 18px et liens "ghost" sur fond clair. Vérifier dans `tailwind.config.ts` ou directement dans les composants.
2. **Footer imbriqué dans `/accompagnement`** : un `<footer>` sémantique entoure le verbatim entrepreneur — à remplacer par `<figcaption>` ou `<p>` (un seul `<footer>` racine attendu par page).
3. **Honeypot dead code** : la branche `if (parsed.data.website)` de `route.ts:74` est inatteignable car Zod refuse `website` non vide en amont. Choisir : (a) retirer `.max(0)` du schema pour permettre le silent-200, OU (b) retirer la branche dead code (le bot recevra un 400 mais sera quand même bloqué — comportement actuel et fonctionnel).

**Recommandations non-bloquantes** :
- Ajouter `npm run verify && npm test` en pre-commit hook (Husky)
- Documenter dans `dev-decisions.md` le choix iphone-13 chromium

## Handoff → @infrastructure

- Créer `.github/workflows/qa.yml` (template fourni section 6)
- Activer branch protection sur `main` quand le repo migrera là-bas
- Confirmer que le runner cible (Replit Nix ou Actions ubuntu-latest) supporte `playwright install --with-deps webkit`
