---
skill: voice-stt
version: 1.0
session_creation: S19 (2026-05-20)
volume_estime: ~5-10/jour
modules_code:
  - src/lib/secretariat/stt/whisper.ts [À CONFIRMER chemin]
  - src/app/api/telegram/webhook/route.ts
modeles_llm:
  - whisper (OpenAI) — STT FR
trigger_principal: message vocal Telegram (.ogg/Opus)
output_principal: transcript texte re-dispatché dans le router principal (pas d'output direct vault)
---

# Workflow Voice STT — transcription vocale Telegram via Whisper OpenAI

> Source : `src/lib/secretariat/stt/whisper.ts` [À CONFIRMER chemin]. Pipeline parent : webhook Telegram (`src/app/api/telegram/webhook/route.ts`). Architecture : voir `docs/ia/anya-current-architecture.md`. Décision S13 : Whisper > Google STT pour raisons de billing [À CONFIRMER verbatim].

## 1. Trigger

**Ce qui lance le workflow.**

### Déclencheur principal — message vocal Telegram
- Message Telegram de type `voice` envoyé par Thomas au bot Anya.
- Format : `.ogg` (codec Opus, format natif Telegram voice).
- Dispatch par signature bytes (MIME inferé, pas Content-Type — règle dispatch dans `anya-current-architecture.md`).

### Variantes ciblées
- **Vocal court** (< 10s, < 1000 chars transcrit) : traitement comme message texte court → handler conversationnel inline.
- **Vocal long** (≥ 10s OU ≥ 100 chars transcrit) : peut déclencher workflow CR Réunion (seuil 100 chars).
- **Vocal multi-segments** (Thomas envoie plusieurs vocaux successifs) : chaque vocal traité individuellement, pas de concaténation automatique [À CONFIRMER comportement souhaité].

### Hors trigger
- Messages texte → router texte standard.
- Vidéos / audio joints en `document` → workflow différent (analyse document) [À CONFIRMER existence].

---

## 2. Input

### Fiches à consulter en début de workflow
- **Aucune** — le workflow STT est purement transcriptionnel. Les fiches sont consultées par les workflows downstream (CR Réunion, draft email, etc.) après re-dispatch.

### Sources à scanner
| Source | Contenu | Origine |
|---|---|---|
| Telegram update | `message.voice` avec `file_id` | webhook update |
| Telegram File API | Binaire .ogg téléchargé | `getFile` puis download URL |

### Outils API requis
- **Telegram Bot API** — `getFile(file_id)` → URL temporaire, puis téléchargement binaire .ogg.
- **OpenAI SDK** — `audio.transcriptions.create()` modèle `whisper-1` [À CONFIRMER ID exact].
- **Wrapper LLM** : non applicable (Whisper n'est pas Anthropic) — tracking séparé via `anthropic-usage.ts` ne s'applique pas. Tracking Whisper [À CONFIRMER existence ou TODO].

---

## 3. Étapes

### 3.1 Ack webhook < 5s
Webhook Telegram ack immédiat. Téléchargement + transcription + re-dispatch se font dans la même request (Replit autoscale).

### 3.2 Téléchargement du fichier .ogg
- `getFile(file_id)` → URL Telegram temporaire (`https://api.telegram.org/file/bot<TOKEN>/<file_path>`).
- Download binaire (max 20 MB Telegram pour bots, en pratique vocaux Thomas << 1 MB).
- Stockage temporaire en mémoire ou `/tmp` Replit [À CONFIRMER stratégie : streaming direct vers OpenAI ou fichier temporaire ?].

### 3.3 Appel Whisper OpenAI
- `audio.transcriptions.create({ file: oggBuffer, model: "whisper-1", language: "fr" })`.
- Paramètres : `language: "fr"` forcé (Thomas francophone — évite 5-10% latence détection auto).
- Timeout : [À CONFIRMER valeur configurée, 30s typiquement].
- Pas de retry automatique par défaut [À CONFIRMER stratégie retry sur erreur 5xx].

### 3.4 Suppression audio brut (privacy)
- Le fichier .ogg n'est PAS persisté dans le vault ni en logs.
- Buffer mémoire libéré après transcription (garbage collection JS).
- Si stockage temporaire `/tmp`, suppression explicite (`unlink`) après usage.

### 3.5 Re-dispatch dans le router principal
- Le transcript texte est injecté dans le pipeline comme s'il s'agissait d'un message texte natif Telegram.
- Routage selon longueur :
  - < 100 chars → handler conversationnel inline (Sonnet 4).
  - ≥ 100 chars → workflow CR Réunion (mode multi-participants ou solo selon contenu).
- Conservation du `chat_id` et `message_id` d'origine pour la réponse Telegram.

### 3.6 Confirmation Telegram (optionnelle)
- Si transcript long et déclenche CR Réunion → message intermédiaire "Vocal reçu (45s), transcription en cours…" pour rassurer Thomas que le traitement avance.
- Sinon, la réponse du handler downstream sert de confirmation.

---

## 4. Output

### Modifications vault
- **Aucune** par ce workflow.
- Les workflows downstream (CR Réunion, draft email, etc.) peuvent écrire dans le vault selon leur logique.

### Quarantaine
- Si Whisper échoue (rate limit, fichier corrompu, langue non détectée) → message Telegram à Thomas "Transcription échouée. Peux-tu réessayer en écrivant ?". Audio non persisté.
- Si transcript vide (vocal silencieux ou trop court) → message Telegram "Vocal vide ou inaudible".

### Récap (gabarit Telegram envoyé à Thomas)
Pas de récap dédié — le transcript déclenche directement les workflows downstream qui produisent leurs propres récaps. Sauf en cas d'erreur.

---

## 5. Méthode

### 5.1 Red lines (interdictions)
- **JAMAIS conserver l'audio brut au-delà du traitement** (privacy / RGPD). Buffer libéré post-Whisper, aucun stockage Drive du .ogg.
- **JAMAIS envoyer l'audio à un STT tiers non choisi** — uniquement Whisper OpenAI (décision S13).
- **JAMAIS logger le transcript en clair** dans `_Inbox/AnyaLogs/` au-delà de la fenêtre nécessaire [À CONFIRMER politique de log retention pour vocaux].
- **JAMAIS bypass le router principal** — le transcript DOIT passer par le dispatch standard (pas d'appel direct à un handler depuis le STT).

### 5.2 Critères de qualité
- **G1 (transcription correcte)** : Whisper FR standard, qualité acceptable pour usage Thomas (immobilier, juridique simple, conversationnel). Pas de benchmark formel [À CONFIRMER existence d'un set de fixtures vocales].
- **G2 (privacy)** : audio brut jamais persisté, transcript pas logué en clair durablement.
- **G3 (re-dispatch fidèle)** : le transcript déclenche EXACTEMENT le même chemin qu'un message texte natif (zéro divergence comportementale).
- **G4 (latence)** : transcription < 5s pour un vocal de 30s typique [À CONFIRMER mesure réelle].

### 5.3 Exemple complet (cas réel)
**Input Telegram** : Thomas envoie un vocal de 45s : *"Visite seul du lot rue Henri Barbusse Nanterre 2 ce matin. Lot 2 vide, état correct, peinture à refaire avant relocation. Compteurs OK. Prévoir devis peintre, photos pour annonce, planning relocation visé 1er juin."*

**Pipeline** :
1. Webhook reçoit `message.voice` avec `file_id`.
2. `getFile(file_id)` → URL Telegram → download .ogg (≈ 180 KB).
3. Appel Whisper OpenAI `whisper-1`, `language: "fr"`.
4. Transcript reçu (≈ 280 chars, > 100 chars).
5. Buffer audio libéré.
6. Re-dispatch dans le router → seuil 100 chars dépassé → bascule workflow CR Réunion mode solo (aucun tiers nommé).
7. CR généré (PDF + write-back fiche) — voir `Workflow CR Reunion.md`.

**Latence totale observée** : ≈ 4-6s [À CONFIRMER mesure].

### 5.4 Maintenance
- **Modèle Whisper** : si OpenAI publie `whisper-2` ou équivalent, A/B test possible via env var `WHISPER_MODEL_OVERRIDE` [À CONFIRMER existence].
- **Surveillance erreurs** : item `Whisper` du `health-monitor` (cf workflow Health Monitor) — ping daily.
- **Coût** : Whisper OpenAI ≈ $0.006/minute. Volume 5-10 vocaux/jour × 30s moyenne ≈ 1,5-3 min/jour ≈ $0,01/jour ≈ $0,30/mois. Négligeable.
- **Évolution langue** : forçage `language: "fr"` actuel — si Thomas envoie un vocal en anglais, qualité dégradée. À voir si détection auto active (trade-off latence vs flexibilité).

### 5.5 Changelog skill
| Session | Date | Changement |
|---|---|---|
| S13 | — | Décision Whisper > Google STT pour raisons de billing [À CONFIRMER verbatim Thomas]. |
| S? | — | Mise en production STT vocaux Telegram [À CONFIRMER session origine]. |
| S19 | 2026-05-20 | Documentation skill formalisée (ce fichier). |

---

**Volume estimé** : ~5-10 vocaux/jour (Thomas en mobilité). Coût Whisper < 1 EUR/mois. Pas de coût Anthropic direct (le re-dispatch coût est imputé au workflow downstream).

## À confirmer (Thomas)

- [À CONFIRMER] Chemin exact du module : `src/lib/secretariat/stt/whisper.ts` ?
- [À CONFIRMER] ID exact du modèle Whisper utilisé : `whisper-1` ?
- [À CONFIRMER] Décision S13 verbatim "Whisper > Google STT pour billing" — texte exact à citer ?
- [À CONFIRMER] Stratégie retry sur erreur Whisper (5xx, timeout) : retry x1 ? aucun ?
- [À CONFIRMER] Stockage temporaire .ogg : streaming direct vers OpenAI ou fichier `/tmp` ?
- [À CONFIRMER] Tracking coût Whisper séparé du tracking Anthropic — existe-t-il dans `health-monitor` ?
- [À CONFIRMER] Fixtures vocales pour benchmark transcription (existe-t-il un set de référence ?).
- [À CONFIRMER] Comportement vocaux multi-segments successifs (concaténation auto ou traitement individuel).
- [À CONFIRMER] Politique log retention pour transcript en clair dans `_Inbox/AnyaLogs/`.
