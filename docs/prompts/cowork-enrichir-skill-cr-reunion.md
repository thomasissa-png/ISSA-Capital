# Prompt Claude Cowork — Enrichir SKILL.md cr-reunion vault

> À copier-coller dans une conversation avec Claude Cowork (qui a accès au vault Drive).
> Date : 2026-05-22 · Origine : S21 audit @reviewer/@ia/@qa sur Anya bot Telegram.

---

## CONTEXTE DE LA MISSION

Tu vas enrichir le fichier vault `00. Me/08. Outils/Skills/cr-reunion/SKILL.md` pour qu'il contienne TOUTES les règles juridiques validées @legal session 4 et session 9. Ces règles ont été perdues lors de la migration S21 du legacy `secretariat-system-prompt.md` (708L côté repo Anya) vers le format SKILL.md vault (110L actuels). Le bot Anya consomme désormais ce SKILL.md comme **source de vérité unique** — donc tout ce qui manque dans le SKILL.md est perdu en production.

Sans cet enrichissement, les CR générés par Anya perdent ~80% de leur valeur probatoire : pas de cohérence entité (Thomas étiqueté "Président IC" même dans un CR Gradient One), pas de registre passé composé imposé, pas de formules @legal F1-F15, formules bannies B1-B12 non filtrées, RBAC LLM perdu.

**Objectif** : SKILL.md vault enrichi à environ 300-400 lignes, contenant l'intégralité du contrat fonctionnel du legacy, dans le format Anthropic Skills (frontmatter `name` + `description`, puis sections markdown standard).

---

## INSTRUCTIONS TECHNIQUES

### Fichier cible

- **Path vault** : `00. Me/08. Outils/Skills/cr-reunion/SKILL.md`
- **fileId Drive** : `1mu56AQVD78itGTu1uXm-1bSGRgcCdJZ0` (à confirmer via `search_files` si nécessaire)

### Méthode d'édition (R5 obligatoire)

**PATCH in-place via `_zap_raw_request`** :
```
endpoint = /upload/drive/v3/files/{fileId}?uploadType=media
method = PATCH
body = <contenu markdown complet réécrit>
```

**Jamais create+delete** (casse le fileId, casse les wikilinks Obsidian, casse les partages).

### Procédure

1. Lis le SKILL.md vault actuel via MCP Drive `read_file_content`.
2. Identifie les sections existantes (1. Trigger, 2. Input, 3. Étapes, 4. Output, 5. Méthode, 5.1 Red lines, 5.2 Arbre de décision, etc.).
3. **Préserve l'existant** — n'écrase pas le contenu déjà rédigé par Thomas, ajoute les sections manquantes.
4. **Préserve le frontmatter** Anthropic Skills (`name: cr-reunion` + `description: "..."`).
5. Insère les 7 sections additionnelles ci-dessous, dans la bonne place (cf. mapping § "Où insérer quoi").
6. PATCH le fichier complet (envoyer le markdown entier via `body`, pas `data` — bug Zapier connu, le param doit être `body`).
7. **TESTE-TOI EN LISANT À NOUVEAU** le fichier après PATCH : vérifie que ton contenu y est bien.

---

## CONTENU À AJOUTER (à incorporer dans le SKILL.md vault)

Voici les 7 règles juridiques à intégrer. Tu peux les reformater pour qu'elles s'intègrent dans la structure narrative du SKILL.md existant, mais **la substance doit être préservée verbatim** (formules F1-F15 et bannies B1-B12 surtout — ce sont des chaînes exactes utilisées par @legal).

### REGLE 0 — Cohérence des entités dans les participants (audit @legal session 9)

> À insérer dans une nouvelle section, ex : `## 6. Règles juridiques @legal` → `### 6.1 Cohérence entité`.

Le signataire du CR DOIT TOUJOURS figurer EN TÊTE de la liste des participants. IMPORTANT : son titre et sa société DOIVENT correspondre à l'ENTITÉ DU CR, pas à ISSA Capital systématiquement.

Règle de cohérence entité :
- Si entité = IC (ISSA Capital) → Thomas Issa, Président, ISSA Capital SAS
- Si entité = GO (Gradient One) → Thomas Issa, Associé, Gradient One
- Si entité = VI (Versi Immobilier) → Thomas Issa, Associé, Versi Immobilier
- Si entité = VV (Versi Invest) → Thomas Issa, Associé, Versi Invest

NE JAMAIS mentionner ISSA Capital dans un CR qui concerne Gradient One, Versi Immobilier ou Versi Invest. ISSA Capital est la holding mère — elle n'est pas partie prenante des réunions opérationnelles de ses filiales.

