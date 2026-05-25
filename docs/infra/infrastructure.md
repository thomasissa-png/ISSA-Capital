# Infrastructure — ISSA Capital

> Produit par @orchestrator (reprise après blocage @infrastructure) — 2026-04-07
> Source : project-context.md, docs/product/functional-specs.md, docs/legal/legal-audit.md

---

## Résumé exécutif

Site vitrine statique Next.js App Router déployé sur Replit. Zéro base de données, zéro authentification. Trois formulaires publics (Accompagnement, Opportunités, Contact) acheminés vers `contact@issa-capital.com` via **Resend**. Analytics **Plausible** cookieless. Fonts self-hosted (Cormorant Garamond + Inter). Tout-static sauf l'API `/api/contact`.

---

## Stack technique (verrouillée)

- **Framework** : Next.js 14+ (App Router, Server Components par défaut)
- **Langage** : TypeScript strict (`tsc --noEmit` en pre-commit)
- **Styles** : Tailwind CSS 3.4+ avec tokens 3 tiers (cf. `docs/design/design-tokens.json`)
- **Formulaires** : composant unique `<ContactForm variant="accompagnement|opportunite|contact">` + validation Zod
- **Envoi email** : Resend (DPA signé obligatoire — cf. `docs/legal/legal-audit.md`)
- **Analytics** : Plausible via `next-plausible` (cookieless, pas de bandeau requis)
- **Fonts** : `next/font/local` (fichiers WOFF2 dans `/public/fonts/`) — ZÉRO CDN Google
- **Hébergement** : **Replit** (Deployment Autoscale pour site statique)
- **Domaine** : issa-capital.com (DNS à pointer vers Replit)
- **HTTPS** : Let's Encrypt automatique Replit

---

## Arborescence Next.js prescrite

```
src/
├── app/
│   ├── layout.tsx                  # Root layout : header, footer, metadata globale, JSON-LD Organization
│   ├── page.tsx                    # / (Accueil)
│   ├── mission/page.tsx
│   ├── accompagnement/page.tsx
│   ├── opportunites/page.tsx
│   ├── participations/page.tsx
│   ├── contact/page.tsx
│   ├── mentions-legales/page.tsx   # noindex via metadata
│   ├── robots.ts                   # robots.txt dynamique (autorise GPTBot/ClaudeBot/PerplexityBot)
│   ├── sitemap.ts                  # sitemap dynamique (exclut /mentions-legales), dates constantes
│   ├── api/
│   │   └── contact/
│   │       └── route.ts            # POST → Resend, validation Zod, rate-limit, honeypot
│   └── not-found.tsx               # 404 sobre
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   ├── forms/
│   │   ├── ContactForm.tsx         # composant unique, prop `variant`
│   │   └── formSchemas.ts          # schémas Zod par variant
│   ├── ui/                         # Button, Input, Card, etc. (cf. component-library.md)
│   └── seo/
│       ├── OrganizationJsonLd.tsx
│       └── PersonJsonLd.tsx        # Thomas (utilisé uniquement sur /accompagnement)
├── lib/
│   ├── resend.ts                   # client Resend + sendContactEmail()
│   ├── rate-limit.ts               # rate limiter in-memory ou Upstash
│   └── analytics.ts                # helper useISSAAnalytics() (cf. tracking-plan.md)
├── data/
│   └── participations.ts           # config statique 6 participations
└── styles/
    └── globals.css                 # Tailwind + reset + classes utilitaires

public/
├── fonts/
│   ├── CormorantGaramond-Regular.woff2
│   ├── CormorantGaramond-Italic.woff2
│   ├── CormorantGaramond-SemiBold.woff2
│   ├── Inter-Regular.woff2
│   ├── Inter-Medium.woff2
│   └── Inter-SemiBold.woff2
├── favicon.ico
├── favicon.svg
├── apple-touch-icon.png
├── android-chrome-192x192.png
├── android-chrome-512x512.png
├── og-image.png                    # 1200×630, fond ink-950 + baseline "Racines libanaises. Exigences sans exception."
├── logo.svg                        # référencé dans Organization JSON-LD
└── site.webmanifest
```

---

## Variables d'environnement (Replit Secrets)

À configurer dans l'UI Replit (Secrets). **JAMAIS committer `.env`**.

