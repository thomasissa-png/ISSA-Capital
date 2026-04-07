# Audit légal — ISSA Capital
> @legal — 2026-04-07
> Droit applicable : droit français (LCEN, RGPD/CNIL, Code monétaire et financier)
> Livrables amont consultés : project-context.md, docs/product/product-vision.md

---

## Résumé exécutif — 5 risques par ordre de criticité

1. **CRITIQUE — Risque de qualification "offre au public de titres financiers"** (art. L.411-1 CMF) : la page Opportunités et le CTA "Proposer une opportunité d'investissement" peuvent être requalifiés si le copy mentionne des rendements, des instruments financiers spécifiques, ou constitue un démarchage actif. Sanctions : jusqu'à 5 ans d'emprisonnement et 375 000 € d'amende. → Règles de copy strictes transmises à @copywriter.
2. **CRITIQUE — Mentions légales incomplètes** (art. 6 III LCEN) : 2 données manquantes bloquantes — capital social et hébergeur exact. Sans ces données, les mentions légales sont incomplètes et exposent à 1 an d'emprisonnement + 75 000 €/375 000 € d'amende.
3. **MODÉRÉ — RGPD formulaire de contact** (art. 13 RGPD) : obligation d'information préalable au formulaire. Sans cette mention, amende CNIL jusqu'à 4% du CA mondial ou 20 M€.
4. **FAIBLE — Pas de bandeau cookies** : Plausible étant cookieless, AUCUN bandeau obligatoire en l'état. Risque faible uniquement si l'outil évolue ou si des ressources tierces (polices, CDN) déposent des cookies.
5. **FAIBLE — Pas d'obligations AMF** : holding non cotée, pas d'appel public à l'épargne, pas de société de gestion agréée. Confirmé noir sur blanc ci-dessous.

---

## 1. Mentions légales obligatoires — Article 6 III LCEN

### Base légale

Article 6 III de la loi n°2004-575 du 21 juin 2004 (LCEN), modifiée par la loi SREN n°2024-449 du 21 mai 2024.

Obligation : tout éditeur professionnel d'un site de communication en ligne doit afficher les informations suivantes de manière accessible en permanence.

### Champs obligatoires et données ISSA Capital

| Champ obligatoire | Valeur ISSA Capital | Statut |
|---|---|---|
| Dénomination sociale | ISSA Capital | DISPONIBLE |
| Forme juridique | SAS (Société par Actions Simplifiée) | DISPONIBLE |
| Capital social | [DONNÉE À OBTENIR DE THOMAS] | MANQUANT — BLOQUANT |
| Adresse du siège social | 54 Rue Henri Barbusse, 92000 Nanterre | DISPONIBLE |
| Numéro d'immatriculation RCS | RCS Nanterre — 102 356 094 | DISPONIBLE (SIREN vérifié project-context.md) |
| Numéro TVA intracommunautaire | [DONNÉE À OBTENIR DE THOMAS] | MANQUANT — à vérifier |
| Directeur de publication | Thomas Issa (à confirmer — qualité de dirigeant à préciser) | À CONFIRMER |
| Hébergeur (nom, adresse, téléphone) | Replit, Inc. — 1001 E Hillsdale Blvd, Foster City, CA 94404, USA — contact@repl.it | DISPONIBLE (sous réserve confirmation) |

**Concernant le numéro TVA :** une SAS holding patrimoniale (NAF 6630Z) n'est pas nécessairement assujettie à TVA si elle n'exerce pas d'activité économique soumise à TVA. Thomas doit vérifier avec son expert-comptable si un numéro TVA intracommunautaire a été attribué. Si non assujetti → ne pas mentionner. Si assujetti → mention obligatoire sur le site.

**Concernant l'hébergeur Replit :** Replit est une société américaine (non UE). La mention de l'hébergeur dans les mentions légales est obligatoire. L'adresse de Replit Inc. figurant dans les résultats publics est 1001 E Hillsdale Blvd, Foster City, CA 94404, États-Unis. À confirmer via les CGU Replit au moment de la mise en ligne.

### Texte modèle — Mentions légales (prêt à coller, champs à compléter)

```
MENTIONS LÉGALES

Éditeur du site

Le site issa-capital.com est édité par :

ISSA Capital
Société par Actions Simplifiée (SAS)
Capital social : [DONNÉE À OBTENIR DE THOMAS — ex. : 10 000 €]
Siège social : 54 Rue Henri Barbusse, 92000 Nanterre, France
RCS Nanterre : 102 356 094
[Si applicable] N° TVA intracommunautaire : FR[À COMPLÉTER]

Directeur de la publication : Thomas Issa, [qualité — ex. : Président]

Contact : contact@issa-capital.com [ou adresse email à confirmer par Thomas]

Hébergeur

Ce site est hébergé par :

Replit, Inc.
1001 E Hillsdale Blvd
Foster City, CA 94404
États-Unis
contact@repl.it

Propriété intellectuelle

L'ensemble des contenus présents sur le site issa-capital.com (textes, images, graphismes,
logo, icônes, sons, vidéos, etc.) est la propriété exclusive d'ISSA Capital ou de ses
partenaires, et est protégé par les lois françaises et internationales relatives à la
propriété intellectuelle.

Toute reproduction, représentation, modification, publication ou adaptation de tout ou
partie des éléments du site, quel que soit le moyen ou le procédé utilisé, est interdite,
sauf autorisation écrite préalable d'ISSA Capital (art. L.122-4 Code de la propriété
intellectuelle).

Responsabilité

ISSA Capital s'efforce d'assurer l'exactitude et la mise à jour des informations diffusées
sur ce site. Toutefois, ISSA Capital ne peut garantir l'exactitude, la précision ou
l'exhaustivité des informations mises à disposition sur ce site.
```

