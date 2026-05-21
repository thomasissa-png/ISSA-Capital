# Anya — Architecture actuelle (S16)

> Source de vérité unique pour comprendre Anya en S16.
> Produit S17 (2026-05-19) suite à l'archivage des specs S4 obsolètes (voir `docs/archive/secretariat-s4-whatsapp-craft/`).
> Référence audit : `docs/ia/anya-audit-s16.md` (note 7,1/10, baseline 1255 tests verts).

---

## Vue d'ensemble

**Anya** = secrétariat IA personnel de Thomas Issa (ISSA Capital). Interface unique : **bot Telegram** (1 conversation privée). Mission : ingérer texte/photos/vocaux/documents/emails, classifier, générer des artefacts (CR de réunion, quittances, baux, drafts emails), écrire dans le **vault Obsidian hébergé sur Google Drive**, gérer les tâches via TickTick, synchroniser Gmail + Google Calendar. Mono-utilisateur Thomas (pas de RBAC). En production depuis S9 (2026-04-09).

---

## Flow principal

```
Telegram update (texte / photo / voice / document)
  → src/app/api/telegram/webhook/route.ts (ack < 5s)
  → dispatch par signature bytes (MIME inferé, pas Content-Type)
  → router selon type :
      - texte court        → handler conversationnel (Sonnet 4 inline)
      - photo (EXIF)       → workflow photo + rent/quittance si trigger
      - voice              → Whisper STT → texte → re-dispatch
      - document PDF/DOCX  → ingestion + analyse
      - note CR            → cr-renderer (PDF) + cr-writeback (vault PATCH)
  → carte Telegram validation (5 boutons, TTL 7j) si action sensible
  → user clic → callback handlers/* → action finale
```

Webhook ack < 5s exigé par Telegram (sinon retry). Toute action lourde (LLM, Drive PATCH, PDF) est faite après ack via la même request (Replit autoscale = pas de fire-and-forget cf R-Replit autoscale).

---

## Modèles LLM utilisés

| Modèle | Usage | Rationale (audit S16) |
|---|---|---|
| **Haiku 4.5** (`claude-haiku-4-5-20251001`) | Triage email (`triage/`), router inbox | Coût × 5 inférieur à Sonnet, suffisant pour classification 6 catégories. Matrice confusion 100%/100% sur 20 fixtures. |
| **Sonnet 4** (`claude-sonnet-4-20250514`) | Génération CR de réunion, draft email Gmail | Qualité critique sur registre juridique français, formules contraintes @legal, retry self-correction Zod. |
| **Whisper** (OpenAI) | STT vocaux Telegram | Standard FR, latence acceptable, pas d'alternative Anthropic native. |

**Split modèles documenté S15** dans `llm-provider-evaluation-kimi-vs-anthropic.md` (statu quo Anthropic confirmé, ROI < 3 sur alternatives). Migration progressive Sonnet 4 → Sonnet 4.6 prévue via wrapper LLM unifié (cf R1 audit S16).

---

## Modules clés (`src/lib/secretariat/`)

| Module | Rôle |
|---|---|
| `email-ingest/` | Pipeline Gmail (cron 1h) : fetch nouveaux emails labels, triage, dispatch handler. |
| `gmail-source/` | Fetch Gmail brut par label, parsing MIME, déduplication. |
| `triage/` | Classification Haiku 4.5 (6 catégories : apporteur, candidat, contact-pro, locataire, a-classifier, autre). Prompt versionné `triage-v1.md`. |
| `handlers/` | 6 handlers métier : `apporteur`, `candidat`, `contact-pro`, `locataire`, `a-classifier`, `cr-writeback`. Template unifié via `handlers/types.ts`. |
| `telegram-validation/` | Pending-store Drive (TTL 7j R3) + cards 5 boutons (valider / modifier / no-match / skip / délai). |
| `ticktick/` | OAuth direct + polling 15min + iCal export + **mirror-renderer** (régénère `03. Tâches/Todo.md` depuis TickTick). Modèle S20 : TickTick = hub unique create-only, `Todo.md` = miroir read-only. Voir `docs/ia/ticktick-gap-analysis-s20.md` et vault SOT `08. Outils/Anya/Skills/Workflow Todo.md`. |
| `ticktick-sync/` | **DEPRECATED S20** — ancien moteur bidirectionnel push/pull S18 (vault canonique). Désactivé via `TICKTICK_SYNC_LEGACY_DISABLED=1` + crons GitHub commentés. Suppression définitive S21 après 24h de validation du miroir read-only. |
| `health-monitor/` | 7 items surveillés (Drive, Calendar, Gmail, TickTick, Anthropic, Whisper, FS) + budget alerte mensuel + cron daily. |
| `vault-client/` | Écriture vault Drive : `updateFileContent()` PATCH in-place (R5), `createFile()`, `searchByName()`. |
| `vault-reader/` | Lecture live vault Drive : `getFileContent()`, `findByPath()`, cache mémoire TTL 1h. |
| `rent/` | Quittance loyer + bail meublé + lettre fin-de-bail. Génération PDF/DOCX, write vault `09. Administratif/`. |
| `cr-writeback/` | Append CR à la fiche entité (`upsertCrSection`) via PATCH in-place R5. Idempotence par `includes(webViewLink)`. |
| `pdf-generator` + `cr-renderer` | PDF CR conforme contraintes @legal (formules, structure 4 sections, dates). Stockage dans entité-folder Drive. |

