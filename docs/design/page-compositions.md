# Page Compositions — ISSA Capital

> @design — 2026-04-07
> Calibré sur : design-system.md + component-library.md + functional-specs.md + personas.md (Karim, Leila, Marc)
> Source de vérité pour @fullstack (layouts) et @copywriter (espaces de texte définis)

---

## Résumé exécutif

- **Objectif** : spécifier la composition visuelle de chaque page V1 d'ISSA Capital — layout par section, typographie, images, responsive, animations
- **Décisions clés** : fond `parchment-100` comme défaut (pas blanc clinique), alternance claire/sombre pour rythmer la lecture, typographie Cormorant comme élément visuel principal (budget photo 0€), zéro shadow, angles nets
- **Dépendances** : @fullstack implémente ces layouts, @copywriter écrit dans les espaces définis ici

---

## Page 1 — Accueil

**Objectif** : poser l'identité d'ISSA Capital en 5 secondes, orienter Karim vers `/accompagnement` et Leila vers `/opportunites`.

**Densité globale** : aérée — sections bien séparées, espace blanc généreux.

---

### Section 1 — Hero Principal

**Layout** : plein écran, fond `ink-950`, conteneur centré max-width `720px`, texte centré

**Breakpoints** :
- Mobile (375px) : padding vertical `spacing-3xl` (64px), titre `text-h1` mobile (36px)
- Tablette (768px) : padding `spacing-4xl` (96px), titre `text-h1` desktop mais centré
- Desktop (1280px) : padding vertical `spacing-5xl` (128px), titre `text-display` (72px)

**Contenu (de haut en bas)** :
1. Overline : `text-overline` Inter SemiBold uppercase `levant-500` — "Holding patrimoniale — famille libanaise"
2. Tagline hero : `text-display` Cormorant Regular `parchment-100` — "On décide. Pas un calendrier de fonds." ⚠️ [À VALIDER par @testeur-karim + @testeur-leila en Phase 2c]
3. Sous-titre : `text-lead` Inter Regular `ink-300`, max-width `520px`, margin-top `spacing-lg` — copy par @copywriter
4. Deux CTAs côte à côte (desktop) / empilés (mobile) :
   - Button primary "Proposer une opportunité" → `/opportunites`
   - Button ghost "Découvrir notre mission" → `/mission` — texte `parchment-50`, hover fond `ink-800`
5. Baseline : `text-caption` Inter `ink-400` — "Famille libanaise. Exigences sans exception."

**Image** : aucune image — typographie as hero. Le fond `ink-950` avec le texte crème crée l'impact visuel.

**Animation d'entrée** :
- Overline : fade-up `translateY(12px→0)` delay `0ms` duration `500ms` ease-out
- Tagline : fade-up `translateY(20px→0)` delay `150ms` duration `600ms`
- Sous-titre : fade-up delay `300ms` duration `500ms`
- CTAs : fade-in delay `450ms` duration `400ms`
- `prefers-reduced-motion` : fade-in uniquement, `duration-instant`, pas de translateY

---

### Section 2 — Chapeau Mission

**Layout** : fond `parchment-100`, conteneur `max-width-editorial` (720px), centré, padding vertical `spacing-4xl`

**Contenu** :
- Overline : `text-overline` `levant-600` — "Notre raison d'être"
- Titre : `text-h2` Cormorant `ink-950` — copy @copywriter (reformulation mission verrouillée)
- Corps éditorial : 2 paragraphes `text-body` Inter `ink-700`, max-width `600px`
- Lien → `/mission` : Icon-link "Notre mission & philosophie" — icon `ArrowRight` Lucide `levant-600`

**Breakpoints** :
- Mobile : padding `spacing-2xl`, texte pleine largeur
- Desktop : centré dans `max-width-editorial`

**Image** : aucune — section typographique pure.

**Animation** : scroll-in-view fade-up stagger `100ms` sur overline → titre → corps → lien.

---

### Section 3 — Chiffres clés (Key Stats)

**Layout** : fond `ink-950`, plein largeur, padding vertical `spacing-4xl`
- Grille 3 colonnes desktop → 1 colonne mobile (stagger vertical)
- Séparateurs verticaux `1px solid ink-800` entre colonnes desktop

**Contenu** :
- Card Key-Stat 1 : "50%" `levant-500` + label "Gradient One" `ink-300`
- Card Key-Stat 2 : "15 lots" `levant-500` + label "Immobilier direct IDF" `ink-300`
- Card Key-Stat 3 : "2020" `levant-500` + label "Première participation" `ink-300`

