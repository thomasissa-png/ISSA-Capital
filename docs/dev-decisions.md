# Dev Decisions — ISSA Capital

> @fullstack — 2026-04-07 — session 2 (Phase 2b).
> Journal des décisions techniques prises pendant l'implémentation du site vitrine.

---

## Résumé exécutif

- Site vitrine Next.js 14 App Router, TypeScript strict, Tailwind avec tokens 3 tiers.
- 7 pages statiques + 1 API route (`/api/contact`).
- Composant unique `<ContactForm variant="…">` qui couvre les 3 formulaires (contact / accompagnement / opportunite).
- Build passe (`tsc`, `next lint`, `next build`) avec 0 erreur, 0 warning.
- First Load JS : ~94-98 kB par route, largement sous le budget de 200 kB.

---

## Décisions majeures

### 1. Polices — fallback système temporaire

**Contexte** : le brief impose des polices self-hosted (Cormorant Garamond + Inter) via `next/font/local`. Le dossier `public/fonts/` était vide au démarrage et l'environnement de build de la session n'a **aucun accès réseau** (echec de `next/font/google` lors de la tentative de bundling).

**Décision** : configurer les CSS variables `--font-cormorant` et `--font-inter` dans `globals.css` avec des **stacks système** de qualité typographique proche (Georgia pour le serif, Inter/system-ui pour le sans-serif). Les composants référencent toujours ces variables via Tailwind (`font-heading`, `font-body`), donc la bascule vers du vrai self-hosting sera une modification **localisée** (une seule dépendance : les fichiers .woff2).

**TODO Phase 2c / Phase 3** : placer les fichiers `.woff2` dans `public/fonts/` et remplacer les stacks dans `globals.css` par des règles `@font-face` avec `font-display: swap`. Ou, si l'environnement Replit a accès réseau au build, rebasculer sur `next/font/google` (un commit inverse des deux blocs supprimés de `app/layout.tsx` suffit).

**Pourquoi ce choix** : avancer plutôt que bloquer — les stacks système sont WCAG-compatibles et rendent correctement le design. La correction sera triviale.

### 2. ContactForm — composant unique à 3 variants

**Décision** : un seul fichier `src/components/ui/ContactForm.tsx` qui prend une prop `variant: 'contact' | 'accompagnement' | 'opportunite'` et rend dynamiquement les bons champs, le bon libellé de submit, et le bon message de confirmation.

**Pourquoi** : demandé explicitement dans le brief. Évite la duplication. Les 3 variants partagent 100% du pipeline (validation Zod discriminated union, fetch, gestion d'état, honeypot, consentement RGPD, messages d'erreur).

**États UI couverts (gate G21)** : 5 états (idle / submitting / success / error / field-errors). Le `vide` n'est pas applicable à un formulaire (pas de liste à remplir).

### 3. Rate limit — in-memory Map

**Décision** : `src/lib/rateLimit.ts` implémente un limiter in-memory basé sur une Map JavaScript, avec GC automatique toutes les 60s. Pas d'Upstash/Redis.

**Pourquoi** : site vitrine déployé sur une instance unique Replit. Aucune raison de complexifier avec une dépendance externe. Limite par défaut : 5 requêtes / 10 minutes par IP. Configurable via `RATE_LIMIT_MAX` et `RATE_LIMIT_WINDOW_MS`.

**Limite connue** : si Replit passe en scale horizontal plus tard, chaque instance aura son propre compteur. À migrer vers Upstash à ce moment-là. Documenté dans le fichier lui-même.

### 4. Sanitization — regex sans dépendance

**Décision** : `src/lib/sanitize.ts` fait du strip HTML + suppression des caractères de contrôle avec des regex simples. Pas de DOMPurify, pas de jsdom.

**Pourquoi** : DOMPurify côté serveur Node nécessite jsdom (~15MB installés). Pour un site où les seuls champs libres sont `name`, `message`, `location`, `description`, `ticket`, les regex sont suffisantes. La validation de format (email, enum) est faite en amont par Zod. Le HTML n'est jamais rendu : il est seulement injecté dans un email HTML via un escape maison (`escapeHtml` dans `resend.ts`).

