# Mémo de passation — Session 18

> Rédigé en clôture S17 (2026-05-19) par orchestrator. Destiné à l'orchestrateur S18.

---

## État à la fin S17

### Commits S17 (au-dessus de la clôture S16 HEAD `87ad9cf`)

| Commit | Description |
|---|---|
| `cee3d7e` | docs(s16): audit @ia Anya note 7,1/10 SOLIDE |
| `1601a0f` | **R3** docs(s17.r3): archive docs IA obsolètes S4 + nouvelle architecture actuelle |
| `8cb26d7` | **R2** refactor(s17.r2): migrate PROJET_FICHE_FILE_IDS hardcode → vault-reader live |
| `1d80bc5` | docs(s17.r2): handoff project-context + lessons-learned #105 propag partielle |
| `c5072b9` | **R1** refactor(s17.r1): wrapper Anthropic unifié llm/client.ts + migration 6 call sites |

### Tests : **1300 verts** (1255 → 1300, +45 sur S17)
### Build / TSC / Lint : OK

### Actions Thomas validées en S17

- **A4 iCal** : ✅ HTTP 200 fonctionnel (après config Replit Secrets + redeploy + correction param `token=`)
- **A5 fiche Thomas Issa** : ✅ Déplacée par orchestrator via MCP Zapier vers `00. Me/01. Profil/` avec contenu (PATCH content + PATCH parent in-place R5, fileId préservé)
- **A1/A2/A3** : ✅ faits par Thomas S16 (Secrets, GitHub Actions, TickTick OAuth)

### Reste à valider côté Thomas (non bloquant pour S18)

- **Souscription Google Calendar à l'URL iCal** (5 min, étapes dans réponse orchestrator S17)
- **Tests E2E réels R6** (CR mode solo + multi-participants + write-back vault) — déprioritisé par Thomas en S17, à reprendre quand on aura du temps

---

## Mission S18 : Phase 4 — Sync vault ↔ TickTick

### Spec source

**Fichier** : `second-cerveau/Anya - Prompt Claude Code TickTick sync.md` (372 lignes, écrite par Thomas 2026-05-12, statut "à implémenter")

**Question fondatrice Thomas** (S17 verbatim) : *"Comment Claude peut savoir ce que je dois faire avec la configuration actuelle ?"*

**Réponse** : il ne peut pas. Anya CRÉE des tâches dans TickTick (router Telegram + handlers email) mais ne LIT PAS `Taches/Todo.md` du vault ni les `- [ ]` inline. Phase 4 = comble ce trou.

### Principe directeur (red line non-négociable)

**Vault Obsidian = source de vérité. TickTick = miroir mobile.** En cas de conflit, vault gagne.

### Adaptations obligatoires aux découvertes S15

La spec a été écrite avant la découverte que TickTick n'expose ni `refresh_token` ni `webhook` (lesson #102 S15) :

- ❌ Spec dit `TICKTICK_REFRESH_TOKEN` → ✅ Réalité : `TICKTICK_ACCESS_TOKEN` direct (180j), pas de refresh
- ❌ Spec dit "webhook TickTick" → ✅ Réalité : polling GitHub Actions 15min (déjà en place via `cron-poll`)
- ❌ Spec dit `webhook Drive API watch` pour vault → ✅ Plus simple : polling Drive 5min via GitHub Actions (pattern déjà éprouvé)
- ❌ Spec mentionne `06. Réunions/` et `08. Outils/` → ✅ Utiliser `vault-paths.ts` (R7), structure actuelle = plate (Reunions/, Taches/, etc.)

### Découpage en 3 sous-jalons S18

| Jalon | Scope | Effort | Lancement |
|---|---|---|---|
| **S18.1** | Push vault → TickTick (setup projets, parser Todo.md, create/update/complete/delete, hash SHA-1, mapping tags → projets, state store, cron 5min) | ~1 jour | **EN COURS background fullstack** |
| **S18.2** | Pull TickTick → vault (polling étendu, détection changements, patch ligne vault, création depuis TickTick → `Todo.md > ## Inbox`) + résolution conflits last-write-wins | ~1 jour | À déclencher après S18.1 validé E2E |
| **S18.3** | iCal feed réunions vault (extension `ical-export.ts` existant) + Telegram validation deletes (red line spec §9.2) + audit JSONL `_Inbox/AnyaLogs/ticktick-sync-YYYY-MM-DD.jsonl` + tests E2E réels Thomas | ~0,5 jour | À déclencher après S18.2 validé |

### Red lines (rappel)

1. Vault canonique, gagne en conflit
2. ~~Pas de delete silencieux du vault (Telegram validation)~~ → **S19 update** : completion silencieuse (delete TickTick → vault `[ ]` patché `[x]`, zéro notification, JSONL trace). Cf. spec §9.2 S19.
3. Pas de delete réunions depuis TickTick (feed read-only)
4. Audit JSONL chaque op
5. Backoff 429 (60 req/min max)
6. Tags `#hide-tcw` jamais synchronisés
7. Idempotence push (hash)
8. Préservation frontmatter + structure sections Todo.md
9. UTF-8 réel
10. State recovery (full re-sync si corrompu, no dupes)

### Critères de succès (cibles E2E)

- 7 projets TickTick créés au setup avec mapping tags
- iCal feed 5+ réunions visibles dans app TickTick
- 20 tâches diverses push vault → TickTick avec dates/tags/priorités/récurrences
- Cocher dans TickTick app iPhone → `[x]` dans vault en < 5 min
- 7 jours prod sans intervention manuelle, > 99% syncs réussis

---

## Sujets ouverts hors Phase 4 (pour S19+)

- **Bail P0 #2 #3 #4 #5** (S12) : encadrement loyers Nanterre+Paris 18, IRL valeur numérique, clause pénale, meublé vs nu — 4 décisions Thomas inchangées depuis S12
- **Helper `extractPdfText` partagé** (S12 TODO, 30 min)
- **Promotion candidat → locataire** (Phase 6 S12, ~3h)
- **Migration Sonnet 4 → Sonnet 4.6 A/B test** (audit @ia reco long-terme, 1 jour via wrapper R1 livré S17)
- **Branche `main` officielle** à créer (default GitHub = encore une feature branch S14)
- **Souscription Google Calendar iCal** côté Thomas (5 min, dispo dans `docs/session-s16-thomas-actions.md`)

---

## Caps post-S17 (clôture)

- `CLAUDE.md` : **120 lignes** ✅ (cap 125)
- `docs/lessons-learned.md` : ~50 lignes ✅ (cap 80, à vérifier après propag #105/#106)
- `project-context.md` : ~295 lignes ⚠️ (cap 250 hors mémo+historique, marge fine)
- `docs/founder-preferences.md` : 67 lignes ✅

---

## Commande de reprise S18

```
@orchestrator — Session S18. Branche `claude/issa-capital-s14-ttl-audit-ZQcQS`.
Lis docs/session-memo-s18.md + spec Phase 4 dans `second-cerveau/Anya - Prompt Claude Code TickTick sync.md`.
Mission unique S18 : sync vault ↔ TickTick. Jalon S18.1 en cours background fullstack.
```
