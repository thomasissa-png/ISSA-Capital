---
skill: fin-de-bail
version: 1.0
session_creation: S19 (2026-05-20)
volume_estime: ~1-2/an (rare)
modules_code:
  - src/lib/secretariat/rent/fin-de-bail.ts [À CONFIRMER chemin exact]
  - src/lib/secretariat/vault-reader/
  - src/lib/secretariat/vault-client/
  - src/lib/secretariat/llm/client.ts
modeles_llm:
  - sonnet-4 (claude-sonnet-4-20250514) — rédaction lettre
trigger_principal: commande Telegram explicite Thomas (ex. "Anya, lettre fin de bail pour [locataire]")
output_principal: DOCX dans vault `09. Administratif/` + section "Lettres" append fiche locataire
---

# Workflow Fin de Bail — produire une lettre de fin de bail (locataire ou propriétaire)

> Source : `src/lib/secretariat/rent/` (module `rent/` documenté dans `anya-current-architecture.md` — quittance loyer + bail meublé + lettre fin-de-bail). Pipeline parent : webhook Telegram (`src/app/api/telegram/webhook/route.ts`). Architecture : voir `docs/ia/anya-current-architecture.md`.

## 1. Trigger

**Ce qui lance le workflow.**

### Déclencheur principal — commande Telegram explicite
- Thomas tape à Anya : "Anya, lettre fin de bail pour [Nom Locataire]" ou variante (commande non triviale, jamais déclenchée par cron ou email entrant — sensibilité juridique trop élevée pour automatisation).
- Détection par le handler conversationnel inline (Sonnet 4) → reconnaissance d'intent "fin-de-bail" → ouverture du workflow dédié.

### Variantes ciblées
- **Congé donné par le locataire** : Anya rédige un accusé de réception du congé (préavis 1 ou 3 mois selon meublé/vide, zone tendue, etc.).
- **Congé donné par le propriétaire** (Thomas) : Anya rédige la lettre de congé motivée (reprise / vente / motif légitime et sérieux) avec respect des préavis 6 mois (vide) ou 3 mois (meublé) [À CONFIRMER : conformité préavis selon dernière révision @legal].

### Hors trigger
- Aucun envoi automatique : règle 11 CLAUDE.md (emails client-facing = brouillons obligatoires). La lettre est **toujours** générée en DOCX brouillon, jamais expédiée.
- Si l'intent est ambigu (Thomas tape juste "fin de bail" sans nom), Anya demande clarification avant génération.

---

## 2. Input

### Fiches à consulter en début de workflow
- **Fiche locataire** dans vault `09. Administratif/Locataires/` [À CONFIRMER chemin exact] — résolution par `vault-reader.findByPath()` / nom canonique.
- **Fiche lot immobilier associé** dans `02. Projets/02. Pro/Immobilier Direct/` (pour adresse précise, type meublé/vide, date entrée locataire).
- **`00. Me/hot-context.md`** — contexte récent (si congé en cours de négociation).

### Sources à scanner
| Source | Contenu | Origine |
|---|---|---|
| Commande Telegram | Nom locataire + motif (si fourni) | webhook update |
| Fiche locataire | Date entrée bail, type bail, loyer, dépôt garantie | `vault-reader.getFileContent()` |
| Fiche lot | Adresse complète, type meublé/vide | `vault-reader.findByPath()` |
| Contacts cache | Coordonnées locataire | `contacts-cache.ts` TTL 1h |

### Convention de nommage
- **DOCX vault** : `[YYYY-MM-DD] Fin de bail — [Nom Locataire] — [Adresse courte].docx` [À CONFIRMER convention exacte].
- **Dossier vault** : `09. Administratif/Lettres/Fin de bail/` [À CONFIRMER].
- **Section fiche locataire** : `## Lettres` — nouvelles lettres en tête (ordre antichronologique).

### Outils API requis
- **Anthropic SDK** — Sonnet 4 via wrapper `src/lib/secretariat/llm/client.ts` (cache_control auto, `recordAnthropicUsage` systématique S17 R1).
- **docx** (npm) — génération DOCX (cf stack `anya-current-architecture.md`).
- **Google Drive API** — `vault-client`:
  - `createFile()` pour le DOCX dans `09. Administratif/`.
  - `updateFileContent()` PATCH in-place R5 pour append section "Lettres" fiche locataire.
- **vault-reader** — `getFileContent()` fiche locataire + fiche lot.

---

## 3. Étapes

### 3.1 Ack webhook < 5s
Webhook Telegram ack immédiat. Génération DOCX + write-back fiche se fait dans la même request (Replit autoscale, pas de fire-and-forget).

### 3.2 Résolution locataire + lot
- Lookup fiche locataire par nom (matching tolérant — `Marc Dupond` matche `Dupond Marc`).
- Si ambiguïté (deux locataires homonymes) → carte Telegram 2 boutons "Locataire A / Locataire B".
- Lookup fiche lot associé via la fiche locataire (lien wikilink `[[Lot ...]]`).

