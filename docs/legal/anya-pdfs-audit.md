> Sources amont : src/lib/secretariat/rent/pdf-quittance.ts, src/lib/secretariat/rent/pdf-bail.ts, src/lib/secretariat/rent/pdf-fin-de-bail.ts, src/lib/secretariat/rent/bail-config.ts, src/lib/secretariat/rent/data/bail-config.json, src/lib/secretariat/rent/types.ts, src/lib/secretariat/rent/__tests__/pdf-bail.test.ts, src/lib/secretariat/rent/__tests__/pdf-fin-de-bail.test.ts, project-context.md (sections Identité, mémo S12), docs/product/functional-specs.md

# Audit juridique — PDFs Anya (Quittance / Bail / Fin de bail)

---

## ALERTE PRÉALABLE — Contradiction brief vs code (à trancher par Thomas avant mise en prod)

Le brief de cette mission indique "location nue". Le code produit le contraire.

`bail-config.json` ligne 22 : `"type_bail": "CONTRAT DE LOCATION MEUBLEE"`. Les biens sont décrits comme "meublé" dans le PDF (ex : "Un studio de 13m² avec une cuisine, chambre, toilettes et salle d'eau, meublé."). L'inventaire électroménager/vaisselle/linge confirme la location meublée.

Les régimes juridiques bail nu (loi 89-462 art. 10 — durée 3 ans minimum, dépôt 1 mois de loyer) et bail meublé (loi 89-462 art. 25-3 — durée 1 an, dépôt 2 mois) sont radicalement différents. Cet audit porte sur les baux **tels que générés dans le code**, c'est-à-dire des baux meublés. Si certains biens sont effectivement loués nus, un second bail nu devra être créé.

**Action Thomas :** confirmer que tous les biens ISSA sont loués meublés, ou signaler les biens nus pour création d'un template dédié.

---

## Synthèse exécutive

| Document | Verdict | Priorité absolue |
|---|---|---|
| Quittance | GO CONDITIONNEL | (1) Mention civility/qualité du locataire absente — (2) Distinction loyer/charges existante mais période manquante en header — (3) Adresse bailleur complète mais numéro SIRET absent (non obligatoire personne physique — voir P2) |
| Bail meublé | NO-GO | (1) Durée 1 an OK mais renouvellement tacite par période 1 an = non conforme (art. 25-6 — reconduction tacite = 1 an renouvelable, formulation code conforme en réalité mais vérification nécessaire) — (2) Trimestre IRL de référence non fixé dans le document — (3) Clause pénale 10% à risque d'annulation judiciaire (art. 1231-5 c.civ.) |
| Fin de bail | GO CONDITIONNEL | (1) Absence de mention du dépôt de garantie et de son délai de restitution — (2) Valeur juridique de l'"attestation" limitée sans mention de l'état des lieux de sortie — (3) Absence de référence à l'article 22 loi 89-462 |

**Risques critiques transversaux :** La clause pénale 10% telle que rédigée est susceptible d'être annulée ou réduite par un juge (art. 1231-5 C. civ.) — c'est le risque juridique le plus sérieux du dispositif. L'IRL sans trimestre de référence inscrit dans le bail rend la formule de révision inapplicable en cas de litige.

---

## 1. Quittance

### 1.1 Mentions obligatoires

| Mention | Base légale | Présente dans le code | Risque si absente |
|---|---|---|---|
| Identité du bailleur (nom, adresse) | Art. 21 loi 89-462 | OUI — `bailleurNom`, `bailleurAdresse`, `bailleurCpVille` | — |
| Identité du locataire (nom) | Art. 21 loi 89-462 | OUI — `locataireNom` | — |
| Adresse du logement | Art. 21 loi 89-462 | OUI — `bienAdresseLigne1`, `bienAdresseLigne2`, `bienCpVille` | — |
| Période concernée (début / fin) | Art. 21 loi 89-462 | OUI — `periodeDebut`, `periodeFin` + mois en header | — |
| Montant loyer (distinct des charges) | Art. 21 loi 89-462 + R.222-1 CCH | OUI — table loyer / charges / total séparés | — |
| Total en lettres et en chiffres | Usage + art. 21 | OUI — `totalLettres` + `formatMontant(total)` | — |
| Mention "gratuité de la quittance" | Art. 21 al. 5 loi 89-462 | **ABSENTE** — le texte de bas de page cite art. 21 mais ne mentionne pas explicitement que la quittance est délivrée gratuitement | Inopposabilité possible si le bailleur tentait de facturer — risque faible mais mention recommandée |
| Moyen de paiement | Usage non obligatoire légalement | OUI — `moyenPaiement` | — |
| Date d'émission + lieu | Usage + pièce justificative | OUI — `dateEmission`, `lieuEmission` | — |
| Civilité complète du locataire | Usage judiciaire | **ABSENTE** — `locataireNom` seul, sans civilité ni qualité ("Monsieur / Madame") | Fragilité si la quittance sert de pièce justificative pour le locataire (banque, CAF) |
| Signature du bailleur | Art. 21 loi 89-462 (remise = acte unilatéral) | OUI — image signature ou espace signature | — |

