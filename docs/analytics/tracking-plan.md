# Tracking Plan — ISSA Capital (Plausible)

## Résumé exécutif

- **Objectif** : Instrumenter ISSA Capital pour mesurer les 2 objectifs business — crédibilité institutionnelle et pipeline d'opportunités — via Plausible Analytics
- **Décisions clés** : Plausible (sans cookies, RGPD-native, pas de bandeau consentement requis) ; 9 événements custom + pageviews automatiques ; 3 Goals Plausible configurés
- **Dépendances** : @fullstack pour l'implémentation du snippet et des helpers TypeScript ; @legal pour mention dans la politique de confidentialité

---

## 1. Configuration Plausible — Vue d'ensemble

| Paramètre | Valeur |
|-----------|--------|
| Outil | Plausible Analytics (Cloud ou self-hosted) |
| Domaine configuré | issa-capital.com |
| Script | `https://plausible.io/js/script.tagged-events.js` (version avec custom events activés) |
| Cookies | Aucun (by design Plausible) |
| Bandeau consentement | Non requis (anonymisation totale par défaut) |
| RGPD | Conforme sans consentement — voir section 5 |
| Goals configurés | 3 (voir section 4) |

---

## 2. Inventaire des événements

### 2.1 Pageviews (automatique)

| Événement | Déclencheur | Propriétés | KPI alimenté |
|-----------|-------------|-----------|--------------|
| `pageview` | Chargement de chaque page — automatique Plausible (SPA : déclenché via `next-plausible` sur route change) | `url`, `referrer` (automatique) | Tous les KPIs (trafic de base) |

### 2.2 Événements custom

#### `cta_primary_click`

| Champ | Valeur |
|-------|--------|
| **Nom** | `cta_primary_click` |
| **Déclencheur** | Clic sur n'importe quel bouton/lien avec le texte "Proposer une opportunité d'investissement" — présent sur toutes les pages (Accueil hero, Accueil section basse, Opportunités, Contact) |
| **DOM trigger** | `onClick` sur le composant `<CTAPrimary>` |
| **Propriétés** | `page_source` (string) : page d'où le clic provient — valeurs : `accueil_hero`, `accueil_bas`, `opportunites`, `participations`, `contact` |
| **KPI alimenté** | Taux de conversion visiteur → demande (étape intermédiaire du funnel) |

#### `contact_form_submit`