| Variable | Exemple | Usage | Secret ? |
|---|---|---|---|
| `RESEND_API_KEY` | re_xxx | Client Resend | ✅ oui |
| `RESEND_FROM_EMAIL` | `ISSA Capital <contact@issa-capital.com>` | Expéditeur (from) | non |
| `RESEND_TO_EMAIL` | `contact@issa-capital.com` | Destinataire (Thomas) | non |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | `issa-capital.com` | Identifiant Plausible | non |
| `NEXT_PUBLIC_SITE_URL` | `https://issa-capital.com` | Canonical/OG URLs | non |
| `TURNSTILE_SECRET_KEY` | 0x4xxx | Cloudflare Turnstile anti-spam (optionnel) | ✅ oui |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | 0x4xxx | Clé publique Turnstile | non |
| `RATE_LIMIT_MAX` | `5` | Nb de soumissions max par IP / fenêtre | non |
| `RATE_LIMIT_WINDOW_MS` | `600000` | Fenêtre en ms (10 min) | non |

---

## Headers de sécurité (à configurer dans `next.config.js`)

```js
// next.config.js — extrait headers()
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://plausible.io",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self'",
            "connect-src 'self' https://plausible.io https://api.resend.com",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join('; '),
        },
      ],
    },
  ];
},
```

---

## API `/api/contact/route.ts` — spec

### Payload (validation Zod côté serveur)

```ts
const contactSchema = z.discriminatedUnion('variant', [
  z.object({
    variant: z.literal('accompagnement'),
    prenomNom: z.string().min(2).max(100),
    email: z.string().email(),
    sujet: z.string().min(3).max(150),
    message: z.string().min(20).max(2000),
    consent: z.literal(true),
    honeypot: z.string().max(0), // doit être vide
    turnstileToken: z.string().optional(),
  }),
  z.object({
    variant: z.literal('opportunite'),
    prenomNom: z.string().min(2).max(100),
    email: z.string().email(),
    typeOpportunite: z.enum(['immobilier', 'participation', 'autre']),
    localisation: z.string().min(2).max(200),
    description: z.string().min(20).max(500),
    ticketEstime: z.string().optional(),
    source: z.enum(['linkedin', 'recommandation', 'recherche', 'autre']).optional(),
    consent: z.literal(true),
    honeypot: z.string().max(0),
    turnstileToken: z.string().optional(),
  }),
  z.object({
    variant: z.literal('contact'),
    prenomNom: z.string().min(2).max(100),
    email: z.string().email(),
    sujet: z.string().min(3).max(150),
    message: z.string().min(20).max(2000),
    consent: z.literal(true),
    honeypot: z.string().max(0),
    turnstileToken: z.string().optional(),
  }),
]);
```

### Flow serveur
1. Parse JSON body → validation Zod → 400 si erreur
2. Check honeypot (champ caché) → 200 silencieux si rempli (anti-bot)
3. Check rate limit (in-memory ou Upstash) → 429 si dépassé
4. Verify Turnstile token si activé → 403 si fail
5. Sanitize toutes les entrées (escape HTML) avant email
6. Call Resend `sendEmail()` avec subject taggé : `[OPPORTUNITE]` / `[ACCOMPAGNEMENT]` / `[CONTACT]` + prenomNom + sujet
7. Return 200 `{ ok: true }` si succès, 500 si Resend fail

### Rate limiting
In-memory Map (suffit pour un site vitrine à faible trafic). Si montée en charge → migrer vers Upstash Ratelimit.
- 5 requêtes par IP par 10 min (configurable via `RATE_LIMIT_MAX` + `RATE_LIMIT_WINDOW_MS`)

---

## robots.ts (Next.js App Router)