De même pour Carl et Maxime : leurs titres sont relatifs à l'entité du CR.
- CR Gradient One → Carl Standertskjold-Nordenstam, Associé, Gradient One (pas "Co-fondateur Gradient One / Versi")
- CR Versi Immobilier → Maxime Lemoine, Associé, Versi Immobilier

Utiliser un titre professionnel court : "Associé", "Co-fondateur", "Président".

### REGLE 4 — Registre lexical (cf @legal Bloc 2)

> À insérer dans `### 6.2 Registre lexical`.

**Temps verbal principal : passé composé**

Tu rédiges au passé composé pour les actions et décisions. Exemples corrects :
- "Il a été décidé"
- "Les parties ont convenu"
- "Thomas Issa a exposé"

INTERDIT : passé simple ("Il fut décidé"). INTERDIT : présent narratif pour les décisions ("il décide" — utiliser "il a décidé").

Le présent narratif est autorisé UNIQUEMENT pour la Section 1, partie "lien avec l'intérêt social" : "Cette réunion s'inscrit dans le cadre de la stratégie d'acquisition d'ISSA Capital."

**Désignation des personnes**

Pour Thomas Issa, tu utilises TOUJOURS "Thomas Issa, Président de [ENTITÉ]" ou "Thomas Issa, Associé de [ENTITÉ]" selon REGLE 0. JAMAIS "Thomas" seul. JAMAIS "M. Issa" — formalisme excessif inadapté au registre PME-holding.

Pour les autres participants au premier mention : "[Prénom] [Nom], [Titre] de [Société]". Mentions ultérieures : "[Prénom] [Nom]".

**Niveau de formalité**

Registre juridique d'affaires français. Phrases courtes, Sujet-Verbe-Complément. Max 1 subordonnée par phrase.

### REGLE 5 — 15 formules à utiliser (F1-F15)

> À insérer dans `### 6.3 Formules à utiliser`.

Tu privilégies ces formules. Elles ancrent le document dans le registre du droit des affaires français.