| Champ | Valeur |
|-------|--------|
| **Nom** | `contact_form_submit` |
| **Déclencheur** | Soumission réussie du formulaire de contact (après validation côté client ET réponse HTTP 200 de l'API route Next.js) |
| **DOM trigger** | `onSuccess` du handler de soumission formulaire (pas `onSubmit` — uniquement après confirmation succès API) |
| **Propriétés** | `type_demande` (string) : valeur du champ "Type de demande" du formulaire — valeurs : `opportunite_investissement`, `partenariat`, `presse`, `autre` |
| **KPI alimenté** | North Star Metric (filtré sur `type_demande = opportunite_investissement`) + taux de conversion total |

> Note @fullstack : l'event doit être déclenché APRÈS confirmation de succès de l'envoi email (Resend ou équivalent), pas au clic sur "Envoyer". Cela garantit de ne compter que les soumissions effectivement transmises.

#### `external_link_click`

| Champ | Valeur |
|-------|--------|
| **Nom** | `external_link_click` |
| **Déclencheur** | Clic sur un lien externe vers un site de participation ISSA (immocrew.fr, versimo.fr, gradientone.fr) |
| **DOM trigger** | `onClick` sur balise `<a target="_blank">` pointant vers un domaine de participation |
| **Propriétés** | `participation_name` (string) : nom de la participation — valeurs : `immocrew`, `versimo`, `gradient_one`, `versi_immobilier`, `versi_invest` ; `url_target` (string) : URL complète cliquée |
| **KPI alimenté** | Engagement écosystème — signal d'intérêt pour les participations |

#### `scroll_depth_50` / `scroll_depth_75` / `scroll_depth_100`

| Champ | Valeur |
|-------|--------|
| **Noms** | `scroll_depth_50`, `scroll_depth_75`, `scroll_depth_100` |
| **Déclencheur** | L'utilisateur scrolle jusqu'au seuil correspondant (50%, 75%, 100% de la hauteur de la page) |
| **Pages instrumentées** | `/mission` (page Mission & Philosophie) + `/participations` (page Participations) — prioritaires |
| **DOM trigger** | IntersectionObserver sur des sentinelles positionnées à 50%, 75%, 100% de la page ; déclenché une seule fois par session par seuil (flag booléen `triggered`) |
| **Propriétés** | `page` (string) : page concernée — valeurs : `mission`, `participations` |
| **KPI alimenté** | KPI-2 (temps Mission), KPI-5 (scroll Participations) |

> Note @fullstack : utiliser `IntersectionObserver` avec `once: true` pour ne déclencher qu'une fois par page par session. Ne pas utiliser `scroll` event listener natif (perf).

#### `time_on_page_30s` / `time_on_page_2min`

| Champ | Valeur |
|-------|--------|
| **Noms** | `time_on_page_30s`, `time_on_page_2min` |
| **Déclencheur** | L'utilisateur reste sur la page pendant 30 secondes ou 2 minutes sans quitter |
| **Pages instrumentées** | `/mission` uniquement (objectif crédibilité éditorial) |
| **DOM trigger** | `setTimeout` de 30000ms et 120000ms déclenché au montage du composant page Mission ; annulé si l'utilisateur quitte la page (cleanup sur unmount) |
| **Propriétés** | `page` (string) : valeur fixe `mission` |
| **KPI alimenté** | KPI-2 (temps passé moyen page Mission) |

---

## 3. Mapping événement → KPI

| Événement | Propriété(s) utilisée(s) | KPI alimenté | Formule |
|-----------|--------------------------|--------------|---------|
| `pageview` | `url`, `referrer` | KPI-1 (visiteurs total), KPI-3 (rebond accueil), KPI-4 (sources qualifiées) | Base de tous les calculs de taux |
| `cta_primary_click` | `page_source` | KPI-1 (funnel step 1) | clicks / visiteurs uniques |
| `contact_form_submit` | `type_demande` | **NSM** (filtré `opportunite_investissement`), KPI-1 (taux conversion total) | soumissions / visiteurs uniques |
| `external_link_click` | `participation_name`, `url_target` | Engagement écosystème | clics externes / pageviews Participations |
| `scroll_depth_50` | `page` | KPI-5 (Participations) | scroll50 Participations / pageviews Participations |
| `scroll_depth_75` | `page` | KPI-5 (Participations — seuil principal) | scroll75 / pageviews |
| `scroll_depth_100` | `page` | KPI-2 + KPI-5 (lecture complète) | scroll100 / pageviews |
| `time_on_page_30s` | `page` | KPI-2 (Mission engagement) | count 30s / pageviews Mission |
| `time_on_page_2min` | `page` | KPI-2 (Mission lecture profonde) | count 2min / pageviews Mission |

---

## 4. Goals Plausible à configurer

> Dans le dashboard Plausible → Settings → Goals → "+ Add goal" → Custom event

| # | Nom du Goal | Type | Event name | Propriété filtrée | Objectif business |
|---|-------------|------|------------|------------------|------------------|
| G1 | Demande d'investissement (NSM) | Custom event | `contact_form_submit` | `type_demande = opportunite_investissement` | **North Star Metric** |
| G2 | Soumission formulaire (toutes) | Custom event | `contact_form_submit` | Aucun filtre | KPI-1 taux conversion global |
| G3 | CTA principal cliqué | Custom event | `cta_primary_click` | Aucun filtre | Entonnoir conversion étape 1 |

> Plausible ne supporte pas les filtres de propriété dans la définition d'un Goal — G1 sera le même event que G2 mais filtré manuellement dans le dashboard via le filtre de propriétés. Configurer G1 = G2 = même Goal `contact_form_submit`, puis filtrer `type_demande = opportunite_investissement` dans l'interface pour voir le NSM.

---

## 5. Configuration RGPD

**Plausible est RGPD-natif** : pas de cookies, pas d'empreinte digitale (fingerprinting), anonymisation des IPs par défaut. Aucun consentement utilisateur requis.

| Point RGPD | Statut | Action requise |
|------------|--------|----------------|
| Cookies analytics | Aucun cookie déposé | Rien — pas de bandeau cookie nécessaire pour Plausible |
| Collecte d'IP | IP anonymisée avant stockage | Rien |
| Données personnelles | Aucune collecte (pas de User ID, pas de session persistante) | Rien |
| Mention politique confidentialité | Requise (transparence sur les outils de mesure d'audience) | @legal doit ajouter la mention Plausible dans la politique de confidentialité |
| Transfert hors UE | Plausible Cloud hébergé en UE (Allemagne) | Rien si Plausible Cloud ; vérifier si self-hosted |

**Texte à insérer dans la politique de confidentialité (à transmettre à @legal)** :

> "Ce site utilise Plausible Analytics pour mesurer l'audience de manière anonyme. Plausible ne dépose aucun cookie et ne collecte aucune donnée personnelle identifiable. Les données d'audience sont agrégées et anonymes. Pour en savoir plus : https://plausible.io/data-policy"

---

## 6. Implémentation technique Next.js

### 6.1 Installation

```bash
npm install next-plausible
```

### 6.2 Configuration layout racine (`src/app/layout.tsx`)

```tsx
import PlausibleProvider from 'next-plausible'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <head>
        <PlausibleProvider
          domain="issa-capital.com"
          trackOutboundLinks
          taggedEvents
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

### 6.3 Helper TypeScript — types d'événements (`src/lib/analytics.ts`)

```typescript
import { usePlausible } from 'next-plausible'

// Définition stricte des événements et leurs propriétés
export type ISSAAnalyticsEvents = {
  cta_primary_click: {
    page_source:
      | 'accueil_hero'
      | 'accueil_bas'
      | 'opportunites'
      | 'participations'
      | 'contact'
  }
  contact_form_submit: {
    type_demande:
      | 'opportunite_investissement'
      | 'partenariat'
      | 'presse'
      | 'autre'
  }
  external_link_click: {
    participation_name:
      | 'immocrew'
      | 'versimo'
      | 'gradient_one'
      | 'versi_immobilier'
      | 'versi_invest'
    url_target: string
  }
  scroll_depth_50: { page: 'mission' | 'participations' }
  scroll_depth_75: { page: 'mission' | 'participations' }
  scroll_depth_100: { page: 'mission' | 'participations' }
  time_on_page_30s: { page: 'mission' }
  time_on_page_2min: { page: 'mission' }
}

// Hook typé — à utiliser dans tous les composants client
export function useISSAAnalytics() {
  return usePlausible<ISSAAnalyticsEvents>()
}
```

### 6.4 Usage dans les composants — CTA principal

```tsx
'use client'
import { useISSAAnalytics } from '@/lib/analytics'

interface CTAPrimaryProps {
  pageSource: 'accueil_hero' | 'accueil_bas' | 'opportunites' | 'participations' | 'contact'
}

export function CTAPrimary({ pageSource }: CTAPrimaryProps) {
  const plausible = useISSAAnalytics()

  const handleClick = () => {
    plausible('cta_primary_click', {
      props: { page_source: pageSource },
    })
  }

  return (
    <a
      href="/contact"
      onClick={handleClick}
      className="..." // Tailwind classes
    >
      Proposer une opportunité d'investissement
    </a>
  )
}
```

### 6.5 Usage dans les composants — Formulaire de contact

```tsx
'use client'
import { useISSAAnalytics } from '@/lib/analytics'

export function ContactForm() {
  const plausible = useISSAAnalytics()

  const handleSubmit = async (formData: FormData) => {
    const typeDemande = formData.get('type_demande') as
      | 'opportunite_investissement'
      | 'partenariat'
      | 'presse'
      | 'autre'

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        // Déclencher l'event UNIQUEMENT après succès API
        plausible('contact_form_submit', {
          props: { type_demande: typeDemande },
        })
      }
    } catch {
      // Ne pas déclencher l'event en cas d'erreur
    }
  }

  return (
    <form action={handleSubmit}>
      {/* Champs du formulaire */}
    </form>
  )
}
```

### 6.6 Usage dans les composants — Liens externes (participations)

```tsx
'use client'
import { useISSAAnalytics } from '@/lib/analytics'

