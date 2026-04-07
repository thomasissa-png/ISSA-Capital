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

## Hypothèses à valider

| # | Hypothèse | Type | Validé par |
|---|---|---|---|
| H-L1 | Capital social = [DONNÉE À OBTENIR DE THOMAS] | Donnée manquante BLOQUANTE | Thomas |
| H-L2 | Directeur de publication = Thomas Issa, qualité Président | À confirmer avec Thomas | Thomas |
| H-L3 | ISSA Capital non assujettie TVA (pas de numéro attribué) | À vérifier avec expert-comptable | Thomas |
| H-L4 | Adresse email de contact privacy = privacy@issa-capital.com | Proposition — à valider | Thomas |
| H-L5 | Prestataire d'envoi email = Resend (confirmé dans product-vision.md) | PROVISOIRE — confirmé p.vision | @fullstack |

---

*Ce document est un draft de référence. Il ne constitue pas un avis juridique formel. Recommandation : validation par un avocat pour la clause de non-démarchage financier (section 4) avant mise en ligne, compte tenu des enjeux réglementaires CMF.*