**Mention "gratuité" — formulation à ajouter dans le bas de page :**
Après "Quittance délivrée en application de l'article 21 de la loi n° 89-462 du 6 juillet 1989.", ajouter : "Cette quittance est délivrée gratuitement."

**Civilité locataire — formulation à ajouter :**
Le texte juridique central ("Je, soussigné... déclare avoir reçu de **[NOM]**...") doit utiliser `locataireNomAvecCivilite(loc)` (fonction déjà dans `types.ts`) au lieu de `locataireNom` seul. La civilité est stockée dans la fiche locataire.

### 1.2 Clauses présentes — conformité

| Clause | Statut | Observation |
|---|---|---|
| Texte juridique principal ("Je soussigné... déclare avoir reçu...") | CONFORME | Formulation classique, réserve de droits incluse |
| Détail loyer / charges / total | CONFORME | Table distincte loyer + provision charges + total — conforme art. 21 + R.222-1 CCH |
| Période de location (du X au Y) | CONFORME | `periodeDebut` et `periodeFin` présents dans le texte juridique |
| Moyen de paiement | CONFORME — non obligatoire | Bonne pratique, utile en cas de litige |
| Mentions légales de bas de page | CONFORME sur le fond | Cite art. 21 loi 89-462, paiement terme antérieur, congé préalable. Formulation correcte. |
| Non-renouvellement automatique par la quittance | CONFORME | Mention explicite : "ne saurait être considérée comme un titre de location" si congé préalable |

### 1.3 Forme et présentation

- **Date, lieu, signature** : conformes. Image signature numérique insérée (base64 PNG). Aucun problème de forme.
- **"Lu et approuvé"** : non requis pour une quittance — c'est un acte unilatéral du bailleur, pas un contrat. Correct de ne pas l'inclure.
- **Numérotation** : `N° QL-YYYY-MM-INIT` présent en haut à droite — bon usage.
- **Format électronique** : la quittance PDF est générée et envoyée via Telegram. Aucun texte de loi n'impose la forme papier. Un PDF est recevable. La signature image n'est pas une signature électronique qualifiée eIDAS (Règlement EU 910/2014) mais pour une quittance de loyer, la signature manuscrite numérisée est suffisante — la quittance n'est pas un acte solennel.
- **Absence de numéro de page** : acceptable pour un document d'une page.

### 1.4 Recommandations priorisées

- **P0 (bloquant prod) :** Remplacer `v.locataireNom` par `locataireNomAvecCivilite(loc)` dans le texte juridique central (`pdf-quittance.ts` ligne 164). Owner : @fullstack. Critère de validation : le PDF généré affiche "Monsieur Kenan Beguigneau" au lieu de "Kenan Beguigneau".
- **P1 (à corriger sous 1 mois) :** Ajouter "Cette quittance est délivrée gratuitement." dans les mentions légales de bas de page (`pdf-quittance.ts` ligne 311, après la première phrase). Owner : @fullstack. Base légale : art. 21 al. 5 loi 89-462.
- **P2 (amélioration) :** Ajouter le numéro de locataire ou référence contrat si disponible dans la fiche locataire — facilite la gestion en cas de parc de 15 biens. Pas d'obligation légale.

---

## 2. Bail meublé

### 2.1 Mentions obligatoires

Le bail meublé est régi principalement par la loi n° 89-462 du 6 juillet 1989 (art. 25-3 à 25-11), la loi ALUR du 24 mars 2014, et le décret n° 2015-587 du 29 mai 2015 (contrat-type bail meublé).

