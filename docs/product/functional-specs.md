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
- CTA sticky : 2 CTAs distincts — "Mission de conseil" → /accompagnement ET "Proposer une opportunité" → /opportunites#formulaire — à arbitrer avec @design sur l'affichage mobile (1 ou 2 boutons dans la navbar sticky)
- Responsive : menu hamburger sur mobile (breakpoint Tailwind md = 768px)

**Comportement :**
- Lien actif : classe CSS `active` sur le lien de la page courante
- Sur scroll : navbar devient légèrement opaque (backdrop-blur) — à confirmer avec @design
- CTAs "Mission de conseil" et "Proposer une opportunité" : visibles sur toutes les pages sauf leurs pages cibles respectives (/accompagnement et /opportunites) où ils sont redondants avec le contenu visible

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

- **CTA A** : "Parler avec Thomas" → /accompagnement (cible Karim)
- **CTA B** : "Proposer une opportunité d'investissement" → /opportunites#formulaire (cible Leila)
- **CTA secondaire** : "Notre mission →" → /mission | "Voir les participations →" → /participations

### Liens

- Internes : /mission, /participations, /accompagnement, /opportunites#formulaire
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

**Persona** : Karim (entrepreneur en structuration patrimoniale) — persona principal A
**Epic** : Découverte et premier contact
**Dépendances** : Aucune
**Priorité RICE** : R=100 I=10 C=9 E=1 → Score=900

**Job-to-be-done**
En tant que Karim, je veux comprendre en moins de 10 secondes qui est ISSA Capital et ce qu'elle propose, afin de décider si Thomas Issa est l'interlocuteur pertinent pour ma structuration patrimoniale — ou si je dois explorer le CTA opportunités pour un deal à soumettre (Leila).

**Contexte de navigation**
- Page/écran d'origine : résultat de recherche Google, lien LinkedIn ou recommandation réseau
- Déclencheur : visite directe sur issa-capital.com
- Page/écran de destination (succès) : Karim reste sur la page et fait défiler vers les sections suivantes, ou clique sur CTA A "Parler avec Thomas" → /accompagnement ; Leila clique sur CTA B "Proposer une opportunité" → /opportunites
- Page/écran de destination (échec) : le visiteur quitte immédiatement (bounce) — identité de la holding pas claire en moins de 10s

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
- [ ] GIVEN le visiteur fait défiler la page THEN les 5 sections (Hero, Chapeau mission, Écosystème, Philosophie, CTA double entrée) sont toutes présentes et lisibles
- [ ] GIVEN la section CTA de conversion est affichée WHEN le visiteur lit THEN les 2 CTAs sont visibles : CTA A "Parler avec Thomas" → /accompagnement ET CTA B "Proposer une opportunité" → /opportunites#formulaire

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

1. Karim cherche "holding patrimoniale conseil structuration entrepreneur" sur Google un mardi matin. Il clique sur le résultat issa-capital.com. En 5 secondes, il voit le headline avec "famille libanaise" et "générations à venir". Il se dit "c'est différent d'un CGP". Il fait défiler et clique sur CTA A "Parler avec Thomas".
2. Leila, apporteur d'affaires, reçoit le nom "ISSA Capital" dans un email d'un notaire partenaire. Elle tape l'URL directement. Elle voit le CTA B "Proposer une opportunité" dans le hero et la section de conversion — elle comprend que c'est une holding qui investit activement dans l'immo et peut se décider vite.
3. Marc, journaliste, arrive via LinkedIn après avoir vu un post de Thomas Issa. Il cherche des informations factuelles sur la holding. Il fait défiler et trouve la section Écosystème avec les 6 entités nommées. Il note l'URL gradientone.fr et immocrew.fr pour les consulter.
4. Leila revient sur le site 3 jours après sa première visite. La page est identique (site statique). Elle clique directement sur "Proposer une opportunité" sans relire le hero.
5. Un visiteur mobile (iPhone 13, 375px) arrive sur le site via un partage WhatsApp. La page s'affiche correctement en responsive. Les 2 CTAs sont accessibles du pouce en bas d'écran.

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

