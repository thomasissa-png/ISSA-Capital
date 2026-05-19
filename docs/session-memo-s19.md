# Mémo de passation — Session 19

> Rédigé en clôture S18 (2026-05-19) par orchestrator. Destiné à l'orchestrateur S19.

---

## État à la fin S18

- **Commit HEAD** : `2d4fc2f` (branche `claude/issa-capital-s14-ttl-audit-ZQcQS`, default GitHub, pushé)
- **Tests verts** : **1544** (1300 baseline S17 → 1544 = +244 sur S18)
- **TypeScript** : 0 erreur
- **Lint** : 0 erreur
- **Build** : OK partout
- **Pre-commit gate (règle 6)** : PASS sur tous les commits S18

### Commits S18 (5 commits livrés)

| Commit | Description |
|---|---|
| `de8eb96` | **S18.1** feat: push vault → TickTick (parser + state + engine + cron, +98 tests) |
| `4a4c952` | chore: WIP snapshot pull engine (lib stop hook) |
| `31d9e9a` | **S18.2** feat: pull TickTick → vault + résolution conflits + scan inline tasks (+56 tests) |
| `029ef23` | **S18.3a** feat: iCal feed reunions vault (read-only RFC 5545, +52 tests) |
| `2d4fc2f` | **S18.3b** feat: audit JSONL + récursion vault inline + recreate sur Garder (+31 tests) |

---

## Phase 4 — Sync vault ↔ TickTick — COMPLÈTE CÔTÉ CODE

### Modules livrés (`src/lib/secretariat/ticktick-sync/`)

| Module | Rôle |
|---|---|
| `types.ts` | Interfaces VaultTask, ProjectMapping, SyncState, PendingDelete, PullStats, SyncLock |
| `parser.ts` | Ligne markdown `- [ ] description 📅 YYYY-MM-DD #tag 🔼` → VaultTask |
| `serializer.ts` | VaultTask → ligne markdown réversible |
| `hasher.ts` | SHA-1 stable par ligne |
| `project-manager.ts` | Création 7 projets TickTick + mapping tags → projectId |
| `state-store.ts` | State JSON Drive (`_Inbox/AnyaLogs/ticktick-sync-state.json`) |
| `vault-scanner.ts` | Scan Todo.md + récursion `*.md` tout le vault (MAX_DEPTH=10, exclusions `_*`, `Profil/`, `Archive/`, `#hide-tcw`) |
| `push-engine.ts` | Push diff vault → TickTick (create/update/complete/delete, idempotent, audit logged) |
| `pull-engine.ts` | Pull TickTick → vault avec résolution conflits last-write-wins + Telegram validation deletes |
| `ical-feed-reunions.ts` | Feed iCal RFC 5545 des réunions vault (read-only) |
| `audit-logger.ts` | Append-only JSONL `_Inbox/AnyaLogs/ticktick-sync-YYYY-MM-DD.jsonl` (red line §9.4) |

### Endpoints API + GitHub Actions

| Endpoint | Workflow | Cron |
|---|---|---|
| `/api/secretariat/ticktick-sync/cron-push` | `cron-ticktick-sync-push.yml` | 5 min |
| `/api/secretariat/ticktick-sync/cron-pull` | `cron-ticktick-sync-pull.yml` | 5 min (+30s offset pour éviter concurrence) |
| `/api/secretariat/ticktick-sync/ical-reunions` | n/a (GET on-demand) | n/a |

### Handlers Telegram nouveaux

- `ticktick-projects-confirm` (préfixe `tickticksync_projects:`) — validation création initiale 7 projets
- `ticktick-delete-confirm` (préfixe `tickticksync_delete:`) — validation deletes TickTick (red line §9.2)

Tous les nouveaux callbacks ont triplet R4 : handler + dispatch webhook + test E2E callback.

---

## Reste à faire — S18.4 (validation E2E Thomas)

### Actions Thomas bloquantes (activation prod)

1. **Replit Secret `OBSIDIAN_VAULT_NAME`** — nom exact du vault Obsidian (pour deep-links `obsidian://` côté bouton Telegram [Voir])
2. **Vérifier GitHub Actions activés** : `cron-ticktick-sync-push.yml` + `cron-ticktick-sync-pull.yml` (auto-détectés au push)
3. **Écrire 1-2 `- [ ]` dans `Taches/Todo.md`** → attendre carte Telegram < 5 min → cliquer [Créer] → 7 projets TickTick créés

### Actions Thomas optionnelles (visualisation)

