# Audit d'implémentation SEO technique — ISSA Capital
> @seo — 2026-04-07
> Branche : claude/issa-phase3-qa-7odSp
> Référence : docs/seo/metadata-templates.md
> Scope : code src/ vs specs metadata-templates.md — audit lecture seule, aucune modification de code

---

## Résumé exécutif

| Domaine | Statut | FAIL critiques |
|---|---|---|
| Métadonnées layout root | PASS avec réserves | 2 écarts mineurs |
| Métadonnées pages | PASS partiel | 5 écarts title/description |
| JSON-LD Organization | PASS partiel | 3 champs manquants |
| JSON-LD Person Thomas Issa | PASS partiel | 1 champ manquant |
| sitemap.xml | **FAIL CRITIQUE** | lastModified dynamique |
| robots.txt | PASS partiel | Directives Bingbot/AI crawlers absentes |
| Canonical | PASS | — |
| OG Image | PASS | Format PNG vs JPG (spec) |
| next/image | N/A | Site texte-only, pas d'images |
| next/font | FAIL | Fonts en CSS @font-face, pas next/font |
| lang="fr" | PASS | — |
| locale fr_FR | PASS | — |

**Verdict global : GO CONDITIONNEL**
- 1 FAIL CRITIQUE (sitemap lastModified) → correction obligatoire avant mise en production
- 5 écarts de métadonnées (title/description) → corrections recommandées
- next/font → déjà documenté comme TODO Phase 2b dans le code (acceptable)

---

## 1. Layout root — src/app/layout.tsx

### Tableau de contrôle

| Champ | Spec metadata-templates.md | Code réel | Statut |
|---|---|---|---|
| metadataBase | `new URL('https://issa-capital.com')` | `new URL(siteConfig.url)` — résout à `https://issa-capital.com` | PASS |
| title.default | `ISSA Capital — Holding patrimoniale famille libanaise` | `${siteConfig.name} — Holding patrimoniale famille libanaise` | PASS |
| title.template | `%s — ISSA Capital` | `%s — ${siteConfig.name}` | PASS |
| description | 153 caractères, mention famille libanaise | `siteConfig.description` = "Holding patrimoniale d'une famille aux racines libanaises, établie en France. Investissement immobilier, participations, conseil stratégique." (141 car.) | PASS |
| openGraph.type | `website` | `website` | PASS |
| openGraph.locale | `fr_FR` | `fr_FR` | PASS |
| openGraph.siteName | `ISSA Capital` | `siteConfig.name` | PASS |
| openGraph.images.url | `/og-image.jpg` | `/og-image.png` | FAIL-MINEUR |
| openGraph.images.width | 1200 | 1200 | PASS |
| openGraph.images.height | 630 | 630 | PASS |
| openGraph.images.alt | `ISSA Capital — Racines libanaises. Exigences sans exception.` | `${siteConfig.name} — ${siteConfig.baseline}` | PASS |
| twitter.card | `summary_large_image` | `summary_large_image` | PASS |
| twitter.site | `@ISSACapital` (à confirmer) | **absent** | FAIL-MINEUR |
| robots.index | true | true | PASS |
| robots.follow | true | true | PASS |
| robots.googleBot | index + follow | index + follow + max-image-preview:large + max-snippet:-1 | PASS (sur-spec, bon) |
| alternates.canonical | `https://issa-capital.com` | `siteConfig.url` | PASS |
| lang="fr" (html) | requis | `<html lang="fr">` | PASS |
| applicationName | non spécifié | `ISSA Capital` | PASS (bonus) |
| authors | non spécifié | `[{ name: 'Thomas Issa' }]` | PASS (bonus) |
| keywords | non spécifié | 7 keywords pertinents | PASS (bonus) |

### FAIL détaillés

**FAIL-MINEUR-L1 : OG image format — src/app/layout.tsx ligne 23 (via siteConfig.ogImage)**
- Spec : `/og-image.jpg`
- Code : `ogImage: '/og-image.png'` dans src/config/site.ts
- Réalité : le fichier `public/og-image.png` existe bien en PNG
- Impact : nul pour le rendu (les plateformes sociales acceptent PNG et JPG), mais incohérence spec/code
- Correction recommandée : aligner la spec (metadata-templates.md indique JPG mais le code et le fichier sont en PNG — choisir PNG uniformément, le fichier existe et est valide)

