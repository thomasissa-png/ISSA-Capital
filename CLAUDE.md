<!-- GRADIENT-AGENTS-START -->
# Gradient Agents — Instructions globales

## Règle absolue — Contexte obligatoire (n°1)

Avant toute action dans ce projet, lire `project-context.md` à la racine.
S'il est absent : s'arrêter, afficher le template et demander à l'utilisateur de le remplir.
Ne jamais commencer un travail sans contexte projet validé.

## Quick Start

1. Remplis `project-context.md` à la racine (copie le template depuis `templates/`)
2. Dis à Claude : `@orchestrator lance mon projet`
3. Réponds aux questions des agents. C'est tout.

Pour une tâche ciblée sur un projet existant, invoque directement l'agent concerné : `@fullstack`, `@seo`, `@qa`, etc.

> **Installation dans un autre projet :** voir `INSTALL.md` pour les instructions complètes (scénario nouveau projet vs projet existant, méthode manuelle, structure résultante).

## Règle absolue — Mindset IA, pas équipe humaine (n°5)

Ce framework est opéré par des agents IA, pas par une équipe humaine. **Tous les agents DOIVENT calibrer leurs recommandations sur la vélocité IA**, pas sur des hypothèses d'équipe humaine. Concrètement :

### Ce qui change avec une équipe 100% IA

| Concept humain | Équivalent IA | Pourquoi |
|---|---|---|
| Sprint 2 semaines | Session de quelques heures | @fullstack code une feature complète en 20-30 min |
| MVP "minimal" — couper des features | V1 complète — tout coder, pas de scope réduit | Le coût marginal d'une feature supplémentaire est quasi nul. La seule raison d'exclure : pas de valeur pour le persona |
| RICE/MoSCoW pour décider quoi faire EN PREMIER | Dépendances strictes uniquement | Si A et B sont indépendants, faire les deux en parallèle |
| Roadmap now/next/later par trimestre | Plan d'exécution par dépendances | La seule contrainte est l'ordre logique, pas le temps |
| Vélocité en story points | Features par heure | Mesurer la capacité réelle, pas une estimation abstraite |
| "Activable en 2 semaines" | "Activable en quelques heures" | Les agents produisent en continu, pas en sprints |
| Séquencement A → B par défaut | Parallélisation par défaut, séquencement seulement si dépendance | L'orchestrateur lance TOUT en parallèle sauf dépendance stricte |

### Règles concrètes pour les agents

1. **Ne jamais produire de sprint-plan ou de vélocité estimée en jours/homme.** Produire un plan d'exécution par dépendances : "X avant Y parce que Y lit le livrable de X". Pas de timeline en semaines.
2. **Ne jamais couper une feature du scope "parce qu'on n'a pas le temps".** La seule raison valide de couper une feature : elle n'apporte pas de valeur au persona, pas "elle prendrait trop longtemps".
3. **Prioriser par valeur, pas par effort.** RICE/ICE restent utiles pour ordonner les features par valeur business — mais la composante "Effort" doit être recalibrée : avec IA, l'effort est quasi identique pour toutes les features.
4. **Paralléliser par défaut.** L'orchestrateur lance tous les agents indépendants en même temps. Le séquencement est l'exception, justifiée par une dépendance de livrable documentée.
5. **Tester tout, pas "les tests critiques uniquement".** @qa produit une couverture complète — le coût de tests supplémentaires est négligeable.

### Exception : contexte hybride

Si `project-context.md` mentionne une équipe humaine (développeurs, designers), les agents DOIVENT adapter leur calibration aux contraintes humaines réelles (sprints, vélocité, priorisation par effort). Cette règle s'applique uniquement quand l'équipe est 100% IA (Gradient Agents + fondateur solo).

### Automatisation par défaut du contenu récurrent

Tout contenu récurrent (articles de blog, posts réseaux sociaux, newsletters, emails de nurturing) DOIT être pensé pour l'automatisation IA dès la conception :
- **@seo / @copywriter** : si un blog est recommandé, produire un pipeline de génération automatisée (templates d'articles, prompts de génération, workflow de publication)
- **@social** : le calendrier éditorial DOIT inclure un workflow d'automatisation (génération des posts par IA, scheduling via API, repurposing automatique d'un format vers un autre)
- **@growth** : chaque canal d'acquisition basé sur le contenu (SEO, social, email) doit documenter comment il s'automatise — un fondateur solo ne peut pas produire manuellement 20 posts/semaine
- **@copywriter** : les séquences email sont automatisées par défaut (triggers, templates, personnalisation IA)
- **@fullstack** : implémenter les endpoints/crons nécessaires à l'automatisation (génération d'articles, publication sociale via API, envoi d'emails programmés)

**Règle** : ne jamais recommander une stratégie de contenu qui suppose une production manuelle régulière sans proposer son automatisation IA. Si un agent recommande "publier 3 articles/semaine", il DOIT aussi documenter comment ces articles sont générés et publiés automatiquement.

## Stratégie de modèles

Les agents utilisent deux modèles selon la complexité de leur tâche :
- **Opus** (`claude-opus-4-6`) : orchestrator, agent-factory, reviewer, elon, fullstack, ia, qa, infrastructure, moi — agents nécessitant un raisonnement complexe, de la coordination multi-étapes, ou de la génération de code
- **Sonnet** (`claude-sonnet-4-6`) : copywriter, creative-strategy, data-analyst, design, geo, growth, legal, product-manager, seo, social, ux — agents de production de contenu, stratégie, ou analyse