4. **TickTick app iPhone** → Settings → Calendar → Subscribe → coller URL iCal réunions vault :
   ```
   https://issa-capital.com/api/secretariat/ticktick-sync/ical-reunions?token=<TICKTICK_ICAL_SECRET>
   ```
5. **Google Calendar** → souscrire URL iCal tâches (guidée S16)

### Tests E2E réels Thomas (R6 — non-bloquant pour S19 nouveau jalon)

| Test | Étapes | Attendu |
|---|---|---|
| Push create | Écrire `- [ ] envoyer doc à Martin 📅 2026-05-25 #issa 🔼` | Tâche TickTick projet ISSA, due demain, priorité haute en < 5 min |
| Push complete | Cocher `[x]` dans Obsidian | TickTick complétée en < 5 min |
| Pull create | Créer tâche dans TickTick iPhone | Apparait dans `Taches/Todo.md > ## Inbox` en < 5 min |
| Pull complete | Cocher dans TickTick iPhone | `[x]` dans Obsidian en < 5 min |
| Delete validation | Supprimer tâche dans TickTick | Carte Telegram `[Oui][Garder][Voir]`, suppression vault uniquement si [Oui] |
| Conflit | Modifier la même tâche des 2 côtés en < 1 min | last-write-wins, audit JSONL trace l'op |

**Critère red line spec §11** : 7 jours en prod sans intervention manuelle, > 99% syncs réussis.

---

## Sujets ouverts hors Phase 4 (pour S19+)

| # | Sujet | Effort | Bloqueur |
|---|---|---|---|
| 1 | **Bail P0 #2/#3/#4/#5** : encadrement loyers Nanterre+Paris 18, IRL valeur numérique, clause pénale 3x, meublé vs nu | ~6h après décisions | 4 décisions Thomas inchangées depuis S12 |
| 2 | **Helper `extractPdfText` partagé** | 30 min | Aucun |
| 3 | **Promotion candidat → locataire** (Phase 6 S12) | ~3h | Aucun |
| 4 | **Migration Sonnet 4 → Sonnet 4.6 A/B test** (reco @ia audit S16 S1) | 1 jour via wrapper R1 | Aucun |
| 5 | **Branche `main` officielle** à créer | 15 min | Aucun |
| 6 | **Récap quotidien Telegram** auto matinal (tâches du jour + emails urgents + CRs récents) | ~4h | Aucun — gain de visibilité immédiat pour Thomas |

---

## Lessons à propager S19

- **#103 P2** (S16) : Stop hook git check se déclenche pendant agents background → mitigation = commit WIP orchestrator
- **#104 P2** (S16) : Pas de branche `main` sur le repo, default = feature branch S14
- **#105 P1** (S17) : Quand règle CLAUDE.md ajoutée mid-session, auditer commits récents (déjà propag partielle S17)
- **#106 P1** (S17) : Tout `client.messages.create()` doit passer par wrapper centralisé (✅ propag complète S17)
- **#107+ P2** (S18 candidats) : Pattern audit JSONL append-only via PATCH in-place + try/catch silencieux pour non-bloquant pipeline

→ Audit TTL recommandé en début S19.

---

## Caps post-S18 (clôture)

- `CLAUDE.md` : **120 lignes** ✅ (cap 125)
- `docs/lessons-learned.md` : **50 lignes** ✅ (cap 80)
- `project-context.md` : **~302 lignes** ⚠️ (cap 250 hors mémo+historique — marge fine, à auditer S19 si dépasse)
- `docs/founder-preferences.md` : **67 lignes** ✅
- Tests : **1544 verts**

---

## Métriques cumulées S18

| Métrique | Avant S18 | Après S18 | Delta |
|---|---|---|---|
| Tests vitest | 1300 | 1544 | +244 (+18.8%) |
| Modules `ticktick-sync/` | 0 | 11 | +11 |
| Endpoints API cron | 3 | 5 | +2 |
| GitHub Actions workflows | 3 | 5 | +2 |
| Handlers Telegram | 7 | 9 | +2 |
| Phase 4 complète | ❌ | ✅ code | — |

---

## Commande de reprise S19

```
@orchestrator — Session S19. Branche `claude/issa-capital-s14-ttl-audit-ZQcQS` (HEAD `2d4fc2f`, 1544 tests verts).
Lis docs/session-memo-s19.md + lessons-learned.md.
Phase 4 livrée. S18.4 = tests E2E réels Thomas (recommandé avant tout nouveau jalon).
Sinon menu S19 : Bail P0, helper extractPdfText, Sonnet 4→4.6 A/B, récap quotidien Telegram, branche main.
```
