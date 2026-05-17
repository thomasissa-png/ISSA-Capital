# Mémo de passation — Session 15

> Rédigé en clôture S14 (2026-05-17). Destiné à l'orchestrateur S15.

---

## État à la fin S14

- **Commit HEAD** : `f315a59` (branche `claude/issa-capital-s14-ttl-audit-ZQcQS`)
- **Tests verts** : 956 (856→956, +100 en S14)
- **TS clean** : 0 erreur `tsc --noEmit`
- **0 régression** : pipeline stable

### Jalons livrés S14 (ordre chronologique)

| Jalon | Commits | Description |
|---|---|---|
| 4A | (antérieurs) | TTL Anya 24h corrigé |
| 4B | (antérieurs) | Audit logs JSONL |
| 4C | (antérieurs) | Anonymisation tests (données réelles → fixtures) |
| 4D-1 | `ab7ac89` `5c2295f` `e6553ec` `f01c7bc` | Centralisation paths handlers (VAULT_PATHS) |
| 4D-1.5 | `a1e4a3d` | Fix critique vault-client paths (findContactByEmail jamais matché) |
| 4D-2 | `dfad7ae` `3b6cd5c` `5e443fd` `ab3b29f` `204c6f3` | No-match UX carte 5 boutons (Pro/Famille/Amis/Autres/Skip) |
| 4D-3 | `441142e` `0c690fd` | Prompt triage enrichi + cache amis + extractEmails Notes |
| Fix prod #1 | `e07eb0f` | Dispatch webhook `email_nomatch:` oublié dans Lot 2 |
| Fix prod #2 | `28a7e12` `f315a59` | TTL pending 24h→7j (usage humain week-end/vacances) |

**Total** : 15 commits S14, email-ingest V1 100% complète, 2 fixes production.

---

## Découverte clé S14 — MCP Drive accessible

Claude Code a accès au vault Drive de Thomas en direct via MCP Drive (`mcp__00415231-e65d-436c-84ee-f10eaab8da71__*`).

**Confirmé en lisant** : `Thomas Issa.md`, `Emmanuel Gomez.md`, `Léo Fanorenantsoa.md`, `Lucas Geoffroy.md`, `09. Administratif/_README.md`, `ISSA Capital/Documents/_README.md`.

### Implications architecturales

1. **Anya peut lire le vault en live** au lieu de dépendre de caches statiques (contacts-cache.ts, etc.)
2. **Migration cache→live planifiée en jalon 5D** : remplacer les appels `contacts-cache.ts` par des lectures MCP Drive directes
3. **Règle d'or** : ne JAMAIS demander à Thomas une info présente dans le vault. Lire d'abord, demander seulement si absent.
4. **Anti-pattern Thomas** (verbatim) : "tes questions m'ennuient car toutes les réponses sont dans le vault"

---

## TODOs résiduels Thomas

| # | Action | Statut | Bloquant pour |
|---|---|---|---|
| 1 | Copier-coller la section Tonalité dans `Thomas Issa.md` (contenu rédigé S14, présenté à Thomas) | En attente action manuelle Thomas | Jalon 5B (drafts) |
| 2 | Re-test E2E pipeline email-ingest avec fix TTL `f315a59` | En attente confirmation Thomas | Validation prod fix #2 |
| 3 | Encadrement loyers EUR/m2 (Nanterre + Paris 18) — depuis S12 | En attente | Bail conforme |
| 4 | Arbitrage IRL : API INSEE auto OU saisie trimestrielle — depuis S12 | En attente | Bail conforme |

---

## Roadmap S15 détaillée

### 5A — Webhook Gmail temps réel via Google Pub/Sub

**Objectif** : remplacer le polling/CLI `ingest-gmail` par un webhook push temps réel.

**Sous-jalons** :
1. Créer un topic Pub/Sub GCP (`projects/[id]/topics/gmail-push`)
2. Configurer `users.watch()` sur le Gmail de Thomas (labels ciblés : INBOX)
3. Endpoint `/api/secretariat/gmail-webhook` qui reçoit les notifications Pub/Sub
4. Déclencher `runEmailIngest()` à chaque notification (avec déduplication messageId)
5. Rangement PJ : lire le `_README.md` du dossier vault cible via MCP Drive pour connaître la convention de nommage, puis uploader la PJ avec le bon nom

**Estimation** : 2-3h dev + tests

**Attention** : Google Pub/Sub est gratuit < 10 Go/mois mais vérifier s'il exige un billing account (pref fondateur S13). Si oui → alternative : continuer avec cron polling toutes les 5 min via Replit scheduled task.

### 5B — Draft de réponse Gmail systématique

**Objectif** : Anya crée un brouillon Gmail (`drafts.create`) pour chaque email entrant qui mérite réponse.

