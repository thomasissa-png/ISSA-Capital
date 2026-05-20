---
skill: email-ingest
version: 1.0
session_creation: S19 (2026-05-20)
volume_estime: ~50-100 emails/jour
modules_code:
  - src/lib/secretariat/email-ingest/
  - src/lib/secretariat/gmail-source/
  - src/lib/secretariat/triage/
  - src/lib/secretariat/handlers/ (6 handlers)
  - src/lib/secretariat/llm/client.ts
modeles_llm:
  - haiku-4-5 (claude-haiku-4-5-20251001) — triage 6 catégories
trigger_principal: cron 1h Gmail
output_principal: dispatch vers handler dédié + carte Telegram validation 5 boutons
---

# Workflow Email Ingest — pipeline Gmail cron 1h, triage Haiku 4.5, dispatch handler

> Source : `src/lib/secretariat/email-ingest/` + `triage/` + `handlers/`. Pipeline parent : cron Replit. Architecture : voir `docs/ia/anya-current-architecture.md`. Matrice confusion triage : **100% precision / 100% recall** sur 20 fixtures (`triage/__tests__/eval.test.ts`).

## 1. Trigger

**Ce qui lance le workflow.**

### Déclencheur principal — cron horaire
- Cron Replit : fetch Gmail toutes les heures (par labels surveillés).
- Pas de webhook push Gmail [À CONFIRMER : push notifications Gmail non utilisées car cron 1h suffisant pour la cadence].

### Variantes ciblées
- Fetch incrémental : utilise checkpoint (dernier `historyId` Gmail OU dernier `internalDate` traité) pour ne pas re-traiter les mêmes emails. Persistance checkpoint dans Drive [À CONFIRMER chemin : `_Inbox/AnyaState/email-checkpoint.json` ?].
- Déduplication : `gmail-source/` déduplique par `messageId` Gmail.

### Hors trigger
- Vocaux Telegram → workflow Voice STT.
- Photos Telegram → workflow Inbox Photo Batch.
- Notes Telegram → handler conversationnel inline ou workflow CR Réunion (selon > 100 chars).

---

## 2. Input

### Fiches à consulter en début de workflow
- **`01. Contacts/`** — `contacts-cache.ts` (TTL 1h) pour matcher l'expéditeur.
- **`00. Me/hot-context.md`** — pas lu directement par le triage (économie tokens), mais lu par les handlers downstream si nécessaire.

### Sources à scanner
| Source | Contenu | Origine |
|---|---|---|
| Gmail labels surveillés | Emails non lus depuis dernier checkpoint | `gmail-source/` |
| Contacts cache | Match expéditeur → catégorie probable | `contacts-cache.ts` TTL 1h |
| Checkpoint Drive | `historyId` ou `internalDate` du dernier email traité | `_Inbox/AnyaState/` [À CONFIRMER] |

### Convention de nommage
- **Logs ingestion** : `_Inbox/AnyaLogs/YYYY-MM-DD.jsonl` (audit trail append-only).
- **Checkpoint** : `_Inbox/AnyaState/email-checkpoint.json` [À CONFIRMER nom exact].

### Outils API requis
- **Gmail API** — `users.history.list` ou `users.messages.list` (selon stratégie checkpoint), `users.messages.get`.
- **Anthropic SDK** — Haiku 4.5 via wrapper `llm/client.ts` (R1 S17 — cache_control auto + `recordAnthropicUsage`).
- **vault-client** — pour les handlers downstream qui écrivent dans le vault (write-back R5).
- **Telegram Bot API** — cartes 5 boutons via pending-store Drive TTL 7j R3.

---

## 3. Étapes

### 3.1 Fetch Gmail incrémental
- Cron 1h déclenche `email-ingest/run()`.
- Lecture checkpoint Drive → `lastHistoryId`.
- `users.history.list?startHistoryId=lastHistoryId` → liste des nouveaux messages.
- Fallback si checkpoint absent : `users.messages.list?q=newer_than:1d`.
- Pour chaque message : `users.messages.get` (full body + headers).

### 3.2 Pré-filtre heuristique (S14 — ~70% économie tokens)
Avant tout appel LLM, regex/keywords sur `from` + `subject` + `body[0:200]` :
- `from: noreply@*` OR `unsubscribe` in body → catégorie `autre` (newsletter / notif auto). Pas d'appel LLM.
- `subject: facture` + expéditeur connu prestataire → catégorie `autre` (à archiver côté Thomas).
- Match exact expéditeur dans `contacts-cache.Apporteurs` → catégorie `apporteur` direct.
- Match exact dans `contacts-cache.Locataires` → catégorie `locataire` direct.
- Aucun match heuristique → bascule LLM Haiku 4.5 (étape 3.3).

