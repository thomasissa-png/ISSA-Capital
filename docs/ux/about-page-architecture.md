# Architecture page `/a-propos` — ISSA Capital

**Agent** : @ux
**Date** : 2026-04-08
**Session** : issa-session-4-reprise-9oB9r
**Statut** : livrable complet

---

## Étape 1 — Architecture de route

### URL recommandée : `/a-propos`

Cohérence avec les conventions existantes du site :
- `/mission`, `/accompagnement`, `/participations` — toutes en slug français sans sous-dossier
- `/a-propos` suit exactement le même pattern : segment racine, un seul mot, français
- Éviter `/about` (anglicisme incohérent avec le positionnement) ou `/famille` (trop intime, sous-estime la dimension institutionnelle)
- Éviter `/equipe` (terme erroné : il n'y a pas d'équipe au sens RH, c'est une famille fondatrice)

**Fichier Next.js à créer** : `src/app/a-propos/page.tsx`

### Cohérence arborescence

| Page existante | Relation avec `/a-propos` |
|---|---|
| `/mission` | Complémentaire — la mission expose le "pourquoi", `/a-propos` expose le "qui" |
| `/accompagnement` | Thomas est le signataire — un lien contextuel depuis `/accompagnement` vers `/a-propos` est recommandé |
| `/` homepage | Section 4 Filiation migrée depuis ici — lien de remplacement à prévoir (voir Étape 3) |

---

## Étape 2 — Structure DOM de la page

5 sections ordonnées par profondeur narrative : ancrage identitaire → héritage paternel → parcours Thomas → construction ISSA Capital → horizon transmissif.

---

### Section A — Hero page

- **Type** : hero éditorial typographique (pas d'image hero, cohérence avec les autres pages du site)
- **Contenu attendu** : overline catégoriel ("Famille fondatrice" ou équivalent), titre H1 court ancrant l'identité libanaise, sous-titre 1 ligne résumant la double temporalité (héritage + construction), pas de CTA hero
- **Layout** : 1 colonne centrée, `width="editorial"` (max 640px), `tone="inverse"` (fond sombre, identique au hero homepage)
- **Responsive** :
  - Mobile (375px) : stack vertical, padding py-3xl, texte H1 en text-h2
  - Tablet (768px) : py-4xl, texte H1 en text-h3
  - Desktop (1280px+) : py-5xl, texte H1 en text-display

---

### Section B — Jean-Pierre Issa : héritage paternel

- **Type** : biographique narratif — migration de la Section 4 homepage
- **Contenu attendu** : overline "Trois décennies avant la holding" (repris de la Section 4), titre H2, deux paragraphes narratifs (Dakar 1958 → IBM → Lexmark équipe fondatrice → 2J Impression Mérignac), mention de Sonia Issa architecte d'intérieur, phrase de clôture établissant le lien Thomas/JP
- **Layout** : 1 colonne, `width="editorial"`, `tone="subtle"` (fond parchment légèrement teinté — même ton que la Section 4 homepage actuelle, assure continuité visuelle pour les visiteurs qui connaissent déjà la homepage)
- **Responsive** : identique à la Section 4 homepage (comportement déjà validé)
- **Note pour @copywriter** : le contenu de la Section 4 homepage est la base de départ — enrichir avec Sonia Issa et la phrase de filiation plus développée

---

### Section C — Thomas Issa : parcours

- **Type** : biographique structuré avec jalons géographiques
- **Contenu attendu** : overline ("Thomas Issa" ou "Le fondateur"), titre H2, introduction 2-3 lignes, liste ou progression de jalons géographiques (France → Genève → Afrique du Sud → UC Irvine → Inde → France), mention Sony/TEOS/conseil stratégique, épisode de l'agence de communication internationale (35 ans, relais 24/7, 35 experts, 5 continents, 3,5 M€ CA, sortie 2025 pour se consacrer à sa famille et à ISSA Capital — sans jamais nommer l'agence), conclusion sur la création d'ISSA Capital 2026
- **Layout** : 2 colonnes sur desktop (60/40 — colonne gauche texte narratif, colonne droite photo portrait Thomas si disponible ; sinon 1 colonne full-width), `tone="default"`, `width="content"`
- **Responsive** :
  - Mobile : colonne unique, image portrait en tête de section si disponible (ratio 3/4, max-width 280px centré)
  - Tablet : colonne unique, image portrait inline droite (float ou grid 2 col)
  - Desktop : grid 2 colonnes gap-2xl, texte à gauche (col-span 7/12), image à droite (col-span 5/12)
- **Interaction** : pas d'interaction spéciale — section statique éditoriale

---

### Section D — Famille : ancrage et transmission

- **Type** : narratif court — ancrage humain, transition vers la holding
- **Contenu attendu** : overline ("La famille"), titre H2 court, 1-2 paragraphes : mariage avec une Française, trois enfants franco-libanais (Antoine 2015, Noémie 2018, Lucas 2023), ancrage Paris, formulation de la transmission intergénérationnelle comme moteur d'ISSA Capital (ce n'est pas une décision financière, c'est une décision de famille)
- **Layout** : 1 colonne, `width="editorial"`, `tone="subtle"`, centré
- **Responsive** : identique à Section B (stack vertical sur tous breakpoints)
- **Note** : cette section est courte — 150-200 mots max. Elle sert de pivot émotionnel entre le parcours Thomas et la création de la holding

---

### Section E — Fermeture : lien vers les activités

- **Type** : CTA éditorial discret — pas un bloc conversion agressif
- **Contenu attendu** : 1 ligne de conclusion ("ISSA Capital, c'est ce que cette histoire construit"), 2 liens texte discrets (flèche + label) : "Notre mission" → `/mission` et "Nos participations" → `/participations`
- **Layout** : 1 colonne centrée, `width="editorial"`, `tone="default"`, `className="py-2xl"` (section courte intentionnellement)
- **Responsive** : liens en stack vertical sur mobile, inline sur desktop
- **Note pour @fullstack** : utiliser le pattern de lien existant (cf. Section 2 homepage : `inline-flex items-center gap-sm text-levant-700`) — pas un composant Button, des liens texte discrets

---

## Étape 3 — Migration depuis homepage

### Section concernée

**Section 4 — "Filiation Jean-Pierre Issa"** (lignes 134-161 dans `src/app/page.tsx`) :
- Overline : "Trois décennies avant la holding"
- Titre H2 : "Ce qu'ISSA Capital a hérité."
- 2 paragraphes narratifs Jean-Pierre + Thomas
- Lien "Lire la mission" → `/mission`

### Traitement recommandé

**La Section 4 disparaît de la homepage.** Elle n'est pas remplacée par un autre bloc de même longueur.

**Remplacement** : une courte passerelle de 2-3 lignes dans la Section 2 existante ("Notre raison d'être"), intégrée après les paragraphes actuels, avec un lien discret vers `/a-propos` :

> [Texte court à rédiger par @copywriter — ex : "ISSA Capital est l'expression d'un héritage familial. [lien] Découvrir la famille fondatrice →"]

**Justification UX** : la homepage doit rester orientée vers les deux audiences cibles (UHNW/family office et dirigeants). L'histoire familiale détaillée est précieuse mais secondaire sur la homepage — elle est là pour les prospects qui veulent en savoir plus, pas pour le premier contact. La migration libère de l'espace sur la homepage sans perte d'information.

**Impact sur le flow homepage** : après suppression Section 4, l'enchaînement devient :
- Section 1 Hero → Section 2 Mission (+ passerelle /a-propos) → Section 3 Stats → Section 4 (ex-5) Écosystème → Section 5 (ex-6) Filtres → Section 6 (ex-7) Deux portes

---

## Étape 4 — Navigation

### Recommandation : accès secondaire — NI header principal, NI footer principal

**Décision** : `/a-propos` n'est PAS ajouté dans `siteConfig.nav` (header principal actuel : Mission / Participations / Accompagnement / Opportunités / Contact).

**Justification** : le header actuel a déjà 5 items — c'est la limite haute pour un site VITRINE premium sans surcharge cognitive. Ajouter un 6e item `À propos` dilue le signal des items actionnables (Opportunités, Accompagnement). Pour une audience UHNW, la navigation doit aller droit au but : ce qu'on fait, pas qui on est.

### Points d'accès recommandés (3 entrées secondaires)

1. **Homepage Section 2** : passerelle textuelle avec lien "Découvrir la famille fondatrice →" (voir Étape 3)
2. **Page `/mission`** : lien contextuel en fin de page — "La mission d'ISSA Capital est portée par Thomas Issa. [Découvrir son parcours →]"
3. **Page `/accompagnement`** : lien contextuel en bloc "À propos de Thomas Issa" — les prospects qui envisagent un accompagnement veulent savoir qui ils vont avoir en face d'eux

### Footer

Ajouter `/a-propos` dans `siteConfig.footerLinks` (avec label "À propos"). Le footer est le lieu naturel des liens secondaires institutionnels — convention web universelle, attendue par les visiteurs qui cherchent à en savoir plus après la navigation principale.

### Navigation mobile

Pas de changement dans le menu burger — cohérence avec la décision header. `/a-propos` reste accessible via footer sur mobile.

---

## Étape 5 — États et cas de bord (gate G21)

### État par défaut

Tous les contenus texte et images chargés. Page statique SSG (`export const dynamic = 'force-static'`), pas de loading state spécifique au niveau page.

### Sans image (fallback)

Section C (portrait Thomas) : si l'image `thomas-issa.jpg` (ou équivalent) n'est pas disponible, la section C passe en **layout 1 colonne full-width** (pas de colonne droite vide). Implémenter via conditional rendering côté code — @fullstack doit prévoir une prop `withPortrait: boolean` ou vérifier l'existence du fichier image au build.

Section B (Jean-Pierre) : pas d'image spécifiée dans la Section 4 homepage actuelle — comportement inchangé, la section reste 1 colonne éditoriale.

### Mobile (375px)

- Section A Hero : H1 en `text-h2`, padding `py-3xl`
- Section B : identical au comportement Section 4 homepage actuel
- Section C : colonne unique, portrait en tête si disponible (ratio 3/4, centré, max-width 280px)
- Section D : colonne unique, padding standard
- Section E : liens en stack vertical avec `min-h-[48px]` pour touch target conforme (44px+)

### Tablet (768px)

- Section A : `py-4xl`, H1 en `text-h3`
- Section C : grid 2 colonnes activé (60/40), portrait à droite
- Toutes sections : `px-xl` latéral

### Desktop (1280px+)

- Section A : `py-5xl`, H1 en `text-display` (cohérence hero homepage)
- Section C : grid 12 colonnes, texte col-span-7, portrait col-span-5
- `max-w-content` sur les sections à 2 colonnes, `max-w-editorial` sur les sections narratives

### Print

Non prioritaire. Si implémenté : masquer Header/Footer, Section E (liens), imprimer sections A-D en noir et blanc. Pas de CSS print spécifique demandé pour cette V1.

---

## Étape 6 — Spécifications images (gate G30)

### Image 1 — Portrait Thomas Issa (Section C)

- **Type** : portrait professionnel
- **Sujet** : Thomas Issa, cadrage buste ou demi-corps, fond neutre ou contexte bureau/extérieur parisien
- **Source** : photo personnelle Thomas Issa — à fournir par Thomas. Format recommandé : JPEG ou WebP, min 800×1000px, ratio portrait 4/5 ou 3/4
- **Placement** : colonne droite Section C, desktop uniquement (masqué sur mobile ou repositionné en tête de section)
- **Attribut alt** : "Thomas Issa, fondateur d'ISSA Capital"
- **Contrainte** : NE PAS utiliser de photo liée à l'agence de communication (ni logo, ni photo d'équipe, ni capture visuelle de la structure)