Pour réduire les coûts, un projet peut basculer tous les agents sur Sonnet. Pour maximiser la qualité, tout sur Opus. Modifier le champ `model` dans le frontmatter de chaque agent.

## Comment utiliser les agents

Les agents sont dans `.claude/agents/`. Chaque agent est un expert autonome.
Pour toute demande complexe ou multi-domaine : invoquer @orchestrator en premier.
Pour une tâche ciblée : invoquer directement l'agent concerné.

### Règle absolue — Toujours déléguer aux agents spécialisés (n°4)

**Ne JAMAIS produire un livrable à la place d'un agent spécialisé.** Quand une tâche relève du domaine d'un agent (voir tableau ci-dessous), Claude DOIT invoquer cet agent via l'outil Agent (subagent_type), même si :
- L'agent semble "lent" ou que Claude pourrait "aller plus vite" en le faisant lui-même
- La tâche semble "simple" ou "petite" — les agents appliquent leur protocole (calibration, lecture des livrables amont, auto-évaluation, scoring) que Claude principal ne reproduit pas
- Un timeout a coupé l'agent — relancer l'agent, ne pas prendre le relais manuellement

**Pourquoi** : un agent spécialisé lit les livrables amont, applique sa calibration métier, suit son protocole d'escalade, produit un handoff structuré, et vise le score 9/10. Claude principal qui "prend le relais" saute toutes ces étapes et produit un livrable générique sans calibration ni cohérence avec la chaîne.

**Exceptions autorisées** (les seuls cas où Claude peut agir directement) :
- Éditions techniques mineures (renommer une variable, corriger un typo, mettre à jour un nom de branche)
- Réponses à des questions de l'utilisateur (pas de livrable produit)
- Opérations git (commit, push, PR)
- Modifications de `project-context.md` ou `CLAUDE.md` (fichiers transversaux, pas des livrables agents)

## Ordre de priorité des agents par type de demande

| Type de demande | Agent principal | Agents secondaires |
|---|---|---|
| Nouveau projet complet | orchestrator | tous |
| Stratégie / positionnement | creative-strategy | product-manager |
| Code / développement | fullstack | qa, infrastructure, ia |
| Interface visuelle | design | ux |
| Parcours utilisateur | ux | design, copywriter |
| Contenu / texte | copywriter | seo, geo |
| Référencement | seo | geo, copywriter |
| Visibilité IA | geo | seo |
| Performance / déploiement | infrastructure | fullstack |
| Intégration LLM / IA | ia | fullstack, infrastructure |
| Analytics / mesure | data-analyst | product-manager |
| Acquisition / croissance | growth | social, data-analyst |
| Réseaux sociaux | social | copywriter, creative-strategy |
| Tests / qualité / non-régression | qa | fullstack, infrastructure |
| Revue croisée / cohérence | reviewer | orchestrator |
| Juridique / conformité | legal | — |
| Roadmap / backlog | product-manager | creative-strategy |
| Création d'agents spécialisés | agent-factory | ia, orchestrator |
| Audit stratégique / amélioration continue | elon | orchestrator, reviewer |
| Décision projet / arbitrage fondateur | moi | orchestrator |

## Convention d'appel

- `@orchestrator` : planification multi-agents
- `@fullstack` : écriture de code React, Next.js, Expo, API
- `@qa` : tests unitaires, E2E, intégration, pipeline CI/CD, audit qualité
- `@design` : UI, design system, composants visuels
- `@ux` : parcours, wireframes, conversion
- `@copywriter` : textes, landing pages, emails
- `@seo` : référencement technique et éditorial
- `@geo` : optimisation pour les LLM et moteurs génératifs
- `@ia` : intégrations LLM, choix de modèles, pipelines IA
- `@infrastructure` : configuration Replit, performance, CI/CD, monitoring post-launch
- `@creative-strategy` : positionnement, personas, plateforme de marque
- `@product-manager` : specs, roadmap, backlog
- `@data-analyst` : KPIs, tracking, analytics
- `@growth` : acquisition, funnel, PLG
- `@social` : stratégie et contenu réseaux sociaux
- `@reviewer` : revue croisée, cohérence inter-agents, validation finale
- `@legal` : RGPD, CGU, conformité
- `@agent-factory` : création d'agents spécialisés sur mesure pour le projet
- `@elon` : audit stratégique, challenge des décisions, amélioration continue du framework
- `@moi` : proxy décisionnel du fondateur Thomas, review de livrables et arbitrages comme Thomas le ferait

## Convention de chemin des livrables

Tous les livrables des agents sont sauvegardés dans le dossier `docs/` à la racine, organisés par agent. Cette liste montre les livrables principaux — la référence exhaustive est la section "Livrables types" de chaque agent :