---

## 2. Politique de confidentialité — Article 13 RGPD

### Base légale

Règlement (UE) 2016/679 du 27 avril 2016 (RGPD), article 13 : obligation d'information au moment de la collecte des données personnelles.

### Texte modèle — Politique de confidentialité complète (prêt à coller)

```
POLITIQUE DE CONFIDENTIALITÉ

Dernière mise à jour : [date de mise en ligne]

1. Responsable du traitement

Le responsable du traitement des données personnelles collectées sur le site
issa-capital.com est :

ISSA Capital
SAS au capital de [MONTANT À COMPLÉTER]
54 Rue Henri Barbusse, 92000 Nanterre, France
RCS Nanterre : 102 356 094

Contact délégué à la protection des données : Thomas Issa
Email : [adresse email dédiée à préciser — ex. : privacy@issa-capital.com]

2. Données collectées et finalités

ISSA Capital collecte des données personnelles uniquement via le formulaire de contact
présent sur le site. Aucune autre collecte de données personnelles n'est effectuée.

Données collectées via le formulaire de contact :
- Nom et prénom
- Adresse email professionnelle
- Informations relatives à la proposition transmise (libre dans le champ message)

Finalité du traitement : traitement des demandes et propositions adressées à ISSA Capital
(opportunités d'investissement, demandes de renseignements, prises de contact
professionnelles).

3. Base légale du traitement

Le traitement de vos données personnelles repose sur votre consentement (art. 6.1.a RGPD),
que vous exprimez en soumettant le formulaire de contact.

Aucun traitement fondé sur l'intérêt légitime ou l'exécution d'un contrat n'est mis en
œuvre sur ce site.

4. Destinataires des données

Les données collectées sont destinées exclusivement aux dirigeants d'ISSA Capital
(Thomas Issa et toute personne habilitée par lui dans le cadre de la gestion des
opportunités d'investissement).

Elles ne sont transmises à aucun tiers, revendues, ni cédées.

Les données transitent via le service d'envoi d'emails Resend (ou équivalent — voir stack
technique). Ce prestataire agit comme sous-traitant au sens de l'art. 28 RGPD et est
soumis à des garanties contractuelles de protection des données.

5. Durée de conservation

Les données collectées via le formulaire de contact sont conservées pendant une durée
maximale de 3 ans à compter de leur collecte, correspondant à la durée nécessaire au
suivi des opportunités d'investissement.

Passé ce délai, les données sont supprimées ou anonymisées.

6. Vos droits

Conformément aux articles 15 à 21 du RGPD, vous disposez des droits suivants :
- Droit d'accès à vos données (art. 15)
- Droit de rectification (art. 16)
- Droit à l'effacement ("droit à l'oubli") (art. 17)
- Droit à la limitation du traitement (art. 18)
- Droit à la portabilité (art. 20)
- Droit d'opposition (art. 21)
- Droit de retirer votre consentement à tout moment (art. 7.3), sans que cela remette
  en cause la licéité du traitement effectué avant ce retrait

Pour exercer vos droits, contactez : [adresse email dédiée — ex. : privacy@issa-capital.com]

ISSA Capital s'engage à répondre à toute demande dans un délai maximum d'un mois à
compter de la réception de la demande (art. 12.3 RGPD). Ce délai peut être prolongé
de deux mois supplémentaires en cas de complexité ou de nombre important de demandes.

7. Réclamation auprès de la CNIL

Si vous estimez que le traitement de vos données n'est pas conforme au RGPD, vous avez
le droit d'introduire une réclamation auprès de la Commission Nationale de l'Informatique
et des Libertés (CNIL) :
- En ligne : https://www.cnil.fr/fr/plaintes
- Par courrier : CNIL — 3 Place de Fontenoy — TSA 80715 — 75334 Paris Cedex 07

8. Cookies et traceurs

Le site issa-capital.com utilise Plausible Analytics, un outil de mesure d'audience qui
ne dépose aucun cookie sur votre terminal et ne collecte aucune donnée personnelle
identifiable. Aucun consentement n'est requis pour cet outil.

Aucun autre cookie de tracking ou de publicité n'est utilisé sur ce site.

Si vous constatez le dépôt de cookies non déclarés, merci de nous en informer à
[adresse email contact].
```

---

## 3. Politique cookies — Analyse Plausible Analytics

### Situation actuelle : AUCUN bandeau cookies obligatoire

