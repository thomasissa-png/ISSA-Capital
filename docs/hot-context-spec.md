# Spec — Module Anya `hot-context-updater` (Phase A)

> **Auteur** : orchestrator S19 — 2026-05-19 (révisé Claude principal après lecture vault Drive R1)
> **Statut** : DRAFT — attente arbitrage Thomas sur §0 avant Phase B
> **Source de vérité** : `08. Outils/Workflow Hot Context.md` (fileId `1m-7PnVDPEYUctwMW4LKRhNq-Wm4Tby4Q`) + `00. Me/hot-context.md` (fileId `1EthLJcedWMHIH6lIJzvXaaGzVylIGjEe`) + décisions S19 verbatim Thomas
> **Cible** : maintenir `00. Me/hot-context.md` entre revues hebdo Thomas dimanche

---

## 0. Alignement vault Drive — ARBITRAGES TRANCHÉS Thomas S19

L'orchestrator n'a pas eu accès aux MCP Drive. Claude principal a lu les 2 fichiers vault directement. **Thomas a tranché les 3 contradictions** :

### A. Cible tokens → **500** ✅ TRANCHÉ
- Décision : on suit `Workflow Hot Context.md` (500 tokens).
- **Action Phase C** : mettre à jour le frontmatter `hot-context.md` vault `budget_tokens: ~300` → `budget_tokens: ~500` (PATCH R5).
- Le token-estimator émet un warn-only au-delà de 500 (la carte Telegram affiche le delta, Thomas valide quand même si pertinent).