### 5. Resend — instanciation paresseuse

**Décision** : `getClient()` dans `src/lib/resend.ts` instancie le client Resend seulement à la première utilisation. Le build ne crashe pas si `RESEND_API_KEY` est absent/placeholder — un warning est loggué et l'API retourne une erreur contrôlée.

**Pourquoi** : permet le build CI même sans secrets. Détecte explicitement les placeholders (`re_xxxxx`) pour éviter les timeouts silencieux sur `resend.emails.send()` (pattern déjà documenté dans le mindset `@fullstack`).

### 6. Headers de sécurité — déjà dans `next.config.js`

Le fichier `next.config.js` était déjà en place à l'ouverture de session avec tous les headers conformes au `docs/infra/infrastructure.md` (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy). **Non modifié** — validé tel quel.

### 7. Rendu statique partout

**Décision** : toutes les 7 pages publiques ont `export const dynamic = 'force-static'`. Aucune d'entre elles ne dépend de données runtime. Next les génère en SSG au build.

**Pourquoi** : performance maximum (TTFB < 50ms sur CDN), coût serveur minimal, aucune fuite de PII. Les seules routes dynamiques sont `/api/contact` (POST) et `/sitemap.xml`/`/robots.txt` (générés au build).

### 8. Accessibilité — WCAG 2.2 AA

- Skip link en haut de chaque page (`.skip-link` focus-visible uniquement)
- Focus-visible global à `2px solid levant-500` avec offset 2px
- Touch targets : boutons 48px min, ghost 44px min
- `prefers-reduced-motion` : animations court-circuitées globalement dans `globals.css`
- ARIA : landmarks (`header`, `nav`, `main`, `footer`), `aria-label`, `aria-describedby` sur les erreurs, `aria-live` sur les messages de statut du formulaire
- Contraste levant : usage de **levant-600** (ratio 4.6:1) pour tout texte d'accent <18px sur fond clair. levant-500 uniquement sur fond sombre ou pour des bordures/séparateurs. Respecte la règle WCAG documentée dans `page-compositions.md`.

### 9. JSON-LD structured data

- **Organization** injecté dans `app/layout.tsx` (toutes les pages) — inclut `name`, `url`, `logo`, `address`, `founder`, `foundingDate`, `vatID`, `taxID`.
- **Person** (Thomas Issa) injecté sur `/mission` uniquement — inclut `jobTitle`, `alumniOf` (HEC, UC Irvine, IMT), `knowsLanguage`.

### 10. robots.txt et sitemap.xml

Générés dynamiquement par `app/robots.ts` et `app/sitemap.ts` (conventions Next 14). `mentions-legales` est exclue du sitemap ET marquée `noindex, nofollow` dans ses metadata Next.

### 11. Assets d'image — déjà présents

Les assets SVG (`favicon.svg`, `logo.svg`, `logo-inverse.svg`, `apple-touch-icon.svg`, `android-chrome-*.svg`, `og-image-source.svg`, `site.webmanifest`) étaient déjà dans `public/` au démarrage (produits par @design en parallèle). **Non modifiés**. Le `og-image.png` binaire (1200×630) reste à produire par @design — le metadata layout y fait déjà référence (`/og-image.png`). Tant qu'il n'existe pas, les cartes OG sur les réseaux sociaux afficheront une image cassée — à corriger en Phase 2c avant déploiement.

---

## Structure du code