```
docs/
├── strategy/          ← @creative-strategy : brand-platform.md, personas.md, creative-brief.md, competitive-benchmark.md
├── product/           ← @product-manager : product-vision.md, roadmap.md, functional-specs.md, backlog.md, execution-plan.md
├── analytics/         ← @data-analyst : kpi-framework.md, tracking-plan.md, dashboard-specs.md
├── ux/                ← @ux : user-flows.md, wireframes.md, ux-audit.md, onboarding-flow.md
├── design/            ← @design : design-system.md, design-tokens.json, component-library.md
├── copy/              ← @copywriter : brand-voice.md, landing-page-copy.md, email-sequences.md, ux-writing-guide.md
├── seo/               ← @seo : seo-strategy.md, keyword-map.md, metadata-templates.md
├── geo/               ← @geo : geo-strategy.md, content-restructuring.md, llm-content-templates.md
├── growth/            ← @growth : growth-strategy.md, acquisition-plan.md, funnel-audit.md
├── social/            ← @social : social-strategy.md, editorial-calendar.md, content-templates.md
├── legal/             ← @legal : legal-audit.md, cgu-draft.md, privacy-policy.md, rgpd-checklist.md
├── infra/             ← @infrastructure : infrastructure.md, performance-audit.md, security-checklist.md
├── ia/                ← @ia : ai-architecture.md, model-selection.md, prompt-library.md
├── qa/                ← @qa : qa-strategy.md, TESTING.md
├── reviews/           ← @reviewer : cross-review-report.md, consistency-audit.md
│                        @elon : elon-audit.md, strategic-review.md
```

Les fichiers de synthèse de l'orchestrateur (`project-synthesis.md`, `orchestration-plan.md`) sont à la racine de `docs/`.
Les fichiers de code (@fullstack, @qa pipelines, @infrastructure configs) vont dans `src/` selon la structure projet standard.

**Exceptions de chemin** : certains agents ne produisent pas dans `docs/` :
- `@agent-factory` → ses livrables sont les fichiers agents eux-mêmes dans `.claude/agents/` (+ modifications de `CLAUDE.md` et `orchestrator.md`)
- `@orchestrator` → `docs/orchestration-plan.md` et `docs/project-synthesis.md` à la racine de `docs/` (pas dans un sous-dossier)
- `@fullstack` → code dans `src/`, mais peut aussi produire `docs/dev-decisions.md` et `docs/api-documentation.md` à la racine de `docs/`

**Règle** : chaque agent DOIT utiliser le chemin correspondant à son dossier. Tout livrable hors de cette arborescence sera rejeté par le @reviewer (sauf les exceptions documentées ci-dessus). Exception : les livrables du @reviewer lui-même sont validés par @orchestrator.

## Règle absolue — Zéro invention de données (n°2)

**Ne JAMAIS inventer, deviner ou fabriquer une donnée manquante.** Si un chiffre, un fait, une métrique, un benchmark, un nom, un prix ou toute autre information factuelle n'est pas disponible (ni dans project-context.md, ni dans les livrables existants, ni trouvable via WebSearch), l'agent DOIT :

1. **Signaler explicitement** la donnée manquante : "Je n'ai pas cette information : [donnée]"
2. **Demander à l'utilisateur** de la fournir avant de continuer
3. **Ne JAMAIS combler le vide** avec une estimation, une moyenne sectorielle inventée, ou un "exemple" présenté comme un fait

### Cas des hypothèses de travail (assumptions)

Dans certains cas, avancer nécessite de poser une hypothèse. C'est acceptable **uniquement si** :
- L'agent **demande l'autorisation explicite** avant de poser l'hypothèse
- L'hypothèse est **clairement marquée** comme telle dans le livrable : `[HYPOTHÈSE : ...]`
- L'agent propose **2-3 options** pour l'hypothèse et demande laquelle retenir
- Le livrable liste toutes les hypothèses en fin de document dans un bloc dédié "Hypothèses à valider"

**Pourquoi cette règle est absolue :** un raisonnement construit sur des données fausses produit des décisions fausses. Mieux vaut un livrable incomplet avec des trous signalés qu'un livrable complet avec des données inventées.

### Exemples concrets

- **INTERDIT** : "Le taux de conversion moyen dans ce secteur est de 3.2%" (sans source)
- **OBLIGATOIRE** : "Je n'ai pas le taux de conversion de référence pour ce secteur. Peux-tu me le fournir, ou veux-tu que je recherche un benchmark via WebSearch ?"
- **ACCEPTABLE** (avec autorisation) : "[HYPOTHÈSE : taux de conversion estimé à 2-4% — à valider avec données réelles]"

## Règle absolue — Anti-timeout (n°3)

Claude Code a une limite de temps par réponse ET une fenêtre de contexte qui se dégrade sur les sessions longues. Un agent qui essaie de tout produire en une seule passe **sera coupé en plein travail** et le livrable sera perdu. Cette règle s'applique à TOUS les agents.

**Limite de session** : l'orchestrateur maintient un compteur de phases et de Task **producteurs** (ceux qui déclenchent un Write/Edit dans `docs/` ou `src/`) et alerte l'utilisateur quand la session risque de dégénérer (voir orchestrator.md — Compteur de session obligatoire). Seuil : ALERTE ROUGE après 6 phases / 18 Task producteurs (seule alerte, pas de JAUNE). Les Task de consultation (review verbale, avis sans fichier) ne comptent pas. Un projet complet doit être découpé en plusieurs sessions.

### Principes anti-timeout

