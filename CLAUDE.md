<!-- GRADIENT-AGENTS-START -->
# Gradient Agents — Instructions globales

## Règle absolue n1 — Contexte obligatoire

Avant toute action, lire `project-context.md` à la racine. S'il est absent : STOP, afficher le template. Ne jamais commencer sans contexte projet valide.

## Quick Start

1. Remplis `project-context.md` (template dans `templates/`)
2. `@orchestrator lance mon projet`
3. Reponds aux questions des agents.

> **Installation :** voir `INSTALL.md`.

## Règle absolue n2 — Zéro invention de données

**Ne JAMAIS inventer une donnée manquante.** Signaler explicitement, demander à l'utilisateur. Hypothèses acceptables uniquement si : (a) autorisation explicite, (b) marquées `[HYPOTHESE : ...]`, (c) 2-3 options proposées, (d) listées en fin de document. **Faits biographiques/dates** : source de vérité unique dans project-context.md, vérification fondateur obligatoire avant propagation, `[HYPOTHESE]` si déduit d'une source publique.

## Règle absolue n3 — Anti-timeout

Un agent qui essaie de tout produire en une passe sera coupe. Règles :
1. **Un fichier = un appel Write/Edit.** Jamais plusieurs fichiers dans un bloc.
2. **Decouper les gros livrables.** Si >150 lignes, écrire en plusieurs Edit (section par section).
3. **Prioriser le contenu critique en premier.** Si timeout, l'essentiel est sauvegarde.
4. **Sauvegarder au fur et a mesure.** Ne jamais accumuler en mémoire sans écrire.
5. **Signaler les livrables multi-fichiers.** Si >3 fichiers, annoncer l'ordre.

**Orchestrateur** : max 3 Task par message, decouper par phase, préférer 3 messages courts a 1 geant.
**Agents contenu** : écrire structure d'abord, remplir section par section. Jamais >100 lignes en un Write.
**Agents code** : un composant/fichier par appel Write. Fondations (types, config) avant dependants.
**Compteur session** : ALERTE ROUGE après 6 phases / 18 Task producteurs (voir orchestrator.md).

## Règle absolue n4 — Toujours deleguer aux agents specialises

**Ne JAMAIS produire un livrable à la place d'un agent spécialisé.** Un agent spécialisé lit les livrables amont, applique sa calibration métier, suit son protocole d'escalade, produit un handoff structuré. **Exceptions** : éditions techniques mineures, réponses questions utilisateur, opérations git, modifications project-context.md / CLAUDE.md.

## Règle absolue n5 — Mindset IA, pas équipe humaine

Calibrer sur la vélocité IA : sessions de quelques heures (pas sprints 2 semaines), V1 complète (pas MVP scope réduit), parallélisation par défaut, plan par dépendances (pas timeline). Ne jamais couper une feature "par manque de temps" — seule raison valide : pas de valeur pour le persona. **Automatisation contenu récurrent obligatoire** : tout contenu récurrent (blog, social, emails) doit inclure un workflow d'automatisation IA. Si hybride humain : adapter aux contraintes réelles.

## Stratégie de modèles

- **Opus** (`claude-opus-4-6`) : orchestrator, agent-factory, reviewer, elon, fullstack, ia, qa, infrastructure, moi
- **Sonnet** (`claude-sonnet-4-6`) : copywriter, creative-strategy, data-analyst, design, geo, growth, legal, product-manager, seo, social, ux

## Comment utiliser les agents

Agents dans `.claude/agents/`. Multi-domaine : `@orchestrator`. Tâche ciblée : agent direct.

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
| Tests / qualité | qa | fullstack, infrastructure |
| Revue croisée | reviewer | orchestrator |
| Juridique / conformité | legal | — |
| Roadmap / backlog | product-manager | creative-strategy |
| Création d'agents | agent-factory | ia, orchestrator |
| Audit stratégique | elon | orchestrator, reviewer |
| Décision fondateur | moi | orchestrator |

## Convention de chemin des livrables

```
docs/
├── strategy/    <- @creative-strategy    ├── product/     <- @product-manager
├── analytics/   <- @data-analyst         ├── ux/          <- @ux
├── design/      <- @design               ├── copy/        <- @copywriter
├── seo/         <- @seo                  ├── geo/         <- @geo
├── growth/      <- @growth               ├── social/      <- @social
├── legal/       <- @legal                ├── infra/       <- @infrastructure
├── ia/          <- @ia                   ├── qa/          <- @qa
├── reviews/     <- @reviewer + @elon
```

Exceptions : `@agent-factory` -> `.claude/agents/`, `@orchestrator` -> `docs/orchestration-plan.md` + `docs/project-synthesis.md`, `@fullstack` -> `src/` + optionnellement `docs/dev-decisions.md`.

