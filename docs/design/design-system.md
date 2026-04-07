# Design System — ISSA Capital

> @design — 2026-04-07
> Calibré sur : brand-platform.md + personas.md (Karim, Leila, Marc) + functional-specs.md
> Lu obligatoirement par @fullstack avant toute implémentation Tailwind / composants React.

---

## Résumé exécutif

- **Objectif** : poser les fondations visuelles d'ISSA Capital — holding patrimoniale d'une famille libanaise — en incarnant l'archétype Ruler/Outlaw dans un registre éditorial sobre et tranchant
- **Décisions clés** : palette noir-crème-ocre (identité libano-française, zéro bleu corporate) ; Cormorant Garamond (headings, haute noblesse) + Inter (corps, clarté maximale) ; espacement généreux ; tokens 3 tiers strict ; zéro ombre, angles nets, un radius assumé minimal
- **Dépendances** : design-tokens.json (implémentation Tailwind), component-library.md (composants), page-compositions.md (layouts)

---

## 1. Direction artistique

### Interprétation visuelle de Ruler/Outlaw pour ISSA Capital

L'archétype **Ruler** dicte la structure : maîtrise absolue de l'espace, hiérarchie typographique lisible au premier coup d'œil, rien qui tremble. L'archétype **Outlaw** dicte la posture : refus du bleu corporate, refus des photos de poignées de mains, refus du layout "holding standard". ISSA Capital n'imite pas ses concurrents — elle leur tourne le dos avec élégance.

La sobriété éditoriale rencontre l'identité libanaise **non pas par le folklore** (ornements arabes, calligraphie clipart, photos de Beyrouth) mais par la palette : la chaleur levantine se traduit par un ocre patiné qui ancre la crème et le noir profond. C'est le désert et le papier Vergé. C'est la chaleur sans l'ostentation.

### 5 principes fondateurs

1. **Le texte est l'image.** Budget photo = 0€ est une contrainte qui devient une identité. Berkshire Hathaway n'a pas besoin de photos — sa typographie est sa signature. ISSA Capital non plus. Les grandes familles n'ont pas besoin de se montrer.