| Mention | Base légale | Présente dans le code | Risque si absente |
|---|---|---|---|
| Identité complète des parties (nom, date naissance, lieu naissance, nationalité) | Décret 2015-587 + art. 3 loi 89-462 | OUI — bailleur et locataire complets | — |
| Adresse du logement | Art. 3 loi 89-462 | OUI | — |
| Surface habitable | Art. 3-1 loi 89-462 (Loi Carrez pour la vente, mais surface déclarée bail par ALUR) | OUI — `bienSurfaceM2` | — |
| Destination du logement (résidence principale) | Art. 25-3 loi 89-462 | OUI — "Le logement constitue la résidence principale du locataire" (section 8) | — |
| Date de prise d'effet | Art. 25-6 loi 89-462 | OUI — `dateDebut` | — |
| Durée du bail | Art. 25-6 loi 89-462 | OUI — "un an" (bail-config.json) | — |
| Montant du loyer et modalités de paiement | Art. 25-3 loi 89-462 | OUI — section 10 | — |
| Montant et nature des charges | Art. 25-3 loi 89-462 | OUI — section 11, charges forfaitaires | — |
| Indexation sur IRL — trimestre de référence | Art. 17-1 loi 89-462 | **INSUFFISANT** — la formule est correcte mais le "trimestre précédant la signature" n'est PAS fixé comme valeur dans le document. Le bail doit indiquer la valeur de l'IRL de référence au moment de la signature, pas juste la règle générale. | Sans valeur de référence, la formule est inapplicable en cas de litige — révision bloquée |
| Montant du dépôt de garantie | Art. 25-6 loi 89-462 (max 2 mois loyer hors charges) | OUI — section 13, mention "ne pourra excéder deux mois de loyer principal" | — |
| Délai de restitution du dépôt de garantie | Art. 25-9 loi 89-462 | OUI — `delaiRestitutionDepot` = "1 mois" dans bail-config.json. Conforme si état des lieux sortie sans réserve (1 mois) ou avec réserves (2 mois). Voir section 2.3. | — |
| Notice d'information relative aux droits et obligations | Arrêté du 29 mai 2015 | MENTIONNÉE dans la liste des annexes obligatoires (section 19) mais pas générée par Anya — voir section 2.4 | Inopposabilité de certaines clauses |
| Mention du décret d'encadrement des loyers (si zone tendue) | Art. 17 loi 89-462 + Décret annuel | **ABSENTE** — Nanterre (92) est en zone tendue depuis le décret du 29 juillet 2023. Les biens Paris (Paris 18e — rue Myrha) sont également en zone tendue soumise à l'encadrement des loyers | Infraction, nullité de la clause de loyer, restitution du trop-perçu |
| Mention du loyer de référence (zone tendue) | Art. 140 loi ELAN + Décret annuel IDF | **ABSENTE** — Nanterre est dans la zone d'encadrement des loyers Grand Paris (depuis 2021 pour les communes de la MGP) | Même risque que ci-dessus |
| Inventaire du mobilier | Décret n° 2015-1444 du 6 novembre 2015 (liste minimale mobilier bail meublé) | OUI — section 22-23 avec inventaire détaillé | — |

**Point critique — zone tendue et encadrement des loyers :**

[À VÉRIFIER avec Thomas] Les biens identifiés dans bail-config.json sont à Nanterre (92000) et Paris 18e (rue Myrha). Ces deux zones sont soumises à l'encadrement des loyers :
- **Nanterre** : intégrée à la Métropole du Grand Paris (MGP), encadrement des loyers actif depuis le 1er juillet 2021 (arrêté préfectoral IDF). Loyer de référence fixé par le préfet de région IDF chaque année.
- **Paris** : encadrement des loyers actif (arrêté préfectoral annuel renouvelé, dernier en vigueur 2024-2025).

Obligation légale (art. 140 loi ELAN 2018) : le bail doit mentionner (a) le loyer de référence en vigueur à la date de signature, (b) le loyer de référence majoré, (c) le montant du loyer effectivement pratiqué, (d) le cas échéant le complément de loyer et sa justification.

Risque si absent : le locataire peut saisir la commission de conciliation, puis le tribunal judiciaire, pour obtenir la réduction du loyer à hauteur du loyer de référence ET la restitution du trop-perçu depuis l'entrée dans les lieux. Sanction pouvant atteindre plusieurs milliers d'euros par logement.

**Action Thomas (obligatoire avant toute nouvelle signature de bail) :** vérifier les loyers de référence applicables à chaque bien sur le simulateur officiel (www.encadrementdesloyers.gouv.fr) et intégrer ces mentions dans Anya.

### 2.2 Clauses présentes — conformité