### B. Format sections → **4 sections actuelles** ✅ TRANCHÉ
- Décision : V1 sur les 4 sections existantes (Je bouge sur / J'attends / Décisions en arbitrage / Maintenance).
- **Action Phase C** : mettre à jour `Workflow Hot Context.md` vault pour refléter le format 4 sections (les 5 blocs historiques sont obsolètes). PATCH R5.
- Personnes à recontacter + Red lines actifs : pas dans V1, ré-arbitrage possible en V2.

### C. Trigger → **cron 5min** ✅ TRANCHÉ (S19)
- Décision S19 Thomas prévaut sur le Workflow doc.
- **Action Phase C** : annoter le Workflow Hot Context.md vault pour mentionner cron 5min (et non plus "à la fin de chaque CR / email").

### D. Red lines vault NON intégrées par orchestrator → injectées §2.1 ci-dessous
- Pas d'invention (source vérifiable obligatoire) — cohérent CLAUDE.md commandement 2
- Pas de doublon avec fiches projet — chaque item DOIT contenir un wikilink vers la fiche source
- Pas de montants confidentiels (red-line P1 #11 — pas marges, pas prix d'achat)
- Format télégraphique, phrases courtes
- Suppression silencieuse interdite — toute remove = validation Telegram (déjà couvert)

---

## 1. Périmètre V1

### 1.1 Fichier cible (vault Drive)
- **Chemin** : `00. Me/hot-context.md`
- **fileId** : résolu live via `vault-reader` (R7 — pas de hardcoded)
- **Édition** : PATCH in-place via `_zap_raw_request` (R5)

### 1.2 Sections gérées (4)
| # | Section | Anya touche ? | Format |
|---|---|---|---|
| 1 | « Je bouge sur (cette semaine) » | OUI (add/remove) | liste 3-7 puces |
| 2 | « J'attends » | OUI (add/remove) | tableau Quoi/De qui/Depuis/Note |
| 3 | « Décisions en arbitrage » | OUI (add/remove) | liste avec contexte court |
| 4 | « Maintenance » | **NON — red line** | footer fixe, INTOUCHABLE |

### 1.3 Sources de signaux (4)
1. **Emails ingérés** — pipeline `email-ingest` existant (events JSONL `_Inbox/AnyaLogs/email-ingest-YYYY-MM-DD.jsonl`)
2. **CR de réunion vault** — fichiers `06. Réunions/YYYY/MM/*.md` créés/modifiés depuis dernier scan
3. **Messages Telegram explicites Thomas** — payload `text` contenant tag `#hotcontext` OU mention "Anya note" (heuristique) → hook dans `webhook/route.ts`
4. **Notes vault récemment modifiées** — `list_recent_files` Drive (24h glissantes, exclus `_Inbox/`, `Templates/`, `Archive/`)

### 1.4 Types de patch (4)
```ts
type PatchAction = 'add' | 'remove';
type PatchSection = 'bouge' | 'attends' | 'arbitrage';

interface Patch {
  patchId: string;                 // sha1(signalId + targetLine)
  section: PatchSection;
  action: PatchAction;
  payload: BougePayload | AttendsPayload | ArbitragePayload;
  signalId: string;                // idempotence (cf §3)
  source: 'email' | 'cr' | 'telegram' | 'vault-note';
  sourceId: string;                // emailId | filePath | telegramMsgId
  proposedAt: string;              // ISO timestamp
  rationale: string;               // 1 ligne — pourquoi Anya propose
}

interface BougePayload     { text: string }                                   // ≤ 80 chars
interface AttendsPayload   { quoi: string; deQui: string; depuis: string; note?: string }
interface ArbitragePayload { sujet: string; contexte: string }                // contexte ≤ 120 chars
```

---

## 2. Prompt Haiku 4.5 — détection signal

### 2.1 Entrée (input)
```
SYSTEM (cached):
  ROLE: détecter signaux impactant hot-context.md (4 sections cibles).
  RED LINES (vault Workflow Hot Context.md) — INVIOLABLES :
    1. PAS d'invention. Si le signal ne porte pas explicitement une info sur 1 des 4 sections → retourner null.
    2. PAS de doublon avec fiches projet. payload.text DOIT inclure un wikilink vers la fiche source ([[Personne]], [[Projet]], [[CR YYYY-MM-DD]]).
    3. PAS de montants confidentiels (red-line P1 #11). Filtrer marges, prix d'achat, valorisations privées. Montants publics OK uniquement.
    4. FORMAT télégraphique. Phrases courtes, factuelles. Pas de narratif tutoiement/vouvoiement.
    5. SUPPRESSION (action 'remove') = nécessite signal explicite de résolution (réponse email reçue, CR mentionnant clôture, message Thomas explicite). Jamais inférée.
  FORMAT 4 sections cibles + exemples few-shot (3)
USER: signal brut = { source, type, content_excerpt (≤ 2000 chars), context_meta }
```

### 2.2 Sortie attendue (output)
```json
{ "patch": Patch | null, "confidence": 0.0–1.0, "reason_if_null": "string" }
```

### 2.3 Few-shot (3 exemples)
1. Email avocat « j'attends votre signature avant vendredi » → `{section: 'attends', action: 'add', payload: {quoi: 'Signature acte', deQui: 'Maître X', depuis: '2026-05-15'}}`
2. CR réunion « Décidé : on tranche entre fournisseur A et B avant fin du mois » → `{section: 'arbitrage', action: 'add', payload: {sujet: 'Choix fournisseur A/B', contexte: 'arbitrage avant fin mois'}}`
3. Telegram Thomas « #hotcontext priorité semaine = finaliser pacte associés » → `{section: 'bouge', action: 'add', payload: {text: 'Finaliser pacte associés'}}`

### 2.4 Budget
- 1 appel Haiku max par signal détecté (filtrage amont par préfiltre heuristique : mots-clés `attente|décision|priorité|tranche|finaliser|relance|en attente`)
- Wrapper `llm/client.ts` existant (cache_control auto, recordAnthropicUsage)

---

## 3. State `hot-context-state.json` (Drive)

### 3.1 Chemin
`_Inbox/AnyaState/hot-context-state.json` — PATCH in-place R5

### 3.2 Structure
```ts
interface HotContextState {
  schemaVersion: 1;
  processedSignals: Record<string, { signalId: string; processedAt: string; outcome: 'patched' | 'skipped' | 'rejected' }>;
  pendingPatches: Record<string, { patchId: string; patch: Patch; proposedAt: string; telegramMessageId?: number }>;
  lastScanAt: { email: string; cr: string; telegram: string; vaultNotes: string };
  lastFileTokensEstimate: number;  // pour cap warn
}
```

### 3.3 Idempotence
- `signalId = sha1(source + ':' + sourceId + ':' + section + ':' + action + ':' + canonical(payload))`
- Avant appel Haiku : si `signalId ∈ processedSignals` → skip (event `hot-context-signal-skipped-already-processed`)
- Avant carte Telegram : si patch équivalent déjà `pendingPatches` → skip

---

## 4. Audit JSONL `_Inbox/AnyaLogs/YYYY-MM-DD.jsonl`

Events :
- `hot-context-signal-detected` — `{ source, sourceId, preview }`
- `hot-context-signal-skipped-already-processed` — `{ signalId }`
- `hot-context-patch-proposed` — `{ patchId, section, action, telegramMessageId }`
- `hot-context-patch-applied` — `{ patchId, fileTokensBefore, fileTokensAfter, capWarnTriggered }`
- `hot-context-patch-skipped` — `{ patchId, reason: 'thomas-skip' | 'ttl-expired' | 'modify-cancelled' }`
- `hot-context-patch-modified` — `{ patchId, originalPayload, modifiedPayload }`

---

## 5. Arbre fichiers cible Phase B

```
src/lib/secretariat/hot-context/
├── types.ts                       (Patch, HotContextState, signals)
├── signal-detector.ts             (LLM Haiku — un seul export `detectSignal(input) → Patch | null`)
├── parser.ts                      (markdown → AST 4 sections — détecte red line Maintenance)
├── applier.ts                     (patch + AST → markdown final, PATCH in-place R5)
├── state-store.ts                 (read/write hot-context-state.json, PATCH R5, mutex)
├── scanner.ts                     (4 sources → signaux → file de patches)
├── token-estimator.ts             (estimation tokens cap 300 warn-only)
└── __tests__/                     (≥ 30 tests : voir §7)

src/app/api/secretariat/hot-context/cron-scan/route.ts   (cron 5min)

src/lib/secretariat/telegram-validation/handlers/
└── hot-context-patch.ts           (carte [Valider][Modifier][Skip], TTL 7j R3)

src/lib/secretariat/telegram-validation/webhook/route.ts   (dispatch préfixe `hotcontext:` R4)

.github/workflows/cron-hot-context-scan.yml    (5min, décalé ≥ 1min vs cron-pull TickTick)
```

---

## 6. Workflow Telegram (red line §6 mission)

1. Cron 5min → scanner → signaux → Haiku → patches typés
2. Pour chaque patch : carte Telegram avec 3 boutons callback :
   - `hotcontext:valid:{patchId}` → appliquer patch via applier (PATCH R5) → audit JSONL → notif `✅ Patché`
   - `hotcontext:modify:{patchId}` → bot demande reformulation texte libre → Thomas répond → Anya re-propose nouvelle carte (loop max 2)
   - `hotcontext:skip:{patchId}` → state `processedSignals[signalId].outcome = 'rejected'` → audit `hot-context-patch-skipped`
3. TTL pending = 7 jours (R3). Au-delà : purge auto + event `hot-context-patch-skipped:ttl-expired`
4. Cap 300 tokens warn-only : carte annonce « après merge : 330 tokens (cap dépassé) » — Thomas valide quand même

---

## 7. Tests cibles (≥ 30)

- **parser** (6) : 4 sections détectées / red line Maintenance / sections manquantes / ordre préservé / UTF-8 / fichier vide
- **applier** (6) : add bouge / remove bouge / add attends (tableau) / remove attends / add arbitrage / Maintenance intouchable (FAIL test)
- **state-store** (4) : read empty / write + read / PATCH in-place / mutex concurrent
- **signal-detector** (4) : email pertinent / email bruit (null) / Telegram #hotcontext / CR réunion
- **scanner** (4) : 4 sources mockées / idempotence cross-run / lastScanAt mis à jour / aucun signal = no-op
- **cron route** (2) : 200 OK + scan / 500 si state corrompu
- **telegram handler** (5) : valid / modify (loop) / skip / TTL expired / unknown patchId
- **idempotence E2E** (1) : même signal 2× = 1 seule carte
- **cap warn** (2) : sous 300 = no warn / au-dessus = carte warn but apply

**Total** : 34 tests neufs.

---

## 8. Risques + mitigations

### R-A : race condition cron Anya vs édition manuelle Thomas Obsidian
- **Symptôme** : Anya PATCH au moment où Thomas écrit dans Obsidian mobile → l'un écrase l'autre (Drive last-write-wins)
- **Mitigation** : avant `applier`, re-lire `hot-context.md` live (PATCH in-place sur contenu fraîchement re-lu), parser, appliquer patch sur AST à jour, re-sérialiser, PATCH. Pas de cache contenu. Mutex mémoire par fileId (write-lock.ts existant).

### R-B : dérive cumul tokens (>300 silencieuse)
- **Symptôme** : 10 patches « add bouge » successifs → fichier explose à 500 tokens
- **Mitigation** : `token-estimator.ts` calcule estimation après chaque patch ; carte Telegram affiche delta visible ; Thomas voit la dérive et nettoie manuellement dimanche

### R-C : faux positifs Haiku
- **Symptôme** : Haiku propose patch sur signal anodin (email automatique, footer signature)
- **Mitigation** : (a) pré-filtre heuristique avant appel Haiku, (b) carte Telegram avec preview source dans le `rationale` permet Thomas de skip rapide, (c) métrique `acceptance_rate` trackée dans audit JSONL pour calibrer le prompt après 1 semaine de prod

---

## 9. Hors scope V1 (reporté V2)
- Pull batch hebdo dimanche (auto-condensation pré-revue Thomas)
- Suggestion proactive « cette ligne traîne depuis X jours, à archiver ? »
- Multi-utilisateur (mono-user S16-S19)
- Métriques dashboards (acceptance rate, dérive tokens) — pour l'instant grep JSONL

---

## 10. Critères de done Phase B

- 34 tests verts mockés (zéro réseau CI)
- `npx tsc --noEmit && npx next lint && npm run build` OK (commandement 6)
- Nouveau préfixe callback `hotcontext:` : handler + dispatch + test E2E (R4)
- vault-reader résout `hot-context.md` et `hot-context-state.json` live (R7)
- Cron GitHub Actions 5min décalé ≥ 1min vs `cron-pull` TickTick (évite collision quota Drive)
- 1 patch end-to-end validé visuellement par Thomas dans Obsidian avant déclaration done (R6)
