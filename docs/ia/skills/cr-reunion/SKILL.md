---
name: cr-reunion
description: "Produit un compte rendu de réunion au format PDF légal à partir d'une note (texte ou vocal transcrit). À utiliser quand Thomas dit 'fais le CR', 'rédige un compte rendu', 'compte rendu de ma réunion / mon déjeuner avec X', 'transforme cette note en CR', ou quand une note de réunion substantielle (≥ 100 caractères) doit être formalisée. Détecte le mode solo ou multi-participants, structure le CR en 4 sections légales (Art. 39-1 CGI), applique les règles juridiques @legal (cohérence entité, registre, formules), génère le PDF via scripts/generate_cr_pdf.js (rendu identique au bot Anya), le range dans le dossier de l'entité (IC / GO / VI / VV) et le propage dans la fiche de l'entité du vault."
---

# Skill cr-reunion — compte rendu PDF d'une réunion

> À partir d'une note de réunion, produire un compte rendu structuré au format PDF légal, le ranger dans le dossier de l'entité concernée, et le propager dans la fiche de cette entité. Copie exécutable du workflow maître `08. Outils/Anya/Skills/Workflow CR Reunion.md`. Le rendu PDF est produit par `scripts/generate_cr_pdf.js` — portage fidèle du moteur du bot Anya, donc rendu identique.
>
> Le bot Anya consomme cette fiche comme **source de vérité unique** du contrat de rédaction des CR. La § 6 (règles juridiques @legal) en est le cœur : son respect conditionne la valeur probatoire du document en contrôle fiscal.

## 1. Trigger

### Déclencheurs verbaux

Thomas exprime l'intention de produire un compte rendu : « fais le CR de [réunion] », « rédige un compte rendu », « compte rendu de mon déjeuner avec [personne] », « CR réunion [sujet] », « transforme cette note en CR ».

### Déclencheur contextuel

Une note de réunion substantielle (≥ 100 caractères, décrivant un échange, un rendez-vous, une visite ou une activité professionnelle) peut enclencher la skill automatiquement.

### Canaux d'apport de la note

La note peut venir de **n'importe quel canal** — saisie/dictée directe dans Cowork, vocal transcrit, message Telegram via Anya, copier-coller d'un transcript. Le déclencheur, c'est l'intention « produire un CR », pas le canal.

### Variantes

- **Multi-participants** : la note nomme au moins un tiers → libellé « Participants ».
- **Solo** : activité sans tiers (visite seul, signature solo) → libellé « Présent ».

### Hors trigger

Photo sans note, email entrant, note sous 100 caractères → ne pas produire de CR.

## 2. Input

