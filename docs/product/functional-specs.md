# Functional Specs — ISSA Capital
> @product-manager — 2026-04-07
> Source : project-context.md (Phase 0 validée) + product-vision.md
> [PROVISOIRE — à enrichir quand brand-platform.md et personas.md seront disponibles]

---

## Résumé exécutif

- **Objectif** : Spécifications fonctionnelles des 6 pages V1 du site vitrine ISSA Capital
- **Décisions clés** : CTA unique convergent vers formulaire Opportunités, parcours pensé pour Hélène (PME), conformité RGPD allégée (Plausible sans cookies)
- **Dépendances** : @ux (wireframes depuis ces specs), @fullstack (implémentation), @qa (matrice de traçabilité US → tests)

---

## Numérotation des user stories

Format : US-01 à US-XX — numérotation séquentielle transversale aux 6 pages.
Chaque US doit avoir un test correspondant dans la matrice de traçabilité @qa (gate G27).

---

## Pages V1

1. [Page 1 — Accueil](#page-1--accueil)
2. [Page 2 — Mission & Philosophie](#page-2--mission--philosophie)
3. [Page 3 — Participations](#page-3--participations)
4. [Page 4 — Opportunités d'investissement](#page-4--opportunités-dinvestissement)
5. [Page 5 — Contact](#page-5--contact)
6. [Page 6 — Mentions légales + Politique de confidentialité](#page-6--mentions-légales--politique-de-confidentialité)

---

## Composants transversaux

### Navigation principale (présente sur toutes les pages)

**Structure :**
- Logo ISSA Capital (lien vers Accueil)
- Liens : Mission | Participations | Opportunités | Contact
- CTA sticky : "Proposer une opportunité" → ancre vers formulaire page Opportunités
- Responsive : menu hamburger sur mobile (breakpoint Tailwind md = 768px)

**Comportement :**
- Lien actif : classe CSS `active` sur le lien de la page courante
- Sur scroll : navbar devient légèrement opaque (backdrop-blur) — à confirmer avec @design
- CTA "Proposer une opportunité" : visible sur toutes les pages sauf page Contact et page Opportunités (où il est redondant avec le formulaire visible)

### Footer (présent sur toutes les pages)

**Contenu :**
- Nom : ISSA Capital
- Statut juridique : SAS — SIREN 102 356 094
- Adresse : 54 Rue Henri Barbusse, 92000 Nanterre
- Liens : Mission | Participations | Opportunités | Contact | Mentions légales | Politique de confidentialité
- Droits réservés : © [année courante] ISSA Capital — Tous droits réservés
- Lien Plausible analytics : conforme RGPD (pas de bandeau cookies obligatoire si Plausible sans cookies)

**Note @fullstack :** l'année dans le footer doit être générée dynamiquement (`new Date().getFullYear()`).

### Composant Formulaire de contact (réutilisé pages Opportunités et Contact)

Voir US-10 et US-11 pour les specs détaillées. Le composant est identique sur les deux pages avec une variante de heading.

---

## Page 1 — Accueil

### Objectif

Poser l'identité d'ISSA Capital en moins de 10 secondes et orienter Hélène vers la page Opportunités.

### Audience prioritaire

Hélène (persona principal) + Sophie (persona secondaire) — première impression pour des visiteurs qui ne connaissent pas la holding.

### Sections obligatoires

1. **Hero** — promesse principale, signature de marque, CTA primaire
2. **Chapeau mission** — résumé de la mission en 2-3 lignes, lien vers page Mission
3. **Écosystème en aperçu** — présentation visuelle condensée des 6 participations, lien vers page Participations
4. **Philosophie différenciante** — les 3 filtres de décision (patrimoine long-terme, éthique humaine, environnement) — positionnement vs fonds LBO
5. **CTA de conversion** — bloc final invitant à proposer une opportunité

### Contenu attendu par section

**Section Hero :**
- Headline : à rédiger par @copywriter — doit intégrer les mots Famille / Transmission / Long-terme et l'identité libanaise
- Sous-titre : reformulation de la promesse officielle "La holding patrimoniale d'une famille libanaise qui investit pour les générations à venir, dans des projets qu'elle peut transmettre fièrement."
- CTA primaire : "Proposer une opportunité d'investissement" → /opportunites#formulaire
- Image/visuel : aucune photo de famille (vie privée). Illustration ou image libre premium symbolisant transmission/architecture/pérennité — à sélectionner par @design

**Section Chapeau mission :**
- Texte court (3-4 lignes max) : reformulation de la mission officielle
- Lien secondaire : "Notre mission →" → /mission
- Données statiques (pas de dynamique)

**Section Écosystème en aperçu :**
- 6 entités : Gradient One | Versi Immobilier | Versi Invest | Immocrew | Versimo | Immobilier en direct
- Par entité : nom + secteur en 1 ligne + lien vers site si disponible (immocrew.fr, versimo.fr, gradientone.fr)
- CTA : "Voir toutes les participations →" → /participations
- Données : statiques (gérées dans le code ou un fichier de config JSON)

**Section Philosophie différenciante :**
- 3 blocs : Patrimoine long-terme | Éthique humaine | Préservation de l'environnement
- Chaque bloc : icône ou chiffre + titre + 1-2 lignes explicatives
- Pas de CTA — section de conviction pure

**Section CTA de conversion :**
- Titre : appel à action pour fondateurs de PME (à rédiger @copywriter)
- Sous-titre : réassurance ("Nous lisons chaque proposition")
- CTA : "Proposer une opportunité" → /opportunites#formulaire

### États UI

| État | Section concernée | Comportement |
|---|---|---|
| Défaut | Toutes sections | Page statique, chargement immédiat |
| Loading | Entête navigation | Skeleton léger si police web lente (FOUT prévenu par font-display: swap) |
| Vide | N/A — page entièrement statique | N/A |
| Erreur | N/A — pas de données dynamiques | Erreur 404 si URL invalide → page 404 dédiée |
| Succès | N/A | N/A — page de consultation pure |

### CTAs

- **CTA primaire** : "Proposer une opportunité d'investissement" (Hero + section finale) → /opportunites#formulaire
- **CTA secondaire** : "Notre mission →" → /mission | "Voir les participations →" → /participations

### Liens

- Internes : /mission, /participations, /opportunites#formulaire
- Sortants : immocrew.fr, versimo.fr, gradientone.fr (target="_blank" rel="noopener noreferrer")

### Contraintes SEO

- `<title>` : "ISSA Capital — Holding patrimoniale familiale | Investissement long-terme"
- `<meta name="description">` : "ISSA Capital est la holding patrimoniale d'une famille libanaise. Nous investissons dans des projets durables et les transmettons aux générations à venir."
- `<h1>` : Un seul h1 — dans la section Hero — à valider avec @copywriter
- Balises Open Graph : og:title, og:description, og:image (à définir par @design)
- Pas de données structurées en V1 (holding non commerçante)

### Contraintes RGPD

- Aucune collecte de données sur cette page
- Plausible analytics : script sans cookies → pas de bandeau obligatoire

---

### User Stories — Page Accueil

#### US-01 : Comprendre l'identité d'ISSA Capital en première visite

**Persona** : Hélène (fondatrice PME)
**Epic** : Découverte et premier contact
**Dépendances** : Aucune
**Priorité RICE** : R=100 I=10 C=9 E=1 → Score=900

**Job-to-be-done**
En tant qu'Hélène, je veux comprendre en moins de 10 secondes qui est ISSA Capital et ce qu'elle fait, afin de décider si la holding est pertinente pour mon projet de cession/adossement.

**Contexte de navigation**
- Page/écran d'origine : résultat de recherche Google ou lien direct
- Déclencheur : visite directe sur issa-capital.com
- Page/écran de destination (succès) : Hélène reste sur la page et fait défiler vers les sections suivantes, ou clique sur un CTA
- Page/écran de destination (échec) : Hélène quitte immédiatement (bounce)

**Données et champs**
| Champ | Type | Obligatoire | Validation | Limites | Exemple |
|---|---|---|---|---|---|
| N/A — page de consultation pure | — | — | — | — | — |

**5 états UI**
| État | Comportement | Message/Affichage |
|---|---|---|
| Défaut | Page statique chargée, hero visible au-dessus du fold | Headline + sous-titre + CTA primaire visibles sans scroll |
| Loading | Police web en cours de chargement | font-display: swap — texte visible avec font-system en fallback, pas de FOUT bloquant |
| Vide | N/A — contenu entièrement statique | N/A |
| Erreur | Erreur réseau ou page non trouvée | Page 404 dédiée avec lien retour Accueil |
| Succès | Page chargée, contenu visible | Tout le contenu au-dessus du fold visible en <2s |

**Critères d'acceptance**

Happy path :
- [ ] GIVEN un visiteur arrive sur issa-capital.com WHEN la page se charge THEN le hero est visible au-dessus du fold (sans scroll) sur desktop (1280px) et mobile (375px)
- [ ] GIVEN le hero est affiché WHEN le visiteur lit le headline et le sous-titre THEN les mots "famille libanaise" ET "transmission" ET "long-terme" (ou équivalents sémantiques validés par @copywriter) apparaissent dans la section visible sans scroll
- [ ] GIVEN le visiteur fait défiler la page THEN les 5 sections (Hero, Chapeau mission, Écosystème, Philosophie, CTA final) sont toutes présentes et lisibles

Cas d'erreur :
- [ ] GIVEN une erreur réseau WHEN le visiteur arrive sur issa-capital.com THEN le navigateur affiche l'erreur standard (hors contrôle du site)
- [ ] GIVEN une URL invalide (ex: issa-capital.com/xxx) WHEN le visiteur arrive THEN une page 404 personnalisée s'affiche avec un lien retour vers l'accueil

Cas limites :
- [ ] GIVEN le visiteur utilise un mobile 375px WHEN la page se charge THEN le CTA "Proposer une opportunité" est visible et cliquable sans zoom (touch target >= 44x44px)
- [ ] GIVEN le visiteur désactive JavaScript WHEN la page se charge THEN le contenu statique reste lisible (Next.js SSR/SSG garantit le rendu sans JS)
- [ ] GIVEN le visiteur a une connexion 3G lente WHEN la page se charge THEN le LCP (Largest Contentful Paint) est <2.5s (hébergement Replit — à valider par @infrastructure)

Permissions :
- [ ] GIVEN tout visiteur non authentifié WHEN il accède à issa-capital.com THEN la page est accessible sans authentification

Données existantes :
- [ ] GIVEN que les noms des participations changent (ex: renommage d'une entité) WHEN le code est mis à jour THEN la section Écosystème en aperçu reflète les nouveaux noms sans régression sur les autres sections

**Payload API** : N/A — page statique, pas d'appel API

**Events analytics**
| Event | Trigger | Propriétés | Funnel |
|---|---|---|---|
| page_view | Chargement de la page Accueil | url, referrer, device_type | acquisition |
| cta_click | Clic sur "Proposer une opportunité" (Hero) | cta_location=hero, destination=/opportunites | activation |
| cta_click | Clic sur "Notre mission →" | cta_location=chapeau, destination=/mission | activation |
| cta_click | Clic sur "Voir les participations →" | cta_location=ecosysteme, destination=/participations | activation |
| scroll_depth | Scroll 50% et 100% de la page | scroll_pct=50 / 100 | activation |

**Scénarios persona concrets**

1. Hélène cherche "holding patrimoniale familiale France" sur Google un mardi matin. Elle clique sur le résultat issa-capital.com. En 5 secondes, elle voit le headline avec "famille libanaise" et "générations à venir". Elle se dit "c'est différent d'un fonds". Elle fait défiler pour en savoir plus.
2. Sophie, avocate M&A, reçoit le nom "ISSA Capital" dans un email d'un client. Elle tape l'URL directement. La page charge en moins de 2 secondes, elle voit le CTA "Proposer une opportunité" — elle comprend que c'est une structure qui investit activement.
3. Marc, journaliste, arrive via LinkedIn après avoir vu un post de Thomas Issa. Il cherche des informations factuelles sur la holding. Il fait défiler et trouve la section Écosystème avec les 6 entités nommées. Il note l'URL gradientone.fr et immocrew.fr pour les consulter.
4. Hélène revient sur le site 3 jours après sa première visite. La page est identique (site statique). Elle clique directement sur "Proposer une opportunité" sans relire le hero.
5. Un visiteur mobile (iPhone 13, 375px) arrive sur le site via un partage WhatsApp. La page s'affiche correctement en responsive. Le CTA est accessible du pouce en bas d'écran.

**Definition of Done (@fullstack)**
- [ ] UI implémentée conforme aux 5 états
- [ ] Toutes les sections présentes et ordonnées
- [ ] CTA primaire et secondaires fonctionnels (liens corrects)
- [ ] Responsive validé sur 375px / 768px / 1280px
- [ ] LCP <2.5s mesuré
- [ ] Screenshot conforme au design

**Notes @qa** : tester le scroll depth tracking Plausible (events custom). Tester le rendu SSR sans JavaScript. Tester les touch targets mobile (44x44px minimum).

**Notes @ux** : le hero doit être above-the-fold sur tous les breakpoints. Le CTA primaire doit être visible sans scroll sur mobile 375px. Tester le contraste texte/fond (WCAG 2.2 AA).

**Notes @fullstack** : page entièrement statique (SSG). Données des participations dans un fichier de config (src/data/participations.ts) pour faciliter les mises à jour sans modifier les composants.

---

#### US-02 : Naviguer vers la page Opportunités depuis l'Accueil

**Persona** : Hélène (fondatrice PME)
**Epic** : Découverte et premier contact
**Dépendances** : US-01 (page Accueil doit exister), US-10 (page Opportunités avec formulaire)
**Priorité RICE** : R=100 I=10 C=9 E=1 → Score=900

**Job-to-be-done**
En tant qu'Hélène, je veux cliquer sur le CTA "Proposer une opportunité" depuis la page d'accueil afin d'accéder directement au formulaire de proposition sans friction.

**Contexte de navigation**
- Page/écran d'origine : Accueil (issa-capital.com)
- Déclencheur : clic sur CTA "Proposer une opportunité d'investissement" (Hero ou section finale)
- Page/écran de destination (succès) : Page Opportunités (/opportunites), avec scroll automatique vers l'ancre #formulaire
- Page/écran de destination (échec) : erreur de navigation → page 404 ou rechargement Accueil

**Données et champs** : N/A — navigation pure

**5 états UI** : N/A — transition de navigation (voir états UI US-10 pour la destination)

**Critères d'acceptance**

Happy path :
- [ ] GIVEN Hélène est sur la page Accueil WHEN elle clique sur "Proposer une opportunité d'investissement" (Hero) THEN elle est redirigée vers /opportunites avec scroll automatique sur l'ancre #formulaire en <500ms
- [ ] GIVEN Hélène est sur la page Accueil WHEN elle clique sur "Proposer une opportunité" (section CTA finale) THEN même comportement que ci-dessus
- [ ] GIVEN la navigation principale est affichée WHEN Hélène clique sur "Opportunités" dans le menu THEN elle est redirigée vers /opportunites (sans ancre — haut de page)

Cas d'erreur :
- [ ] GIVEN une erreur de routage Next.js WHEN le CTA est cliqué THEN Hélène reste sur la page courante et l'erreur est loggée côté serveur (pas de page blanche)

Cas limites :
- [ ] GIVEN Hélène est sur mobile 375px WHEN elle clique sur le CTA sticky en navigation THEN le scroll vers #formulaire fonctionne correctement (pas de décalage dû à la navbar sticky)
- [ ] GIVEN Hélène utilise le bouton "Retour" du navigateur depuis /opportunites THEN elle revient sur l'Accueil sans erreur

Permissions :
- [ ] GIVEN tout visiteur WHEN il clique sur le CTA THEN la navigation est accessible sans authentification

Données existantes :
- [ ] GIVEN le slug de la page Opportunités change (/investissements au lieu de /opportunites) WHEN le CTA est cliqué THEN un redirect 301 est configuré pour éviter un 404

**Payload API** : N/A

**Events analytics**
| Event | Trigger | Propriétés | Funnel |
|---|---|---|---|
| cta_click | Clic CTA Hero "Proposer une opportunité" | source=accueil_hero | activation |
| cta_click | Clic CTA section finale | source=accueil_cta_final | activation |

**Scénarios persona concrets**

1. Hélène a lu le hero et est convaincue. Elle clique sur le CTA primaire. La page Opportunités s'ouvre et le formulaire est visible dans les 2 premières secondes.
2. Hélène fait défiler la page entière et clique sur le CTA de la section finale. Même résultat.
3. Sophie navigue depuis la navbar : elle clique sur "Opportunités" dans le menu. Elle arrive en haut de la page Opportunités, pas directement sur le formulaire.
4. Un visiteur mobile clique sur le CTA visible dans la navbar sticky. L'ancre #formulaire déroule correctement malgré la navbar fixe en haut.
5. Un visiteur clique sur le CTA, attend 3 secondes, puis appuie sur "Retour" dans son navigateur. Il revient sur l'Accueil sans erreur.

**Definition of Done (@fullstack)**
- [ ] Liens CTA corrects (/opportunites#formulaire)
- [ ] Scroll comportement ancre testé avec navbar sticky
- [ ] Redirect 301 configuré si slug change
- [ ] Test E2E : clic CTA → landing formulaire visible

**Notes @qa** : scénario de régression si la page /opportunites est renommée. Tester le scroll ancre sur mobile et desktop.

**Notes @fullstack** : utiliser `<Link href="/opportunites#formulaire">` Next.js. Vérifier que l'ancre `id="formulaire"` existe bien dans le composant page Opportunités.

---

## Page 2 — Mission & Philosophie

### Objectif

Expliquer QUI est la famille Issa, POURQUOI elle a créé ISSA Capital, et COMMENT elle prend ses décisions d'investissement — pour convaincre Hélène que c'est un partenaire sur le long-terme, pas un fonds.

### Audience prioritaire

Hélène (persona principal) — Hélène est arrivée sur le site, elle a vu l'accroche, elle veut creuser l'identité et les valeurs avant de proposer son entreprise.

### Sections obligatoires

1. **Titre de page + chapeau** — qui est ISSA Capital en 2-3 phrases
2. **Histoire et identité familiale** — la famille libanaise, l'ancrage en France, la double culture comme asset
3. **La mission** — formulation officielle verrouillée + explication en langage humain
4. **Les filtres de décision** — les 3 valeurs (patrimoine long-terme, éthique humaine, environnement) comme critères de sélection des investissements, pas comme finalité
5. **Hiérarchie de décision** — Famille > Transmission > Filtres — distinction explicite Mission vs Valeurs
6. **CTA de sortie** — invitation à voir les participations ou à proposer une opportunité

### Contenu attendu par section

**Section Histoire et identité :**
- Texte éditorial (3-5 paragraphes) — à rédiger par @copywriter
- Doit inclure : identité libanaise de la famille, création de la SAS en France en 2026, intention fondatrice (patrimoine intergénérationnel)
- Ne JAMAIS écrire "famille française"
- [HYPOTHÈSE : Thomas fournira des éléments biographiques à @copywriter pour personnaliser cette section. Sans ces éléments, @copywriter produira un texte sobre et institutionnel basé sur les éléments disponibles dans project-context.md]

**Section La mission :**
- Citation officielle verrouillée : "ISSA Capital est la holding patrimoniale de la famille Issa. Sa raison d'être est de faire fructifier le patrimoine familial dans la durée et d'organiser sa transmission entre les générations."
- Explication complémentaire : 1-2 paragraphes humains sur ce que cela signifie concrètement

**Section Filtres de décision :**
- 3 blocs (identiques à la section Philosophie de l'Accueil mais développés) :
  - Patrimoine long-terme : horizon intergénérationnel, pas de sortie forcée à 5-7 ans
  - Éthique humaine : n'investit jamais dans ce qui va à l'encontre de l'humanité — exemples de secteurs exclus [HYPOTHÈSE : Thomas à confirmer si des secteurs sont cités explicitement]
  - Préservation de l'environnement : critère de sélection, pas de greenwashing

**Section CTA de sortie :**
- CTA primaire : "Proposer une opportunité" → /opportunites#formulaire
- CTA secondaire : "Voir nos participations →" → /participations

### États UI

| État | Comportement | Message/Affichage |
|---|---|---|
| Défaut | Page statique éditoriale | Contenu texte et sections visibles |
| Loading | N/A — statique | N/A |
| Vide | N/A | N/A |
| Erreur | URL invalide | Page 404 |
| Succès | N/A — consultation pure | N/A |

### CTAs

- **CTA primaire** : "Proposer une opportunité d'investissement" → /opportunites#formulaire
- **CTA secondaire** : "Voir nos participations →" → /participations

### Liens

- Internes : /participations, /opportunites#formulaire
- Pas de liens sortants sur cette page

### Contraintes SEO

- `<title>` : "Notre mission — ISSA Capital | Holding patrimoniale familiale"
- `<meta name="description">` : "Découvrez la mission et les valeurs d'ISSA Capital, holding patrimoniale d'une famille libanaise investissant sur le long terme pour les générations à venir."
- `<h1>` : "Notre mission" ou équivalent validé par @copywriter
- Balises Open Graph : og:title, og:description cohérentes

### Contraintes RGPD

- Aucune collecte de données sur cette page

---

### User Stories — Page Mission

#### US-03 : Comprendre la mission et l'identité familiale d'ISSA Capital

**Persona** : Hélène (fondatrice PME)
**Epic** : Découverte et crédibilité institutionnelle
**Dépendances** : US-01 (visite Accueil)
**Priorité RICE** : R=90 I=9 C=8 E=1 → Score=648

**Job-to-be-done**
En tant qu'Hélène, je veux lire la mission et l'histoire d'ISSA Capital afin de vérifier que leurs valeurs sont alignées avec ce que je cherche pour mon entreprise (partenaire long-terme, pas fonds court-termiste).

**Contexte de navigation**
- Page/écran d'origine : Accueil (clic "Notre mission →")
- Déclencheur : clic sur lien "Notre mission →" depuis la page Accueil ou clic "Mission" dans la navigation
- Page/écran de destination (succès) : Hélène fait défiler la page entière et clique sur "Proposer une opportunité"
- Page/écran de destination (échec) : Hélène quitte (bounce) si le contenu ne la convainc pas

**Données et champs** : N/A — page de consultation pure

**5 états UI**
| État | Comportement | Message/Affichage |
|---|---|---|
| Défaut | Page éditoriale statique chargée | Titre + chapeau visibles sans scroll |
| Loading | N/A | N/A |
| Vide | N/A | N/A |
| Erreur | N/A | Page 404 si URL invalide |
| Succès | N/A | N/A |

**Critères d'acceptance**

Happy path :
- [ ] GIVEN Hélène clique sur "Notre mission →" depuis l'Accueil WHEN la page se charge THEN /mission s'affiche avec le titre h1 visible sans scroll
- [ ] GIVEN la page Mission est chargée WHEN Hélène lit la section "Histoire et identité" THEN le texte mentionne explicitement "famille libanaise" (jamais "famille française")
- [ ] GIVEN la page Mission est chargée WHEN Hélène lit la section "Filtres de décision" THEN les 3 filtres (patrimoine long-terme, éthique humaine, environnement) sont présentés comme critères de SÉLECTION et non comme finalité de la holding

Cas d'erreur :
- [ ] GIVEN une URL /mission invalide ou indisponible WHEN le visiteur arrive THEN une page 404 s'affiche avec lien retour Accueil

Cas limites :
- [ ] GIVEN Hélène utilise un lecteur d'écran WHEN elle navigue sur la page THEN les sections sont correctement balisées h1/h2/h3 pour la navigation par titres (accessibilité WCAG 2.2)
- [ ] GIVEN le contenu biographique de Thomas n'est pas encore disponible WHEN la page est mise en ligne THEN un texte sobre institutionnel est présent (aucun placeholder visible)

Permissions :
- [ ] GIVEN tout visiteur WHEN il accède à /mission THEN la page est accessible sans authentification

Données existantes :
- [ ] GIVEN que la mission officielle est modifiée par Thomas WHEN le fichier de contenu est mis à jour THEN la citation sur la page reflète la nouvelle formulation sans casser la mise en page

**Payload API** : N/A

**Events analytics**
| Event | Trigger | Propriétés | Funnel |
|---|---|---|---|
| page_view | Chargement /mission | referrer, device_type | activation |
| cta_click | Clic "Proposer une opportunité" | source=mission | activation |
| scroll_depth | Scroll 50% et 100% | scroll_pct=50/100 | activation |

**Scénarios persona concrets**

1. Hélène a vu le hero sur l'Accueil et clique sur "Notre mission". Elle lit la section Histoire : elle comprend que c'est une famille libanaise établie en France, qui a créé une holding pour transmettre son patrimoine. Elle se dit "ce n'est pas un fonds d'investissement classique".
2. Sophie (avocate) arrive directement sur /mission via un lien partagé. Elle lit les filtres de décision en diagonale en 2 minutes pour évaluer si ISSA Capital peut intéresser son client.
3. Hélène lit la section "Filtres de décision" et voit que la holding n'investit jamais dans ce qui va à l'encontre de l'humanité. Elle se reconnaît dans ces valeurs.
4. Marc (journaliste) arrive sur /mission et lit le chapeau pour citer la mission officielle dans son article.
5. Hélène fait défiler jusqu'au CTA "Proposer une opportunité" et clique. Elle est redirigée vers le formulaire.

**Definition of Done (@fullstack)**
- [ ] Page statique /mission avec toutes les sections
- [ ] Aucune occurrence de "famille française" dans le texte (vérification @qa)
- [ ] CTA fonctionnels
- [ ] Balisage h1/h2/h3 correct
- [ ] Screenshot conforme

**Notes @qa** : grep "famille française" dans tous les fichiers de contenu — doit retourner 0 occurrence. Vérifier balisage sémantique.

**Notes @copywriter** : section Histoire = pièce centrale. Trouver le bon équilibre entre institutionnel et humain. L'identité libanaise est un asset, pas une note de bas de page. Éviter le pathos : sobre et fier.

---

## Page 3 — Participations

### Objectif

Présenter l'écosystème de 6 entités de manière structurée et crédible pour montrer qu'ISSA Capital est déjà une holding active, pas une coquille vide.

### Audience prioritaire

Sophie (partenaire B2B) cherchant à évaluer l'écosystème en 5 minutes + Hélène qui veut comprendre dans quels secteurs la holding investit déjà.

### Sections obligatoires

1. **Titre de page + chapeau** — présentation de l'écosystème en 2 lignes
2. **Grille des participations** — 6 cartes, une par entité
3. **Note sur la transparence** — texte sobre sur la politique de communication (entités tech non documentées publiquement → sobriété assumée, pas d'opacité)
4. **CTA de sortie** — vers page Opportunités

### Contenu attendu par section

**Grille des participations — 6 cartes :**

| Entité | Secteur | Description | Lien externe |
|---|---|---|---|
| Gradient One | Technologie / SaaS | [À COMPLÉTER par Thomas en Phase 1] | gradientone.fr |
| Versi Immobilier | Immobilier | [À COMPLÉTER par Thomas en Phase 1] | Aucun |
| Versi Invest | Investissement | [À COMPLÉTER par Thomas en Phase 1] | Aucun |
| Immocrew | Marketing mandataires immobiliers | Services marketing externalisés pour mandataires immobiliers indépendants. Promesse "Tu publies, on fait le reste". | immocrew.fr |
| Versimo | PropTech / IA | Home staging virtuel par IA. Pipeline 2 passes préservant géométrie et lumière de la photo originale. | versimo.fr |
| Immobilier en direct | Immobilier | Actifs immobiliers détenus directement par la holding familiale. | Aucun |

[HYPOTHÈSE : les descriptions de Gradient One, Versi Immobilier, Versi Invest et Immobilier en direct seront fournies par Thomas avant la Phase 2. En attendant, les cartes afficheront un texte sobre "En cours de structuration" — jamais un placeholder technique visible.]

**Chaque carte contient :**
- Nom de l'entité
- Secteur (tag)
- Description (1-3 lignes)
- Lien vers site si disponible (bouton "Voir le site" target="_blank")
- Pas de logo en V1 (budget 0€ — sobriété typographique assumée)

### États UI

| État | Comportement | Message/Affichage |
|---|---|---|
| Défaut | Grille statique des 6 cartes | Toutes les cartes visibles |
| Loading | N/A — statique | N/A |
| Vide | N/A — 6 entités toujours présentes | N/A |
| Erreur | URL invalide | Page 404 |
| Succès | N/A | N/A |

### CTAs

- **CTA primaire** : "Proposer une opportunité" → /opportunites#formulaire
- **CTA secondaire** : liens "Voir le site" sur les cartes des entités avec site public

### Liens

- Internes : /opportunites#formulaire
- Sortants : gradientone.fr, immocrew.fr, versimo.fr (target="_blank" rel="noopener noreferrer")

### Contraintes SEO

- `<title>` : "Nos participations — ISSA Capital | Écosystème d'investissement"
- `<meta name="description">` : "Découvrez l'écosystème d'ISSA Capital : Gradient One, Versi Immobilier, Immocrew, Versimo et nos actifs immobiliers directs."
- `<h1>` : "Nos participations" ou équivalent
- Les noms des entités doivent être balisés en h3 ou titre de carte pour l'indexation

### Contraintes RGPD

- Aucune collecte de données sur cette page

---

### User Stories — Page Participations

#### US-04 : Explorer l'écosystème de participations d'ISSA Capital

**Persona** : Sophie (partenaire B2B — avocate d'affaires)
**Epic** : Crédibilité institutionnelle
**Dépendances** : US-01
**Priorité RICE** : R=80 I=8 C=8 E=1 → Score=512

**Job-to-be-done**
En tant que Sophie, je veux voir toutes les participations d'ISSA Capital en un coup d'oeil afin d'évaluer en 5 minutes la solidité et la diversification de l'écosystème avant de présenter la holding à un client.

**Contexte de navigation**
- Page/écran d'origine : Accueil (clic "Voir les participations →") ou navigation directe
- Déclencheur : clic sur lien Participations dans la nav ou le CTA Accueil
- Page/écran de destination (succès) : Sophie visualise les 6 cartes et note les URLs à consulter
- Page/écran de destination (échec) : cartes incomplètes → Sophie quitte sans conviction

**Données et champs** : N/A — consultation pure

**5 états UI**
| État | Comportement | Message/Affichage |
|---|---|---|
| Défaut | Grille 6 cartes statique | Toutes les entités visibles avec nom, secteur, description |
| Loading | N/A | N/A |
| Vide | Impossible (6 entités hardcodées) | N/A |
| Erreur | Page 404 si /participations invalide | Page 404 avec lien retour |
| Succès | N/A | N/A |

**Critères d'acceptance**

Happy path :
- [ ] GIVEN Sophie accède à /participations WHEN la page se charge THEN les 6 entités (Gradient One, Versi Immobilier, Versi Invest, Immocrew, Versimo, Immobilier en direct) sont toutes visibles
- [ ] GIVEN la grille est affichée WHEN Sophie clique sur "Voir le site" d'Immocrew THEN immocrew.fr s'ouvre dans un nouvel onglet (target="_blank")
- [ ] GIVEN la grille est affichée WHEN Sophie clique sur "Voir le site" de Versimo THEN versimo.fr s'ouvre dans un nouvel onglet
- [ ] GIVEN une entité n'a pas de site public (Versi Immobilier, Versi Invest) WHEN la carte est affichée THEN le bouton "Voir le site" est absent (pas de lien mort)

Cas d'erreur :
- [ ] GIVEN un lien externe (immocrew.fr) est temporairement inaccessible WHEN Sophie clique dessus THEN le navigateur affiche l'erreur de l'onglet externe (hors contrôle du site ISSA)

Cas limites :
- [ ] GIVEN les descriptions de Gradient One et Versi Immobilier ne sont pas encore disponibles WHEN la page est mise en ligne THEN les cartes affichent un texte institutionnel sobre (pas de placeholder "[À COMPLÉTER]" visible côté utilisateur)
- [ ] GIVEN Sophie utilise un iPad (768px) WHEN la grille est affichée THEN les cartes sont affichées en 2 colonnes (responsive)

Permissions :
- [ ] GIVEN tout visiteur WHEN il accède à /participations THEN la page est accessible sans authentification

Données existantes :
- [ ] GIVEN qu'une nouvelle participation est ajoutée à l'écosystème WHEN le fichier de config participations.ts est mis à jour THEN la nouvelle carte apparaît dans la grille sans modifier le composant

**Payload API** : N/A — données statiques depuis fichier de config

**Events analytics**
| Event | Trigger | Propriétés | Funnel |
|---|---|---|---|
| page_view | Chargement /participations | referrer, device_type | activation |
| outbound_click | Clic "Voir le site" | entite=immocrew/versimo/gradientone | activation |
| cta_click | Clic "Proposer une opportunité" | source=participations | activation |

**Scénarios persona concrets**

1. Sophie reçoit le nom ISSA Capital dans un email. Elle va sur /participations. En 2 minutes elle identifie Immocrew (PropTech) et Versimo (IA immobilière). Elle note les deux URLs pour consulter. Elle clique sur "Voir le site" d'Immocrew.
2. Hélène (PME manufacturing) consulte les participations pour vérifier qu'ISSA investit aussi hors tech. Elle voit "Immobilier en direct" et "Versi Immobilier". Elle est rassurée sur la diversification.
3. Marc (journaliste) arrive sur /participations pour lister les entités dans son article. Il note les 6 noms et les secteurs.
4. Un visiteur mobile fait défiler les cartes sur iPhone. Les cartes sont en colonne unique, lisibles sans zoom.
5. Sophie revient sur le site 1 semaine plus tard. Les données sont identiques (statiques). Elle retrouve les informations sans surprise.

**Definition of Done (@fullstack)**
- [ ] Grille 6 cartes implémentée depuis participations.ts
- [ ] Liens sortants avec target="_blank" rel="noopener noreferrer"
- [ ] Cartes sans site : bouton "Voir le site" absent
- [ ] Responsive 1col mobile / 2col tablet / 3col desktop
- [ ] Screenshot conforme

**Notes @qa** : vérifier que les 6 entités sont présentes. Vérifier les liens sortants (ouverture nouvel onglet). Vérifier l'absence de placeholder visible.

**Notes @fullstack** : données dans src/data/participations.ts (tableau d'objets). Facilite les mises à jour sans modifier les composants React. Typer l'interface Participation : { nom, secteur, description, urlExterne? }.

---

