# Protocole standard des agents Gradient

Ce fichier est la **référence unique** des sections communes à tous les agents. Il n'est PAS un agent — il n'a pas de frontmatter YAML. Il sert de documentation pour :
- **@agent-factory** : le template canonique de l'Étape 3 référence ce fichier
- **Maintenance** : modifier une règle commune ici, pas dans 19 fichiers

Les règles ci-dessous sont AUSSI présentes dans `CLAUDE.md` (qui est toujours chargé en contexte). Les agents n'ont donc PAS besoin de les dupliquer — ils héritent automatiquement des règles via CLAUDE.md. Chaque agent ne contient que ses **spécificités**.

---

## Protocole d'entrée obligatoire (standard)

```
1. Lire `project-context.md` à la racine
2. Si absent → STOP. Afficher : "project-context.md manquant. Remplis le template dans templates/ avant que je puisse travailler."
3. Lire le tableau "Historique des interventions agents" — comprendre les décisions déjà prises. Ne jamais contredire sans signaler
4. Lire `docs/lessons-learned.md` si existant — intégrer les leçons des projets précédents (patterns qui marchent, erreurs à éviter). **Attention particulière** aux learnings avec statut propagation = `non-propagé` qui concernent cet agent : si un learning non-propagé impacte le domaine de l'agent, le signaler dans le handoff et l'intégrer dans le livrable
5. Vérifier que les champs critiques pour cet agent sont remplis
6. Si champs critiques vides → lister les champs manquants, refuser d'avancer
```

**Partie variable** : la liste des champs critiques est spécifique à chaque agent.

---

## Adaptation au profil utilisateur (standard)

Après la lecture de project-context.md, chaque agent DOIT :

1. **Lire les "Notes libres / contexte supplémentaire"** de project-context.md — elles contiennent souvent le contexte humain (contraintes de temps, budget personnel, niveau technique, stade de vie entrepreneuriale, préférences, contexte émotionnel du projet)
2. **Évaluer le niveau technique** de l'utilisateur à partir du vocabulaire utilisé, de la stack choisie, et des Notes libres :
   - **Non-technique** : adapter le vocabulaire (dire "ta page d'accueil" plutôt que "le composant Hero"), expliquer le pourquoi de chaque recommandation en langage courant, éviter les acronymes sans définition
   - **Technique** : donner les détails d'implémentation, les trade-offs, les alternatives techniques considérées
   - **Expert** : aller droit aux décisions, justifier par les contraintes techniques, pas besoin de vulgariser
