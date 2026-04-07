# Component Library — ISSA Capital

> @design — 2026-04-07
> Calibré sur : design-system.md + design-tokens.json + personas.md (Karim, Leila, Marc)
> Lu obligatoirement par @fullstack avant implémentation React/Next.js

---

## Résumé exécutif

- **Objectif** : documenter tous les composants interactifs avec leurs 6 états (default, hover, active, focus-visible, disabled, loading) et leurs variants
- **Stack** : Next.js App Router + Tailwind CSS + tokens design-tokens.json + Lucide Icons
- **Principe** : les composants référencent exclusivement les tokens sémantiques ou component — jamais les primitives directement (G31)

---

## 1. Button

### Variants

| Variant | Usage ISSA Capital |
|---|---|
| `primary` | CTA principal "Proposer une opportunité" — noir profond, texte crème |
| `secondary` | CTAs secondaires, navigation — blanc avec bordure ink |
| `ghost` | Actions dans navigation, liens d'interface |
| `destructive` | Suppression, annulation (formulaires) |

### Sizes

| Size | Min-height | Padding-x | Font-size | Usage |
|---|---|---|---|---|
| `sm` | 36px | spacing-lg (24px) | text-sm (14px) | Actions secondaires compactes |
| `md` | 44px | spacing-xl (32px) | text-base (16px) | Défaut |
| `lg` | 52px | spacing-2xl (48px) | text-lead (20px) | CTA hero, actions primaires majeures |

**Touch target mobile** : minimum 44×44px sur tous les variants — appliqué via padding vertical, jamais via modification de l'élément visuel.

### 6 états — Button Primary

| État | Apparence | Token CSS |
|---|---|---|
| **default** | Fond `ink-950`, texte `parchment-100`, aucune bordure | `bg-interactive-primary`, `text-interactive-primary-text` |
| **hover** | Fond `ink-800` (légèrement plus clair), curseur pointer | Transition `duration-fast` `ease-default` |
| **active/pressed** | Fond `ink-700`, scale légère `scale-[0.98]` | Transition `duration-instant` |
| **focus-visible** | Outline `2px solid levant-500`, offset `2px` | `ring-2 ring-levant-500 ring-offset-2` |
| **disabled** | Fond `ink-300`, texte `ink-100`, curseur `not-allowed`, `opacity-60` | `disabled:opacity-60 disabled:cursor-not-allowed` |
| **loading** | Fond `ink-950`, spinner Lucide `Loader2` animé à gauche, texte masqué en `sr-only` | `animate-spin` + `aria-busy="true"` |

### 6 états — Button Secondary

| État | Apparence |
|---|---|
| **default** | Fond `white-pure`, texte `ink-950`, bordure `1px solid ink-500` |
| **hover** | Fond `parchment-50`, bordure `ink-950` |
| **active/pressed** | Fond `parchment-200`, scale `scale-[0.98]` |
| **focus-visible** | Outline `2px solid levant-500`, offset `2px` |
| **disabled** | Fond `parchment-50`, texte `ink-300`, bordure `ink-100`, curseur `not-allowed` |
| **loading** | Spinner `Loader2` `ink-500`, texte `sr-only` |

### 6 états — Button Ghost

| État | Apparence |
|---|---|
| **default** | Fond `transparent`, texte `ink-700` |
| **hover** | Fond `parchment-200` (légère teinte crème) |
| **active/pressed** | Fond `parchment-100` plus marquée |
| **focus-visible** | Outline `2px solid levant-500`, offset `2px` |
| **disabled** | Texte `ink-300`, curseur `not-allowed` |
| **loading** | Spinner discret `ink-400` |

### Props

| Prop | Type | Défaut | Description |
|---|---|---|---|
| `variant` | `'primary' \| 'secondary' \| 'ghost' \| 'destructive'` | `'primary'` | Variant visuel |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Taille |
| `loading` | `boolean` | `false` | Affiche spinner, désactive l'interaction |
| `disabled` | `boolean` | `false` | État désactivé |
| `leftIcon` | `LucideIcon` | `undefined` | Icône à gauche du texte |
| `rightIcon` | `LucideIcon` | `undefined` | Icône à droite du texte |
| `className` | `string` | `undefined` | Classes Tailwind additionnelles |
| `asChild` | `boolean` | `false` | Render as child (Radix UI pattern) |

### Do / Don't