---

## Sources de vérité

- **Vault Drive Obsidian** (`00. Me/`) = SOT pour toutes données patrimoniales/contacts/CR (R1). Tout est lu live via `vault-reader`, jamais hardcodé.
- **Pending-store Drive** (`_Inbox/AnyaState/`) = TTL 7j pour cartes Telegram en attente validation (R3). JSON atomique (.tmp + rename).
- **Logs Anya** (`_Inbox/AnyaLogs/YYYY-MM-DD.jsonl`) = audit trail append-only.
- **Édition fichiers Drive** = PATCH in-place via `_zap_raw_request` (`/upload/drive/v3/files/{fileId}?uploadType=media`) (R5). Jamais create+delete (casse fileId, wikilinks Obsidian, partages).

---

## Tracking & budget

`src/lib/secretariat/health-monitor/anthropic-usage.ts` (221L) persiste l'usage Anthropic mensuel (tokens input/output, cache reads, coût USD→EUR conversion 0,92). Budget alerte 50 EUR/mois (env `ANTHROPIC_BUDGET_EUR`) déclenche un item santé non-OK à 95%. **À unifier en S17** via wrapper LLM (R1 audit) — actuellement 3 appels webhook ne passent pas par `recordAnthropicUsage()`, sous-estimation 60-80%.

Évaluations modèles : `llm-provider-evaluation-kimi-vs-anthropic.md` + `llm-provider-evaluation-opensource-alternatives.md` (statu quo Anthropic confirmé S15).

---

## Tests

- **1255+ tests verts** baseline S16 (Vitest).
- Matrice confusion triage : **100% precision / 100% recall** sur 20 fixtures (`triage/__tests__/eval.test.ts`).
- E2E webhook Telegram couvert.
- 27 tests write-back (`cr-writeback`) incluant idempotence + section création.
- `__tests__/cr-mode-solo.test.ts` (S16) couvre les CR de réunion solo (sans participant externe).

---

## Stack environnement

| | |
|---|---|
| Runtime | Node.js / TypeScript strict |
| Framework | Next.js 14 App Router (API routes) |
| Hébergement | Replit (autoscale — pas de fire-and-forget) |
| LLM | Anthropic SDK (Haiku 4.5 + Sonnet 4) + OpenAI SDK (Whisper) |
| Validation | Zod (schémas Telegram + Claude responses) |
| Auth Google | OAuth2 refresh token (scopes : `drive` + `calendar.events` + `gmail.readonly` + `gmail.modify`) |
| PDF / DOCX | PDFKit + docx |
| EXIF photos | exifr (JPEG) + ExifReader (HEIC) |
| Tests | Vitest |

---

## Évolutions S17 prévues (extraites audit)

1. **R1 — Wrapper LLM unifié** `src/lib/secretariat/llm/client.ts` : centraliser les 6 call sites, `cache_control` par défaut, `recordAnthropicUsage()` universel.
2. **R2 — Migrer `PROJET_FICHE_FILE_IDS` hardcodé** dans `cr-writeback.ts:38-43` vers `vault-reader.searchByName()` (ferme dette R7).
3. **R3 — Archivage docs S4** : FAIT en S17 (ce fichier, voir `docs/archive/secretariat-s4-whatsapp-craft/`).

---

## Documents associés vivants

- `docs/ia/anya-spec.md` — fiche technique partageable (S14, à relire en S17 pour MAJ tests 1255 + S16 cr-mode-solo).
- `docs/ia/anya-audit-s16.md` — audit complet S16 (référence pour reco S17).
- `docs/ia/Anya - Reponse questionnaire vault-paths.md` — paths vault Drive vérifiés (S14).
- `docs/ia/anya-ticktick-prompt-v2.md` — plan futur sync bidirectionnel TickTick (en attente arbitrages Thomas).
- `docs/ia/llm-provider-evaluation-*.md` — comparatifs modèles S15.