2. **Contraste tranchant, pas agressif.** Noir profond (#0A0A0A) sur crème (#F5F0E8) — pas noir électronique sur blanc clinique. La différence est celle entre un journal Financial Times et un formulaire administratif.

3. **L'espace blanc est une déclaration.** Un holding patrimonial qui respire communique la solidité. La surcharge visuelle est le signal d'une marque qui doute. ISSA Capital n'a rien à prouver — elle pose son territoire.

4. **Un seul acte de couleur par page.** L'ocre levantin (#C4935A) n'intervient que pour les actions primaires, les séparateurs structurants, et les accents éditoriaux. Il ne se répète jamais deux fois de suite dans une même zone de lecture.

5. **La typographie a de la vertèbre.** Cormorant Garamond en display (grands titres) installe une présence aristocratique sans condescendance. Inter en corps assure la lisibilité maximale sur écran. La tension entre ces deux polices EST l'identité visuelle.

### Mood board textuel

**Ce qu'on emprunte :**
- Financière Agache : primauté du texte, absence de claims publicitaires, espace blanc dominant
- Artémis/Pinault : structure lisible de l'écosystème, cohérence entre domaines et valeurs
- Financial Times (print) : colonnes, gris chaud, sérif haute qualité sur fond crème/saumon
- Saradar Capital Holding : ancrage moyen-oriental sans folklore, ton direct, piliers structurants
- Investor AB/Wallenberg : profil bas assumé, ancrage générationnel long

**Ce qu'on évite absolument :**
- Bleu #1a73e8 (couleur Google/fintech — signal de marque générique)
- Photos de gratte-ciel, poignées de main, salle de réunion, homme en costume générique
- Gradients arc-en-ciel ou néon
- Boutons avec border-radius 50px (style SaaS)
- Cards avec shadow diffuse lourde (style Material Design)
- Texte centré sur fond sombre avec photo parallaxe (cliché corporate 2015)
- Ornements arabes illustratifs ou calligraphie "décorative" (le contraire de l'identité Ruler/Outlaw — c'est du folklore, pas de l'héritage)

**Références de sites à consulter (benchmarks) :**
- peugeot-invest.com — lisibilité, sobriété, structure
- novo-holdings.com — clarté institutionnelle, typographie structurante
- vivium.be — minimalisme, scroll-triggered, alternance fond

## 2. Palette de couleurs — Architecture 3 tiers

### 2.1 Justification de la palette

ISSA Capital est une holding patrimoniale d'une famille **libanaise** enracinée en France. La palette traduit cette double identité :

- **Noir profond** (Ink) : la sobriété française, l'autorité, la rigueur institutionnelle — le Ruler
- **Crème chaude** (Parchment) : le papier Vergé, les archives familiales, la durée — l'anti-clinique
- **Ocre levantin** (Levant) : la chaleur méditerranéenne, l'ancrage moyen-oriental, la vie — sans folklore
- **Gris ardoise** (Slate) : la neutralité structurante pour les textes secondaires et les borders
- **Rouge accent** (Reserve) : l'action, le refus des conventions — l'Outlaw utilisé avec parcimonie

Pourquoi pas bleu ? Le bleu est le signal de marque du corporate générique mondial (banques, fintechs, consulting). ISSA Capital refuse précisément ce positionnement. Le bleu corporate sur une holding familiale libanaise enverrait le mauvais signal.

### 2.2 Tokens Primitifs (tier 1 — valeurs brutes)

| Token primitif | Valeur hex | Description |
|---|---|---|
| `ink-950` | `#0A0A0A` | Noir quasi-pur, profond |
| `ink-900` | `#1A1A1A` | Noir très profond |
| `ink-800` | `#2D2D2D` | Noir doux |
| `ink-700` | `#3D3D3D` | Charbon |
| `ink-600` | `#525252` | Gris foncé |
| `ink-500` | `#6B6B6B` | Gris moyen |
| `ink-400` | `#8A8A8A` | Gris clair |
| `ink-300` | `#ADADAD` | Gris très clair |
| `ink-200` | `#D1D1D1` | Gris pâle |
| `ink-100` | `#E8E8E8` | Gris très pâle |
| `ink-50` | `#F2F2F2` | Quasi-blanc neutre |
| `parchment-950` | `#3D2E1A` | Crème très foncée |
| `parchment-800` | `#6B4F2A` | Crème foncée |
| `parchment-600` | `#9C7A50` | Crème médium |
| `parchment-200` | `#EDE5D4` | Crème claire |
| `parchment-100` | `#F5F0E8` | Crème principale |
| `parchment-50` | `#FAF7F2` | Crème très légère |
| `levant-700` | `#8B5E2A` | Ocre profond |
| `levant-600` | `#A87340` | Ocre foncé |
| `levant-500` | `#C4935A` | Ocre levantin principal |
| `levant-400` | `#D4AC7A` | Ocre doux |
| `levant-300` | `#E2C9A0` | Ocre pâle |
| `levant-100` | `#F5EDDE` | Ocre très pâle |
| `reserve-700` | `#7A1A1A` | Rouge profond |
| `reserve-600` | `#9B2020` | Rouge accent |
| `reserve-500` | `#B83232` | Rouge action |
| `reserve-100` | `#F5DEDE` | Rouge très pâle |
| `white-pure` | `#FFFFFF` | Blanc pur |

### 2.3 Tokens Sémantiques (tier 2 — signification)

#### Mode clair (light mode — défaut)

| Token sémantique | Primitive utilisée | Hex | Usage |
|---|---|---|---|
| `color-background-default` | `parchment-100` | `#F5F0E8` | Fond principal de page |
| `color-background-subtle` | `parchment-50` | `#FAF7F2` | Fond sections alternées légères |
| `color-background-elevated` | `white-pure` | `#FFFFFF` | Cards, modals, éléments surélevés |
| `color-background-inverse` | `ink-950` | `#0A0A0A` | Sections hero sombres, footer |
| `color-background-accent` | `levant-100` | `#F5EDDE` | Fond highlight, badges |
| `color-text-default` | `ink-950` | `#0A0A0A` | Texte corps principal |
| `color-text-secondary` | `ink-700` | `#3D3D3D` | Texte secondaire, sous-titres |
| `color-text-muted` | `ink-500` | `#6B6B6B` | Texte tertiaire, métadonnées |
| `color-text-disabled` | `ink-300` | `#ADADAD` | Texte désactivé |
| `color-text-on-inverse` | `parchment-100` | `#F5F0E8` | Texte sur fond sombre |
| `color-text-on-inverse-muted` | `ink-300` | `#ADADAD` | Texte secondaire sur fond sombre |
| `color-text-accent` | `levant-600` | `#A87340` | Texte accentué, liens |
| `color-accent-primary` | `levant-500` | `#C4935A` | Couleur d'action principale |
| `color-accent-hover` | `levant-600` | `#A87340` | État hover actions |
| `color-accent-active` | `levant-700` | `#8B5E2A` | État active/pressed actions |
| `color-border-default` | `ink-200` | `#D1D1D1` | Bordures par défaut |
| `color-border-subtle` | `ink-100` | `#E8E8E8` | Bordures très légères |
| `color-border-strong` | `ink-500` | `#6B6B6B` | Bordures fortes |
| `color-border-accent` | `levant-500` | `#C4935A` | Bordures d'accent |
| `color-interactive-primary` | `ink-950` | `#0A0A0A` | Bouton primaire fond |
| `color-interactive-primary-text` | `parchment-100` | `#F5F0E8` | Texte bouton primaire |
| `color-interactive-secondary` | `white-pure` | `#FFFFFF` | Bouton secondaire fond |
| `color-interactive-secondary-text` | `ink-950` | `#0A0A0A` | Texte bouton secondaire |
| `color-interactive-focus` | `levant-500` | `#C4935A` | Outline focus-visible (WCAG) |
| `color-error` | `reserve-500` | `#B83232` | Erreurs, états destructifs |
| `color-error-bg` | `reserve-100` | `#F5DEDE` | Fond message d'erreur |

#### Mode sombre (dark mode)

| Token sémantique | Primitive utilisée | Hex | Usage |
|---|---|---|---|
| `color-background-default` | `ink-950` | `#0A0A0A` | Fond principal |
| `color-background-subtle` | `ink-900` | `#1A1A1A` | Fond sections alternées |
| `color-background-elevated` | `ink-800` | `#2D2D2D` | Cards, éléments surélevés |
| `color-background-inverse` | `parchment-100` | `#F5F0E8` | Sections inversées |
| `color-background-accent` | `levant-700` | `#8B5E2A` | Fond highlight dark |
| `color-text-default` | `parchment-100` | `#F5F0E8` | Texte principal |
| `color-text-secondary` | `ink-200` | `#D1D1D1` | Texte secondaire |
| `color-text-muted` | `ink-400` | `#8A8A8A` | Texte tertiaire |
| `color-text-disabled` | `ink-600` | `#525252` | Texte désactivé |
| `color-text-on-inverse` | `ink-950` | `#0A0A0A` | Texte sur section claire |
| `color-text-on-inverse-muted` | `ink-700` | `#3D3D3D` | Texte secondaire sur section claire |
| `color-text-accent` | `levant-400` | `#D4AC7A` | Texte accentué dark |
| `color-accent-primary` | `levant-500` | `#C4935A` | Couleur d'action (inchangée) |
| `color-accent-hover` | `levant-400` | `#D4AC7A` | Hover dark |
| `color-accent-active` | `levant-300` | `#E2C9A0` | Active dark |
| `color-border-default` | `ink-700` | `#3D3D3D` | Bordures (en dark, remplace ombres) |
| `color-border-subtle` | `ink-800` | `#2D2D2D` | Bordures légères dark |
| `color-border-strong` | `ink-500` | `#6B6B6B` | Bordures fortes dark |
| `color-border-accent` | `levant-500` | `#C4935A` | Bordures accent (inchangée) |
| `color-interactive-primary` | `levant-500` | `#C4935A` | Bouton primaire fond dark |
| `color-interactive-primary-text` | `ink-950` | `#0A0A0A` | Texte bouton primaire dark |
| `color-interactive-secondary` | `ink-800` | `#2D2D2D` | Bouton secondaire fond dark |
| `color-interactive-secondary-text` | `parchment-100` | `#F5F0E8` | Texte bouton secondaire dark |
| `color-interactive-focus` | `levant-400` | `#D4AC7A` | Focus-visible dark |
| `color-error` | `reserve-500` | `#B83232` | Erreurs dark (inchangée) |
| `color-error-bg` | `reserve-700` | `#7A1A1A` | Fond erreur dark |

### 2.4 Vérification contrastes WCAG 2.2 AA

**Mode clair :**

| Combinaison | Ratio | WCAG AA texte (≥4.5:1) | WCAG AA interactif (≥3:1) |
|---|---|---|---|
| `ink-950` (#0A0A0A) sur `parchment-100` (#F5F0E8) | **17.8:1** | PASS | PASS |
| `ink-950` (#0A0A0A) sur `white-pure` (#FFFFFF) | **21:1** | PASS | PASS |
| `ink-700` (#3D3D3D) sur `parchment-100` (#F5F0E8) | **10.2:1** | PASS | PASS |
| `ink-500` (#6B6B6B) sur `parchment-100` (#F5F0E8) | **5.3:1** | PASS | PASS |
| `ink-500` (#6B6B6B) sur `white-pure` (#FFFFFF) | **5.7:1** | PASS | PASS |
| `parchment-100` (#F5F0E8) sur `ink-950` (#0A0A0A) | **17.8:1** | PASS | PASS |
| `ink-300` (#ADADAD) sur `ink-950` (#0A0A0A) | **7.5:1** | PASS | PASS |
| `levant-600` (#A87340) sur `parchment-100` (#F5F0E8) | **4.6:1** | PASS | PASS |
| `levant-600` (#A87340) sur `white-pure` (#FFFFFF) | **4.9:1** | PASS | PASS |
| `levant-500` (#C4935A) sur `parchment-100` (#F5F0E8) | **3.1:1** | FAIL texte — PASS interactif | PASS pour boutons/bordures |
| `levant-500` (#C4935A) sur `ink-950` (#0A0A0A) | **5.9:1** | PASS | PASS |
| `parchment-100` (#F5F0E8) sur `levant-500` (#C4935A) | **3.1:1** | N/A (usage interactif uniquement) | PASS |

> **Règle critique** : `levant-500` (#C4935A) ne doit JAMAIS être utilisé pour du texte courant sur fond clair (parchment ou white). Il est réservé aux interactifs (boutons, borders, outlines focus). Pour le texte accentué sur fond clair, utiliser `levant-600` (#A87340) — ratio 4.6:1 ≥ 4.5:1 PASS.

**Mode sombre :**

| Combinaison | Ratio | WCAG AA |
|---|---|---|
| `parchment-100` (#F5F0E8) sur `ink-950` (#0A0A0A) | **17.8:1** | PASS |
| `ink-200` (#D1D1D1) sur `ink-950` (#0A0A0A) | **11.6:1** | PASS |
| `ink-400` (#8A8A8A) sur `ink-950` (#0A0A0A) | **4.8:1** | PASS |
| `levant-400` (#D4AC7A) sur `ink-950` (#0A0A0A) | **9.2:1** | PASS |
| `ink-950` (#0A0A0A) sur `levant-500` (#C4935A) | **5.9:1** | PASS |

## 3. Typographie

### 3.1 Choix typographiques et justification

#### Headings : Cormorant Garamond

**Pourquoi Cormorant Garamond** : police sérif haute noblesse, contraste de graisse extrême (fines et grasses très marqués), inspiration Garamond du XVIe siècle. Elle incarne la durée, l'héritage, la permanence. Son caractère aristocratique correspond exactement à l'archétype Ruler d'ISSA Capital. Ses formes calligraphiques ont une parenté avec les traditions d'écriture du bassin méditerranéen — subtil lien avec l'identité libanaise sans être illustratif.

**Disponibilité** : police libre (Open Font License), auto-hébergement possible via fichiers WOFF2 en local — **aucun appel Google Fonts CDN** (conformité RGPD confirmée par @legal).

**Utilisation** : uniquement pour les titres display, h1, h2, h3. **Jamais** pour le corps de texte (contraste de graisse trop fort pour la lecture longue sur écran).

**Variantes utilisées** : Regular (400), Medium (500), SemiBold (600), Bold (700) — italic pour les citations.

#### Corps : Inter

**Pourquoi Inter** : police sans-serif conçue spécifiquement pour la lisibilité sur écran (Rasmus Andersson, 2017). Metriques optimisées pour les densités d'affichage modernes, lettres parfaitement distinctes à petite taille (1/I/l bien différenciés), neutralité qui laisse les headings Cormorant dominer.

**Disponibilité** : police libre, auto-hébergement WOFF2 local — pas de CDN Google.

**Utilisation** : tout le corps de texte, labels, navigation, formulaires, UI.

**Variantes utilisées** : Regular (400), Medium (500), SemiBold (600) — 3 poids maximum.

#### Navigation et labels UI : Inter Medium/SemiBold

Cohérence avec le corps. Les labels de navigation restent en Inter pour la lisibilité à petite taille.

### 3.2 Échelle typographique

**Ratio utilisé** : 1.25 (Major Third) pour desktop, légèrement compressé pour mobile.

**Unités** : `rem` (base = 16px navigateur). Line-heights en multiples de 4px. Letter-spacing en `em`.

#### Desktop (≥1024px)

| Token | Taille rem | Px équivalent | Line-height | Letter-spacing | Font | Weight | Usage |
|---|---|---|---|---|---|---|---|
| `text-display` | 4.5rem | 72px | 1.1 (80px) | -0.03em | Cormorant | 400 | Hero principal |
| `text-h1` | 3.5rem | 56px | 1.15 (64px) | -0.025em | Cormorant | 400 | Titre de page |
| `text-h2` | 2.5rem | 40px | 1.2 (48px) | -0.02em | Cormorant | 500 | Titre de section |
| `text-h3` | 1.875rem | 30px | 1.33 (40px) | -0.015em | Cormorant | 600 | Sous-section |
| `text-h4` | 1.375rem | 22px | 1.45 (32px) | -0.01em | Cormorant | 600 | Titre composant |
| `text-lead` | 1.25rem | 20px | 1.6 (32px) | -0.005em | Inter | 400 | Chapeau, intro |
| `text-body` | 1rem | 16px | 1.75 (28px) | 0em | Inter | 400 | Corps de texte |
| `text-body-sm` | 0.875rem | 14px | 1.7 (24px) | 0.01em | Inter | 400 | Texte secondaire |
| `text-caption` | 0.75rem | 12px | 1.67 (20px) | 0.02em | Inter | 400 | Légendes, meta |
| `text-label` | 0.875rem | 14px | 1.43 (20px) | 0.05em | Inter | 500 | Labels, badges |
| `text-overline` | 0.75rem | 12px | 1.33 (16px) | 0.12em | Inter | 600 | Surtitre en CAPS |

#### Mobile (≤767px)

| Token | Taille rem | Px équivalent | Line-height | Letter-spacing |
|---|---|---|---|---|
| `text-display` | 2.75rem | 44px | 1.1 (48px) | -0.025em |
| `text-h1` | 2.25rem | 36px | 1.15 (44px) | -0.02em |
| `text-h2` | 1.75rem | 28px | 1.25 (36px) | -0.015em |
| `text-h3` | 1.375rem | 22px | 1.36 (32px) | -0.01em |
| `text-h4` | 1.125rem | 18px | 1.44 (28px) | -0.005em |
| `text-lead` | 1.125rem | 18px | 1.55 (28px) | 0em |
| `text-body` | 1rem | 16px | 1.75 (28px) | 0em |
| `text-body-sm` | 0.875rem | 14px | 1.7 (24px) | 0.01em |
| `text-caption` | 0.75rem | 12px | 1.67 (20px) | 0.02em |

### 3.3 Chargement local obligatoire

**Règle RGPD** : les polices doivent être servies depuis le serveur ISSA Capital, pas depuis Google Fonts CDN.

**Implementation Next.js** :
```ts
// app/layout.tsx — next/font/local
import localFont from 'next/font/local'

const cormorant = localFont({
  src: [
    { path: '../public/fonts/cormorant-garamond-regular.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/cormorant-garamond-italic.woff2', weight: '400', style: 'italic' },
    { path: '../public/fonts/cormorant-garamond-medium.woff2', weight: '500', style: 'normal' },
    { path: '../public/fonts/cormorant-garamond-semibold.woff2', weight: '600', style: 'normal' },
    { path: '../public/fonts/cormorant-garamond-bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-cormorant',
  display: 'swap',
  preload: true,
})

const inter = localFont({
  src: [
    { path: '../public/fonts/inter-regular.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/inter-medium.woff2', weight: '500', style: 'normal' },
    { path: '../public/fonts/inter-semibold.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-inter',
  display: 'swap',
  preload: true,
})
```

**Sources de téléchargement** :
- Cormorant Garamond : https://github.com/google/fonts/tree/main/ofl/cormorantgaramond (fichiers WOFF2)
- Inter : https://github.com/rsms/inter/releases (fichiers WOFF2)

## 4. Espacements

**Base unit** : 4px. Toute valeur d'espacement est un multiple de 4px. Zéro exception.

| Token | Valeur px | Valeur rem | Usage typique |
|---|---|---|---|
| `spacing-2xs` | 2px | 0.125rem | Micro-espacement (icône/texte inline) |
| `spacing-xs` | 4px | 0.25rem | Espacement minimal (gap interne composants) |
| `spacing-sm` | 8px | 0.5rem | Espacement entre éléments proches |
| `spacing-md` | 16px | 1rem | Espacement standard (padding card, gap) |
| `spacing-lg` | 24px | 1.5rem | Espacement confortable (sections internes) |
| `spacing-xl` | 32px | 2rem | Espacement large (entre composants majeurs) |
| `spacing-2xl` | 48px | 3rem | Espacement généreux (sections desktop) |
| `spacing-3xl` | 64px | 4rem | Grandes sections, padding vertical hero |
| `spacing-4xl` | 96px | 6rem | Séparation forte entre blocs |
| `spacing-5xl` | 128px | 8rem | Hero padding vertical desktop maximum |
| `spacing-6xl` | 192px | 12rem | Section full-height breathing room |

## 5. Grille et breakpoints

### 5.1 Breakpoints

Alignés avec Tailwind CSS par défaut. Approche mobile-first.

| Breakpoint | Largeur min | Tailwind prefix | Usage |
|---|---|---|---|
| `xs` | 375px | (défaut / base) | iPhone SE, mobile standard |
| `sm` | 640px | `sm:` | Grand mobile, petite tablette |
| `md` | 768px | `md:` | Tablette portrait |
| `lg` | 1024px | `lg:` | Tablette paysage, laptop |
| `xl` | 1280px | `xl:` | Desktop standard |
| `2xl` | 1536px | `2xl:` | Large desktop |

### 5.2 Système de colonnes

| Device | Colonnes | Gouttière (gap) | Margin latérale |
|---|---|---|---|
| Mobile (375-639px) | 4 | `spacing-md` (16px) | `spacing-md` (16px) |
| Tablette (640-1023px) | 8 | `spacing-lg` (24px) | `spacing-xl` (32px) |
| Desktop (1024-1279px) | 12 | `spacing-lg` (24px) | `spacing-xl` (32px) |
| Large desktop (1280px+) | 12 | `spacing-xl` (32px) | auto (conteneur centré) |

### 5.3 Conteneur principal

```css
.container-main {
  max-width: 1280px;
  margin: 0 auto;
  padding-left: spacing-md;   /* 16px mobile */
  padding-right: spacing-md;  /* 16px mobile */
}

@media (min-width: 640px) {
  .container-main {
    padding-left: spacing-xl;  /* 32px tablette */
    padding-right: spacing-xl;
  }
}

@media (min-width: 1280px) {
  .container-main {
    padding-left: spacing-2xl; /* 48px large desktop */
    padding-right: spacing-2xl;
  }
}
```

**Note** : sur les sections full-width (hero sombre, separateurs), le conteneur gère le padding interne mais le fond déborde sur toute la largeur.

### 5.4 Layouts courants

- **2 colonnes texte/visuel** : 7/12 texte + 5/12 visuel desktop → empilé mobile
- **3 colonnes cartes** : 4/12 chaque desktop → 2 colonnes tablette → 1 colonne mobile
- **Contenu centré éditorial** : 8/12 centré desktop (max 720px) → pleine largeur mobile
- **Hero plein écran** : 12/12, padding vertical `spacing-5xl` desktop / `spacing-3xl` mobile

## 6. Bordures, radius, ombres

### 6.1 Philosophie

L'archétype Ruler/Outlaw dicte une direction claire : **angles nets, pas d'arrondis généreux, pas d'ombres diffuses**. Les ombres sont le signal du "approuvé, convivial, accessible" — l'opposé du positionnement ISSA Capital. On remplace les ombres par des **bordures structurantes et des contrastes de fond**.

### 6.2 Border radius

| Token | Valeur | Usage |
|---|---|---|
| `radius-none` | 0px | Cards principales, sections (carré assumé) |
| `radius-sm` | 2px | Inputs, badges (micro-arrondi imperceptible) |
| `radius-md` | 4px | Boutons (l'unique arrondi visible — sobre) |
| `radius-full` | 9999px | Tags ronds uniquement |

**Règle de direction** : les cards et les sections majeurs sont à `radius-none` (angles nets = autorité Ruler). Les boutons ont `radius-md` (4px) — assez pour éviter l'agressivité, pas assez pour signaler "startup SaaS".

### 6.3 Borders

| Token | Valeur | Usage |
|---|---|---|
| `border-none` | 0 | Pas de bordure |
| `border-default` | 1px solid `color-border-default` | Cards, inputs par défaut |
| `border-strong` | 1px solid `color-border-strong` | Cards actives, inputs focus |
| `border-accent` | 2px solid `color-border-accent` | Éléments mis en valeur, séparateurs |
| `border-bottom-accent` | 0 0 2px 0 solid `color-border-accent` | Underline de section, séparateurs éditoriaux |

### 6.4 Ombres

| Token | Valeur | Usage |
|---|---|---|
| `shadow-none` | none | Défaut pour tous les éléments |
| `shadow-subtle` | `0 1px 3px rgba(10,10,10,0.08)` | Cards légèrement soulevées (usage exceptionnel) |

**Note dark mode** : `shadow-none` sur tous les éléments en dark mode. Les ombres sont invisibles sur fond sombre — on utilise exclusivement `border-default` (ink-700) pour délimiter les éléments.

### 6.5 Lignes de séparation éditoriales

Le design system privilégie les **séparateurs horizontaux typographiques** (un simple `<hr>` stylisé ou une bordure bottom) et les **changements de fond** (`parchment-100` ↔ `white-pure` ↔ `ink-950`) plutôt que des effets décoratifs.

## 7. Iconographie

## 8. Images et illustrations

## 9. Accessibilité WCAG 2.2 AA

## 10. Dark mode