L'audit S14 [À CONFIRMER session exacte] montre ~70% des emails matchent l'heuristique, économisant 70% des tokens triage.

### 3.3 Triage LLM Haiku 4.5 (si pas filtré)
- Wrapper `llm/client.ts` → Haiku 4.5 (`claude-haiku-4-5-20251001`).
- System prompt versionné `triage-v1.md` [À CONFIRMER chemin] — cache_control auto.
- Input : `from`, `subject`, `body[0:2000]`, contacts-cache résumé.
- Output JSON validé Zod : `{ category: "apporteur" | "candidat" | "contact-pro" | "locataire" | "a-classifier" | "autre", confidence: number, reason: string }`.
- Matrice confusion : 100%/100% sur 20 fixtures (`triage/__tests__/eval.test.ts`).
- Retry x1 si JSON invalide.

### 3.4 Dispatch handler dédié
Selon catégorie : invocation du handler dans `handlers/` :
- `apporteur` → `handlers/apporteur.ts` (RDV, mises en relation, suivi affaires).
- `candidat` → `handlers/candidat.ts` (workflow Fiche Candidat Locataire).
- `contact-pro` → `handlers/contact-pro.ts` (notaire, expert-comptable, avocat, etc.).
- `locataire` → `handlers/locataire.ts` (quittance, demande travaux, signalement).
- `a-classifier` → `handlers/a-classifier.ts` (workflow No-match Contact si expéditeur inconnu).
- `autre` → `handlers/autre.ts` (archivage Gmail label `Archive Anya`).

Template unifié via `handlers/types.ts`.

