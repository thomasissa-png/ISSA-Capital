# Structured Data JSON-LD — ISSA Capital
> @seo — 2026-04-07
> Schémas schema.org prêts à copier dans l'implémentation Next.js
> Source : project-context.md (données juridiques validées Thomas) + docs/strategy/personas.md + docs/seo/seo-strategy.md

**Principe** : les données structurées ne sont pas optionnelles sur un site institutionnel neuf sans historique SEO. Elles permettent à Google de construire un Knowledge Graph autour de l'entité ISSA Capital et de la personne Thomas Issa — signal E-E-A-T critique à 6 mois.

---

## 1. Schema Organization (layout root — toutes les pages)

À inclure dans `src/app/layout.tsx` via `next/script` avec `strategy="beforeInteractive"` ou via la balise `<script type="application/ld+json">` dans le `<head>`.

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://issa-capital.com/#organization",
  "name": "ISSA Capital",
  "legalName": "ISSA CAPITAL",
  "description": "Holding patrimoniale de la famille Issa, aux racines libanaises, établie en France. Investissement immobilier, participations long terme, conseil stratégique.",
  "url": "https://issa-capital.com",
  "logo": {
    "@type": "ImageObject",
    "url": "https://issa-capital.com/logo.svg",
    "width": 200,
    "height": 60
  },
  "image": "https://issa-capital.com/og-image.jpg",
  "email": "contact@issa-capital.com",
  "foundingDate": "2026-03-17",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "54 Rue Henri Barbusse",
    "addressLocality": "Nanterre",
    "postalCode": "92000",
    "addressCountry": "FR"
  },
  "identifier": [
    {
      "@type": "PropertyValue",
      "name": "SIREN",
      "value": "102356094"
    },
    {
      "@type": "PropertyValue",
      "name": "TVA",
      "value": "FR50102356094"
    }
  ],
  "knowsAbout": [
    "Holding patrimoniale",
    "Investissement immobilier",
    "Participations financières",
    "Transmission patrimoniale intergénérationnelle",
    "Immobilier Île-de-France"
  ],
  "areaServed": {
    "@type": "Country",
    "name": "France"
  },
  "sameAs": [
    "https://www.linkedin.com/company/issa-capital"
  ],
  "member": {
    "@type": "Person",
    "@id": "https://issa-capital.com/accompagnement#thomas-issa",
    "name": "Thomas Issa"
  }
}
```

**Notes d'implémentation @fullstack :**
- Le `sameAs` LinkedIn company à confirmer — si le compte LinkedIn ISSA Capital n'existe pas encore, retirer cette ligne ou remplacer par le LinkedIn personnel Thomas
- Le `logo` URL pointe vers `/logo.svg` — @design doit confirmer le nom du fichier final
- `foundingDate` : 2026-03-17 = date de création SAS confirmée Thomas

---

## 2. Schema Person — Thomas Issa (/accompagnement uniquement)

À inclure UNIQUEMENT dans `src/app/accompagnement/page.tsx` — pas dans le layout root.

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": "https://issa-capital.com/accompagnement#thomas-issa",
  "name": "Thomas Issa",
  "givenName": "Thomas",
  "familyName": "Issa",
  "jobTitle": "Président",
  "worksFor": {
    "@type": "Organization",
    "@id": "https://issa-capital.com/#organization",
    "name": "ISSA Capital"
  },
  "alumniOf": [
    {
      "@type": "EducationalOrganization",
      "name": "HEC Paris",
      "sameAs": "https://www.hec.edu"
    },
    {
      "@type": "EducationalOrganization",
      "name": "University of California, Irvine",
      "sameAs": "https://www.uci.edu"
    },
    {
      "@type": "EducationalOrganization",
      "name": "IMT Atlantique",
      "sameAs": "https://www.imt-atlantique.fr"
    }
  ],
  "knowsLanguage": [
    {
      "@type": "Language",
      "name": "French",
      "alternateName": "fr"
    },
    {
      "@type": "Language",
      "name": "English",
      "alternateName": "en"
    },
    {
      "@type": "Language",
      "name": "German",
      "alternateName": "de"
    },
    {
      "@type": "Language",
      "name": "Arabic",
      "alternateName": "ar"
    }
  ],
  "knowsAbout": [
    "Structuration de holding patrimoniale",
    "Investissement immobilier",
    "Participations financières",
    "Go-to-market international",
    "Co-fondation de startups",
    "Conseil stratégique entrepreneur"
  ],
  "sameAs": [
    "https://www.linkedin.com/in/thomas-issa"
  ],
  "url": "https://issa-capital.com/accompagnement",
  "nationality": {
    "@type": "Country",
    "name": "France"
  }
}
```

