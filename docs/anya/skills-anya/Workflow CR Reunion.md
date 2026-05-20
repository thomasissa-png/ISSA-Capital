---
skill: cr-reunion
version: 1.0
session_creation: S19 (2026-05-20)
volume_estime: ~16 PDF/mois
modules_code:
  - src/lib/secretariat/cr-renderer/
  - src/lib/secretariat/pdf-generator/
  - src/lib/secretariat/cr-writeback/
  - src/lib/secretariat/vault-reader/
  - src/lib/secretariat/vault-client/
modeles_llm:
  - sonnet-4 (claude-sonnet-4-20250514) — génération CR
trigger_principal: note Telegram > 100 caractères
output_principal: PDF dans entité-folder Drive + section CR append fiche entité vault
---

# Workflow CR Réunion — produire un compte rendu PDF + propagation vault

> Source : `src/lib/secretariat/cr-renderer/` + `src/lib/secretariat/cr-writeback/`. Pipeline parent : webhook Telegram (`src/app/api/telegram/webhook/route.ts`). Architecture : voir `docs/ia/anya-current-architecture.md` (S16-S17). Modes : multi-participants (historique) + solo (S16, REGLE 14 system prompt).

## 1. Trigger

**Ce qui lance le workflow.**

### Déclencheur principal — note Telegram
- Message texte envoyé à Anya (bot Telegram, conversation privée Thomas).
- **Seuil auto-CR** : 100 caractères (décision S13). Sous ce seuil → traité comme message court conversationnel, pas comme matière CR.
- Vocaux Telegram → STT Whisper en amont → re-dispatch → si transcript > 100 chars, le workflow CR peut s'enclencher.

### Variantes ciblées
- **Mode multi-participants** (historique S10-S15) : la note mentionne ≥ 1 participant tiers nommé.
- **Mode solo** (S16, REGLE 14 system prompt) : la note décrit une activité sans tiers (visite immo seul, signature notariale solo, activité perso). Section "Présent" remplace "Participants". Détection automatique par le prompt — pas de clarification systématique demandée à Thomas.

### Hors trigger
- Photos sans note associée → workflow Inbox Photo Batch.
- Emails → workflow Email Ingest.
- Note < 100 chars → handler conversationnel inline (Sonnet 4) sans génération PDF.

---

## 2. Input

### Fiches à consulter en début de workflow
- **Fiche entité concernée** dans `02. Projets/02. Pro/` (résolue dynamiquement par `vault-reader.findProjetFicheByEntite()` depuis S17 — fini le hardcoded `PROJET_FICHE_FILE_IDS`).
- **`00. Me/hot-context.md`** (briefing maintenu par le workflow Hot Context Updater) — contexte récent injecté dans le system prompt.
- **Contacts cache** (`contacts-cache.ts`, TTL 1h) — si participants nommés à matcher.

### Sources à scanner
| Source | Contenu | Origine |
|---|---|---|
| Note Telegram brute | Matière première CR (verbatim Thomas) | webhook update |
| Vault entity folder | Nom canonique projet + fileId fiche | `vault-reader.findProjetFicheByEntite()` |
| `00. Me/hot-context.md` | Briefing live (4 sections, cible 500 tokens) | vault-reader cache TTL 1h |
| Fiche entité Projet | Section "## Compte rendu" si existante (idempotence) | vault-reader (lecture live) |

### Convention de nommage
- **PDF Drive** : `[YYYY-MM-DD] CR — [Nom Projet] — [Objet court].pdf` (naming INCHANGÉ depuis S15, décision Thomas verbatim).
- **Dossier Drive de destination** : entité-folder (sous-dossier projet dans Drive), résolu par lookup nom canonique.
- **Section vault** : `## Compte rendu` dans la fiche entité, nouveaux CR ajoutés en premier (ordre antichronologique).