**Do** : `<Button variant="primary" size="lg">Proposer une opportunité</Button>` — texte explicite, action claire, variant approprié au CTA principal.

**Don't** : `<Button variant="primary" size="sm">OK</Button>` — texte "OK" ne dit rien à Karim sur ce qui va se passer. Toujours utiliser un verbe d'action explicite.

### Accessibilité

- `type="button"` par défaut (évite la soumission de formulaire accidentelle)
- `aria-busy="true"` quand `loading=true`
- `aria-disabled="true"` quand `disabled=true` (préférable à `disabled` HTML seul pour garder le focus tabulation)
- Spinner : `aria-hidden="true"` sur l'icône + texte masqué `sr-only` "Chargement en cours"

## 2. Input (text, textarea, select, checkbox)

### Input Text

**6 états :**

| État | Apparence |
|---|---|
| **default** | Fond `white-pure`, texte `ink-950`, bordure `1px solid ink-200`, radius `2px`, height `48px` |
| **hover** | Bordure `ink-400` |
| **active/focused** | Bordure `1px solid ink-950` + outline `2px solid levant-500` offset `2px` |
| **focus-visible** | Outline `2px solid levant-500`, offset `2px` — identique à active |
| **disabled** | Fond `parchment-50`, texte `ink-300`, bordure `ink-100`, curseur `not-allowed` |
| **error** | Bordure `2px solid reserve-500` + message d'erreur `reserve-500` sous le champ + icône `AlertCircle` Lucide |

**Props :**

| Prop | Type | Description |
|---|---|---|
| `label` | `string` | Label visible au-dessus du champ (obligatoire) |
| `placeholder` | `string` | Texte placeholder `ink-500` |
| `error` | `string` | Message d'erreur — si présent, déclenche l'état error |
| `hint` | `string` | Texte d'aide sous le champ `ink-400` |
| `required` | `boolean` | Ajoute `*` rouge au label + `aria-required` |
| `disabled` | `boolean` | État désactivé |

**Accessibilité** : `<label>` toujours associé via `htmlFor` + `id`. Pas de placeholder seul sans label. Message d'erreur lié via `aria-describedby`.

### Textarea

Identique à Input Text avec :
- `min-height: 120px` (environ 4 lignes)
- `resize: vertical` autorisé
- `max-height: 320px` pour éviter une textarea qui dépasse la fenêtre

**6 états** : identiques à Input Text.

### Select

**6 états :**

| État | Apparence |
|---|---|
| **default** | Fond `white-pure`, texte `ink-950`, bordure `1px solid ink-200`, icône `ChevronDown` Lucide à droite |
| **hover** | Bordure `ink-400` |
| **open/active** | Dropdown ouvert, bordure `ink-950`, icône `ChevronUp` |
| **focus-visible** | Outline `2px solid levant-500`, offset `2px` |
| **disabled** | Fond `parchment-50`, texte `ink-300`, curseur `not-allowed` |
| **loading** | Icône `Loader2` spinner à droite, options en chargement |

**Options dropdown** : fond `white-pure`, texte `ink-950`, selected `parchment-100`, hover `parchment-50`, `z-index: 50`.

### Checkbox

**6 états :**

| État | Apparence |
|---|---|
| **default unchecked** | Carré `16×16px`, bordure `1px solid ink-400`, fond `white-pure`, radius `2px` |
| **default checked** | Fond `ink-950`, icône `Check` Lucide `parchment-100`, bordure `ink-950` |
| **hover unchecked** | Bordure `ink-700` |
| **hover checked** | Fond `ink-800` |
| **focus-visible** | Outline `2px solid levant-500`, offset `2px` autour du carré |
| **disabled** | Fond `parchment-50`, bordure `ink-200`, texte label `ink-300` |

**Touch target mobile** : wrapper `44×44px` autour du carré `16×16px` — l'utilisateur peut cliquer n'importe où dans la zone.

**Accessibilité** : `role="checkbox"`, `aria-checked`, clavier Space pour toggle, label cliquable via `htmlFor`.

## 3. Form

### Variants

| Variant | Usage |
|---|---|
| `contact` | Page Contact — 3 champs (nom, email, message) + consentement RGPD |
| `opportunite` | Page Opportunités — 7 champs qualifiants + consentement RGPD |

### Layout