**FAIL-MINEUR-L2 : twitter.site absent — src/app/layout.tsx**
- Spec : `twitter: { card: '...', site: '@ISSACapital' }` avec note "à confirmer si compte Twitter/X créé"
- Code : `twitter: { card: 'summary_large_image', title: ..., description: ..., images: [...] }` — pas de `site`
- Impact : mineur (Twitter Cards fonctionnent sans `site`), cohérent avec la note "à confirmer" de la spec
- Correction : ajouter `site: '@ISSACapital'` uniquement si le compte X/Twitter est confirmé créé

---

## 2. Métadonnées par page

### 2.1 Page Accueil — src/app/page.tsx

| Champ | Spec | Code réel | Statut |
|---|---|---|---|
| metadata export | requis | **ABSENT** | FAIL |
| title | `ISSA Capital — Holding patrimoniale famille libanaise` | — | FAIL |
| description | 153 car. mention libanaise | — | FAIL |
| alternates.canonical | `https://issa-capital.com/` | — | FAIL |
| openGraph.title | `ISSA Capital — Racines libanaises. Exigences sans exception.` | — | FAIL |
| openGraph.description | famille libanaise, horizon | — | FAIL |
| openGraph.url | `https://issa-capital.com/` | — | FAIL |

**Analyse** : src/app/page.tsx ne contient aucun export `metadata`. La page hérite uniquement du fallback du layout root. C'est un FAIL SEO critique pour la page la plus importante du site.

- La page d'accueil hérite du title default du layout : `ISSA Capital — Holding patrimoniale famille libanaise` — acceptable comme fallback mais non optimal (le template `%s — ISSA Capital` ne s'applique que si un titre est fourni)
- Aucun canonical spécifique `/` vs racine du site
- Aucun openGraph.url spécifique à la page

**Correction requise :**
```typescript
// À ajouter dans src/app/page.tsx (avant la fonction HomePage)
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ISSA Capital — Holding patrimoniale famille libanaise',
  description:
    "Holding patrimoniale d'une famille aux racines libanaises, établie en France. Investissement immobilier, participations, conseil stratégique. Horizon intergénérationnel.",
  alternates: {
    canonical: 'https://issa-capital.com/',
  },
  openGraph: {
    title: 'ISSA Capital — Racines libanaises. Exigences sans exception.',
    description:
      "Holding patrimoniale familiale. Horizon intergénérationnel. Filtres de décision non négociables. Immobilier, participations, conseil.",
    url: 'https://issa-capital.com/',
  },
};
```

### 2.2 Page Mission — src/app/mission/page.tsx

| Champ | Spec | Code réel | Statut |
|---|---|---|---|
| title | `Mission & Philosophie — ISSA Capital` | `Mission — Patrimoine, famille, transmission` | FAIL |
| description (longueur) | 155 car. | "La mission d'ISSA Capital : faire fructifier le patrimoine familial d'une famille aux racines libanaises et organiser sa transmission. Filtres de décision, philosophie, valeurs." = 173 car. | FAIL |
| alternates.canonical | `https://issa-capital.com/mission` | `${siteConfig.url}/mission` ✓ | PASS |
| openGraph.title | `Mission & Philosophie — ISSA Capital` | `Mission & Philosophie — ISSA Capital` | PASS |
| openGraph.description | famille libanaise + filtres | présent | PASS |
| openGraph.url | `/mission` | `${siteConfig.url}/mission` ✓ | PASS |
| openGraph.type | non spécifié (website par défaut) | `article` | NOTE |

**FAIL-M1 : title non conforme à la spec**
- Spec : `Mission & Philosophie — ISSA Capital`
- Code : `Mission — Patrimoine, famille, transmission`
- Le code n'utilise pas le template `%s — ISSA Capital` car le title ne se termine pas par le pattern du template — il est exprimé en titre standalone
- Impact : le title standalone fonctionne côté Next.js, mais diverge de la spec et perd le mot-clé "ISSA Capital" en fin de titre (important pour Bing exact-match)

