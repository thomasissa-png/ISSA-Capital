# TickTick — Gap Analysis & Plan S20

> Audit code repo vs spec vault `08. Outils/Anya/Skills/Workflow Todo.md` (SOT).
> Produit : 2026-05-22. Scope : combler les manques pour faire de TickTick le hub unique create-only et de `Todo.md` un miroir read-only.

## 0. Découverte majeure (avant de lire la suite)

Le repo contient **DEUX systèmes TickTick parallèles** :

1. **`src/lib/secretariat/ticktick/`** (S15) — client CRUD + OAuth + polling 15min (logger only). Aligné philosophie du SOT.
2. **`src/lib/secretariat/ticktick-sync/`** (S18) — moteur **bidirectionnel** vault ↔ TickTick avec push-engine, pull-engine, vault-scanner, state-store, audit-log, conflict resolver last-write-wins. **Traite `Todo.md` comme source de vérité**, scanne aussi les tâches inline dans tout `.md` du vault.

**Le système S18 (`ticktick-sync/`) est directement incompatible avec le SOT Workflow Todo.md** : il PATCH `Todo.md` dans les deux sens (push vault→TT et pull TT→vault sous `## Inbox`), avec un conflict resolver canonique vault. Or le SOT impose `Todo.md` = miroir read-only régénéré depuis TickTick.

→ **C'est presque certainement la cause de "TickTick ne marche pas super"** : deux crons (`cron-ticktick-sync-pull` toutes les 5min + `cron-ticktick-sync-push` toutes les 5min + `cron-ticktick-poll` toutes les 15min) modifient le vault et créent des tâches TT en double, avec verrou syncLock seulement à l'intérieur du couple push/pull S18. Le poll S15 ne sait rien des deux autres.

## 1. Code existant — inventaire factuel

### 1.1 Système S15 (`src/lib/secretariat/ticktick/`)

| Fichier | Rôle | État |
|---|---|---|
| `ticktick-client.ts` | CRUD : createTask, getTask, updateTask, completeTask, listTasks, listProjects. Auth via `getTickTickAccessToken()`. | OK, utilisé partout. |
| `oauth.ts` | Flow OAuth + refresh token. | OK. |
| `poll.ts` | Pipeline `pollTickTickTasks()` : list → diff snapshot → events (`task.completed`, `task.updated`, `task.created.external`) → handler `logEvent` → save snapshot. Snapshot dans `/home/runner/issa-data/ticktick-snapshot.json`. | **Logger only** (poll.ts:249 commentaire ligne 12-14 : "Pour l'instant, les handlers loguent uniquement"). |
| `ical-export.ts` | Export iCal des tâches TT. | OK. |
| `types.ts` | Types TickTickTask, TickTickProject, CreateTaskInput, UpdateTaskInput. | OK. |

Cron associé : `.github/workflows/cron-ticktick-poll.yml` → toutes les 15min → `GET /api/secretariat/ticktick/cron-poll`.

### 1.2 Système S18 (`src/lib/secretariat/ticktick-sync/`) — **À démanteler**

| Fichier | Rôle | Verdict SOT |
|---|---|---|
| `vault-scanner.ts` | Scanne `Todo.md` + inline `- [ ]` dans tout le vault (sauf dossiers exclus + frontmatter `hide-tcw`). | **INCOMPATIBLE** : vault ≠ source. |
| `parser.ts` | Parse ligne markdown → VaultTask (filtre `#hide-tcw` red line §9.6 spec S18). | À conserver pour lecture, pas pour push. |
| `serializer.ts` | VaultTask → ligne markdown (réversible). | **À réutiliser** pour régénérer `Todo.md` miroir. |
| `push-engine.ts` | scan vault → diff hash state → POST TickTick (create/update/complete/delete). | **À SUPPRIMER** : viole SOT (vault ne pousse plus). |
| `pull-engine.ts` | fetch TT → reverse-lookup state → PATCH `Todo.md` ligne par ligne, AJOUT sous `## Inbox` pour tâches mobiles, completion silencieuse `[ ] → [x]`. | **À remplacer** par régénération full du fichier (pas PATCH ligne par ligne). |
| `state-store.ts` | State JSON `vaultLineHash ↔ ticktickId ↔ lastSyncedAt`, syncLock TTL 30s. | À conserver mais réduit (juste cache projectId + dernière régénération). |
| `hasher.ts` | hashLine pour détecter MODIFIED. | Inutile une fois push supprimé. |
| `project-manager.ts` | Mapping vault list → TickTick projectId. | À conserver. |
| `audit-log.ts` | JSONL audit. | À conserver, utile pour debug régénération. |
| `ical-feed-reunions.ts` | Feed iCal des réunions. | Hors scope SOT, ne pas toucher. |

