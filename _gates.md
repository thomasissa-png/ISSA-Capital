# Gates de controle qualite — Gradient Agents

> Ce fichier est reference par CLAUDE.md. Chaque livrable dans `docs/` est evalue par ces gates.
> Classification : **BLOQUANT** (1 FAIL = NO-GO), **REQUIS** (1 FAIL = GO conditionnel), **CONDITIONNEL** (s'applique si feature/livrable amont existe).

## Processus

1. **Verification rapide par l'orchestrateur** (apres chaque phase) : gates BLOQUANT. Si 1+ FAIL -> relance corrective immediate.
2. **Audit complet par @reviewer** (fin de run, Etape 7) : 32 gates via Grep/Read/comparaison. Boucle iteration max 3 passes.

## Les 32 gates binaires (PASS/FAIL)

### COMPLETUDE

| # | Gate | Classe | Verification |
|---|---|---|---|
| G1 | Toutes les sections du template agent presentes (0 section vide/TODO) | BLOQUANT | Grep `[TODO]`, `[A REMPLIR]`, sections < 2 lignes |
| G2 | Les livrables amont references existent | REQUIS | Glob les chemins cites dans le livrable |
| G3 | Bloc Handoff structure present | BLOQUANT | Grep `Handoff` |
| G4 | Chaque donnee chiffree a une source explicite (URL, livrable, ou marqueur `[HYPOTHESE]`) | REQUIS | Grep nombres, verifier que chaque chiffre cite sa source |

### COHERENCE

| # | Gate | Classe | Verification |
|---|---|---|---|
| G5 | Persona identique a project-context.md | BLOQUANT | Grep nom persona dans le livrable. Le persona doit etre cite par nom ET le livrable doit adresser ses frustrations/objections |
| G6 | KPI North Star identique | BLOQUANT | Grep KPI dans le livrable |
| G7 | 0 contradiction avec livrables amont | BLOQUANT | Read les 2-3 livrables amont references, extraire les decisions cles, comparer. Si une decision diverge -> FAIL |
| G8 | Ton coherent avec brand-voice.md (si existe) | CONDITIONNEL | Grep registre (tu/vous), vocabulaire |

### ACTIONNABILITE

| # | Gate | Classe | Verification |
|---|---|---|---|
| G9 | Chaque recommandation a un owner + action + cible | REQUIS | Grep `-> @` ou equivalent actionnable |
| G10 | 0 langage vague sans action ("envisager", "pourrait", "eventuellement") | REQUIS | Grep mots vagues |
| G11 | Criteres de validation binaires (verifiables oui/non) | REQUIS | Read section validation |
| G12 | Un agent pourrait implementer sans poser de question | BLOQUANT | Pour chaque action : (a) verbe d'action, (b) objet clair, (c) inputs/outputs explicites, (d) critere de done verifiable ? |

### MESSAGES

| # | Gate | Classe | Verification |
|---|---|---|---|
| G13 | 0 donnee inventee (aucun chiffre sans fondement factuel) | BLOQUANT | Grep chiffres sans source — verifier credibilite |
| G14 | Livrables absents signales | REQUIS | Grep chemins docs/ -> Glob existence. Si chemin reference n'existe pas ET non documente comme absent -> FAIL |
| G15 | 0 placeholder residuel | BLOQUANT | Grep `[A REMPLIR`, `[PLACEHOLDER`, `[TODO`, `[NOM`, `[EXEMPLE`, `[XX`, `[VOTRE`, `[INSERER`, `[REMPLACER` |

### SPECIFICITE

| # | Gate | Classe | Verification |
|---|---|---|---|
| G16 | Nom du projet cite >= 3 fois | REQUIS | Grep count |
| G17 | Persona cite par nom >= 2 fois | REQUIS | Grep count |
| G18 | >= 2 livrables amont references par chemin | REQUIS | Grep `docs/` |
| G19 | Pas copiable tel quel pour un projet concurrent | BLOQUANT | Test d'inversion : remplacer le nom du projet par un concurrent. Si > 50% du contenu reste applicable -> FAIL |
| G20 | >= 1 exemple concret specifique au projet | REQUIS | Verification sectorielle |

### QUALITE METIER (conditionnelles selon type de livrable)

| # | Gate | Classe | Verification |
|---|---|---|---|
| G21 | Les 5 etats UI documentes par ecran interactif (defaut, loading, vide, erreur, succes) | BLOQUANT | Grep `loading\|erreur\|vide\|empty\|error\|succes` par ecran |
| G22 | Contrastes WCAG 2.2 AA (>= 4.5:1 texte, >= 3:1 interactifs) + focus-visible + touch targets >= 44x44px + prefers-reduced-motion | BLOQUANT | Verifier chaque combinaison couleur. Clair ET dark mode si applicable |
| G23 | 0 valeur hardcodee — toute couleur, spacing, typo reference un token nomme | REQUIS | Grep couleurs hex en dur hors fichiers de tokens |
| G24 | Registre tu/vous uniforme (0 alternance non justifiee) | REQUIS | Grep `tu \|ton \|votre \|vous ` — verifier coherence |
| G25 | Chaque KPI/metrique a une formule de calcul explicite ET un seuil d'alerte | REQUIS | Grep `formule\|calcul\|seuil\|alerte` |

### PIPELINE & CONFORMITE (si src/ existe)

| # | Gate | Classe | Verification |
|---|---|---|---|
| G26 | Conformite visuelle : screenshots CI vs baselines (< 0.5% diff) sur 3 devices | BLOQUANT | Playwright screenshots iPhone 13 (375px), iPad (768px), Desktop Chrome (1280px). Seuil < 0.5% pixels differents |
| G27 | Matrice de tracabilite : 100% des user stories ont un test correspondant | REQUIS | Tableau `US-XX -> fichier-test:ligne` dans TESTING.md |
| G28 | Pipeline pre-deploy PASS : tsc --noEmit + lint + tests | REQUIS | `tsc --noEmit` 0 erreur, ESLint 0 erreur, tests unitaires PASS |

### DESIGN & COMPOSITION (si frontend)

| # | Gate | Classe | Verification |
|---|---|---|---|
| G29 | Chaque section de chaque page a un pattern de layout explicite | REQUIS | Verifier `docs/design/page-compositions.md` ou `docs/ux/wireframes.md` |
| G30 | Chaque page client-facing a au moins 1 image specifiee (type, sujet, source) | REQUIS | Un site sans images specifiees = 6/10 max |
| G31 | Architecture tokens 3 tiers respectee (primitive -> semantic -> component) | REQUIS | Grep dans le code pour references directes a des tokens primitifs |
| G32 | Chaque composant interactif a ses 6 etats documentes (default, hover, active, focus-visible, disabled, loading) | REQUIS | Grep les 6 etats par composant interactif |

## Gates testeur-persona GP1-GP10 (si agents testeurs crees)

| # | Gate | Classe | Verification |
|---|---|---|---|
| GP1 | Comprehension immediate | BLOQUANT | "En 5 secondes, je comprends ce que ce site fait pour moi" |
| GP2 | Valeur percue | BLOQUANT | "La valeur promise justifie le prix affiche" |
| GP3 | Credibilite | BLOQUANT | "Ce site me donne confiance" |
| GP4 | Parcours fluide | BLOQUANT | "Je sais ou cliquer a chaque etape" |
| GP5 | Pricing acceptable | REQUIS | "Le prix ne me fait pas fuir" |
| GP6 | Recommandation | REQUIS | "Je recommanderais a un collegue" |
| GP7 | Conviction | BLOQUANT | "Apres avoir vu le site, je suis convaincu" |
| GP8 | Look & feel | REQUIS | "Le design correspond a mon secteur" |
| GP9 | Outputs utiles | BLOQUANT | "Les livrables generes me sont vraiment utiles" |
| GP10 | Fidelisation | REQUIS | "Je vois pourquoi je resterais abonne" |

## Gates testeur-client-du-persona GC1-GC10 (si agents testeurs-client crees)

| # | Gate | Classe | Verification |
|---|---|---|---|
| GC1 | Professionnalisme | BLOQUANT | "Ce document fait professionnel — pas genere par IA" |
| GC2 | Pertinence | BLOQUANT | "Le contenu repond a mes attentes/criteres" |
| GC3 | Confiance | BLOQUANT | "Ce document me donne confiance dans le prestataire" |
| GC4 | Action | BLOQUANT | "Apres lecture, je suis enclin a contacter/signer" |
| GC5 | Completude | REQUIS | "Il ne manque aucune information critique" |
| GC6 | Differenciation | REQUIS | "Ce livrable se distingue positivement" |
| GC7 | Ton et registre | REQUIS | "Le ton est adapte a mon contexte" |
| GC8 | Zero erreur factuelle | BLOQUANT | "Aucune information fausse ou inventee" |
| GC9 | Copy convaincant | REQUIS | "Les arguments sont pertinents et hierarchises" |
| GC10 | Design/mise en page | REQUIS | "La presentation est soignee et structuree" |

## Conditions d'application GP/GC

- GP/GC s'appliquent uniquement si les agents testeur-persona et testeur-client-du-persona ont ete crees (Phase 0b). Si non crees -> N/A.
- **Marketplace** : si double persona, creer un testeur par persona — toutes les gates doivent passer.
- **B2C direct** : gates GC = N/A si le persona n'a pas de client professionnel.

## Verdict

- **GO** : 100% gates BLOQUANT PASS + 100% gates REQUIS PASS
- **GO CONDITIONNEL** : 100% gates BLOQUANT PASS + >= 1 gate REQUIS FAIL (corriger dans la session)
- **NO-GO** : >= 1 gate BLOQUANT FAIL -> relance immediate
- **Gates CONDITIONNEL** : s'appliquent uniquement si le livrable amont existe. Si applicable et FAIL -> traite comme REQUIS FAIL. Si non applicable -> N/A.

## Score numerique derive

Pour le tableau "Performance des agents" : `(gates PASS / gates applicables) x 10`. Indicateur de suivi, pas critere de decision.

## Scoring persona et B2B

Les grilles persona (/10, 9 dimensions, seuil 9/10) et B2B (/10, 7 dimensions, seuil 9/10 si applicable) sont conservees. Encadrees par gates pre-requis : G5 + G6 doivent etre PASS avant evaluation.

**Pre-requis binaires persona** (PASS obligatoire) :
- Le persona est nomme dans le livrable (pas "l'utilisateur")
- Le vocabulaire du secteur est utilise
- Les objections documentees dans personas.md sont adressees

**Condition GO finale** : 100% gates BLOQUANT PASS + 100% gates REQUIS PASS + gates persona PASS (>= 9/10) + gates B2B PASS (>= 9/10, si applicable).

**Regle (orchestrateur)** : si 1+ gate BLOQUANT FAIL -> relancer immediatement l'agent.
**Regle (reviewer)** : en fin de run, executer les 32 gates. Boucle d'iteration max 3 passes. Voir `orchestrator.md` Etape 7.