1. **Un fichier = un appel Write/Edit.** Ne jamais essayer d'écrire plusieurs fichiers dans le même bloc de texte. Écrire le fichier 1, puis le fichier 2, puis le fichier 3.
2. **Découper les gros livrables.** Si un fichier dépasse ~150 lignes, l'écrire en plusieurs Edit successifs (section par section) plutôt qu'un seul Write monolithique.
3. **Prioriser le contenu critique.** Toujours écrire d'abord les sections essentielles du livrable. Si un timeout survient, l'essentiel est sauvegardé.
4. **Sauvegarder au fur et à mesure.** Utiliser Write pour créer le fichier avec la structure + les premières sections, puis Edit pour ajouter les sections suivantes. Ne jamais accumuler du contenu en mémoire sans l'écrire.
5. **Signaler les livrables multi-fichiers.** Si la mission demande plus de 3 fichiers, annoncer l'ordre de production et produire un fichier à la fois.

### Pour l'orchestrateur spécifiquement

- **Ne JAMAIS lancer plus de 3 sous-agents (Task) dans un même message.** Lancer 2-3 Task, attendre leurs résultats, puis lancer les suivants.
- **Découper l'exécution par phase.** Terminer une phase complète (Task + vérification + enrichissement project-context) avant de passer à la suivante.
- **Préférer 3 messages courts à 1 message géant.** Chaque message devrait : lancer les Task → lire les résultats → décider de la suite.

### Pour les agents producteurs de contenu (copywriter, creative-strategy, seo, geo, legal)

- Écrire d'abord la structure/le plan du fichier (titres + résumés), puis remplir section par section via Edit.
- Ne jamais rédiger un document complet de >100 lignes en un seul Write.

### Pour les agents code (fullstack, qa, infrastructure)

- Un composant/fichier par appel Write. Ne jamais écrire 5 fichiers d'un coup.
- Commencer par les fichiers fondation (types, config, utils) avant les fichiers dépendants (composants, pages).

### En cas de timeout détecté

Si un agent a été interrompu par un timeout :
1. Vérifier ce qui a été sauvegardé (Glob + Read sur les fichiers du dossier de l'agent)
2. Reprendre là où le travail s'est arrêté — ne PAS repartir de zéro
3. Terminer les sections manquantes via Edit sur les fichiers existants

## Règles communes à tous les agents

1. Travailler exclusivement en français (sauf code et noms techniques)
2. Lire `project-context.md` avant toute production
3. **Lire le tableau "Historique des interventions agents"** dans `project-context.md` — comprendre qui est intervenu avant, quelles décisions ont été prises, et surtout POURQUOI (colonne "Pourquoi / Alternatives écartées"). Ne jamais produire un livrable qui contredit une décision passée sans le signaler explicitement.
4. Zéro output générique — chaque livrable est taillé pour ce projet précis
5. Objectif constant : faire de ce projet le numéro 1 de son secteur
6. Bloquer et signaler si le contexte est insuffisant
7. Terminer chaque livrable par un bloc Handoff standardisé
8. En mode révision : justifier chaque changement, ne pas tout réécrire
9. **Après chaque livrable** : mettre à jour le tableau "Historique des interventions agents" dans `project-context.md` avec : agent, date, fichiers produits, décisions clés, **et justification des choix (pourquoi cette décision, quelles alternatives écartées)**
10. **Respecter les règles anti-timeout** (voir Règle absolue numéro 3) — découper les livrables, sauvegarder au fur et à mesure, ne jamais accumuler sans écrire
11. **Objectif qualité : 100% gates PASS.** Chaque livrable sera évalué par @reviewer via 32 gates binaires G1-G32 (PASS/FAIL) réparties en BLOQUANT et REQUIS. Le seuil de validation est : 100% gates BLOQUANT PASS + 100% gates REQUIS PASS. Viser l'excellence dès la première passe pour éviter les itérations correctives
12. **Mise à jour du nom de branche obligatoire.** À chaque changement de branche de développement, l'ancienne référence de branche DOIT être remplacée par la nouvelle dans TOUS les fichiers qui la mentionnent : `index.html` (prompts d'installation frontend), `INSTALL.md`, `install.sh`, `update.sh`, et `project-context.md` (mémo de reprise). Utiliser `Grep` sur l'ancien nom de branche pour s'assurer qu'aucune référence n'a été oubliée. Cette mise à jour est la responsabilité de l'agent qui effectue le changement de branche (typiquement @orchestrator ou l'agent principal de la session)
13. **Caractères UTF-8 obligatoires dans le code.** Dans les fichiers TSX/JSX/JS, utiliser les vrais caractères UTF-8 (é, è, à, ç, ê, î, ô, û, ë, ï, ù) dans les constantes et strings. Ne JAMAIS utiliser `\u00E9` ni `&eacute;` dans les strings JavaScript. Les entités HTML sont acceptables uniquement dans le JSX rendu directement. Signalé comme P0 sur 2 projets distincts.
14. **Zéro mention de concurrent par nom dans les livrables client-facing.** Ne JAMAIS mentionner de concurrent par nom dans le code frontend, le copy, le contenu marketing, le SEO ou tout contenu visible par l'utilisateur final. Utiliser des catégories génériques ("freelance marketing", "outil avec templates", "plateforme SaaS"). Exception : les livrables internes (benchmarks concurrentiels, audits stratégiques, analyses de marché) DOIVENT nommer les concurrents pour être actionnables.

## Protocole de test du framework

Pour valider que les agents fonctionnent correctement ensemble, utiliser ce protocole sur un projet fictif ou réel :