### Image 2 — Archive Jean-Pierre Issa ou famille (Section B)

- **Type** : photo archive ou documentaire
- **Sujet** : Jean-Pierre Issa — portrait professionnel, ou photo de famille historique, ou photo 2J Impression (locaux Mérignac, équipe) si disponible
- **Source** : archives familiales Issa — à fournir par Thomas
- **Placement** : optionnel — peut enrichir Section B si disponible. Si non disponible, section reste sans image (texte seul — comportement actuel Section 4 homepage)
- **Format** : ratio libre (paysage ou portrait), min 600px large
- **Attribut alt** : "Jean-Pierre Issa" ou description contextuelle de la photo

### Note sur l'absence d'images

Si aucune des deux images n'est disponible au moment du développement, la page est fonctionnelle en texte seul — c'est son état de fallback documenté (voir Étape 5). Ne pas utiliser de photos de stock génériques : l'authenticité de la narration familiale serait trahie.

---

## Étape 7 — Risques et alternatives écartées

### Alternative A — Ne pas créer de page dédiée (conserver Section 4 sur homepage)

**Description** : garder la Section 4 Filiation sur la homepage et ne pas créer `/a-propos`.

**Pourquoi écarté** : Thomas a lui-même signalé que la section ne "fait pas" sur la homepage. Structurellement, il a raison : la homepage adresse deux audiences opérationnelles (UHNW/family office et dirigeants) qui veulent savoir "que fait cette structure et comment entrer en relation". Une section biographique développée (2 paragraphes, 200 mots) interrompt ce flux. Elle crée un double registre — institutionnel (sections 1-3-5-6-7) + biographique familial (section 4) — qui fragilise la cohérence du parcours. La page `/a-propos` dédiée résout le problème sans sacrifier le contenu.