### Outils API requis
- **Anthropic SDK** — Sonnet 4 via wrapper `src/lib/secretariat/llm/client.ts` (cache_control auto, `recordAnthropicUsage` systématique depuis S17 R1).
- **Zod** — validation `CRDraftSchema` (`types.ts`), retry self-correction x1 sur format JSON.
- **PDFKit** — `pdf-generator.ts` (génération binaire PDF conforme contraintes @legal).
- **Google Drive API** — `vault-client` :
  - `createFile()` pour le PDF (entité-folder).
  - `updateFileContent()` PATCH in-place (R5 P0 #99) pour write-back fiche.
- **vault-reader** — `getFileContent()` + `findProjetFicheByEntite()` (S17 R2, cache TTL 1h).

---

## 3. Étapes

### 3.1 Ack webhook < 5s
Le webhook Telegram (`src/app/api/telegram/webhook/route.ts`) ack la requête immédiatement (contrainte Telegram : pas de retry). L'action lourde (LLM + PDF + PATCH) se fait dans la même request sur Replit autoscale (pas de fire-and-forget — règle R-Replit autoscale).

### 3.2 Détection mode (multi vs solo)
Le system prompt (`secretariat-system-prompt.md` — REGLE 14) instruit le LLM : si la note ne mentionne aucun tiers, produire un CR mode solo (libellé "Présent" + array `participants` vide accepté par Zod depuis S16).

### 3.3 Génération CR par Sonnet 4
- Wrapper `llm/client.ts` → Sonnet 4 (`claude-sonnet-4-20250514`).
- System prompt scindé `splitSystemPrompt(stable, dynamic)` : partie stable cachée, partie dynamique (date courante) non cachée.
- Output JSON validé par `CRDraftSchema` (4 sections obligatoires : Présent/Participants, Contexte, Discussion/Décisions, Suites). Retry x1 si JSON invalide.

### 3.4 Rendu PDF
- `pdf-generator.ts` consomme le CR validé et produit un PDF conforme contraintes @legal (formules, structure 4 sections, dates). Mode solo : header "Présent" au lieu de "Participants", array vide géré sans crash.

### 3.5 Upload PDF dans entité-folder Drive
- Lookup nom canonique projet → fileId du folder.
- `createFile()` du PDF avec nom respectant la convention.
- Retour : `webViewLink` (utilisé en idempotence write-back étape 3.6).

### 3.6 Write-back fiche entité (post-upload, non bloquant)
- `cr-writeback.writeBackCrToFiche(entite, webViewLink)` :
  1. `findProjetFicheByEntite(entite)` → fileId fiche (résolution live S17, cache mémoire TTL 1h `__issa_projet_fiche_cache__`).
  2. `readFileById(fileId)` → contenu markdown live.
  3. `upsertCrSection(content, entry)` — crée section `## Compte rendu` si absente, sinon ajoute une ligne juste après le heading (nouveaux CR en premier).
  4. **Idempotence** : si `content.includes(webViewLink)` → no-op (déjà écrit).
  5. `updateFileContent(fileId, newContent, 'text/markdown')` PATCH in-place via `_zap_raw_request` `/upload/drive/v3/files/{fileId}?uploadType=media` (R5 — préserve fileId, wikilinks Obsidian, partages).
- **Try/catch isole l'erreur write-back** du flux CR principal (warn console, n'interrompt pas la livraison PDF).