**Persona** : Leila (apporteur d'affaires immo / fondateur cherchant co-investisseur) — persona principal B
**Epic** : Découverte et premier contact
**Dépendances** : US-01 (page Accueil doit exister), US-10 (page Opportunités avec formulaire)
**Priorité RICE** : R=100 I=10 C=9 E=1 → Score=900

**Job-to-be-done**
En tant que Leila, je veux cliquer sur le CTA "Proposer une opportunité" depuis la page d'accueil afin d'accéder directement au formulaire de soumission de deal sans friction.

**Contexte de navigation**
- Page/écran d'origine : Accueil (issa-capital.com)
- Déclencheur : clic sur CTA B "Proposer une opportunité d'investissement" (Hero ou section double CTA)
- Page/écran de destination (succès) : Page Opportunités (/opportunites), avec scroll automatique vers l'ancre #formulaire
- Page/écran de destination (échec) : erreur de navigation → page 404 ou rechargement Accueil

**Données et champs** : N/A — navigation pure

**5 états UI** : N/A — transition de navigation (voir états UI US-10 pour la destination)

**Critères d'acceptance**

Happy path :
- [ ] GIVEN Leila est sur la page Accueil WHEN elle clique sur "Proposer une opportunité d'investissement" (Hero) THEN elle est redirigée vers /opportunites avec scroll automatique sur l'ancre #formulaire en <500ms
- [ ] GIVEN Leila est sur la page Accueil WHEN elle clique sur CTA B dans la section double CTA THEN même comportement que ci-dessus
- [ ] GIVEN la navigation principale est affichée WHEN Leila clique sur "Opportunités" dans le menu THEN elle est redirigée vers /opportunites (sans ancre — haut de page)

Cas d'erreur :
- [ ] GIVEN une erreur de routage Next.js WHEN le CTA est cliqué THEN Leila reste sur la page courante et l'erreur est loggée côté serveur (pas de page blanche)

Cas limites :
- [ ] GIVEN Leila est sur mobile 375px WHEN elle clique sur le CTA sticky en navigation THEN le scroll vers #formulaire fonctionne correctement (pas de décalage dû à la navbar sticky)
- [ ] GIVEN Leila utilise le bouton "Retour" du navigateur depuis /opportunites THEN elle revient sur l'Accueil sans erreur

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

1. Leila a lu le hero et identifie que c'est une holding qui investit dans l'immo. Elle clique sur CTA B "Proposer une opportunité". La page Opportunités s'ouvre et le formulaire est visible dans les 2 premières secondes.
2. Leila fait défiler la page entière et clique sur CTA B dans la section double CTA. Même résultat.
3. Marc navigue depuis la navbar : il clique sur "Opportunités" dans le menu pour comprendre la thèse d'investissement. Il arrive en haut de la page Opportunités, pas directement sur le formulaire.
4. Leila sur mobile clique sur le CTA visible dans la navbar sticky. L'ancre #formulaire déroule correctement malgré la navbar fixe en haut.
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

Expliquer QUI est la famille Issa, POURQUOI elle a créé ISSA Capital, et COMMENT elle prend ses décisions d'investissement — pour convaincre Karim que Thomas est un pair compétent, et convaincre Leila que la holding a une thèse d'investissement sérieuse et lisible.

### Audience prioritaire

Karim (persona principal A) — il a vu l'accroche sur l'Accueil, il veut creuser la crédibilité et le profil de Thomas avant de déclencher une prise de contact. Marc (persona secondaire) — cherche des éléments éditoriaux sur la thèse d'investissement.

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
- CTA A : "Parler avec Thomas" → /accompagnement (cible Karim — il est convaincu, il passe à l'action)
- CTA B : "Proposer une opportunité" → /opportunites#formulaire (cible Leila — elle a validé la thèse)
- CTA tertiaire : "Voir nos participations →" → /participations

### États UI

| État | Comportement | Message/Affichage |
|---|---|---|
| Défaut | Page statique éditoriale | Contenu texte et sections visibles |
| Loading | N/A — statique | N/A |
| Vide | N/A | N/A |
| Erreur | URL invalide | Page 404 |
| Succès | N/A — consultation pure | N/A |

### CTAs

- **CTA A** : "Parler avec Thomas" → /accompagnement (cible Karim)
- **CTA B** : "Proposer une opportunité d'investissement" → /opportunites#formulaire (cible Leila)
- **CTA tertiaire** : "Voir nos participations →" → /participations

### Liens

- Internes : /participations, /accompagnement, /opportunites#formulaire
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

**Persona** : Karim (entrepreneur en structuration patrimoniale) — persona principal A
**Epic** : Découverte et crédibilité institutionnelle
**Dépendances** : US-01 (visite Accueil)
**Priorité RICE** : R=90 I=9 C=8 E=1 → Score=648

**Job-to-be-done**
En tant que Karim, je veux lire la mission et l'histoire d'ISSA Capital afin de vérifier que Thomas a un vrai point de vue et une logique d'investissement cohérente — pas des platitudes corporatives — et décider si c'est le bon interlocuteur pour ma structuration patrimoniale.

**Contexte de navigation**
- Page/écran d'origine : Accueil (clic "Notre mission →")
- Déclencheur : clic sur lien "Notre mission →" depuis la page Accueil ou clic "Mission" dans la navigation
- Page/écran de destination (succès) : Karim fait défiler la page entière et clique sur CTA A "Parler avec Thomas"
- Page/écran de destination (échec) : Karim quitte (bounce) si le contenu semble vague ou trop institutionnel

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
- [ ] GIVEN Karim clique sur "Notre mission →" depuis l'Accueil WHEN la page se charge THEN /mission s'affiche avec le titre h1 visible sans scroll
- [ ] GIVEN la page Mission est chargée WHEN Karim lit la section "Histoire et identité" THEN le texte mentionne explicitement "famille libanaise" (jamais "famille française")
- [ ] GIVEN la page Mission est chargée WHEN Karim lit la section "Filtres de décision" THEN les 3 filtres (patrimoine long-terme, éthique humaine, environnement) sont présentés comme critères de SÉLECTION et non comme finalité de la holding
- [ ] GIVEN Karim fait défiler jusqu'au CTA de sortie WHEN il le voit THEN les 2 CTAs sont présents : CTA A "Parler avec Thomas" → /accompagnement ET CTA B "Proposer une opportunité" → /opportunites#formulaire

Cas d'erreur :
- [ ] GIVEN une URL /mission invalide ou indisponible WHEN le visiteur arrive THEN une page 404 s'affiche avec lien retour Accueil

Cas limites :
- [ ] GIVEN Karim utilise un lecteur d'écran WHEN il navigue sur la page THEN les sections sont correctement balisées h1/h2/h3 pour la navigation par titres (accessibilité WCAG 2.2)
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

1. Karim a vu le hero sur l'Accueil et clique sur "Notre mission". Il lit la section Histoire : il comprend que c'est une famille libanaise établie en France, qui a construit des sociétés réelles avant de créer une holding. Il se dit "Thomas a fait le chemin avant moi, c'est ce que je cherchais".
2. Leila arrive directement sur /mission via un lien partagé. Elle lit les filtres de décision en diagonale en 2 minutes pour valider que son deal immobilier entre dans la logique d'investissement d'ISSA Capital.
3. Karim lit la section "Filtres de décision" et voit l'horizon intergénérationnel — pas de revente à 5-7 ans. Il se reconnaît dans cette logique de construction patrimoniale.
4. Marc (journaliste) arrive sur /mission et lit le chapeau pour citer la mission officielle dans son article.
5. Karim fait défiler jusqu'au CTA de sortie et clique sur CTA A "Parler avec Thomas". Il est redirigé vers /accompagnement.

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

Leila (persona principal B) qui veut évaluer si l'écosystème ISSA Capital prouve que la holding investit vraiment dans l'immo et les participations + Karim qui cherche la preuve par l'exemple que Thomas a construit ce qu'il décrit + Marc qui collecte des éléments factuels pour son article.

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

**Persona** : Leila (apporteur d'affaires immo / fondateur cherchant co-investisseur) — persona principal B
**Epic** : Crédibilité institutionnelle
**Dépendances** : US-01
**Priorité RICE** : R=80 I=8 C=8 E=1 → Score=512

**Job-to-be-done**
En tant que Leila, je veux voir toutes les participations d'ISSA Capital en un coup d'oeil afin d'évaluer en 5 minutes que la holding investit vraiment dans l'immo et des projets réels — preuve qu'elle peut suivre sur mon deal — avant de soumettre une opportunité.

**Contexte de navigation**
- Page/écran d'origine : Accueil (clic "Voir les participations →") ou navigation directe
- Déclencheur : clic sur lien Participations dans la nav ou le CTA Accueil
- Page/écran de destination (succès) : Leila visualise les 6 cartes, confirme que l'immo et les participations sont dans le scope, clique sur CTA B "Proposer une opportunité"
- Page/écran de destination (échec) : cartes incomplètes ou trop vagues → Leila quitte sans conviction sur la capacité d'investissement réelle

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
- [ ] GIVEN Leila accède à /participations WHEN la page se charge THEN les 6 entités (Gradient One, Versi Immobilier, Versi Invest, Immocrew, Versimo, Immobilier en direct) sont toutes visibles
- [ ] GIVEN la grille est affichée WHEN Leila clique sur "Voir le site" d'Immocrew THEN immocrew.fr s'ouvre dans un nouvel onglet (target="_blank")
- [ ] GIVEN la grille est affichée WHEN Leila clique sur "Voir le site" de Versimo THEN versimo.fr s'ouvre dans un nouvel onglet
- [ ] GIVEN une entité n'a pas de site public (Versi Immobilier, Versi Invest) WHEN la carte est affichée THEN le bouton "Voir le site" est absent (pas de lien mort)

Cas d'erreur :
- [ ] GIVEN un lien externe (immocrew.fr) est temporairement inaccessible WHEN Leila clique dessus THEN le navigateur affiche l'erreur de l'onglet externe (hors contrôle du site ISSA)

Cas limites :
- [ ] GIVEN les descriptions de Gradient One et Versi Immobilier ne sont pas encore disponibles WHEN la page est mise en ligne THEN les cartes affichent un texte institutionnel sobre (pas de placeholder "[À COMPLÉTER]" visible côté utilisateur)
- [ ] GIVEN Leila utilise un iPad (768px) WHEN la grille est affichée THEN les cartes sont affichées en 2 colonnes (responsive)

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

1. Leila reçoit le nom ISSA Capital dans un email d'un notaire. Elle va sur /participations. En 2 minutes elle identifie "Versi Immobilier", "Immobilier en direct" et "Versimo" (PropTech immo). Elle confirme qu'ISSA Capital investit vraiment dans l'immo. Elle clique sur CTA B "Proposer une opportunité".
2. Karim consulte les participations pour vérifier la cohérence de l'écosystème. Il voit Gradient One (tech), Immocrew (services mandataires), des actifs immo directs. Il comprend que Thomas a construit plusieurs structures, pas juste une holding coquille.
3. Marc (journaliste) arrive sur /participations pour lister les entités dans son article. Il note les 6 noms et les secteurs.
4. Un visiteur mobile fait défiler les cartes sur iPhone. Les cartes sont en colonne unique, lisibles sans zoom.
5. Leila revient sur le site 1 semaine plus tard pour montrer les participations à un associé. Les données sont identiques (statiques). Elle retrouve les informations sans surprise.

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

Expliquer les critères d'investissement d'ISSA Capital (immobilier, participations) et collecter des opportunités qualifiées via le formulaire 7 champs. C'est la pièce maîtresse du site — celle qui convertit Leila en lead qualifié et nourrit le KPI North Star (pipeline d'opportunités).

### Audience prioritaire

Leila (persona principal B) — elle a un deal, elle a lu les critères, elle veut soumettre vite. Cette page doit lui permettre de qualifier son deal en 90 secondes et soumettre le formulaire en moins de 5 minutes. L'architecture de la page est autonome : /opportunites est une page distincte (pas une ancre de la page Accueil).

### Sections obligatoires

1. **Titre de page + chapeau** — ce qu'ISSA cherche en 2-3 lignes
2. **Ce qu'ISSA recherche** — secteurs, horizons, tailles de projets, critères de sélection
3. **Ce qu'ISSA ne fait pas** — les exclusions claires (contre-exemple : fonds LBO, secteurs éthiquement exclus)
4. **Le processus de contact** — que se passe-t-il après la soumission (réassurance)
5. **Formulaire de proposition** — champs qualifiants, ancré sur #formulaire
6. **Réassurance post-formulaire** — message de confirmation que chaque proposition est lue

### Contenu attendu par section

**Ce qu'ISSA recherche :**
- Secteurs cibles : à préciser [HYPOTHÈSE : Thomas à confirmer les secteurs prioritaires. En attendant : immobilier résidentiel/commercial IDF et régions, participations dans des PME et structures opérationnelles — cohérent avec l'écosystème existant]
- Tailles de tickets : à confirmer [HYPOTHÈSE : 200 K€ à 2 M€ pour l'immo, 300 K€ à 1,5 M€ pour les participations — basé sur le profil Leila dans personas.md]
- Horizon : partenariat long-terme, pas de revente à horizon fixe
- Profils recherchés : apporteurs d'affaires immobiliers (Leila) ou fondateurs cherchant un co-investisseur ou actionnaire minoritaire long-terme
- Critères de filtre : projets compatibles avec les 3 filtres (patrimoine long-terme, éthique humaine, environnement)

**Ce qu'ISSA ne fait pas :**
- Investissement spéculatif court-terme
- Secteurs contraires à l'éthique humaine [HYPOTHÈSE : Thomas à confirmer les secteurs exclus]
- Projets sans perspective de transmission générationnelle

**Le processus de contact :**
- Étape 1 : soumission du formulaire
- Étape 2 : Thomas Issa lit personnellement chaque opportunité qualifiée (réassurance)
- Étape 3 : réponse dans la journée (délai verrouillé par Thomas — signal clé de réactivité pour Leila)

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

#### US-10 : Soumettre une opportunité d'investissement

**Persona** : Leila (apporteur d'affaires immo / fondateur cherchant co-investisseur) — persona principal B
**Epic** : Conversion — génération de leads qualifiés (KPI North Star)
**Dépendances** : US-01, US-02 (navigation depuis Accueil) ; infrastructure Resend (ou équivalent) pour l'envoi d'email
**Priorité RICE** : R=100 I=10 C=9 E=2 → Score=450

**Job-to-be-done**
En tant que Leila, je veux remplir et soumettre un formulaire de soumission de deal (7 champs qualifiants) afin qu'ISSA Capital reçoive les informations essentielles sur mon opportunité et me réponde dans la journée.

**Contexte de navigation**
- Page/écran d'origine : Accueil (CTA Hero), Mission (CTA sortie), Participations (CTA sortie), navigation directe
- Déclencheur : clic sur n'importe quel CTA "Proposer une opportunité" du site → scroll sur ancre #formulaire
- Page/écran de destination (succès) : le formulaire est remplacé par un message de confirmation
- Page/écran de destination (échec) : le formulaire reste visible avec les erreurs inline, aucune donnée perdue

**Données et champs (7 champs qualifiants CTA B — formulaire Leila)**
| Champ | Type | Obligatoire | Validation | Limites | Exemple |
|---|---|---|---|---|---|
| prenom_nom | string | Oui | Non vide, pas de chiffres | 2-100 caractères | "Leila Mansouri" |
| email | email | Oui | Format RFC 5322 (regex email standard) | 5-254 caractères | "leila@apportaffaires.fr" |
| telephone | string | Oui | Format FR (validation souple) | 6-20 caractères | "06 12 34 56 78" |
| type_opportunite | enum | Oui | Valeur parmi la liste | — | "Immobilier résidentiel" |
| localisation | string | Oui | Non vide | 2-200 caractères | "Montreuil (93) — Île-de-France" |
| ticket_estime | enum | Oui | Valeur parmi la liste | — | "500 K€ — 1 M€" |
| description_opportunite | string (textarea) | Oui | Non vide, min 50 caractères | 50-2000 caractères | "Immeuble de rapport 8 lots, rendement brut 6,2%..." |
| consentement_rgpd | boolean | Oui | Doit être coché pour soumettre | — | true |

**Valeurs enum type_opportunite :**
Immobilier résidentiel | Immobilier commercial | Participation dans une société | Projet de développement immobilier | Autre

**Valeurs enum ticket_estime :**
< 200 K€ | 200 K€ — 500 K€ | 500 K€ — 1 M€ | 1 M€ — 2 M€ | > 2 M€

**5 états UI**
| État | Comportement | Message/Affichage |
|---|---|---|
| Défaut | Formulaire vide avec labels et placeholders | Tous les champs vides, bouton "Envoyer ma proposition" actif |
| Loading | Soumission en cours (appel API Resend) | Bouton désactivé, libellé "Envoi en cours...", spinner inline — max 5 secondes |
| Vide | N/A — formulaire toujours présent | N/A |
| Erreur | Erreur de validation (client) ou erreur API (serveur) | Erreur inline sous chaque champ invalide (rouge, texte explicite). Si erreur serveur : message global "Une erreur est survenue. Veuillez réessayer ou nous contacter directement à [email ISSA Capital]." |
| Succès | Email envoyé via Resend | Formulaire remplacé par bloc : "Merci [prénom]. Votre opportunité a bien été reçue. Thomas Issa vous répondra dans la journée." — CTA secondaire "Revenir à l'accueil" |

**Critères d'acceptance**

Happy path :
- [ ] GIVEN Leila arrive sur /opportunites#formulaire WHEN elle voit le formulaire THEN les 7 champs obligatoires sont visibles et le bouton "Soumettre mon opportunité" est présent
- [ ] GIVEN Leila remplit tous les champs obligatoires avec des données valides WHEN elle clique sur "Soumettre mon opportunité" THEN le bouton passe en état Loading (désactivé + "Envoi en cours...")
- [ ] GIVEN le formulaire est en état Loading WHEN Resend envoie l'email avec succès THEN le formulaire est remplacé par le message de confirmation avec le prénom de Leila
- [ ] GIVEN le formulaire est soumis avec succès WHEN Thomas consulte sa boîte email THEN il reçoit un email formaté avec tous les champs remplis par Leila (nom, email, téléphone, type d'opportunité, localisation, ticket estimé, description)

Cas d'erreur :
- [ ] GIVEN Leila soumet le formulaire avec l'email vide WHEN elle clique "Soumettre" THEN un message d'erreur "L'email est obligatoire" s'affiche sous le champ email, la soumission est bloquée
- [ ] GIVEN Leila saisit "leila@" (email invalide) WHEN elle clique "Soumettre" THEN un message "Format d'email invalide" s'affiche sous le champ email
- [ ] GIVEN Leila soumet le formulaire sans cocher le consentement RGPD WHEN elle clique "Soumettre" THEN un message "Vous devez accepter la politique de confidentialité pour continuer" s'affiche et la soumission est bloquée
- [ ] GIVEN Resend retourne une erreur 5xx WHEN le formulaire est soumis THEN le message global d'erreur serveur s'affiche, le formulaire reste rempli (données non perdues), le bouton redevient actif pour réessayer
- [ ] GIVEN une erreur réseau (timeout) WHEN la soumission est en cours depuis plus de 5 secondes THEN le loading s'arrête, le message d'erreur réseau s'affiche avec l'option de réessayer

Cas limites :
- [ ] GIVEN Leila double-clique sur "Soumettre mon opportunité" WHEN la première soumission est en cours THEN le deuxième clic est ignoré (bouton désactivé pendant le loading)
- [ ] GIVEN Leila saisit 2001 caractères dans le champ description WHEN elle tape le 2001ème caractère THEN le champ est bloqué à 2000 caractères avec un compteur visible "2000/2000"
- [ ] GIVEN Leila utilise le bouton "Retour" du navigateur depuis la page de confirmation WHEN elle revient sur le formulaire THEN le formulaire est vide (pas de pré-remplissage des données précédentes)
- [ ] GIVEN Leila a une session expirée (si jamais auth ajoutée en V2) THEN N/A en V1 — pas d'authentification

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
  "telephone": "string (6-20 chars)",
  "type_opportunite": "enum ImmobilierResidentiel|ImmobilierCommercial|ParticipationSociete|DeveloppementImmobilier|Autre",
  "localisation": "string (2-200 chars)",
  "ticket_estime": "enum <200K|200K-500K|500K-1M|1M-2M|>2M",
  "description_opportunite": "string (50-2000 chars)",
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

1. Leila arrive depuis la page Accueil (CTA B Hero). Elle lit les critères d'investissement — son deal immobilier à Montreuil entre dans la grille. Elle voit le formulaire, remplit les 7 champs en 3 minutes. Elle coche le consentement RGPD et clique "Soumettre mon opportunité". Confirmation visible : "Merci Leila. Votre opportunité a bien été reçue. Thomas Issa vous répondra dans la journée."
2. Leila oublie de remplir le champ "Localisation". Elle clique "Soumettre". Un message rouge s'affiche sous le champ : "La localisation est obligatoire". Elle corrige et soumet.
3. Leila rédige une description de 10 caractères. Elle essaie de soumettre. Message : "La description doit contenir au moins 50 caractères". Elle détaille son deal.
4. Resend est temporairement indisponible quand Leila soumet. Elle voit "Une erreur est survenue. Veuillez réessayer". Elle patiente 30 secondes et réessaie avec succès. Elle a 24h avant que son deal parte à un concurrent — le retry rapide est critique.
5. Marc (journaliste) veut comprendre le processus. Il ouvre le formulaire et lit les champs sans les remplir. Il comprend que la holding demande une localisation et un ticket estimé — signe d'une thèse d'investissement structurée.

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

**Notes @fullstack** : utiliser React Hook Form + Zod pour la validation côté client. API route Next.js avec validation serveur indépendante (ne pas faire confiance au client seul). Resend comme service d'envoi email. Variables d'environnement : RESEND_API_KEY, EMAIL_DESTINATION (email Thomas). Ne PAS logguer les données personnelles dans les logs serveur. L'email envoyé à Thomas doit taguer `[OPPORTUNITE]` dans le sujet pour distinguer des messages de contact génériques.

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
3. Leila soumet une fois. Elle ne voit aucun comportement différent (rate limit non atteint).

**Definition of Done (@fullstack)**
- [ ] Honeypot field implémenté (caché en CSS, jamais rempli par les humains)
- [ ] Rate limiting configuré (5 req/min/IP)
- [ ] Rejet silencieux si honeypot rempli
- [ ] Test : soumission bot avec honeypot rempli → 0 email reçu

**Notes @qa** : tester le honeypot avec un champ rempli manuellement via DevTools. Tester le rate limiting avec curl en rafale.

**Notes @fullstack** : rate limiting via middleware Next.js ou librairie upstash/ratelimit. Honeypot : champ `<input name="_hp" tabindex="-1" autocomplete="off" style="display:none">`. Si rempli côté serveur → retourner 200 mais ne pas appeler Resend.

---

## Page /accompagnement — Mission de conseil & accompagnement (CTA A — Karim)

### Objectif

Présenter l'expertise de Thomas Issa dans ses 6 catégories d'intervention et permettre à Karim d'ouvrir une conversation via un formulaire court 4 champs. Page distincte de /opportunites (Thomas a validé 2 pages séparées).

### Audience prioritaire

Karim (persona principal A) — entrepreneur de 40 ans en structuration patrimoniale, cherche un pair qui a fait le chemin avant lui, pas un prestataire.

### Sections obligatoires

1. **Titre de page + chapeau** — qui est Thomas Issa et pour qui il intervient (2-3 lignes directes, sans langue de bois)
2. **6 domaines d'intervention** — liste des thématiques [HYPOTHÈSE : à valider par Thomas — voir personas.md section "Expertise Thomas attendue par Karim"]
3. **Ce que n'est pas cette mission** — différenciation vs CGP, expert-comptable, formation en ligne
4. **Formulaire de prise de contact 4 champs** (CTA A) — ancré sur #contact-accompagnement
5. **Réassurance** — "Premier échange sans engagement"

### Contenu attendu par section

**Formulaire CTA A (4 champs) :**
- prenom_nom, email, sujet (texte libre — "ma situation en 1 ligne"), message (contexte et question)
- Pas de champs qualifiants lourds — Karim veut une conversation, pas un formulaire de candidature
- Consentement RGPD : même checkbox standard

**Réassurance :**
- Délai de réponse : [HYPOTHÈSE — à confirmer par Thomas, ex : "Réponse sous 48h"]
- Ton : direct, sans formulaire de surface ("Pas de pitch commercial. Juste une conversation entre gens qui ont les mêmes questions.")

### États UI

| État | Comportement | Message/Affichage |
|---|---|---|
| Défaut | Page statique + formulaire vide | Sections visibles, formulaire accessible |
| Loading | Soumission en cours | Bouton désactivé + "Envoi en cours..." |
| Vide | N/A | N/A |
| Erreur | Validation ou erreur API | Messages d'erreur inline |
| Succès | Email envoyé | Formulaire remplacé par confirmation |

### CTAs

- **CTA primaire** : bouton "Démarrer la conversation" dans le formulaire → POST /api/contact (type=accompagnement)
- **CTA secondaire** : "Voir nos participations →" → /participations (preuve par l'exemple)

### Contraintes RGPD

- Même traitement que le formulaire /opportunites (consentement, mention responsable de traitement, Resend comme processeur)

### Contraintes SEO

- `<title>` : "Mission de conseil — ISSA Capital | Accompagnement patrimonial entrepreneur"
- `<meta name="description">` : "Thomas Issa accompagne les entrepreneurs en structuration patrimoniale. Holding, immo direct, participations — premier échange sans engagement."
- `<h1>` : "Mission de conseil & accompagnement" ou équivalent validé par @copywriter

---

### User Stories — Page /accompagnement

#### US-A1 : Comprendre en 30 secondes si Thomas peut aider pour ma structuration patrimoniale

**Persona** : Karim (entrepreneur en structuration patrimoniale) — persona principal A
**Epic** : Acquisition CTA A — Mission de conseil
**Dépendances** : US-01 (visite Accueil, clic CTA A)
**Priorité RICE** : R=100 I=10 C=8 E=1 → Score=800

#### Job-to-be-done
En tant que Karim, je veux lire en 30 secondes ce que Thomas Issa propose concrètement comme mission de conseil, afin de décider si son profil est pertinent pour ma situation avant d'ouvrir une conversation.

#### Contexte de navigation
- **Page/écran d'origine** : Accueil (clic CTA A "Parler avec Thomas") ou navigation directe
- **Déclencheur** : clic sur CTA A dans la nav, le hero, ou la section double CTA
- **Page/écran de destination (succès)** : Karim lit les domaines d'intervention, se reconnaît dans au moins un, fait défiler vers le formulaire
- **Page/écran de destination (échec)** : Karim quitte si le contenu semble trop vague ou trop institutionnel

#### Données et champs
| Champ | Type | Obligatoire | Validation | Limites | Exemple |
|---|---|---|---|---|---|
| N/A — page de consultation | — | — | — | — | — |

#### 5 états UI
| État | Comportement | Message/Affichage |
|---|---|---|
| Défaut | Page statique, titre et chapeau visibles sans scroll | Titre h1 + liste des 6 domaines above the fold (desktop) |
| Loading | N/A — statique | N/A |
| Vide | N/A | N/A |
| Erreur | URL invalide | Page 404 avec lien retour Accueil |
| Succès | N/A — consultation pure | N/A |

#### Critères d'acceptance (format Given/When/Then)

**Happy path :**
- [ ] GIVEN Karim clique sur CTA A depuis l'Accueil WHEN la page /accompagnement se charge THEN le titre h1 et le chapeau sont visibles sans scroll sur desktop (1280px) et mobile (375px)
- [ ] GIVEN la page est chargée WHEN Karim lit les domaines d'intervention THEN au moins 6 thématiques concrètes sont listées (ex: holding patrimoniale, immo direct, participations — [HYPOTHÈSE : Thomas valide la liste])
- [ ] GIVEN la page est chargée WHEN Karim fait défiler THEN la section "Ce que n'est pas cette mission" est présente et distingue Thomas d'un CGP

**Cas d'erreur :**
- [ ] GIVEN l'URL /accompagnement est invalide WHEN le visiteur arrive THEN page 404 avec lien retour Accueil
- [ ] GIVEN le contenu biographique de Thomas n'est pas finalisé WHEN la page est mise en ligne THEN un texte sobre est présent (aucun placeholder visible)

**Cas limites :**
- [ ] GIVEN Karim utilise un lecteur d'écran WHEN il navigue THEN les sections sont balisées h1/h2/h3 (WCAG 2.2)
- [ ] GIVEN Karim est sur mobile 375px WHEN il fait défiler THEN le formulaire 4 champs est accessible sans zoom (touch targets >= 44x44px)

**Permissions :**
- [ ] GIVEN tout visiteur WHEN il accède à /accompagnement THEN la page est accessible sans authentification

**Données existantes :**
- [ ] GIVEN que Thomas ajoute ou supprime un domaine d'intervention WHEN le fichier de contenu est mis à jour THEN la liste sur la page reflète les nouveaux domaines

#### Payload API : N/A — page de consultation pure

#### Events analytics
| Event | Trigger | Propriétés | Funnel |
|---|---|---|---|
| page_view | Chargement /accompagnement | referrer, device_type | acquisition |
| scroll_depth | Scroll 50% et 100% | scroll_pct=50/100 | activation |
| form_start | Premier focus sur un champ formulaire | — | activation |

#### Scénarios persona concrets

1. Karim clique sur CTA A depuis le hero de l'Accueil. Il arrive sur /accompagnement. En 20 secondes, il voit "structuration de holding patrimoniale" dans la liste des domaines. Il se dit "c'est exactement ce que je cherche". Il fait défiler vers le formulaire.
2. Karim lit la section "Ce que n'est pas cette mission". Il voit la distinction avec un CGP. Il pense à ses deux mauvaises expériences passées et se dit "Thomas n'est pas dans ce moule-là".
3. Marc (journaliste) arrive sur /accompagnement pour comprendre le positionnement conseil de Thomas. Il lit le chapeau et les 6 domaines pour son article.
4. Karim sur mobile (iPhone, 375px) arrive via un lien LinkedIn. La page charge en moins de 2 secondes, les domaines d'intervention sont lisibles sans zoom.
5. Karim revient sur la page 3 jours plus tard. Le contenu est identique (statique). Il clique directement sur le formulaire pour ouvrir la conversation.

#### Definition of Done (@fullstack)
- [ ] Page /accompagnement avec toutes les sections
- [ ] Liste des domaines d'intervention depuis fichier de config (facilite les mises à jour Thomas)
- [ ] CTA secondaire "/participations" fonctionnel
- [ ] Responsive validé 375px / 768px / 1280px
- [ ] Screenshot conforme au design

**Notes @qa** : vérifier que la page /accompagnement existe et n'est pas une ancre de l'Accueil. Vérifier l'absence de placeholders visibles. Tester le balisage sémantique.
**Notes @copywriter** : Karim cherche un pair, pas un prestataire. Le chapeau doit être écrit à la première personne de Thomas, direct, sans verbe "accompagner" ni "optimiser" — ces mots sentent le CGP. Verbatim clé Karim : "J'ai besoin de quelqu'un qui l'a fait".
**Notes @fullstack** : contenu des domaines d'intervention dans src/data/expertise.ts. Typer l'interface ExpertiseDomain : { titre, description }. Facilite les mises à jour sans modifier les composants.

---

#### US-A2 : Ouvrir une conversation avec Thomas via un formulaire court sans friction

**Persona** : Karim (entrepreneur en structuration patrimoniale) — persona principal A
**Epic** : Acquisition CTA A — Mission de conseil
**Dépendances** : US-A1 (page /accompagnement doit exister) ; infrastructure Resend
**Priorité RICE** : R=100 I=10 C=8 E=1 → Score=800

#### Job-to-be-done
En tant que Karim, je veux envoyer un message court en 4 champs (sans formulaire de candidature lourd) afin d'ouvrir une première conversation avec Thomas Issa sans engagement.

#### Contexte de navigation
- **Page/écran d'origine** : page /accompagnement
- **Déclencheur** : clic sur ancre interne → scroll vers #contact-accompagnement
- **Page/écran de destination (succès)** : formulaire remplacé par message de confirmation, Karim sait qu'il aura une réponse
- **Page/écran de destination (échec)** : formulaire reste visible avec erreurs inline

#### Données et champs (4 champs CTA A — formulaire Karim)
| Champ | Type | Obligatoire | Validation | Limites | Exemple |
|---|---|---|---|---|---|
| prenom_nom | string | Oui | Non vide | 2-100 caractères | "Karim Benali" |
| email | email | Oui | Format RFC 5322 | 5-254 caractères | "karim@benali-holding.fr" |
| sujet | string | Oui | Non vide | 3-200 caractères | "Structuration holding IS après cession partielle" |
| message | string (textarea) | Oui | Non vide, min 30 caractères | 30-1500 caractères | "J'ai 800 K€ à réinvestir après une sortie immo..." |
| consentement_rgpd | boolean | Oui | Doit être coché | — | true |

#### 5 états UI
| État | Comportement | Message/Affichage |
|---|---|---|
| Défaut | Formulaire 4 champs vide | Labels visibles, bouton "Démarrer la conversation" actif |
| Loading | Soumission en cours | Bouton désactivé, "Envoi en cours...", spinner |
| Vide | N/A — formulaire toujours présent | N/A |
| Erreur | Validation client ou erreur API | Messages d'erreur inline par champ + message global si erreur serveur |
| Succès | Email envoyé | Formulaire remplacé par : "Merci [prénom]. Thomas vous lira et répondra dans les meilleurs délais. Premier échange sans engagement." |

#### Critères d'acceptance (format Given/When/Then)

**Happy path :**
- [ ] GIVEN Karim arrive sur #contact-accompagnement WHEN il voit le formulaire THEN les 4 champs et le bouton "Démarrer la conversation" sont visibles
- [ ] GIVEN Karim remplit les 4 champs valides et coche le consentement WHEN il clique "Démarrer la conversation" THEN le bouton passe en Loading
- [ ] GIVEN le formulaire est en Loading WHEN Resend envoie l'email THEN le formulaire est remplacé par le message de confirmation avec le prénom de Karim
- [ ] GIVEN le formulaire est soumis WHEN Thomas consulte sa boîte THEN il reçoit un email tagué `[ACCOMPAGNEMENT]` avec les 4 champs

**Cas d'erreur :**
- [ ] GIVEN Karim soumet avec email vide WHEN il clique THEN message "L'email est obligatoire" sous le champ
- [ ] GIVEN Karim saisit "karim@" WHEN il clique THEN message "Format d'email invalide"
- [ ] GIVEN Karim ne coche pas le consentement RGPD WHEN il clique THEN message "Vous devez accepter la politique de confidentialité pour continuer"
- [ ] GIVEN Resend retourne une erreur 5xx WHEN Karim soumet THEN message d'erreur serveur global, formulaire reste rempli, bouton redevient actif

**Cas limites :**
- [ ] GIVEN Karim double-clique sur "Démarrer la conversation" WHEN la première soumission est en cours THEN le deuxième clic est ignoré
- [ ] GIVEN Karim saisit 1501 caractères dans le champ message WHEN il tape le 1501ème THEN le champ est bloqué à 1500 avec compteur "1500/1500"
- [ ] GIVEN Karim retourne en arrière depuis la confirmation WHEN il revient sur /accompagnement THEN le formulaire est vide

**Permissions :**
- [ ] GIVEN tout visiteur WHEN il soumet le formulaire /accompagnement THEN la soumission est acceptée sans authentification

**Données existantes :**
- [ ] GIVEN la même adresse email soumet 2 fois WHEN la deuxième soumission arrive THEN les deux emails sont envoyés à Thomas (pas de déduplication en V1)

#### Payload API
- **Endpoint** : POST /api/contact
- **Authentification** : publique
- **Rate limit** : 5 requêtes/min par IP (identique US-10, US-11)
- **Request body** :
```json
{
  "type": "accompagnement",
  "prenom_nom": "string (2-100 chars)",
  "email": "string (email valide)",
  "sujet": "string (3-200 chars)",
  "message": "string (30-1500 chars)",
  "consentement_rgpd": "boolean (doit être true)",
  "_hp": ""
}
```
- **Response succès** : `{ "success": true, "message": "Message envoyé" }` — HTTP 200
- **Response erreur validation** : `{ "success": false, "errors": { "champ": "message" } }` — HTTP 422
- **Response erreur serveur** : `{ "success": false, "message": "Erreur serveur" }` — HTTP 500

#### Events analytics
| Event | Trigger | Propriétés | Funnel |
|---|---|---|---|
| form_start | Premier focus sur un champ | type=accompagnement | activation |
| form_submit_attempt | Clic "Démarrer la conversation" | — | activation |
| form_submit_success | Réponse API 200 | type=accompagnement | revenue |
| form_submit_error | Réponse API non-200 | error_type | activation |

#### Scénarios persona concrets

1. Karim a lu les 6 domaines, se reconnaît dans "structuration de holding patrimoniale". Il fait défiler, voit le formulaire 4 champs. Il remplit en 90 secondes. Il clique "Démarrer la conversation". Confirmation "Merci Karim."
2. Karim oublie le sujet. Il clique. Message rouge : "Le sujet est obligatoire". Il corrige et soumet.
3. Karim écrit 20 caractères dans le message. Message "Le message doit contenir au moins 30 caractères". Il développe sa situation.
4. Resend est indisponible. Karim voit l'erreur serveur. Il note l'email de Thomas dans les mentions légales pour contacter directement si le problème persiste.
5. Karim soumet et revient sur la page via le bouton retour. Le formulaire est vide — pas de risque de double soumission.

#### Definition of Done (@fullstack)
- [ ] Formulaire 4 champs /accompagnement implémenté et fonctionnel
- [ ] API route POST /api/contact avec type=accompagnement
- [ ] Email tagué [ACCOMPAGNEMENT] reçu par Thomas
- [ ] Validation côté client (React Hook Form + Zod) et serveur
- [ ] Rate limiting et honeypot identiques à US-10
- [ ] Test E2E : remplissage → soumission → confirmation

**Notes @qa** : vérifier le tag [ACCOMPAGNEMENT] dans l'email reçu. Tester la séparation entre le formulaire /accompagnement et le formulaire /opportunites (2 soumissions dans la même session → 2 emails distincts à Thomas). Tester honeypot et rate limiting.
**Notes @ux** : 4 champs = formulaire volontairement court. Labels clairs. Pas de liste déroulante. Le champ "sujet" est un input texte libre (pas un enum) — Karim doit pouvoir exprimer sa situation en ses propres mots.
**Notes @fullstack** : réutiliser le composant ContactForm avec prop `variant="accompagnement"`. Même logique de soumission que US-10, même endpoint /api/contact avec le paramètre type.

---

## Page 5 — Contact

### Objectif

Offrir un second point d'entrée de contact pour les visiteurs qui ne souhaitent pas soumettre une opportunité d'investissement (médias, partenaires, demandes diverses). Éviter le cul-de-sac pour Marc ou tout visiteur dont le besoin ne correspond pas aux 2 CTAs principaux.

### Audience prioritaire

Marc (persona secondaire — journaliste/analyste) et tout visiteur avec un besoin de contact générique (partenariats, presse, demandes diverses) — le formulaire Contact est volontairement allégé (4 champs) par opposition au formulaire Opportunités (7 champs qualifiants).

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

**Persona** : Marc (journaliste / analyste) — persona secondaire
**Epic** : Contact et partenariat
**Dépendances** : US-10 (même endpoint API, même logique formulaire)
**Priorité RICE** : R=70 I=7 C=8 E=1 → Score=392

**Job-to-be-done**
En tant que Marc, je veux envoyer un message à ISSA Capital afin de solliciter une interview ou obtenir des informations supplémentaires sans passer par le formulaire d'opportunité d'investissement (trop spécifique à mon contexte).

**Contexte de navigation**
- Page/écran d'origine : navigation depuis n'importe quelle page (lien "Contact" dans la nav)
- Déclencheur : clic sur "Contact" dans la navigation ou le footer
- Page/écran de destination (succès) : message de confirmation après soumission
- Page/écran de destination (échec) : formulaire avec erreurs inline

**Données et champs (4 champs formulaire Contact CTA générique)**
| Champ | Type | Obligatoire | Validation | Limites | Exemple |
|---|---|---|---|---|---|
| prenom_nom | string | Oui | Non vide | 2-100 caractères | "Marc Leblanc" |
| email | email | Oui | Format RFC 5322 | 5-254 caractères | "marc@lesechos.fr" |
| sujet | string | Oui | Non vide | 3-200 caractères | "Demande d'interview — article holdings familiales" |
| message | string (textarea) | Oui | Non vide, min 20 caractères | 20-2000 caractères | "Bonjour, je prépare un article sur..." |
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
- [ ] GIVEN Marc remplit les 4 champs obligatoires et coche le consentement WHEN il soumet THEN Thomas reçoit l'email avec le tag `[CONTACT]` dans le sujet (pour distinguer des opportunités)
- [ ] GIVEN la page Contact s'affiche WHEN Marc voit le formulaire THEN un lien "Proposer une opportunité d'investissement →" est visible au-dessus du formulaire (pour rediriger Leila vers le bon formulaire si elle arrive ici par erreur)

Cas d'erreur :
- [ ] GIVEN Marc soumet avec le champ message vide WHEN il clique "Envoyer" THEN un message "Le message est obligatoire" s'affiche sous le champ
- [ ] GIVEN Resend retourne une erreur WHEN Marc soumet THEN le message d'erreur serveur s'affiche (identique à US-10)

Cas limites :
- [ ] GIVEN Marc saisit 19 caractères dans le champ message WHEN il soumet THEN erreur "Le message doit contenir au moins 20 caractères"
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

1. Marc prépare un article sur les holdings familiales françaises. Il trouve le site ISSA Capital via LinkedIn, veut interviewer Thomas. Il va sur /contact, remplit 4 champs en 1 minute avec sujet "Demande d'interview — article holdings familiales indépendantes". Il soumet. Confirmation "Merci Marc."
2. Karim a déjà rempli le formulaire /accompagnement mais veut aussi envoyer un document complémentaire. Il passe par /contact pour un message libre.
3. Leila arrive sur /contact par erreur (cherchait le formulaire Opportunités). Elle voit le lien "Proposer une opportunité d'investissement →" et est redirigée vers /opportunites#formulaire.
4. Marc utilise un mobile. Le formulaire est scrollable et les champs accessibles sans zoom.
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
- [x] Actions du job-to-be-done principal (Leila soumet une opportunité) : US-01 → US-02 → US-10
- [x] Actions du job-to-be-done secondaire (Karim prend contact pour accompagnement) : US-01 → US-A1 → US-A2
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