**Image** : aucune.

**Animation** : count-up sur les chiffres (optionnel — `duration-slow` si `prefers-reduced-motion` OFF, sinon valeur finale directe).

---

### Section 4 — Aperçu participations

**Layout** : fond `parchment-50`, padding vertical `spacing-4xl`
- Section-header gauche aligné : overline "Notre écosystème" + titre "Des participations cohérentes"
- Grille 3 colonnes desktop → 2 colonnes tablette → 1 colonne mobile
- 4 Card Participation (les 4 principales : Gradient One, Versimo, Immocrew, Versi Immobilier)

**Image** :
- Aucune photo dans les cards — overline secteur + nom + description textuelle + badge statut
- Une image contextuelle optionnelle en arrière-plan de la section (si budget le permet) : photo architecturale Unsplash "empty office building corridor warm light", format paysage 1200px+, opacité `0.08` en overlay sur `parchment-50` — UNIQUEMENT si cohérent après tests visuels, sinon supprimer

**CTA de section** : Button secondary "Voir toutes nos participations" → `/participations`, centré, margin-top `spacing-2xl`

**Animation** : cards scroll-in-view, stagger `100ms` par card, fade-up.

---

### Section 5 — Mission de conseil (Thomas)

**Layout** : fond `white-pure`, padding vertical `spacing-4xl`
- 2 colonnes 60%/40% desktop : texte à gauche, séparateur `2px solid levant-500` au milieu, citation à droite
- Mobile : empilé, citation en Card Quote sous le texte

**Colonne texte gauche** :
- Overline : "Mission de conseil & accompagnement"
- Titre : `text-h2` Cormorant `ink-950` — copy @copywriter sur l'expertise Thomas
- Corps : `text-body` Inter `ink-700`, 2-3 lignes résumé du profil Thomas
- Logos clients (wall of logos discret) : Lego / Siemens / Netflix / Cap Gemini / Suzuki / Hilton / Mango / TikTok / Adidas — `text-label` Inter Medium `ink-400` en grille horizontale, non-logos (noms texte uniquement pour éviter questions IP)
- Button ghost "En savoir plus" → `/accompagnement`

**Colonne citation droite** :
- Card Quote variant editorial — citation Thomas (copy @copywriter)
- Signature : "Patient par choix. Exigeant par principe." — `text-body-sm` Cormorant italic `ink-500`

