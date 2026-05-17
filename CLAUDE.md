<!-- GRADIENT-AGENTS-START -->
# Gradient Agents — 7 commandements

Chaque ligne de ce fichier coûte des tokens sur CHAQUE agent. Ne contient QUE les règles universelles.
Détails, gates, protocoles : voir `_base-agent-protocol.md`. Référence gates : voir `_gates.md`.

## 1. Contexte obligatoire

Avant toute action, lire `project-context.md`. S'il est absent : s'arrêter et demander à l'utilisateur de le remplir. Ne jamais commencer sans contexte validé.

## 2. Zéro invention de données

Ne JAMAIS inventer une donnée manquante. Signaler le manque, demander à l'utilisateur. Hypothèses acceptables uniquement si marquées `[HYPOTHÈSE : ...]` avec autorisation.

## 3. Écris d'abord, optimise ensuite (anti-timeout)

Le timeout vient d'un agent qui **lit trop avant d'écrire**. Règles :
- Max 10-15 Read/Grep avant le premier Write
- Write le squelette immédiatement, Edit les détails ensuite
- Max ~150 lignes par Write, sauvegarder au fur et à mesure
- Un fichier = un appel Write. Jamais plusieurs fichiers d'un coup

**Chaque prompt de lancement de sous-agent DOIT inclure** : `ANTI-TIMEOUT : écris le fichier IMMÉDIATEMENT après lecture. Write d'abord, Edit ensuite.`

## 4. Toujours déléguer aux agents spécialisés

Ne JAMAIS produire un livrable à la place d'un agent. Invoquer l'agent via `subagent_type`. Exceptions : éditions mineures, réponses aux questions, opérations git, modifications de project-context.md.

## 5. Mindset IA, pas équipe humaine

Calibrer sur la vélocité IA : V1 complète (pas MVP), parallélisation par défaut, plan par dépendances (pas sprints), ne jamais couper une feature "par manque de temps". Automatiser tout contenu récurrent. **Verdicts GO/NO-GO basés VALEUR persona, pas ROI/payback/effort humains** (un projet à valeur utilisateur élevée mais ROI négatif court terme = GO POC, pas NO-GO).

Exception : si project-context.md mentionne une équipe humaine, adapter la calibration.

## 6. Pre-commit build check

Avant tout commit de code dans `src/` :
```bash
npx tsc --noEmit && npx next lint && npm run build
```
Si échec : corriger d'abord, ne PAS commiter.

## 7. Anti-inflation de ce fichier

Seuil dur : **125 lignes max** (enforced par hook pre-commit). Avant d'ajouter une ligne, se demander : "concerne-t-elle TOUS les agents ?" Si non → `_base-agent-protocol.md` ou l'agent concerné.

## 8. Conservation of rules (net-zero par session)

Pour toute règle/learning ajouté en fin de session, une obsolète doit être supprimée ou fusionnée. Le framework grossit en valeur, pas en lignes. **Caps actifs** : `lessons-learned.md` 80L, `project-context.md` 250L hors historique (archiver entrées historique > 5 sessions vers `project-context-archive.md`), `CLAUDE.md` 125L. **TTL learnings** : 5 sessions OU 90 jours (le plus court) → promote en règle ou archive. **P0 jamais archivés automatiquement** (garde-fous silencieux). L'historique git garde tout, on ne perd rien.

---

## Règles communes (condensé)

1. Travailler en français (sauf code)
2. Lire project-context.md + historique des interventions avant toute production
3. Zéro output générique — taillé pour CE projet
4. Handoff structuré obligatoire en fin de livrable
5. Mettre à jour l'historique des interventions après chaque livrable
6. Respecter les règles anti-timeout (commandement 3)
7. Objectif qualité : 100% gates PASS (32 gates G1-G32, voir `_gates.md`)
8. UTF-8 dans le code (é, è, à — jamais `\u00E9`)
9. Zéro mention de concurrent par nom dans les livrables client-facing
10. Actions Replit dans `REPLIT_ACTIONS.md` si modification code/config
11. Emails client-facing = brouillons obligatoires (jamais envoi direct)
12. Après tout renommage global (repo, branche par défaut, domaine, nom de projet), Grep l'ancien nom dans tous les fichiers et remplacer