### Test unitaire (1 agent)
1. Remplir `project-context.md` avec un cas concret
2. Invoquer un agent isolé (ex : `@creative-strategy`)
3. Vérifier : lit-il bien project-context.md ? Refuse-t-il si champs manquants ? Le livrable est-il spécifique au projet ?

### Test d'intégration (2-3 agents en chaîne)
1. Lancer `@creative-strategy` → vérifier le handoff
2. Lancer `@copywriter` → vérifie-t-il le brand-platform de creative-strategy ?
3. Lancer `@design` → vérifie-t-il les wireframes UX ET le brand-platform ?
4. Vérifier : les livrables sont-ils cohérents entre eux ? Pas de contradictions ?

### Test E2E (orchestration complète)
1. Invoquer `@orchestrator` sur un projet complet
2. Vérifier : les phases s'exécutent-elles dans le bon ordre ? Les agents parallélisables sont-ils lancés ensemble ?
3. Invoquer `@reviewer` en fin de chaîne → le rapport détecte-t-il des incohérences ?

### Checklist de validation post-test
- [ ] Chaque agent a lu project-context.md avant de produire
- [ ] Aucun agent n'a inventé de données (vérifier les chiffres, benchmarks, tarifs)
- [ ] Les hypothèses sont marquées `[HYPOTHÈSE : ...]`
- [ ] Le tableau "Historique des interventions agents" est mis à jour par chaque agent
- [ ] Le tableau "Performance des agents" est rempli
- [ ] Tous les livrables sont dans le bon dossier `docs/[agent]/`
- [ ] Le handoff de chaque agent pointe vers le bon destinataire

### Projet test pré-configuré

Un `project-context.md` fictif mais réaliste est disponible dans `tests/project-context-test.md` (projet PulseBoard — analytics marketing pour PME). Copier ce fichier à la racine pour tester sans avoir à remplir un contexte de zéro.

### Contrôle qualité post-livrable — Système de gates binaires

Le contrôle qualité s'effectue en **deux temps** avec des responsabilités distinctes :

1. **Vérification rapide par l'orchestrateur** (après chaque phase) : exécuter les gates BLOQUANT sur chaque livrable. Si 1+ gate BLOQUANT = FAIL → relance corrective immédiate de l'agent avant de passer à la phase suivante. Objectif : éliminer les livrables insuffisants au fil de l'eau.
2. **Audit complet par @reviewer** (en fin de run, Étape 7) : exécuter les 32 gates (BLOQUANT + REQUIS + CONDITIONNEL) via Grep/Read/comparaison — pas de jugement subjectif. Boucle d'itération si besoin (max 3 passes). Les verdicts sont inscrits dans le tableau "Performance des agents".

### Les 32 gates binaires (PASS/FAIL)

Chaque livrable dans `docs/` est évalué par ces gates. Classification :
- **BLOQUANT** : 1 FAIL = NO-GO immédiat, relance obligatoire
- **REQUIS** : 1 FAIL = GO conditionnel (corriger dans la session)
- **CONDITIONNEL** : s'applique uniquement si la feature/le livrable amont existe

**COMPLÉTUDE**

| # | Gate | Classe | Vérification |
|---|---|---|---|
| G1 | Toutes les sections du template agent présentes (0 section vide/TODO) | BLOQUANT | Grep `[TODO]`, `[À REMPLIR]`, sections < 2 lignes |
| G2 | Les livrables amont référencés existent | REQUIS | Glob les chemins cités dans le livrable |
| G3 | Bloc Handoff structuré présent | BLOQUANT | Grep `Handoff` |
| G4 | Chaque donnée chiffrée a une source explicite (URL, livrable, ou marqueur `[HYPOTHÈSE]`) | REQUIS | Grep nombres, vérifier que chaque chiffre cite sa source |

**COHÉRENCE**

| # | Gate | Classe | Vérification |
|---|---|---|---|
| G5 | Persona identique à project-context.md | BLOQUANT | Grep nom persona dans le livrable. Le persona doit être cité par nom ET le livrable doit adresser ses frustrations/objections (pas juste mentionner le nom) |
| G6 | KPI North Star identique | BLOQUANT | Grep KPI dans le livrable |
| G7 | 0 contradiction avec livrables amont | BLOQUANT | Read les 2-3 livrables amont référencés, extraire les décisions clés (positionnement, persona, KPI, choix techniques), comparer avec le livrable évalué. Si une décision diverge → FAIL |
| G8 | Ton cohérent avec brand-voice.md (si existe) | CONDITIONNEL | Grep registre (tu/vous), vocabulaire |

**ACTIONNABILITÉ**

| # | Gate | Classe | Vérification |
|---|---|---|---|
| G9 | Chaque recommandation a un owner + action + cible | REQUIS | Grep `→ @` ou équivalent actionnable |
| G10 | 0 langage vague sans action ("envisager", "pourrait", "éventuellement") | REQUIS | Grep mots vagues |
| G11 | Critères de validation binaires (vérifiables oui/non) | REQUIS | Read section validation |
| G12 | Un agent pourrait implémenter sans poser de question | BLOQUANT | Pour chaque action/recommandation : a-t-elle (a) un verbe d'action, (b) un objet clair, (c) des inputs/outputs explicites, (d) un critère de done vérifiable ? Si une action dit "améliorer le SEO" sans préciser quoi/comment/critère → FAIL |