```ts
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/mentions-legales', '/api/'],
      },
      // Autoriser explicitement les crawlers IA (visibilité GEO)
      { userAgent: 'GPTBot', allow: '/', disallow: ['/mentions-legales', '/api/'] },
      { userAgent: 'ClaudeBot', allow: '/', disallow: ['/mentions-legales', '/api/'] },
      { userAgent: 'PerplexityBot', allow: '/', disallow: ['/mentions-legales', '/api/'] },
      { userAgent: 'Google-Extended', allow: '/', disallow: ['/mentions-legales', '/api/'] },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL}/sitemap.xml`,
  };
}
```

---

## sitemap.ts

**Règle @seo** : dates constantes, pas `new Date()` (stabilité pour Bing).

```ts
import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://issa-capital.com';
// Date stable — à mettre à jour manuellement lors d'une refonte majeure
const LAST_MODIFIED = new Date('2026-04-07');

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, lastModified: LAST_MODIFIED, changeFrequency: 'monthly', priority: 1.0 },
    { url: `${SITE_URL}/mission`, lastModified: LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/accompagnement`, lastModified: LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/opportunites`, lastModified: LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/participations`, lastModified: LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/contact`, lastModified: LAST_MODIFIED, changeFrequency: 'yearly', priority: 0.6 },
    // /mentions-legales exclu (noindex)
  ];
}
```

---

## Monitoring post-launch (gratuit)

- **Uptime** : UptimeRobot — ping `/` toutes les 5 min, alertes email si downtime > 2 min
- **Analytics** : Plausible (déjà couvert par @data-analyst)
- **Lighthouse CI** : GitHub Actions optionnel — 1 audit par PR sur la preview Replit
- **Pas de Sentry/APM** : overkill pour un site vitrine statique sans backend complexe

---

## Déploiement Replit production (Phase 3, Étape 3 phase 2)

> Section ajoutée par @infrastructure le 2026-04-07 (session 3, phase 2 du déploiement).

La procédure de déploiement complète step-by-step destinée à Thomas (utilisateur non-technique) est documentée dans **`/REPLIT_ACTIONS.md`** à la racine du repo. Ce fichier est la **source de vérité opérationnelle** pour le jour J du déploiement.

**Vue d'ensemble en 9 étapes** :
1. **Configuration des Secrets Replit** — 7 variables obligatoires (Resend, NEXT_PUBLIC_SITE_URL, Plausible, rate limit) + 2 optionnelles (Turnstile)
2. **Configuration `.replit`** — `run = "npm run start"`, build `npm run build`, `deploymentTarget = "autoscale"`
3. **Premier déploiement preview** sur URL `*.replit.app` (filet de sécurité)
4. **Smoke tests sur preview** : navigation, formulaire bout-en-bout (2 variants), honeypot, rate limit, SEO files, Lighthouse mobile
5. **Activation production** : statut Live, auto-deploy on push `main`
6. **Configuration domaine custom `issa-capital.com`** : A record apex + CNAME www + TXT verify, propagation DNS, certificat Let's Encrypt
7. **Smoke tests post-domaine** : URLs canoniques alignées, sitemap, JSON-LD, Resend depuis le vrai domaine
8. **Soumission moteurs** : Google Search Console + Bing Webmaster + validation OG (LinkedIn/Facebook/X)
9. **Monitoring post-deploy** : UptimeRobot 5 min, Plausible Goals, logs Replit J+0/J+1, Lighthouse J+3

**Critères de rollback** : 8 conditions binaires (R1-R8) reprises de `docs/reviews/go-nogo-checklist.md` Section 5. Procédure rollback Replit en 1 clic via Deployments → History.

**Variables d'environnement runtime** (récap — détail dans REPLIT_ACTIONS.md Annexe A) :

| Nom | Type | Obligatoire |
|---|---|---|
| `RESEND_API_KEY` | server secret | Oui |
| `RESEND_FROM_EMAIL` | server secret | Oui |
| `RESEND_TO_EMAIL` | server secret | Oui |
| `NEXT_PUBLIC_SITE_URL` | public | Oui |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | public | Oui |
| `RATE_LIMIT_MAX` | server | Oui |
| `RATE_LIMIT_WINDOW_MS` | server | Oui |
| `TURNSTILE_SECRET_KEY` | server secret | Non |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | public | Non |

**Limites Replit Autoscale connues** :
- **Cold starts** possibles après inactivité (~1-3s sur le premier hit) — acceptable pour un site institutionnel
- **Storage éphémère** : aucun fichier persistant côté serveur — non bloquant car le site n'a pas de DB ni d'upload
- **Pas de cron natif** (vitrine Replit) : sans objet. Les tâches planifiées d'Anya tournent sur le **VPS** (crontab `thomas`), pilotées par le dépôt via `deploy/` (voir `deploy/README.md`)
- **Coût variable** selon trafic : surveiller le dashboard Usage la première semaine

**Documents liés** :
- `/REPLIT_ACTIONS.md` — procédure linéaire pour Thomas (source de vérité opérationnelle)
- `docs/reviews/go-nogo-checklist.md` — checklist Section 1 à valider AVANT Deploy + Section 5 critères rollback
- `docs/infra/deployment-replit.md` — version courte historique (kept for reference)
- `docs/infra/security-checklist.md` — vérifications headers post-deploy
- `docs/infra/performance-audit.md` — seuils Lighthouse cibles

---

## Handoff → @fullstack, @qa

**@fullstack** :
- Suivre l'arborescence prescrite
- Respecter les variables d'environnement (Secrets Replit)
- Installer les headers de sécurité dans `next.config.js`
- Implémenter l'API `/api/contact/route.ts` avec validation Zod stricte
- robots.ts et sitemap.ts selon spécification
- Fonts self-hosted via `next/font/local`
- **Pre-commit build check** (Règle 6 CLAUDE.md) : `tsc --noEmit && next lint && npm run build` avant chaque commit sur `src/`

**@qa** :
- Tester les 3 variants du formulaire (Zod + honeypot + rate limit)
- Vérifier headers de sécurité via `curl -I` en post-deploy
- Lighthouse CI : scores cibles dans `performance-audit.md`
- Security checklist binaire dans `security-checklist.md`