**Image** :
- Type : photo portrait ou photo bureau/archive — UNIQUEMENT si de très haute qualité éditoriale
- Alternative sans photo : la Card Quote remplit toute la colonne droite avec un grand Cormorant italic — plus premium
- [DÉCISION : sans photo en V1 — col droite = Card Quote géant. Si Thomas fournit une photo portrait de qualité, l'intégrer en V2]

---

### Section 6 — CTA Final

**Layout** : fond `ink-950`, plein largeur, texte centré, padding vertical `spacing-4xl`

**Contenu** :
- Titre : `text-h2` Cormorant `parchment-100` — copy @copywriter
- Sous-titre : `text-body` Inter `ink-300`, max-width `480px`
- Button primary "Proposer une opportunité" size `lg`
- Texte discret sous le bouton : `text-caption` `ink-400` — "Ou contactez-nous directement : contact@issa-capital.com"

**Image** : aucune.

**Animation** : fade-up sur le titre + CTA au scroll.

## Page 2 — Mission & Philosophie

**Objectif** : raconter l'histoire de la famille Issa, ancrer les valeurs, créer la crédibilité pour Karim et Marc.

**Densité** : éditoriale — colonnes de lecture longues, citations entrecoupées, rythme lent assumé.

---

### Section 1 — Hero Section interne

**Layout** : fond `parchment-100`, plein largeur, padding vertical `spacing-4xl`
- Conteneur `max-width-content`, 2 colonnes desktop (8/12 + 4/12)
- Colonne gauche : Breadcrumb + Titre `text-h1` + Chapeau

**Contenu** :
- Breadcrumb : "Accueil / Mission & Philosophie"
- Overline : `text-overline` `levant-600` — "Notre raison d'être"
- Titre : `text-h1` Cormorant `ink-950` — "Famille libanaise. Horizons intergénérationnels."
- Chapeau : `text-lead` Inter `ink-700`, 2-3 lignes
- Séparateur `2px solid levant-500` width `48px`, margin-top `spacing-lg`

**Colonne droite (4/12)** : vide sur desktop (respiration) — sur mobile disparaît.

**Image** :
- Type : photo architecturale ou paysage warm-tones
- Sujet : bibliothèque privée, escalier en pierre, ou espace naturel méditerranéen (renvoi identité libanaise sans être explicite)
- Source : Unsplash — "old library warm light" ou "mediterranean stone architecture"
- Format : 16:9, min 1200px, teintes ocre/crème
- Position : fond plein-largeur de la section, opacité `0.12` en overlay sur `parchment-100` (très discret, texture uniquement)

---

### Section 2 — Notre histoire

**Layout** : fond `white-pure`, conteneur `max-width-editorial` (720px) centré, padding vertical `spacing-4xl`

**Contenu** : 3-4 paragraphes `text-body` Inter `ink-950`, syntaxe soignée par @copywriter
- Paragraphe 1 : la famille libanaise, ses origines, son rapport au patrimoine
- Paragraphe 2 : la création d'ISSA Capital — pourquoi structurer
- Paragraphe 3 : la philosophie d'investissement long-terme
- Pull-quote intercalé (Card Quote editorial) : citation Thomas ou devise familiale — `text-lead` Cormorant italic

**Image** : aucune image — section textuelle pure.

---

### Section 3 — Nos valeurs (3 filtres)

**Layout** : fond `parchment-50`, padding vertical `spacing-4xl`
- Section-header gauche : "Nos filtres de décision"
- Grille 3 colonnes desktop → 1 colonne mobile
- Chaque valeur = bloc avec icône Lucide + titre + description

**3 valeurs** :
1. Horizon patrimonial long terme — icône `Calendar` ou `Hourglass`
2. Préservation de l'environnement — icône `Leaf`
3. Éthique humaine — icône `Heart` ou `Shield`

**Présentation** : pas de cards (trop corporate) — blocs avec `padding-left spacing-md`, `border-left 2px solid levant-500`, titre `text-h4` Cormorant `ink-950`, description `text-body` Inter `ink-700`

**Image** : aucune — iconographie Lucide uniquement.

---

### Section 4 — La mission de conseil (Thomas)

**Layout** : fond `ink-950`, padding vertical `spacing-4xl`
- Contenu centré max-width `720px`

**Contenu** :
- Overline `levant-500` — "Mission de conseil & accompagnement"
- Titre `text-h2` Cormorant `parchment-100` — "L'expertise d'un pair."
- Corps `text-body` Inter `ink-300` — présentation de l'expertise de Thomas (copy @copywriter, basé sur le parcours Sony + TEOS + accompagnement startups)
- Wall of logos clients : noms texte en grille — Lego, Siemens, Netflix, Cap Gemini, Suzuki, Hilton, Mango, TikTok, Adidas — `text-label` `ink-400`
- Signature : Card Quote hero-quote — "Patient par choix. Exigeant par principe."
- Button : Button secondary (version light sur dark) "Prendre contact" → `/contact`

**Image** :
- [PROVISOIRE @À VALIDER PAR @ux] : si Thomas fournit une photo professionnelle, l'intégrer ici en position 2 colonnes (texte gauche / photo droite) sur fond `ink-950`. Sans photo : section full-text avec la Card Quote en grand format.

---

### Section 5 — Anti-persona (Ce qu'ISSA Capital n'est pas)

**Layout** : fond `parchment-100`, padding vertical `spacing-3xl`
- Conteneur `max-width-editorial`, centré

**Contenu** :
- Overline `levant-600` — "Ce que nous refusons"
- Titre `text-h3` Cormorant `ink-950`
- Liste stylisée (pas de puces classiques) : chaque item précédé d'un `—` `text-accent-normal` (levant-600), `text-body` Inter `ink-700` — [CORRECTION WCAG : levant-500 interdit sur fond parchment-100 pour texte normal — ratio 2.8:1 < 4.5:1. levant-600 = 4.6:1 PASS]
- Ton : affirmatif, pas d'excuses — conforme au brief brand-platform Trait 5 "Affirmé"

**Image** : aucune.

## Page 3 — Participations

**Objectif** : présenter l'écosystème de façon structurée, compréhensible par Marc (journaliste) et Karim, avec la double structure ISSA Capital → Gradient One → filiales.

**Densité** : structurée — grilles de cards, hiérarchie visuelle claire.

---

### Section 1 — Hero Section interne

**Layout** : fond `parchment-100`, identique au pattern Hero Section interne, padding `spacing-4xl`

**Contenu** :
- Breadcrumb + Overline "Notre écosystème" + Titre `text-h1` "Participations & écosystème" + Chapeau

**Image** :
- Type : illustration géométrique ou motif abstrait optionnel
- Alternative préférée : fond `parchment-100` pur avec typographie — cohérent avec la direction "typo as hero"

---

### Section 2 — Participation directe : Gradient One

**Layout** : fond `white-pure`, padding `spacing-4xl`
- 2 colonnes desktop : 6/12 texte + 6/12 liste filiales
- 1 colonne mobile : empilé

**Colonne gauche** :
- Badge "Participation directe — 50%"
- Titre `text-h2` Cormorant `ink-950` — "Gradient One"
- Sous-titre `text-body-sm` `ink-500` — "Holding intermédiaire — depuis 2020"
- Description `text-body` Inter `ink-700`
- Note : pas de site public pour Gradient One → pas de lien sortant

**Colonne droite** :
- Section-header secondaire : `text-overline` "Filiales de Gradient One"
- Liste verticale des 4 sous-participations : Versi Immobilier / Versi Invest / Immocrew / Versimo
- Chaque item : nom `text-h4` Cormorant + activité `text-body-sm` Inter + lien si site disponible

**Image** :
- Type : schéma/organigramme visuel (pas une image — un composant CSS)
- Schéma : ISSA Capital (50%) → Gradient One → [Versi Immo | Versi Invest | Immocrew | Versimo]
- Style : traits `1px levant-500`, nœuds texte `text-label` Inter, fond `parchment-50`

---

### Section 3 — Les filiales de Gradient One (4 cards)

**Layout** : fond `parchment-50`, padding `spacing-4xl`
- Grille 2×2 desktop → 1 colonne mobile
- Card Participation pour chaque filiale

**Cards** (selon order d'affichage Thomas) :
1. **Versi Immobilier** — marchand de biens, lien versi-immobilier.fr (si live) ou "Site bientôt disponible"
2. **Versi Invest** — club deal & conseil immobilier, [ATTENTION LEGAL : présentation prudente sans termes réglementés — voir legal-audit.md]
3. **Immocrew** — marketing mandataires immo, lien immocrew.fr
4. **Versimo** — home staging IA, lien versimo.fr

**Image** :
- Chaque card : aucune photo — overline secteur + nom + description + badge + lien sortant (si disponible)
- Optionnel si disponibilité budgétaire : screenshot du site de la participation (Immocrew, Versimo) — à générer par @fullstack via capture automatique

---

### Section 4 — Patrimoine immobilier en direct

**Layout** : fond `ink-950`, padding `spacing-3xl`
- Conteneur centré max-width `720px`, centré
- Traitement **discret** (conf. directive Thomas : "mention courte sans détailler")

**Contenu** :
- Overline `levant-500` — "Patrimoine immobilier en direct"
- Titre `text-h3` Cormorant `parchment-100` — "Résidentiel — Île-de-France"
- Corps `text-body` Inter `ink-300` — "ISSA Capital gère en direct un patrimoine résidentiel en Île-de-France. [PAS DE CHIFFRES selon directive Thomas]"
- Pas de Card Key-Stat ici (Thomas a demandé discrétion — pas de "15 lots" en affiché public sur cette page)

**Image** : aucune.

## Page 4 — Opportunités d'investissement

**Objectif** : qualifier Leila (et Karim si investisseur) avant le formulaire. Présenter les critères d'ISSA avec fermeté — pas d'invitation vague.

**Densité** : dense sur les critères, aérée sur le formulaire.

---

### Section 1 — Hero Section interne

**Layout** : fond `parchment-100`, hero section interne standard
- Titre `text-h1` — "Ce que nous recherchons"
- Chapeau : `text-lead` Inter `ink-700` — formulation by @copywriter (précise, pas incitative — conforme brand-platform)

**Image** :
- Type : photographie architecturale
- Sujet : immeuble résidentiel épuré, perspective géométrique, lumière naturelle
- Source : Unsplash — "residential building modern architecture"
- Dimensions : 16:9, min 1200px
- Position : fond de section, opacité `0.10` overlay sur `parchment-100`

---

### Section 2 — Secteurs ciblés

**Layout** : fond `white-pure`, padding `spacing-4xl`
- Section-header : "Nos secteurs d'investissement"
- Grille 2 colonnes desktop → 1 colonne mobile

**Contenu** :
- Secteur 1 : Immobilier (résidentiel IDF, marchands de biens) — icône `Building` Lucide
- Secteur 2 : Participations financières (holdings, services aux professionnels, tech) — icône `Briefcase`
- Chaque secteur : bloc border-left `2px levant-500`, titre `text-h4` Cormorant, description `text-body` Inter

---

### Section 3 — Critères et filtres

**Layout** : fond `parchment-50`, padding `spacing-4xl`
- Section-header : "Nos filtres non négociables"
- 2 colonnes : "Ce que nous acceptons" / "Ce que nous refusons"

**Contenu** :
- Accepté : liste avec `—` `text-accent-normal` (levant-600) en préfixe, `text-body` Inter `ink-950` — [CORRECTION WCAG : levant-500 interdit sur parchment-50 pour texte normal (ratio ~2.7:1). levant-600 = 4.7:1 PASS]
- Refusé : liste avec `✕` `reserve-500` ou `—` `ink-400`, texte `ink-600` légèrement atténué

**Note @copywriter** : le vocabulaire doit rester conforme à la liste noire CMF (legal-audit.md). Formuler les refus sans utiliser les termes "ticket minimum", "rendement", "investisseurs" pour désigner des tiers.

---

### Section 4 — Tagline Leila

**Layout** : fond `ink-950`, padding `spacing-3xl`, centré, max-width `640px`

**Contenu** :
- Card Quote hero-quote : "Vingt ans devant. Pas de sortie prévue." — `text-h2` Cormorant italic `parchment-100`
- Sous-texte `text-body` Inter `ink-300` — signal fort pour Leila (apporteur d'affaires) et Karim (investisseur potentiel)

---

### Section 5 — Formulaire de proposition

**Layout** : fond `white-pure`, padding `spacing-4xl`
- Conteneur `max-width-narrow` (560px) centré desktop, pleine largeur mobile
- Titre section : `text-h3` Cormorant `ink-950` — "Proposer une opportunité"
- Sous-titre : `text-body-sm` Inter `ink-600`

**Formulaire Opportunités (7 champs)** :
1. Prénom + Nom (2 colonnes)
2. Email (pleine largeur)
3. Secteur (Select : Immobilier / Participations financières / Autre)
4. Description courte de l'opportunité (Textarea, 4 lignes min)
5. Ticket d'investissement estimé (Select : < 200K€ / 200K-500K€ / 500K-2M€ / > 2M€)
6. Comment avez-vous connu ISSA Capital ? (Select optionnel)
7. Checkbox consentement RGPD (obligatoire)

**CTA** : Button primary "Envoyer ma proposition" size `lg`, pleine largeur

**5 états du formulaire** : voir composant Form section 3 de component-library.md

**Image** : aucune.

**Breakpoints** :
- Mobile : tous les champs en colonne unique, formulaire en pleine largeur, padding horizontal `spacing-md`
- Desktop : conteneur `max-width-narrow` centré, champs 1 et 2 sur même ligne

## Page 5 — Contact

**Objectif** : point d'entrée généraliste pour Marc et tout interlocuteur qui n'est pas dans le parcours Opportunités.

**Densité** : minimaliste — cette page est courte par design.

---

### Section 1 — Hero Contact

**Layout** : fond `parchment-100`, padding vertical `spacing-4xl`
- Texte centré, max-width `560px`
- Titre : `text-h1` Cormorant `ink-950` — "Nous contacter"
- Sous-titre : `text-lead` Inter `ink-700` — 1 phrase par @copywriter

---

### Section 2 — Formulaire de contact

**Layout** : fond `white-pure`, padding vertical `spacing-3xl`
- Conteneur `max-width-narrow` (560px) centré

**Formulaire Contact (3 champs)** :
1. Prénom + Nom (2 colonnes desktop / 1 mobile)
2. Email
3. Message (Textarea, 5 lignes)
4. Checkbox consentement RGPD

**CTA** : Button primary "Envoyer" size `md`

**Note** : même composant formulaire que /opportunites avec heading différent.

---

### Section 3 — Contact direct

**Layout** : fond `parchment-50`, padding `spacing-2xl`
- Texte centré, sobre

**Contenu** :
- `text-body` Inter `ink-700` — "Ou écrivez-nous directement :"
- Email cliquable : `text-h4` Cormorant `levant-600` — contact@issa-capital.com (lien `mailto:`)
- Adresse postale : `text-body-sm` Inter `ink-500` — 54 Rue Henri Barbusse, 92000 Nanterre

**Image** :
- Type : photo architecturale sobre ou minimaliste
- Sujet : façade de bâtiment haussmannien ou espace de travail épuré
- Source : Unsplash "paris haussmann building facade"
- Dimensions : 16:9, fond de section `parchment-50`, opacité `0.08` overlay
- Alternative sans photo : fond `parchment-50` pur — tout aussi efficace

**Breakpoints** :
- Mobile : formulaire pleine largeur, padding `spacing-md`
- Desktop : formulaire centré `max-width-narrow`

## Page 6 — Mentions légales + Politique de confidentialité

**Objectif** : conformité légale. Pas de design sophistiqué.

**Densité** : textuelle, sobre, lisible.

---

### Layout commun

**Structure** : fond `parchment-100`, conteneur `max-width-editorial` (720px) centré, padding vertical `spacing-3xl`
- Breadcrumb en haut
- Titre : `text-h2` Cormorant `ink-950`
- Corps : `text-body` Inter `ink-700`, titres intermédiaires `text-h4` Cormorant

**Meta SEO** : `noindex, nofollow` (confirmé functional-specs.md)

**Image** : aucune.

**Breakpoints** :
- Mobile : padding horizontal `spacing-md`, typographie inchangée
- Desktop : centré `max-width-editorial`

## Règles transversales

### Contrainte WCAG 2.2 AA — Usage du levant (règle obligatoire)

> Correction appliquée le 2026-04-07 suite à audit @ux (ux-audit.md).

| Token levant | Hex | Sur fond clair (parchment/white) | Sur fond sombre (ink-950) |
|---|---|---|---|
| `levant-500` | #C4935A | **INTERDIT texte normal** (ratio 2.8:1 < 4.5:1). Autorisé uniquement : texte ≥ 18px sur fond sombre, décoratifs, bordures, séparateurs. | AUTORISÉ — ratio 5.9:1 PASS |
| `levant-600` | #A87340 | **AUTORISÉ texte normal** (ratio 4.6:1 PASS). Token `text-accent-normal`. | AUTORISÉ |
| `levant-700` | #8B5E2A | AUTORISÉ texte normal (ratio 7.1:1 PASS). Token `accent.active`. | AUTORISÉ |

**Règle pour tous les textes d'accent <18px sur fond clair** : utiliser le token `text-accent-normal` (levant-600). Jamais `levant-500` directement.

**Exceptions autorisées pour levant-500 sur fond clair** :
- Séparateurs et bordures décoratives (seuil interactif 3:1 — levant-500/parchment-100 = 3.1:1 PASS)
- Guillemets décoratifs Card Quote en `text-h2` (40px — large text seuil 3:1 PASS)
- Icônes décoratives (non-texte)

### Alternance de fonds (rythme visuel)

Chaque page alterne les fonds pour créer un rythme sans images :

| Fond | Usage |
|---|---|
| `parchment-100` | Fond de page par défaut, hero sections internes |
| `white-pure` | Cards, formulaires, sections de contenu |
| `parchment-50` | Sections alternées légères (liste, grilles) |
| `ink-950` | Hero accueil, Key-Stats, citations hero, footer, CTAs finaux |

Règle : deux sections `ink-950` consécutives sont interdites. Toujours intercaler une section claire entre deux sections sombres.

### Animations scroll-in-view — Pattern par défaut

Tous les éléments entrant dans le viewport utilisent ce pattern :
- `opacity: 0 → 1` + `translateY: 20px → 0`
- Duration : `500ms`
- Easing : `ease-out` `cubic-bezier(0, 0, 0.2, 1)`
- Stagger entre éléments frères : `100ms`
- `prefers-reduced-motion: reduce` → `opacity: 0 → 1` uniquement, `duration-instant`

### Les 7 critères visuels — auto-validation

Vérification pour chaque page avant livraison :
1. **PRO** : fait professionnel, pas amateur
2. **BEAU** : esthétiquement plaisant
3. **BRAND-ALIGNED** : Ruler/Outlaw, noir-crème-ocre, Cormorant+Inter
4. **MÊME IDENTITÉ** : cohérence cross-pages
5. **PROPRE** : pas de bruit visuel
6. **ALIGNÉ** : grilles respectées, espacements réguliers
7. **AÉRÉ** : espace blanc suffisant
8. **CONVERSION** : CTA primaire visuellement dominant sur chaque page
9. **HIÉRARCHIE** : les 3 éléments les plus importants identifiables en plissant les yeux
10. **ACCESSIBLE** : WCAG 2.2 AA, focus visible, touch targets