- Fond `white-pure`, bordure `1px solid ink-200`, padding `spacing-2xl`, radius `0px`
- Gap entre champs : `spacing-lg` (24px)
- Groupes de champs sur la même ligne (desktop) : grille 2 colonnes avec gap `spacing-md`
- Sur mobile : tous les champs en colonne unique

### Mention RGPD intégrée (obligatoire)

Positionnée juste au-dessus du bouton de soumission :

```
"En soumettant ce formulaire, vous consentez à ce qu'ISSA Capital traite vos données
personnelles dans le but de traiter votre demande. Conformément au RGPD, vous disposez
d'un droit d'accès, de rectification et de suppression de vos données. Pour exercer ces
droits : contact@issa-capital.com"
```

Style : `text-xs` Inter, `ink-500`, checkbox de consentement `required`.

### 5 états globaux du formulaire (G21)

| État | Apparence |
|---|---|
| **default** | Formulaire vide, tous les champs en état default |
| **in-progress** | Champs partiellement remplis, validation en temps réel désactivée (on valide à la soumission) |
| **error** | Champs en erreur en rouge + message global "Veuillez corriger les erreurs ci-dessous" en haut du formulaire |
| **loading** | Bouton submit en état loading, formulaire `pointer-events: none`, overlay léger `opacity-50` |
| **success** | Formulaire masqué, message de confirmation visible : "Votre demande a bien été reçue. Nous vous répondrons dans les meilleurs délais." — fond `parchment-50`, icône `CheckCircle` Lucide `levant-600` |

### Validation