Crons associés : `cron-ticktick-sync-push.yml` (5min) + `cron-ticktick-sync-pull.yml` (5min, offset 30s). **À neutraliser**.

### 1.3 Email → TickTick (`email-ingest/ticktick-integration.ts`)

`createTickTickTaskForEmail(email, triage)` : skip si spam, skip si pas d'OAuth, mapping catégorie→priority (locataire=5, candidat/contact-pro/apporteur=3, a-classifier=1), tag `anya-${category}`, titre préfixé `[Email] `. Description = résumé triage + From + catégorie + confiance + lien Gmail. **Non-bloquant** (catch silencieux côté caller). → **OK, modèle à reproduire pour Telegram & Plaud.**

### 1.4 Telegram webhook (`src/app/api/telegram/webhook/route.ts`)

Webhook conversationnel Sonnet 4 multi-tours déjà en place : workflows quittance/bail/fin-de-bail/candidat, inbox text/voice/document, conversation-store, photos batch, workflows registry. **Aucune intent "ajoute tâche" aujourd'hui.** Point d'extension naturel : ajouter un workflow `todo` dans `workflows/registry.ts` ou un handler inline détecté par le system prompt Sonnet.

### 1.5 Plaud / `traite-inbox`

`Grep` "Plaud|traite-inbox" → 1 seul match : `vault-paths.ts` (juste un chemin). **La skill `traite-inbox` § 3.11 vit côté vault Drive uniquement**, pas dans le repo. Donc le rebranchement se fera en modifiant la skill (note vault) pour qu'elle appelle `createTask` au lieu d'écrire dans `Todo.md`. Pas de code repo à toucher *a priori* — sauf si on veut un endpoint dédié `/api/secretariat/inbox/plaud` qui prend un transcript et crée N tâches (recommandé pour audit).

## 2. Écart spec ↔ impl

| Brique SOT Workflow Todo.md | État code réel | Verdict |
|---|---|---|
| Email → TickTick (create-only) | `email-ingest/ticktick-integration.ts:53` | OK |
| Telegram → TickTick (dictée) | Aucun code | À FAIRE |
| Plaud → TickTick (action items) | Skill écrit dans `Todo.md` (§3.11 vault) | À REBRANCHER |
| TickTick natif (Thomas direct) | N/A code, OK par design | OK |
| `Todo.md` = miroir read-only régénéré | Au contraire : poussé vers TT + patché par TT | **CONFLIT MAJEUR** |
| Poll 15min régénère `Todo.md` | `poll.ts:249` logger only | À FAIRE |
| Tag `anya-*` sur tâches Anya | Email OK (`anya-${category}`), Telegram/Plaud absent | À PROPAGER |
| Tag `#hide-tcw` ignoré pour TickTick | `parser.ts` le filtre côté push S18 | Devient sans objet une fois push S18 supprimé |
| Idempotence création | Email : pas de dédup explicite | À CLARIFIER (cf §5) |

## 3. Plan d'implémentation S20 — par ordre de valeur

### 3.1 PRIORITÉ 1 — Neutraliser le push S18 (urgent, 2h)

**Pourquoi en premier** : tant que `cron-ticktick-sync-push` tourne, chaque modif locale de `Todo.md` (incluant les régénérations futures) re-pousse vers TT → boucles & doublons.

- Désactiver `.github/workflows/cron-ticktick-sync-push.yml` (commenter le `schedule:` + ajouter commentaire R5/S20).
- Désactiver `.github/workflows/cron-ticktick-sync-pull.yml` (idem — sera remplacé par la régénération miroir).
- Conserver le code `push-engine.ts` / `pull-engine.ts` un cycle (S20) avec un kill switch `TICKTICK_SYNC_LEGACY_DISABLED=1` env var, puis suppression S21.
- Endpoints `/api/secretariat/ticktick-sync/cron-pull|push` : retourner `{ ok: true, disabled: true }` sans exécuter.

**Estimation** : 2h (changements YAML + env flag + tests verts).