**FAIL-M2 : description trop longue (173 car. vs 155 max)**
- Correction : utiliser la version tronquée de la spec : "La raison d'être d'ISSA Capital : faire fructifier le patrimoine de la famille Issa et organiser sa transmission. Histoire, valeurs, filtres de décision." (155 car.)

**NOTE openGraph.type = 'article'** : la spec ne le spécifie pas. `article` est acceptable pour une page éditoriale, mais risque de demander un `article:published_time` pour validation parfaite Rich Cards. Neutre ici.

**Correction recommandée :**
```typescript
// src/app/mission/page.tsx — remplacer le bloc metadata
export const metadata: Metadata = {
  title: 'Mission & Philosophie',  // le template layout ajoute " — ISSA Capital"
  description:
    "La raison d'être d'ISSA Capital : faire fructifier le patrimoine de la famille Issa et organiser sa transmission. Histoire, valeurs, filtres de décision.",
  alternates: { canonical: `${siteConfig.url}/mission` },
  openGraph: {
    title: 'Mission & Philosophie — ISSA Capital',
    description:
      "L'histoire d'une famille libanaise enracinée en France, et d'une holding construite pour traverser les générations.",
    url: `${siteConfig.url}/mission`,
  },
};
```

### 2.3 Page Participations — src/app/participations/page.tsx


| Champ | Spec | Code réel | Statut |
|---|---|---|---|
| title | `Participations — ISSA Capital` | `Participations — Écosystème` | FAIL |
| description (longueur) | 140 car. | "ISSA Capital détient des participations dans Gradient One, Versi Immobilier, Versi Invest, Immocrew, Versimo et un patrimoine immobilier résidentiel en Île-de-France." = 163 car. | FAIL |
| alternates.canonical | `/participations` | `${siteConfig.url}/participations` ✓ | PASS |
| openGraph.title | `Participations — ISSA Capital` | `Les participations d'ISSA Capital` | PASS (équivalent) |
| openGraph.url | `/participations` | `${siteConfig.url}/participations` ✓ | PASS |

**FAIL-P1 : title non conforme**
- Spec : `Participations — ISSA Capital`
- Code : `Participations — Écosystème`
- La marque ISSA Capital est absente du title. Bing valorise la marque en fin de titre. Impact sur le branding défensif.

**FAIL-P2 : description 163 car. vs max 155**
- Correction : "L'écosystème de participations d'ISSA Capital : Gradient One, Versi Immobilier, Immocrew, Versimo et patrimoine immobilier en Île-de-France." (140 car.)

**Correction recommandée :**
```typescript
// src/app/participations/page.tsx — remplacer le bloc metadata
export const metadata: Metadata = {
  title: 'Participations',  // template ajoute " — ISSA Capital"
  description:
    "L'écosystème de participations d'ISSA Capital : Gradient One, Versi Immobilier, Immocrew, Versimo et patrimoine immobilier en Île-de-France.",
  alternates: { canonical: `${siteConfig.url}/participations` },
  openGraph: {
    title: "Les participations d'ISSA Capital",
    description:
      'Holding patrimoniale familiale. Écosystème cohérent : tech, immobilier, services aux professionnels.',
    url: `${siteConfig.url}/participations`,
  },
};
```

### 2.4 Page Accompagnement — src/app/accompagnement/page.tsx

| Champ | Spec | Code réel | Statut |
|---|---|---|---|
| title | `Conseil & Accompagnement — Thomas Issa` | `Conseil & accompagnement — Thomas Issa` | PASS (casse minuscule acceptable) |
| description (longueur) | 131 car. | "Thomas Issa accompagne fondateurs et investisseurs en structuration patrimoniale, holding, immo en direct et participations. 15 ans Sony, co-fondateur TEOS." = 155 car. | PASS (limite exacte) |
| alternates.canonical | `/accompagnement` | `${siteConfig.url}/accompagnement` | PASS |
| openGraph.title | `Travailler avec Thomas Issa — ISSA Capital` | `Travailler avec Thomas Issa — ISSA Capital` | PASS |
| openGraph.url | `/accompagnement` | `${siteConfig.url}/accompagnement` | PASS |

Statut global page /accompagnement : **PASS**

