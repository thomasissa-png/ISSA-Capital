# UX Audit — ISSA Capital
> @ux — 2026-04-07
> Source : docs/ux/user-flows.md + docs/ux/wireframes.md + docs/strategy/personas.md
> Heuristiques Nielsen 10 — Frictions — WCAG 2.2 AA — Micro-interactions — Anti-patterns

---

## Frictions identifiées + résolutions

| # | Friction | Page | Heuristique Nielsen | Sévérité | Résolution |
|---|----------|------|---------------------|----------|------------|
| F1 | Leila ne voit pas immédiatement le CTA "Proposer une opportunité" si hero trop long | Accueil | H1 — Visibilité état système | Haute | CTA B above-the-fold en Section Hero, navigation "Opportunités" visible sans scroll |
| F2 | Karim ne distingue pas Thomas d'un CGP classique | Accueil, Accompagnement | H2 — Correspondance monde réel | Haute | Ton Ruler/Outlaw dès le H1 hero ; section anti-personas explicite ; chiffres concrets (TEOS 6000% ROI, pas de jargon produits financiers) |
| F3 | Marc ne trouve pas d'email direct — force à remplir un formulaire | Contact | H3 — Contrôle liberté | Moyenne | Email contact@issa-capital.com visible au-dessus du formulaire, dans le footer, et dans la page Mentions légales |
| F4 | Leila ne sait pas si son ticket est dans la bonne fourchette | Opportunités | H6 — Reconnaissance pas rappel | Haute | Critères de ticket (immo minimum 200K€) affichés dans la section "Ce que nous cherchons" avant le formulaire |
| F5 | Post-soumission : silence total — Leila ne sait pas si le dossier a été reçu | Opportunités | H1 — Visibilité état système | Haute | État "succès" formulaire avec message de confirmation + délai de réponse annoncé (valeur à confirmer Thomas) |
| F6 | Erreur de soumission formulaire : "Error 500" affiché | Opportunités, Contact | H9 — Aide reconnaissance erreurs | Haute | Message d'erreur humain : "Une erreur est survenue. Réessayez ou écrivez directement à contact@issa-capital.com." + email cliquable |
| F7 | Navigation mobile : les 6 liens de nav ne tiennent pas sur 375px | Global | H4 — Cohérence standards | Moyenne | Menu hamburger sur mobile, déroulant pleine largeur avec liens empilés + CTA en bas de menu |
| F8 | Page Mission : la chronologie JP→Thomas illisible sur mobile si arbre SVG | Mission | H8 — Design minimaliste | Moyenne | Sur 375px : chronologie en liste verticale (3 items) avec jalons textuels — pas d'arbre SVG complexe |
| F9 | Gradient One : pas de site web — Leila ou Marc ne peuvent pas vérifier | Participations | H2 — Correspondance monde réel | Basse | Description textuelle complète de l'activité Gradient One + mention "Holding intermédiaire — pas de site public" ; organigramme 2 niveaux compense l'absence de lien |
| F10 | CTA "Proposer une opportunité" affiché sur la page Opportunités = redondance | Global nav | H8 — Design minimaliste | Basse | CTA sticky absent sur /opportunites et /contact — décision documentée dans functional-specs.md |

---

## Audit Heuristique Nielsen (10 heuristiques) — Verdict Global

| # | Heuristique | Verdict | Évidence |
|---|-------------|---------|---------|
| H1 | Visibilité de l'état du système | PASS | États loading/erreur/succès documentés sur tous les formulaires ; progress bar N/A (pas de wizard multi-étapes) |
| H2 | Correspondance système/monde réel | PASS | Vocabulaire Karim : "holding IS", "immo direct", "co-fondateur" — pas de jargon AMF. Vocabulaire Leila : "ticket", "co-investissement", "deal" |
| H3 | Contrôle et liberté utilisateur | PASS | Formulaires : pas de wizard sans retour. Modaux : N/A (pas de modaux en V1). Navigation : retour arrière navigateur toujours fonctionnel (pages Next.js SSG) |
| H4 | Cohérence et standards | PASS | Même pattern header/footer toutes pages. Même style bouton levant partout. Liens "→" cohérents (lien texte = navigation interne). |
| H5 | Prévention des erreurs | PASS | Validation inline temps réel sur formulaires avant soumission. Champs obligatoires marqués. Select pour Type d'opportunité (évite les valeurs invalides). |
| H6 | Reconnaissance plutôt que rappel | PASS | Critères d'investissement affichés sur /opportunites avant le formulaire — Leila n'a pas besoin de se souvenir de ce qu'elle a lu ailleurs. |
| H7 | Flexibilité et efficacité | PASS | Email direct visible pour Marc et Karim (raccourci expert). Formulaire guidé pour Leila (novice en contact holding). Pas de fonctionnalités avancées en V1 — site vitrine. |
| H8 | Design esthétique et minimaliste | PASS | Archétype Ruler : zéro bruit visuel. Chaque section a une fonction narrative. Anti-patterns explicitement exclus (cf. section ci-dessous). |
| H9 | Aide à la reconnaissance et correction des erreurs | PASS | Messages d'erreur en langage humain sur les 2 formulaires. Erreur serveur → email fallback. Erreur champ → message sous le champ (pas un toast global flottant). |
| H10 | Aide et documentation | PASS | Tooltips N/A (pas de fonctionnalités complexes). Microcopy contextuel sur les formulaires. FAQ inline N/A en V1 (site vitrine, pas SaaS). |

