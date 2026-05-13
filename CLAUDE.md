<!-- GRADIENT-AGENTS-START -->
# Gradient Agents — Instructions globales

## Regle absolue n1 — Contexte obligatoire

Avant toute action, lire `project-context.md` a la racine. S'il est absent : STOP, afficher le template. Ne jamais commencer sans contexte projet valide.

## Quick Start

1. Remplis `project-context.md` (template dans `templates/`)
2. `@orchestrator lance mon projet`
3. Reponds aux questions des agents.

> **Installation :** voir `INSTALL.md`.

## Regle absolue n2 — Zero invention de donnees

**Ne JAMAIS inventer une donnee manquante.** Signaler explicitement, demander a l'utilisateur. Hypotheses acceptables uniquement si : (a) autorisation explicite, (b) marquees `[HYPOTHESE : ...]`, (c) 2-3 options proposees, (d) listees en fin de document. **Faits biographiques/dates** : source de verite unique dans project-context.md, verification fondateur obligatoire avant propagation, `[HYPOTHESE]` si deduit d'une source publique.

## Regle absolue n3 — Anti-timeout

Un agent qui essaie de tout produire en une passe sera coupe. Regles :
1. **Un fichier = un appel Write/Edit.** Jamais plusieurs fichiers dans un bloc.
2. **Decouper les gros livrables.** Si >150 lignes, ecrire en plusieurs Edit (section par section).
3. **Prioriser le contenu critique en premier.** Si timeout, l'essentiel est sauvegarde.
4. **Sauvegarder au fur et a mesure.** Ne jamais accumuler en memoire sans ecrire.
5. **Signaler les livrables multi-fichiers.** Si >3 fichiers, annoncer l'ordre.

**Orchestrateur** : max 3 Task par message, decouper par phase, preferer 3 messages courts a 1 geant.
**Agents contenu** : ecrire structure d'abord, remplir section par section. Jamais >100 lignes en un Write.
**Agents code** : un composant/fichier par appel Write. Fondations (types, config) avant dependants.
**Compteur session** : ALERTE ROUGE apres 6 phases / 18 Task producteurs (voir orchestrator.md).

## Regle absolue n4 — Toujours deleguer aux agents specialises

**Ne JAMAIS produire un livrable a la place d'un agent specialise.** Un agent specialise lit les livrables amont, applique sa calibration metier, suit son protocole d'escalade, produit un handoff structure. **Exceptions** : editions techniques mineures, reponses questions utilisateur, operations git, modifications project-context.md / CLAUDE.md.

## Regle absolue n5 — Mindset IA, pas equipe humaine

Calibrer sur la velocite IA : sessions de quelques heures (pas sprints 2 semaines), V1 complete (pas MVP scope reduit), parallelisation par defaut, plan par dependances (pas timeline). Ne jamais couper une feature "par manque de temps" — seule raison valide : pas de valeur pour le persona. **Automatisation contenu recurrent obligatoire** : tout contenu recurrent (blog, social, emails) doit inclure un workflow d'automatisation IA. Si hybride humain : adapter aux contraintes reelles.

## Strategie de modeles

- **Opus** (`claude-opus-4-6`) : orchestrator, agent-factory, reviewer, elon, fullstack, ia, qa, infrastructure, moi
- **Sonnet** (`claude-sonnet-4-6`) : copywriter, creative-strategy, data-analyst, design, geo, growth, legal, product-manager, seo, social, ux

## Comment utiliser les agents

Agents dans `.claude/agents/`. Multi-domaine : `@orchestrator`. Tache ciblee : agent direct.

| Type de demande | Agent principal | Agents secondaires |
|---|---|---|
| Nouveau projet complet | orchestrator | tous |
| Strategie / positionnement | creative-strategy | product-manager |
| Code / developpement | fullstack | qa, infrastructure, ia |
| Interface visuelle | design | ux |
| Parcours utilisateur | ux | design, copywriter |
| Contenu / texte | copywriter | seo, geo |
| Referencement | seo | geo, copywriter |
| Visibilite IA | geo | seo |
| Performance / deploiement | infrastructure | fullstack |
| Integration LLM / IA | ia | fullstack, infrastructure |
| Analytics / mesure | data-analyst | product-manager |
| Acquisition / croissance | growth | social, data-analyst |
| Reseaux sociaux | social | copywriter, creative-strategy |
| Tests / qualite | qa | fullstack, infrastructure |
| Revue croisee | reviewer | orchestrator |
| Juridique / conformite | legal | — |
| Roadmap / backlog | product-manager | creative-strategy |
| Creation d'agents | agent-factory | ia, orchestrator |
| Audit strategique | elon | orchestrator, reviewer |
| Decision fondateur | moi | orchestrator |

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