### 2.5 Page Opportunités — src/app/opportunites/page.tsx

| Champ | Spec | Code réel | Statut |
|---|---|---|---|
| title | `Opportunités d'investissement — ISSA Capital` | `Opportunités d'affaires` | FAIL |
| description (longueur) | 152 car. | "Soumettez votre opportunité à ISSA Capital — holding familiale qui investit dans l'immobilier et des participations minoritaires. Critères explicites, horizon long terme." = 165 car. | FAIL |
| alternates.canonical | `/opportunites` | `${siteConfig.url}/opportunites` | PASS |
| openGraph.title | `Proposer une opportunité — ISSA Capital` | `Proposer une opportunité à ISSA Capital` | PASS (équivalent) |
| openGraph.url | `/opportunites` | `${siteConfig.url}/opportunites` | PASS |

**FAIL-O1 : title perd le mot-clé "investissement" + la marque ISSA Capital**
- Spec : `Opportunités d'investissement — ISSA Capital`
- Code : `Opportunités d'affaires`
- Perd le mot-clé "investissement" (signal Bing exact-match) et le nom de marque en fin de titre

**FAIL-O2 : description 165 car. vs max 155**
- Correction (152 car.) : "Proposez une opportunité à ISSA Capital : immobilier résidentiel Île-de-France, participations tech/immo. Critères explicites. Réponse dans la journée."

**Correction recommandée :**
```typescript
// src/app/opportunites/page.tsx — remplacer le bloc metadata
export const metadata: Metadata = {
  title: "Opportunités d'investissement",  // template ajoute " — ISSA Capital"
  description:
    "Proposez une opportunité à ISSA Capital : immobilier résidentiel Île-de-France, participations tech/immo. Critères explicites. Réponse dans la journée.",
  alternates: { canonical: `${siteConfig.url}/opportunites` },
  openGraph: {
    title: 'Proposer une opportunité à ISSA Capital',
    description:
      "ISSA Capital étudie les opportunités d'investissement immobilier et de co-participation. Critères de décision non négociables. Réponse sous 24h.",
    url: `${siteConfig.url}/opportunites`,
  },
};
```

### 2.6 Page Contact — src/app/contact/page.tsx

| Champ | Spec | Code réel | Statut |
|---|---|---|---|
| title | `Contact — ISSA Capital` | `Contact` (template applique " — ISSA Capital") | PASS |
| description | 140 car. | "Prenez contact avec ISSA Capital. Pour toute demande — opportunité, accompagnement ou presse — écrivez à contact@issa-capital.com." = 129 car. | PASS |
| alternates.canonical | `/contact` | `${siteConfig.url}/contact` | PASS |
| openGraph.title | `Contact — ISSA Capital` | `Contact — ISSA Capital` | PASS |
| openGraph.url | `/contact` | `${siteConfig.url}/contact` | PASS |

Statut global page /contact : **PASS**

### 2.7 Page Mentions légales — src/app/mentions-legales/page.tsx

| Champ | Spec | Code réel | Statut |
|---|---|---|---|
| title | `Mentions légales — ISSA Capital` | `Mentions légales` (template) | PASS |
| robots.index | false | false | PASS |
| robots.follow | false | false | PASS |
| alternates.canonical | `/mentions-legales` | `${siteConfig.url}/mentions-legales` | PASS |
| openGraph | non requis (noindex) | absent | PASS |

Statut global page /mentions-legales : **PASS**

---

## 3. JSON-LD — Structured Data

### 3.1 Organization — src/app/layout.tsx

| Champ requis | Présent | Valeur | Statut |
|---|---|---|---|
| @type Organization | oui | `Organization` | PASS |
| name | oui | `siteConfig.legalName` = "ISSA Capital SAS" | PASS |
| alternateName | oui | `siteConfig.name` = "ISSA Capital" | PASS |
| url | oui | `siteConfig.url` | PASS |
| logo | oui | `${siteConfig.url}/logo.svg` | PASS |
| email | oui | `siteConfig.email` | PASS |
| description | oui | `siteConfig.description` | PASS |
| address (PostalAddress) | oui | streetAddress + postalCode + city + addressCountry | PASS |
| founder (Person) | oui | `Thomas Issa` | PASS |
| foundingDate | oui | `2026` | PASS |
| vatID | oui | `siteConfig.tvaIntra` | PASS |
| taxID (SIREN) | oui | `siteConfig.siren` | PASS |
| **sameAs** | **non** | **absent** | **FAIL** |
| **@type FinancialService** | **non** | Organization seulement | **FAIL** |
| **contactPoint** | **non** | **absent** | **FAIL** |