## Routage agents

| Demande | Agent principal |
|---|---|
| Projet complet | @orchestrator |
| Code / dev | @fullstack |
| Stratégie | @creative-strategy |
| Specs / roadmap | @product-manager |
| UX / parcours | @ux |
| Design / UI | @design |
| Contenu / texte | @copywriter |
| SEO | @seo |
| Visibilité IA | @geo |
| Analytics | @data-analyst |
| Acquisition | @growth |
| Social media | @social |
| Vente | @sales-enablement |
| Tests / QA | @qa |
| Infrastructure | @infrastructure |
| IA / LLM | @ia |
| Juridique | @legal |
| Review qualité | @reviewer |
| Audit stratégique | @elon |
| Proxy fondateur | @moi |
| Créer un agent | @agent-factory |

Agents dans `.claude/agents/`. Multi-domaine → @orchestrator. Tâche ciblée → agent directement.

## Modèles

- **Opus** : orchestrator, agent-factory, reviewer, elon, fullstack, ia, qa, infrastructure, moi
- **Sonnet** : copywriter, creative-strategy, data-analyst, design, geo, growth, legal, product-manager, seo, social, ux

## Références

- Protocoles communs, conventions de chemin, mémoire organisationnelle : `_base-agent-protocol.md`
- Gates binaires G1-G32 + GP/GC + verdicts : `_gates.md`
- Protocole de test du framework : `_base-agent-protocol.md` section "Test du framework"
- Préférences fondateur : `docs/founder-preferences.md`
- Historique des sessions : `CHANGELOG.md`
<!-- GRADIENT-AGENTS-END -->

---

## Règles spécifiques ISSA Capital (persistantes — survivent aux updates Gradient)

### R1 — MCP Drive = source de vérité (P0 #95, S14)

Le vault Drive de Thomas est accessible en live via MCP Drive (`mcp__00415231-e65d-436c-84ee-f10eaab8da71__*`).

**Anti-pattern Thomas verbatim** : "tes questions m'ennuient car toutes les réponses sont dans le vault".

**Règle** : avant TOUTE question à Thomas, lire le vault Drive via MCP. Si l'info n'est PAS dans le vault → alors seulement demander. Le vault est la source de vérité unique pour : contacts, fiches, README, structure, documents, conventions de nommage.

Migration cache statique → lecture live planifiée en jalon 5D.

### R2 — Scan MCP en début de session (P0 #98, S14)

En début de chaque session, scanner les MCP disponibles (outils `mcp__*`) et vérifier lesquels donnent accès à des données pertinentes pour le projet. Ne PAS attendre que Thomas signale un MCP — le scanner proactivement. 3 récidives antérieures (Gmail/Calendar S9, Asana/Craft S10, Drive S14).

### R3 — TTL pendings interactifs : minimum 7 jours (P1 #96, S14)

Tout état interactif que Thomas doit valider manuellement (cartes Telegram, pending-store, prompts de validation) : TTL minimum **7 jours**. Pas de TTL < 72h sur un état que Thomas doit valider. Usage humain = week-ends, vacances, imprévus. Le coût d'un pending expiré (re-traitement) >> coût d'un pending qui traîne.

### R4 — Checklist intégration callback Telegram (P1 #97, S14)

Tout nouveau préfixe de callback Telegram DOIT suivre cette checklist **avant commit** :
1. Handler créé (`handlers/<nom>.ts`)
2. Dispatch ajouté dans `webhook/route.ts` (matching prefix → handler)
3. Test E2E callback → handler (simuler le callback, vérifier le dispatch)

Si un des 3 est manquant → le callback tombe en cascade dans un mauvais router (bug prod S14 `email_nomatch:`).

**Gate candidate G33** : "Tout callback Telegram dispatché correctement" — BLOQUANT si code Telegram modifié.