## Regles communes a tous les agents (1-26)

1. Travailler en francais (sauf code/noms techniques)
2. Lire `project-context.md` avant toute production
3. Lire le tableau "Historique des interventions agents" — ne jamais contredire une decision passee sans signaler
4. Zero output generique — chaque livrable taille pour ce projet
5. Objectif : faire de ce projet le n1 de son secteur
6. Bloquer et signaler si contexte insuffisant
7. Terminer chaque livrable par un bloc Handoff standardise
8. En mode revision : justifier chaque changement, ne pas tout reecrire
9. Apres chaque livrable : mettre a jour le tableau "Historique des interventions agents" avec justification
10. Respecter les regles anti-timeout (regle n3)
11. Objectif qualite : 100% gates PASS (voir `_gates.md`)
12. Mise a jour nom de branche obligatoire dans : `index.html`, `INSTALL.md`, `install.sh`, `update.sh`, `project-context.md`
13. **Caracteres UTF-8 dans le code.** Vrais caracteres (e, e, a, c) dans strings JS/TS. Jamais `é` ni `&eacute;` dans les strings.
14. **Zero concurrent par nom dans livrables client-facing.** Categories generiques dans le code/copy/SEO. Exception : livrables internes (benchmarks, audits).
15. **Bloc "Sources amont" obligatoire** en tete de chaque livrable `docs/`. Format : `> Sources amont : docs/...`
16. **Volume bio calibre sur valeur persona (vitrines).** Max 4 phrases version RICHE, 2-3 INT, 1 MIN. Test de coupe : "si je retire cette phrase, le persona comprend-il encore la credibilite ?"
17. **Chiffres narratifs vs factuels (vitrines).** OUI stats narratives (annee, nombre participations). NON pourcentages juridiques bruts dans livrables client-facing.
18. **Zero credential en clair dans fichiers commits.** Utiliser `.env.local` (gitignored). Si fuite dans historique git -> rotation obligatoire.
19. **Connectors natifs Claude AVANT setup MCP technique.** Verifier `claude.com/connectors` en premier. 50+ outils en 1 clic OAuth.
20. **Noms fichiers/dossiers en ASCII pur.** Pas d'accents/emojis dans les chemins. Accents OK dans le contenu Markdown.
21. **Migration OAuth scope : deployer AVANT de re-authentifier.** Afficher le scope recu sur la page de retour OAuth.
22. **Logs diagnostic : `console.warn` minimum** sur Replit/Vercel/Netlify. `console.log` est filtre par defaut.
23. **APIs a resultat vide silencieux : liste puis filtre local.** Logger la liste visible en WARN pour diagnostic.
24. **Dispatch webhook media : par MIME exhaustif, pas par type de message.** Router par MIME du document AVANT de tester le type. Lister tous les types par cas d'usage. Demander au fondateur "envoies-tu parfois en mode fichier / videos / audios ?".
25. **Telegram iOS strip les EXIF des photos HEIC.** Ne jamais sur-engineer l'extraction de donnees perdues a la source. Si un service externe altere les donnees avant arrivee backend : abandonner l'extraction, demander l'info a l'utilisateur via prompt UX.
26. **Zero commit essai-erreur sans test local.** Avant tout push d'un fix sur un bug reproductible, tester en local sur le fichier/donnees qui foire. Si 2+ iterations sans succes -> STOP push, demander un sample, ecrire un test, valider, PUIS pusher.

## Controle qualite — Systeme de gates binaires

Le systeme complet des 32 gates G1-G32 + gates testeur-persona GP1-GP10 + gates testeur-client GC1-GC10 est documente dans **`_gates.md`** a la racine. Chaque agent vise 100% gates BLOQUANT PASS + 100% gates REQUIS PASS.

## Protocole de test du framework

Projet test pre-configure : `tests/project-context-test.md` (PulseBoard). 3 niveaux : test unitaire (1 agent), integration (2-3 en chaine), E2E (orchestration complete). Checklist post-test : project-context.md lu, zero donnees inventees, hypotheses marquees, historique mis a jour, livrables dans le bon dossier.

## Memoire organisationnelle

Apres chaque session, l'orchestrateur met a jour `docs/lessons-learned.md` (format tableau v2, 11 colonnes). **Gate bloquante reprise** : propager les P0/P1 `non-propages` AVANT tout nouveau travail. **Preferences fondateur** : copiees dans `docs/founder-preferences.md`. **Promotion gates** : gate ad-hoc en FAIL sur 3+ audits -> proposition promotion G33+. Details complets dans `orchestrator.md`.

## Journal de setup

Voir `CHANGELOG.md`.
<!-- GRADIENT-AGENTS-END -->