**FAIL-JLD-ORG-1 : sameAs manquant**
Impacte la reconnaissance de l'entité par Google Knowledge Graph et les LLM.
```json
"sameAs": [
  "https://www.linkedin.com/company/issa-capital",
  "https://www.pappers.fr/entreprise/issa-capital-102356094"
]
```

**FAIL-JLD-ORG-2 : @type FinancialService non ajouté**
Remplacer `'@type': 'Organization'` par `'@type': ['Organization', 'FinancialService']`.

**FAIL-JLD-ORG-3 : contactPoint manquant**
```json
"contactPoint": {
  "@type": "ContactPoint",
  "email": "contact@issa-capital.com",
  "contactType": "customer service"
}
```

### 3.2 Person Thomas Issa — src/app/mission/page.tsx

| Champ requis | Présent | Valeur | Statut |
|---|---|---|---|
| @type Person | oui | `Person` | PASS |
| name | oui | `Thomas Issa` | PASS |
| jobTitle | oui | `Fondateur et Président` | PASS |
| worksFor (Organization) | oui | ISSA Capital SAS + url | PASS |
| alumniOf | oui | HEC + UCI + IMT Atlantique | PASS (bonus) |
| knowsLanguage | oui | fr, en, de, ar | PASS (bonus) |
| **sameAs** | **non** | **absent** | **FAIL** |

**FAIL-JLD-PERSON-1 : sameAs LinkedIn manquant**
Critique pour E-E-A-T (Expertise + Authoritativeness). Ajouter :
```typescript
sameAs: ['https://www.linkedin.com/in/thomas-issa/'],  // URL à confirmer avec Thomas
```

---

## 4. sitemap.xml — src/app/sitemap.ts

### FAIL CRITIQUE

| Point | Spec | Code | Statut |
|---|---|---|---|
| Toutes les pages publiques listées | 6 routes | 6 routes | PASS |
| /mentions-legales exclue (noindex) | oui | absente du sitemap | PASS |
| **lastModified — constantes fixes** | dates constantes, jamais `new Date()` | `const now = new Date()` — date régénérée à chaque build | **FAIL CRITIQUE** |
| changeFrequency | monthly/yearly | correct | PASS |
| priority | 1.0 → 0.5 | accompagnement 0.9 vs spec 0.8 | FAIL MINEUR |

**FAIL-SITEMAP-1 : lastModified dynamique — CRITIQUE pour Bing**
- `const now = new Date()` régénère la date à chaque déploiement
- Bing interprète une lastModified qui change sans modification de contenu comme un signal de spam — peut dégrader la fréquence de crawl ou la confiance accordée au sitemap

**Correction obligatoire pour src/app/sitemap.ts :**
```typescript
// Supprimer : const now = new Date();
// Ajouter :
const CONTENT_DATES = {
  accueil: '2026-04-07',
  mission: '2026-04-07',
  participations: '2026-04-07',
  accompagnement: '2026-04-07',
  opportunites: '2026-04-07',
  contact: '2026-04-07',
} as const;

// Dans le return, chaque route utilise sa date constante :
// lastModified: CONTENT_DATES.accueil, etc.
// Règle : mettre à jour ces dates UNIQUEMENT lors d'une modification réelle du contenu de la page
```

---

## 5. robots.txt — src/app/robots.ts

| Point | Spec | Code | Statut |
|---|---|---|---|
| User-agent * Allow / | oui | oui | PASS |
| Disallow /mentions-legales | oui | oui | PASS |
| Disallow /api/ | non spécifié | oui (bonus) | PASS |
| Sitemap URL | sitemap.xml | sitemap.xml | PASS |
| **Directives Googlebot séparées** | oui (spec) | **absentes** | FAIL-MINEUR |
| **Directives Bingbot séparées** | oui (spec) | **absentes** | FAIL-MINEUR |
| **GPTBot Allow** | oui (spec GEO) | **absent** | FAIL-MINEUR |
| **ClaudeBot Allow** | oui (spec GEO) | **absent** | FAIL-MINEUR |
| **PerplexityBot Allow** | oui (spec GEO) | **absent** | FAIL-MINEUR |