| Clause | Statut | Article violé (si non conforme) | Formulation / action |
|---|---|---|---|
| Durée 1 an | CONFORME | Art. 25-6 loi 89-462 | Durée minimale 1 an = conforme (bail meublé résidence principale) |
| Renouvellement tacite | CONFORME | Art. 25-6 loi 89-462 | "renouvelable ensuite par tacite reconduction et par période d'un an" = conforme |
| Préavis locataire 1 mois | CONFORME | Art. 25-8 loi 89-462 | Préavis 1 mois pour le locataire = conforme (bail meublé) |
| Préavis bailleur 3 mois | CONFORME | Art. 25-8 loi 89-462 | Préavis 3 mois pour le bailleur = conforme |
| Forme du congé (LRAR ou acte huissier) | CONFORME | Art. 15 loi 89-462 | Formulation correcte |
| Loyer payable d'avance | CONFORME | Art. 25-3 loi 89-462 | "mensuel et d'avance" = conforme |
| Charges forfaitaires | A RENFORCER | Art. 25-3 loi 89-462 | Pour les baux meublés, les charges peuvent être forfaitaires (contrairement aux baux nus où elles sont au réel). La formulation est juridiquement correcte mais la mention de régularisation annuelle ("révisées chaque année aux mêmes conditions que le loyer principal") crée une ambiguïté : des charges forfaitaires ne se régularisent pas, elles sont révisées. Reformuler : "révisées annuellement selon les mêmes modalités d'indexation que le loyer." |
| Dépôt de garantie max 2 mois | CONFORME | Art. 25-6 loi 89-462 | La valeur dans bail-config.json est 1 000 € (1 mois loyer environ sur les biens testés) — conforme. La mention de plafond 2 mois est présente |
| Obligations locataire (10 items) | GLOBALEMENT CONFORME | Art. 7 loi 89-462 | Formulations issues directement de la loi. Point d'attention : l'obligation anti-piratage internet (item 10 — HADOPI) est juridiquement correcte mais peu sanctionnable en pratique depuis la réforme 2022 |
| Obligations bailleur (4 items) | CONFORME | Art. 6 loi 89-462 | Formulations conformes |
| Clause résolutoire | CONFORME | Art. 24 loi 89-462 | Les 4 cas (loyer/charges, chèque sans provision, offre tardive, absence attestation assurance) = conformes. Le délai "un mois après commandement" = conforme à l'art. 24 |
| Clause pénale 10% | NON CONFORME — RISQUE ÉLEVÉ | Art. 1231-5 C. civ. | Voir section 2.5 — Risques transversaux |
| Indexation IRL | CONFORME sur la formule, INCOMPLET sur les données | Art. 17-1 loi 89-462 | La formule "nouveau loyer = loyer en cours × (nouvel IRL / IRL de référence)" est exacte. Mais l'IRL de référence (valeur numérique du trimestre de signature) n'est pas inscrit dans le bail. En cas de litige, le juge ne peut pas vérifier le calcul sans cette valeur. |
| État des lieux renvoyé à annexe | CONFORME | Art. 3-2 loi 89-462 | "L'état des lieux sera obligatoirement annexé au présent contrat" = conforme. Le formulaire d'état des lieux page 2 est présent. |
| Inventaire renvoyé à annexe | CONFORME | Décret 2015-1444 | Inventaire détaillé intégré au bail (page 3+) = conforme |
| Élection de domicile | CONFORME | Usage | Standard |
| Signature avec mention manuscrite | CONFORME | Usage judiciaire | "Faire précéder chaque signature de la mention manuscrite : Lu et approuvé, bon pour accord" = bonne pratique, conforme aux usages |

### 2.3 Forme et présentation

- **Signatures** : la mention "Fait à [lieu], le [date], en originaux dont un remis au preneur" est conforme. La remise d'un exemplaire au locataire est obligatoire (art. 3 loi 89-462).
- **"Lu et approuvé"** : présent en instruction manuscrite. Bonne pratique — renforce la valeur probatoire.
- **Nombre d'originaux** : la formulation "en originaux" sans préciser le nombre est acceptable. Usage : 2 originaux (bailleur + locataire). Suggérer "en deux originaux" pour clarté.
- **Format électronique (DOCX + PDF)** : le DOCX est le format principal, le PDF est complémentaire. Un bail peut être conclu par écrit sur support papier ou électronique (art. 3 loi 89-462 modifié par ALUR). Un DOCX imprimé et signé est valide. Le PDF généré sans signature électronique qualifiée n'est pas un original signé — il doit être imprimé, signé manuellement et remis en 2 exemplaires.
- **Paraphes** : aucun paraphe de page n'est prévu dans le code. Usage judiciaire : il est recommandé (non obligatoire légalement) de parapher chaque page pour éviter les contestations sur le contenu. A minima, recommander à Thomas de le faire manuellement à l'impression.
- **Numérotation des pages** : absente dans le PDF. Recommandée pour un document de plusieurs pages (risque de substitution de page en cas de litige).

### 2.4 Annexes obligatoires

| Annexe | Base légale | Générée par Anya | Action requise |
|---|---|---|---|
| Notice d'information droits/obligations | Arrêté 29 mai 2015 | NON — mentionnée dans liste mais non générée | Thomas doit joindre le PDF officiel téléchargeable sur service-public.fr à chaque bail |
| DPE (Diagnostic de Performance Energétique) | Art. 3-3 loi 89-462 + art. L.126-26 CCH | NON — mentionné dans liste | Thomas doit le fournir (diagnostiqueur certifié) — valable 10 ans |
| ERP (État des Risques et Pollutions) | Art. L.125-5 C.envir. | NON — mentionné dans liste | Thomas doit le produire via le formulaire cerfa 13616 — renouvelable à chaque nouveau bail |
| CREP (Constat Risque Exposition Plomb) | Art. L.1334-7 CSP | NON — mentionné si logement avant 1949 | Thomas doit fournir si les biens datent d'avant 1949 — valable illimité si négatif |
| Diagnostic gaz et/ou électricité | Art. L.134-6 + L.134-7 CCH | NON — mentionné si installations > 15 ans | Thomas doit fournir si installations > 15 ans — valable 6 ans |
| Etat des lieux entrée | Art. 3-2 loi 89-462 | OUI (partiel) — formulaire page 2 dans le DOCX | Le formulaire page 2 est sommaire. Voir recommandations P1. |
| Inventaire | Décret 2015-1444 | OUI — section 22-23 | Conforme |