- F1 — "Il a été convenu que" — pour les décisions prises (Section 3)
- F2 — "Il a été acté que" — pour les décisions fermes, engagements (Section 3)
- F3 — "Les parties ont arrêté les points suivants" — pour ouvrir Section 2 (multi-interlocuteurs)
- F4 — "En foi de quoi, le présent compte rendu a été établi" — formule de clôture (backend l'ajoute)
- F5 — "Conformément à l'intérêt social de [ENTITÉ]" — Section 1, lien objet social
- F6 — "À la suite de cet échange, il a été décidé de" — conclusions Section 3
- F7 — "La présente réunion avait pour objet" — ouverture Section 1
- F8 — "Il a été exposé que" — restitution d'information donnée
- F9 — "Les échanges ont porté sur" — introduction Section 2 neutre
- F10 — "Sous réserve de" / "Sous condition de" — décisions conditionnelles
- F11 — "Il a été rappelé que" — contexte rappelé
- F12 — "Les parties ont pris acte de" — information reçue sans décision
- F13 — "Il appartient à [NOM/ENTITÉ] de" — attribution d'action Section 4
- F14 — "La charge y afférente, d'un montant de [X] € TTC" — mention dépense Section 1
- F15 — "Le présent document a été établi et certifié exact par" — formule de certification (backend l'ajoute)

### REGLE 6 — 12 formules à bannir (B1-B12)

> À insérer dans `### 6.4 Formules à bannir`.

Tu N'UTILISES JAMAIS ces formules. Elles fragilisent la valeur probatoire et signalent un rédactionnel informel à l'administration fiscale.

- B1 — "globalement" → préciser les points abordés
- B2 — "à peu près" / "environ" → montant exact ou [À COMPLÉTER]
- B3 — "on a parlé de" → "La réunion a porté sur"
- B4 — "il faudrait peut-être" → "Il a été décidé de procéder à"
- B5 — "etc." en fin de liste → lister exhaustivement ou "les points précités"
- B6 — "vu ensemble" → "Les participants ont examiné conjointement"
- B7 — "c'est noté" → "Il a été pris note de"
- B8 — qualificatifs émotionnels ("super réunion") → supprimer
- B9 — prénom seul pour Thomas → "Thomas Issa, Président de [ENTITÉ], a exposé"
- B10 — "on verra" / "à voir" → "Ce point fera l'objet d'une décision ultérieure avant le [DATE]"
- B11 — "en gros" → supprimer, reformuler précisément
- B12 — conditionnel pour une décision prise → passé composé affirmatif

### REGLE 8 — Entités et détection RBAC

> À insérer dans `### 6.5 Entités et RBAC`.

**PRIORITÉ ABSOLUE** : si l'utilisateur dit explicitement "CR pour ISSA Capital", "Compte rendu pour Gradient One", "CR IC", "pour Versi Immobilier", ou toute formulation qui nomme l'entité en début de message, C'EST CETTE ENTITÉ QUI EST RETENUE. Tu ne la remplaces JAMAIS par une autre entité détectée dans le contenu.

La détection automatique ci-dessous ne s'applique QUE si l'utilisateur ne précise PAS l'entité :
- "Versimo", "Versi Immobilier", "Versi Invest" → VI ou VV (selon contexte) ou GO si réunion conseil mère
- "Gradient One", "Carl", "Maxime", "Emmanuel Gomez" → GO
- "ISSA Capital", "famille", "patrimoine" → IC

Si ambigu, tu DEMANDES (needs_clarification) — JAMAIS d'inférence silencieuse, le RBAC dépend de cette information.

**Vérification RBAC** : si l'utilisateur expéditeur est Carl ou Maxime, l'entité ne peut PAS être IC. Si l'input mentionne IC, tu réponds avec needs_clarification : "Cette entité (ISSA Capital) n'est pas dans ton périmètre. Reformule en précisant Gradient One, Versi Immobilier, ou Versi Invest." Le backend renforce cette vérification, mais tu participes au filtrage en première ligne.

### REGLE 13 — Photos et annexes photographiques

> À insérer dans `### 6.6 Annexes photographiques`.

Si l'utilisateur joint des photos à son message :
1. ANALYSE chaque photo et génère une légende descriptive professionnelle (1 phrase).
2. Légendes factuelles et professionnelles : "Vue de la façade principale du bien situé au 12 rue de Tournon, Paris 6e" — pas "Belle photo d'un immeuble".
3. INTÈGRE les légendes dans `annexes_photographiques: [{numero: 1, legende: "..."}]` (JSON output).
4. Champ OPTIONNEL — null si aucune photo.
5. Photos en ANNEXE uniquement — mais tu DOIS insérer des **RENVOIS CROISÉS** dans les sections 1-4 : "état général du bien — appartement de 85 m² (cf. Annexes photos 1 et 2)". Sans renvoi croisé, l'annexe perd sa valeur probatoire.
6. Si une photo montre un lieu (restaurant, bien), tu peux en extraire des informations (adresse visible, état) pour enrichir les sections.
7. N'utilise JAMAIS "superficie estimée" ou donnée approximative sans sourcer ("selon annonce Daniel Féau", "selon diagnostic technique").

### Section 1 — Phrase-type validée @legal + Art. 39-1 CGI

> À insérer ou enrichir dans `## 3. Étapes` → `### 3.X Rédaction Section 1` ou similaire.

La Section 1 du CR justifie la dépense au regard de l'Art. 39-1 du CGI. Elle DOIT contenir :
- L'objet précis de la réunion (pas "réunion de travail")
- Le lien explicite avec l'intérêt social de l'entité concernée
- La mention "conformément à l'Art. 39-1 du CGI"
- Le montant TTC de la dépense
- Si type = dejeuner ou diner : une JUSTIFICATION DU FORMAT REPAS en 1 phrase. Exemples acceptables : "Le déjeuner a permis de tenir cette réunion de travail dans la continuité de la visite technique" / "Ce format a été retenu compte tenu du déplacement des participants depuis Paris". **NE JAMAIS omettre cette justification — c'est le point le plus ciblé en contrôle fiscal.**
- Si la réunion comprend une visite (immobilière, technique) en plus du repas : mentionner la visite comme événement distinct avec son horaire approximatif.
- Le nom de l'établissement si applicable.

**Phrase-type validée par @legal** :
> "La présente réunion, tenue le [DATE] à [LIEU], avait pour objet [OBJET PRÉCIS]. Elle s'inscrit dans le cadre des activités de [ENTITÉ] et répond à l'intérêt social de celle-ci au sens de l'Art. 39-1 du CGI. La dépense y afférente s'est élevée à [MONTANT] € TTC (facture [NOM_ÉTABLISSEMENT] n° [NUMÉRO] du [DATE_FACTURE], acquittée par [MOYEN_PAIEMENT])."

IMPORTANT (audit @legal session 9) : la mention "voir facture en annexe" est INSUFFISANTE pour un contrôle approfondi. Tu DOIS référencer la facture. Si Thomas ne fournit pas le numéro/date/moyen, utilise :
> "La dépense y afférente s'est élevée à [MONTANT] € TTC (justificatif disponible dans l'application de facturation Tiime, rattaché à l'entité [ENTITÉ])."

**Ne mets JAMAIS de placeholder `[À COMPLÉTER]` dans un CR — c'est interdit.** Soit tu as l'information, soit tu renvoies vers Tiime.

### Section 4 — Attribution responsabilités (session 9)

> À insérer dans `## 3. Étapes` → `### 3.X Section 4 Suites à donner`.

- Sujets **IMMOBILIERS** (visite de bien, chantier, plans architecte, pré-commercialisation, acquisition) → Responsable par défaut : **Maxime Lemoine, Co-fondateur**. PAS Carl.
- Sujets **ADMINISTRATIFS / FINANCIERS** (pacte d'associés, juridique, comptabilité, facturation, argent) → Responsable par défaut : **Thomas Issa, Président**.
- Sujets **TECHNIQUES / OPÉRATIONNELS** spécifiques à Gradient One → attribuer selon le contexte.

Ces règles s'appliquent SAUF si Thomas attribue explicitement l'action à quelqu'un d'autre dans son message.

---

## NOTE — Database contacts (REGLE 2 legacy)

L'ancien placeholder `[INJECTION_DATABASE_CONTACTS_ICI]` du legacy ne doit **PAS être réintroduit** dans le SKILL.md. La lecture des contacts récurrents se fait désormais **live depuis le vault** côté code Anya (le bot lit `07. Contacts/` au runtime via Drive API, S21.4). Tu n'as donc rien à faire pour les contacts — ils seront injectés dynamiquement avant chaque appel LLM, à partir des fiches `.md` du vault.

Tu peux mentionner dans le SKILL.md : "Les contacts récurrents sont lus dynamiquement depuis `07. Contacts/` au runtime."

---

## OÙ INSÉRER QUOI (mapping recommandé)

```
SKILL.md actuel (vault)         →  Section enrichie
═══════════════════════════════════════════════════════════════════
1. Trigger                       →  inchangé
2. Input                         →  inchangé (+ note contacts lus live)
3. Étapes
  3.1 Identifier                 →  inchangé
  3.2 ...                        →  enrichir avec Section 1 phrase-type + Art. 39-1
  3.X (nouvelle)                 →  REGLE Section 4 attribution
4. Output                        →  ajouter mention `annexes_photographiques` JSON
5. Méthode
  5.1 Red lines                  →  inchangé (déjà court)
  5.2 Arbre décision             →  inchangé
  5.3 Critères qualité           →  inchangé
6. Règles juridiques @legal      →  NOUVELLE SECTION COMPLÈTE
  6.1 Cohérence entité           →  REGLE 0
  6.2 Registre lexical           →  REGLE 4
  6.3 Formules à utiliser        →  REGLE 5 (F1-F15)
  6.4 Formules à bannir          →  REGLE 6 (B1-B12)
  6.5 Entités et RBAC            →  REGLE 8
  6.6 Annexes photographiques    →  REGLE 13
```

---

## VALIDATION POST-ÉDITION

1. Lis à nouveau le SKILL.md vault après PATCH pour vérifier que ton contenu y est bien (R6 : ne jamais conclure "ça marche" après 1 test technique côté Drive — vérifier visuellement Obsidian si Thomas le confirme).
2. Vérifie que le frontmatter `name: cr-reunion` + `description: "..."` est toujours présent et valide YAML.
3. Vérifie que la longueur finale est ~300-400 lignes (ni trop court = règles manquantes, ni trop long = on a importé trop de detail technique).
4. Pas de wikilinks `[[]]` cassés vers d'autres fiches vault.
5. Demande à Thomas de valider visuellement dans Obsidian avant de considérer la mission terminée.

---

## OUT OF SCOPE

- **Schéma Zod CRDraft** : il est défini côté code repo (`src/lib/secretariat/cr-schema.ts`), pas dans le SKILL.md. N'essaie pas de l'ajouter.
- **Templates de rendu markdown final** : générés post-LLM côté backend, pas instruits au LLM.
- **5 test cases obligatoires** (legacy section 5) : ils restent côté repo, c'est une suite eval pour @qa, pas dans le SKILL.md.
- **Autres SKILL.md** : tu te concentres uniquement sur `cr-reunion`. Les 6 autres skills sont déjà à jour.

---

## DEMANDE FINALE

Lis le SKILL.md vault cr-reunion, propose-moi ta version enrichie en preview AVANT le PATCH, puis attends mon GO. Une fois validé, PATCH puis re-lis le fichier pour confirmer.

Si tu détectes un conflit (ex : Thomas a déjà ajouté une section que je te demande d'ajouter), signale-le et propose la fusion plutôt que d'écraser.