**Note importante** : la règle `User-agent: *` couvre tous les bots non spécifiés — les AI crawlers ne sont donc PAS bloqués de facto. L'impact fonctionnel est nul. L'absence de directives explicites est une non-conformité à la spec, pas un problème opérationnel.

**Correction recommandée pour src/app/robots.ts :**
```typescript
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/mentions-legales'] },
      { userAgent: 'Googlebot', allow: '/', disallow: ['/mentions-legales'] },
      { userAgent: 'Bingbot', allow: '/', disallow: ['/mentions-legales'] },
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
```

---

## 6. OG Image — public/

| Point | Spec | Réalité | Statut |
|---|---|---|---|
| Fichier OG image existant | `/public/og-image.jpg` | `public/og-image.png` (et og-image-source.svg) | PASS (fichier présent) |
| Référencée dans metadata | `/og-image.jpg` | `siteConfig.ogImage = '/og-image.png'` | PASS (cohérent code/fichier) |
| Dimensions 1200×630 | oui | non vérifiable sans outil image | N/A |

**Note** : l'incohérence est dans la spec (metadata-templates.md indique .jpg, le code et le fichier sont en .png). Recommandation : mettre à jour metadata-templates.md pour indiquer .png — le code est correct.

---

## 7. Performance — next/image et next/font

**next/image** : aucune image de contenu dans les pages — site intégralement typographique (conforme directive design). N/A.

**next/font** : fonts gérées via `globals.css` avec `@font-face` + stacks système en fallback. Un TODO explicite dans layout.tsx (lignes 12-18) documente la migration vers `next/font/local` en Phase 2b post-network, justifiée par la contrainte d'environnement Replit sans accès réseau au build. Statut : FAIL technique accepté, documenté, avec plan de résolution.

---

## 8. Bilan — Tableau récapitulatif toutes pages

| Page | Title | Description | Canonical | OG | JSON-LD | noindex | Verdict |
|---|---|---|---|---|---|---|---|
| / (page.tsx) | FAIL (absent) | FAIL (absent) | FAIL (absent) | FAIL (absent) | N/A | non | FAIL |
| /mission | FAIL (titre diff) | FAIL (173 car.) | PASS | PASS | PASS partiel | non | FAIL |
| /participations | FAIL (titre diff) | FAIL (163 car.) | PASS | PASS | N/A | non | FAIL |
| /accompagnement | PASS | PASS | PASS | PASS | N/A | non | PASS |
| /opportunites | FAIL (titre diff) | FAIL (165 car.) | PASS | PASS | N/A | non | FAIL |
| /contact | PASS | PASS | PASS | PASS | N/A | non | PASS |
| /mentions-legales | PASS | N/A | PASS | N/A | N/A | PASS | PASS |
| layout root | PASS | PASS | PASS | PASS | PASS partiel | N/A | PASS partiel |
| sitemap.ts | — | — | — | — | — | — | **FAIL CRITIQUE** |
| robots.ts | — | — | — | — | — | — | PASS (fonctionnel) |

---

## 9. Liste consolidée des corrections

### FAIL CRITIQUE — à corriger avant déploiement production

| # | Fichier | Problème | Correction |
|---|---|---|---|
| FC-1 | src/app/sitemap.ts | `const now = new Date()` — date dynamique | Remplacer par constantes `CONTENT_DATES` (voir Section 4) |

### FAIL IMPORTANTS — priorité haute