- **Fiche de l'entité concernée** (`02. Projets/02. Pro/`) — pour la propagation.
- **`hot-context.md`** — contexte récent.
- **Fiches contacts des participants nommés** (`07. Contacts/`) — pour le **nom exact** et la **qualité de la relation** de chaque participant tiers. Le **titre et la société affichés sur le CR ne sont PAS recopiés de la fiche** : ils sont déterminés par l'entité du CR (cf. § 6.1). Les contacts récurrents sont par ailleurs lus dynamiquement depuis `07. Contacts/` au runtime par le bot — rien à injecter manuellement.
- **La note** transmise par Thomas — matière première unique.
- **Photos** éventuellement jointes (jusqu'à ~10) → annexes (cf. § 6.6).

Entités possibles : **IC** (ISSA Capital SAS), **GO** (Gradient One), **VI** (Versi Immobilier), **VV** (Versi Invest).

## 3. Étapes

### 3.0 Prérequis techniques

Le moteur de rendu `scripts/generate_cr_pdf.js` requiert **pdfkit**. Au premier usage, dans le dossier de la skill : `npm install pdfkit`.

La signature manuscrite de Thomas est lue via la variable d'environnement `SIGNATURE_PNG_PATH`. La pointer vers le fichier du vault `08. Outils/Skills/_assets/signature-thomas-issa.png` — résoudre son chemin absolu au moment de l'exécution. Sans cette variable, le PDF est généré sans la signature manuscrite ; le reste du rendu est intact.

### 3.1 Identifier l'entité et le mode

Déterminer l'entité (IC / GO / VI / VV) et le mode (solo si aucun tiers nommé, multi sinon). La détection de l'entité suit la **priorité absolue à la mention explicite** et la vérification RBAC décrites au § 6.5 — en cas d'ambiguïté, demander, ne jamais inférer en silence.

### 3.2 Attribuer la référence séquentielle

Référence `<ENTITÉ>-CR-<ANNÉE>-<NNNN>`. Lister les CR existants du dossier « Comptes Rendus » de l'entité, prendre le numéro le plus haut de l'année + 1. Numérotation continue, sans trou.

### 3.3 Rédiger le compte rendu (objet `CRDraft`)

Construire un objet JSON `CRDraft` avec ces champs :

```json
{
 "entite": "IC | GO | VI | VV",
 "type_reunion": "dejeuner | diner | conseil | appel | interne | visite-immo | signature-contrat",
 "date_reunion": "AAAA-MM-JJ",
 "lieu": "...",
 "participants": [
 { "prenom": "", "nom": "", "titre": "", "societe": "", "qualite_relation": "" }
 ],
 "objet": "objet de la réunion (≥ 10 caractères)",
 "montant_ttc_eur": null,
 "etablissement_nom": null,
 "section_1_objet_art_39_1": "Objet et lien avec l'intérêt social — ≥ 50 caractères",
 "section_2_points_abordes": "Points abordés — ≥ 50 caractères",
 "section_3_decisions": "Décisions et conclusions — ≥ 20 caractères",
 "section_4_suites_a_donner": "Suites à donner, ou null",
 "annexes_photographiques": [ { "numero": 1, "legende": "..." } ]
}
```

Règles de rédaction :

- **Registre et formules** : rédiger selon le § 6 — passé composé (§ 6.2), formules F1-F15 privilégiées (§ 6.3), formules B1-B12 proscrites (§ 6.4).
- **Bloc participants** : le signataire (Thomas Issa) figure **toujours en tête** ; titre et société de chaque participant déterminés par l'entité du CR (§ 6.1). Lire la fiche contact pour le nom exact et la qualité de la relation ; si le participant n'a pas de fiche, demander les informations à Thomas.
- **Mode solo** : `participants` = `[]` (le moteur affiche « Présent : Thomas Issa, [titre selon l'entité, § 6.1] »).
- **Section 1 — objet et lien avec l'intérêt social** : doit contenir l'objet **précis** (jamais « réunion de travail »), le lien explicite avec l'intérêt social de l'entité, la mention « conformément à l'Art. 39-1 du CGI », et le montant TTC s'il y a dépense. Phrase-type validée @legal :
 > « La présente réunion, tenue le [DATE] à [LIEU], avait pour objet [OBJET PRÉCIS]. Elle s'inscrit dans le cadre des activités de [ENTITÉ] et répond à l'intérêt social de celle-ci au sens de l'Art. 39-1 du CGI. La dépense y afférente s'est élevée à [MONTANT] € TTC (facture [ÉTABLISSEMENT] n° [NUMÉRO] du [DATE_FACTURE], acquittée par [MOYEN_PAIEMENT]). »

 Si le numéro / la date / le moyen de paiement ne sont pas fournis, remplacer la parenthèse par : « (justificatif disponible dans l'application de facturation Tiime, rattaché à l'entité [ENTITÉ]) ». La mention « voir facture en annexe » seule est **insuffisante** (audit @legal session 9). Jamais de placeholder `[à compléter]`.
- **Justification du format repas** : si `type_reunion` = `dejeuner` ou `diner`, la Section 1 contient **obligatoirement** une justification du format repas en une phrase (ex. « Ce format a été retenu compte tenu du déplacement des participants depuis Paris »). Ne jamais l'omettre — c'est le point le plus ciblé en contrôle fiscal. Si la réunion comprend une visite (immobilière, technique) en plus du repas, mentionner la visite comme événement distinct avec son horaire approximatif.
- **Section 4 — suites à donner, attribution par défaut** : sujets **immobiliers** (visite de bien, chantier, plans, pré-commercialisation, acquisition) → responsable par défaut Maxime Lemoine ; sujets **administratifs / financiers** (pacte d'associés, juridique, comptabilité, facturation) → Thomas Issa ; sujets **techniques GO** → selon contexte. Sauf attribution explicite par Thomas dans la note.
- **`montant_ttc_eur`** et **`etablissement_nom`** : renseignés ensemble si la réunion a donné lieu à une dépense ; `null` ensemble sinon.
- **Photos jointes** : une entrée `annexes_photographiques` par photo (numéro + légende), avec renvois croisés dans les sections — cf. § 6.6. `null` si aucune photo.
- Rédaction fidèle à la note : aucun fait, montant, date ou nom inventé.

### 3.4 Générer le PDF

1. Écrire un fichier `input.json` :

```json
{
 "cr": { ...CRDraft... },
 "reference": "<ENTITÉ>-CR-<ANNÉE>-<NNNN>",
 "dateEtablissement": "<horodatage ISO 8601, ex. 2026-05-20T14:30:00Z>",
 "photos": [ { "base64": "...", "mimeType": "image/jpeg" } ]
}
```

(`photos` : omettre ou `[]` s'il n'y a pas de photo ; sinon une entrée par annexe, dans le même ordre.)

2. Exécuter, depuis le dossier de la skill :

```
SIGNATURE_PNG_PATH=<chemin absolu de signature-thomas-issa.png dans le vault> node scripts/generate_cr_pdf.js input.json <référence>.pdf
```

Le script produit le PDF A4 légal (bandeau CONFIDENTIEL, métadonnées, 4 sections, annexes photo, footer DGFiP + RGPD + Art. 39-1, signature).

### 3.5 Déposer le PDF

Ranger `<référence>.pdf` dans le dossier « Comptes Rendus » de l'entité (`02. Projets/02. Pro/[Entité]/Documents/Comptes Rendus/`).

### 3.6 Propager dans la fiche entité

Ajouter une ligne dans la section `## Compte rendu` de la fiche de l'entité (lien + référence + date), les CR du plus récent au plus ancien. Créer la section si absente. **Compléter, jamais remplacer.** Si le CR est déjà référencé → ne rien ajouter. Si la fiche entité est introuvable → le PDF reste livré, demander à Thomas quelle fiche compléter ou créer.

### 3.7 Confirmer

Rendre le récap : entité, mode, référence, lien du PDF, fiche mise à jour.

## 4. Output

- Un **PDF** légal `<référence>.pdf` dans le dossier « Comptes Rendus » de l'entité.
- La **fiche entité** complétée d'une ligne dans `## Compte rendu`.
- Un récap rendu à Thomas.

Les éventuelles photos jointes sont portées dans le champ `annexes_photographiques` du `CRDraft` (`[{numero, legende}]`) et rendues en section Annexes du PDF, avec renvois croisés dans le corps (§ 6.6).

## 5. Méthode

### 5.1 Red lines

1. **Zéro invention de participant** — tiers non identifiable → mode solo ou « (à identifier) ». Jamais de nom supposé.
2. **Zéro invention de fait** — montant, date, lieu, décision : uniquement ce que la note contient.
3. **Cohérence entité** — jamais ISSA Capital dans un CR GO / VI / VV ; titres relatifs à l'entité du CR (§ 6.1).
4. **Compléter ≠ remplacer** — la section `## Compte rendu` s'enrichit, ne s'écrase jamais.
5. **Propagation non bloquante** — un problème de propagation n'empêche jamais la livraison du PDF.
6. **Nom du PDF = la référence** — `<référence>.pdf`, rien d'autre.
7. **Format légal respecté** — 4 sections, footer DGFiP, Art. 39-1 : c'est une pièce fiscale.
8. **Jamais de placeholder** — un CR est un document final. Justificatif manquant → renvoi vers Tiime, jamais « [à compléter] ».

### 5.2 Arbre de décision — solo vs multi

```
Note de réunion (≥ 100 caractères)
├── Au moins un tiers nommé → mode multi-participants (« Participants »)
└── Aucun tiers → mode solo (« Présent », Thomas signataire)
```

### 5.3 Critères de qualité

- CR conforme : en-tête + bloc participants + 4 sections (Suites optionnelle).
- Aucune donnée inventée ; tout fait traçable à la note ou aux fiches contact.
- Cohérence entité respectée (§ 6.1) ; registre et formules conformes (§ 6.2–6.4).
- Référence séquentielle sans trou.
- Fiche entité enrichie sans perte de contenu.
- PDF valide au format légal.

### 5.4 Exemple — mode multi-participants avec dépense

**Note transmise** : « Déjeuner d'affaires hier avec Maxime Lemoine au Voltaire (82,43 € réglés), pour valider le pacte d'associés Gradient One. Transmission du pacte à l'avocat actée sous 48 h. »

**Traitement** : entité **GO**, mode multi. Fiche contact `Maxime Lemoine` lue → **nom exact** et qualité de la relation. Le titre et la société affichés découlent de l'entité du CR (§ 6.1), **pas de la fiche contact** : le CR concernant Gradient One, Maxime figure comme « Associé, Gradient One » et Thomas comme « Associé, Gradient One » (et non « Président, ISSA Capital »). Référence `GO-CR-2026-0007`, type `dejeuner`, `montant_ttc_eur: 82.43`, `etablissement_nom: "Le Voltaire"`.

La `section_1_objet_art_39_1` suit la phrase-type @legal, mentionne l'Art. 39-1 du CGI, renvoie le justificatif vers Tiime (numéro de facture non fourni) et **justifie le format déjeuner** en une phrase. La `section_3_decisions` emploie F1/F2 (« Il a été acté que… »). Le PDF `GO-CR-2026-0007.pdf` est déposé dans le dossier Comptes Rendus de Gradient One, et la ligne propagée dans `## Compte rendu` de la fiche entité.

## 6. Règles juridiques @legal

Règles validées par la revue juridique (@legal, sessions 4 et 9). Elles conditionnent la valeur probatoire du CR en cas de contrôle fiscal — leur respect n'est pas optionnel.

### 6.1 Cohérence des entités

Le signataire du CR (Thomas Issa) figure **toujours en tête** de la liste des participants. Son titre et sa société **correspondent à l'entité du CR**, jamais à ISSA Capital par défaut :

- Entité **IC** (ISSA Capital) → Thomas Issa, Président, ISSA Capital SAS
- Entité **GO** (Gradient One) → Thomas Issa, Associé, Gradient One
- Entité **VI** (Versi Immobilier) → Thomas Issa, Associé, Versi Immobilier
- Entité **VV** (Versi Invest) → Thomas Issa, Associé, Versi Invest

**Ne jamais mentionner ISSA Capital dans un CR qui concerne GO, VI ou VV.** ISSA Capital est la holding mère ; elle n'est pas partie prenante des réunions opérationnelles de ses filiales.

Même règle pour les autres participants : leur titre est relatif à l'entité du CR. Un CR Gradient One → « Carl Standertskjold-Nordenstam, Associé, Gradient One » (pas « Co-fondateur Gradient One / Versi »). Un CR Versi Immobilier → « Maxime Lemoine, Associé, Versi Immobilier ». Titre professionnel court : « Associé », « Co-fondateur », « Président ».

### 6.2 Registre lexical

**Temps verbal — passé composé** pour les actions et décisions : « Il a été décidé », « Les parties ont convenu », « Thomas Issa a exposé ». Interdit : passé simple (« Il fut décidé ») ; présent narratif pour une décision (« il décide » → « il a décidé »). Le présent narratif n'est admis que dans la Section 1, partie « lien avec l'intérêt social ».

**Désignation des personnes** : Thomas Issa → toujours « Thomas Issa, Président de [ENTITÉ] » ou « …, Associé de [ENTITÉ] » selon § 6.1. Jamais « Thomas » seul, jamais « M. Issa ». Autres participants : au premier mention « [Prénom] [Nom], [Titre] de [Société] » ; mentions suivantes « [Prénom] [Nom] ».

**Formalité** : registre juridique d'affaires français. Phrases courtes, sujet-verbe-complément, une subordonnée maximum par phrase.

### 6.3 Formules à utiliser (F1-F15)

Privilégier ces formules — elles ancrent le document dans le registre du droit des affaires français.

- **F1** — « Il a été convenu que » — décisions prises (Section 3)
- **F2** — « Il a été acté que » — décisions fermes, engagements (Section 3)
- **F3** — « Les parties ont arrêté les points suivants » — ouverture Section 2 (multi-interlocuteurs)
- **F4** — « En foi de quoi, le présent compte rendu a été établi » — clôture (ajoutée par le moteur)
- **F5** — « Conformément à l'intérêt social de [ENTITÉ] » — Section 1, lien avec l'objet social
- **F6** — « À la suite de cet échange, il a été décidé de » — conclusions Section 3
- **F7** — « La présente réunion avait pour objet » — ouverture Section 1
- **F8** — « Il a été exposé que » — restitution d'une information donnée
- **F9** — « Les échanges ont porté sur » — introduction Section 2 neutre
- **F10** — « Sous réserve de » / « Sous condition de » — décisions conditionnelles
- **F11** — « Il a été rappelé que » — contexte rappelé
- **F12** — « Les parties ont pris acte de » — information reçue sans décision
- **F13** — « Il appartient à [NOM/ENTITÉ] de » — attribution d'action (Section 4)
- **F14** — « La charge y afférente, d'un montant de [X] € TTC » — mention de dépense (Section 1)
- **F15** — « Le présent document a été établi et certifié exact par » — certification (ajoutée par le moteur)

### 6.4 Formules à bannir (B1-B12)

Ne jamais utiliser ces formules — elles fragilisent la valeur probatoire et signalent un rédactionnel informel à l'administration fiscale.

- **B1** — « globalement » → préciser les points abordés
- **B2** — « à peu près » / « environ » → montant exact, ou renvoi vers Tiime
- **B3** — « on a parlé de » → « La réunion a porté sur »
- **B4** — « il faudrait peut-être » → « Il a été décidé de procéder à »
- **B5** — « etc. » en fin de liste → lister exhaustivement, ou « les points précités »
- **B6** — « vu ensemble » → « Les participants ont examiné conjointement »
- **B7** — « c'est noté » → « Il a été pris note de »
- **B8** — qualificatifs émotionnels (« super réunion ») → supprimer
- **B9** — prénom seul pour Thomas → « Thomas Issa, Président de [ENTITÉ], a exposé »
- **B10** — « on verra » / « à voir » → « Ce point fera l'objet d'une décision ultérieure avant le [DATE] »
- **B11** — « en gros » → supprimer, reformuler précisément
- **B12** — conditionnel pour une décision prise → passé composé affirmatif

### 6.5 Entités et RBAC

**Priorité absolue** : si Thomas nomme explicitement l'entité (« CR pour ISSA Capital », « CR IC », « pour Versi Immobilier »…), c'est **cette entité** qui est retenue — jamais remplacée par une autre détectée dans le contenu.

La détection automatique ne s'applique **que** si l'entité n'est pas précisée :

- « Versimo », « Versi Immobilier », « Versi Invest » → VI ou VV selon le contexte (GO si réunion de conseil de la mère)
- « Gradient One », « Carl », « Maxime », « Emmanuel Gomez » → GO
- « ISSA Capital », « famille », « patrimoine » → IC

En cas d'ambiguïté → **demander** (clarification), jamais d'inférence silencieuse : le périmètre RBAC en dépend.

**Vérification RBAC** : si l'expéditeur de la demande est Carl ou Maxime, l'entité ne peut pas être IC. Si l'input mentionne IC dans ce cas, répondre par une demande de clarification : « Cette entité (ISSA Capital) n'est pas dans ton périmètre. Reformule en précisant Gradient One, Versi Immobilier ou Versi Invest. » Le moteur du bot renforce ce contrôle ; la skill filtre en première ligne.

### 6.6 Annexes photographiques

Si des photos sont jointes :

1. **Analyser chaque photo** et rédiger une légende descriptive professionnelle (1 phrase, factuelle) : « Vue de la façade principale du bien situé au 12 rue de Tournon, Paris 6e » — pas « Belle photo d'un immeuble ».
2. Intégrer les légendes dans `annexes_photographiques` du `CRDraft` (`[{numero, legende}]`). Champ optionnel — `null` si aucune photo.
3. Les photos sont en **annexe uniquement** — mais insérer des **renvois croisés** dans les sections 1 à 4 : « état général du bien — appartement de 85 m² (cf. Annexes photos 1 et 2) ». Sans renvoi croisé, l'annexe perd sa valeur probatoire.
4. Une donnée extraite d'une photo (adresse visible, état du bien) peut enrichir les sections — jamais de donnée approximative non sourcée. Toujours sourcer une superficie ou une estimation (« selon l'annonce Daniel Féau », « selon le diagnostic technique »).

## Contenu du bundle

- `SKILL.md` — ce fichier.
- `scripts/generate_cr_pdf.js` — moteur de rendu PDF (portage fidèle de `pdf-generator.ts`).

La signature manuscrite n'est pas dans le bundle : elle est lue depuis le vault à l'exécution (cf. § 3.0), à l'emplacement partagé `08. Outils/Skills/_assets/signature-thomas-issa.png`. Pour un bundle `.skill` totalement autonome, déposer le PNG dans un dossier `assets/` du bundle et pointer `SIGNATURE_PNG_PATH` dessus.

## Hors périmètre

- **Schéma Zod `CRDraft`** : défini côté code du bot (`src/lib/secretariat/cr-schema.ts`), pas ici.
- **Templates de rendu markdown final** : générés post-LLM côté moteur.
- **Suite de tests eval @qa** : reste côté repo Anya.

## Liens

- Workflow maître : `08. Outils/Anya/Skills/Workflow CR Reunion.md`
- Skill de référence (modèle d'usage) : `08. Outils/Skills/traite-inbox/`
- Conventions vault : `CLAUDE.md` (racine vault)