### 3.3 Détection motif (congé locataire vs propriétaire)
- Si Thomas n'a pas précisé : carte Telegram 2 boutons "Congé locataire / Congé propriétaire".
- Si congé propriétaire : carte additionnelle 3 boutons "Reprise / Vente / Motif légitime" — détermine la base légale citée dans la lettre.

### 3.4 Génération lettre par Sonnet 4
- Wrapper `llm/client.ts` → Sonnet 4 (`claude-sonnet-4-20250514`).
- System prompt scindé `splitSystemPrompt(stable, dynamic)` — stable caché (formules juridiques + structure), dynamique non caché (date courante, nom locataire, adresse).
- Output validé Zod (`FinDeBailDraftSchema` [À CONFIRMER existence]) avec 4 blocs obligatoires : en-tête, objet, corps avec base légale, formule de politesse + signature.
- Retry x1 self-correction si format invalide.

### 3.5 Rendu DOCX
- Module `docx` (npm) consomme le draft et produit un fichier `.docx` conforme :
  - En-tête expéditeur (Thomas / ISSA Capital — coordonnées depuis fiche identité [À CONFIRMER fichier source]).
  - Bloc destinataire (locataire).
  - Objet : "Congé du bail — [adresse]".
  - Corps avec base légale citée (loi 89-462 art. 12 ou 15 selon motif) [À CONFIRMER conformité @legal].
  - Mention "Lettre recommandée avec accusé de réception" ou "Signification par huissier" selon motif [À CONFIRMER].

### 3.6 Upload DOCX dans vault
- `createFile()` dans `09. Administratif/Lettres/Fin de bail/` avec naming conforme.
- Retour : `webViewLink` + fileId.

### 3.7 Write-back fiche locataire (post-upload, non bloquant)
- `vault-client.updateFileContent()` PATCH in-place R5 :
  1. `readFileById(ficheLocataireId)` → contenu live.
  2. `upsertSection(content, '## Lettres', entry)` — crée section si absente, ajoute ligne en tête.
  3. Idempotence : si `content.includes(webViewLink)` → no-op.
  4. PATCH in-place via `_zap_raw_request` `/upload/drive/v3/files/{fileId}?uploadType=media` (R5 — préserve wikilinks Obsidian + partages).
- Try/catch isole l'erreur write-back du flux principal.

### 3.8 Confirmation Telegram
Message à Thomas avec lien DOCX + rappel : "Brouillon généré. **À relire avant impression / envoi LRAR**." Mention explicite du caractère brouillon (règle 11 CLAUDE.md).

---

## 4. Output

### Modifications vault
1. **DOCX** créé dans `09. Administratif/Lettres/Fin de bail/[YYYY-MM-DD] Fin de bail — [Nom] — [Adresse].docx`.
2. **Fiche locataire** : section `## Lettres` mise à jour avec lien Drive (idempotent).

### Quarantaine
N/A — pas de bac quarantaine. En cas d'échec :
- Échec génération Sonnet 4 → retry x1 puis warn Telegram.
- Échec upload Drive → erreur bloquante, signalée à Thomas (lettre à régénérer).
- Échec write-back fiche → warn console, DOCX préservé.

### Récap (gabarit Telegram envoyé à Thomas)
```
Lettre fin de bail générée — BROUILLON.

Locataire : [Nom]
Lot : [Adresse]
Motif : [congé locataire / propriétaire — reprise/vente/motif]
DOCX : [webViewLink]
Fiche : [lien fiche locataire vault]

À relire avant impression et envoi LRAR.
```

---

## 5. Méthode