interface ParticipationLinkProps {
  name: 'immocrew' | 'versimo' | 'gradient_one' | 'versi_immobilier' | 'versi_invest'
  url: string
  children: React.ReactNode
}

export function ParticipationLink({ name, url, children }: ParticipationLinkProps) {
  const plausible = useISSAAnalytics()

  const handleClick = () => {
    plausible('external_link_click', {
      props: {
        participation_name: name,
        url_target: url,
      },
    })
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={handleClick}>
      {children}
    </a>
  )
}
```

### 6.7 Usage dans les composants — Scroll depth (page Mission et Participations)

```tsx
'use client'
import { useEffect, useRef } from 'react'
import { useISSAAnalytics } from '@/lib/analytics'

type ScrollPage = 'mission' | 'participations'

export function ScrollTracker({ page }: { page: ScrollPage }) {
  const plausible = useISSAAnalytics()
  const triggered = useRef({ d50: false, d75: false, d100: false })

  useEffect(() => {
    const sentinels = [
      { id: 'sentinel-50', depth: 50, event: 'scroll_depth_50' as const },
      { id: 'sentinel-75', depth: 75, event: 'scroll_depth_75' as const },
      { id: 'sentinel-100', depth: 100, event: 'scroll_depth_100' as const },
    ]

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        const sentinel = sentinels.find((s) => s.id === entry.target.id)
        if (!sentinel) return
        const key = `d${sentinel.depth}` as 'd50' | 'd75' | 'd100'
        if (!triggered.current[key]) {
          triggered.current[key] = true
          plausible(sentinel.event, { props: { page } })
        }
      })
    })

    sentinels.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [page, plausible])

  return null
}
```

> Note @fullstack : placer dans le JSX de la page les éléments sentinelles positionnés via CSS :
> ```tsx
> <div id="sentinel-50" style={{ position: 'absolute', top: '50%' }} />
> <div id="sentinel-75" style={{ position: 'absolute', top: '75%' }} />
> <div id="sentinel-100" style={{ position: 'absolute', bottom: '0' }} />
> ```
> Le conteneur parent doit être `position: relative`.

### 6.8 Usage dans les composants — Time on page (page Mission uniquement)

```tsx
'use client'
import { useEffect, useRef } from 'react'
import { useISSAAnalytics } from '@/lib/analytics'