### 3.2 PRIORITÉ 2 — Régénération miroir `Todo.md` depuis TickTick (1j)

**Où** : nouveau module `src/lib/secretariat/ticktick/mirror-renderer.ts` + branchement dans `poll.ts`.

**Algo** :
1. `pollTickTickTasks()` (existe) → récupère toutes les tâches actives.
2. Filtrer : `status !== 2` (pas complétées) ET pas dans projet "archive" éventuel.
3. Grouper par projectId → sections markdown (titre = nom projet TickTick via `listProjects()`).
4. Pour chaque tâche : sérialiser via `serializer.ts` réutilisé (déjà existant, S18).
5. Composer le fichier complet avec en-tête :
   ```
   <!-- AUTO-GENERATED depuis TickTick. NE PAS ÉDITER. Régénéré toutes les 15min. -->
   <!-- Dernière régénération : 2026-05-22T10:15:00Z. Source : TickTick API. -->
   ```
6. PATCH in-place sur Drive (R5 `_zap_raw_request` → `/upload/drive/v3/files/{fileId}?uploadType=media`).
7. `fileId` : récupéré via `vault-reader` / `vault-client/drive-resolver` (déjà existant).
8. Idempotence : hasher le contenu généré, comparer avec dernier hash en state, no-op si identique.

**Décisions à câbler** :
- Fréquence : aligner sur poll 15min (réutilise cron existant) ou plus rapide ? cf §5.
- Ordonnancement intra-section : par dueDate asc puis priority desc.
- Tâches sans projet : section `## Inbox` en tête.

**Estimation** : 1j (module + tests + branchement + validation R6 sur 1 fichier avant batch).

### 3.3 PRIORITÉ 3 — Telegram → TickTick (1j)

**Où** : nouveau handler `src/lib/secretariat/handlers/todo-from-telegram.ts` + intent ajouté dans le system prompt du webhook Telegram (`route.ts:~30`).

**Algo** :
1. Étendre le system prompt Sonnet 4 avec une intent supplémentaire (en plus de cr/quittance/bail/etc.) : `add_task` → structured output `{ title, dueDate?: ISO, priority?: 0|1|3|5, projectName?: string }`.
2. Si Sonnet renvoie `add_task` → handler `handleAddTaskFromTelegram(parsed, chatId)`.
3. Handler : `createTask({ title, dueDate, priority, projectId: resolveProjectIdByName(projectName), tags: ['anya-telegram'] })`.
4. Réponse Telegram avec carte de confirmation : `✅ Tâche créée : "{title}" — échéance {date} — priorité {label}`. Bouton inline `Annuler` (TTL ≥ 7 jours **R3**) → `completeTask` ou delete (TickTick ne supporte pas vraiment delete via API publique, voir §5).
5. Préfixe callback `task_` : créer `handlers/task.ts` + dispatch dans `webhook/route.ts` (**R4**).

**Estimation** : 1j (prompt + handler + Telegram card + test E2E + R4 dispatch).

### 3.4 PRIORITÉ 4 — Plaud → TickTick rebrancher (4h repo + édition vault)

**Où** :
- **Vault** : éditer `08. Outils/Anya/Skills/Plaud Skill.md` (ou skill `traite-inbox` § 3.11) — main agent via MCP, R5 PATCH in-place.
- **Repo** (optionnel mais recommandé) : nouveau endpoint `POST /api/secretariat/inbox/plaud` qui reçoit `{ transcript, sourceWikilink }` et créé N tâches.

**Algo handler** :
1. Parser transcript Plaud → extraction action items via Sonnet 4 structured output : `[{ title, dueDate?, priority? }]`.
2. Pour chaque action item : `createTask({ title, dueDate, priority, tags: ['anya-plaud'], desc: 'Source : [[wikilink]] (rendu plat, TickTick ne stocke pas les wikilinks)' })`.
3. Description : conserver le wikilink Obsidian sous forme texte `[[Note]]` — quand on régénérera `Todo.md` depuis TT, le wikilink redeviendra cliquable.
4. Idempotence : hash transcript + dédup par titre + sourceWikilink dans state-store (sinon re-traitement = doublons).

**Estimation** : 4h (handler + endpoint + tests) + édition vault skill.

### 3.5 PRIORITÉ 5 — Cleanup (1h)

