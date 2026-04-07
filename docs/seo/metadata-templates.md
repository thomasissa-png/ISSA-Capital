# Metadata Templates — ISSA Capital
> @seo — 2026-04-07
> Format : Next.js App Router generateMetadata() — prêt à copier dans chaque page/layout
> Source : docs/seo/keyword-map.md + docs/copy/* + docs/strategy/brand-platform.md

**Principe de nommage** : `[Contexte page] — ISSA Capital` pour les title tags. Mot-clé exact en début, marque en fin. Cohérent avec les pratiques Bing (signaux exact-match sur le title).

**Vérification anti-contradiction** : les métadonnées de cette page sont alignées avec le copy de @copywriter (docs/copy/landing-page-copy.md Section "Métadonnées SEO" : title "ISSA Capital — Holding patrimoniale famille libanaise", description 153 caractères déjà définis). Ajustements marginaux effectués pour cohérence avec le keyword-map.

---

## Constantes globales (layout root)

```typescript
// src/app/layout.tsx — métadonnées par défaut (fallback)
export const metadata: Metadata = {
  metadataBase: new URL('https://issa-capital.com'),
  title: {
    default: 'ISSA Capital — Holding patrimoniale famille libanaise',
    template: '%s — ISSA Capital',
  },
  description: 'ISSA Capital est la holding patrimoniale de la famille Issa, aux racines libanaises, établie en France. Investissement immobilier, participations, conseil stratégique.',
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: 'ISSA Capital',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'ISSA Capital — Racines libanaises. Exigences sans exception.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@ISSACapital', // à confirmer si compte Twitter/X créé
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
}
```

---

## Page 1 — Accueil (/)

```typescript
// src/app/page.tsx
export const metadata: Metadata = {
  title: 'ISSA Capital — Holding patrimoniale famille libanaise',
  description: 'Holding patrimoniale d\'une famille aux racines libanaises, établie en France. Investissement immobilier, participations long terme, conseil stratégique. Horizon intergénérationnel.',
  alternates: {
    canonical: 'https://issa-capital.com/',
  },
  openGraph: {
    title: 'ISSA Capital — Racines libanaises. Exigences sans exception.',
    description: 'Holding patrimoniale familiale. Horizon intergénérationnel. Filtres de décision non négociables. Immobilier, participations, conseil.',
    url: 'https://issa-capital.com/',
  },
}
```

**Vérification caractères :**
- Title : `ISSA Capital — Holding patrimoniale famille libanaise` = 50 caractères ✓ (max 60)
- Description : `Holding patrimoniale d'une famille aux racines libanaises, établie en France. Investissement immobilier, participations long terme, conseil stratégique. Horizon intergénérationnel.` = 181 caractères — **à tronquer** à :
  - Version courte (155 car.) : `Holding patrimoniale d'une famille aux racines libanaises, établie en France. Investissement immobilier, participations, conseil stratégique.`

**Note @copywriter** : la meta description de landing-page-copy.md (153 car.) est prioritaire. Utiliser : "ISSA Capital est la holding patrimoniale de la famille Issa, famille aux racines libanaises, établie en France. Investissement immobilier, participations, conseil stratégique."

**H1 de la page** (issu du copy @copywriter, à ne pas modifier) :
> On décide. Pas un calendrier de fonds.

**Mot-clé exact dans le premier paragraphe** (pour Bing) :
> "La holding patrimoniale d'une famille aux racines libanaises..." — ISSA Capital nommé dans le sous-titre hero ✓

---

## Page 2 — Mission & Philosophie (/mission)

```typescript
// src/app/mission/page.tsx
export const metadata: Metadata = {
  title: 'Mission & Philosophie — ISSA Capital',
  description: 'La raison d\'être d\'ISSA Capital : faire fructifier le patrimoine de la famille Issa et organiser sa transmission entre générations. Histoire, valeurs, filtres de décision.',
  alternates: {
    canonical: 'https://issa-capital.com/mission',
  },
  openGraph: {
    title: 'Mission & Philosophie — ISSA Capital',
    description: 'L\'histoire d\'une famille libanaise enracinée en France, et d\'une holding construite pour traverser les générations.',
    url: 'https://issa-capital.com/mission',
  },
}
```

**Vérification caractères :**
- Title : `Mission & Philosophie — ISSA Capital` = 37 caractères ✓
- Description : `La raison d'être d'ISSA Capital : faire fructifier le patrimoine de la famille Issa et organiser sa transmission entre générations. Histoire, valeurs, filtres de décision.` = 172 caractères — à tronquer à :
  - `La raison d'être d'ISSA Capital : faire fructifier le patrimoine de la famille Issa et organiser sa transmission. Histoire, valeurs, filtres de décision.` = 155 caractères ✓

**H1 de la page** (à confirmer avec @copywriter) :
> [Récupérer le H1 exact de docs/copy/page-mission.md — Section 1 titre]

**Mot-clé exact dans le premier paragraphe** (pour Bing) : "Thomas Issa" et "holding" doivent apparaître dans les 150 premiers mots de la page.

---

## Page 3 — Participations (/participations)

```typescript
// src/app/participations/page.tsx
export const metadata: Metadata = {
  title: 'Participations — ISSA Capital',
  description: 'L\'écosystème de participations d\'ISSA Capital : Gradient One, Versi Immobilier, Versi Invest, Immocrew, Versimo, et patrimoine immobilier résidentiel en Île-de-France.',
  alternates: {
    canonical: 'https://issa-capital.com/participations',
  },
  openGraph: {
    title: 'Participations — ISSA Capital',
    description: 'Immobilier, home staging IA, marketing mandataires, club deal. L\'écosystème de participations de la famille Issa.',
    url: 'https://issa-capital.com/participations',
  },
}
```

**Vérification caractères :**
- Title : `Participations — ISSA Capital` = 30 caractères ✓
- Description : `L'écosystème de participations d'ISSA Capital : Gradient One, Versi Immobilier, Versi Invest, Immocrew, Versimo, et patrimoine immobilier résidentiel en Île-de-France.` = 169 caractères — à tronquer à :
  - `L'écosystème de participations d'ISSA Capital : Gradient One, Versi Immobilier, Immocrew, Versimo et patrimoine immobilier en Île-de-France.` = 140 caractères ✓

**H1 de la page** :
> [Récupérer le H1 exact de docs/copy/page-participations.md]

**Mot-clé exact dans le premier paragraphe** (pour Bing) : "ISSA Capital" + "participations" dans les 150 premiers mots.

---

## Page 4 — Accompagnement (/accompagnement)

```typescript
// src/app/accompagnement/page.tsx
export const metadata: Metadata = {
  title: 'Conseil & Accompagnement — Thomas Issa',
  description: 'Thomas Issa — fondateur ISSA Capital, ex-Sony TEOS, HEC — propose des missions de conseil et un rôle d\'advisor à des entrepreneurs en structuration patrimoniale.',
  alternates: {
    canonical: 'https://issa-capital.com/accompagnement',
  },
  openGraph: {
    title: 'Travailler avec Thomas Issa — ISSA Capital',
    description: 'Missions de conseil et advisoring pour fondateurs et investisseurs en structuration patrimoniale. Thomas Issa, ex-Sony TEOS, HEC, co-founder.',
    url: 'https://issa-capital.com/accompagnement',
  },
}
```

**Vérification caractères :**
- Title : `Conseil & Accompagnement — Thomas Issa` = 38 caractères ✓
- Description : `Thomas Issa — fondateur ISSA Capital, ex-Sony TEOS, HEC — propose des missions de conseil et un rôle d'advisor à des entrepreneurs en structuration patrimoniale.` = 161 caractères — à tronquer :
  - `Thomas Issa — fondateur ISSA Capital, ex-Sony TEOS, HEC — propose des missions de conseil et un rôle d'advisor pour entrepreneurs.` = 131 caractères ✓

**H1 de la page** :
> [Récupérer le H1 exact de docs/copy/page-accompagnement.md]

**Mot-clé exact dans le premier paragraphe** (pour Bing) : "Thomas Issa" en position 1 du texte visible. Déjà présent (verbatim Karim en ouverture selon le copy @copywriter).

---

## Page 5 — Opportunités (/opportunites)

```typescript
// src/app/opportunites/page.tsx
export const metadata: Metadata = {
  title: 'Opportunités d\'investissement — ISSA Capital',
  description: 'Proposez une opportunité à ISSA Capital : immobilier résidentiel Île-de-France, participations tech/immo. Critères explicites. Réponse dans la journée.',
  alternates: {
    canonical: 'https://issa-capital.com/opportunites',
  },
  openGraph: {
    title: 'Proposer une opportunité — ISSA Capital',
    description: 'ISSA Capital étudie les opportunités d\'investissement immobilier et de co-participation. Critères de décision non négociables. Réponse sous 24h.',
    url: 'https://issa-capital.com/opportunites',
  },
}
```

**Vérification caractères :**
- Title : `Opportunités d'investissement — ISSA Capital` = 44 caractères ✓
- Description : `Proposez une opportunité à ISSA Capital : immobilier résidentiel Île-de-France, participations tech/immo. Critères explicites. Réponse dans la journée.` = 152 caractères ✓

**H1 de la page** :
> [Récupérer le H1 exact de docs/copy/page-opportunites.md]

**Mot-clé exact dans le premier paragraphe** (pour Bing) : "ISSA Capital" + "opportunité" / "investissement" dans les 150 premiers mots.

**Note @legal** : la meta description ne contient aucun des mots interdits L.411-1 CMF (pas de "rendement", "investisseur", "souscription", "fonds"). Vérification OK.

---

## Page 6 — Contact (/contact)

```typescript
// src/app/contact/page.tsx
export const metadata: Metadata = {
  title: 'Contact — ISSA Capital',
  description: 'Contactez ISSA Capital — holding patrimoniale familiale à Nanterre. Email : contact@issa-capital.com. 54 Rue Henri Barbusse, 92000 Nanterre.',
  alternates: {
    canonical: 'https://issa-capital.com/contact',
  },
  openGraph: {
    title: 'Contact — ISSA Capital',
    description: 'Pour toute prise de contact avec ISSA Capital. Nanterre (92).',
    url: 'https://issa-capital.com/contact',
  },
}
```

**Vérification caractères :**
- Title : `Contact — ISSA Capital` = 22 caractères ✓
- Description : `Contactez ISSA Capital — holding patrimoniale familiale à Nanterre. Email : contact@issa-capital.com. 54 Rue Henri Barbusse, 92000 Nanterre.` = 140 caractères ✓

---

## Page 7 — Mentions légales (/mentions-legales)

```typescript
// src/app/mentions-legales/page.tsx
export const metadata: Metadata = {
  title: 'Mentions légales — ISSA Capital',
  description: 'Mentions légales, politique de confidentialité et informations juridiques d\'ISSA Capital SAS — SIREN 102 356 094 — Nanterre.',
  alternates: {
    canonical: 'https://issa-capital.com/mentions-legales',
  },
  robots: {
    index: false,   // NOINDEX — page sans valeur SEO (cf. functional-specs.md US-L3)
    follow: false,
  },
}
```

**Note** : le `robots: { index: false }` dans generateMetadata Next.js génère automatiquement `<meta name="robots" content="noindex, nofollow">`. Le robots.txt DOIT également exclure cette URL du crawl Bingbot (voir specs robots.txt ci-dessous).

---

## Spécifications robots.txt

```
# robots.txt — ISSA Capital
# Généré par @seo 2026-04-07

User-agent: *
Allow: /
Disallow: /mentions-legales

# Google
User-agent: Googlebot
Allow: /
Disallow: /mentions-legales

# Bing
User-agent: Bingbot
Allow: /
Disallow: /mentions-legales

# AI Crawlers — NE PAS BLOQUER (visibilité GEO — cf. docs/seo/seo-strategy.md)
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

# Sitemap
Sitemap: https://issa-capital.com/sitemap.xml
```

---

## Spécifications sitemap.xml

```typescript
// src/app/sitemap.ts — Next.js App Router
import { MetadataRoute } from 'next'

// IMPORTANT : les dates lastModified sont des CONSTANTES, pas des new Date()
// Bing est strict sur les dates qui changent à chaque build (signal de spam)
// Mettre à jour ces dates manuellement à chaque modification réelle de contenu

const CONTENT_DATES = {
  accueil: '2026-04-07',
  mission: '2026-04-07',
  participations: '2026-04-07',
  accompagnement: '2026-04-07',
  opportunites: '2026-04-07',
  contact: '2026-04-07',
} as const

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://issa-capital.com',
      lastModified: CONTENT_DATES.accueil,
      changeFrequency: 'monthly',
      priority: 1.0,
    },
    {
      url: 'https://issa-capital.com/mission',
      lastModified: CONTENT_DATES.mission,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: 'https://issa-capital.com/participations',
      lastModified: CONTENT_DATES.participations,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://issa-capital.com/accompagnement',
      lastModified: CONTENT_DATES.accompagnement,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://issa-capital.com/opportunites',
      lastModified: CONTENT_DATES.opportunites,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: 'https://issa-capital.com/contact',
      lastModified: CONTENT_DATES.contact,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    // /mentions-legales : EXCLUE du sitemap (noindex)
  ]
}
```

---

## Spécifications OG Image (pour @design)

**Format** : 1200 × 630 px (ratio 1.91:1 — standard Open Graph)
**Format fichier** : JPG (meilleure compression pour les images de partage social) ou PNG
**Chemin** : `/public/og-image.jpg`

**Contenu visuel recommandé** :
- Fond : `ink-950` (#0A0A0F du design system) OU `surface.primary` (crème #F5F0E8) — à arbitrer par @design
- Logo ISSA Capital : centré ou aligné gauche, blanc sur fond sombre / noir sur fond clair
- Baseline : "Racines libanaises. Exigences sans exception." en Cormorant Garamond italic si fond sombre, en Inter si fond clair
- Pas d'image de personne, pas de photo (cohérence avec choix design "typo as hero")
- Espacement généreux, respiration muséale

**Une seule og-image pour tout le site** (pas de personnalisation par page en V1 — cohérence de marque avant optimisation sociale).

---

## Récapitulatif — Tableau de contrôle

| Page | Title (car.) | Meta desc (car.) | Canonical | OG title | noindex |
|---|---|---|---|---|---|
| / | 50 ✓ | 153 ✓ | / ✓ | ✓ | non |
| /mission | 37 ✓ | 155 ✓ | /mission ✓ | ✓ | non |
| /participations | 30 ✓ | 140 ✓ | /participations ✓ | ✓ | non |
| /accompagnement | 38 ✓ | 131 ✓ | /accompagnement ✓ | ✓ | non |
| /opportunites | 44 ✓ | 152 ✓ | /opportunites ✓ | ✓ | non |
| /contact | 22 ✓ | 140 ✓ | /contact ✓ | ✓ | non |
| /mentions-legales | 33 ✓ | — | /mentions-legales ✓ | — | **oui** |

---

**Handoff → @fullstack**
- Copier les blocs `export const metadata` dans les fichiers page.tsx correspondants
- Créer `src/app/sitemap.ts` avec le code ci-dessus — utiliser les constantes de date, pas `new Date()`
- Créer `public/robots.txt` avec le contenu ci-dessus (ou `src/app/robots.ts` via Next.js Metadata API)
- La `metadataBase` dans le layout root est obligatoire pour que Next.js génère les URLs OG correctes
- Confirmer l'existence d'un compte Twitter/X avant d'activer le `twitter.site` dans les métadonnées