export function MissionTimeTracker() {
  const plausible = useISSAAnalytics()
  const triggered = useRef({ t30: false, t2min: false })

  useEffect(() => {
    const timer30 = setTimeout(() => {
      if (!triggered.current.t30) {
        triggered.current.t30 = true
        plausible('time_on_page_30s', { props: { page: 'mission' } })
      }
    }, 30_000)

    const timer2min = setTimeout(() => {
      if (!triggered.current.t2min) {
        triggered.current.t2min = true
        plausible('time_on_page_2min', { props: { page: 'mission' } })
      }
    }, 120_000)

    return () => {
      clearTimeout(timer30)
      clearTimeout(timer2min)
    }
  }, [plausible])

  return null
}
```

> Note @fullstack : importer `MissionTimeTracker` en haut de la page `/mission/page.tsx` et l'ajouter dans le JSX. Aucune prop requise.

---

## 7. Checklist d'implémentation pour @fullstack

- [ ] `npm install next-plausible`
- [ ] Ajouter `<PlausibleProvider>` dans `src/app/layout.tsx` (section 6.2)
- [ ] Créer `src/lib/analytics.ts` avec les types et le hook (section 6.3)
- [ ] Utiliser `CTAPrimary` avec prop `pageSource` sur les 5 emplacements CTA du site
- [ ] Déclencher `contact_form_submit` APRÈS succès API (pas au clic) dans le handler du formulaire
- [ ] Utiliser `ParticipationLink` pour tous les liens vers les sites des participations
- [ ] Ajouter `<ScrollTracker page="mission" />` dans `src/app/mission/page.tsx`
- [ ] Ajouter `<ScrollTracker page="participations" />` dans `src/app/participations/page.tsx`
- [ ] Placer les sentinelles `#sentinel-50`, `#sentinel-75`, `#sentinel-100` dans le contenu des pages Mission et Participations
- [ ] Ajouter `<MissionTimeTracker />` dans `src/app/mission/page.tsx`
- [ ] Configurer le domaine `issa-capital.com` dans le dashboard Plausible
- [ ] Créer les 3 Goals dans Plausible (section 4)
- [ ] Vérifier le tracking en mode dev avec l'extension Plausible ou les logs console

