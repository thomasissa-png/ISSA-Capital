# Mémo de passation — Session 16

> Rédigé en clôture S15 (2026-05-18). Destiné à l'orchestrateur S16.

---

## État à la fin S15

- **Commit HEAD** : `1f1992b` (branche `claude/issa-capital-s14-ttl-audit-ZQcQS`)
- **Tests verts** : **1220** (956 → 1220, +264 sur S15)
- **TypeScript** : 0 erreur
- **Lint** : 0 erreur
- **Build** : OK
- **Branche pas encore mergée sur main** — décision Thomas en S16

### Jalons livrés S15 (8 commits clés)

| Jalon | Commit | Description |
|---|---|---|
| Cache Haiku | (batch 1) | `cache_control: ephemeral` sur tous appels Haiku → coût -55% (1.35€ → 0.60€/mois) |
| **5B** Drafts Gmail | (batch 1) | `draft-composer.ts` + `gmail-client.createDraft()` + bouton Telegram "Voir dans Gmail" |
| **5D** Vault live | (batch 1) | `vault-reader.ts` cache TTL 1h + stale fallback + migration `contacts-cache.ts` |
| **5A** Cron Gmail 1h | (batch 2) | Endpoint `/api/secretariat/cron-email-ingest` + dedup native via labels Gmail |
| **5C-A** TickTick API | (batch 2) | `ticktick-client.ts` REST natif + OAuth + intégration email-ingest |
| **5C-C** iCal export | (batch 2) | `ical-export.ts` RFC 5545 + endpoint signé |
| 5C fix webhook | `aa9f898` | TickTick n'expose pas de webhook → polling 15min GH Actions à la place |
| 5C fix OAuth | `9e1149c` | TickTick n'émet pas de refresh_token → `TICKTICK_ACCESS_TOKEN` direct (180j) |
| **5E** Health-monitor | `198bee6` | 7 items surveillés (TickTick, Gmail, Drive, Telegram, Anthropic, domaine, SSL) + cron daily + carte Telegram |
| **5F** CR → vault | `3e4a35b` | Pipeline CR consomme le vault Drive (parallèle à 5D pour le triage email) |
| Fix vault contacts | (via Zapier PATCH) | 6 fiches vault enrichies (`entites_visibles`, `societe`, `role`, tonalité Thomas) |
| Suppression BASE_CONTACTS | `1f1992b` | Dette technique éliminée — vault = source unique |

### Modules nouveaux créés en S15

- `src/lib/secretariat/vault-reader.ts` + `vault-contacts.ts` (lecture live vault)
- `src/lib/secretariat/email-ingest/draft-composer.ts`
- `src/lib/secretariat/ticktick/` (client, oauth, ical-export, poll)
- `src/lib/secretariat/health-monitor/` (oauth-timestamps, anthropic-usage, dedup-store, health-monitor, monitored-items)
- `src/lib/secretariat/telegram-validation/handlers/health-renewed.ts` + `health-snooze.ts`
- `src/app/api/secretariat/cron-email-ingest/`
- `src/app/api/secretariat/ticktick/{oauth/init,oauth/callback,cron-poll,ical}/`
- `src/app/api/secretariat/cron-health-check/`
- `.github/workflows/cron-{email-ingest,ticktick-poll,health-check}.yml`

---

## Actions manuelles Thomas en attente (post-deploy)

1. **Replit Secrets** à ajouter :
   - `CRON_SECRET` (chaîne random 64 chars — `openssl rand -hex 32`)
   - `NEXT_PUBLIC_SITE_URL=https://issa-capital.com`
   - `TICKTICK_CLIENT_ID`, `TICKTICK_CLIENT_SECRET`, `TICKTICK_ICAL_SECRET`
   - `TICKTICK_ACCESS_TOKEN` (après OAuth init, valide 180j → ré-autoriser ~5 mois)
   - `ANTHROPIC_MONTHLY_BUDGET_EUR=50` (défaut, ajuster si besoin)
   - `DOMAIN_RENEWAL_DATE=YYYY-MM-DD` (à confirmer via registrar)

2. **GitHub Actions Secrets** :
   - `CRON_SECRET` (même valeur que Replit)
   - `APP_BASE_URL=https://issa-capital.com`