```
src/
├── app/
│   ├── layout.tsx             ← Root layout, fonts, JSON-LD Organization, skip link
│   ├── page.tsx               ← Accueil
│   ├── mission/page.tsx       ← Mission & Philosophie + JSON-LD Person Thomas
│   ├── accompagnement/page.tsx
│   ├── opportunites/page.tsx
│   ├── participations/page.tsx
│   ├── contact/page.tsx
│   ├── mentions-legales/page.tsx  ← noindex, nofollow
│   ├── api/contact/route.ts   ← POST handler avec Zod + rate limit + Resend
│   ├── robots.ts              ← robots.txt dynamique
│   ├── sitemap.ts             ← sitemap.xml dynamique
│   ├── not-found.tsx          ← 404 custom
│   ├── error.tsx              ← Error boundary client
│   ├── loading.tsx            ← Loading state root
│   └── globals.css            ← Tokens sémantiques + reset + a11y
├── components/
│   ├── layout/
│   │   ├── Header.tsx         ← Client : sticky, burger mobile, active state
│   │   └── Footer.tsx         ← Server : clause légale, navigation
│   └── ui/
│       ├── Button.tsx         ← 4 variants, polymorphe link/button
│       ├── Container.tsx      ← max-w content/editorial/narrow
│       ├── Section.tsx        ← 4 tons, padding vertical responsive
│       ├── Overline.tsx       ← petit label avec usage WCAG levant-600/500
│       └── ContactForm.tsx    ← CLIENT — pièce centrale, 3 variants
├── lib/
│   ├── cn.ts                  ← Wrapper clsx
│   ├── env.ts                 ← Validation Zod runtime variables serveur
│   ├── rateLimit.ts           ← Limiter in-memory
│   ├── sanitize.ts            ← Strip HTML et contrôle
│   ├── contactSchema.ts       ← Schémas Zod discriminated union
│   ├── resend.ts              ← Client Resend + template email HTML
│   ├── rateLimit.test.ts      ← Vitest
│   └── contactSchema.test.ts  ← Vitest
└── config/
    └── site.ts                ← Source de vérité business (email, adresse, nav)
```

---

## Pre-commit gate check

Exécuté en fin de session :

| Check | Commande | Statut |
|---|---|---|
| TypeScript strict | `npx tsc --noEmit` | ✅ PASS (0 erreur) |
| ESLint | `npx next lint` | ✅ PASS (0 warning, 0 erreur) |
| Production build | `npx next build` | ✅ PASS (12/12 pages générées) |
| Tests unitaires | `npx vitest run` | ✅ PASS (5 tests / 2 fichiers) |
| E2E Playwright | `npx playwright test` | ⏸️ DIFFÉRÉ — browsers non installables dans le sandbox de session (pas d'accès réseau). Les specs sont prêtes dans `tests/e2e/smoke.spec.ts` et `tests/visual/screenshots.spec.ts`. À exécuter par @qa en Phase 2c sur environnement avec accès réseau. |
| Boucle visuelle 3 devices | Screenshots Playwright | ⏸️ DIFFÉRÉ — même raison. Specs prêtes, baselines à générer en Phase 2c. |

---

## TODOs remontés à @orchestrator / @qa / @design

1. **@design** — og-image.png binaire 1200×630 (seule asset encore manquant en binaire).
2. **@design** — variantes PNG des icônes (favicon.ico, apple-touch-icon.png, android-chrome-*.png). Les SVG sources sont déjà en place ; la conversion binaire reste à faire si on veut un support complet legacy.
3. **@qa** — installer Playwright browsers et exécuter la matrice E2E + baselines screenshots 3 devices.
4. **@qa** — étendre `tests/e2e/smoke.spec.ts` vers la matrice traçabilité complète des 11 user stories de `functional-specs.md` (gate G27).
5. **Fonts** — placer Cormorant Garamond + Inter dans `public/fonts/` et rebasculer sur `next/font/local` (ou rebasculer sur `next/font/google` si l'env de build Replit a accès réseau). Fichier concerné : `src/app/layout.tsx` (commentaire TODO déjà en place) + `src/app/globals.css` (variables `--font-cormorant` et `--font-inter`).
6. **Thomas** — confirmation qualité Président dans les mentions légales (noté `[HYPOTHÈSE]` par @copywriter, affiché tel quel par défaut).