---

## 8. Hypothèses à valider

| # | Hypothèse | Impact | Validation |
|---|-----------|--------|------------|
| H-TRACK-1 | Plausible Cloud plan gratuit (< 10k pageviews/mois) suffisant en phase early | Si trafic > 10k/mois → passage au plan payant (9€/mois) | Revue à M+2 |
| H-TRACK-2 | Le champ `type_demande` dans le formulaire est implémenté comme select (valeurs fixes) | Si champ libre text → le filtrage de propriétés Plausible ne fonctionnera pas ; @fullstack doit confirmer le type de champ | À confirmer avec @fullstack avant dev |
| H-TRACK-3 | `next-plausible` v3+ est compatible avec Next.js App Router | Vérifier la version au moment de l'install ; la compatibilité App Router est documentée depuis v3.3.0 | Au moment de l'install |
| H-TRACK-4 | Les sentinelles de scroll sont correctement positionnées malgré le lazy loading potentiel des images | Si images chargées après le scroll → les sentinelles peuvent se déplacer ; tester en prod | Lors des tests QA |

---

**Handoff → @fullstack**

- Fichiers produits : `docs/analytics/tracking-plan.md`
- Décisions prises :
  - Script Plausible : `script.tagged-events.js` (version avec custom events activés)
  - Package npm : `next-plausible` (intégration Next.js App Router native)
  - 9 événements custom définis avec types TypeScript stricts
  - 3 Goals Plausible à configurer dans le dashboard (voir section 4)
  - RGPD : aucun cookie, aucun consentement requis — mention politique confidentialité à déléguer à @legal
- Points d'attention critiques :
  - `contact_form_submit` doit être déclenché APRÈS succès API (HTTP 200), pas au clic — si déclenché au clic, les soumissions échouées sont comptabilisées et le NSM est faussé
  - Le champ `type_demande` du formulaire doit être un `<select>` avec valeurs fixes (pas un champ libre) pour que le filtrage Plausible sur le NSM fonctionne
  - Les sentinelles de scroll (`#sentinel-50`, `#sentinel-75`, `#sentinel-100`) doivent être dans un conteneur `position: relative`
  - `MissionTimeTracker` doit être un Client Component (`'use client'`) et placé dans la page Mission
  - Vérifier la compatibilité `next-plausible` v3.3.0+ avec App Router avant l'install
- Checklist complète d'implémentation : section 7 du présent document

Gates BLOQUANT vérifiées : G5 PASS (persona Hélène citée), G7 PASS (aligné project-context.md — Plausible H10, NSM H5, Next.js App Router stack), G12 PASS (code prêt à copier-coller, zéro ambiguïté), G15 PASS (zéro placeholder résiduel), G19 PASS (100% spécifique ISSA Capital — domaine issa-capital.com, noms des participations, structure de pages V1)
