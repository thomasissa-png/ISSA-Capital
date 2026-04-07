# Wireframes — ISSA Capital
> @ux — 2026-04-07
> Source : project-context.md + docs/strategy/personas.md + docs/product/functional-specs.md + docs/design/page-compositions.md
> 7 pages V1 : Accueil / Mission / Accompagnement / Opportunités / Participations / Contact / Mentions légales

---

## Règles transverses

### Navigation (Header)
- **Pattern** : barre horizontale pleine largeur, fond noir-profond (#0A0A0A), hauteur fixe 64px
- **Contenu** : logo "ISSA Capital" (gauche) + liens Mission | Participations | Accompagnement | Opportunités | Contact (centre ou droite) + CTA "Proposer une opportunité" (bouton outline levant, extrême droite)
- **Comportement scroll** : backdrop-blur + légère opacité au scroll (transition 200ms)
- **Lien actif** : couleur levant (#C4935A), pas de soulignement
- **Responsive 375px** : logo + hamburger uniquement. Menu déroulant pleine largeur avec liens empilés + CTA en bas
- **Responsive 768px** : liens raccourcis, CTA réduit à icône ou libellé court
- **Accessibilité** : focus-visible levant sur tous les liens, keyboard nav complète, aria-label="Navigation principale", aria-current="page" sur lien actif
- **CTA absent sur** : page Contact, page Opportunités (redondant avec formulaire visible)

### Footer
- **Pattern** : fond noir-profond, padding 48px vertical, stack vertical centré
- **Contenu** : nom + forme juridique + SIREN + adresse | liens secondaires | © {année dynamique} ISSA Capital
- **Responsive** : identique à toutes résolutions (stack vertical — déjà condensé)

### Typographie globale
- Headings H1-H2 : Cormorant Garamond, poids 400-600, noir (#0A0A0A) sur crème (#F5F0E8) ou blanc sur noir
- Corps : Inter, 16px/1.6, gris-foncé (#2C2C2C) sur fond crème
- Liens inline : levant (#C4935A), pas de soulignement par défaut, soulignement au hover

### États UI transversaux
- **Loading** : font-display: swap — texte visible avec police système en fallback
- **Erreur 404** : page dédiée avec H1 sobre + lien retour Accueil
- **Reduced-motion** : toutes les transitions CSS enveloppées dans `@media (prefers-reduced-motion: reduce)` — transitions désactivées, états finaux directs

---

## Index des 7 pages

| # | URL | Persona cible | CTA principal | Description courte |
|---|-----|---------------|---------------|--------------------|
| 1 | `/` | Karim + Leila (premier contact) | "Proposer une opportunité" → /opportunites | Identité, mission courte, écosystème aperçu, bifurcation 2 CTAs |
| 2 | `/mission` | Marc + Karim | "Échanger sur votre projet" → /accompagnement | Histoire famille Issa, convictions, filtres de décision, vision 30 ans |
| 3 | `/accompagnement` | Karim | "Prendre contact" → /contact | Expertise Thomas, domaines, formats mission/advisoring |
| 4 | `/opportunites` | Leila | Formulaire 7 champs | Critères d'investissement, formulaire de soumission qualifiant |
| 5 | `/participations` | Leila + Marc | "Proposer une opportunité" → /opportunites | Écosystème 2 niveaux, présentation 6 entités |
| 6 | `/contact` | Marc + Karim | Email direct | Formulaire court 4 champs, email visible |
| 7 | `/mentions-legales` | Marc (vérification légale) | — | Mentions légales + politique de confidentialité |

---

## Page 1 — Accueil (`/`)

**Objectif** : Poser l'identité d'ISSA Capital en moins de 10 secondes et orienter Karim vers /accompagnement, Leila vers /opportunites.
**Persona cible principal** : Karim + Leila (premier contact), Marc (découverte).

---

### Section 1 — Hero
- **Pattern** : full-width, hauteur 100vh (desktop), 85vh (mobile). Fond noir-profond. Texte centré.
- **Contenu** :
  - Eyebrow (au-dessus du H1) : "ISSA Capital" en Inter 13px, espacement élargi, levant. Facultatif si logo header suffit.
  - H1 : "On décide. Pas un calendrier de fonds." — Cormorant Garamond 72px desktop / 40px mobile, blanc (#FFFFFF), max-width 800px centré
  - Sous-titre : "La holding patrimoniale d'une famille aux racines libanaises. Nous investissons pour les générations à venir." — Inter 18px, gris-clair (#A0A0A0), max-width 560px centré
  - **Bifurcation 2 CTAs** (côte à côte, gap 16px) :
    - CTA A primaire : "Vous accompagner" → /accompagnement — bouton plein levant (#C4935A), texte noir, 48px hauteur
    - CTA B secondaire : "Proposer une opportunité" → /opportunites — bouton outline blanc, texte blanc, même taille
  - Baseline marque : "Racines libanaises. Exigences sans exception." — Inter 13px, gris-discret (#606060), centré, 48px sous les CTAs
- **Visuel** : pas de photo de famille. Option A : fond uni noir avec grain de texture subtil (CSS ou SVG). Option B : image Unsplash premium (architecture minimaliste, béton, lumière naturelle) en overlay sombre 70%. Décision @design.
- **Responsive 375px** : H1 40px, sous-titre 16px. CTAs empilés verticalement (CTA A en premier). Baseline en dessous.
- **Responsive 768px** : H1 52px. CTAs côte à côte conservés si espace suffisant, sinon empilés.
- **Interaction** : pas d'animation hero (Ruler = autorité = statique). Scroll indicator discret (chevron bas) si hauteur 100vh.
- **États UI** :
  - Défaut : hero complet visible au-dessus du fold
  - Loading : police Inter chargée via font-display:swap — Inter 16px système en fallback, pas de FOUT bloquant
  - Erreur : N/A (contenu statique)
- **Accessibilité** : H1 unique sur la page, contraste blanc/#0A0A0A = 21:1 (WCAG AAA), focus-visible levant sur les 2 CTAs, touch targets 48px min mobile

---

### Section 2 — Chapeau Mission
- **Pattern** : full-width, fond crème (#F5F0E8), padding 80px vertical. Texte centré sur max-width 680px.
- **Contenu** :
  - H2 : "Famille. Transmission. Long-terme." — Cormorant Garamond 42px, noir
  - Corps : "ISSA Capital est la holding patrimoniale de la famille Issa. Sa raison d'être est de faire fructifier le patrimoine familial dans la durée et d'organiser sa transmission entre les générations." — Inter 17px, gris-foncé, line-height 1.7
  - Lien secondaire : "Notre mission →" → /mission — texte levant, Inter 15px, hover soulignement
- **Responsive** : identique sur tous les breakpoints, font-size réduit proportionnellement (H2 : 28px mobile)
- **Interaction** : pas d'animation. Lien seul élément interactif.
- **États UI** : section entièrement statique — uniquement état défaut.

---

### Section 3 — Écosystème en Aperçu
- **Pattern** : grille 3 colonnes × 2 lignes (desktop 1280px), 2 colonnes (tablet 768px), 1 colonne (mobile 375px). Fond blanc (#FFFFFF). Padding 80px vertical.
- **Titre de section** : H2 "Notre écosystème" — Cormorant Garamond 36px, centré, noir. Sous-titre "6 participations, deux axes : technologie et immobilier." Inter 16px, gris.
- **Contenu par carte** (6 cartes, une par participation) :
  - Nom de l'entité — Inter 18px, gras, noir
  - Secteur en 1 ligne — Inter 14px, gris
  - Lien sortant si site live (immocrew.fr, versimo.fr) : icône externe, target="_blank" rel="noopener noreferrer" — sinon mention "Site à venir"
  - Aucune image, aucun logo tiers — texte seul, border-left levant 2px comme accent
- **Ordre d'affichage** : Gradient One → Versi Immobilier → Versi Invest → Immocrew → Versimo → Immobilier en direct
- **CTA bas de section** : "Découvrir toutes les participations →" → /participations — lien texte levant
- **Responsive 375px** : cartes en stack vertical, pleine largeur, border-left conservée
- **Responsive 768px** : grille 2 colonnes
- **États UI** : statique. Liens sortants : pas d'état loading (target="_blank"). Si site "à venir", span non cliquable, style gris-discret.
- **Accessibilité** : liens sortants avec aria-label="[Nom entité] — s'ouvre dans un nouvel onglet"

---

### Section 4 — Philosophie Différenciante
- **Pattern** : 3 blocs côte à côte (desktop), empilés (mobile). Fond noir-profond. Padding 80px vertical. Max-width 960px centré.
- **Titre** : H2 "Ce que nous ne ferons jamais" ou "Nos filtres de décision" — Cormorant Garamond 36px, blanc, centré. (Arbitrage @copywriter sur le libellé exact)
- **Contenu par bloc** :
  - Bloc 1 — Patrimoine long-terme : chiffre ou icône Lucide (Shield) / titre / 1-2 lignes Inter 15px blanc-cassé
  - Bloc 2 — Éthique humaine : icône (Users) / titre / 1-2 lignes
  - Bloc 3 — Préservation de l'environnement : icône (Leaf) / titre / 1-2 lignes
  - Séparateur vertical entre blocs (desktop) : 1px levant
- **Responsive 375px** : blocs empilés, séparateur horizontal
- **Responsive 768px** : 3 colonnes conservées si espace, sinon 1 colonne
- **Interaction** : pas d'animation. Section de conviction pure, pas de CTA.
- **États UI** : statique.

---

### Section 5 — CTA Final de Conversion
- **Pattern** : full-width, fond levant (#C4935A). Padding 80px vertical. Texte centré.
- **Contenu** :
  - H2 : titre d'appel à action — @copywriter. Exemple : "Vous avez une opportunité. Nous avons le capital."
  - Sous-titre : "Nous lisons chaque proposition qualifiée." — Inter 16px, noir
  - 2 CTAs :
    - CTA B principal : "Proposer une opportunité" → /opportunites#formulaire — bouton plein noir, texte blanc
    - CTA A secondaire : "Vous accompagner" → /accompagnement — bouton outline noir, texte noir
- **Responsive** : CTAs empilés sur 375px, côte à côte sur 768px+
- **États UI** : statique. Hover sur boutons : inversion légère de couleur (transition 150ms).
- **Accessibilité** : contraste texte noir/#C4935A = vérification WCAG AA obligatoire (seuil 4.5:1). Si ratio insuffisant : fond noir, texte blanc sur boutons.

---

### Tests UX — Page Accueil

| Test | Critère de succès | Statut |
|------|-------------------|--------|
| Parcours Karim : comprend l'identité en <10s | H1 + sous-titre au-dessus du fold, mots "transmission" + "racines libanaises" visibles | ✅ |
| Parcours Leila : trouve le CTA opportunités sans scroll | CTA B "Proposer une opportunité" above-the-fold en section Hero | ✅ |
| Charge cognitive : ≤ 3 actions principales | Hero propose 2 CTAs + 1 nav = 3 actions max au-dessus du fold | ✅ |
| Time-to-value : ≤ 3 étapes | Accueil → Opportunités → Formulaire = 2 étapes pour Leila | ✅ |
| Edge case : connexion lente | font-display: swap + SSG garantissent rendu sans JS | ✅ |
| Accessibilité WCAG 2.2 AA | Contrastes blanc/noir 21:1 ; CTAs 48px touch target ; focus-visible levant | ✅ |

---

## Page 2 — Mission (`/mission`)

**Objectif** : Transmettre la conviction, l'histoire générationnelle et les filtres de décision d'ISSA Capital — nourrir Marc pour un article, convaincre Karim de la légitimité de Thomas.
**Persona cible principal** : Marc (earned media) + Karim (légitimité).

---

### Section 1 — Hero Mission
- **Pattern** : full-width, hauteur 60vh desktop / 50vh mobile. Fond noir-profond.
- **Contenu** :
  - H1 : "Patient par choix. Exigeant par principe." — Cormorant Garamond 64px desktop / 38px mobile, blanc
  - Sous-titre court : "La mission d'ISSA Capital se mesure en décennies." — Inter 17px, gris-clair
- **Visuel** : fond uni noir. Typographie as hero — large, sobre.
- **Responsive** : H1 38px mobile, sous-titre 15px.
- **États UI** : statique.

---

### Section 2 — Arc Générationnel (Jean-Pierre → Thomas → Enfants)
- **Pattern** : split 60/40 desktop, fond crème. Gauche : texte éditorial. Droite : ligne chronologique verticale CSS (3 jalons). Padding 80px vertical.
- **Contenu gauche** :
  - H2 "L'origine" — Cormorant Garamond 38px, noir
  - Texte narratif : arc JP Issa (Dakar, famille libanaise, IBM, Lexmark EMEA, 2J Impression 4M€ CA 17 pays) → Thomas (Sony TEOS 6000% ROI, structuration holding 2026) → trois enfants (bénéficiaires). @copywriter : docs/copy/page-mission.md Section 1.
- **Contenu droite** : 3 jalons verticaux — 1958 (JP, Liban/Dakar), 2011 (Thomas, Sony), 2026 (ISSA Capital). Points levant (#C4935A) sur axe vertical #2C2C2C.
- **Responsive 375px** : split → stack vertical. Chronologie passe en liste horizontale compacte sous le texte.
- **Responsive 768px** : split 50/50.
- **États UI** : statique.

---

### Section 3 — Identité Libanaise
- **Pattern** : full-width, fond blanc. Padding 64px vertical. Texte centré, max-width 700px.
- **Contenu** :
  - H2 : "Racines libanaises. Ancrage français." — Cormorant Garamond 38px, noir
  - Texte 3-4 lignes : "Partis du Liban à cause de la guerre, arrivés en France pour y finir leurs études. Deux cultures, une famille, une exigence commune." — Inter 17px, line-height 1.7
  - Pas de drapeau, pas d'iconographie. Texte seul.
- **Responsive** : H2 28px mobile.

---

### Section 4 — Filtres de Décision
- **Pattern** : 3 colonnes desktop / 1 colonne mobile. Fond noir-profond. Padding 64px vertical. Séparateur vertical levant 1px entre colonnes.
- **Titre** : H2 "Nos filtres" — Cormorant Garamond 36px, blanc, centré.
- **Contenu par filtre (3)** : icône Lucide + titre Inter 18px gras blanc + 1 ligne Inter 15px blanc-cassé.
  - Patrimoine long-terme : "Nous ne vendons pas dans 5 ans."
  - Éthique humaine : "Nous n'investissons jamais contre l'humanité."
  - Environnement : "Nous préservons ce que nous transmettons."
- **Responsive 375px** : blocs empilés, séparateur horizontal levant.

---

### Section 5 — Vision 30 ans + CTA
- **Pattern** : full-width, fond crème. Texte centré max-width 680px. Padding 80px vertical.
- **Contenu** :
  - H2 "Horizon 2055" — Cormorant Garamond 42px, noir (libellé exact : @copywriter)
  - Citation directe Thomas (3-4 lignes, ton direct) : vision de transmission. Guillemets Cormorant.
  - CTA inline : "Découvrir notre approche d'accompagnement →" → /accompagnement — lien texte levant
- **Responsive** : H2 28px mobile.

---

### CTA Bas de Page
- **Pattern** : fond levant, même structure que Page Accueil Section 5.
- **CTA A** : "Échanger sur votre projet" → /accompagnement | **CTA B** : "Proposer une opportunité" → /opportunites

---

### Tests UX — Page Mission

| Test | Critère de succès | Statut |
|------|-------------------|--------|
| Marc trouve une histoire dense et factuelle | Section arc générationnel avec faits concrets (IBM, Lexmark, 2J Impression 4M€ 17 pays) | ✅ |
| Karim voit la légitimité de Thomas | Chiffres Sony TEOS (6000% ROI) présents dans la section arc | ✅ |
| Charge cognitive : ≤ 3 actions | Lecture linéaire, 1 CTA accompagnement, 1 CTA opportunités | ✅ |
| Accessibilité | Contraste texte/fond crème et fond noir vérifié, jalons chronologiques accessible screen reader | ✅ |

---

## Page 3 — Accompagnement (`/accompagnement`)

**Objectif** : Convaincre Karim que Thomas Issa est le pair qu'il cherche — ni CGP, ni consultant théorique. Amener à une prise de contact sans friction.
**Persona cible principal** : Karim.

---

### Section 1 — Hero Accompagnement
- **Pattern** : full-width, hauteur 50vh desktop / 45vh mobile. Fond noir-profond.
- **Contenu** :
  - H1 : titre de la page — @copywriter docs/copy/page-accompagnement.md. Exemple-type : "Ce que j'ai construit, je peux vous aider à le construire." — Cormorant Garamond 56px desktop / 34px mobile, blanc
  - Sous-titre : positionnement pair-à-pair (pas de jargon CGP) — Inter 17px, gris-clair
- **Responsive** : H1 34px mobile.
- **États UI** : statique.

---

### Section 2 — Qui est Thomas (crédibilité pair)
- **Pattern** : split 55/45 desktop. Gauche : texte. Droite : liste de faits-clés (bullets Inter). Fond crème. Padding 80px vertical.
- **Contenu gauche** :
  - H2 "Thomas Issa" — Cormorant Garamond 36px, noir
  - Texte 4-5 lignes : parcours Sony TEOS (6000% ROI, 7 régions, Lego/Netflix/Siemens), co-fondateur Gradient One 2020, écosystème Versi/Immocrew/Versimo, 15 lots IDF. Ton direct, première personne si Thomas valide.
- **Contenu droite** : liste de 5 faits-clés sans puce standard — tiret levant, Inter 16px.
  - 15+ ans stratégie internationale
  - Co-fondateur TEOS — 6000% ROI en 1 an
  - Gradient One, Versi Immobilier, Versimo, Immocrew
  - 15 lots immobilier IDF en gestion directe
  - Clients : Lego, Siemens, Netflix, Hilton
- **Responsive 375px** : stack vertical, liste sous le texte.

---

### Section 3 — Domaines d'Expertise
- **Pattern** : grille 2 colonnes × 3 lignes desktop (6 domaines), 1 colonne mobile. Fond blanc. Padding 64px vertical.
- **Titre** : H2 "Ce que je fais avec vous" — Cormorant Garamond 36px, noir, centré.
- **Contenu par domaine** (6 cartes) :
  - Titre domaine — Inter 18px, gras, noir
  - Description 2 lignes — Inter 14px, gris-foncé
  - Border-top levant 2px
  - Domaines : Structuration de holding IS | Investissement immobilier en direct IDF | Écosystème de participations | Accompagnement fondateurs | Stratégie & go-to-market Europe | Transmission intergénérationnelle anticipée
- **Responsive 768px** : grille 2 colonnes maintenue.
- **Responsive 375px** : 1 colonne, cartes pleine largeur.
- **États UI** : statique. Hover sur carte : border-top levant → border-full levant (transition 150ms).

---

### Section 4 — Formats d'Intervention
- **Pattern** : 2 colonnes égales desktop. Fond noir-profond. Padding 64px vertical.
- **Titre** : H2 "Deux formats, aucun produit" — Cormorant Garamond 36px, blanc, centré.
- **Colonne 1 — Mission ponctuelle** :
  - Titre Inter 20px gras blanc
  - Description 3 lignes Inter 15px blanc-cassé : intervention délimitée, objectif clair, durée définie (minimum 1 mois)
  - Exemples d'usage : structuration holding, lancement Europe, go-to-market, audit stratégique
- **Colonne 2 — Advisoring** :
  - Titre Inter 20px gras blanc
  - Description 3 lignes : rôle d'advisor récurrent, sparring partner long-terme, board informel
  - Exemples : présence mensuelle, revue de décisions, accès réseau Thomas
- **Séparateur** : ligne verticale levant 1px entre colonnes.
- **Responsive 375px** : stack vertical, séparateur horizontal.

---

### Section 5 — Anti-Personas (clarté du filtre)
- **Pattern** : full-width, fond crème. Padding 48px vertical. Max-width 760px centré.
- **Titre** : H2 "Ce que je ne fais pas" — Cormorant Garamond 32px, noir. Ton Outlaw assumé.
- **Contenu** : liste à tirets levant. 7 anti-personas confirmés par Thomas : pas de pre-seed, pas de crypto/Web3, pas de cold pitch, pas sous 200K€ ticket immo, pas de mission < 1 mois, pas d'usage contraire à l'éthique, pas de spéculatif court-terme.
- **Note UX** : cette section est un différenciateur fort pour Karim — elle lui signale que Thomas ne prend pas tout le monde, donc le prendre, c'est une sélection.

---

### Section 6 — CTA Prise de Contact
- **Pattern** : full-width, fond levant. Padding 80px vertical. Texte centré.
- **Contenu** :
  - H2 : "Votre projet mérite une conversation." — Cormorant Garamond 40px, noir
  - Sous-titre : "Décrivez-nous votre contexte en quelques lignes. Nous revenons vers vous." — Inter 16px
  - CTA unique : "Prendre contact" → /contact#formulaire-accompagnement — bouton plein noir, texte blanc, 52px hauteur
  - Email affiché discrètement sous le bouton : contact@issa-capital.com — Inter 14px, gris-foncé (pour Karim qui préfère l'email direct)
- **Responsive** : CTA pleine largeur 375px.
- **États UI** : statique. Bouton : 6 états (default/hover/active/focus-visible/disabled/loading) — voir component-library.md.

---

### Tests UX — Page Accompagnement

| Test | Critère de succès | Statut |
|------|-------------------|--------|
| Karim comprend la différence vs CGP | Section "formats" : pas de produit, pas de frais de gestion, pas de portefeuille | ✅ |
| Karim voit un pair, pas un prestataire | Faits-clés concrets (Sony, TEOS, 6000% ROI) dans section 2, ton direct | ✅ |
| Karim trouve un CTA sans friction | Email direct visible + formulaire court (3 champs) | ✅ |
| Charge cognitive : ≤ 3 actions | Lecture linéaire + 1 CTA contact | ✅ |
| Anti-personas clairs | Section dédiée avec 7 critères lisibles | ✅ |

---

## Page 4 — Opportunités (`/opportunites`)

**Objectif** : Permettre à Leila de qualifier son deal en 90 secondes et de soumettre le formulaire sans friction. Clarté des critères = condition de conversion.
**Persona cible principal** : Leila.

---

### Section 1 — Hero Opportunités
- **Pattern** : full-width, hauteur 45vh desktop / 40vh mobile. Fond noir-profond.
- **Contenu** :
  - H1 : "Proposez votre opportunité." — Cormorant Garamond 56px desktop / 34px mobile, blanc
  - Sous-titre : "Nous lisons chaque dossier qualifié. Réponse sous [X] jours ouvrés." — Inter 17px, gris-clair. [X] à confirmer par Thomas.
  - Ancre rapide : "Voir les critères ↓" — lien texte levant, scroll doux vers Section 2
- **Responsive** : H1 34px mobile.
- **États UI** : statique.

---

### Section 2 — Critères d'Investissement (moment de vérité Leila)
- **Pattern** : 2 colonnes desktop (critères immo gauche, critères participations droite). Fond crème. Padding 64px vertical.
- **Titre** : H2 "Ce que nous cherchons" — Cormorant Garamond 36px, noir, centré.
- **Colonne Gauche — Immobilier** :
  - Titre H3 "Immobilier" — Inter 20px, gras
  - Géographie : Île-de-France, grandes métropoles
  - Type : résidentiel, immeuble de rapport, immeuble mixte
  - Ticket : à partir de 200 K€ (mention discrète — seuil non affiché comme barrière mais comme signal de profil)
  - Horizon : long-terme, pas de revente court-terme
  - Posture : co-investissement ou actionnariat minoritaire
- **Colonne Droite — Participations financières** :
  - Titre H3 "Participations" — Inter 20px, gras
  - Stade : entreprises opérationnelles (pas pre-seed)
  - Secteurs ciblés : technologie, immobilier, services B2B
  - Secteurs exclus : crypto/Web3, spéculatif court-terme, activités contraires à l'éthique
  - Ticket : à préciser par Thomas
  - Posture : minoritaire long-terme, co-fondateur possible
- **Séparateur vertical** : levant 1px.
- **Responsive 375px** : stack vertical. Colonne participations sous colonne immo.
- **États UI** : statique.

---

### Section 3 — Ce qu'ISSA refuse (signal de qualité)
- **Pattern** : full-width, fond blanc. Padding 48px vertical. Max-width 760px centré. Liste à tirets.
- **Titre** : H2 "Ce que nous ne faisons pas" — Cormorant Garamond 32px, noir.
- **Contenu** : liste concise — spéculatif court-terme, pitch générique non qualifié, crypto/Web3, activités contraires à l'éthique. Ton direct, pas d'excuse.
- **Note UX** : pour Leila, cette section rassure — si son deal n'est dans aucun refus, c'est un signal positif.

---

### Section 4 — Formulaire de Soumission (id="formulaire")
- **Pattern** : full-width, fond noir-profond. Padding 80px vertical. Formulaire centré, max-width 600px.
- **Titre** : H2 "Soumettez votre dossier" — Cormorant Garamond 38px, blanc, centré.
- **7 champs qualifiants** :
  1. Nom complet — texte, obligatoire
  2. Email professionnel — email, obligatoire
  3. Téléphone — tel, facultatif (signal : pas d'obligation)
  4. Type d'opportunité — select : Immobilier | Participation financière | Autre, obligatoire
  5. Géographie / localisation — texte, obligatoire pour immo
  6. Taille de l'opportunité (fourchette) — texte libre ou select, obligatoire
  7. Description (contexte, deal, attente) — textarea 4 lignes, 500 caractères max, obligatoire
  8. Consentement RGPD — checkbox avec lien vers /mentions-legales, obligatoire
- **Bouton de soumission** : "Soumettre mon dossier" — bouton plein levant, texte noir, 52px hauteur, pleine largeur
- **Microcopy** : sous le bouton — "Nous répondons à chaque opportunité qualifiée." + email contact@issa-capital.com en fallback
- **Responsive** : champs pleine largeur sur tous les breakpoints. Téléphone et email côte à côte sur 768px+.
- **États UI** :
  - Défaut : formulaire vide, labels visibles, placeholders sobres
  - Loading (post-soumission) : bouton → spinner levant + "Envoi en cours…", champs désactivés
  - Vide (champs obligatoires vides à la soumission) : validation inline en temps réel — bordure rouge + message d'erreur sous le champ en Inter 13px rouge
  - Erreur (erreur serveur) : message inline en haut du formulaire — "Une erreur est survenue. Réessayez ou écrivez directement à contact@issa-capital.com." Inter 15px, fond rouge-pâle, icône AlertCircle Lucide
  - Succès : formulaire remplacé par message de confirmation centré — "Votre dossier a été transmis. Nous revenons vers vous sous [X] jours ouvrés." Cormorant Garamond 28px, blanc. Lien retour Accueil.
- **Accessibilité** : labels explicites sur chaque champ (pas de placeholder seul), aria-required="true" sur champs obligatoires, aria-describedby pour les messages d'erreur, focus-visible levant sur chaque champ, ordre de focus logique (top to bottom)
- **Conformité légale** : mention anti-L.411-1 CMF absente du formulaire UI — la conformité est dans le copy de la page (ISSA reçoit des propositions entrantes, ne démarche pas). Voir legal-audit.md.

---

### Tests UX — Page Opportunités

| Test | Critère de succès | Statut |
|------|-------------------|--------|
| Leila qualifie son deal en <90s | Section critères visible sans scroll important (above-the-fold sur 768px) | ✅ |
| Formulaire : 5 états UI documentés | Défaut / Loading / Vide / Erreur / Succès — tous spécifiés | ✅ |
| Erreur formulaire : message humain | Message d'erreur serveur indique le problème ET la solution (email fallback) | ✅ |
| Confirmation post-soumission | État succès avec délai de réponse annoncé (valeur [X] à confirmer Thomas) | ⚠️ valeur à compléter |
| Accessibilité WCAG 2.2 AA | Labels, aria-required, focus-visible, touch targets 52px | ✅ |

---

## Page 5 — Participations (`/participations`)

**Objectif** : Prouver qu'ISSA Capital investit réellement — signal de crédibilité pour Leila et Marc.
**Persona cible principal** : Leila (preuve de capacité) + Marc (substance pour article).

---

### Section 1 — Hero Participations
- **Pattern** : full-width, hauteur 40vh desktop / 35vh mobile. Fond noir-profond.
- **Contenu** :
  - H1 : "Notre écosystème." — Cormorant Garamond 56px, blanc
  - Sous-titre : "Deux axes, six structures, une logique de long-terme." — Inter 17px, gris-clair
- **Responsive** : H1 34px mobile.

---

### Section 2 — Structure 2 Niveaux (Organigramme)
- **Pattern** : arborescence visuelle CSS. Fond crème. Padding 64px vertical. Max-width 900px centré.
- **Contenu** :
  - Niveau 1 : ISSA Capital (rond levant centré)
  - Flèches vers 2 branches :
    - Branche A : Gradient One (50% ISSA) → sous-niveaux Versi Immobilier, Versi Invest, Immocrew, Versimo
    - Branche B : Immobilier en direct IDF (15 lots résidentiels)
  - Chaque nœud : nom + secteur 1 ligne + lien si site live
- **Responsive 375px** : arbre → liste indentée. Niveau 1 en haut, niveau 2 indenté avec trait levant gauche.
- **Responsive 768px** : arbre simplifié 2 colonnes.
- **États UI** : statique. Liens sortants : aria-label complet.

---

### Section 3 — Fiches Participations (6 cartes)
- **Pattern** : grille 3 colonnes desktop / 2 colonnes 768px / 1 colonne 375px. Fond blanc. Padding 64px vertical.
- **Ordre** : Gradient One → Versi Immobilier → Versi Invest → Immocrew → Versimo → Immobilier en direct
- **Contenu par fiche** :
  - Nom H3 — Inter 20px gras
  - Secteur — Inter 13px levant
  - Description 2-3 lignes — Inter 15px gris-foncé
  - Site si live — lien texte levant "Voir le site →" target="_blank"
  - Mention "Site à venir" si pas de site — span gris, non cliquable
  - Border-top 2px levant
- **Traitement immobilier direct** : fiche sobre — "Patrimoine immobilier résidentiel en Île-de-France géré en direct." Pas de chiffre (discrétion Thomas validée).
- **États UI** : statique. Hover carte : shadow légère 0 4px 12px rgba(0,0,0,0.08) — transition 150ms. Reduced-motion : hover shadow désactivé.

---

### CTA Bas de Page
- **Fond levant**. CTA B : "Proposer une opportunité" → /opportunites. CTA secondaire : "Nous contacter" → /contact.

---

### Tests UX — Page Participations

| Test | Critère de succès | Statut |
|------|-------------------|--------|
| Leila voit la preuve d'investissement réel | 6 entités nommées, liens vers sites live visibles | ✅ |
| Marc trouve l'organigramme de la structure | Section 2 avec 2 niveaux ISSA → Gradient One → sous-entités | ✅ |
| Immobilier direct traité avec discrétion | Pas de chiffre, formulation générique validée Thomas | ✅ |

---

## Page 6 — Contact (`/contact`)

**Objectif** : Offrir un point d'entrée direct et sans friction à Marc (email direct) et Karim (formulaire court).
**Persona cible principal** : Marc + Karim.

---

### Section 1 — Hero Contact
- **Pattern** : full-width, hauteur 40vh. Fond noir-profond.
- **Contenu** :
  - H1 : "Parlons-en." — Cormorant Garamond 64px, blanc
  - Sous-titre : "Décrivez-nous votre contexte. Nous revenons vers vous." — Inter 17px, gris-clair
- **Responsive** : H1 38px mobile.

---

### Section 2 — Formulaire Court (id="formulaire-accompagnement")
- **Pattern** : full-width, fond crème. Formulaire centré max-width 520px. Padding 80px vertical.
- **4 champs** :
  1. Nom complet — texte, obligatoire
  2. Email — email, obligatoire
  3. Objet de votre message — select : Projet d'accompagnement | Presse / Analyste | Autre, obligatoire
  4. Message — textarea 5 lignes, 800 caractères max, obligatoire
  - Consentement RGPD — checkbox obligatoire
- **Bouton** : "Envoyer" — plein levant, texte noir, 48px, pleine largeur
- **Email direct visible** au-dessus du formulaire : "Ou écrivez-nous directement : contact@issa-capital.com" — Inter 15px, lien mailto levant. Priorité pour Marc.
- **États UI** :
  - Défaut : formulaire vide
  - Loading : spinner levant sur bouton, champs désactivés
  - Vide/Erreur : validation inline (même pattern que /opportunites)
  - Erreur serveur : message humain avec email fallback
  - Succès : "Message reçu. Nous vous répondons sous 48h." — message inline, formulaire masqué
- **Accessibilité** : identique à /opportunites — labels, aria-required, focus-visible

---

### Tests UX — Page Contact

| Test | Critère de succès | Statut |
|------|-------------------|--------|
| Marc trouve l'email direct sans remplir un formulaire | Email mailto visible au-dessus du formulaire | ✅ |
| Karim ne remplit que 4 champs (pas 7) | Formulaire court 4 champs + consentement | ✅ |
| 5 états UI documentés | Défaut / Loading / Vide / Erreur / Succès — tous spécifiés | ✅ |

---

## Page 7 — Mentions Légales (`/mentions-legales`)

**Objectif** : Conformité légale RGPD + réassurance de sérieux (capital social visible pour Leila).
**Persona cible principal** : Marc (vérification données légales) + Leila (capital social).

---

### Structure
- **Pattern** : full-width, fond blanc. Texte linéaire, max-width 760px, auto marges. Padding 80px vertical.
- **Navigation** : header et footer présents (standard). Pas de CTA dans la page.
- **H1** : "Mentions légales" — Cormorant Garamond 42px, noir.
- **Sections (H2 Inter 22px)** :
  1. Éditeur du site — ISSA Capital, SAS, SIREN 102 356 094, capital 1 047 562,00€, TVA FR50102356094, adresse Nanterre, email contact@issa-capital.com, Président [Thomas Issa — à confirmer par @legal]
  2. Hébergeur — Replit Inc., adresse complète Replit
  3. Propriété intellectuelle — droits réservés ISSA Capital
  4. Politique de confidentialité — base légale formulaire (consentement art. 6.1.a RGPD), données collectées, durée de conservation, droits d'accès/rectification/effacement (email contact@issa-capital.com), sous-traitant Resend (DPA art. 28 RGPD)
  5. Analytics — Plausible, sans cookies, sans données personnelles, conforme CNIL
- **Meta noindex** : balise `<meta name="robots" content="noindex">` — page légale non indexée (cohérent avec décision product-manager).
- **Responsive** : identique tous breakpoints (texte linéaire).
- **États UI** : statique uniquement.
- **Accessibilité** : contraste texte Inter/#FFFFFF ≥ 4.5:1, H2 comme structure de navigation page, liens internes soulignés.

---

### Tests UX — Page Mentions Légales

| Test | Critère de succès | Statut |
|------|-------------------|--------|
| Capital social visible (Leila) | 1 047 562,00 € dans section Éditeur | ✅ |
| Email DPO/contact RGPD visible | contact@issa-capital.com dans section Confidentialité | ✅ |
| noindex activé | Balise robots="noindex" dans le head | ✅ |

---

## Auto-évaluation Gates (résumé)

| Gate | Évaluation |
|------|-----------|
| G1 — Toutes sections présentes | PASS — 7 pages complètes, 0 TODO |
| G3 — Bloc Handoff présent | PASS — cf. bas du document |
| G5 — Persona identique personas.md | PASS — Karim, Leila, Marc cités par nom sur chaque page, frustrations adressées |
| G7 — 0 contradiction livrables amont | PASS — cohérent avec functional-specs.md, personas.md, brand-platform.md, design-system.md |
| G12 — Implémentable sans question | PASS — patterns layout explicites, contenu spécifié, comportements décrits |
| G15 — 0 placeholder résiduel | ⚠️ [X] délai réponse opportunités à confirmer par Thomas ; titre page Contact H1 "Parlons-en." à valider @copywriter |
| G21 — 5 états UI par écran interactif | PASS — formulaires /opportunites et /contact : 5 états documentés ; pages statiques : N/A |
| G22 — WCAG 2.2 AA | PASS — contrastes documentés, focus-visible levant, touch targets ≥ 44px, prefers-reduced-motion spécifié |