### 5.1 Red lines (interdictions)
- **JAMAIS d'envoi direct** — uniquement DOCX brouillon dans le vault (règle 11 CLAUDE.md). L'envoi physique LRAR ou huissier reste 100% manuel côté Thomas.
- **JAMAIS inventer la date d'entrée du bail ou le montant du loyer** — toujours lire depuis la fiche locataire vault. Si fiche incomplète → demander à Thomas, ne pas mettre `[À COMPLÉTER]` dans le DOCX final.
- **JAMAIS create+delete** sur la fiche locataire (R5 P0 #99) — uniquement PATCH in-place.
- **JAMAIS hardcoder fileId** (R7 P1 #101) — résolution dynamique obligatoire.
- **JAMAIS citer un motif non sourcé** — si Thomas n'a pas précisé la base légale, demander (pas d'invention "motif légitime et sérieux" générique).

### 5.2 Arbre de décision — motif du congé
```
Commande "lettre fin de bail" reçue
├── Motif précisé par Thomas dans la commande ?
│   ├── OUI → générer directement
│   └── NON → carte Telegram 2 boutons : Congé locataire / Congé propriétaire
└── Si Congé propriétaire :
    └── carte Telegram 3 boutons : Reprise / Vente / Motif légitime et sérieux
        → détermine base légale citée (loi 89-462 art. 15)
```

### 5.3 Critères de qualité
- **G1 (lettre conforme)** : 4 blocs présents (en-tête, objet, corps avec base légale, signature) — validé Zod [À CONFIRMER schéma].
- **G2 (idempotence write-back)** : re-déclencher la même commande ne duplique pas la ligne dans la fiche locataire.
- **G3 (préservation wikilinks)** : fiche locataire après PATCH conserve tous les `[[...]]` Obsidian.
- **G4 (cache hit Anthropic)** : `cache_read_input_tokens` > 0 sur lettres suivantes (system prompt formules juridiques stable caché).
- **G5 (conformité @legal)** : préavis légal correct selon meublé/vide + zone tendue — audit @legal obligatoire à chaque évolution du template.

### 5.4 Exemple complet (cas réel)
**Commande Telegram** : "Anya, lettre fin de bail pour Marc Dupond, congé propriétaire pour vente."

**Détection** : intent fin-de-bail + nom locataire + motif "congé propriétaire / vente".

**Lookup vault** :
- Fiche locataire `09. Administratif/Locataires/Marc Dupond.md` → entrée bail 2024-06-01, bail vide loi 89, loyer 950 EUR/mois.
- Fiche lot `02. Projets/02. Pro/Immobilier Direct/Lot Henri Barbusse 2.md` → adresse "12 rue Henri Barbusse, 92000 Nanterre".

**Lettre générée (extrait)** :
```
[Thomas Issa — ISSA Capital]
[Adresse expéditeur]

Marc Dupond
12 rue Henri Barbusse
92000 Nanterre

Nanterre, le 20 mai 2026

Objet : Congé pour vente — bail du 1er juin 2024

Lettre recommandée avec accusé de réception

Monsieur,

En application de l'article 15-I et 15-II de la loi n° 89-462 du 6 juillet 1989,
je vous notifie par la présente mon intention de mettre fin au contrat de
location portant sur le logement situé 12 rue Henri Barbusse, 92000 Nanterre,
à l'échéance du bail, soit le 31 mai 2027.

[...formules suite, droit de préemption, etc...]

Veuillez agréer, Monsieur, l'expression de mes salutations distinguées.

Thomas Issa
```

**DOCX vault** : `09. Administratif/Lettres/Fin de bail/[2026-05-20] Fin de bail — Marc Dupond — Henri Barbusse 2.docx`

**Fiche vault** : `09. Administratif/Locataires/Marc Dupond.md` → section `## Lettres` → nouvelle ligne en tête.

**Telegram** : "Brouillon généré. À relire avant impression et envoi LRAR."

### 5.5 Maintenance
- **Mise à jour formules légales** : toute évolution loi 89-462 ou jurisprudence applicable → audit @legal + mise à jour du system prompt stable (cache invalidé).
- **Cache TTL** : fiche locataire et lot lues live (TTL 1h `__issa_projet_fiche_cache__`).
- **Conformité @legal** : DOCX généré doit passer audit @legal périodique (annuel minimum).
- **Tests** : couverture minimale 4 cas (congé locataire meublé, congé locataire vide, congé propriétaire reprise, congé propriétaire vente) [À CONFIRMER suite test existante].

### 5.6 Changelog skill
| Session | Date | Changement |
|---|---|---|
| S? | — | Création module `rent/fin-de-bail.ts` (héritage module rent quittance + bail) [À CONFIRMER session origine]. |
| S17 | 2026-05-19 | Migration vers wrapper LLM unifié (R1) — cache_control auto + tracking 100%. |
| S19 | 2026-05-20 | Documentation skill formalisée (ce fichier). |

---

**Volume estimé** : ~1-2/an (rare — la plupart des baux Thomas sont longue durée). Coût Anthropic négligeable (< 0,05 EUR par lettre Sonnet 4 avec cache).

## À confirmer (Thomas)

- [À CONFIRMER] Chemin exact du module : `src/lib/secretariat/rent/fin-de-bail.ts` ?
- [À CONFIRMER] Chemin vault des fiches locataires : `09. Administratif/Locataires/` confirmé ?
- [À CONFIRMER] Format DOCX final validé par @legal (formules art. 12 vs 15 selon motif, préavis 1/3/6 mois selon meublé/vide/zone tendue) ?
- [À CONFIRMER] Mention "LRAR" ou "Signification par huissier" — choix automatique selon motif ou demande à Thomas ?
- [À CONFIRMER] Schéma Zod `FinDeBailDraftSchema` existe-t-il, et où est-il défini ?
- [À CONFIRMER] Source des coordonnées expéditeur Thomas (`docs/founder-preferences.md` ? fiche identité vault ?).
- [À CONFIRMER] Suite de tests dédiée fin-de-bail existante ? (les 1255 tests baseline S16 ne mentionnent pas explicitement fin-de-bail).
