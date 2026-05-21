# Skills Anya — Index

> Index des 13 workflows opérationnels d'Anya, secrétariat IA personnel de Thomas Issa. Source de vérité technique : `docs/ia/anya-current-architecture.md`. Cette doc est la SOT *fonctionnelle* (du point de vue Thomas) — chaque workflow décrit le trigger, l'input, les étapes, l'output et la méthode (red lines + arbre de décision + critères qualité + exemple + maintenance + changelog).

## Vue d'ensemble

| Catégorie | Workflow | Déclencheur | Module code principal | Modèle LLM | Fréquence |
|---|---|---|---|---|---|
| **A. Génération docs** | [CR Réunion](./Workflow%20CR%20Reunion.md) | Note Telegram > 100 chars | `cr-renderer/` + `cr-writeback/` | Sonnet 4 | ~16/mois |
| | [Fin de Bail](./Workflow%20Fin%20de%20Bail.md) | Commande Telegram Thomas | `rent/fin-de-bail.ts` | Sonnet 4 | ~1-2/an |
| | [Fiche Candidat Locataire](./Workflow%20Fiche%20Candidat%20Locataire.md) | Email entrant catégorie `candidat` | `handlers/candidat.ts` | Sonnet 4 | ~5-10/mois |
| | [Draft Email](./Workflow%20Draft%20Email.md) | Commande Telegram OU réponse attendue | `email/draft-composer.ts` | Sonnet 4 | ~10-20/mois |
| **B. Ingestion / classification** | [Email Ingest](./Workflow%20Email%20Ingest.md) | Cron 1h Gmail | `email-ingest/` + `triage/` | Haiku 4.5 | ~50-100/jour |
| | [Voice STT](./Workflow%20Voice%20STT.md) | Message vocal Telegram | `stt/whisper.ts` | Whisper OpenAI | ~5-10/jour |
| | [Inbox Photo Batch](./Workflow%20Inbox%20Photo%20Batch.md) | Photo(s) Telegram (iPhone) | `photo/inbox-batch.ts` | — | ~20-50/mois |
| | [No-match Contact](./Workflow%20No-match%20Contact.md) | Email expéditeur inconnu | `email/no-match.ts` + `handlers/nomatch.ts` | — | ~10-20/mois |
| **C. Propagation vault** | [CR Write-back](./Workflow%20CR%20Write-back.md) | Post-génération CR (étape 3.6) | `cr-writeback/` | — | ~16/mois |
| | [Hot Context Updater](./Workflow%20Hot%20Context%20Updater.md) | Cron 5min (décalé 90s vs TickTick) | `hot-context/updater.ts` | Haiku 4.5 | ~10-20/semaine |
| **D. Transverses** | [Workflow Todo](#) (voir vault SOT `08. Outils/Anya/Skills/Workflow Todo.md`) | Hub TickTick + miroir read-only | poll 15min + canaux create-only (Email, Telegram, Plaud, TickTick natif) | — | ~50-100/mois |
| | [Validation Telegram](./Workflow%20Validation%20Telegram.md) | Tout workflow nécessitant validation | `telegram-validation/` + `pending-store/` | — | ~30-50/semaine |
| | [Health Monitor](./Workflow%20Health%20Monitor.md) | Cron daily | `health-monitor/` + `anthropic-usage.ts` | — | 1/jour |

**Total : 13 workflows** (12 nouveaux S19 + CR Réunion existant). S20 — l'ancien workflow `TickTick Sync` (push/pull bidirectionnel S18) est **remplacé** par `Workflow Todo` (SOT vault). Modèle : TickTick = hub unique, `03. Tâches/Todo.md` = miroir read-only régénéré toutes les 15min. Canaux create-only : Email, Telegram, Plaud, TickTick natif. Code S18 (`ticktick-sync/`) conservé derrière kill switch `TICKTICK_SYNC_LEGACY_DISABLED=1`, suppression définitive S21.

## Conventions transverses (rappel des règles)

Tous les workflows respectent ces règles cross-cutting (héritage `CLAUDE.md` + leçons S9-S19) :

- **R1 (P0 #95, S14)** — **Vault Drive = source de vérité unique**. Tout est lu live via `vault-reader/`, jamais hardcodé. Cache mémoire TTL 1h acceptable, jamais > 1h.
- **R3 (P1 #96, S14)** — **TTL pendings interactifs ≥ 7 jours**. Cartes Telegram, pending-store, validations Thomas — jamais < 72h.
- **R4 (P1 #97, S14)** — **Tout nouveau préfixe callback Telegram = (a) handler `handlers/<nom>.ts` + (b) dispatch `webhook/route.ts` + (c) test E2E**. Sinon cascade vers mauvais router. Gate G33 candidate.
- **R5 (P0 #99, S15)** — **Édition fichier Drive existant = PATCH in-place via `_zap_raw_request`** (`/upload/drive/v3/files/{fileId}?uploadType=media`). JAMAIS create+delete : casse fileId, wikilinks Obsidian, partages.
- **R7 (P1 #101, S15)** — **Source live (vault, API) remplace un hardcoded**. Fallback runtime = `try/catch` → tableau vide, jamais copie statique. Pas de dette "au cas où".
- **Wrapper LLM unifié `llm/client.ts`** (S17 R1) — tous les appels Anthropic passent par ce wrapper : `cache_control` auto + `recordAnthropicUsage` 100%.
- **UTF-8** direct partout (é, è, à — jamais `é`).
- **Zéro mention de concurrent par nom** dans les livrables client-facing.
- **Emails client-facing = brouillons obligatoires** (jamais envoi direct — règle 11 CLAUDE.md).

## Notes architecturales

- **Modèles LLM utilisés** :
  - **Haiku 4.5** (`claude-haiku-4-5-20251001`) : triage Email Ingest, détection Hot Context Updater. Coût × 5 inférieur à Sonnet, suffisant pour classification.
  - **Sonnet 4** (`claude-sonnet-4-20250514`) : génération qualitative — CR Réunion, Fin de Bail, Candidat (extraction), Draft Email. Qualité critique sur registre français.
  - **Whisper** (OpenAI) : STT vocaux Telegram. Standard FR, choix > Google STT pour raisons de billing (décision S13).
- **Verrou anti-concurrence** : push/pull TickTick partagent un verrou TTL 30s. Hot Context cron est décalé 90s pour éviter conflits PATCH.
- **Pending-store** : tous les workflows nécessitant validation Thomas utilisent le même pattern (carte 2-5 boutons + JSON Drive atomique `.tmp + rename` + TTL 7j R3).
- **Tests** : baseline 1716 tests verts S19 (Vitest). Matrice confusion triage Email Ingest : 100% precision / 100% recall sur 20 fixtures.

## Comment ajouter un workflow

1. Documenter dans `docs/anya/skills-anya/Workflow <Nom>.md` (5 sections + frontmatter YAML — gabarit `Workflow CR Reunion.md`).
2. Implémenter le code dans `src/lib/secretariat/<module>/`.
3. Si écriture vault → utiliser `vault-client.updateFileContent()` PATCH in-place R5.
4. Si appel LLM → passer par wrapper `llm/client.ts` (R1 S17 — tracking 100%).
5. Si callback Telegram → (a) handler dédié `handlers/<nom>.ts`, (b) dispatch dans `webhook/route.ts`, (c) test E2E (R4).
6. Tester en E2E réel iPhone (R6) avant batch en prod.
7. Mettre à jour cet index (`_INDEX.md`) avec le nouveau workflow dans la table.
8. Mettre à jour le changelog du workflow et `project-context.md` historique des interventions.

## Couverture par règle

| Règle | Workflows concernés |
|---|---|
| R1 (vault SOT) | tous |
| R3 (TTL pending ≥ 7j) | No-match Contact, Validation Telegram, Hot Context Updater, Fiche Candidat, Draft Email, Photo Batch, TickTick Sync (premier push) |
| R4 (préfixe = handler+dispatch+E2E) | No-match Contact, Validation Telegram, Hot Context Updater, Fiche Candidat, Draft Email, Photo Batch, TickTick Sync |
| R5 (PATCH in-place) | CR Réunion, CR Write-back, Hot Context Updater, TickTick Sync, Fin de Bail, Email Ingest (checkpoint), Health Monitor (usage JSON), Validation Telegram (pending-store) |
| R7 (pas de hardcoded) | CR Réunion (S17 migration), CR Write-back, tous |
| Wrapper LLM S17 R1 | CR Réunion, Fin de Bail, Fiche Candidat, Draft Email, Email Ingest, Hot Context Updater |

## Référence rapide — sessions clés

| Session | Date | Apport au framework Anya |
|---|---|---|
| S9 | 2026-04-09 | Mise en production Anya |
| S13 | — | Décision Whisper > Google STT (billing) + leçon EXIF HEIC iOS perdu |
| S14 | — | Pré-filtre heuristique triage email (~70% économie tokens), matrice confusion 100%/100%, règle R3 TTL 7j, règle R4 préfixes callback |
| S15 | — | Règle R5 PATCH in-place, règle R7 pas de hardcoded, naming PDF figé (verbatim Thomas) |
| S16 | 2026-05-18 | CR mode solo (REGLE 14 system prompt), CR Write-back PATCH in-place + idempotence, 27 tests cr-writeback |
| S17 | 2026-05-19 | Wrapper LLM unifié R1 (cache_control + tracking 100%), migration `PROJET_FICHE_FILE_IDS` → `findProjetFicheByEntite()` (dette #101) |
| S18 | — | TickTick Sync push (S18.1) + pull (S18.2) + iCal feed (S18.3a) |
| S19 | 2026-05-20 | Documentation skills formalisée (13 workflows ce dossier), décision verbatim deletes TickTick silencieux |

[À CONFIRMER pour S13/S14/S15 dates précises].

---

**Volume estimé total Anya** : ~50-100 emails/jour triés, ~16 CR/mois, ~30-50 cartes validation/semaine, ~50-100 tâches TickTick synchronisées/mois.

**Coût mensuel estimé** : < 10 EUR Anthropic (Haiku 4.5 + Sonnet 4 avec cache_control + pré-filtre heuristique) + < 1 EUR Whisper + APIs Google/TickTick gratuites. Budget alerte plafonné 50 EUR Anthropic (`ANTHROPIC_BUDGET_EUR`).