### 3.5 Carte Telegram validation (selon handler)
- Action sensible (création fiche, draft email, mise à jour vault) → carte 5 boutons via pending-store Drive TTL 7j R3.
- Préfixe callback dédié par handler (R4 P1 #97) : `email_apporteur:`, `email_candidat:`, etc.
- Actions silencieuses (archivage `autre`) → pas de carte.

### 3.6 Audit log + checkpoint
- Append ligne dans `_Inbox/AnyaLogs/YYYY-MM-DD.jsonl` : `{ messageId, from, subject, category, confidence, handler, timestamp }`.
- Mise à jour checkpoint Drive : `lastHistoryId` = max(historyId traités).
- PATCH in-place R5 sur le checkpoint (`updateFileContent`).

---

## 4. Output

### Modifications vault
- **Aucune directement** par le workflow Email Ingest.
- Les handlers downstream écrivent dans le vault selon leur logique (fiche candidat, fiche contact, write-back CR, etc.).

### Modifications Gmail
- Labels Gmail appliqués selon catégorie (ex. `Anya/Apporteur`, `Anya/Candidat`, `Anya/Archive`).
- Aucun envoi automatique. Aucune suppression.

### Quarantaine
- Si triage retourne `confidence < 0.7` [À CONFIRMER seuil exact] → catégorie `a-classifier` + carte Telegram Thomas pour décision manuelle.
- Si LLM échoue 2× → email reste sans label, warn Telegram à Thomas.

### Récap (gabarit Telegram envoyé à Thomas — selon handler)
```
Email triagé : [catégorie]

De : [from]
Sujet : [subject]
Confiance : [confidence]
Handler : [handler]

[Action proposée par handler — carte 5 boutons]
```

---

## 5. Méthode

### 5.1 Red lines (interdictions)
- **JAMAIS de classification sans contact-cache** vérifié (sauf pré-filtre heuristique `autre`). Un email d'expéditeur inconnu → workflow No-match Contact d'abord.
- **JAMAIS d'appel Anthropic direct** — uniquement via wrapper `llm/client.ts` (R1 S17 — sinon non tracké).
- **JAMAIS de suppression Gmail** — uniquement labels (Thomas garde la main).
- **JAMAIS de modification vault directement** — les handlers s'en chargent (séparation des responsabilités).
- **JAMAIS de re-traitement** du même `messageId` (déduplication obligatoire via checkpoint + log).

### 5.2 Arbre de décision — triage
```
Email reçu
├── Pré-filtre heuristique match ?
│   ├── OUI (~70% cas) → catégorie directe, pas d'appel LLM
│   └── NON → appel Haiku 4.5 triage
│       ├── confidence ≥ 0.7 → dispatch handler dédié
│       └── confidence < 0.7 → catégorie `a-classifier` + carte Telegram
└── Dispatch handler ad hoc selon catégorie
```

### 5.3 Critères de qualité
- **G1 (matrice confusion 100%/100%)** sur 20 fixtures de référence (`triage/__tests__/eval.test.ts`). Toute régression bloque le merge.
- **G2 (idempotence)** : re-jouer le même cron 2× ne re-traite pas les mêmes emails (checkpoint + déduplication messageId).
- **G3 (tracking 100%)** : tous les appels Anthropic passent par `recordAnthropicUsage()` (R1 S17 wrapper LLM).
- **G4 (pré-filtre heuristique efficace)** : ~70% des emails skip LLM (audit mensuel à recalculer via logs).
- **G5 (cache hit Anthropic)** : `cache_read_input_tokens` > 0 sur runs cron suivants (system prompt triage stable caché).

### 5.4 Exemple complet (cas réel)
**Email reçu** : `from: karim@[domaine].fr / subject: Compromis Henri Barbusse 3 — RDV notaire`

**Pré-filtre heuristique** : `karim@[domaine].fr` matché dans `contacts-cache.Apporteurs` → catégorie `apporteur` direct, pas d'appel LLM. Économie ~500 tokens.

**Dispatch** : `handlers/apporteur.ts` reçoit l'email.

**Action handler** : détecte une demande de confirmation RDV → propose à Thomas un draft de réponse via workflow Draft Email → carte Telegram 2 boutons "Rédiger réponse / Ignorer".

**Audit log** :
```json
{ "messageId": "abc123", "from": "karim@...", "subject": "Compromis Henri Barbusse 3 — RDV notaire", "category": "apporteur", "confidence": 1.0, "handler": "apporteur", "filter": "heuristic", "timestamp": "2026-05-20T08:00:00Z" }
```

### 5.5 Maintenance
- **Mise à jour fixtures triage** : ajouter de nouveaux cas dans `triage/__tests__/eval.test.ts` à chaque évolution du business (nouveau type contact, nouveau handler).
- **Calibration confiance** : seuil 0.7 [À CONFIRMER] revu trimestriellement selon faux positifs `a-classifier`.
- **Cache TTL** : contacts cache 1h.
- **Modèle LLM** : si migration Haiku 4.5 → version suivante, modifier `llm/models.ts`. Override env possible.
- **Logs JSONL** : rotation mensuelle (compression / archivage si volume > X MB) [À CONFIRMER stratégie rotation].

### 5.6 Changelog skill
| Session | Date | Changement |
|---|---|---|
| S9 | 2026-04-09 | Mise en production Anya (workflow email ingest opérationnel). |
| S10-S14 | — | Itérations triage : passage de 5 à 6 catégories, ajout `a-classifier`. |
| S14 | — | Pré-filtre heuristique introduit (~70% économie tokens) [À CONFIRMER session exacte]. |
| S15 ou S14 | — | Matrice confusion 100%/100% sur 20 fixtures [À CONFIRMER session exacte]. |
| S17 | 2026-05-19 | Migration wrapper LLM unifié (R1) — cache_control auto + tracking 100%. |
| S19 | 2026-05-20 | Documentation skill formalisée (ce fichier). |

---

**Volume estimé** : ~50-100 emails/jour (selon période). Coût Anthropic optimisé par pré-filtre + cache_control system prompt triage stable. Estimation < 5 EUR/mois pour le workflow triage seul.

## À confirmer (Thomas)

- [À CONFIRMER] ID exact du modèle Haiku 4.5 : `claude-haiku-4-5-20251001` (sourcé dans `anya-current-architecture.md`) — bien à jour ?
- [À CONFIRMER] Chemin persistance checkpoint Gmail : `_Inbox/AnyaState/email-checkpoint.json` ?
- [À CONFIRMER] Session exacte d'introduction du pré-filtre heuristique (S14 ou autre).
- [À CONFIRMER] Session exacte de la matrice confusion 100%/100% (S14 ou S15).
- [À CONFIRMER] Seuil confiance pour bascule `a-classifier` : 0.7 ?
- [À CONFIRMER] Stratégie rotation des logs JSONL (`_Inbox/AnyaLogs/`).
- [À CONFIRMER] Push notifications Gmail (webhook Google) non utilisées — cron 1h suffisant ?
- [À CONFIRMER] Chemin exact `triage-v1.md` system prompt versionné.
