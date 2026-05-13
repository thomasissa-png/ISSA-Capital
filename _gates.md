# Gates de contrôle qualité — Gradient Agents

> Ce fichier est référencé par CLAUDE.md. Chaque livrable dans `docs/` est évalué par ces gates.
> Classification : **BLOQUANT** (1 FAIL = NO-GO), **REQUIS** (1 FAIL = GO conditionnel), **CONDITIONNEL** (s'applique si feature/livrable amont existe).

## Processus

1. **Vérification rapide par l'orchestrateur** (après chaque phase) : gates BLOQUANT. Si 1+ FAIL -> relance corrective immédiate.
2. **Audit complet par @reviewer** (fin de run, Étape 7) : 32 gates via Grep/Read/comparaison. Boucle itération max 3 passes.

## Les 32 gates binaires (PASS/FAIL)

### COMPLÉTUDE

| # | Gate | Classe | Vérification |
|---|---|---|---|
| G1 | Toutes les sections du template agent présentes (0 section vide/TODO) | BLOQUANT | Grep `[TODO]`, `[A REMPLIR]`, sections < 2 lignes |
| G2 | Les livrables amont référencés existent | REQUIS | Glob les chemins cités dans le livrable |
| G3 | Bloc Handoff structuré présent | BLOQUANT | Grep `Handoff` |
| G4 | Chaque donnée chiffrée a une source explicite (URL, livrable, ou marqueur `[HYPOTHESE]`) | REQUIS | Grep nombres, vérifier que chaque chiffre cite sa source |

### COHÉRENCE

| # | Gate | Classe | Vérification |
|---|---|---|---|
| G5 | Persona identique à project-context.md | BLOQUANT | Grep nom persona dans le livrable. Le persona doit être cité par nom ET le livrable doit adresser ses frustrations/objections |
| G6 | KPI North Star identique | BLOQUANT | Grep KPI dans le livrable |
| G7 | 0 contradiction avec livrables amont | BLOQUANT | Read les 2-3 livrables amont référencés, extraire les décisions clés, comparer. Si une décision diverge -> FAIL |
| G8 | Ton cohérent avec brand-voice.md (si existe) | CONDITIONNEL | Grep registre (tu/vous), vocabulaire |

### ACTIONNABILITÉ

| # | Gate | Classe | Vérification |
|---|---|---|---|
| G9 | Chaque recommandation a un owner + action + cible | REQUIS | Grep `-> @` ou équivalent actionnable |
| G10 | 0 langage vague sans action ("envisager", "pourrait", "éventuellement") | REQUIS | Grep mots vagues |
| G11 | Critères de validation binaires (vérifiables oui/non) | REQUIS | Read section validation |
| G12 | Un agent pourrait implémenter sans poser de question | BLOQUANT | Pour chaque action : (a) verbe d'action, (b) objet clair, (c) inputs/outputs explicites, (d) critère de done vérifiable ? |

### MESSAGES

| # | Gate | Classe | Vérification |
|---|---|---|---|
| G13 | 0 donnée inventée (aucun chiffre sans fondement factuel) | BLOQUANT | Grep chiffres sans source — vérifier crédibilité |
| G14 | Livrables absents signalés | REQUIS | Grep chemins docs/ -> Glob existence. Si chemin référencé n'existe pas ET non documenté comme absent -> FAIL |
| G15 | 0 placeholder résiduel | BLOQUANT | Grep `[A REMPLIR`, `[PLACEHOLDER`, `[TODO`, `[NOM`, `[EXEMPLE`, `[XX`, `[VOTRE`, `[INSERER`, `[REMPLACER` |

### SPÉCIFICITÉ

| # | Gate | Classe | Vérification |
|---|---|---|---|
| G16 | Nom du projet cité >= 3 fois | REQUIS | Grep count |
| G17 | Persona cité par nom >= 2 fois | REQUIS | Grep count |
| G18 | >= 2 livrables amont référencés par chemin | REQUIS | Grep `docs/` |
| G19 | Pas copiable tel quel pour un projet concurrent | BLOQUANT | Test d'inversion : remplacer le nom du projet par un concurrent. Si > 50% du contenu reste applicable -> FAIL |
| G20 | >= 1 exemple concret spécifique au projet | REQUIS | Vérification sectorielle |

### QUALITÉ MÉTIER (conditionnelles selon type de livrable)

| # | Gate | Classe | Vérification |
|---|---|---|---|
| G21 | Les 5 états UI documentés par écran interactif (défaut, loading, vide, erreur, succès) | BLOQUANT | Grep `loading\|erreur\|vide\|empty\|error\|succès` par écran |
| G22 | Contrastes WCAG 2.2 AA (>= 4.5:1 texte, >= 3:1 interactifs) + focus-visible + touch targets >= 44x44px + prefers-reduced-motion | BLOQUANT | Vérifier chaque combinaison couleur. Clair ET dark mode si applicable |
| G23 | 0 valeur hardcodée — toute couleur, spacing, typo référence un token nommé | REQUIS | Grep couleurs hex en dur hors fichiers de tokens |
| G24 | Registre tu/vous uniforme (0 alternance non justifiée) | REQUIS | Grep `tu \|ton \|votre \|vous ` — vérifier cohérence |
| G25 | Chaque KPI/métrique a une formule de calcul explicite ET un seuil d'alerte | REQUIS | Grep `formule\|calcul\|seuil\|alerte` |

### PIPELINE & CONFORMITÉ (si src/ existe)

| # | Gate | Classe | Vérification |
|---|---|---|---|
| G26 | Conformité visuelle : screenshots CI vs baselines (< 0.5% diff) sur 3 devices | BLOQUANT | Playwright screenshots iPhone 13 (375px), iPad (768px), Desktop Chrome (1280px). Seuil < 0.5% pixels différents |
| G27 | Matrice de traçabilité : 100% des user stories ont un test correspondant | REQUIS | Tableau `US-XX -> fichier-test:ligne` dans TESTING.md |
| G28 | Pipeline pre-deploy PASS : tsc --noEmit + lint + tests | REQUIS | `tsc --noEmit` 0 erreur, ESLint 0 erreur, tests unitaires PASS |

### DESIGN & COMPOSITION (si frontend)

| # | Gate | Classe | Vérification |
|---|---|---|---|
| G29 | Chaque section de chaque page a un pattern de layout explicite | REQUIS | Vérifier `docs/design/page-compositions.md` ou `docs/ux/wireframes.md` |
| G30 | Chaque page client-facing a au moins 1 image spécifiée (type, sujet, source) | REQUIS | Un site sans images spécifiées = 6/10 max |
| G31 | Architecture tokens 3 tiers respectée (primitive -> semantic -> component) | REQUIS | Grep dans le code pour références directes à des tokens primitifs |
| G32 | Chaque composant interactif a ses 6 états documentés (default, hover, active, focus-visible, disabled, loading) | REQUIS | Grep les 6 états par composant interactif |

## Gates testeur-persona GP1-GP10 (si agents testeurs créés)

| # | Gate | Classe | Vérification |
|---|---|---|---|
| GP1 | Compréhension immédiate | BLOQUANT | "En 5 secondes, je comprends ce que ce site fait pour moi" |
| GP2 | Valeur perçue | BLOQUANT | "La valeur promise justifie le prix affiché" |
| GP3 | Crédibilité | BLOQUANT | "Ce site me donne confiance" |
| GP4 | Parcours fluide | BLOQUANT | "Je sais où cliquer à chaque étape" |
| GP5 | Pricing acceptable | REQUIS | "Le prix ne me fait pas fuir" |
| GP6 | Recommandation | REQUIS | "Je recommanderais à un collègue" |
| GP7 | Conviction | BLOQUANT | "Après avoir vu le site, je suis convaincu" |
| GP8 | Look & feel | REQUIS | "Le design correspond à mon secteur" |
| GP9 | Outputs utiles | BLOQUANT | "Les livrables générés me sont vraiment utiles" |
| GP10 | Fidélisation | REQUIS | "Je vois pourquoi je resterais abonné" |

## Gates testeur-client-du-persona GC1-GC10 (si agents testeurs-client créés)

| # | Gate | Classe | Vérification |
|---|---|---|---|
| GC1 | Professionnalisme | BLOQUANT | "Ce document fait professionnel — pas généré par IA" |
| GC2 | Pertinence | BLOQUANT | "Le contenu répond à mes attentes/critères" |
| GC3 | Confiance | BLOQUANT | "Ce document me donne confiance dans le prestataire" |
| GC4 | Action | BLOQUANT | "Après lecture, je suis enclin à contacter/signer" |
| GC5 | Complétude | REQUIS | "Il ne manque aucune information critique" |
| GC6 | Différenciation | REQUIS | "Ce livrable se distingue positivement" |
| GC7 | Ton et registre | REQUIS | "Le ton est adapté à mon contexte" |
| GC8 | Zéro erreur factuelle | BLOQUANT | "Aucune information fausse ou inventée" |
| GC9 | Copy convaincant | REQUIS | "Les arguments sont pertinents et hiérarchisés" |
| GC10 | Design/mise en page | REQUIS | "La présentation est soignée et structurée" |

## Conditions d'application GP/GC

- GP/GC s'appliquent uniquement si les agents testeur-persona et testeur-client-du-persona ont été créés (Phase 0b). Si non créés -> N/A.
- **Marketplace** : si double persona, créer un testeur par persona — toutes les gates doivent passer.
- **B2C direct** : gates GC = N/A si le persona n'a pas de client professionnel.

## Verdict

- **GO** : 100% gates BLOQUANT PASS + 100% gates REQUIS PASS
- **GO CONDITIONNEL** : 100% gates BLOQUANT PASS + >= 1 gate REQUIS FAIL (corriger dans la session)
- **NO-GO** : >= 1 gate BLOQUANT FAIL -> relance immédiate
- **Gates CONDITIONNEL** : s'appliquent uniquement si le livrable amont existe. Si applicable et FAIL -> traité comme REQUIS FAIL. Si non applicable -> N/A.

## Score numérique dérivé

Pour le tableau "Performance des agents" : `(gates PASS / gates applicables) x 10`. Indicateur de suivi, pas critère de décision.

## Scoring persona et B2B

Les grilles persona (/10, 9 dimensions, seuil 9/10) et B2B (/10, 7 dimensions, seuil 9/10 si applicable) sont conservées. Encadrées par gates pré-requis : G5 + G6 doivent être PASS avant évaluation.

**Pré-requis binaires persona** (PASS obligatoire) :
- Le persona est nommé dans le livrable (pas "l'utilisateur")
- Le vocabulaire du secteur est utilisé
- Les objections documentées dans personas.md sont adressées

**Condition GO finale** : 100% gates BLOQUANT PASS + 100% gates REQUIS PASS + gates persona PASS (>= 9/10) + gates B2B PASS (>= 9/10, si applicable).

**Règle (orchestrateur)** : si 1+ gate BLOQUANT FAIL -> relancer immédiatement l'agent.
**Règle (reviewer)** : en fin de run, exécuter les 32 gates. Boucle d'itération max 3 passes. Voir `orchestrator.md` Étape 7.