### 2.5 Recommandations priorisées

- **P0 (bloquant prod — risque financier immédiat) :** Ajouter les mentions d'encadrement des loyers pour les biens en zone tendue (Nanterre + Paris). Owner : Thomas (vérifier les loyers de référence sur encadrementdesloyers.gouv.fr) + @fullstack (ajouter les champs `loyerReferenceEncadrement`, `loyerReferenceMajore` dans `BailVariables` et les afficher dans la section loyer). Base légale : art. 140 loi ELAN 2018. Critère de validation : le bail généré affiche "Loyer de référence : X€/m² — Loyer de référence majoré : Y€/m²" avec les valeurs du décret en cours.

- **P0 (bloquant prod — risque de révision inapplicable) :** Intégrer la valeur de l'IRL de référence dans le bail. Owner : @fullstack. Solution technique : dans `construireVariablesBail()` (`bail-config.ts`), appeler l'API INSEE IRL au moment de la génération du bail et stocker la valeur du trimestre en cours dans `BailVariables`. Cette valeur doit être affichée dans la section Indexation : "L'indice de référence est celui du [trimestre] publié par l'INSEE le [date], d'une valeur de [XXX.XX]." Base légale : art. 17-1 loi 89-462. Critère de validation : le bail généré mentionne la valeur numérique de l'IRL de référence.

- **P1 (à corriger sous 1 mois — risque probatoire) :** Ajouter la numérotation des pages dans le PDF bail (`pdf-bail.ts`). PDFKit supporte `doc.page.number` via un event `pageAdded`. Owner : @fullstack. Critère : chaque page du PDF affiche "Page X / Y" en pied de page.

- **P1 (à corriger sous 1 mois — risque probatoire) :** Préciser "en deux originaux" au lieu de "en originaux" dans la clause de signature (section 20, `pdf-bail.ts` ligne ~392). Owner : @fullstack.

- **P1 (à corriger sous 1 mois — conformité légale) :** Reformuler la clause de charges forfaitaires pour éviter l'ambiguïté régularisation/révision. Owner : @fullstack. Formulation actuelle ligne ~299 : "révisées chaque année aux mêmes conditions que le loyer principal". Remplacer par : "révisées annuellement dans les mêmes proportions que le loyer, selon l'IRL."

- **P2 (amélioration — robustesse probatoire) :** Ajouter une instruction de paraphe de page dans la notice d'impression (hors du PDF généré — dans la réponse Telegram : "Pensez à parapher chaque page avant signature."). Owner : @fullstack (message Telegram post-génération).

---

## 3. Fin de bail

### 3.1 Mentions obligatoires

Il n'existe pas de formulaire légalement imposé pour l'attestation de fin de bail. C'est un document de pratique courante. Sa valeur juridique est celle d'un acte sous seing privé unilatéral (déclaration du bailleur).

| Mention | Obligatoire | Présente dans le code | Risque si absente |
|---|---|---|---|
| Identité du bailleur | OUI (acte sous seing privé) | OUI — nom, date et lieu naissance | — |
| Identité du locataire | OUI | OUI — `locataireNom` | — |
| Adresse du bien | OUI | OUI — `adresseBien` | — |
| Date de fin d'occupation | OUI | OUI — `dateFin` | — |
| Date d'émission | OUI | OUI — `dateEmission` | — |
| Lieu de signature | OUI | OUI — `lieuSignature` | — |
| Signature du bailleur | OUI | OUI — image signature | — |
| Mention du dépôt de garantie et délai de restitution | NON (pas obligatoire dans ce document) mais FORTEMENT recommandé | **ABSENTE** | Risque litiges sur restitution dépôt — locataire peut arguer de non-information sur délai et modalités |
| Référence à l'état des lieux de sortie | NON mais recommandé | **ABSENTE** | Sans cette mention, l'attestation ne dit rien de l'état du logement — ne peut pas servir à justifier une retenue sur dépôt |
| Mention du solde éventuel dû | NON — figure dans le décompte séparé | ABSENTE — normal, hors scope attestation | — |

### 3.2 Valeur juridique exacte de l'"attestation"