3. **TickTick** : créer app sur `developer.ticktick.com`, configurer OAuth redirect, visiter `/api/secretariat/ticktick/oauth/init` pour OAuth initial

4. **Google Calendar** : souscrire l'URL iCal Anya pour visualisation tâches

5. **Reload Obsidian** après les modifs vault S15 (les 6 fiches contacts ont des nouveaux fileIds, le cache local doit resync)

---

## Sujets ouverts à traiter en S16

### Q1 — Liens CR externes au vault (clarification Thomas)
Thomas en S15 : *"Ces liens [CR] ne sont pas sur le vault mais en dehors"*. Le code montre que les CR sont uploadés dans 4 dossiers Drive par entité (IC/GO/VI/VV — `drive-upload.ts:26-31`). À clarifier avec Thomas : de quel système externe parle-t-il ? Craft.app ? Asana ? Anciens chats Claude.ai ? **Action S16** : poser la question avant de coder.

### Q2 — CR mode solo (visite, activité perso)
Décision Thomas S15 : *"On adapte. Même format que les autres, ce sont des comptes rendus. On continue également le naming classique. Même dossier que les autres compte rendu. Mêmes infos également, juste adapté à un mode solo."* → Le system prompt CR doit accepter 0 participant tiers + le pipeline reste identique (PDF entité-folder, référence séquentielle). **Effort estimé** : ~2h (ajustement prompt + tests).

### Q3 — Write-back CR → fiches vault via inbox
Décision Thomas S15 : *"Je veux que ce soit géré via la inbox. En fait quand un compte rendu est fait, il est uploadé dans la inbox du vault. Quand on traitera la inbox, les fiches seront complétées."* → Pipeline asynchrone. **Méthode PATCH validée** en S15 (`docs/drive-edit-strategy.md`). **Effort estimé** : ~3h (extension `drive-upload.ts` + handler inbox).

### Autres dettes / TODOs

- **Branche jamais mergée sur main** : 8 commits S15 sur `claude/issa-capital-s14-ttl-audit-ZQcQS`. Décision Thomas en S16 : merger ou continuer sur cette branche.
- **Mode mimeType `newtxtfile` Zapier** : crée `text/plain`. Workaround : toujours suivre `newtxtfile` d'un PATCH pour fix le mimeType, OU créer directement via raw API. À documenter dans `drive-edit-strategy.md`.
- **`docs/orchestration-plan-s15-health-monitor.md`** : doc orchestration ad-hoc créée pour 5E, à archiver après merge.

---

## Métriques cumulées S15

| Métrique | Avant S15 | Après S15 | Delta |
|---|---|---|---|
| Tests vitest | 956 | 1220 | +264 (+27%) |
| Coût LLM mensuel projeté | 1.35€ | ~0.60€ | -55% |
| Modules `secretariat/` | ~25 | ~40 | +15 |
| Endpoints API cron | 0 | 3 | +3 |
| GitHub Actions workflows | 0 | 3 | +3 |
| Tasks @fullstack/orchestrator | — | 8 | — |

---

## Leçons critiques S15 (cf `lessons-learned.md`)

- **#99 P0** : Édition Drive = PATCH in-place, jamais create+delete (cassé wikilinks sur 6 fiches)
- **#100 P1** : Test 1 fichier + validation Thomas AVANT batch vault
- **#101 P1** : Retirer hardcoded dès que source live validée (BASE_CONTACTS)
- **#102 P2** : Vérifier doc API officielle (TickTick : pas de refresh_token, pas de webhook)

---

## Prochaine action recommandée S16

**Démarrer par les actions manuelles Thomas** (Replit Secrets, GitHub Secrets, TickTick OAuth, Google Calendar iCal) pour activer toute la mécanique S15 en prod. Puis traiter Q1 (clarification) → Q2 (CR solo) → Q3 (write-back CR via inbox).

L'audit caps :
- `CLAUDE.md` : 141 lignes ⚠️ **dépasse cap 125L** — audit à faire en début S16
- `lessons-learned.md` : 43 lignes ✅ (cap 80)
- `project-context.md` : 325 lignes ⚠️ **dépasse cap 250L** — archiver entrées > 5 sessions