### Alternative B — Deux pages séparées (`/thomas-issa` + `/jean-pierre-issa`)

**Description** : créer deux pages biographiques distinctes, une par personnalité.

**Pourquoi écarté** : fragmentation artificielle de la narration familiale qui est précisément le sujet. ISSA Capital est l'expression d'un héritage — séparer les deux bios coupe le fil narratif (JP → Thomas → holding). Par ailleurs, deux pages `/thomas-issa` et `/jean-pierre-issa` créent une arborescence personnelle qui ressemble à un site de personal branding, pas à une holding patrimoniale institutionnelle. La page unique `/a-propos` maintient l'échelle institutionnelle tout en racontant l'histoire familiale.

### Alternative C — Intégrer `/a-propos` dans la page `/mission`

**Description** : enrichir la page `/mission` avec une section biographique en bas de page, plutôt que de créer une nouvelle route.

**Pourquoi écarté** : la mission d'ISSA Capital (raison d'être, horizon intergénérationnel, filtres de décision) et l'histoire des personnes qui la portent sont deux sujets distincts. Les fusionner crée une page surchargée à double objectif — problem classique de l'architecture de l'information. Un prospect qui veut comprendre la mission ne veut pas nécessairement lire les biographies ; un prospect qui veut vérifier qui est derrière la holding ne cherche pas les filtres d'investissement. Deux pages courtes et focalisées sont préférables à une page longue qui fait tout.