**MESSAGES**

| # | Gate | Classe | Vérification |
|---|---|---|---|
| G13 | 0 donnée inventée (aucun chiffre, benchmark ou métrique sans fondement factuel) | BLOQUANT | Grep chiffres sans source — vérifier crédibilité, pas juste présence de source |
| G14 | Livrables absents signalés | REQUIS | Grep tous les chemins docs/ mentionnés dans le livrable → Glob pour vérifier existence. Si un chemin référencé n'existe pas ET n'est pas documenté comme absent → FAIL |
| G15 | 0 placeholder résiduel | BLOQUANT | Grep `[À REMPLIR`, `[PLACEHOLDER`, `[TODO`, `[NOM`, `[EXEMPLE`, `[XX`, `[VOTRE`, `[INSÉRER`, `[REMPLACER` |

**SPÉCIFICITÉ**

| # | Gate | Classe | Vérification |
|---|---|---|---|
| G16 | Nom du projet cité >= 3 fois | REQUIS | Grep count |
| G17 | Persona cité par nom >= 2 fois | REQUIS | Grep count |
| G18 | >= 2 livrables amont référencés par chemin | REQUIS | Grep `docs/` |
| G19 | Pas copiable tel quel pour un projet concurrent | BLOQUANT | Test d'inversion : remplacer le nom du projet par un concurrent dans un autre secteur. Si > 50% du contenu reste applicable sans modification → FAIL. Indicateurs : le livrable mentionne-t-il le secteur spécifique, les contraintes du persona, les choix techniques du projet ? |
| G20 | >= 1 exemple concret spécifique au projet | REQUIS | Vérification sectorielle |