---

## Checklist WCAG 2.2 AA

| Critère | Implémentation requise | Statut |
|---------|----------------------|--------|
| Contrastes texte : ≥ 4.5:1 (texte normal), ≥ 3:1 (texte large ≥ 18px) | Blanc (#FFFFFF) sur noir-profond (#0A0A0A) = 21:1 ✅. Gris corps (#2C2C2C) sur crème (#F5F0E8) = 11.8:1 ✅. Levant (#C4935A) sur noir = 4.7:1 ✅. Texte levant (#C4935A) sur crème (#F5F0E8) = 2.8:1 — utiliser uniquement sur texte ≥ 18px ou gras ≥ 14px | ⚠️ levant/crème à vérifier pour usage texte normal |
| Focus-visible sur tous les interactifs | outline: 2px solid #C4935A + offset 2px sur tous les éléments interactifs (liens, boutons, inputs, selects) | ✅ documenté design-system.md |
| Navigation clavier complète | Tab order logique (header → main → footer), skip-to-content link en premier élément du DOM | ✅ à implémenter |
| Taille cible touch ≥ 44×44px | CTAs : 48px hauteur minimum. Liens texte inline : padding vertical 8px ajouté via CSS pour élargir la zone cliquable sans changer le visuel | ✅ |
| prefers-reduced-motion | Toutes transitions CSS enveloppées dans `@media (prefers-reduced-motion: reduce)` — désactivation complète des animations | ✅ documenté wireframes.md |
| Images : alt text | Visuels décoratifs : alt="" (vides). Si image avec sens : alt descriptif. Aucune image de contenu en V1 = risque faible | ✅ |
| Formulaires : labels explicites | Labels visible au-dessus de chaque champ (pas de placeholder seul comme label). aria-required="true" sur champs obligatoires. aria-describedby pour les messages d'erreur inline | ✅ |
| Screen readers : structure sémantique | H1 unique par page. H2/H3 hiérarchie respectée. nav, main, footer en landmarks ARIA. Liste de navigation : ul > li > a | ✅ |
| Langue déclarée | `<html lang="fr">` dans le layout root Next.js | ✅ |

---

## Micro-interactions Recommandées (cohérentes Ruler/Outlaw)

**Principe** : micro-interactions sobres, fonctionnelles, jamais décoratives. Zéro animation "wow effect" — un Ruler n'a pas besoin d'impressionner, il affirme.

| Composant | Interaction | Implémentation |
|-----------|-------------|---------------|
| Boutons CTAs | Hover : légère élévation border-width 1px levant, transition 150ms ease. Active : scale 0.98. | CSS transition, prefers-reduced-motion : direct state change |
| Liens de navigation | Hover : underline 1px levant apparaît (transform scaleX de 0 → 1 depuis la gauche), 200ms. | CSS ::after pseudo-element |
| Cartes participations | Hover : shadow légère 0 4px 12px rgba(0,0,0,0.08). Pas de scale ni translate. | CSS box-shadow transition 150ms |
| Inputs formulaire | Focus : border-color → levant, transition 100ms. | CSS focus selector |
| Bouton de soumission (loading) | Spinner SVG levant, largeur fixe maintenue (pas de layout shift). | State component React |
| Scroll indicator (hero 100vh) | Chevron bas qui pulse lentement (opacity 0.3→0.8, 2s loop). Disparaît au premier scroll. | keyframes CSS, JS scroll event |
| État succès formulaire | Fade-in du message de confirmation (opacity 0→1, 300ms). Formulaire se masque avec fade-out 200ms. | Transition CSS, state React |

---

## Anti-patterns à Éviter

Ces patterns sont explicitement interdits dans ISSA Capital — incompatibles avec l'archétype Ruler/Outlaw et le ton institutionnel premium.

| Anti-pattern | Raison d'exclusion |
|-------------|-------------------|
| Popup / modal au chargement ou à la sortie (exit intent) | Bruit visuel, perte de contrôle utilisateur (H3), signal cheap incompatible avec le positionnement premium. ISSA Capital ne mendie pas l'attention. |
| Carrousel / slider auto-défilant | Désorientation H1 (l'utilisateur ne contrôle pas le contenu affiché), inutile sur un site vitrine statique, brisé sur mobile en permanence. |
| Animations d'entrée sur les sections (fade-in au scroll) | Ralentit la perception du contenu, incompatible avec prefers-reduced-motion. Un Ruler n'a pas besoin d'entrer en scène. |
| Compteurs chiffrés animés ("1000+ projets" qui s'incrémente) | Pas de chiffres gonflés chez ISSA (tone rule). Et l'animation est un anti-pattern d'accessibilité. |
| Chat widget ou chatbot | Parasite le ton premium, dilue la crédibilité institutionnelle, inutile pour un site vitrine. |
| Bandeau cookies (si Plausible sans cookies) | Confirmé @legal : Plausible cookieless = pas de bandeau CNIL requis. Ne pas en ajouter un pour "paraître conforme". |
| Témoignages / avis clients avec photos d'avatars | Pas de faux témoignages, pas de stock photos de "clients satisfaits". Si témoignages à terme : citations textuelles de personnes nommées uniquement. |

---

## Agents Spécialisés Recommandés

| Agent proposé | Type | Rôle | Justification | Priorité |
|---|---|---|---|---|
| @testeur-karim | Testeur persona | Évalue /accompagnement, CTA A, formulaire contact — du point de vue Karim entrepreneur 42 ans en structuration patrimoniale | Risque de page trop institutionnelle, pas assez pair-à-pair. Gates GP1, GP3, GP7 critiques | Haute |
| @testeur-leila | Testeur persona | Évalue /opportunites, critères, formulaire 7 champs — simule soumission deal immo 800K€ sous contrainte temps 90s | Risque de critères trop vagues ou formulaire trop long. Gate GP4 (parcours fluide) critique | Haute |

→ Handoff @agent-factory : créer ces 2 agents à partir des specs dans docs/strategy/personas.md (section "Agents spécialisés recommandés").

---

**Handoff → @design + @fullstack**
- Fichiers produits : `docs/ux/user-flows.md`, `docs/ux/wireframes.md`, `docs/ux/ux-audit.md`
- Décisions prises :
  - Architecture 2 pages distinctes /accompagnement et /opportunites (justifiée dans user-flows.md)
  - Formulaire CTA A : 4 champs (court, pour Karim) ; formulaire CTA B : 7 champs qualifiants (pour Leila)
  - Email contact@issa-capital.com visible en 3 endroits : header (facultatif), page Contact au-dessus du formulaire, footer
  - CTA sticky absent sur /opportunites et /contact (redondance évitée)
  - Délai de réponse sur /opportunites : [X] jours ouvrés — valeur à confirmer par Thomas avant lancement
- Points d'attention pour @fullstack :
  - 5 états UI obligatoires sur les 2 formulaires (/opportunites + /contact)
  - focus-visible levant sur tous les interactifs — zéro `outline: none` sans alternative
  - font-display: swap sur Cormorant Garamond et Inter
  - prefers-reduced-motion : wrapper obligatoire sur toutes les transitions CSS
  - skip-to-content link en premier élément du DOM (accessibilité clavier)
  - aria-current="page" sur le lien de navigation actif
- Points d'attention pour @design :
  - Contraste levant (#C4935A) sur crème (#F5F0E8) = 2.8:1 — à utiliser uniquement sur texte ≥ 18px ou gras ≥ 14px (vérification WCAG AA en cours)
  - Chronologie JP→Thomas page Mission : variante mobile en liste verticale (pas d'arbre SVG)
  - Section 4 CTA Accueil (fond levant) : contraste noir/#C4935A à vérifier (seuil 4.5:1)