---

## Audit heuristique rapide — Nielsen

| # | Heuristique | Résultat |
|---|---|---|
| H1 | Visibilité de l'état du système | PASS — page statique, pas d'état dynamique. L'item nav actif sera souligné (pattern existant Header) |
| H2 | Correspondance système/monde réel | PASS — vocabulaire familial et institutionnel cohérent avec l'audience UHNW |
| H3 | Contrôle et liberté | PASS — section E fournit des sorties vers /mission et /participations |
| H4 | Cohérence et standards | PASS — composants Section/Container/Overline/Button identiques aux autres pages |
| H5 | Prévention des erreurs | N/A — page éditoriale statique, pas de formulaire |
| H8 | Design esthétique et minimaliste | PASS — 5 sections, pas de duplication de contenu, chaque section a un objectif unique |
| H9 | Correction des erreurs | N/A — page statique |

---

## Métriques HEART (gate HEART)

**Dimension primaire** : Adoption (de la marque ISSA Capital — confiance et crédibilité)

| Dimension | Signal | Métrique | Cible |
|---|---|---|---|
| Happiness | Visiteurs qui arrivent sur /contact après /a-propos | Taux de conversion /a-propos → /contact | > 8% |
| Adoption | Visiteurs qui accèdent à /a-propos depuis homepage ou /mission | Sessions incluant /a-propos | Baseline J30 à mesurer |
| Task success | Lecture complète de la page (scroll depth) | Scroll depth >= 80% de la page | >= 60% des sessions |

---

## Handoff

---

**Handoff → @copywriter**
- Fichiers produits : `docs/ux/about-page-architecture.md`
- Décisions prises : 5 sections (A Hero / B Jean-Pierre / C Thomas / D Famille / E Fermeture), layout 2 colonnes section C desktop, fallback 1 colonne sans image
- Points d'attention :
  - Section B : base = Section 4 homepage actuelle (lignes 134-161 `src/app/page.tsx`) — enrichir avec Sonia Issa architecte d'intérieur et phrase de filiation plus développée
  - Section C : épisode agence SANS jamais nommer l'agence — périphrases obligatoires ("l'agence", "la structure créative", "l'agence de communication internationale")
  - Section D : ton émotionnel mais retenu — pas de pathos, VITRINE premium
  - Section E : 2 liens texte discrets uniquement, pas de CTA conversion
  - Homepage Section 2 : rédiger la passerelle textuelle de remplacement de la Section 4 (2-3 lignes + lien "/a-propos")

**Handoff → @fullstack**
- Fichiers produits : `docs/ux/about-page-architecture.md`
- Décisions prises :
  - Créer `src/app/a-propos/page.tsx` (SSG, `dynamic = 'force-static'`)
  - Ajouter `{ label: 'À propos', href: '/a-propos' }` dans `siteConfig.footerLinks` uniquement (PAS dans `siteConfig.nav`)
  - Supprimer la Section 4 Filiation de `src/app/page.tsx` (lignes 134-161) et la remplacer par la passerelle textuelle fournie par @copywriter
  - Ajouter lien contextuel `/a-propos` en fin de page `/mission` et `/accompagnement`
  - Section C : conditional rendering portrait — si image absente, layout 1 colonne
  - Composants existants à réutiliser : Section, Container, Overline, Button, Link pattern `text-levant-700`
  - Touch targets mobile : min 48px sur les liens Section E

**Handoff → @creative-strategy**
- Points d'attention :
  - La page `/a-propos` consolide la narration identitaire libanaise — vérifier cohérence avec `docs/strategy/brand-platform.md` si existant
  - L'épisode agence de communication est un signal fort de compétence entrepreneuriale internationale — s'assurer que le positionnement d'ISSA Capital capitalise dessus sans en faire le centre de gravité (Thomas est fondateur d'une holding, pas d'une agence)

---

*Livrable produit par @ux — session issa-session-4-reprise-9oB9r — 2026-04-08*