**Sous-jalons** :
1. Ajouter scope `gmail.compose` au OAuth existant (re-OAuth Thomas nécessaire)
2. Module `draft-composer.ts` : prend l'email source + fiche contact (via MCP Drive ou cache) + tonalité Thomas → génère un brouillon
3. Tonalité : lire champ Tu/Vous + registre dans la fiche contact. Fallback → fiche `Thomas Issa.md` section Tonalité
4. Modèle LLM : Sonnet 4.6 (rédaction texte structuré, pas extraction JSON)
5. Notification Telegram : "Draft prêt pour [expéditeur] — [1ère ligne]" avec bouton "Voir dans Gmail"
6. Thomas review le draft dans Gmail, modifie si besoin, envoie manuellement

**Estimation** : 3-4h dev + tests

**Dépendance** : TODO #1 Thomas (section Tonalité dans sa fiche) pour la calibration tonalité de fallback.

### 5C — Tâche TickTick si action requise

**Objectif** : quand le triage détecte `action_required: true`, Anya crée une tâche dans TickTick (lié au Gmail Thomas).

**Sous-jalons** :
1. Explorer l'API TickTick (ou vérifier si MCP/connecteur natif disponible)
2. Module `ticktick-client.ts` : `createTask(title, dueDate?, description?)`
3. Intégration dans le handler email-ingest : si `action_required` → créer tâche avec sujet email + lien
4. Notification Telegram optionnelle : "Tâche créée : [titre]"

**Estimation** : 1-2h dev + tests

**Question ouverte** : TickTick a-t-il une API publique accessible par clé API simple ? Sinon, vérifier connecteur MCP natif dans Claude.

### 5D — Migration cache statique vers lecture vault live via MCP Drive

**Objectif** : remplacer progressivement les modules de cache (`contacts-cache.ts`, listes hardcodées dans `triage-v1.md`) par des lectures MCP Drive directes.

**Sous-jalons** :
1. Identifier tous les points du code qui lisent le cache contacts (Grep `contacts-cache`)
2. Créer un module `vault-reader.ts` qui encapsule les appels MCP Drive avec fallback cache
3. Migrer `findContactByEmail` → lecture live (avec cache TTL 1h pour perf)
4. Migrer la liste locataires/contacts-pro du prompt triage → lecture live de l'index vault
5. Supprimer les fichiers de cache devenus redondants
6. Tests de non-régression : vérifier que le triage et le matching restent 100% (matrice confusion)

**Estimation** : 4-6h dev + tests (migration progressive, pas big bang)

**Risque** : latence MCP Drive en prod. Mitigation : conserver un cache TTL 1h en lecture-through (lire MCP, stocker en mémoire 1h, re-lire si TTL expiré).

---

## Questions ouvertes pour Thomas (S15)

> Maximum 3 questions. UNIQUEMENT celles dont la réponse n'est PAS dans le vault.

1. **TickTick API** : ton compte TickTick est-il lié à ton Gmail (`thomas.issa@gmail.com`) ? As-tu un accès API/token ou faut-il passer par un connecteur OAuth ?
2. **Google Pub/Sub** : pour le webhook Gmail temps réel, Pub/Sub nécessite potentiellement un projet GCP avec billing. Préfères-tu (A) tester Pub/Sub gratuit, (B) rester sur polling cron toutes les 5 min, ou (C) autre solution ?
3. **Priorité S15** : dans quel ordre préfères-tu les jalons ? Mon estimation par impact : 5B (drafts) > 5A (temps réel) > 5D (vault live) > 5C (TickTick). D'accord ou tu réordonnes ?

---

## Premier message orchestrateur S15

```
@orchestrator — Session S15 : Anya temps réel + drafts + vault live

Branche S14 : `claude/issa-capital-s14-ttl-audit-ZQcQS` (HEAD `f315a59`, 956 tests).

Contexte rapide :
- Email-ingest V1 COMPLÈTE (956 tests, 0 régression)
- Découverte S14 : MCP Drive accessible en live (vault = source de vérité)
- 2 fixes prod livrés (dispatch webhook + TTL 7j)

Roadmap S15 (4 jalons, détails dans `docs/session-memo-s15.md`) :
- 5A — Webhook Gmail temps réel (Pub/Sub ou cron polling)
- 5B — Draft réponse Gmail systématique (tonalité fiche contact)
- 5C — Tâche TickTick si action requise
- 5D — Migration cache → lecture vault live MCP Drive

TODOs Thomas en attente :
1. Section Tonalité copiée dans `Thomas Issa.md` ? (bloquant 5B)
2. Re-test pipeline email-ingest avec TTL 7j confirmé ?

Questions pour toi (3 max, réponses pas dans le vault) :
1. TickTick : API accessible ? Token existant ?
2. Pub/Sub : OK billing GCP ou préfère cron polling 5 min ?
3. Priorité jalons : 5B > 5A > 5D > 5C — d'accord ?

Commence par lire le vault via MCP Drive (règle S14 : vault d'abord, questions ensuite).
```