- Validation à la soumission uniquement (pas de validation en temps réel — moins agressif pour Karim et Leila)
- Exception : vérification format email en blur (après que l'utilisateur a quitté le champ)
- Messages d'erreur : sous chaque champ en erreur, `text-xs reserve-500`

### Accessibilité

- `<form>` avec `noValidate` (gestion JS de la validation)
- Champs obligatoires : `aria-required="true"` + `*` visible dans le label
- Erreurs : `role="alert"` sur le message global + `aria-describedby` sur chaque champ en erreur
- Focus management : en cas d'erreur à la soumission, focus déplacé sur le premier champ en erreur

## 4. Card (participation, key-stat, quote)

### Card Participation

**Usage** : présentation de chaque participation de l'écosystème ISSA (Gradient One, Versi Immobilier, etc.)

**Layout** :
- Fond `white-pure`, bordure `1px solid ink-200`, radius `0px`, padding `spacing-xl` (32px)
- Overline `text-overline` Inter SemiBold uppercase `ink-500` (secteur d'activité)
- Nom de la participation : `text-h4` Cormorant SemiBold `ink-950`
- Description courte : `text-sm` Inter `ink-700`, 2-3 lignes maximum
- Statut badge (si applicable : "En activité", "En cours") : composant Badge
- Lien sortant (si site disponible) : composant Link external-link

**6 états :**

| État | Apparence |
|---|---|
| **default** | Fond `white-pure`, bordure `ink-200`, shadow `none` |
| **hover** | Bordure `ink-500`, fond `parchment-50` — transition `duration-fast` |
| **active/pressed** | Bordure `ink-950`, fond `parchment-100` |
| **focus-visible** | Outline `2px solid levant-500`, offset `2px` (si card est un lien) |
| **disabled** | Opacité `0.5` — non applicable en V1 (toutes les participations sont actives) |
| **loading** | Skeleton : fond `ink-100` animé `animate-pulse`, hauteurs fixes simulant le contenu |

### Card Key-Stat

**Usage** : statistiques clés (sur page Mission — "15 lots en IDF", données de l'écosystème si applicable)

**Layout** :
- Fond `ink-950` (section sombre), padding `spacing-2xl`
- Valeur principale : `text-display` Cormorant `levant-500` — grand, tranchant
- Label : `text-overline` Inter `ink-300` en majuscules
- Optionnel : icône Lucide `24px` `levant-500` au-dessus de la valeur

**6 états :**

| État | Apparence |
|---|---|
| **default** | Fond `ink-950`, valeur `levant-500`, label `ink-300` |
| **hover** | Valeur `levant-400` (légèrement plus clair) si la carte est interactive |
| **active** | Valeur `levant-300` |
| **focus-visible** | Outline `2px solid levant-500`, offset `2px` |
| **disabled** | Opacité `0.5` |
| **loading** | Skeleton fond `ink-800` animé `animate-pulse` |

### Card Quote (témoignage / citation éditoriale)

**Usage** : citations de la famille, déclarations de Thomas, pull-quotes éditoriaux

**Layout** :
- Fond `parchment-50`, bordure gauche `3px solid levant-500`, padding `spacing-xl`
- Texte citation : `text-lead` Cormorant Garamond italic `ink-950`
- Guillemets ouvrant/fermant : `levant-500`, taille `text-h2`
- Attribution (si présente) : `text-label` Inter Medium `ink-500`, précédé de `—`

**6 états :**

| État | Apparence |
|---|---|
| **default** | Fond `parchment-50`, bordure gauche `levant-500` |
| **hover** | Non interactif — pas d'état hover |
| **active** | Non interactif |
| **focus-visible** | Si lien imbriqué : outline standard |
| **disabled** | Non applicable |
| **loading** | Skeleton 3 lignes `ink-100` animé |

## 5. Navigation (header, footer, breadcrumb)

### Header (Navigation principale)

**Layout desktop** :
- `position: sticky top-0`, `z-index: 50`, height `72px`
- Fond : `parchment-100` par défaut → `rgba(245,240,232,0.95) backdrop-blur(8px)` au scroll
- Bordure bottom `1px solid ink-100` (apparaît au scroll)
- Logo ISSA Capital : `text-h4` Cormorant SemiBold `ink-950` — texte pur, pas d'image logo
- Liens navigation : `text-label` Inter Medium `ink-600`, hover `ink-950`, active `ink-950` + underline `2px levant-500`
- CTA sticky "Proposer une opportunité" : Button secondary size `sm`

**Layout mobile** :
- Height `64px`
- Logo à gauche, icône hamburger `Menu` Lucide à droite (44×44px touch target)
- Menu déroulant : bottom sheet sur mobile (full-width, fond `parchment-100`, liens en liste verticale, padding `spacing-md`)

**6 états du lien navigation :**

| État | Apparence |
|---|---|
| **default** | `text-label` Inter `ink-600` |
| **hover** | `ink-950`, underline `levant-500` apparaît |
| **active (page courante)** | `ink-950`, underline `levant-500` permanent |
| **focus-visible** | Outline `2px solid levant-500`, offset `2px` |
| **disabled** | `ink-300`, curseur `default` |
| **loading** | Spinner discret si navigation en cours (Next.js router) |

**Accessibilité** :
- `<nav aria-label="Navigation principale">`
- Lien actif : `aria-current="page"`
- Menu hamburger mobile : `aria-expanded`, `aria-controls`, `aria-label="Ouvrir le menu"`

### Footer

**Layout** :
- Fond `ink-950`, texte `parchment-100`
- Padding vertical `spacing-3xl` (64px)
- 3 colonnes desktop (logo+tagline / liens / légal) → empilé mobile
- Tagline baseline : `text-body-sm` Inter `ink-300` sous le nom ISSA Capital
- Liens : `text-label` `ink-300`, hover `parchment-100`, underline au hover
- Séparateur : `1px solid ink-800`
- Mentions légales : copyright + liens Mentions légales / Politique de confidentialité

**6 états des liens footer :**

| État | Apparence |
|---|---|
| **default** | `text-label` `ink-300` |
| **hover** | `parchment-100`, underline apparaît |
| **active** | `parchment-100`, underline |
| **focus-visible** | Outline `2px solid levant-400` (version dark mode du focus), offset `2px` |
| **disabled** | `ink-600` |
| **loading** | N/A |

### Breadcrumb

**Usage** : navigation secondaire sur pages profondes (Mentions légales, Politique de confidentialité)

**Layout** :
- `text-caption` Inter `ink-500`
- Séparateur : `/` `ink-300`
- Dernier élément (page courante) : `ink-950`, non cliquable

**6 états des liens breadcrumb :**

| État | Apparence |
|---|---|
| **default** | `ink-500`, underline `ink-200` |
| **hover** | `ink-950`, underline `levant-500` |
| **active (lien courant)** | Non applicable (dernier élément non-lien) |
| **focus-visible** | Outline `2px solid levant-500`, offset `2px` |
| **disabled** | N/A |
| **loading** | N/A |

**Accessibilité** :
- `<nav aria-label="Fil d'Ariane">`
- `<ol>` avec items `<li>`
- Dernier item : `aria-current="page"`

## 6. Hero

## 7. Section-header

## 8. Quote / Pullquote

## 9. Banner

## 10. Link (text-link, icon-link, external-link)