Plausible Analytics est un outil de mesure d'audience qui :
- Ne dépose **aucun cookie** sur le terminal de l'utilisateur (source : politique de données Plausible, plausible.io/data-policy)
- Ne collecte **aucune donnée personnelle identifiable** (pas d'adresse IP, pas de fingerprinting)
- Héberge ses données **dans l'UE** (serveurs en Allemagne)

En conséquence, conformément aux recommandations CNIL (fiche n°16 et lignes directrices sur les cookies) : **aucun bandeau de consentement cookies n'est requis** pour Plausible Analytics.

La mention de la section 8 de la politique de confidentialité ci-dessus suffit.

### Cas déclencheurs d'obligation future (à surveiller)

| Cas | Déclencheur | Action requise |
|---|---|---|
| Plausible évolue vers cookies | Changement politique Plausible | Ajouter bandeau CNIL conforme |
| Intégration réseaux sociaux (boutons partage, pixel) | Ajout de widgets LinkedIn/Twitter | Bandeau obligatoire pour ces traceurs |
| Ressources tierces déposant cookies (Google Fonts en CDN) | Audit technique | Charger en local ou gérer consentement |
| Migration vers GA4 | Si Plausible abandonné | Bandeau obligatoire, consentement actif |

**Recommandation à @fullstack :** charger les polices Google Fonts en local (npm package ou selfhost) pour éliminer tout risque de dépôt de cookies via Google CDN.

---

## 4. Risque juridique — Qualification "offre au public de titres financiers"

### Analyse du risque — CRITIQUE

**Base légale :** article L.411-1 du Code monétaire et financier (CMF) — interdiction de procéder à une offre au public de titres financiers sans habilitation réglementaire (visa AMF, PSI agréé, etc.).

**Définition légale** (art. L.411-1 renvoyant au Règlement Prospectus UE 2017/1129, art. 2.d) : est une offre au public toute "communication faite sous quelque forme et par quelque moyen que ce soit et présentant une information suffisante sur les conditions de l'offre et sur les titres à offrir, de manière à mettre un investisseur en mesure de décider d'acheter ou de souscrire ces valeurs mobilières ou ces instruments financiers".

**Analyse appliquée à ISSA Capital :**

ISSA Capital n'est pas une société de gestion agréée AMF. Elle ne propose PAS de titres financiers au public. Son site présente sa propre holding et recueille des propositions entrantes de cédants ou partenaires.

Le risque de requalification existe si :
- La page Opportunités est interprétée comme une sollicitation à investir DANS ISSA Capital
- Le CTA contient des informations sur des instruments financiers spécifiques ou des rendements attendus
- La communication ressemble à un démarchage financier (art. L.341-1 CMF)

**Verdict :** le risque est maîtrisable par le copy. La structure du site (ISSA collecte des propositions, elle n'en fait pas) va dans le bon sens.

### Règles impératives pour le copy — À transmettre à @copywriter

**MOTS ET EXPRESSIONS INTERDITS sur la page Opportunités et tout le site :**

| Interdit | Pourquoi |
|---|---|
| "rendement", "taux de rendement", "ROI attendu", "performance" | Suggère une promesse financière |
| "investir dans ISSA Capital", "prendre une participation dans ISSA" | Qualification d'offre de titres |
| "opportunité financière", "placement", "investissement garanti" | Démarchage financier |
| Tout chiffre de rendement ou de valorisation de la holding | Promesse implicite de performance |
| "appel à investisseurs", "levée de fonds" pour ISSA Capital | Offre au public |
| "rejoindre notre portefeuille en tant qu'associé" | Offre de parts sociales |

**FORMULATIONS AUTORISÉES ET RECOMMANDÉES :**

| Autorisé | Pourquoi sécurisant |
|---|---|
| "ISSA Capital étudie des opportunités de rapprochement avec des entreprises…" | Échange commercial B2B, pas d'offre |
| "Proposez votre entreprise à l'attention de la famille Issa" | CTA entrant, pas sortant |
| "Nous cherchons des fondateurs qui partagent notre horizon long-terme" | Critères qualitatifs, pas financiers |
| "ISSA Capital investit son propre patrimoine familial dans des projets sélectionnés" | Positionne comme investisseur actif, pas émetteur |
| "Présentez votre projet" | Neutre, sans connotation financière |

**Clause de non-démarchage à intégrer dans le footer ou les mentions légales :**

```
Clause de non-sollicitation financière

Les informations publiées sur ce site ne constituent pas une offre de titres financiers,
une invitation à investir, ni un démarchage financier au sens des articles L.341-1 et
suivants du Code monétaire et financier.

ISSA Capital est une holding patrimoniale familiale non soumise à agrément AMF. Elle
n'effectue aucun appel public à l'épargne. Les prises de contact via ce site sont
exclusivement à l'initiative des tiers souhaitant proposer des opportunités de
rapprochement à ISSA Capital.
```

---

## 5. Absence d'obligations AMF — Confirmation

### Confirmation négative (noir sur blanc)

ISSA Capital (SAS, SIREN 102 356 094, NAF 6630Z) est exempte des obligations AMF suivantes pour les raisons ci-dessous :

| Obligation AMF | Applicable ? | Justification |
|---|---|---|
| Agrément AMF (société de gestion) | NON | ISSA Capital gère son propre patrimoine familial, pas des fonds pour le compte de tiers (art. L.532-9 CMF — nécessite agrément uniquement si gestion pour compte de tiers) |
| Visa AMF prospectus | NON | Aucune émission de titres financiers au public |
| Communication réglementée (marchés financiers) | NON | Société non cotée sur aucun marché réglementé ou non réglementé |
| Statut PSI (Prestataire de Services d'Investissement) | NON | Ne fournit pas de services d'investissement à des tiers |
| Règlement DORA / CSRD | NON | Ne remplit pas les critères de taille (PME non cotée) |
| EU AI Act obligations | NON | Pas d'IA générative en production sur le site en V1 |

**Confirmation :** ISSA Capital est une holding patrimoniale pure (family office) gérant son propre patrimoine. Elle n'est soumise à aucune réglementation AMF, financière ou prudentielle particulière, dès lors qu'elle n'effectue pas d'appel public à l'épargne et ne gère pas de fonds pour le compte de tiers.

---

## 6. Sanctions encourues — Responsabilisation

### Manquement aux mentions légales (art. 6 LCEN)

- Personne physique (dirigeant) : 1 an d'emprisonnement + **75 000 € d'amende**
- Personne morale (ISSA Capital) : **375 000 € d'amende**
- Source : article 6 VI LCEN + loi SREN 2024

### Violation RGPD (art. 83 RGPD)

- Infraction grave (absence d'information, violation de droits) : jusqu'à **20 000 000 €** ou **4% du CA mondial annuel**
- Infraction mineure (manquement procédural) : jusqu'à **10 000 000 €** ou **2% du CA mondial annuel**
- En pratique pour une SAS de cette taille : la CNIL privilégie d'abord la mise en demeure, mais des sanctions de plusieurs milliers à dizaines de milliers d'euros sont courantes pour des non-conformités avérées

### Qualification offre au public de titres (art. L.571-4 CMF)

- **5 ans d'emprisonnement + 375 000 € d'amende** (personne physique)
- **Jusqu'à 1 875 000 €** (personne morale — quintuple du maximum)
- Source : art. L.571-4 Code monétaire et financier

---

## 7. Checklist de conformité — Avant mise en ligne

| # | Vérification | Responsable | Statut |
|---|---|---|---|
| C1 | Capital social renseigné dans mentions légales | Thomas → @fullstack | En attente |
| C2 | Directeur de publication nommé et qualité précisée | Thomas | En attente |
| C3 | N° TVA intracommunautaire vérifié avec expert-comptable | Thomas | En attente |
| C4 | Hébergeur exact confirmé (Replit adresse à jour) | Thomas / @infrastructure | En attente |
| C5 | Email de contact privacy dédié créé | Thomas | En attente |
| C6 | Mentions légales page créée et accessible depuis le footer | @fullstack | En attente |
| C7 | Politique de confidentialité page créée et accessible depuis le footer | @fullstack | En attente |
| C8 | Lien vers politique de confidentialité dans formulaire de contact | @fullstack | En attente |
| C9 | Mention RGPD courte ajoutée au-dessus du formulaire | @fullstack | En attente |
| C10 | Clause de non-démarchage financier présente dans footer ou mentions légales | @fullstack | En attente |
| C11 | Copy page Opportunités relu par @copywriter selon règles section 4 | @copywriter | En attente |
| C12 | Aucun mot interdit de la liste section 4 dans le copy du site | @copywriter + @reviewer | En attente |
| C13 | Plausible en mode cookieless confirmé (pas de scripts tiers déposant cookies) | @fullstack | En attente |
| C14 | Google Fonts chargées en local (pas via CDN Google) | @fullstack | En attente |

---

## Hypothèses à valider — Mises à jour Phase 3

Les hypothèses H-L1, H-L2, H-L3, H-L4 ont été validées par Thomas (2026-04-07) et implémentées dans le code :
- H-L1 CLÔTURÉE : capital social = 1 047 562,00 € — intégré dans siteConfig + mentions légales
- H-L2 CLÔTURÉE : Directeur de publication = Thomas Issa, Président — intégré
- H-L3 CLÔTURÉE : assujettie TVA, n° FR50102356094 — intégré
- H-L4 CLÔTURÉE : email unique contact@issa-capital.com — décision Thomas
- H-L5 CONFIRMÉE : Resend utilisé — intégré dans politique de confidentialité

---

## Phase 3 — Audit final pages /accompagnement, /participations, /mission

> @legal — 2026-04-07 — Session 3, Phase 3, Étape 2
> Fichiers audités : src/app/accompagnement/page.tsx, src/app/participations/page.tsx, src/app/mission/page.tsx, src/components/ui/ContactForm.tsx, src/app/mentions-legales/page.tsx
> Base légale : art. L.411-1 CMF, art. L.341-1 CMF, art. 13 RGPD, art. 6 III LCEN

---

### Résumé exécutif Phase 3

**VERDICT GLOBAL : GO CONDITIONNEL**

Aucune formulation à risque CRITIQUE identifiée sur les trois pages. Le copy est globalement bien maîtrisé, le positionnement "investisseur privé" est tenu. Deux points nécessitent une correction mineure avant mise en ligne, et deux points méritent une vérification avec un avocat.

| Page | Verdict | Niveau de risque résiduel |
|---|---|---|
| /accompagnement | GO CONDITIONNEL | 1 point à corriger — terminologie CIF |
| /participations | GO CONDITIONNEL | 1 point à corriger — "Versi Invest / conseil en acquisition" |
| /mission | GO | Aucun risque identifié |
| ContactForm (RGPD) | GO | Conformité RGPD excellente |
| /mentions-legales | GO | Conforme LCEN + CMF + RGPD |

---

### Audit page /accompagnement

#### Analyse ligne par ligne — éléments à risque

**Élément 1 — Metadata description (ligne 21, fichier page.tsx)**

Citation exacte :
```
"Thomas Issa accompagne fondateurs et investisseurs en structuration patrimoniale, holding, immo en direct et participations. 15 ans Sony, co-fondateur TEOS."
```

Verdict : **PASS**. La metadata n'est pas du copy client-facing au sens strict. Elle décrit un parcours, pas un service financier. Pas de promesse de rendement, pas de produit financier. Le terme "structuration patrimoniale" dans ce contexte (accompagnement d'entrepreneurs) ne constitue pas du conseil en investissement réglementé (CIF) au sens de l'art. L.321-1 CMF, car il ne porte pas sur des instruments financiers spécifiques.

**Élément 2 — Body copy section "Ce que Thomas fait" (lignes 119-129)**

Citation exacte :
```
"Thomas Issa n'est pas un cabinet de gestion de patrimoine. Il ne vend pas de produits financiers, pas de fonds, pas d'assurance-vie."
```

Verdict : **PASS RENFORCÉ**. Cette formulation est une désambiguïsation explicite et proactive. Elle sécurise juridiquement la page en établissant que Thomas ne fournit pas de services d'investissement réglementés. À conserver impérativement.

**Élément 3 — Domaine patrimonial, titre de bloc (ligne 37)**

Citation exacte :
```
"Structuration de holding et écosystème patrimonial"
```

Verdict : **PASS**. La "structuration de holding" est une activité de conseil en organisation juridique et corporate, non réglementée AMF. Elle ne porte pas sur la recommandation d'instruments financiers à des tiers.

**Élément 4 — Domaine patrimonial, description (lignes 38-40)**

Citation exacte :
```
"ISSA Capital, Gradient One, Versi, Immocrew, Versimo — co-fondés et développés. Pour les fondateurs qui veulent construire une architecture patrimoniale cohérente, pas un portefeuille d'actifs épars."
```

Verdict : **PASS**. Le copy positionne Thomas comme un pair (co-fondateur), pas comme un conseiller en investissement qui recommande des instruments financiers. "Architecture patrimoniale" dans ce contexte désigne l'organisation juridique de structures, pas la gestion de portefeuille au sens AMF.

**Élément 5 — Domaine patrimonial, "participations minoritaires" (lignes 41-43)**

Citation exacte :
```
"Co-investisseur dans plusieurs structures. Pour les fondateurs qui veulent intégrer l'immo dans leur stratégie patrimoniale."
```

Verdict : **PASS**. Thomas se positionne comme co-investisseur (il met son propre argent), pas comme gestionnaire de fonds tiers. Le fait d'accompagner un fondateur à "intégrer l'immo dans sa stratégie patrimoniale" peut théoriquement toucher à du conseil en investissement. Toutefois, le contexte est celui d'un échange entre pairs, pas d'une prestation standardisée. Risque faible.

**Élément 6 — ROI "6000% la première année" (ligne 148, section Parcours)**

Citation exacte :
```
"un ROI de 6000% la première année"
```

Verdict : **À VÉRIFIER avec un avocat — risque faible mais non nul**. Ce chiffre est présenté comme une référence historique de performance professionnelle chez Sony (TEOS), pas comme une promesse de rendement pour les services d'accompagnement. Il ne constitue pas une promesse de rendement financier au sens de l'art. L.341-1 CMF. Toutefois, dans un contexte de page d'accompagnement commercial, un chiffre de performance aussi spectaculaire pourrait être requalifié comme argument de démarchage. Recommandation : le conserver dans le contexte de parcours biographique, mais ne pas en faire un argument de vente primaire. Le contexte actuel (section "Parcours" avec cadrage Sony/TEOS) est acceptable.

**Élément 7 — Format "Advisoring" (lignes 294-300)**

Citation exacte :
```
"Un rôle d'advisor récurrent auprès du fondateur ou du dirigeant — conseil stratégique régulier, sparring partner long terme, présence informelle au board possible."
```

Verdict : **À CORRIGER — risque modéré**. Le terme "conseil stratégique" dans ce contexte est ambigu. Si Thomas accompagne des fondateurs sur leurs décisions d'investissement (structuration patrimoniale, prises de participation), une activité récurrente et rémunérée d'"advisor" pourrait être qualifiée de conseil en investissement (CIF) au sens de l'article L.321-1, 4° du CMF, qui inclut "le conseil en investissement" défini comme "la fourniture de recommandations personnalisées à un client, soit à sa demande soit à l'initiative du prestataire, concernant une ou plusieurs transactions portant sur des instruments financiers".

La qualification CIF n'est applicable que si le conseil porte sur des instruments financiers au sens du CMF. Si le conseil de Thomas porte exclusivement sur la stratégie business (go-to-market, positionnement, organisation) et non sur des instruments financiers (actions, obligations, parts de fonds), il n'est pas soumis à agrément CIF.

**Correction recommandée :** ajouter une précision dans la description du format "Advisoring" pour lever l'ambiguïté :

Texte actuel (ligne 295-299) :
```
"Un rôle d'advisor récurrent auprès du fondateur ou du dirigeant — conseil stratégique régulier, sparring partner long terme, présence informelle au board possible."
```

Texte corrigé proposé :
```
"Un rôle d'advisor récurrent auprès du fondateur ou du dirigeant — stratégie, go-to-market, organisation, développement international. Sparring partner de fond, présence informelle au board possible. Hors périmètre : conseil en instruments financiers."
```

La phrase "Hors périmètre : conseil en instruments financiers" désambiguïse explicitement sans être péjorative, et couvre le risque CIF.

#### Verdict /accompagnement

**GO CONDITIONNEL** — 1 correction mineure requise (Élément 7, format Advisoring). 1 point à vérifier avec un avocat (Élément 6, chiffre ROI Sony — faible risque). Aucune formulation de la liste noire L.411-1 identifiée.

---

### Audit page /participations

#### Analyse ligne par ligne — éléments à risque

**Élément 1 — Titre et intro hero (lignes 83-90)**

Citation exacte :
```
"Un écosystème construit décision après décision."
"ISSA Capital gère un portefeuille de participations cohérent, structuré autour de deux pôles — l'immobilier et la technologie au service de l'immobilier."
```

Verdict : **PASS**. La formulation décrit l'activité réelle d'une holding. "Gère un portefeuille de participations" est le vocabulaire normal d'une holding investissant son propre patrimoine. Il n'y a aucune sollicitation à apporter des capitaux.

**Élément 2 — Badge "Participation directe — 50%" (ligne 108)**

Citation exacte :
```
<span>Participation directe — 50%</span>
```

Verdict : **PASS**. L'affichage du pourcentage de détention (50%) est une information factuelle sur la structure capitalistique de la holding. Il ne constitue pas une offre de titres. On est dans la description d'un actif existant, pas une sollicitation.

**Élément 3 — Filiale "Versi Invest" (lignes 46-50)**

Citation exacte :
```
name: 'Versi Invest',
activity: 'Club deal et conseil en acquisition immobilière',
role: 'Co-gérant (via Gradient One)',
```

Verdict : **À CORRIGER — risque modéré**. La description "Club deal et conseil en acquisition immobilière" est problématique à deux titres :

(a) "Club deal" : un club deal désigne en droit financier français un regroupement d'investisseurs (généralement institutionnels ou HNWI) qui co-investissent dans un actif. Si Versi Invest organise des clubs deals en faisant appel à des investisseurs tiers (pas uniquement ISSA Capital et son co-gérant), cela peut constituer une activité de démarchage financier ou un appel public à l'épargne selon le nombre de participants et la nature de la sollicitation (art. L.411-1 CMF, seuil de 150 personnes ou offre supérieure à 8 M€).

(b) "Conseil en acquisition immobilière" : si Versi Invest conseille des tiers sur leurs acquisitions immobilières à titre onéreux, elle peut être soumise à la loi Hoguet (loi n° 70-9 du 2 janvier 1970) ou à la réglementation des CIACM (Conseillers en Investissements Immobiliers) selon la nature exacte de l'activité.

**Correction recommandée :** la description de Versi Invest sur la page /participations doit être reformulée pour ne pas exposer ISSA Capital à une lecture "offre de service financier". Deux options :

Option A (description neutre de l'activité) :
```
activity: 'Acquisitions immobilières et accompagnement — marché résidentiel et professionnel',
```

Option B (précision du périmètre) :
```
activity: 'Investissement immobilier — acquisitions propres et accompagnement de partenaires sélectionnés',
```

Note : la clarification définitive de l'activité réelle de Versi Invest (club deal ouvert ou co-investissement entre associés connus) relève de Thomas et doit être vérifiée avec un avocat avant mise en ligne si Versi Invest ouvre ses club deals à des tiers non-associés.

**Élément 4 — Section "Patrimoine immobilier en direct" (lignes 205-210)**

Citation exacte :
```
"ISSA Capital gère en direct un patrimoine résidentiel en Île-de-France. Constitution patrimoniale et revenus locatifs — gestion directe, horizon long terme."
```

Verdict : **PASS**. Description factuelle d'une activité de gestion de patrimoine propre. Aucune sollicitation extérieure. La mention "revenus locatifs" décrit une source de revenus réelle de la holding, pas une promesse de rendement à un tiers.

**Élément 5 — CTA final "Proposer une opportunité" (ligne 238)**

Citation exacte :
```
"Proposer une opportunité →"
```

Verdict : **PASS**. Lien sortant vers /opportunites. Ce CTA sollicite des propositions entrantes (ISSA Capital reçoit des offres), pas des apports de capitaux. Conforme à la structure validée en Phase 2c.

#### Verdict /participations

**GO CONDITIONNEL** — 1 correction requise (Élément 3, description Versi Invest). La formulation "Club deal" expose à un risque modéré de requalification si lue hors contexte ou si Versi Invest est effectivement ouverte à des investisseurs tiers. Nécessite validation avocat sur l'activité réelle de Versi Invest.

---

### Audit page /mission

#### Analyse ligne par ligne — éléments à risque

**Élément 1 — Section "La décision fondatrice" — mention "fonds" et "souscripteurs" (lignes 144-147)**

Citation exacte :
```
"Pas à un fonds dont l'horizon est contraint par ses propres engagements envers ses souscripteurs."
```

Verdict : **PASS RENFORCÉ**. Le copy cite les fonds et les souscripteurs pour s'en distinguer explicitement. Cette formulation renforce la qualification "holding privée non-fonds" et est sécurisante du point de vue CMF. À conserver.

**Élément 2 — Section "Ce que nous refusons" — mention "ne gère pas de capitaux tiers" (ligne 280)**

Citation exacte :
```
"ISSA Capital n'est pas un fonds d'investissement — elle ne gère pas de capitaux tiers et n'a pas d'engagements de liquidité envers des souscripteurs."
```

Verdict : **PASS RENFORCÉ**. Identique à l'analyse précédente — formulation d'auto-délimitation sécurisante. Elle reproduit en substance la clause de non-sollicitation de la section 4 du legal-audit initial. À conserver.

**Élément 3 — Filtres d'investissement — "créer de la valeur sur vingt ou trente ans" (ligne 240)**

Citation exacte :
```
"Un investissement est évalué sur sa capacité à créer de la valeur sur vingt ou trente ans — pas sur son potentiel de plus-value à horizon de sortie."
```

Verdict : **PASS**. Ce passage décrit une philosophie d'investissement, pas une promesse de rendement à un tiers. Il n'y a aucun chiffre de performance, aucune promesse. "Créer de la valeur" est un terme intentionnellement vague qui ne constitue pas une promesse de rendement au sens CMF.

**Élément 4 — Aucun chiffre de rendement, aucune performance chiffrée**

Vérification systématique de la page /mission : aucun pourcentage de rendement, aucun TRI, aucun "X% par an", aucune valorisation. La page est entièrement narrative et philosophique.

Verdict : **PASS**. Page à risque nul sur ce point.

#### Verdict /mission

**GO** — Aucune correction requise. La page /mission est la plus sécurisée des trois : elle décrit une philosophie familiale et patrimoniale sans aucune formulation pouvant être qualifiée d'offre au public, de démarchage ou de promesse de rendement. Les formulations de délimitation explicite ("pas un fonds", "pas de capitaux tiers", "pas de souscripteurs") renforcent positivement la conformité CMF.

---

### Audit transversal — ContactForm et mentions légales

#### ContactForm (src/components/ui/ContactForm.tsx)

**Consentement RGPD :** PASS. Le formulaire inclut :
- Une notice d'information RGPD complète avant le bouton de soumission (lignes 35-51) : finalité, responsable du traitement, durée de conservation, droits, lien politique de confidentialité
- Une case à cocher de consentement explicite obligatoire (lignes 366-385)
- Le lien vers /mentions-legales#confidentialite est présent et fonctionnel

Cette implémentation est conforme à l'art. 13 RGPD et aux recommandations CNIL sur les formulaires de contact.

**Base légale consentement :** PASS. La base légale "consentement" (art. 6.1.a RGPD) est cohérente avec l'interface : la case à cocher est requise et non pré-cochée, ce qui constitue un consentement positif et libre au sens de l'art. 7 RGPD.

**Données collectées vs déclarées :** PASS. Le formulaire variant "accompagnement" collecte Nom/Email/Message — cohérent avec la déclaration dans la politique de confidentialité. Le variant "opportunite" collecte des champs supplémentaires (type, localisation, ticket, source) — ceux-ci sont couverts par la mention "Informations relatives à la proposition transmise" dans la politique. Recommandation mineure : envisager de lister explicitement "taille indicative du ticket, localisation" dans la politique de confidentialité pour une conformité maximale — non bloquant.

#### Page /mentions-legales

**Mentions légales LCEN :** PASS COMPLET. La page implémente l'intégralité des champs obligatoires :
- Dénomination, forme juridique, capital social (via siteConfig.capital)
- Siège social, RCS, numéro TVA (via siteConfig)
- Directeur de publication (Thomas Issa, Président)
- Coordonnées hébergeur (Replit, San Francisco)

**Clause de non-sollicitation financière L.341-1 CMF :** PASS. La clause est présente, complète et correctement rédigée (lignes 109-117). Elle couvre l'absence d'offre de titres, l'absence d'agrément AMF, l'absence d'appel public à l'épargne, et la nature entrante des contacts.

**Politique de confidentialité RGPD :** PASS. Les 8 sections requises (responsable, données/finalités, base légale, destinataires, durée, droits, CNIL, cookies) sont présentes et complètes. Mention Plausible Analytics conforme à la position CNIL sur les outils cookieless.

---

### Tableau récapitulatif des findings Phase 3

| # | Page | Fichier (ligne) | Formulation | Verdict | Action |
|---|---|---|---|---|---|
| F1 | /accompagnement | page.tsx, l.294-299 | "conseil stratégique régulier" dans format Advisoring | À CORRIGER | Ajouter "Hors périmètre : conseil en instruments financiers" |
| F2 | /accompagnement | page.tsx, l.148 | "ROI de 6000% la première année" | À VÉRIFIER avocat | Risque faible — contexte biographique Sony/TEOS acceptable |
| F3 | /participations | page.tsx, l.47 | "Club deal et conseil en acquisition immobilière" | À CORRIGER | Reformuler en "Acquisitions immobilières et accompagnement" ou précision du périmètre |
| F4 | /participations | page.tsx, l.47 | Activité Versi Invest — ouverture à des tiers ? | À VÉRIFIER avocat | Clarifier si les club deals sont ouverts à des investisseurs tiers non-associés |
| F5 | /mission | — | Aucune formulation à risque | PASS | Aucune action |
| F6 | ContactForm | ContactForm.tsx, l.35-51 | Notice RGPD + checkbox consentement | PASS | Recommandation mineure : lister "ticket, localisation" dans politique |
| F7 | /mentions-legales | page.tsx | Mentions légales LCEN + clause CMF + RGPD | PASS COMPLET | Aucune action |

---

### Corrections prioritaires avant mise en ligne

**CORRECTION 1 — Obligatoire (risque modéré — CIF)**

Fichier : `src/app/accompagnement/page.tsx`, section "Formats", article "Advisoring"

Texte actuel (vers ligne 295) :
```
conseil stratégique régulier, sparring partner long terme, présence informelle au board possible.
```

Texte à substituer :
```
stratégie, développement, organisation. Sparring partner de fond, présence informelle au board possible. Hors périmètre : conseil en instruments financiers réglementés.
```

**CORRECTION 2 — Obligatoire (risque modéré — club deal)**

Fichier : `src/app/participations/page.tsx`, objet `filiales`, entrée "Versi Invest"

Texte actuel (ligne 47) :
```
activity: 'Club deal et conseil en acquisition immobilière',
```

Texte à substituer (option A — neutre) :
```
activity: 'Acquisitions immobilières et accompagnement de partenaires',
```

---

### Points nécessitant validation par un avocat

1. **Activité Versi Invest** : si Versi Invest organise des clubs deals ouverts à des investisseurs tiers (hors associés), vérifier avec un avocat spécialisé CMF si l'activité nécessite un statut CIAM, PSI ou autre agrément. La simple description sur le site ISSA Capital peut rester neutre, mais l'activité sous-jacente de Versi Invest doit être vérifiée.

2. **Chiffre ROI Sony "6000%"** : dans la description du parcours, ce chiffre est présenté comme un fait biographique. Il ne constitue pas une promesse de rendement. Un avocat peut confirmer que le contexte de présentation (parcours Sony, pas de service d'accompagnement) exclut la qualification de démarchage.

---

*Ce document est un draft de référence. Il ne constitue pas un avis juridique formel. Recommandation : validation par un avocat pour les deux points listés ci-dessus avant mise en ligne.*

---

## Verdict final Phase 3 — GO CONDITIONNEL

**Synthèse des trois pages auditées :**

Aucune formulation de la liste noire L.411-1 CMF n'a été identifiée sur les pages /accompagnement, /participations, /mission. Le Principe #0 VITRINE est tenu : le site ne sollicite pas d'investisseurs, ne promet pas de rendements, ne démarche pas activement le public. La structure "ISSA Capital reçoit des propositions, elle n'en fait pas" est maintenue de manière cohérente sur l'ensemble des pages.

Deux corrections de copy sont requises avant mise en ligne :

| # | Page | Correction | Urgence |
|---|---|---|---|
| C1 | /accompagnement | Section Advisoring : remplacer "conseil stratégique régulier" par formulation désambiguïsant l'exclusion du périmètre CIF | Obligatoire |
| C2 | /participations | Versi Invest : remplacer "Club deal et conseil en acquisition immobilière" par formulation neutre | Obligatoire |

Deux points requièrent une validation par un avocat (non bloquants pour la mise en ligne si les corrections C1/C2 sont faites, mais à régulariser dans les 60 jours) :

| # | Sujet | Risque | Niveau |
|---|---|---|---|
| A1 | Activité réelle Versi Invest — club deals ouverts à des tiers ou réservés aux associés | Potentiellement PSI / CIAM si ouvert | Faible à modéré selon réalité opérationnelle |
| A2 | Chiffre ROI 6000% Sony — contexte biographique acceptable mais à confirmer | Pas une promesse de rendement en l'état | Faible |

**Mise à jour checklist de conformité — items déclenchés par la Phase 3 :**

| # | Vérification | Statut après Phase 3 |
|---|---|---|
| C11 | Copy page /accompagnement relu selon règles section 4 | GO CONDITIONNEL — correction Advisoring requise |
| C12 | Copy pages /participations, /mission, /accompagnement — 0 mot interdit liste noire L.411-1 | GO CONDITIONNEL — correction Versi Invest requise |

**Verdict global du site ISSA Capital :**

| Périmètre | Verdict |
|---|---|
| Mentions légales (LCEN) | GO — implémentées avec toutes les données H-L1 à H-L5 confirmées |
| RGPD (formulaire de contact, politique de confidentialité) | GO — consentement positif, art. 13 conforme, Plausible cookieless |
| Bannière cookies | GO — non requise avec Plausible (surveiller Google Fonts CDN) |
| Risque AMF / appel public à l'épargne | GO CONDITIONNEL — 2 corrections copy + validation avocat Versi Invest |
| Pages /opportunites (Phase 2c) | GO — validé session précédente, non revu ici |
| Pages /accompagnement, /participations, /mission | GO CONDITIONNEL — 2 corrections copy requises |

**Condition de passage en GO complet :** appliquer les corrections C1 et C2 via @copywriter (wording précis fourni ci-dessus dans "Corrections prioritaires avant mise en ligne").

---

## Handoff → @copywriter

Fichiers produits :
- `/home/user/ISSA-Capital/docs/legal/legal-audit.md` (audit complet — Phases 1, 2, 3)

Décisions prises :
- Aucune formulation de la liste noire L.411-1 CMF identifiée sur les 3 pages auditées
- Deux corrections de copy obligatoires avant mise en ligne (détail et wording de remplacement fournis dans la section "Corrections prioritaires avant mise en ligne")
- Conformité RGPD du ContactForm validée — consentement positif art. 7 RGPD conforme
- Mentions légales LCEN conformes — données H-L1 à H-L5 toutes intégrées
- Bannière cookies non requise avec Plausible Analytics (cookieless, serveurs UE)

Points d'attention pour @copywriter :

**CORRECTION 1 — À appliquer dans `src/app/accompagnement/page.tsx`, section Advisoring (vers ligne 295) :**

Texte actuel :
```
conseil stratégique régulier, sparring partner long terme, présence informelle au board possible.
```
Texte à substituer :
```
stratégie, développement, organisation. Sparring partner de fond, présence informelle au board possible. Hors périmètre : conseil en instruments financiers réglementés.
```

**CORRECTION 2 — À appliquer dans `src/app/participations/page.tsx`, objet `filiales`, entrée "Versi Invest" (ligne 48) :**

Texte actuel :
```
activity: 'Club deal et conseil en acquisition immobilière',
```
Texte à substituer :
```
activity: 'Acquisitions immobilières et accompagnement de partenaires',
```

Points nécessitant validation avocat (non bloquants, dans les 60 jours) :
- Activité réelle Versi Invest : si les clubs deals sont ouverts à des tiers non-associés, consulter un avocat spécialisé CMF sur les obligations PSI/CIAM éventuelles
- Chiffre ROI 6000% Sony : le contexte biographique est acceptable, une confirmation avocat est recommandée à titre conservatoire

Implémentations techniques requises par @fullstack (rappel) :
- C6 : page /mentions-legales accessible depuis le footer — statut à vérifier
- C7 : page /politique-de-confidentialite accessible depuis le footer — statut à vérifier
- C8 : lien politique de confidentialité dans le formulaire de contact — PASS (déjà implémenté, voir ContactForm.tsx l.35-51)
- C14 : Google Fonts chargées en local (pas via CDN Google) — statut à vérifier

---