**Notes d'implémentation @fullstack :**
- L'URL LinkedIn Thomas (`https://www.linkedin.com/in/thomas-issa`) est un placeholder — vérifier l'URL exacte du profil LinkedIn de Thomas avant publication
- **NE PAS inclure** `birthDate`, `birthPlace`, ni aucune donnée familiale (enfants, conjoint) — RGPD et vie privée
- **NE PAS inclure Jean-Pierre Issa** dans ce schema Person — son identité est narrative (page /mission), pas opérationnelle (il n'est pas dirigeant de la SAS)
- Les langues "German" et "Arabic" sont documentées dans project-context.md (profil Thomas) — à confirmer par Thomas si souhaité dans le schema public

---

## 3. Schema WebSite (layout root — avec sitelinks searchbox potentielle)

À inclure dans `src/app/layout.tsx` en complément du schema Organization.

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://issa-capital.com/#website",
  "name": "ISSA Capital",
  "url": "https://issa-capital.com",
  "description": "Site officiel d'ISSA Capital, holding patrimoniale de la famille Issa",
  "publisher": {
    "@type": "Organization",
    "@id": "https://issa-capital.com/#organization"
  },
  "inLanguage": "fr-FR"
}
```

**Note** : la `SearchAction` (Sitelinks Searchbox de Google) n'est pas implémentée en V1 — le site n'a pas de moteur de recherche interne. Le schema WebSite de base suffit pour déclarer la relation entre le site et l'organisation.

---

## 4. Schema BreadcrumbList (par page)

Le BreadcrumbList aide Google et Bing à comprendre l'architecture du site. À inclure dans chaque page individuelle (pas dans le layout root).

### Accueil (/)
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Accueil",
      "item": "https://issa-capital.com"
    }
  ]
}
```

### Mission & Philosophie (/mission)
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Accueil",
      "item": "https://issa-capital.com"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Mission & Philosophie",
      "item": "https://issa-capital.com/mission"
    }
  ]
}
```

### Participations (/participations)
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Accueil",
      "item": "https://issa-capital.com"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Participations",
      "item": "https://issa-capital.com/participations"
    }
  ]
}
```

### Accompagnement (/accompagnement)
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Accueil",
      "item": "https://issa-capital.com"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Conseil & Accompagnement",
      "item": "https://issa-capital.com/accompagnement"
    }
  ]
}
```

### Opportunités (/opportunites)
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Accueil",
      "item": "https://issa-capital.com"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Opportunités d'investissement",
      "item": "https://issa-capital.com/opportunites"
    }
  ]
}
```

### Contact (/contact)
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Accueil",
      "item": "https://issa-capital.com"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Contact",
      "item": "https://issa-capital.com/contact"
    }
  ]
}
```

---

## 5. Implémentation dans Next.js App Router

### Pattern recommandé (layout root pour Organization + WebSite)

```tsx
// src/app/layout.tsx
import Script from 'next/script'

const organizationSchema = {
  // ... (copier le JSON de la section 1 ci-dessus)
}

const websiteSchema = {
  // ... (copier le JSON de la section 3 ci-dessus)
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <Script
          id="schema-organization"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <Script
          id="schema-website"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

### Pattern recommandé (page individuelle pour Person + BreadcrumbList)

```tsx
// src/app/accompagnement/page.tsx
import Script from 'next/script'

const personSchema = {
  // ... (copier le JSON de la section 2 ci-dessus)
}

const breadcrumbSchema = {
  // ... (copier le JSON BreadcrumbList /accompagnement de la section 4)
}

export default function AccompagnementPage() {
  return (
    <>
      <Script
        id="schema-person"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
      />
      <Script
        id="schema-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {/* contenu de la page */}
    </>
  )
}
```

**Note** : utiliser `next/script` avec `strategy="beforeInteractive"` pour les schemas JSON-LD (ils doivent être dans le `<head>` pour être lus par les crawlers). Alternativement, injecter via `generateMetadata` n'est pas possible pour JSON-LD — `next/script` est la voie correcte dans Next.js App Router.

---

## 6. Validation

Avant mise en ligne, valider chaque schema via :
- **Google Rich Results Test** : https://search.google.com/test/rich-results
- **Schema.org Validator** : https://validator.schema.org/
- **Bing Webmaster Tools** — section "SEO" → après indexation, vérifier que les structured data sont détectées

Schemas à tester en priorité :
1. Organization (layout root) — valider SIREN, adresse, logo
2. Person Thomas Issa (/accompagnement) — valider alumniOf, jobTitle, sameAs LinkedIn
3. BreadcrumbList d'une page quelconque — valider la structure hiérarchique

---

## Hypothèses à valider

- [HYPOTHÈSE] : URL LinkedIn Thomas = `https://www.linkedin.com/in/thomas-issa` — à confirmer avec Thomas. Si l'URL est différente, mettre à jour le schema Person avant mise en ligne.
- [HYPOTHÈSE] : URL LinkedIn company ISSA Capital = `https://www.linkedin.com/company/issa-capital` — à confirmer si le compte company LinkedIn existe. Si non, retirer le sameAs Organization.
- [À CONFIRMER THOMAS] : Thomas souhaite-t-il que ses 4 langues (français, anglais, allemand, arabe) apparaissent publiquement dans le schema ? C'est une donnée personnelle — non critique si retirée.

---

**Handoff → @fullstack**
- Fichiers produits : docs/seo/structured-data.md (ce fichier)
- Actions requises :
  1. Copier le schema Organization dans `src/app/layout.tsx` (via `next/script`)
  2. Copier le schema WebSite dans `src/app/layout.tsx` (même fichier, second `<Script>`)
  3. Copier le schema Person dans `src/app/accompagnement/page.tsx`
  4. Copier le BreadcrumbList correspondant dans chaque `page.tsx`
  5. Confirmer les URLs LinkedIn avec Thomas avant publication (sameAs Organization + Person)
  6. Valider via Google Rich Results Test avant mise en ligne
- Points d'attention : utiliser `next/script` avec `strategy="beforeInteractive"` pour les schemas, pas d'injection dans `generateMetadata` (incompatible)