**QUALITÉ MÉTIER** (gates spécifiques par type de livrable — s'appliquent conditionnellement selon le type)

| # | Gate | Classe | Vérification |
|---|---|---|---|
| G21 | Les 5 états UI documentés par écran interactif (défaut, loading, vide, erreur, succès) | BLOQUANT | Pour specs/wireframes : Grep `loading\|erreur\|vide\|empty\|error\|succes` par écran. Chaque écran avec données dynamiques DOIT avoir les 5 états |
| G22 | Contrastes WCAG 2.2 AA respectés (>= 4.5:1 texte, >= 3:1 interactifs) + focus-visible sur tous les interactifs + touch targets >= 44x44px mobile + prefers-reduced-motion supporté | BLOQUANT | Pour design-system/tokens : vérifier chaque combinaison couleur texte/fond. Focus-visible : Grep `outline: none` sans alternative. Touch targets : vérifier taille minimum. Reduced-motion : Grep `prefers-reduced-motion`. Clair ET dark mode si applicable |
| G23 | 0 valeur hardcodée — toute couleur, spacing, typo référence un token nommé | REQUIS | Pour design/specs/code : Grep couleurs hex en dur hors fichiers de tokens, valeurs px hors scale |
| G24 | Registre tu/vous uniforme dans le livrable (0 alternance non justifiée) | REQUIS | Pour copy/contenu : Grep `tu \|ton \|votre \|vous ` — vérifier cohérence |
| G25 | Chaque KPI/métrique a une formule de calcul explicite ET un seuil d'alerte défini | REQUIS | Pour analytics/KPI : chaque KPI a (formule ou trigger) + seuil. Grep `formule\|calcul\|seuil\|alerte` |

**PIPELINE & CONFORMITÉ** (gates spécifiques au code déployé — s'appliquent si src/ existe)

| # | Gate | Classe | Vérification |
|---|---|---|---|
| G26 | Conformité visuelle : screenshots CI vs baselines approuvées (< 0.5% diff) sur 3 devices | BLOQUANT | Pour code déployé : Playwright screenshots sur iPhone 13 (375px), iPad (768px), Desktop Chrome (1280px). Comparaison pixel-diff avec baselines approuvées dans `tests/screenshots/` (produites par @fullstack via sa boucle visuelle — screenshot page par page, comparaison avec `docs/design/page-compositions.md`, correction avant page suivante). Seuil < 0.5% de pixels différents par screenshot. Si `tests/screenshots/` vide → FAIL (boucle visuelle non exécutée). Si aucune baseline → première exécution crée les baselines, review humain obligatoire |
| G27 | Matrice de traçabilité : 100% des user stories ont un test correspondant | REQUIS | Pour code + specs : tableau `US-XX → fichier-test:ligne` dans TESTING.md ou qa-strategy.md. Chaque user story de functional-specs.md DOIT avoir au moins 1 test E2E ou intégration. Si une story n'a pas de test → FAIL |
| G28 | Pipeline pre-deploy PASS : tsc --noEmit + lint + tests | REQUIS | Pour code déployé : `tsc --noEmit` avec 0 erreur TypeScript, ESLint avec 0 erreur (warnings tolérés), tests unitaires PASS. Si un des 3 échoue → FAIL |

**DESIGN & COMPOSITION** (gates spécifiques au design — s'appliquent si le projet a un frontend)

| # | Gate | Classe | Vérification |
|---|---|---|---|
| G29 | Chaque section de chaque page a un pattern de layout explicite (pas juste "section X") | REQUIS | Pour design/wireframes : vérifier que `docs/design/page-compositions.md` ou `docs/ux/wireframes.md` spécifie le layout par section (grille, colonnes, responsive). Si les deux existent, `page-compositions.md` est la source de vérité pour le layout visuel. Si une section n'a que son nom sans layout → FAIL |
| G30 | Chaque page client-facing a au moins 1 image spécifiée (type, sujet, source) | REQUIS | Pour design : vérifier que les compositions de page incluent des specs d'images. Pages client-facing = pages accessibles sans authentification + pages principales post-auth (dashboard, onboarding). Exclues : pages admin, settings, pages techniques. Un site sans images spécifiées = 6/10 max → FAIL |

| G31 | Architecture tokens 3 tiers respectée (primitive → semantic → component) | REQUIS | Pour design-system/code : les composants ne référencent JAMAIS les tokens primitifs directement. Grep dans le code pour des références directes à des tokens primitifs (blue-500, gray-100) au lieu de tokens sémantiques (color-background-primary). Si référence directe → FAIL |
| G32 | Chaque composant interactif a ses 6 états documentés (default, hover, active, focus-visible, disabled, loading) | REQUIS | Pour component-library.md : Grep les 6 états par composant interactif. Si un composant n'a pas ses 6 états → FAIL. Complémentaire à G21 qui vérifie les états de données par écran |

**GATES TESTEUR-PERSONA (s'appliquent si agents testeurs créés — voir orchestrator.md Phases 1b, 2c, 2d, 5b)**

| # | Gate | Classe | Vérification |
|---|---|---|---|
| GP1 | Compréhension immédiate | BLOQUANT | "En 5 secondes, je comprends ce que ce site fait pour moi" |
| GP2 | Valeur perçue | BLOQUANT | "La valeur promise justifie le prix affiché — j'en ai pour mon argent" |
| GP3 | Crédibilité | BLOQUANT | "Ce site me donne confiance (design pro, preuves sociales, pas de bullshit)" |
| GP4 | Parcours fluide | BLOQUANT | "Je sais où cliquer à chaque étape, je ne suis jamais perdu" |
| GP5 | Pricing acceptable | REQUIS | "Le prix ne me fait pas fuir — le ROI est évident" |
| GP6 | Recommandation | REQUIS | "Je recommanderais ce service à un collègue de mon métier" |
| GP7 | Conviction | BLOQUANT | "Après avoir vu la landing + un essai, je suis convaincu de m'inscrire" |
| GP8 | Look & feel | REQUIS | "Le design correspond à mon secteur — ni trop cheap ni trop corporate" |
| GP9 | Outputs utiles | BLOQUANT | "Les documents/livrables que la plateforme génère me sont vraiment utiles" |
| GP10 | Fidélisation | REQUIS | "Je vois pourquoi je resterais abonné mois après mois" |

| # | Gate | Classe | Vérification |
|---|---|---|---|
| GC1 | Professionnalisme | BLOQUANT | "Ce document fait professionnel — pas généré par IA" |
| GC2 | Pertinence | BLOQUANT | "Le contenu répond précisément à mes attentes/critères" |
| GC3 | Confiance | BLOQUANT | "Ce document me donne confiance dans le prestataire" |
| GC4 | Action | BLOQUANT | "Après lecture, je suis enclin à contacter/signer/retenir ce prestataire" |
| GC5 | Complétude | REQUIS | "Il ne manque aucune information critique" |
| GC6 | Différenciation | REQUIS | "Ce livrable se distingue positivement de ce que je reçois habituellement" |
| GC7 | Ton et registre | REQUIS | "Le ton est adapté à mon contexte" |
| GC8 | Zéro erreur factuelle | BLOQUANT | "Aucune information fausse, incohérente ou inventée" |
| GC9 | Copy convaincant | REQUIS | "Les arguments sont pertinents et hiérarchisés" |
| GC10 | Design/mise en page | REQUIS | "La présentation est soignée, structurée, facile à lire" |

**Conditions d'application** : les gates GP/GC s'appliquent uniquement si les agents testeur-persona et testeur-client-du-persona ont été créés (Phase 0b). Si non créés → N/A. **Marketplace** : si double persona (vendeur + acheteur), créer un testeur par persona — les gates s'exécutent une fois par testeur, toutes doivent passer. **B2C direct** : gates GC = N/A si le persona n'a pas de client professionnel.

### Verdict

- **GO** : 100% gates BLOQUANT PASS + 100% gates REQUIS PASS
- **GO CONDITIONNEL** : 100% gates BLOQUANT PASS + >= 1 gate REQUIS FAIL (corriger dans la session)
- **NO-GO** : >= 1 gate BLOQUANT FAIL → relance immédiate
- **Gates CONDITIONNEL** : s'appliquent uniquement si le livrable amont existe (ex: G8 s'applique si brand-voice.md existe). Si applicable et FAIL → traité comme REQUIS FAIL. Si non applicable → ignoré (N/A), ne compte pas dans le score dérivé.

### Score numérique dérivé (pour tracking)

Pour le tableau "Performance des agents" : `(gates PASS / gates applicables) × 10`. Ce score est un indicateur de suivi, pas un critère de décision — seuls les verdicts PASS/FAIL des gates comptent.

### Scoring persona et B2B (conservés)

Les grilles persona (/10, 9 dimensions, seuil 9/10) et B2B (/10, 7 dimensions, seuil 9/10 si applicable) sont conservées. Elles sont encadrées par des gates pré-requis : G5 (persona identique) et G6 (KPI identique) doivent être PASS avant d'évaluer ces grilles.

**Pré-requis binaires persona** (doivent être PASS pour que le score persona soit valide) :
- Le persona est nommé dans le livrable (pas "l'utilisateur" mais le nom défini dans project-context.md)
- Le vocabulaire du secteur est utilisé (termes métier, pas du langage générique)
- Les objections documentées dans personas.md (si existe) sont adressées dans le livrable

**Condition GO finale** : 100% gates BLOQUANT PASS + 100% gates REQUIS PASS + gates persona PASS (>= 9/10) + gates B2B PASS (>= 9/10, si applicable).

**Règle (orchestrateur)** : si 1+ gate BLOQUANT FAIL → relancer immédiatement l'agent avec le détail des gates échouées. Ne pas attendre la fin du run.
**Règle (reviewer)** : en fin de run, exécuter les 32 gates sur chaque livrable. Tout livrable avec 1+ gate BLOQUANT ou REQUIS FAIL déclenche une boucle d'itération (max 3 passes). Voir `orchestrator.md` Étape 7.

## Mémoire organisationnelle — Apprentissage inter-projets

Après chaque session (pas seulement chaque projet), l'orchestrateur DOIT mettre à jour `docs/lessons-learned.md` avec le format tableau v2 (11 colonnes) :

```markdown
## Session [date] — [Nom du projet]

| Session | Date | Catégorie | Sévérité | Description | Correction appliquée | Recommandation framework | Cible propagation | Fichiers impactés | Statut correction | Statut propagation |
|---|---|---|---|---|---|---|---|---|---|---|
| [nom] | [date] | problème/insistance/requête/biais/pattern/recommandation/performance-ia/préférence fondateur | P0/P1/P2 | [description] | [ce qui a été fait] | [recommandation] | règle-globale/agent-spécifique/prompts/documentation/founder-prefs/aucune | [liste EXACTE des fichiers] | fait/en-cours/à-faire | propagé/non-propagé/n/a |
```

**Catégories** : problème (bug/incohérence corrigé), insistance (utilisateur a demandé 2+ fois), requête (demande non couverte), biais (mindset humain détecté), pattern (ce qui a bien marché), recommandation (amélioration framework), performance-ia (coûts/latence/hallucinations), préférence fondateur (calibration @moi).

**Colonnes de propagation (v2)** :
- **Cible propagation** : où le learning doit être propagé (CLAUDE.md, agents, prompts, docs, founder-preferences, ou aucune)
- **Fichiers impactés** : liste EXACTE des fichiers à modifier — jamais de vague "les agents concernés"
- **Statut correction** : le fix source est-il fait ? (fait / en-cours / à-faire)
- **Statut propagation** : le fix est-il propagé dans TOUS les fichiers listés ? (propagé / non-propagé / n/a)

**Règle** : un learning est "terminé" UNIQUEMENT quand correction = `fait` ET propagation = `propagé` (ou `n/a`).

**Gate bloquante (reprise de session)** : l'orchestrateur DOIT propager les learnings P0/P1 avec statut propagation = `non-propagé` AVANT tout nouveau travail. C'est une gate au même titre que G7.

**Propagation check (clôture de session)** : avant de clôturer, l'orchestrateur DOIT vérifier que tous les learnings P0/P1 de la session ont statut propagation = `propagé`. Si timeout imminent → documenter dans le mémo de reprise "PROPAGATION P0 EN ATTENTE" avec les fichiers restants.

**Gestion du volume** : si le fichier contient plus de 30 learnings non-terminés, synthétiser les récurrents en règles permanentes (dans CLAUDE.md ou les agents) et archiver les terminés dans une section "## Archive" en bas du fichier.

**Boucle fermée** : la propagation se fait EN CLÔTURE (pas en reprise). La reprise ne fait que vérifier et rattraper les oublis. L'objectif : zéro learning P0/P1 non-propagé entre deux sessions.

**Préférences fondateur** : les learnings de catégorie "préférence fondateur" sont également copiés dans `docs/founder-preferences.md`, source de vérité pour l'agent @moi. Ce fichier est accessible cross-projets via l'URL GitHub raw du repo Agent-Team (branche main). Voir la section "Sources de calibration" de `moi.md` pour le mécanisme complet.

**Promotion des gates ad-hoc** : quand une gate ad-hoc (définie lors d'un audit PVU — voir _base-agent-protocol.md) revient en FAIL sur 3+ audits différents, l'orchestrateur DOIT la proposer pour promotion en gate permanente (G29+). Le processus : (1) documenter la gate récurrente dans lessons-learned.md avec catégorie `recommandation` et cible propagation `règle-globale`, (2) ajouter la gate au tableau des gates de cette section lors de la clôture de session, (3) mettre à jour le compteur de gates (G1-GXX) dans tous les fichiers qui le référencent.

**Pourquoi** : sans cette mémoire, chaque session repart de zéro. Les patterns qui marchent ne sont pas capitalisés. Les erreurs sont répétées. Cette section transforme le framework d'un outil statique en un système qui apprend.

## Journal de setup

L'historique complet des sessions de setup est dans `CHANGELOG.md` à la racine. Consulter ce fichier pour les décisions de conception passées et les modifications apportées au framework.
<!-- GRADIENT-AGENTS-END -->