| # | Fichier | Problème | Correction |
|---|---|---|---|
| FI-1 | src/app/page.tsx | Aucun export `metadata` | Ajouter le bloc metadata complet (voir Section 2.1) |
| FI-2 | src/app/mission/page.tsx | title divergent + description 173 car. | title `Mission & Philosophie` + description 155 car. (voir Section 2.2) |
| FI-3 | src/app/participations/page.tsx | title divergent + description 163 car. | title `Participations` + description 140 car. (voir Section 2.3) |
| FI-4 | src/app/opportunites/page.tsx | title divergent + description 165 car. | title `Opportunités d'investissement` + description 152 car. (voir Section 2.5) |
| FI-5 | src/app/layout.tsx | JSON-LD Organization : sameAs + FinancialService + contactPoint absents | Ajouter les 3 champs (voir Section 3.1) |
| FI-6 | src/app/mission/page.tsx | JSON-LD Person : sameAs LinkedIn absent | Ajouter sameAs LinkedIn Thomas Issa (Section 3.2) — URL à confirmer avec Thomas |

### FAIL MINEURS — priorité basse

| # | Fichier | Problème | Note |
|---|---|---|---|
| FM-1 | src/app/robots.ts | Directives par bot absentes | Fonctionnel via `*`, correction pour conformité spec |
| FM-2 | src/app/layout.tsx | twitter.site absent | À ajouter si compte X/Twitter confirmé |
| FM-3 | src/app/sitemap.ts | Priorité accompagnement 0.9 vs spec 0.8 | Impact Google minimal |
| FM-4 | docs/seo/metadata-templates.md | Spec indique og-image.jpg, code utilise .png | Mettre à jour la spec (pas le code) |
| FM-5 | src/app/layout.tsx | next/font non implémenté | Justifié, TODO Phase 2b documenté dans le code |

---

## 10. Verdict global

**GO CONDITIONNEL**

Le socle SEO technique est correctement architecturé (Next.js App Router, metadataBase, siteConfig centralisé, lang="fr", locale fr_FR, canonical sur les pages secondaires, noindex correct sur /mentions-legales, JSON-LD Organization avec données légales complètes, identité libanaise dans tous les textes).

Les corrections FC-1 (sitemap) et FI-1 à FI-4 (metadata pages) sont des ajustements de contenu rapides à implémenter — aucun refactoring architectural requis. FI-5 et FI-6 (JSON-LD) nécessitent l'URL LinkedIn de Thomas Issa pour être complets.

---

**Handoff → @fullstack**

Fichiers produits :
- `docs/seo/seo-implementation-audit.md`

Corrections à implémenter par ordre de priorité :

1. **URGENT — src/app/sitemap.ts** : remplacer `const now = new Date()` par les constantes `CONTENT_DATES` (voir Section 4). Ne pas utiliser `new Date()` dans le sitemap — signal de spam Bing à chaque build.

2. **HAUTE — src/app/page.tsx** : ajouter l'export `metadata` complet (voir Section 2.1 pour le bloc exact). La page d'accueil n'a aucune métadonnée propre.

3. **HAUTE — Metadata /mission, /participations, /opportunites** : corriger titles et descriptions (voir Sections 2.2, 2.3, 2.5). Pattern : `title: 'Xxx'` sans le nom de marque — le template layout.tsx ajoute " — ISSA Capital" automatiquement.

4. **HAUTE — JSON-LD Organization (src/app/layout.tsx)** : ajouter `sameAs`, `@type: ['Organization', 'FinancialService']`, `contactPoint` (voir Section 3.1).

5. **HAUTE — JSON-LD Person (src/app/mission/page.tsx)** : ajouter `sameAs` avec l'URL LinkedIn Thomas Issa (voir Section 3.2). Demander l'URL LinkedIn à Thomas avant implémentation.

6. **BASSE — src/app/robots.ts** : ajouter les directives par bot (voir Section 5).

Points d'attention :
- Ne PAS utiliser `new Date()` dans sitemap.ts
- L'URL LinkedIn de Thomas Issa est un prérequis pour JSON-LD Person complet — action humaine nécessaire
- La migration next/font est Phase 2b, ne pas bloquer le lancement

Décisions prises dans cet audit :
- L'incohérence og-image .jpg/.png est dans la spec (pas dans le code) — recommandation de corriger metadata-templates.md
- next/font non implémenté est une contrainte d'environnement documentée, pas un FAIL bloquant
- Les directives AI crawlers dans robots.ts sont non-bloquantes (règle `*` les couvre de facto)