### 3.7 Confirmation Telegram
Message court à Thomas : "CR généré — [lien webViewLink]". Pas de carte 5 boutons (le CR n'est pas une action sensible nécessitant validation Telegram, contrairement aux emails).

---

## 4. Output

### Modifications vault
1. **PDF** créé dans `[entité-folder]/[YYYY-MM-DD] CR — [Nom Projet] — [Objet].pdf`.
2. **Fiche entité** : section `## Compte rendu` mise à jour avec une nouvelle ligne markdown contenant le lien Drive (idempotent via `includes(webViewLink)`).

### Quarantaine
N/A — le workflow CR n'a pas de bac de quarantaine. En cas d'échec :
- Échec génération Sonnet 4 → retry x1 (Zod self-correction) puis warn Telegram à Thomas.
- Échec upload Drive → erreur bloquante, signalée à Thomas (CR perdu, à régénérer).
- Échec write-back fiche → warn console, PDF préservé, fiche reste sans append (à corriger manuellement ou re-déclencher CR).

### Récap (gabarit Telegram envoyé à Thomas)
```
CR généré.

Projet : [Nom Projet]
Mode : [multi-participants / solo]
PDF : [webViewLink]
Fiche : [lien fiche entité vault] — section "Compte rendu" mise à jour.
```

---

## 5. Méthode

### 5.1 Red lines (interdictions)
- **Jamais inventer de participant** : si Thomas mentionne "réunion avec Karim", Anya ne doit pas inventer un Karim Mokhtar — si le prénom seul est ambigu et qu'aucun match contacts-cache n'est sûr, mode solo + mention "Karim (à identifier)" dans la section Présent.
- **Jamais create+delete sur la fiche entité** (R5 P0 #99) — uniquement PATCH in-place via `updateFileContent()`. Casserait fileId, wikilinks Obsidian, partages.
- **Jamais hardcoder fileId** (R7 P1 #101) — résolution dynamique `vault-reader.findProjetFicheByEntite()` obligatoire depuis S17.
- **Naming PDF figé** (décision Thomas verbatim S15) — ne pas changer le format `[YYYY-MM-DD] CR — [Nom Projet] — [Objet].pdf`.
- **Write-back jamais bloquant** — l'échec d'append fiche ne doit jamais empêcher la livraison du PDF.

### 5.2 Arbre de décision — mode multi vs solo
```
Note Telegram > 100 chars
├── Contient ≥ 1 nom de tiers identifiable (matché contacts-cache OU mention claire d'une personne externe)
│   └── Mode multi-participants → libellé "Participants" + array peuplé
└── Aucun tiers identifié (visite immo seul, signature notariale solo, activité perso)
    └── Mode solo (S16) → libellé "Présent" + array vide accepté par Zod
```
La détection est faite par le LLM (REGLE 14 system prompt), pas par une heuristique TS. Pas de clarification systématique demandée à Thomas (UX épurée).

### 5.3 Critères de qualité
- **G1 (CR conforme)** : 4 sections présentes (Présent/Participants, Contexte, Discussion/Décisions, Suites) — validé par Zod `CRDraftSchema`.
- **G2 (idempotence write-back)** : ré-exécuter le workflow sur la même note ne doit pas dupliquer la ligne dans la fiche (test couvert par 27 tests `cr-writeback`).
- **G3 (préservation wikilinks)** : la fiche entité après PATCH conserve TOUS ses wikilinks `[[...]]` Obsidian intacts (régression critique testée).
- **G4 (cache hit Anthropic)** : depuis S17 wrapper LLM, `cache_read_input_tokens` doit être > 0 sur les CR suivants (system prompt stable caché).

### 5.4 Exemple complet (cas réel — mode solo)
**Input Telegram** : "Visite seul du lot rue Henri Barbusse Nanterre 2 ce matin. Lot 2 vide, état correct, peinture à refaire avant relocation. Compteurs OK. Prévoir devis peintre (≈ 800 EUR), photos pour annonce, planning relocation visé 1er juin."

**Détection** : mode solo (Thomas seul, aucun tiers nommé).

**CR généré** :
```markdown
# CR — Visite Lot rue Henri Barbusse 2 — 2026-05-20

## Présent
Thomas Issa (seul)

## Contexte
Visite de l'appartement Lot 2 rue Henri Barbusse, Nanterre, post-départ locataire précédent. Préparation à la relocation.

## Discussion / Décisions
- État général correct. Lot vide.
- Peinture à refaire avant relocation.
- Compteurs (eau, élec, gaz) en état de marche, relevés OK.

## Suites
- Devis peintre à demander (budget estimé ≈ 800 EUR).
- Photos pro à shooter pour annonce.
- Cible relocation : 1er juin 2026.
```

**PDF Drive** : `02. Projets/02. Pro/Immobilier Direct/[2026-05-20] CR — Lot Henri Barbusse 2 — Visite post-départ locataire.pdf`

**Fiche vault** : `02. Projets/02. Pro/Immobilier Direct.md` → section `## Compte rendu` → nouvelle ligne ajoutée en tête.

### 5.5 Maintenance
- **Mise à jour modèle Sonnet** : si migration Sonnet 4 → 4.6, modifier uniquement `src/lib/secretariat/llm/models.ts` (constante `SONNET_4`). Override env `ANTHROPIC_MODEL_OVERRIDE_SONNET` possible pour A/B test.
- **Nouvelle entité projet** : ajouter le nom canonique dans la convention vault (`02. Projets/02. Pro/[Nouvelle Entité].md`). `findProjetFicheByEntite()` résoudra dynamiquement (pas de fileId à hardcoder).
- **Cache TTL** : `__issa_projet_fiche_cache__` = 1h. Si Thomas renomme une fiche entité, le write-back peut échouer pendant max 1h avant refresh cache (acceptable, fallback gracieux `warn + null`).
- **Contraintes @legal PDF** : structure 4 sections + formules sont validées par @legal. Toute modif visuelle PDF doit passer par audit @legal (ex : ajout footer, changement police).
- **Tests** : 27 tests `cr-writeback` + 8 tests `cr-mode-solo` (`__tests__/cr-mode-solo.test.ts` S16). Baseline 1716 tests verts S19. Ne jamais merger une régression sur ces suites.

### 5.6 Changelog skill
| Session | Date | Changement |
|---|---|---|
| S10 | 2026-05-10 | Création workflow CR multi-participants (Mode vs Workflow archi). |
| S15 | — | Décision Thomas verbatim : naming PDF + dossier Drive figés (pas d'évolution). |
| S16 | 2026-05-18 | Mode solo ajouté (REGLE 14 system prompt) — Zod assoupli, libellé "Présent" vs "Participants", 8 tests cr-mode-solo. |
| S16 | 2026-05-18 | Write-back fiche entité (cr-writeback.ts) — PATCH in-place R5, idempotence `includes(webViewLink)`, 27 tests. |
| S17 | 2026-05-19 | Wrapper LLM unifié (R1 audit S16) — cache_control auto + recordAnthropicUsage tracking 100%. |
| S17 | 2026-05-19 | Migration hardcoded `PROJET_FICHE_FILE_IDS` → `vault-reader.findProjetFicheByEntite()` (R2 audit + R7 dette #101). |
| S19 | 2026-05-20 | Documentation skill formalisée (ce fichier). |

---

**Volume estimé** : ~16 PDF/mois (workflow le plus utilisé d'Anya). Coût Anthropic estimé < 1 EUR/mois (Sonnet 4 avec cache_control system prompt stable).

**À confirmer (Thomas)** :
- [À CONFIRMER] Existe-t-il une convention nommée pour les `[Objet court]` du PDF (max 60 chars ? abréviation ?) ou est-ce libre génération Sonnet ?
- [À CONFIRMER] Y a-t-il un fallback si `findProjetFicheByEntite()` retourne null (aucune fiche matchée) — PDF généré sans write-back vault, ou bloque tout le workflow ?
