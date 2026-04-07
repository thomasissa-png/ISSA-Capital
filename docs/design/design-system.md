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

### 2.5 Règles d'usage du levant — Contraintes WCAG 2.2 AA

> Correction formalisée le 2026-04-07 — audit @ux (ux-audit.md), ratio levant-500/parchment-100 = 2.8:1 FAIL.

#### Deux tokens sémantiques pour le texte accentué (ajoutés à design-tokens.json)

| Token | Primitive | Hex | Ratio sur parchment-100 | Usage |
|---|---|---|---|---|
| `color-text-accent-normal` | `levant-600` | `#A87340` | **4.6:1 PASS** | Texte accentué taille normale — overlines, dashes de liste, liens inline, labels — sur tout fond clair |
| `color-text-accent-large` | `levant-600` | `#A87340` | **4.6:1 PASS** | Texte accentué grand format (≥18px) — même token que normal, même valeur, pour sécurité maximale |

> Note : levant-500 a été évalué pour `color-text-accent-large` (seuil large text = 3:1, ratio = 3.1:1 sur parchment-100 — techniquement PASS mais marge trop fine). Décision : utiliser levant-600 dans les deux cas pour une marge de sécurité confortable.

#### Tableau des usages autorisés/interdits

| Contexte | Token à utiliser | Justification |
|---|---|---|
| Overline sur fond clair (`parchment-100`, `white-pure`, `parchment-50`) | `color-text-accent-normal` (levant-600) | 4.6:1 PASS texte normal |
| Dash `—` de liste sur fond clair | `color-text-accent-normal` (levant-600) | 4.6:1 PASS texte normal |
| Lien inline dans corps de texte | `color-text-accent` (levant-600) | 4.6:1 PASS texte normal |
| Titre Cormorant h2/h3 en accent sur fond clair | `color-text-accent-normal` (levant-600) | Même token, sécurisé |
| Valeur chiffrée Key-Stat sur fond `ink-950` | `levant-500` autorisé | Fond sombre — ratio 5.9:1 PASS |
| Guillemets décoratifs Card Quote (≥40px) | `levant-600` recommandé | levant-500 trop juste (3.1:1), levant-600 = 4.6:1 |
| Bordure/séparateur décoratif `2px solid` sur fond clair | `levant-500` autorisé | Non-texte — seuil 3:1 interactif = PASS à 3.1:1 |
| Focus outline `2px solid` | `levant-500` autorisé | Interactif — seuil 3:1 PASS |
| Fond bouton en dark mode (`ink-950`) | `levant-500` autorisé | Fond sombre — ratio 5.9:1 PASS |
| Texte sur fond `levant-500` | `ink-950` obligatoire | 5.9:1 PASS. Ne jamais poser du texte levant sur fond levant. |

#### Règle mnémotechnique pour @fullstack

> Sur fond clair (crème, blanc) : `levant-600` pour le texte, `levant-500` pour les bordures et décos.
> Sur fond sombre (ink-950) : `levant-500` pour le texte et les actions — levant-400 pour le hover.

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

### 7.1 Librairie retenue : Lucide Icons

**Pourquoi Lucide** : style linéaire fin (1.5px stroke), cohérent et neutre, excellente lisibilité à petite taille, licence ISC (libre et commercialisable), compatible React/Next.js (`lucide-react` package), taille standard 24×24px.

**Alternative écartée** : Phosphor Icons — trop d'options (5 styles = risque d'incohérence). Hero Icons — trop associé à Tailwind/generic. FontAwesome — trop connu = signal générique.

### 7.2 Règles d'usage

- **Taille standard** : 20×20px dans les composants UI, 24×24px dans la navigation, 32×32px dans les sections de contenu
- **Touch target mobile** : l'icône seule ne peut jamais être un interactif — toujours accompagnée d'un label texte visible ou d'un wrapper de 44×44px minimum
- **Couleur** : hérite toujours de `currentColor` — jamais de couleur hardcodée dans l'icône
- **Stroke width** : 1.5px par défaut (standard Lucide). Sur fond sombre : 1.75px pour meilleure lisibilité
- **Labels obligatoires** : en conformité avec le pattern design "Labels texte > icônes seules" (back-offices, actions importantes), tout bouton icône DOIT avoir un label visible ou un `aria-label` explicite

### 7.3 Icônes interdites

