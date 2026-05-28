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

## Règles ISSA Capital (persistantes — survivent aux updates Gradient)

- **R1 (P0 #95, S14 ; +#119bis S23)** — **Vault Drive MCP = source de vérité unique** (`mcp__00415231-...__*`). Lire vault AVANT toute question Thomas ("toutes les réponses sont dans le vault"). **Avant d'AFFIRMER comment une zone du vault est organisée, lire son `_README.md` — jamais déduire la structure d'un seul dossier** (le repo ne contient PLUS de copie du vault : SOT = Drive uniquement).
- **R2 (P0 #98, S14)** — **Scanner MCP `mcp__*` proactivement en début de session**. Récidives : Gmail/Calendar S9, Asana/Craft S10, Drive S14.
- **R3 (P1 #96, S14)** — **TTL pendings interactifs ≥ 7 jours** (cartes Telegram, pending-store, validations Thomas). Jamais < 72h. Coût pending qui traîne << re-traitement.
- **R4 (P1 #97, S14)** — **Tout nouveau préfixe callback Telegram = (a) handler `handlers/<nom>.ts` + (b) dispatch `webhook/route.ts` + (c) test E2E**. Sinon cascade vers mauvais router. Gate G33 candidate.
- **R5 (P0 #99, S15 ; transport maj S23)** — **Édition fichier Drive existant = PATCH in-place** (`/upload/drive/v3/files/{fileId}?uploadType=media`) via le **MCP n8n** (l'ancien `_zap_raw_request` Zapier est OBSOLÈTE). JAMAIS create+delete : casse fileId, wikilinks Obsidian, partages. Le runtime Anya patche déjà ainsi (`drive-upload.ts`). Voir `docs/drive-edit-strategy.md`.
- **R6 (P1 #100, S15)** — **Batch vault Drive (n>1) : tester 1 fichier ET attendre validation Thomas (visuelle Obsidian) avant de lancer le batch**. Conclure "ça marche" après 1 test technique côté Drive = interdit. Lien leçon #93.
- **R7 (P1 #101, S15)** — **Source live (vault, API) remplace un hardcoded : retirer le hardcoded dans le MÊME jalon** (ou immédiatement après validation source live). Fallback runtime = `try/catch` → tableau vide, jamais copie statique. Pas de dette "au cas où".
- **R8 (P0 #108, S20)** — **API externe date/heure = prompt LLM instruit timezone explicite (jamais UTC implicite) + body API inclut `isAllDay` + `timeZone` IANA (ex `Europe/Paris`)**. Sinon tâches à minuit pile. Voir `parisLocalToTickTickFields` pattern.
- **R9 (P1 #109, S20)** — **Avant tout "fait" à Thomas : (a) lire 2-3 fichiers livrés, (b) run subset tests soi-même, (c) walkthrough 3-5 scénarios utilisateur**. Récap sous-agent ≠ garantie flow utilisateur. Si non testable E2E : signaler "non testé E2E, à valider en condition réelle".
- **R10+R11 (P0 #113+#114, S21)** — (a) **Verdict audit critique / bloquant / NO-GO / régression = ESCALADER bloqueur pré-prod, JAMAIS lister dans rapport** (le rapport = checklist d'actions, pas cimetière à trous). (b) **Sous-agents n'ont PAS accès aux tools `mcp__*`** : mission Drive/Gmail/Calendar = orchestrator OU inline le contenu MCP dans le prompt.
- **R12 (P0 #115-116, S21)** — **Pas de questions parasites à Thomas**. (a) Brief clair = décision immédiate, verbatim Thomas → appliquer + signaler, **JAMAIS d'options A/B/C**. (b) Diagnostic bug prod = scanner ses propres audits/rapports AVANT de questionner ; les indices sont déjà collectés. Récidives S21 : 3 options post-audit @ia/@qa/@reviewer alors que brief "vault = SOT" explicite ; puis 3 questions sur "Anya ne génère plus de PDF" alors que trou @ia #6 documentait la cause exacte.
- **R13 (P0 #126, S24)** — **Tout chantier ≥ 3 PRs liées DOIT déclencher un reviewer agent critique AVANT clôture de session** (focus bugs/races/edge cases/corruptions silencieuses). Le gate (tests + tsc + lint + build) ne capte ni les races, ni le YAML flow-style cassé, ni les tronc LLM silencieuses, ni les replies fantômes. Récidive S24 : 7 PRs #53-#59 livrées sans audit → Thomas demande "vérifie ni bug ni trou" → reviewer trouve 9 bugs réels → PR #60.
