# Functional Specs — ISSA Capital
> @product-manager — 2026-04-07
> Source : project-context.md (Phase 0 validée) + product-vision.md
> [PROVISOIRE — à enrichir quand brand-platform.md et personas.md seront disponibles]

---

## Résumé exécutif

- **Objectif** : Spécifications fonctionnelles des 6 pages V1 du site vitrine ISSA Capital
- **Décisions clés** : 2 CTAs distincts — CTA A "Mission de conseil & accompagnement" (cible Karim) + CTA B "Proposer une opportunité d'affaires" (cible Leila) — 2 pages distinctes /accompagnement + /opportunites, conformité RGPD allégée (Plausible sans cookies)
- **Révision personas 2026-04-07** : Hélène (fondatrice PME) et Sophie (partenaire M&A) supprimées — scope business invalide. Karim (entrepreneur en structuration patrimoniale, 42 ans) = persona principal A, Leila (apporteur d'affaires immo / fondateur cherchant co-investisseur, 38 ans) = persona principal B, Marc (journaliste/analyste) conservé en secondaire.
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

Poser l'identité d'ISSA Capital en moins de 10 secondes et orienter chaque visiteur vers le bon CTA : Karim vers /accompagnement, Leila vers /opportunites.

### Audience prioritaire

Karim (persona principal A — accompagnement) + Leila (persona principal B — opportunités) + Marc (persona secondaire — earned media) — première impression pour des visiteurs qui ne connaissent pas la holding.

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

**Section CTA de conversion (double entrée) :**
- CTA A : "Parler avec Thomas" → /accompagnement (cible Karim — entrepreneur cherchant conseil)
- CTA B : "Proposer une opportunité" → /opportunites#formulaire (cible Leila — apporteur d'affaires avec un deal)
- Sous-titre CTA A : réassurance ("Mission de conseil personnalisée — premier échange sans engagement")
- Sous-titre CTA B : réassurance ("Nous répondons à chaque opportunité qualifiée dans la journée")
- Note @copywriter : deux appels à action distincts sur la même section — Karim cherche un pair, Leila a un deal à soumettre. Le copy doit adresser les deux sans être schizophrène.

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

## Page 4 — Opportunités d'investissement

### Objectif

Expliquer les critères d'investissement d'ISSA Capital et collecter des propositions qualifiées via le formulaire principal du site. C'est la pièce maîtresse du site — celle qui convertit Hélène en lead qualifié.

### Audience prioritaire

Hélène (persona principal) — elle est convaincue, elle veut proposer son entreprise. Cette page doit réduire la friction au minimum tout en qualifiant sa candidature.

### Sections obligatoires

1. **Titre de page + chapeau** — ce qu'ISSA cherche en 2-3 lignes
2. **Ce qu'ISSA recherche** — secteurs, horizons, tailles de projets, critères de sélection
3. **Ce qu'ISSA ne fait pas** — les exclusions claires (contre-exemple : fonds LBO, secteurs éthiquement exclus)
4. **Le processus de contact** — que se passe-t-il après la soumission (réassurance)
5. **Formulaire de proposition** — champs qualifiants, ancré sur #formulaire
6. **Réassurance post-formulaire** — message de confirmation que chaque proposition est lue

### Contenu attendu par section

**Ce qu'ISSA recherche :**
- Secteurs cibles : à préciser [HYPOTHÈSE : Thomas à confirmer les secteurs prioritaires. En attendant : tech/SaaS, immobilier, services B2B, industrie légère — cohérent avec l'écosystème existant]
- Horizon : partenariat long-terme, pas de revente à horizon fixe
- Profils recherchés : fondateurs souhaitant un adossement patrimonial avec un partenaire stable, non une cession pure
- Critères de filtre : projets compatibles avec les 3 filtres (patrimoine long-terme, éthique humaine, environnement)

**Ce qu'ISSA ne fait pas :**
- Investissement spéculatif court-terme
- Secteurs contraires à l'éthique humaine [HYPOTHÈSE : Thomas à confirmer les secteurs exclus]
- Projets sans perspective de transmission générationnelle

**Le processus de contact :**
- Étape 1 : soumission du formulaire
- Étape 2 : Thomas Issa lit personnellement chaque proposition (réassurance)
- Étape 3 : réponse dans les 7 jours ouvrés [HYPOTHÈSE — délai à confirmer par Thomas]

**Formulaire de proposition (ancre #formulaire) :**
- Champs : voir tableau Données et champs US-10

### États UI

| État | Comportement | Message/Affichage |
|---|---|---|
| Défaut | Page statique + formulaire vide | Tous les champs vides, CTA de soumission visible |
| Loading | Soumission du formulaire en cours | Bouton "Envoi en cours..." désactivé, spinner visible |
| Vide | N/A — formulaire toujours présent | N/A |
| Erreur | Validation formulaire ou erreur API | Messages d'erreur inline par champ + message global si erreur serveur |
| Succès | Formulaire soumis avec succès | Message de confirmation visible, formulaire remplacé par confirmation |

### CTAs

- **CTA primaire** : bouton "Envoyer ma proposition" dans le formulaire
- **CTA secondaire** : "En savoir plus sur notre philosophie →" → /mission

### Liens

- Internes : /mission
- Pas de liens sortants sur cette page

### Contraintes SEO

- `<title>` : "Proposer une opportunité — ISSA Capital | Investissement patrimonial long-terme"
- `<meta name="description">` : "Proposez votre projet à ISSA Capital, holding patrimoniale familiale. Nous investissons dans des projets durables avec un horizon intergénérationnel."
- `<h1>` : "Proposer une opportunité" ou équivalent
- L'ancre #formulaire ne doit pas perturber l'indexation du contenu éditorial en amont

### Contraintes RGPD

- Formulaire de contact : collecte nom, email, entreprise, secteur, message
- Politique de confidentialité liée depuis le formulaire (checkbox consentement OU lien visible sous le bouton)
- Données transmises par email via Resend (ou équivalent) — pas de stockage en base de données en V1
- Conformité art. 13 RGPD : informer sur le responsable du traitement (ISSA Capital SAS), finalité (traitement de la demande), durée de conservation (@legal valide)

---

### User Stories — Page Opportunités

#### US-10 : Soumettre une proposition d'opportunité d'investissement

**Persona** : Hélène (fondatrice PME)
**Epic** : Conversion — génération de leads qualifiés
**Dépendances** : US-01, US-02 (navigation depuis Accueil) ; infrastructure Resend (ou équivalent) pour l'envoi d'email
**Priorité RICE** : R=100 I=10 C=9 E=2 → Score=450

**Job-to-be-done**
En tant qu'Hélène, je veux remplir et soumettre un formulaire de proposition d'investissement afin qu'ISSA Capital reçoive les informations essentielles sur mon projet et me contacte.

**Contexte de navigation**
- Page/écran d'origine : Accueil (CTA Hero), Mission (CTA sortie), Participations (CTA sortie), navigation directe
- Déclencheur : clic sur n'importe quel CTA "Proposer une opportunité" du site → scroll sur ancre #formulaire
- Page/écran de destination (succès) : le formulaire est remplacé par un message de confirmation
- Page/écran de destination (échec) : le formulaire reste visible avec les erreurs inline, aucune donnée perdue

**Données et champs**
| Champ | Type | Obligatoire | Validation | Limites | Exemple |
|---|---|---|---|---|---|
| prenom_nom | string | Oui | Non vide, pas de chiffres | 2-100 caractères | "Hélène Dubois" |
| email | email | Oui | Format RFC 5322 (regex email standard) | 5-254 caractères | "helene@maboite.fr" |
| entreprise | string | Oui | Non vide | 2-200 caractères | "Dubois Mécanique SAS" |
| secteur | enum | Oui | Valeur parmi la liste | — | "Industrie / Manufacturing" |
| taille_entreprise | enum | Oui | Valeur parmi la liste | — | "10-49 salariés" |
| description_projet | string (textarea) | Oui | Non vide, min 50 caractères | 50-2000 caractères | "Nous cherchons un adossement patrimonial..." |
| telephone | string | Non | Format FR optionnel (validation souple) | 0-20 caractères | "06 12 34 56 78" |
| consentement_rgpd | boolean | Oui | Doit être coché pour soumettre | — | true |

**Valeurs enum secteur :**
Technologies / SaaS | Immobilier | Industrie / Manufacturing | Services B2B | Commerce / Distribution | Santé | Autre

**Valeurs enum taille_entreprise :**
1-9 salariés | 10-49 salariés | 50-249 salariés | 250+ salariés

**5 états UI**
| État | Comportement | Message/Affichage |
|---|---|---|
| Défaut | Formulaire vide avec labels et placeholders | Tous les champs vides, bouton "Envoyer ma proposition" actif |
| Loading | Soumission en cours (appel API Resend) | Bouton désactivé, libellé "Envoi en cours...", spinner inline — max 5 secondes |
| Vide | N/A — formulaire toujours présent | N/A |
| Erreur | Erreur de validation (client) ou erreur API (serveur) | Erreur inline sous chaque champ invalide (rouge, texte explicite). Si erreur serveur : message global "Une erreur est survenue. Veuillez réessayer ou nous contacter directement à [email ISSA Capital]." |
| Succès | Email envoyé via Resend | Formulaire remplacé par bloc : "Merci [prénom]. Votre proposition a bien été reçue. Thomas Issa vous répondra dans les 7 jours ouvrés." — CTA secondaire "Revenir à l'accueil" |

**Critères d'acceptance**

Happy path :
- [ ] GIVEN Hélène arrive sur /opportunites#formulaire WHEN elle voit le formulaire THEN tous les champs obligatoires sont visibles et le bouton "Envoyer ma proposition" est présent
- [ ] GIVEN Hélène remplit tous les champs obligatoires avec des données valides WHEN elle clique sur "Envoyer ma proposition" THEN le bouton passe en état Loading (désactivé + "Envoi en cours...")
- [ ] GIVEN le formulaire est en état Loading WHEN Resend envoie l'email avec succès THEN le formulaire est remplacé par le message de confirmation avec le prénom d'Hélène
- [ ] GIVEN le formulaire est soumis avec succès WHEN Thomas consulte sa boîte email THEN il reçoit un email formaté avec tous les champs remplis par Hélène (nom, email, entreprise, secteur, taille, description, téléphone si fourni)

Cas d'erreur :
- [ ] GIVEN Hélène soumet le formulaire avec l'email vide WHEN elle clique "Envoyer" THEN un message d'erreur "L'email est obligatoire" s'affiche sous le champ email, la soumission est bloquée
- [ ] GIVEN Hélène saisit "helene@" (email invalide) WHEN elle clique "Envoyer" THEN un message "Format d'email invalide" s'affiche sous le champ email
- [ ] GIVEN Hélène soumet le formulaire sans cocher le consentement RGPD WHEN elle clique "Envoyer" THEN un message "Vous devez accepter la politique de confidentialité pour continuer" s'affiche et la soumission est bloquée
- [ ] GIVEN Resend retourne une erreur 5xx WHEN le formulaire est soumis THEN le message global d'erreur serveur s'affiche, le formulaire reste rempli (données non perdues), le bouton redevient actif pour réessayer
- [ ] GIVEN une erreur réseau (timeout) WHEN la soumission est en cours depuis plus de 5 secondes THEN le loading s'arrête, le message d'erreur réseau s'affiche avec l'option de réessayer

Cas limites :
- [ ] GIVEN Hélène double-clique sur "Envoyer ma proposition" WHEN la première soumission est en cours THEN le deuxième clic est ignoré (bouton désactivé pendant le loading)
- [ ] GIVEN Hélène saisit 2001 caractères dans le champ description WHEN elle tape le 2001ème caractère THEN le champ est bloqué à 2000 caractères avec un compteur visible "2000/2000"
- [ ] GIVEN Hélène utilise le bouton "Retour" du navigateur depuis la page de confirmation WHEN elle revient sur le formulaire THEN le formulaire est vide (pas de pré-remplissage des données précédentes)
- [ ] GIVEN Hélène a une session expirée (si jamais auth ajoutée en V2) THEN N/A en V1 — pas d'authentification

Permissions :
- [ ] GIVEN tout visiteur non authentifié WHEN il soumet le formulaire THEN la soumission est acceptée (pas d'auth requise)
- [ ] GIVEN un bot tente de soumettre le formulaire en masse WHEN les soumissions arrivent THEN [HYPOTHÈSE : protection honeypot ou rate limiting côté API route à implémenter — voir US-11]

Données existantes :
- [ ] GIVEN qu'une même adresse email soumet 2 fois le formulaire WHEN la deuxième soumission arrive THEN les deux emails sont envoyés à Thomas (pas de déduplication en V1 — Thomas filtre manuellement)

**Payload API**
- **Endpoint** : POST /api/contact
- **Authentification** : publique (pas d'auth en V1)
- **Rate limit** : 5 requêtes/minute par IP [HYPOTHÈSE — à valider par @fullstack selon les capacités de l'API route Next.js sur Replit]
- **Request body** :
```json
{
  "prenom_nom": "string (2-100 chars)",
  "email": "string (email valide)",
  "entreprise": "string (2-200 chars)",
  "secteur": "enum Technologies|Immobilier|Industrie|ServicesB2B|Commerce|Santé|Autre",
  "taille_entreprise": "enum 1-9|10-49|50-249|250+",
  "description_projet": "string (50-2000 chars)",
  "telephone": "string (0-20 chars, optionnel)",
  "consentement_rgpd": "boolean (doit être true)"
}
```
- **Response succès** : `{ "success": true, "message": "Proposition envoyée" }` — HTTP 200
- **Response erreur validation** : `{ "success": false, "errors": { "champ": "message d'erreur" } }` — HTTP 422
- **Response erreur serveur** : `{ "success": false, "message": "Erreur serveur" }` — HTTP 500

**Events analytics**
| Event | Trigger | Propriétés | Funnel |
|---|---|---|---|
| page_view | Chargement /opportunites | referrer, device_type | acquisition |
| form_start | Premier focus sur un champ | — | activation |
| form_submit_attempt | Clic "Envoyer ma proposition" | — | activation |
| form_submit_success | Réponse API 200 | secteur, taille_entreprise | revenue |
| form_submit_error | Réponse API non-200 | error_type=validation/server | activation |
| form_abandon | Départ de la page avec champs remplis non soumis | fields_filled=count | activation |

**Scénarios persona concrets**

1. Hélène arrive depuis la page Accueil (CTA Hero). Elle voit le formulaire après la section des critères. Elle remplit les 6 champs obligatoires en 3 minutes. Elle coche le consentement RGPD et clique "Envoyer". Confirmation visible : "Merci Hélène. Votre proposition a bien été reçue."
2. Hélène oublie de remplir le champ "Secteur". Elle clique "Envoyer". Un message rouge s'affiche sous le select secteur : "Veuillez sélectionner un secteur". Elle corrige et soumet.
3. Hélène rédige une description de 10 caractères. Elle essaie de soumettre. Message : "La description doit contenir au moins 50 caractères". Elle détaille.
4. Resend est temporairement indisponible quand Hélène soumet. Elle voit "Une erreur est survenue. Veuillez réessayer". Elle patiente 30 secondes et réessaie avec succès.
5. Sophie (avocate) veut juste tester le formulaire pour voir sa qualité. Elle remplit avec des données fictives et soumet. Thomas reçoit l'email et voit que c'est un test (secteur "Autre", description vague).

**Definition of Done (@fullstack)**
- [ ] UI formulaire implémentée conforme aux 5 états
- [ ] Validation côté client (HTML5 + JS custom)
- [ ] API route POST /api/contact opérationnelle
- [ ] Intégration Resend (ou équivalent) testée
- [ ] Email reçu par Thomas avec tous les champs
- [ ] Rate limiting configuré
- [ ] Scénarios persona reproductibles
- [ ] Test E2E : remplissage → soumission → confirmation
- [ ] Screenshot conforme au design

**Notes @qa** : tester le double-clic sur "Envoyer". Tester la limite de 2000 caractères. Tester le comportement si Resend est mocké en erreur 500. Tester l'accessibilité du formulaire (tabulation, lecteur d'écran). Tester mobile 375px (formulaire scrollable, champs accessibles).

**Notes @ux** : le formulaire doit être conçu pour qualifier sans intimider. Labels clairs au-dessus des champs (pas de placeholders seuls). Messages d'erreur bienveillants ("Format d'email invalide" pas "Erreur champ email"). Lien vers politique de confidentialité visible et cliquable depuis la checkbox RGPD.

**Notes @fullstack** : utiliser React Hook Form + Zod pour la validation côté client. API route Next.js avec validation serveur indépendante (ne pas faire confiance au client seul). Resend comme service d'envoi email. Variables d'environnement : RESEND_API_KEY, EMAIL_DESTINATION (email Thomas). Ne PAS logguer les données personnelles dans les logs serveur.

---

#### US-11 : Protection anti-spam du formulaire

**Persona** : N/A — story backend sans UI visible
**Epic** : Conversion — génération de leads qualifiés
**Dépendances** : US-10 (formulaire doit exister)
**Priorité RICE** : R=60 I=6 C=8 E=1 → Score=288

**Job-to-be-done**
En tant qu'ISSA Capital (système), je veux filtrer les soumissions de bots afin de ne pas polluer la boîte email de Thomas avec des spams.

**Contexte de navigation** : N/A — story backend sans UI

**Données et champs** : N/A — voir payload US-10

**5 états UI** : N/A — story backend sans UI

**Critères d'acceptance**

Happy path :
- [ ] GIVEN un humain remplit le formulaire normalement WHEN il soumet THEN la soumission est traitée normalement (0 faux positif)
- [ ] GIVEN une IP soumet le formulaire 6 fois en 1 minute WHEN la 6ème soumission arrive THEN l'API retourne HTTP 429 (Too Many Requests) avec message "Trop de soumissions. Réessayez dans quelques minutes."

Cas d'erreur :
- [ ] GIVEN le honeypot field est rempli (bot détecté) WHEN la soumission arrive THEN l'API retourne HTTP 200 (silencieusement — ne pas alerter le bot) mais n'envoie PAS l'email à Thomas

Cas limites :
- [ ] GIVEN un utilisateur légitime derrière un proxy partagé dépasse le rate limit WHEN sa soumission est rejetée THEN il voit le message "Trop de soumissions" et peut réessayer dans 1 minute (délai raisonnable)

Permissions :
- [ ] GIVEN une soumission sans User-Agent HTTP WHEN elle arrive THEN elle est loggée et rejetée silencieusement

Données existantes : N/A

**Payload API** : voir US-10 — ajout d'un champ honeypot (caché en CSS) : `{ "_hp": "" }` — si rempli → rejet silencieux

**Events analytics**
| Event | Trigger | Propriétés | Funnel |
|---|---|---|---|
| spam_detected | Honeypot rempli ou rate limit atteint | type=honeypot/ratelimit | — |

**Scénarios persona concrets**

1. Un bot remplit le champ honeypot caché. L'API répond 200 silencieusement mais n'envoie pas l'email. Thomas ne reçoit rien.
2. Une IP tente 10 soumissions en 30 secondes. Dès la 6ème, l'API répond 429. Les suivantes sont bloquées pendant 1 minute.
3. Hélène soumet une fois. Elle ne voit aucun comportement différent (rate limit non atteint).

**Definition of Done (@fullstack)**
- [ ] Honeypot field implémenté (caché en CSS, jamais rempli par les humains)
- [ ] Rate limiting configuré (5 req/min/IP)
- [ ] Rejet silencieux si honeypot rempli
- [ ] Test : soumission bot avec honeypot rempli → 0 email reçu

**Notes @qa** : tester le honeypot avec un champ rempli manuellement via DevTools. Tester le rate limiting avec curl en rafale.

**Notes @fullstack** : rate limiting via middleware Next.js ou librairie upstash/ratelimit. Honeypot : champ `<input name="_hp" tabindex="-1" autocomplete="off" style="display:none">`. Si rempli côté serveur → retourner 200 mais ne pas appeler Resend.

---

## Page 5 — Contact

### Objectif

Offrir un second point d'entrée de contact pour les visiteurs qui ne souhaitent pas soumettre une opportunité d'investissement (partenaires B2B, journalistes, demandes diverses). Éviter le cul-de-sac pour Sophie ou Marc.

### Audience prioritaire

Sophie (partenaire B2B) et Marc (journaliste) — pour qui le formulaire Opportunités avec champs "entreprise / secteur / taille" ne correspond pas à leur contexte.

### Sections obligatoires

1. **Titre de page + chapeau** — invitation à contacter pour tout sujet
2. **Informations de contact** — adresse siège, email (si rendu public) [HYPOTHÈSE : Thomas à confirmer si un email public est exposé sur le site ou uniquement via formulaire]
3. **Formulaire de contact générique** — version allégée du formulaire Opportunités (sans champs secteur/taille)
4. **Réassurance** — "Chaque message est lu par l'équipe ISSA Capital"

### Contenu attendu par section

**Informations de contact :**
- Adresse : 54 Rue Henri Barbusse, 92000 Nanterre (donnée publique — SIREN)
- Email public : [HYPOTHÈSE — à confirmer par Thomas : contact@issa-capital.com ou formulaire uniquement]
- Pas de téléphone public en V1 [HYPOTHÈSE — à confirmer]

**Formulaire de contact générique :**
- Champs : prenom_nom, email, sujet, message
- Réutilise le même endpoint /api/contact avec un paramètre `type=contact_generique`
- Mêmes validations que le formulaire Opportunités sur les champs communs
- Consentement RGPD : même checkbox que le formulaire Opportunités

### États UI

Identiques au formulaire Opportunités (US-10) — même composant réutilisé avec props différentes.

### CTAs

- **CTA primaire** : bouton "Envoyer mon message" (dans le formulaire)
- **CTA secondaire** : "Proposer une opportunité d'investissement →" → /opportunites#formulaire (pour rediriger Hélène vers le bon formulaire)

### Liens

- Internes : /opportunites#formulaire
- Pas de liens sortants

### Contraintes SEO

- `<title>` : "Contact — ISSA Capital"
- `<meta name="description">` : "Contactez ISSA Capital, holding patrimoniale familiale domiciliée à Nanterre."
- `<h1>` : "Contact"
- Page contact : pas prioritaire pour le SEO — ne pas sur-optimiser

### Contraintes RGPD

- Mêmes contraintes que le formulaire Opportunités
- Mention du responsable du traitement visible sur le formulaire

---

### User Stories — Page Contact

#### US-12 : Envoyer un message de contact générique

**Persona** : Sophie (partenaire B2B)
**Epic** : Contact et partenariat
**Dépendances** : US-10 (même endpoint API, même logique formulaire)
**Priorité RICE** : R=70 I=7 C=8 E=1 → Score=392

**Job-to-be-done**
En tant que Sophie, je veux envoyer un message à ISSA Capital afin de me présenter en tant que partenaire potentiel ou d'orienter un client sans passer par le formulaire d'opportunité d'investissement (trop spécifique).

**Contexte de navigation**
- Page/écran d'origine : navigation depuis n'importe quelle page (lien "Contact" dans la nav)
- Déclencheur : clic sur "Contact" dans la navigation ou le footer
- Page/écran de destination (succès) : message de confirmation après soumission
- Page/écran de destination (échec) : formulaire avec erreurs inline

**Données et champs**
| Champ | Type | Obligatoire | Validation | Limites | Exemple |
|---|---|---|---|---|---|
| prenom_nom | string | Oui | Non vide | 2-100 caractères | "Sophie Martin" |
| email | email | Oui | Format RFC 5322 | 5-254 caractères | "sophie@cabinet-martin.fr" |
| sujet | string | Oui | Non vide | 3-200 caractères | "Partenariat avocat d'affaires" |
| message | string (textarea) | Oui | Non vide, min 20 caractères | 20-2000 caractères | "Bonjour, je représente..." |
| consentement_rgpd | boolean | Oui | Doit être coché | — | true |

**5 états UI** : Identiques à US-10 (même composant)
| État | Comportement | Message/Affichage |
|---|---|---|
| Défaut | Formulaire vide | Labels et champs vides |
| Loading | Soumission en cours | Bouton "Envoi en cours..." désactivé |
| Vide | N/A | N/A |
| Erreur | Validation ou erreur API | Messages d'erreur inline |
| Succès | Email envoyé | "Merci [prénom]. Votre message a bien été reçu." |

**Critères d'acceptance**

Happy path :
- [ ] GIVEN Sophie remplit les 4 champs obligatoires et coche le consentement WHEN elle soumet THEN Thomas reçoit l'email avec le tag `[CONTACT]` dans le sujet (pour distinguer des opportunités)
- [ ] GIVEN la page Contact s'affiche WHEN Sophie voit le formulaire THEN un lien "Proposer une opportunité d'investissement →" est visible au-dessus du formulaire

Cas d'erreur :
- [ ] GIVEN Sophie soumet avec le champ message vide WHEN elle clique "Envoyer" THEN un message "Le message est obligatoire" s'affiche sous le champ
- [ ] GIVEN Resend retourne une erreur WHEN Sophie soumet THEN le message d'erreur serveur s'affiche (identique à US-10)

Cas limites :
- [ ] GIVEN Sophie saisit 19 caractères dans le champ message WHEN elle soumet THEN erreur "Le message doit contenir au moins 20 caractères"
- [ ] GIVEN le même visiteur soumet le formulaire Contact puis le formulaire Opportunités dans la même session THEN les deux emails arrivent à Thomas correctement

Permissions :
- [ ] GIVEN tout visiteur WHEN il accède à /contact THEN la page est accessible sans authentification

Données existantes :
- [ ] GIVEN que l'adresse email de destination (Thomas) change WHEN la variable d'environnement EMAIL_DESTINATION est mise à jour THEN les deux formulaires (Contact et Opportunités) envoient vers la nouvelle adresse

**Payload API**
- **Endpoint** : POST /api/contact (même endpoint que US-10)
- **Request body** : `{ "type": "contact_generique", "prenom_nom", "email", "sujet", "message", "consentement_rgpd": true, "_hp": "" }`
- **Response** : identique à US-10

**Events analytics**
| Event | Trigger | Propriétés | Funnel |
|---|---|---|---|
| page_view | Chargement /contact | referrer, device_type | acquisition |
| form_submit_success | Soumission réussie | type=contact_generique | activation |

**Scénarios persona concrets**

1. Sophie arrive sur le site, lit les participations, et veut contacter ISSA Capital pour un dossier client. Elle clique "Contact" dans la nav. Elle remplit 4 champs en 1 minute. Elle soumet. Confirmation "Merci Sophie."
2. Marc (journaliste) cherche à interviewer Thomas Issa. Il va sur Contact, remplit le formulaire avec sujet "Demande d'interview — article holding familiale". Il soumet.
3. Hélène arrive sur /contact par erreur (cherchait le formulaire Opportunités). Elle voit le lien "Proposer une opportunité d'investissement →" et est redirigée vers le bon formulaire.
4. Sophie utilise un mobile. Le formulaire est scrollable et les champs accessibles sans zoom.
5. Un visiteur soumet le formulaire Contact 7 fois en 1 minute. La 6ème est bloquée par le rate limiting (même règle que US-11).

**Definition of Done (@fullstack)**
- [ ] Page /contact avec formulaire allégé (4 champs)
- [ ] Endpoint POST /api/contact avec paramètre type=contact_generique
- [ ] Email envoyé avec tag [CONTACT] dans le sujet
- [ ] Lien "Proposer une opportunité" visible au-dessus du formulaire
- [ ] Test E2E : soumission → confirmation → email reçu

**Notes @qa** : vérifier que les deux formulaires (Opportunités et Contact) utilisent le même endpoint sans interférer. Vérifier le tag [CONTACT] dans l'email reçu.

**Notes @fullstack** : réutiliser le composant ContactForm avec une prop `variant="opportunite" | "contact"` pour adapter les champs et le heading sans dupliquer la logique de soumission/validation.

---

## Page 6 — Mentions légales + Politique de confidentialité

### Objectif

Respecter les obligations légales françaises (mentions légales LCEN) et RGPD. Page de conformité, pas de page marketing.

### Audience prioritaire

N/A — page de conformité légale. Visitée uniquement si le visiteur cherche explicitement ces informations.

### Sections obligatoires

1. **Mentions légales** (LCEN art. 6-III) — éditeur, hébergeur, directeur de publication
2. **Politique de confidentialité** (RGPD art. 13) — données collectées, finalités, durée, droits
3. **Politique de cookies** — information sur Plausible (sans cookies tiers)

### Contenu attendu — Mentions légales

- **Éditeur** : ISSA Capital SAS — SIREN 102 356 094 — siège 54 Rue Henri Barbusse, 92000 Nanterre
- **Directeur de publication** : Thomas Issa [HYPOTHÈSE — à confirmer. En tant que représentant légal de la SAS]
- **Hébergeur** : Replit Inc. — 601 Townsend Street, San Francisco, CA 94103, USA [données Replit à vérifier par @legal]
- **Contact** : [email de contact — à confirmer par Thomas]

### Contenu attendu — Politique de confidentialité

- **Responsable du traitement** : ISSA Capital SAS (coordonnées ci-dessus)
- **Données collectées** : nom, email, entreprise, secteur, taille, description projet, téléphone (optionnel), via formulaire de contact
- **Finalité** : traitement des demandes de contact et d'investissement
- **Base légale** : consentement (art. 6.1.a RGPD — checkbox cochée)
- **Durée de conservation** : [HYPOTHÈSE — à définir par @legal : 3 ans après le dernier contact ?]
- **Destinataires** : ISSA Capital uniquement — pas de transfert tiers sauf Resend (processeur)
- **Droits** : accès, rectification, effacement, opposition, portabilité — via email [contact@issa-capital.com ou équivalent]
- **Réclamation** : CNIL (www.cnil.fr)

### Contenu attendu — Politique de cookies

- Plausible Analytics : outil d'analyse sans cookies, sans tracking cross-site, sans données personnelles collectées
- Conséquence : pas de bandeau cookies obligatoire (Plausible sans cookies = hors champ RGPD cookies)
- Information de transparence : script Plausible présent sur toutes les pages pour mesure d'audience anonyme

### États UI : N/A — page texte statique

### CTAs

- Aucun CTA produit sur cette page
- Liens internes : lien retour Accueil dans la navigation standard

### Contraintes SEO

- `<title>` : "Mentions légales — ISSA Capital"
- `<meta name="robots">` : "noindex" (page légale, ne pas indexer)
- `<h1>` : "Mentions légales"

---

### User Stories — Page Mentions légales

#### US-13 : Consulter les mentions légales et la politique de confidentialité

**Persona** : N/A — tout visiteur (obligation légale)
**Epic** : Conformité légale
**Dépendances** : Aucune
**Priorité RICE** : R=100 I=5 C=10 E=1 → Score=500

**Job-to-be-done**
En tant que visiteur du site, je veux accéder aux mentions légales et à la politique de confidentialité afin de connaître l'éditeur du site et mes droits sur mes données personnelles.

**Contexte de navigation**
- Page/écran d'origine : footer (lien "Mentions légales" ou "Politique de confidentialité")
- Déclencheur : clic sur lien footer
- Page/écran de destination (succès) : page /mentions-legales chargée avec tout le contenu légal
- Page/écran de destination (échec) : page 404 si URL invalide

**Données et champs** : N/A — consultation pure

**5 états UI** : N/A — page texte statique

**Critères d'acceptance**

Happy path :
- [ ] GIVEN un visiteur clique sur "Mentions légales" dans le footer WHEN la page se charge THEN le nom "ISSA Capital", le SIREN "102 356 094" et l'adresse "54 Rue Henri Barbusse, 92000 Nanterre" sont visibles
- [ ] GIVEN un visiteur accède à /mentions-legales WHEN il consulte la section Politique de confidentialité THEN ses droits RGPD (accès, rectification, effacement, opposition, portabilité) sont listés avec un contact pour les exercer
- [ ] GIVEN un visiteur consulte la section cookies WHEN il lit la politique THEN il est informé que Plausible est utilisé sans cookies et sans données personnelles

Cas d'erreur :
- [ ] GIVEN l'URL /mentions-legales est invalide WHEN le visiteur arrive THEN page 404 avec lien retour

Cas limites :
- [ ] GIVEN un moteur de recherche crawle la page WHEN il lit les métadonnées THEN la balise `<meta name="robots" content="noindex">` est présente

Permissions :
- [ ] GIVEN tout visiteur WHEN il accède à /mentions-legales THEN la page est accessible sans authentification

Données existantes :
- [ ] GIVEN que les informations légales changent (changement de siège, changement d'hébergeur) WHEN le fichier de contenu est mis à jour THEN la page reflète les nouvelles informations

**Payload API** : N/A

**Events analytics** : N/A — page non indexée, pas de tracking événementiel

**Scénarios persona concrets**

1. Un visiteur clique sur "Politique de confidentialité" dans le footer avant de remplir le formulaire. Il vérifie que ses données ne seront pas revendues. Il lit la section destinataires.
2. Un juriste vérifie la conformité LCEN d'ISSA Capital. Il trouve le SIREN, l'adresse et le directeur de publication en moins de 30 secondes.
3. Un visiteur souhaite exercer son droit à l'effacement. Il trouve l'adresse email de contact dans la section "Vos droits".
4. Googlebot crawle la page. La balise noindex est présente — la page n'est pas indexée.
5. Thomas met à jour l'hébergeur de Replit vers Vercel en V2. Il met à jour le fichier de contenu mentions légales. La page reflète Vercel sans modifier les autres pages.

**Definition of Done (@fullstack)**
- [ ] Page /mentions-legales avec les 3 sections (mentions légales, confidentialité, cookies)
- [ ] Balise noindex présente
- [ ] SIREN, adresse, directeur de publication renseignés
- [ ] Droits RGPD listés avec email de contact
- [ ] Lien footer fonctionnel

**Notes @legal** : valider le contenu complet de la page avant lancement. Vérifier la durée de conservation des données (article 17 RGPD), la mention du DPO si applicable, et la conformité de la mention Resend comme processeur de données (art. 28 RGPD — contrat de traitement).

**Notes @fullstack** : contenu de la page dans un fichier MDX ou simple fichier .ts pour faciliter les mises à jour par Thomas sans toucher le code.

---

## Checklist de couverture user journey

### Parcours obligatoires — statut

**Acquisition et onboarding :**
- [x] Découverte / landing page → CTA principal : US-01, US-02
- [x] Inscription : N/A — pas d'authentification en V1
- [x] Vérification email / double opt-in : N/A — pas d'auth
- [x] Onboarding first-run : N/A — site vitrine, pas d'onboarding
- [x] Configuration initiale du compte : N/A — pas de compte utilisateur

**Usage principal (core loop) :**
- [x] Actions du job-to-be-done principal (Hélène propose une opportunité) : US-01 → US-02 → US-10
- [x] Navigation entre les pages : composant Navigation transversal
- [x] Recherche / filtrage : N/A — site vitrine statique
- [x] CRUD : US-10 (Create — soumission formulaire). Lecture (US-01, US-03, US-04). Pas de modification ni suppression côté visiteur.

**Paiement et abonnement :**
- N/A — holding non commerçante, pas de transaction sur le site

**Gestion de compte :**
- N/A — pas de compte utilisateur en V1

**Droits RGPD :**
- [x] Retrait du consentement cookies : N/A — Plausible sans cookies
- [x] Accès aux données personnelles (art. 15) : US-13 (politique de confidentialité avec email de contact)
- [x] Rectification (art. 16) : US-13
- [x] Effacement (art. 17) : US-13
- [x] Opposition (art. 21) : US-13
- [x] Information sur traitements IA : N/A — pas d'IA en production en V1

**Erreurs et edge cases transversaux :**
- [x] Session expirée : N/A — pas d'auth en V1
- [x] Perte de connexion : US-10 (erreur réseau timeout → message d'erreur + retry)
- [x] URL invalide → 404 : US-01 (critère d'acceptance)
- [x] Accès non autorisé → 403 : N/A — site entièrement public
- [x] Double soumission formulaire : US-10 (critère cas limite double-clic)
- [x] Retour arrière navigateur : US-02 (critère cas limite)

**Multi-utilisateurs / permissions :**
- N/A — site public sans authentification. Rôle unique : visiteur anonyme.

**Réactivation :**
- N/A — pas de compte utilisateur, pas d'email de réactivation en V1

---

## Matrice de traçabilité User Stories → Tests (Gate G27)

| US | Titre | Page | Agent test (@qa) | Test E2E |
|---|---|---|---|---|
| US-01 | Comprendre l'identité ISSA Capital | Accueil | À dériver par @qa | test-accueil-hero.spec.ts |
| US-02 | Naviguer vers Opportunités depuis Accueil | Accueil → Opportunités | À dériver par @qa | test-navigation-cta.spec.ts |
| US-03 | Comprendre la mission et l'identité familiale | Mission | À dériver par @qa | test-mission.spec.ts |
| US-04 | Explorer les participations | Participations | À dériver par @qa | test-participations.spec.ts |
| US-10 | Soumettre une proposition d'investissement | Opportunités | À dériver par @qa | test-formulaire-opportunite.spec.ts |
| US-11 | Protection anti-spam | API | À dériver par @qa | test-antispam.spec.ts |
| US-12 | Envoyer un message de contact générique | Contact | À dériver par @qa | test-formulaire-contact.spec.ts |
| US-13 | Consulter les mentions légales | Mentions légales | À dériver par @qa | test-mentions-legales.spec.ts |

[NOTE @qa : cette matrice est le point de départ. Chaque US doit avoir au moins 1 test E2E Playwright correspondant dans TESTING.md. Les scénarios persona concrets de chaque US sont la source de vérité pour dériver les cas de test.]

---

**Handoff → @ux + @design + @copywriter (en parallèle)**
- Fichiers produits : `docs/product/functional-specs.md`
- Décisions prises :
  - 8 user stories (US-01 à US-13 avec gaps sur US-05 à US-09 intentionnellement non utilisés — numérotation réservée aux stories @ux si nécessaires)
  - Formulaire Opportunités = 7 champs (dont 1 optionnel) + consentement RGPD
  - Composant formulaire réutilisable entre /opportunites et /contact
  - Page Mentions légales : noindex, 3 sections
  - Données participations : fichier config participations.ts (statique)
  - Données partiellement inconnues (Gradient One, Versi Immo, Versi Invest) — @copywriter prépare des textes sobres institutionnels en attente
- Points d'attention :
  - US-10 est la story critique. @ux doit soigner la conception du formulaire (qualifier sans intimider Hélène)
  - L'identité libanaise DOIT apparaître dans la page Mission (US-03) — vérification @qa obligatoire
  - @legal valide la page Mentions légales avant lancement (durée conservation, mention Resend comme processeur)
  - [HYPOTHÈSE A1] contenu 4 participations non documentées → @copywriter prépare textes sobres, Thomas valide avant Phase 2