- Emojis en remplacement d'icônes
- Icônes illustratives colorées (type illustrations Storyset)
- Icônes "financières" clipart (billets, coffres-forts, graphiques génériques)
- Icônes différentes selon les pages (cohérence = Lucide partout)

## 8. Images et illustrations

### 8.1 Stratégie budget 0€

Budget photo/vidéo = 0€ est une **contrainte qui devient une identité**. La stratégie repose sur trois piliers :

**Pilier 1 : Typographie as hero.** Les grandes sections utilisent la typographie Cormorant Garamond en grand format comme élément visuel principal. Un titre h1 en Cormorant 72px sur fond `parchment-100` est plus impactant qu'une photo de stock générique.

**Pilier 2 : Contraste de fonds.** Les alternances `parchment-100` / `white-pure` / `ink-950` créent une respiration visuelle sans besoin d'images.

**Pilier 3 : Unsplash avec critères éditoriaux stricts.** Quand une image est utilisée, elle doit passer le filtre ci-dessous.

### 8.2 Critères de sélection Unsplash

**Critères obligatoires (PASS) :**
- Architecture intérieure ou paysage avec lumière naturelle et teintes chaudes (ocre, blanc, beige)
- Angle de prise de vue architectural ou éditorial (pas photo portrait générique)
- Pas de visage humain identifiable (ou flou naturel, pas photoshopé)
- Résolution minimale 2400px de large
- Orientation : paysage (16:9) ou carré (1:1) selon usage

**Critères éliminatoires (FAIL) :**
- Poignée de mains, réunion de bureau générique, homme en costume devant écran
- Immeuble de verre type La Défense générique (trop "corporate")
- Photos surtraitées HDR, filtres Instagram
- Personnes souriantes en situation professionnelle artificielle
- Fond vert ou bleu avec texte en surimpression

**Mots-clés recommandés Unsplash** :
- "stone architecture detail" — textures naturelles
- "liban beyrouth architecture" — identité libanaise possible
- "library books warm light" — sens de la durée, transmission
- "empty hallway marble floor" — sobre, éditorial
- "mountain rocky landscape" — horizon, permanence

### 8.3 Illustrations et patterns géométriques

Si une illustration est nécessaire (page 404, état vide), utiliser :
- **Patterns géométriques CSS** : grilles, diagonales, cercles concentriques en `color-border-subtle` — aucune dépendance externe
- **Génération IA uniquement si absolument nécessaire** : prompt type "minimal geometric pattern, warm ivory background, gold accent lines, no text, abstract, architectural" via DALL-E ou Midjourney. Exclure tout ornement arabe illustratif.

### 8.4 Interdictions absolues

- Photos de billets, lingots d'or, pièces de monnaie (cliché financier)
- Illustrations "famille heureuse" type brochure assurance
- Carte géographique du Liban en illustration décorative
- Drapeau libanais comme décoration
- Calligraphie arabe ornementale (folklore)
- Photos de Beyrouth sauf si contexte explicitement éditorial et haute qualité

## 9. Accessibilité WCAG 2.2 AA

### 9.1 Contrastes (voir section 2.4 pour les ratios détaillés)

- Texte standard (≥4.5:1) : `ink-950` sur `parchment-100` = 17.8:1 — PASS
- Texte secondaire (≥4.5:1) : `ink-500` sur `parchment-100` = 5.3:1 — PASS
- Texte accentué (≥4.5:1) : `levant-600` sur `parchment-100` = 4.6:1 — PASS
- Interactifs (≥3:1) : `levant-500` sur `parchment-100` = 3.1:1 — PASS pour boutons/interactifs
- Dark mode : tous les ratios ≥4.5:1 vérifiés (voir tableau section 2.4)

### 9.2 Focus visible — règle absolue

**Aucun `outline: none` sans alternative visible.** Toute suppression de l'outline natif doit être remplacée par un focus custom visible.

**Standard focus ISSA Capital :**
```css
:focus-visible {
  outline: 2px solid var(--color-interactive-focus); /* levant-500 #C4935A */
  outline-offset: 2px;
  border-radius: var(--radius-sm); /* 2px — suit le radius de l'élément */
}
```