Cette attestation est un **acte sous seing privé unilatéral du bailleur**. Elle atteste la fin de la relation locative. Sa valeur juridique est :

1. **Preuve de la fin du bail** : le locataire peut l'utiliser pour justifier auprès d'un futur bailleur, de la CAF, de Pôle Emploi (aide au logement), ou d'une banque qu'il ne réside plus à cette adresse.
2. **Elle ne constitue pas une quittance de solde** : elle ne prouve pas que tous les loyers ont été payés ni que le dépôt a été restitué intégralement.
3. **Elle ne remplace pas l'état des lieux de sortie** : document distinct, contradictoire, obligatoire (art. 3-2 loi 89-462). L'attestation et l'état des lieux sont deux documents complémentaires.
4. **Preuve de l'article 22 loi 89-462 (restitution dépôt)** : l'article 22 fixe le délai de restitution du dépôt de garantie. Ce délai court à compter de "la remise des clés par le locataire". L'attestation de fin de bail, combinée à la date de remise des clés, est un élément de preuve mais ne suffit pas seule à prouver la remise des clés.

### 3.3 Conformité avec l'article 22 loi 89-462 (restitution dépôt)

L'article 22 loi 89-462 impose :
- Délai de restitution : **1 mois** si l'état des lieux de sortie est conforme à l'état des lieux d'entrée, **2 mois** si des dégradations sont constatées.
- Justification de toute retenue : le bailleur doit justifier chaque retenue par des devis ou factures.
- Majoration de plein droit de 10% du loyer mensuel hors charges par mois de retard au-delà du délai légal (à partir du 1er mois de retard).

Le code `bail-config.json` ligne 17 fixe `"delai_restitution_depot": "1 mois"`. Cette valeur est inscrite dans le bail mais **pas dans l'attestation de fin de bail**. L'attestation devrait mentionner le délai applicable et conditionner la date de restitution à la remise des clés.

### 3.4 Recommandations priorisées

- **P0 (bloquant prod — risque litiges dépôt) :** Ajouter un paragraphe dans l'attestation relatif au dépôt de garantie. Formulation suggérée : "Le dépôt de garantie versé lors de la signature du bail sera restitué dans le délai légal (1 mois si l'état des lieux de sortie est conforme à l'état des lieux d'entrée, 2 mois en cas de dégradations constatées) à compter de la remise des clés, conformément à l'article 22 de la loi n° 89-462 du 6 juillet 1989." Owner : @fullstack (`pdf-fin-de-bail.ts`, après le corps de l'attestation). Critère de validation : le PDF généré mentionne délai de restitution + condition état des lieux + référence art. 22.

- **P1 (à corriger sous 1 mois — valeur probatoire) :** Ajouter une référence à l'état des lieux de sortie dans le corps de l'attestation. Formulation suggérée : "La remise des clés a eu lieu le [dateFin]. Un état des lieux de sortie a été établi contradictoirement." Owner : @fullstack + Thomas (ajouter `dateFin` comme champ passé et éventuellement un booléen `etatLieuxEtabli`). Critère : le PDF généré mentionne la remise des clés et l'état des lieux.

- **P1 (à corriger sous 1 mois — exhaustivité) :** Ajouter la référence à l'article 22 loi 89-462 dans le texte de l'attestation pour renforcer sa valeur légale. Owner : @fullstack. Base légale : art. 22 loi 89-462.

- **P2 (amélioration) :** Ajouter le numéro de bail ou la date d'entrée dans le bail en référence, pour faciliter la traçabilité en cas de litige portant sur plusieurs locations successives. Owner : Thomas (ajouter `dateEntreeBail` à `FinDeBailVariables`) + @fullstack.

---

## 4. Risques transversaux

### 4.1 Clause pénale 10% — risque de réduction judiciaire

**Base légale :** Art. 1231-5 du Code civil.

**Texte dans le code :** "le preneur accepte entièrement et définitivement d'avoir à payer au bailleur une somme égale à 10% des sommes dues, sans que ce paiement puisse le dispenser du règlement des sommes impayées et du règlement intégral des frais nécessaires au recouvrement de ces sommes."

**Analyse :** La clause pénale dans un bail d'habitation est valide en droit commun (art. 1231-5 C. civ.), mais elle est soumise au **pouvoir modérateur du juge** : si la pénalité est "manifestement excessive", le juge peut la réduire d'office. 10% des sommes dues est un taux classique mais pas automatiquement validé par les tribunaux. Les juges du fond ont régulièrement réduit ou supprimé des clauses pénales en baux d'habitation en faveur du locataire, notamment lorsque :
- Le loyer est bas et la pénalité disproportionnée
- La bonne foi du locataire est établie
- La clause s'applique automatiquement sans mise en demeure préalable