- Supprimer vault : `08. Outils/Anya/Skills/Workflow TickTick Sync.md` (obsolète, main agent via MCP).
- Supprimer repo : `docs/anya/skills-anya/Workflow TickTick Sync.md` si présent.
- `_INDEX.md` vault : retirer ligne TickTick Sync, ajouter Workflow Todo (déjà fait par autre instance ?).
- `docs/ia/anya-current-architecture.md` : mettre à jour la section TickTick avec le nouveau modèle.

## 4. Points d'attention

- **Idempotence Email→TT** (`ticktick-integration.ts`) : aucune dédup explicite trouvée. Si email re-trié (replay GitHub Actions), risque doublon. À ajouter : tag `anya-email-${messageId}` ou check via `listTasks` avec filtre tag avant `createTask`. **À répliquer pour Telegram (par chatId+messageId) et Plaud (par transcriptHash)**.
- **Rate-limit TickTick API** : non documenté côté repo, mais `push-engine.ts:66` a déjà un backoff 1s/2s/4s sur 429 → réutiliser le pattern pour les 3 nouveaux canaux. Estimation conservatrice : ≤ 60 req/min.
- **Tag `anya-*`** : présent pour email (`anya-${category}`). Telegram & Plaud doivent suivre la convention (`anya-telegram`, `anya-plaud`) pour distinguer dans `isAnyaTask()` du poll.
- **`#hide-tcw`** : confirmé inutile pour TickTick (artefact sidebar Obsidian TCW). Une fois `Todo.md` régénéré depuis TT, le tag n'existe plus dans le miroir. Aucune action.
- **Suppression de tâches TickTick** : l'API publique developer.ticktick.com n'expose pas clairement `DELETE`. `push-engine.ts` utilise `completeTask` pour les `[x]` mais le delete pur est ambigu. **Décision (§5)** : pour les annulations Telegram, utiliser `completeTask` ou un tag `cancelled` ?
- **State-store** S18 utilisé par push/pull S18. Si on garde le module pour la régénération miroir (cache projectId + dernier hash), bien isoler la nouvelle clé pour éviter conflit avec l'ancien state existant en prod.

## 5. Décisions à valider Thomas avant dev

1. **Fréquence régénération miroir `Todo.md`** : 15min (aligné poll existant, simple) ou 5min (plus réactif, double les calls API) ? → **recommandation : 15min**, suffisant pour un miroir consultatif.
2. **Annulation tâche via Telegram (bouton inline)** : (a) `completeTask` côté TT (marque `[x]`), (b) ajouter tag `cancelled` + filtrer dans le miroir, (c) attendre support DELETE officiel ? → **recommandation : (a) completeTask**, simple et idempotent.
3. **Endpoint dédié Plaud `/api/secretariat/inbox/plaud`** : créer un endpoint repo (recommandé, audit trail propre) ou laisser tout côté skill vault qui appelle directement l'API TT via MCP Zapier ? → **recommandation : endpoint repo** pour audit-log + dédup centralisée.
4. **Conserver le code S18 (`ticktick-sync/`)** un cycle (S20) derrière feature flag avant suppression S21, ou suppression sèche immédiate ? → **recommandation : kill switch S20 + suppression S21** (R7 : pas de dette "au cas où", mais on garde une session pour valider la migration).
5. **Gestion des tâches préexistantes dans le vault** créées par S18 push (ancien système, déjà dans TT avec mapping state) : laisser tel quel dans TT (le miroir les reflétera) ou nettoyer ? → **recommandation : laisser tel quel**, le miroir suivant les exposera correctement.

---

## Récap court

**Surprise majeure** : le repo contient un système S18 bidirectionnel complet (`ticktick-sync/`) avec push/pull/state/audit-log, déjà en prod via 2 crons toutes les 5min. **Cause très probable du "TickTick marche pas super"** : ce système est *philosophiquement opposé* au SOT Workflow Todo.md (vault canonique vs TickTick canonique). Le poll S15 logger-only existe en parallèle, sans communication entre les deux.

**Top 3 priorités** :
1. Neutraliser crons sync S18 (2h) — stop hémorragie.
2. Régénération miroir `Todo.md` depuis TT (1j) — combler la fonction primaire SOT.
3. Telegram → TickTick (1j) — combler canal create-only manquant.

**Estimation totale gap-closing** : ~3.5j dev pour les 5 priorités, hors validation Thomas et tests E2E sur vraies données. La 4e priorité (Plaud) peut être traitée en parallèle car elle touche surtout la skill vault.