## Règles communes a tous les agents (1-26)

1. Travailler en français (sauf code/noms techniques)
2. Lire `project-context.md` avant toute production
3. Lire le tableau "Historique des interventions agents" — ne jamais contredire une décision passee sans signaler
4. Zéro output générique — chaque livrable taille pour ce projet
5. Objectif : faire de ce projet le n1 de son secteur
6. Bloquer et signaler si contexte insuffisant
7. Terminer chaque livrable par un bloc Handoff standardise
8. En mode revision : justifier chaque changement, ne pas tout reecrire
9. Après chaque livrable : mettre à jour le tableau "Historique des interventions agents" avec justification
10. Respecter les règles anti-timeout (règle n3)
11. Objectif qualité : 100% gates PASS (voir `_gates.md`)
12. Mise à jour nom de branche obligatoire dans : `index.html`, `INSTALL.md`, `install.sh`, `update.sh`, `project-context.md`
13. **Caracteres UTF-8 dans le code.** Vrais caractères (e, e, a, c) dans strings JS/TS. Jamais `é` ni `&eacute;` dans les strings.
14. **Zéro concurrent par nom dans livrables client-facing.** Catégories génériques dans le code/copy/SEO. Exception : livrables internes (benchmarks, audits).
15. **Bloc "Sources amont" obligatoire** en tete de chaque livrable `docs/`. Format : `> Sources amont : docs/...`
16. **Volume bio calibré sur valeur persona (vitrines).** Max 4 phrases version RICHE, 2-3 INT, 1 MIN. Test de coupe : "si je retire cette phrase, le persona comprend-il encore la crédibilité ?"
17. **Chiffres narratifs vs factuels (vitrines).** OUI stats narratives (année, nombre participations). NON pourcentages juridiques bruts dans livrables client-facing.
18. **Zéro credential en clair dans fichiers commits.** Utiliser `.env.local` (gitignored). Si fuite dans historique git -> rotation obligatoire.
19. **Connectors natifs Claude AVANT setup MCP technique.** Vérifier `claude.com/connectors` en premier. 50+ outils en 1 clic OAuth.
20. **Noms fichiers/dossiers en ASCII pur.** Pas d'accents/emojis dans les chemins. Accents OK dans le contenu Markdown.
21. **Migration OAuth scope : déployer AVANT de re-authentifier.** Afficher le scope reçu sur la page de retour OAuth.
22. **Logs diagnostic : `console.warn` minimum** sur Replit/Vercel/Netlify. `console.log` est filtre par défaut.
23. **APIs a résultat vide silencieux : liste puis filtre local.** Logger la liste visible en WARN pour diagnostic.
24. **Dispatch webhook media : par MIME exhaustif, pas par type de message.** Router par MIME du document AVANT de tester le type. Lister tous les types par cas d'usage. Demander au fondateur "envoies-tu parfois en mode fichier / videos / audios ?".
25. **Telegram iOS strip les EXIF des photos HEIC.** Ne jamais sur-engineer l'extraction de données perdues à la source. Si un service externe altere les données avant arrivee backend : abandonner l'extraction, demander l'info à l'utilisateur via prompt UX.
26. **Zéro commit essai-erreur sans test local.** Avant tout push d'un fix sur un bug reproductible, tester en local sur le fichier/données qui foire. Si 2+ iterations sans succès -> STOP push, demander un sample, écrire un test, valider, PUIS pusher.

## Controle qualité — Système de gates binaires

Le système complet des 32 gates G1-G32 + gates testeur-persona GP1-GP10 + gates testeur-client GC1-GC10 est documente dans **`_gates.md`** à la racine. Chaque agent vise 100% gates BLOQUANT PASS + 100% gates REQUIS PASS.

## Protocole de test du framework

Projet test pré-configuré : `tests/project-context-test.md` (PulseBoard). 3 niveaux : test unitaire (1 agent), intégration (2-3 en chaîne), E2E (orchestration complète). Checklist post-test : project-context.md lu, zéro données inventées, hypothèses marquées, historique mis à jour, livrables dans le bon dossier.

## Mémoire organisationnelle

Après chaque session, l'orchestrateur met à jour `docs/lessons-learned.md` (format tableau v2, 11 colonnes). **Gate bloquante reprise** : propager les P0/P1 `non-propagés` AVANT tout nouveau travail. **Préférences fondateur** : copiées dans `docs/founder-preferences.md`. **Promotion gates** : gate ad-hoc en FAIL sur 3+ audits -> proposition promotion G33+. Détails complets dans `orchestrator.md`.

## Journal de setup

Voir `CHANGELOG.md`.
<!-- GRADIENT-AGENTS-END -->