**Le troisième alinéa de la clause pénale est le plus risqué :** "le preneur... devra une astreinte par jour de retard calculée sur la base de trois fois le loyer journalier en cours à la date du départ." L'astreinte de 3× le loyer journalier peut être qualifiée de peine excessive par un juge — notamment parce qu'elle cumule avec la clause résolutoire et les dommages et intérêts.

**Verdict :** La clause pénale 10% est juridiquement valide mais présente un risque sérieux de réduction judiciaire. L'astreinte de 3× le loyer journalier est particulièrement vulnérable. En cas de litige, Thomas ne peut pas compter sur ces montants comme certains.

**Recommandation P1 :** Maintenir la clause pénale 10% (c'est une protection légitime) mais reformuler l'astreinte pour réduire son risque d'annulation. Formulation alternative plus défendable : "une indemnité d'occupation égale au loyer contractuel journalier pour chaque jour de retard à libérer les lieux" (au lieu de 3×). Owner : Thomas (arbitrage business — veut-il une clause plus agressive mais plus risquée, ou plus modérée mais plus solide ?) + @fullstack si Thomas valide la reformulation.

### 4.2 Inventaire interactif Anya — valeur probatoire

L'inventaire est intégré dans le DOCX/PDF du bail (sections 22-23). Sa valeur probatoire dépend d'une condition unique : la **signature contradictoire du locataire**.

Un inventaire signé par le seul bailleur a une valeur probatoire faible. Si le locataire conteste un item, il pourra arguer qu'il n'a jamais accepté la liste. Pour être opposable, l'inventaire doit être :
1. Établi contradictoirement (en présence des deux parties)
2. Signé par le bailleur ET le locataire
3. Daté de la remise des clés

**Dans le code actuel :** La section inventaire du DOCX/PDF inclut une ligne de signature datée "Fait à [lieu], le ___/___/______" (PDF bail ligne ~429). La signature du locataire n'est pas numérique — elle est manuscrite à l'impression. C'est **correct** : l'inventaire doit être signé manuellement lors de la remise des clés.

**Recommandation P2 :** Ajouter deux lignes de signature dans l'inventaire (bailleur + locataire) au lieu d'une seule, avec espace pour les noms. Owner : @fullstack (`pdf-bail.ts` section inventaire).

### 4.3 IRL — trimestre de référence

La formule de révision est correcte mais incomplète. Pour être applicable, le bail doit indiquer :
- Le trimestre de référence (ex : "2e trimestre 2026")
- La valeur de l'IRL à ce trimestre (ex : "134,84")

Sans ces deux données numériques dans le bail, la révision est théoriquement applicable mais difficile à mettre en œuvre en cas de désaccord du locataire. Le locataire pourrait contester la date de référence.

**Solution technique recommandée :** Intégrer un appel à l'API INSEE (séries temporelles) dans `construireVariablesBail()` pour récupérer automatiquement la valeur IRL du dernier trimestre publié au moment de la génération du bail. L'API est gratuite et publique (api.insee.fr/series/BDM/V1 — série IRL disponible). Owner : @fullstack. Base légale : art. 17-1 loi 89-462.

---

## 5. Annexes obligatoires — workflow recommandé

### Ce qu'Anya peut générer

| Document | Peut être généré par Anya | Format |
|---|---|---|
| Bail (DOCX + PDF) | OUI | DOCX imprimable + PDF |
| Inventaire contradictoire | OUI (intégré au bail) | Intégré DOCX/PDF |
| Formulaire état des lieux (trame) | OUI — trame vide page 2 du bail | À compléter manuellement |
| Quittance de loyer | OUI | PDF |
| Attestation fin de bail | OUI | PDF |
| Récapitulatif ERP rempli | NON — nécessite données localisation + données Géorisques | Hors scope Anya V1 |

### Ce que Thomas doit fournir manuellement

| Document | Qui le produit | Durée de validité | Action requise |
|---|---|---|---|
| Notice d'information droits/obligations bailleurs/locataires (bail meublé) | Service-public.fr (PDF officiel) | Permanente (révisée périodiquement) | Thomas télécharge depuis www.service-public.fr/particuliers/vosdroits/R40669 et joint à chaque bail |
| DPE (Diagnostic de Performance Energétique) | Diagnostiqueur certifié | 10 ans (sauf travaux) | Thomas à commander une fois par bien — à renouveler si travaux ou expiration |
| ERP (État des Risques et Pollutions) | Thomas (formulaire cerfa 13616 sur georisques.gouv.fr) | 6 mois (à chaque bail) | Thomas remplit le formulaire en ligne et l'imprime — à renouveler à chaque nouveau bail |
| CREP (Constat Risque Exposition Plomb) | Diagnostiqueur certifié | Illimité si négatif | Si biens construits avant 1er janvier 1949 — à vérifier par Thomas |
| Diagnostics gaz et électricité | Diagnostiqueur certifié | 6 ans | Si installations > 15 ans — à vérifier par Thomas |
| État des lieux d'entrée complété | Thomas + locataire (contradictoire) | Par bail | Compléter manuellement la trame page 2 du DOCX lors de la remise des clés |

### Ordre d'opération recommandé (workflow à chaque nouveau bail)

1. **Anya génère le bail** (DOCX + PDF) → Thomas imprime 2 exemplaires
2. **Thomas rassemble les annexes** : notice info (DL service-public), DPE (existant ou à commander), ERP (à remplir sur georisques.gouv.fr), CREP si applicable, diagnostics gaz/élec si applicables
3. **Remise des clés** : signature des 2 exemplaires de bail (bailleur + locataire, mention manuscrite "Lu et approuvé"), état des lieux d'entrée contradictoire, signature inventaire contradictoire
4. **Thomas garde un exemplaire + copies annexes**, remet l'autre exemplaire complet au locataire
5. **Anya génère les quittances** chaque mois à partir des données de la fiche locataire

---

## 6. Open questions — Thomas doit trancher

1. **Type de location** : les biens sont-ils TOUS loués meublés, ou certains sont-ils loués nus ? Si biens nus existent, un second template bail nu est nécessaire (durée 3 ans, dépôt 1 mois, obligations différentes).

2. **Zone tendue — encadrement des loyers** : les loyers pratiqués sont-ils dans les plafonds d'encadrement ? Thomas doit vérifier sur encadrementdesloyers.gouv.fr pour chaque bien (Nanterre et Paris). Si les loyers dépassent le plafond majoré, risque de restitution du trop-perçu.

3. **Clause pénale astreinte** : Thomas veut-il maintenir "3× le loyer journalier" (plus dissuasif mais plus risqué d'annulation) ou préfère-t-il "1× le loyer journalier" (plus défendable en justice) ?

4. **IRL automatique** : Thomas accepte-t-il que Anya appelle l'API INSEE en temps réel pour récupérer l'IRL du trimestre courant ? Alternative : Thomas renseigne manuellement la valeur IRL à chaque début de trimestre dans bail-config.json.

5. **Etat des lieux de sortie** : souhaite-t-il qu'Anya génère un formulaire type état des lieux de sortie (distinctement du bail) pour avoir un document dédié à la fin du bail ?

---

**Note** : Les livrables de cet audit sont des analyses juridiques de référence, pas des avis formels d'avocat. Pour les clauses à fort enjeu (clause pénale, encadrement des loyers, conformité DPE), une validation par un avocat spécialisé en droit immobilier est recommandée avant mise en production élargie.

---

## Handoff

**Handoff → @fullstack**
- Fichiers produits : `docs/legal/anya-pdfs-audit.md`
- Modifications de code requises par ordre de priorité :
  - **P0 quittance** : `src/lib/secretariat/rent/pdf-quittance.ts` ligne 164 — remplacer `v.locataireNom` par `locataireNomAvecCivilite(loc)` (fonction disponible dans `types.ts`)
  - **P0 bail** : `src/lib/secretariat/rent/bail-config.ts` + `src/lib/secretariat/rent/types.ts` — ajouter champs `loyerReferenceEncadrement`, `loyerReferenceMajore` dans `BailVariables` + appel API INSEE IRL dans `construireVariablesBail()` pour récupérer valeur IRL trimestre courant
  - **P0 fin-de-bail** : `src/lib/secretariat/rent/pdf-fin-de-bail.ts` — ajouter paragraphe dépôt de garantie + délai restitution + référence art. 22 loi 89-462 après le corps de l'attestation
  - **P1 quittance** : `pdf-quittance.ts` ligne 311 — ajouter "Cette quittance est délivrée gratuitement."
  - **P1 bail** : numérotation des pages PDF, mention "en deux originaux", reformulation charges forfaitaires
  - **P1 fin-de-bail** : référence état des lieux de sortie + référence art. 22

**Handoff → Thomas (config et actions hors code)**
- Vérifier encadrement des loyers sur encadrementdesloyers.gouv.fr pour Nanterre (92000) et Paris 18e (rue Myrha) → communiquer les valeurs loyer référence/loyer majoré à @fullstack pour intégration dans Anya
- Confirmer que tous les biens sont loués meublés (sinon : signaler les biens nus pour création template dédié)
- Télécharger notice d'information droits/obligations (bail meublé) sur service-public.fr et joindre systématiquement à chaque bail signé
- Vérifier dates de construction des biens (avant 1949 = CREP obligatoire)
- Arbitrer clause pénale astreinte : 3× loyer (dissuasif, risque judiciaire) vs 1× loyer (défendable)
- Arbitrer IRL : appel API automatique vs saisie manuelle trimestrielle dans bail-config.json