3. **Comprendre les enjeux personnels** : le projet n'est pas qu'un ensemble de specs — il y a une personne derrière avec des contraintes, des ambitions, et des peurs. Adapter le ton et les priorités en conséquence
4. **Évaluer les contraintes réelles** (mindset IA) : en mode équipe 100% IA (pas d'équipe humaine dans project-context.md), les seules contraintes pertinentes sont : budget financier réel (APIs, hébergement, services payants) et dépendances externes humaines (signatures, validations légales, accès tiers). Le temps de développement, les compétences internes et la "complexité" ne sont PAS des contraintes — l'IA les gère. Ne JAMAIS réduire le scope, choisir une techno inférieure, ou différer une tâche parce que "c'est plus rapide/simple". En mode équipe hybride (humains + IA) : adapter aux contraintes humaines réelles

**Partie variable** : chaque agent peut ajouter des critères d'adaptation spécifiques à son domaine.

---

## Gestion des livrables amont absents (standard)

Si un livrable amont référencé dans la calibration n'existe pas :

1. **Signaler** le livrable manquant et l'agent qui devrait le produire
2. **Ne pas bloquer** (sauf si le livrable est indispensable — ex : brand-platform.md pour @design)
3. **Travailler avec project-context.md** comme source de substitution et documenter les décisions prises sans le livrable amont comme provisoires : `[PROVISOIRE — à valider quand [livrable] sera disponible]`
4. **Recommander** l'invocation de l'agent manquant pour la suite

**Partie variable** : chaque agent définit quels livrables amont sont bloquants vs optionnels.

---

## Calibration par les meilleures références marché (standard)

Quand un agent produit un livrable destiné à l'utilisateur final ou aux clients du persona (landing page, annonce, mémoire technique, email, rapport, document généré par la plateforme), il DOIT :

1. **Avant de produire** : lire `docs/strategy/competitive-benchmark.md` s'il existe. Identifier les standards de qualité du secteur (format, longueur, structure, niveau de détail, ton)
2. **WebSearch de référence** : rechercher 2-3 exemples réels du type de livrable à produire dans le secteur du projet (ex: "meilleur mémoire technique appel d'offres BTP", "annonce immobilière premium exemple", "landing page SaaS conversion élevée"). Analyser ce qui fait leur qualité : structure, arguments, preuves, mise en page, CTA
3. **Objectif : battre la référence marché, pas juste produire un livrable correct.** Le livrable généré doit être au niveau des meilleurs du secteur, pas au niveau moyen. Le testeur-client-du-persona (gates GC1-GC10) évaluera si le livrable "se distingue positivement de ce que je reçois habituellement" (GC6)
4. **Documenter la référence** dans le handoff : "Références marché consultées : [URLs]. Standard identifié : [ce qui fait la qualité dans ce secteur]."

**Condition d'application** : cette règle s'applique quand l'agent produit un output visible par un tiers (client, prospect, partenaire, acheteur public). Elle ne s'applique PAS aux livrables internes (specs, audits, stratégies).

**Partie variable** : chaque agent peut préciser les types de références pertinents pour son domaine.

---

## Gestion des timeouts (standard)

Claude Code a une limite de temps par réponse. Un agent qui essaie de tout produire en une seule passe **sera coupé en plein travail** et le livrable sera perdu.

### Règles strictes

1. **Un fichier = un appel Write/Edit.** Ne jamais écrire plusieurs fichiers d'un coup
2. **Ne jamais dépasser ~150 lignes par Write.** Si plus long, utiliser Write pour la structure puis Edit pour compléter
3. **Prioriser le contenu critique.** Écrire les sections essentielles d'abord
4. **Sauvegarder au fur et à mesure.** Ne jamais accumuler du contenu en mémoire sans l'écrire sur disque
5. **Si la mission demande plus de 3 fichiers** : annoncer l'ordre de production et produire un fichier à la fois
6. **Si interrompu par un timeout** : utiliser Glob + Read pour identifier les fichiers déjà sauvegardés. Reprendre là où le travail s'est arrêté via Edit sur les fichiers existants. Ne JAMAIS repartir de zéro.
7. **Pour les livrables longs (>100 lignes attendues)** : écrire d'abord la structure du fichier (titres + résumé de chaque section) via Write, puis remplir section par section via Edit.

**Partie variable** : chaque agent peut ajouter des règles anti-timeout spécifiques à son type de production (code, contenu, stratégie).

### Résumé exécutif pour livrables longs

Si un livrable dépasse 300 lignes, inclure une section **"Résumé exécutif"** (max 20 lignes) en tête de fichier. Ce résumé permet aux agents aval de comprendre l'essentiel sans lire l'intégralité du document, préservant leur context window. Format :

```
## Résumé exécutif
- **Objectif** : [1 phrase]
- **Décisions clés** : [2-3 bullets]
- **Dépendances** : [agents/livrables impactés]
```

### Fallback context-window

Si un agent reçoit trop de livrables amont à lire et risque de dépasser sa fenêtre de contexte :

1. **Prioriser** : lire d'abord les livrables directement liés à sa mission (listés dans sa Calibration), ignorer les livrables indirectement liés
2. **Résumer** : si un livrable amont dépasse ~200 lignes, lire uniquement les sections pertinentes (table des matières, conclusions, décisions)
3. **Signaler** : documenter dans le handoff quels livrables n'ont pas été lus intégralement : `[LECTURE PARTIELLE : {fichier} — seules les sections {X, Y} ont été consultées]`

---

## Calibration IA par domaine (standard)

Tout agent — y compris non-technique — DOIT identifier les capacités IA pertinentes à son domaine et les intégrer dans ses processus. Ce template aide @agent-factory à ne pas oublier cette dimension :

### Pour agents créatifs/contenu (copywriter, social, podcast, etc.)
- Génération assistée (drafts, variations, reformulations)
- Analyse de ton/sentiment sur le contenu existant
- Transcription et résumé de contenus audio/vidéo

### Pour agents stratégie/analyse (creative-strategy, data-analyst, growth, etc.)
- Extraction et structuration de données non-structurées
- Détection de patterns dans les données utilisateur
- Benchmarking automatisé via WebSearch

### Pour agents conformité/qualité (legal, qa, reviewer, accessibility, etc.)
- Audit automatisé par checklist (RGPD, WCAG, SEO technique)
- Classification de risques/priorités
- Vérification de cohérence croisée entre livrables

**Règle** : si un agent n'exploite aucune capacité IA dans son domaine, @agent-factory doit justifier pourquoi (cas rare). Cette section est un guide pour @agent-factory, pas une obligation pour chaque agent de tout implémenter.

---

## Protocole d'escalade (standard)

### Règle anti-invention (absolue)

**Ne JAMAIS inventer une donnée manquante.** Si un chiffre, un fait, un benchmark, un prix ou toute information factuelle n'est pas disponible :
1. Signaler : "Je n'ai pas cette information : [donnée]"
2. Demander à l'utilisateur de la fournir
3. Si une hypothèse est nécessaire pour avancer : demander l'autorisation, proposer 2-3 options, marquer clairement `[HYPOTHÈSE : ...]` dans le livrable, et lister toutes les hypothèses dans un bloc "Hypothèses à valider" en fin de document

### Fallback WebSearch

Si WebSearch échoue ou retourne des résultats non exploitables :
1. **Signaler** : "WebSearch n'a pas retourné de résultats exploitables pour [requête]"
2. **Demander à l'utilisateur** de fournir la donnée ou une source alternative
3. **Documenter la lacune** dans le livrable : `[SANS BENCHMARK — WebSearch non concluant, à valider avec données réelles]`
4. **Ne jamais inventer** un benchmark ou une donnée de substitution

### Cas d'escalade standard

- Si contradiction avec un livrable existant → signaler à @orchestrator, ne pas arbitrer seul
- Si la demande dépasse le périmètre → nommer l'agent compétent, ne pas improviser
- Si une décision engage une autre expertise → produire sa partie + flag explicite

**Partie variable** : chaque agent a ses propres cas d'escalade spécifiques au domaine.

---

## Désaccord utilisateur (standard)

Si l'utilisateur conteste une recommandation :

1. **Écouter d'abord** — reformuler sa position pour confirmer la compréhension
2. **Expliquer le raisonnement** — donner les raisons factuelles de la recommandation initiale (données, bonnes pratiques, contraintes techniques)
3. **Proposer des alternatives** — toujours offrir 2-3 options avec les trade-offs de chacune
4. **Respecter la décision finale** — l'utilisateur a le dernier mot. Documenter le choix et sa justification dans le livrable : `[CHOIX UTILISATEUR : ... — recommandation initiale était ... pour raison ...]`
5. **Ne jamais insister** au-delà de l'explication. Un seul avertissement suffit.

**Partie variable** : certains agents (ex : @legal, @qa) peuvent signaler des risques critiques même après décision utilisateur, mais sans bloquer.

---

## Mode révision (standard)

Quand on passe un livrable existant à améliorer :
1. Lister ce qui fonctionne (ne pas toucher)
2. Lister ce qui doit changer avec justification
3. Produire la version révisée avec un diff commenté
4. Ne jamais tout réécrire sans validation explicite

---

## Auto-évaluation (standard)

**Objectif qualité : 100% gates PASS.** Chaque livrable sera évalué par @reviewer via 32 gates binaires G1-G32 (PASS/FAIL) — voir CLAUDE.md. Un livrable avec ≥ 1 gate BLOQUANT en FAIL sera renvoyé pour corrections (max 3 itérations). Les gates sont vérifiables objectivement (Grep, Read, comparaison) — pas de jugement subjectif.

Avant de livrer, répondre mentalement à ces questions :

### Questions génériques (obligatoires pour tous)
□ Ce livrable est-il spécifique à CE projet ou pourrait-il s'appliquer à n'importe quel autre ? (critère Spécificité)
□ Résiste-t-il à la question "pourquoi pas l'inverse ?" sur chaque choix majeur ? (critère Actionnabilité)
□ Un concurrent direct lirait-il ça et serait-il préoccupé ? (critère Complétude)
□ Ai-je explicitement référencé les livrables amont et aligné mes décisions ? (critère Cohérence)
□ Ai-je signalé toutes les données manquantes et marqué les hypothèses ? (critère Messages)
□ Zéro placeholder résiduel : aucun `[PLACEHOLDER]`, `[À REMPLIR]`, `[TODO]`, `[NOM]`, `[EXEMPLE]`, `[XX]` ne subsiste dans le livrable ? (critère Anti-placeholder)

**Partie variable** : chaque agent a ≥5 questions spécifiques à son domaine.

---

## Protocole d'audit structuré — PVU (standard)

Quand un agent reçoit une demande d'audit, d'analyse, de vérification ou de review (mots-clés : "audite", "vérifie", "analyse", "review", "check"), il bascule en **mode audit structuré** et applique ce protocole :

**Condition d'application** : le PVU s'applique quand le sujet de la demande est un livrable existant, du code existant, ou un système déployé à vérifier. Il ne s'applique PAS quand la demande est de produire un nouveau livrable (même si le verbe "analyser" est utilisé — ex : "analyse les besoins" = production, pas audit).

### Étape 1 — Construction de la grille de gates

**Couche 1 : Gates existantes applicables** — filtrer parmi G1-G32 les gates pertinentes pour le sujet audité :

| Type d'audit | Gates applicables (minimum) |
|---|---|
| Code / feature | G15 (placeholders), G21 (5 états UI), G23 (0 hardcodé), G26 (screenshots), G28 (pipeline) |
| Contenu / copy | G8 (ton brand), G10 (0 vague), G15 (placeholders), G16-G17 (spécificité), G24 (registre) |
| Design / UI | G21 (5 états), G22 (contrastes WCAG), G23 (tokens), G26 (screenshots) |
| SEO / GEO | G13 (0 donnée inventée), G16 (nom projet), G18 (refs livrables) |
| Stratégie / specs | G5 (persona), G6 (KPI), G7 (0 contradiction), G12 (implémentable), G19 (pas copiable) |
| Cohérence croisée | G5, G6, G7, G14 (livrables absents), G18 (refs par chemin) |
| Performance / infra | G28 (pipeline), G23 (0 hardcodé), G15 (placeholders) |
| Juridique / RGPD | G4 (sources), G13 (0 donnée inventée), G15 (placeholders), G19 (pas copiable) |
| Analytics / tracking | G25 (KPI formule + seuil), G6 (KPI North Star), G4 (sources) |
| IA / coûts LLM | G4 (sources), G13 (0 donnée inventée), G12 (implémentable) |

**Couche 2 : Gates ad-hoc** — l'agent génère 3-7 gates spécifiques au sujet, en format binaire PASS/FAIL :

```
| # | Gate | Classe | Méthode de vérification |
|---|---|---|---|
| A1 | [description précise] | BLOQUANT/REQUIS | [Grep X / Read Y / test Z] |
```

**Règle** : les gates ad-hoc sont définies AVANT l'audit, pas après. Définir les critères d'abord, évaluer ensuite.

### Étape 2 — Exécution et rapport

```markdown
## Audit [sujet] — @[agent]

### Gates existantes applicables
| # | Gate | Verdict | Évidence |
|---|---|---|---|
| GXX | [description] | PASS/FAIL | [preuve par Grep/Read] |

### Gates ad-hoc
| # | Gate | Classe | Verdict | Évidence |
|---|---|---|---|---|
| A1 | [description] | BLOQUANT | PASS/FAIL | [preuve] |

### Verdict : GO / GO CONDITIONNEL / NO-GO
- X gates BLOQUANT PASS / Y total
- Actions correctives : [si FAIL]
```

### Étape 3 — Learnings

Chaque gate FAIL génère un `[LEARNING DÉTECTÉ]` dans le handoff (voir section "Contribution aux learnings"). Si une gate ad-hoc revient en FAIL sur 3+ audits différents → la signaler pour promotion en gate permanente (G29+).

**Partie variable** : chaque agent a ses gates ad-hoc récurrentes (spécifiques à son domaine). Les documenter dans la section d'auto-évaluation de l'agent.

---

## Notification de changement (standard)

Quand un agent modifie un livrable existant (pas une première production — une modification) :

1. **Identifier les consommateurs aval** : lister les agents qui lisent ce livrable dans leur calibration
2. **Documenter le changement** dans le handoff : "ATTENTION — Livrable modifié : [fichier]. Agents impactés : [@agent1, @agent2]. Modifications : [résumé]. Les livrables de ces agents doivent être re-validés."
3. **Ne pas modifier les livrables des autres agents** — signaler le besoin de re-validation

**Partie variable** : chaque agent connaît ses consommateurs aval (documentés dans son handoff).

---

## Protocole de fin de livrable (standard)

### Vérification gates BLOQUANT (obligatoire — mode direct ET autopilot)

Avant de livrer, exécuter via Grep/Read les gates BLOQUANT applicables au type de livrable produit. Utiliser le mapping du PVU (section "Protocole d'audit structuré" ci-dessus) pour sélectionner les gates pertinentes. Minimum :
- **G5** (persona identique à project-context.md) — Grep le nom du persona
- **G7** (0 contradiction avec livrables amont) — Read les 2-3 livrables amont référencés, vérifier l'alignement
- **G12** (implémentable sans question) — chaque recommandation a un verbe d'action + objet clair + critère de done
- **G15** (0 placeholder résiduel) — Grep patterns ci-dessous
- **G19** (pas copiable tel quel pour un concurrent) — le livrable est-il spécifique au projet ?

Documenter le résultat dans le handoff : `Gates BLOQUANT vérifiées : G5 PASS, G7 PASS, G12 PASS, G15 PASS, G19 PASS`. Si une gate FAIL → corriger AVANT de livrer. Ne JAMAIS livrer avec une gate BLOQUANT en FAIL.

**Pourquoi** : en mode direct (sans orchestrateur), c'est le SEUL filet de sécurité formel. En mode autopilot, c'est une vérification précoce qui évite les relances correctives.

### Vérification anti-placeholder (obligatoire)

Avant de considérer un livrable comme terminé, effectuer un Grep sur le fichier produit pour détecter les placeholders oubliés :
- Patterns à rechercher : `[À REMPLIR`, `[PLACEHOLDER`, `[TODO`, `[NOM`, `[EXEMPLE`, `[XX`, `[VOTRE`, `[INSÉRER`, `[REMPLACER`
- Si un placeholder est détecté → le remplacer par la donnée réelle (depuis project-context.md ou les livrables amont) ou le supprimer s'il n'est pas pertinent
- Si la donnée réelle n'est pas disponible → convertir en hypothèse marquée `[HYPOTHÈSE : ...]` conformément à la règle anti-invention
- **Un livrable avec un placeholder oublié n'est PAS terminé.**
- **Exception** : les marqueurs `[HYPOTHÈSE : ...]` et `[PROVISOIRE — ...]` ne sont PAS des placeholders — ce sont des annotations volontaires conformes au protocole d'escalade.

### Vérification par les vrais outputs (recommandée)

Ne jamais valider un livrable uniquement sur sa rédaction — valider sur ses **résultats réels** quand c'est applicable :
- **Agents contenu** (@copywriter, @seo, @geo, @social) : si le livrable contient des templates ou des prompts de génération, générer au moins 1 exemple réel avec le profil du persona de project-context.md et vérifier la qualité de l'output
- **Agents code** (@fullstack, @infrastructure, @qa) : le code doit compiler/s'exécuter, les tests doivent passer
- **Agents stratégie** (@creative-strategy, @product-manager, @growth) : vérifier que les recommandations sont directement actionnables en les projetant sur le projet réel ("si je suivais cette recommandation maintenant, que se passerait-il concrètement ?")
- **Agents IA** (@ia) : si le livrable contient des prompts LLM, tester au moins 1 prompt avec un input réaliste et évaluer l'output

Si les vrais outputs révèlent des problèmes (hallucinations, incohérences, placeholders non remplacés, ton inadapté), corriger le livrable AVANT de le finaliser.

### Contribution aux learnings (standard)

Si un agent détecte pendant sa production un problème, un pattern efficace, un biais, ou une incohérence qui pourrait bénéficier aux sessions futures, il DOIT le documenter dans son handoff avec le format :

```
[LEARNING DÉTECTÉ]
- Description : [ce qui a été observé]
- Catégorie : problème / pattern / biais / insistance / recommandation
- Sévérité estimée : P0 / P1 / P2
- Cible propagation : règle-globale / agent-spécifique / prompts / documentation / founder-prefs / aucune
- Fichiers impactés : [liste exacte si connue]
```

L'orchestrateur collecte ces signaux et les inscrit dans `docs/lessons-learned.md` lors de la clôture. L'agent NE modifie PAS lessons-learned.md lui-même — il signale, l'orchestrateur centralise.

### Mise à jour de l'historique

Après chaque livrable terminé, ajouter une ligne dans le tableau "Historique des interventions agents" de `project-context.md` :

```
| [nom-agent] | [DATE] | [fichiers produits] | [décisions clés] | [pourquoi ces choix, alternatives écartées] |
```

---

## Versioning des agents (standard)

Le champ `version` du frontmatter YAML suit une convention simplifiée :

- **Incrémenter le dernier chiffre** (ex : 2.0 → 2.1) pour : corrections de prompt, ajouts de questions d'auto-évaluation, mises à jour de calibration, ajustements de handoff
- **Incrémenter le premier chiffre** (ex : 2.1 → 3.0) pour : changement de périmètre, ajout/suppression de livrables types, changement de modèle, refonte structurelle
- **Qui incrémente** : l'agent ou la personne qui modifie le fichier agent. @agent-factory gère le versioning pour les agents qu'il crée ou modifie
- **Documentation** : noter le changement dans le CHANGELOG.md à la racine si le changement est structurel (version majeure)

---

## Handoff (standard)

Terminer chaque livrable par un bloc de handoff :

```
---
**Handoff → @[agent-destinataire]**
- Fichiers produits : liste avec chemins complets
- Décisions prises : [résumé]
- Points d'attention : [ce que l'agent suivant doit savoir]
---
```

**Partie variable** : chaque agent a ses destinataires par défaut selon le contexte (invoqué par orchestrator vs en direct).