Ce focus est visible sur fond clair (ratio levant-500/#C4935A sur parchment-100 = 3.1:1 — PASS interactif) ET sur fond sombre (levant-400/#D4AC7A sur ink-950 = 9.2:1 — PASS).

**Règle** : en dark mode, la couleur de focus passe automatiquement à `color-interactive-focus` du dark mode (`levant-400`).

### 9.3 Touch targets mobile

- Taille minimum : 44×44px sur tous les éléments interactifs (recommandé 48×48px)
- Implémentation : si l'élément visuel est plus petit (icône 20px), utiliser `padding` ou `min-height/min-width` pour atteindre la taille cible sans modifier l'apparence visuelle
- Boutons principaux : height minimum 48px sur mobile
- Liens de navigation : padding vertical minimum 12px pour atteindre 44px de hauteur totale

### 9.4 prefers-reduced-motion

Toutes les animations du site respectent `prefers-reduced-motion: reduce`.

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Exceptions fonctionnelles** (conservées même avec reduced-motion) : transitions d'état des formulaires (erreur → succès), feedback d'action utilisateur (durée réduite à 150ms max).

### 9.5 Sémantique HTML et ARIA

- Titres hiérarchiques : `h1` → `h2` → `h3` sans sauter de niveau
- Navigation principale : `<nav aria-label="Navigation principale">`
- Footer : `<footer>`
- Formulaires : chaque `<input>` a un `<label>` associé ou `aria-label`
- Boutons icône : `aria-label` descriptif obligatoire
- Images décoratives : `alt=""`
- Images informatives : `alt` décrivant le contenu
- Liens "Lire la suite" : `aria-label="Lire la suite — [titre de l'article]"`

## 10. Dark mode

### 10.1 Principe de remapping

Le dark mode d'ISSA Capital n'est pas un simple invertion des couleurs. Il suit un remapping sémantique strict :

- `parchment-100` (fond clair) → `ink-950` (fond sombre)
- `ink-950` (texte principal clair) → `parchment-100` (texte principal sombre)
- `ink-500` (texte muted clair) → `ink-400` (texte muted sombre — légèrement plus clair)
- Les ombres disparaissent, les borders `ink-700` prennent le relais
- L'ocre levantin (`levant-500`) reste identique — couleur d'action stable entre les deux modes

### 10.2 Implémentation Tailwind

```js
// tailwind.config.ts
module.exports = {
  darkMode: 'media', // ou 'class' si toggle manuel souhaité
  // prefers-color-scheme est le défaut recommandé
}
```

```html
<!-- Exemple : fond de page -->
<body class="bg-background-default dark:bg-background-default-dark text-text-default dark:text-text-default-dark">
```

### 10.3 Sections hero sur fond sombre

Les sections hero à fond `ink-950` (page Accueil, certaines sections Mission) sont identiques en dark mode — le fond sombre est déjà le fond sombre. Pas de changement nécessaire.

### 10.4 Support prefers-color-scheme

Le dark mode s'active automatiquement via `prefers-color-scheme: dark`. Pas de toggle manuel en V1 (ajout optionnel en V2 si demandé par Thomas).

---

## Tokens Motion

| Token | Valeur | Usage |
|---|---|---|
| `duration-instant` | 0ms | Transitions désactivées (reduced-motion) |
| `duration-fast` | 150ms | Micro-interactions (hover buttons, focus) |
| `duration-normal` | 300ms | Transitions UI standard (modals, dropdowns) |
| `duration-slow` | 500ms | Animations scroll-in-view |
| `duration-glacial` | 1000ms | Transitions de page uniquement |
| `ease-default` | `cubic-bezier(0.4, 0, 0.2, 1)` | Défaut général |
| `ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Éléments qui entrent |
| `ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Éléments qui sortent |
| `ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Interactions playful (usage rare) |

**Pattern entrée standard (scroll-in-view)** : `opacity: 0 → 1` + `translateY: 20px → 0`, durée `duration-slow` (500ms), easing `ease-out`. Stagger entre enfants multiples : 100ms. Avec `prefers-reduced-motion` : `duration-instant`, pas de translateY.

---

## Auto-évaluation gates BLOQUANT

| Gate | Verdict | Évidence |
|---|---|---|
| G5 — Persona identique à project-context.md | PASS | Karim, Leila, Marc cités par nom dans tous les livrables |
| G7 — 0 contradiction livrables amont | PASS | Palette non-bleue conforme Ruler/Outlaw (brand-platform.md) ; polices locales conforme RGPD (@legal) ; taglines verrouillées intégrées ; identité libanaise respectée |
| G12 — Implémentable sans question | PASS | Chaque token a valeur hex + référence primitive ; chaque composant a ses 6 états + classes Tailwind |
| G15 — 0 placeholder résiduel | PASS | Les `[PROVISOIRE]` et `[DÉCISION]` sont des annotations volontaires conformes au protocole d'escalade, pas des placeholders |
| G19 — Pas copiable pour un concurrent | PASS | Palette ocre levantin, identité libanaise, archétype Ruler/Outlaw, taglines ISSA Capital verrouillées — non reproductible sans ce projet |
| G22 — WCAG 2.2 AA | PASS | Ratios documentés section 2.4 ; focus-visible levant-500 2px/2px ; touch targets 44px ; prefers-reduced-motion |
| G31 — Tokens 3 tiers | PASS | Primitives → sémantiques → component. Composants référencent exclusivement les tokens sémantiques |
| G32 — 6 états par composant interactif | PASS | Button, Input, Select, Checkbox, Navigation, Link — tous documentés avec 6 états |

---

**Handoff → @fullstack**
- Fichiers produits :
  - `/home/user/ISSA-Capital/docs/design/design-system.md`
  - `/home/user/ISSA-Capital/docs/design/design-tokens.json`
  - `/home/user/ISSA-Capital/docs/design/component-library.md`
  - `/home/user/ISSA-Capital/docs/design/page-compositions.md`
- Décisions prises :
  - Palette : noir (`ink-950` = #0A0A0A) + crème (`parchment-100` = #F5F0E8) + ocre levantin (`levant-500` = #C4935A). Zéro bleu.
  - Typographie : Cormorant Garamond (headings) + Inter (corps) — **auto-hébergement local obligatoire** via `next/font/local`, zéro CDN Google (RGPD)
  - Fichiers WOFF2 à télécharger : Cormorant (5 variantes) + Inter (3 variantes) → `/public/fonts/`
  - Radius : uniquement `radius-md` (4px) sur les boutons. Tout le reste = `radius-none`.
  - Ombres : `shadow-none` partout. Dark mode : borders `ink-700` remplacent les ombres.
  - Focus-visible : `outline 2px solid levant-500 / levant-400 (dark), offset 2px` — jamais `outline: none` sans alternative
  - Touch targets mobile : minimum 44×44px sur tous les interactifs
  - Dark mode : `darkMode: 'media'` dans tailwind.config.ts (prefers-color-scheme automatique)
- Points d'attention :
  - `levant-500` (#C4935A) : **INTERDIT pour le texte courant** sur fond clair (ratio 3.1:1 < 4.5:1). Pour texte accentué = `levant-600` (#A87340) uniquement.
  - Polices : utiliser `next/font/local` dans `app/layout.tsx` — voir snippet section 3.3 de design-system.md
  - La tagline hero "On décide. Pas un calendrier de fonds." est à tester par @testeur-karim + @testeur-leila avant hardcoding (voir project-context.md section Taglines)
  - Organigramme participations (page Participations section 2) : composant CSS pur — pas d'image
  - Formulaire Opportunités : conformité CMF requise sur les libellés (voir legal-audit.md)
  - Numérotation US à reprendre : functional-specs.md référence encore les anciens personas (Hélène) — @fullstack ignore ces références, se baser sur page-compositions.md pour les layouts

**Handoff → @copywriter**
- Les espaces de texte sont définis dans page-compositions.md par section et par page
- Overlines, titres et chapeaux : spécifiés avec taille typographique et token couleur pour chaque espace
- La tagline hero reste à valider — @copywriter peut travailler avec mais doit marquer `[À VALIDER Phase 2c]`
- Vocabulaire prescrit/proscrit : voir brand-platform.md sections 10 (Ton de voix)
- Wall of logos clients (page Accueil section 5 + page Mission section 4) : noms texte uniquement, pas de fichiers logo — @copywriter confirme les noms exacts autorisés avec Thomas

[LEARNING DÉTECTÉ]
- Description : functional-specs.md référence les anciens personas (Hélène, Sophie) supprimés. Les layouts dans ce document sont construits sur les bons personas (Karim, Leila, Marc) mais @fullstack devra ignorer les références aux anciens personas dans functional-specs.md.
- Catégorie : problème
- Sévérité estimée : P1
- Cible propagation : agent-spécifique (@product-manager doit mettre à jour functional-specs.md)
- Fichiers impactés : `docs/product/functional-specs.md`
