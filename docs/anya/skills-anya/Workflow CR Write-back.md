---
skill: cr-writeback
version: 1.0
session_creation: S19 (2026-05-20)
volume_estime: ~16/mois (1:1 avec CR Réunion)
modules_code:
  - src/lib/secretariat/cr-writeback/
  - src/lib/secretariat/vault-reader/
  - src/lib/secretariat/vault-client/
modeles_llm: []
trigger_principal: post-génération CR (étape 3.6 du workflow CR Réunion) — non bloquant
output_principal: section `## Compte rendu` mise à jour dans la fiche entité, ordre antichronologique
---

# Workflow CR Write-back — propager le CR vers la fiche entité vault (PATCH in-place R5)

> Source : `src/lib/secretariat/cr-writeback/` (`writeBackCrToFiche`, `upsertCrSection`). Pipeline parent : workflow CR Réunion (étape 3.6 post-upload PDF). Architecture : voir `docs/ia/anya-current-architecture.md`. 27 tests `cr-writeback` verts baseline S16.

## 1. Trigger

**Ce qui lance le workflow.**

### Déclencheur principal — post-CR
- Étape 3.6 du workflow CR Réunion (cf `Workflow CR Reunion.md`).
- Invocation : `writeBackCrToFiche(entite, webViewLink)` après upload PDF dans entité-folder Drive.
- **Non bloquant** : try/catch isole l'erreur write-back du flux CR principal. Si write-back échoue, le PDF reste livré, warn console.

### Variantes ciblées
- **Fiche entité existante avec section `## Compte rendu`** : append ligne en tête (antichronologique).
- **Fiche entité existante sans section `## Compte rendu`** : création de la section + première ligne.
- **Fiche entité introuvable** : `findProjetFicheByEntite()` retourne null → warn console, pas de write-back (PDF préservé). [À CONFIRMER comportement edge case].

### Hors trigger
- Pas de déclencheur direct utilisateur (workflow purement interne, sous-skill du CR Réunion).
- Pas de cron — uniquement appelé depuis le pipeline CR.

---

## 2. Input

### Fiches à consulter en début de workflow
- **Fiche entité concernée** dans `02. Projets/02. Pro/` — résolue par `vault-reader.findProjetFicheByEntite(entite)` (S17 R2 — fini le hardcoded `PROJET_FICHE_FILE_IDS` dette #101 R7).

### Sources à scanner
| Source | Contenu | Origine |
|---|---|---|
| Argument workflow | `entite` (nom canonique projet) + `webViewLink` (PDF Drive) | Appel depuis CR Réunion |
| Cache fiche projet | `__issa_projet_fiche_cache__` TTL 1h | `vault-reader.findProjetFicheByEntite()` |
| Fiche entité live | Contenu markdown actuel | `vault-reader.readFileById()` |

### Convention de nommage
- **Section vault** : `## Compte rendu` (titre exact, H2).
- **Ligne ajoutée** : format markdown avec lien Drive du PDF (ex. `- [2026-05-20] CR — Visite Lot Henri Barbusse 2 — [lien](webViewLink)`) [À CONFIRMER format exact ligne].
- **Position** : nouveau CR ajouté en première ligne après le heading `## Compte rendu` (ordre antichronologique).

### Outils API requis
- **vault-reader** — `findProjetFicheByEntite(entite)` + `readFileById(fileId)`.
- **vault-client** — `updateFileContent(fileId, newContent, 'text/markdown')` PATCH in-place via `_zap_raw_request` (R5 P0 #99).

---

## 3. Étapes

### 3.1 Résolution fileId fiche entité
- Appel `vault-reader.findProjetFicheByEntite(entite)` (cache mémoire TTL 1h `__issa_projet_fiche_cache__`).
- Retour : `{ fileId, fileName, path }` OU `null` si aucune fiche matchée.
- Si null → warn console + return (CR PDF préservé, write-back skip).

### 3.2 Lecture fiche live
- `readFileById(fileId)` → contenu markdown actuel de la fiche (toujours live, pas de cache contenu).
- Si lecture échoue (erreur Drive transitoire) → throw, capturée par try/catch parent.

### 3.3 Upsert section `## Compte rendu`
- Fonction `upsertCrSection(content, entry)` :
  - **Cas A — section absente** : ajoute `\n\n## Compte rendu\n\n[entry]\n` en fin de fichier OU à un emplacement déterministe [À CONFIRMER position : fin de fichier ou après une section spécifique ?].
  - **Cas B — section présente** : insère `[entry]\n` juste après le heading `## Compte rendu` (ordre antichronologique, nouveau en haut).
- `entry` typique : ligne markdown avec date + objet + lien Drive du PDF.

### 3.4 Idempotence — sortie anticipée
- **Vérification critique** : `if (content.includes(webViewLink)) return;`
- Si le `webViewLink` du PDF est déjà présent dans la fiche → no-op. Garantit qu'une re-exécution du workflow CR sur la même note ne dédouble pas l'entrée.

### 3.5 PATCH in-place R5
- `vault-client.updateFileContent(fileId, newContent, 'text/markdown')`.
- Implémentation : `_zap_raw_request` sur `/upload/drive/v3/files/{fileId}?uploadType=media` (R5 P0 #99 verbatim).
- **JAMAIS create+delete** — préserve fileId, wikilinks Obsidian, partages Drive.

### 3.6 Audit (optionnel)
- Si log activé : append ligne dans `_Inbox/AnyaLogs/YYYY-MM-DD.jsonl` : `{ event: "cr-writeback", entite, fileId, webViewLink, timestamp }` [À CONFIRMER si implémenté].

---

## 4. Output

### Modifications vault
1. **Fiche entité** : section `## Compte rendu` mise à jour (création ou append en tête).
2. **Aucune autre modification** (le PDF est créé par le workflow CR Réunion en amont, pas ici).

### Quarantaine
N/A. En cas d'échec :
- `findProjetFicheByEntite()` retourne null → no-op (PDF préservé, warn console, pas d'erreur remontée).
- `readFileById()` échoue → erreur capturée par try/catch parent CR Réunion (non bloquant).
- `updateFileContent()` échoue → erreur capturée idem.

### Récap
Pas de message Telegram propre — c'est le workflow CR Réunion parent qui envoie le récap final ("CR généré — [lien] — fiche mise à jour").

---

## 5. Méthode

### 5.1 Red lines (interdictions)
- **JAMAIS create+delete sur la fiche entité** (R5 P0 #99) — uniquement PATCH in-place via `updateFileContent()`. Casserait fileId, wikilinks Obsidian, partages.
- **JAMAIS hardcoder fileId** (R7 P1 #101) — résolution dynamique via `findProjetFicheByEntite()` obligatoire depuis S17 (fini `PROJET_FICHE_FILE_IDS`).
- **JAMAIS bloquant pour le flux CR** — try/catch obligatoire au niveau parent. Échec write-back ≠ échec CR.
- **JAMAIS dédoublonner manuellement** — l'idempotence repose sur `content.includes(webViewLink)`. Pas de comparaison fuzzy.
- **JAMAIS supprimer une entrée existante** — write-back n'efface jamais d'historique.

### 5.2 Arbre de décision — upsert section
```
fileId résolu via findProjetFicheByEntite()
├── null → no-op (warn console)
└── fileId trouvé → readFileById
    ├── content.includes(webViewLink) ? → no-op (idempotence)
    └── sinon → upsertCrSection :
        ├── section "## Compte rendu" absente → création + entry
        └── section présente → insertion entry en tête
        → updateFileContent() PATCH in-place R5
```

### 5.3 Critères de qualité
- **G1 (idempotence)** : re-exécution sur même note ne duplique pas l'entrée (27 tests `cr-writeback` couvrent).
- **G2 (préservation wikilinks)** : la fiche entité après PATCH conserve TOUS ses `[[...]]` Obsidian (régression critique).
- **G3 (PATCH in-place)** : fileId Drive conservé entre avant/après (R5 strict).
- **G4 (non bloquant)** : échec write-back ne casse jamais la livraison PDF.

### 5.4 Exemple complet (cas réel)
**Contexte** : workflow CR Réunion vient de générer un PDF "CR — Visite Lot Henri Barbusse 2 — 2026-05-20" dans `02. Projets/02. Pro/Immobilier Direct/`. `webViewLink` = `https://drive.google.com/file/d/abc123/view`.

**Invocation** : `writeBackCrToFiche("Immobilier Direct", "https://drive.google.com/file/d/abc123/view")`.

**Pipeline** :
1. `findProjetFicheByEntite("Immobilier Direct")` → `{ fileId: "xyz789", path: "02. Projets/02. Pro/Immobilier Direct.md" }`.
2. `readFileById("xyz789")` → contenu markdown live (incluant déjà une section `## Compte rendu` avec 2 entries précédentes).
3. `content.includes("abc123")` → false.
4. `upsertCrSection(content, "- [2026-05-20] CR — Visite Lot Henri Barbusse 2 — [PDF](https://drive.google.com/file/d/abc123/view)")` :
   - Section existante détectée.
   - Insertion juste après `## Compte rendu\n`.
5. `updateFileContent("xyz789", newContent, "text/markdown")` PATCH in-place.

**Résultat fiche `02. Projets/02. Pro/Immobilier Direct.md`** (extrait) :
```markdown
## Compte rendu

- [2026-05-20] CR — Visite Lot Henri Barbusse 2 — [PDF](https://drive.google.com/file/d/abc123/view)
- [2026-05-15] CR — RDV Notaire Karim Mokhtar — [PDF](https://drive.google.com/file/d/...)
- [2026-04-28] CR — Visite Lot Henri Barbusse 3 — [PDF](https://drive.google.com/file/d/...)
```

### 5.5 Maintenance
- **Cache TTL** : `__issa_projet_fiche_cache__` = 1h. Si Thomas renomme une fiche entité, write-back peut échouer pendant max 1h avant refresh (acceptable, fallback gracieux `warn + null`).
- **Format ligne entry** : si Thomas veut faire évoluer (ajout statut, ajout participants), modifier la fonction génératrice `entry` dans `cr-writeback.ts` [À CONFIRMER fichier exact].
- **Tests** : 27 tests `cr-writeback` couvrent (idempotence, création section, append section, préservation wikilinks). Baseline 1716 tests verts S19 — ne jamais merger une régression.
- **Migration S17 R7** : `PROJET_FICHE_FILE_IDS` hardcoded supprimé S17, remplacé par `findProjetFicheByEntite()`. Si une régression introduit du hardcoded → bloquer (R7 dette #101).

### 5.6 Changelog skill
| Session | Date | Changement |
|---|---|---|
| S16 | 2026-05-18 | Création workflow CR write-back (`cr-writeback.ts`) — PATCH in-place R5, idempotence `includes(webViewLink)`, 27 tests. |
| S17 | 2026-05-19 | Migration hardcoded `PROJET_FICHE_FILE_IDS` → `vault-reader.findProjetFicheByEntite()` (R2 audit + R7 dette #101). |
| S19 | 2026-05-20 | Documentation skill formalisée (ce fichier). |

---

**Volume estimé** : ~16/mois (1:1 avec CR Réunion). Coût négligeable (pas de LLM, uniquement Drive PATCH).

## À confirmer (Thomas)

- [À CONFIRMER] Format exact de la ligne `entry` ajoutée dans la section (markdown bullet avec date / objet / lien — précisément).
- [À CONFIRMER] Emplacement de création de la section `## Compte rendu` si absente : fin de fichier ou après une section spécifique de la fiche entité ?
- [À CONFIRMER] Edge case `findProjetFicheByEntite()` retourne 2+ fiches matchées (ambiguïté) : comportement attendu ?
- [À CONFIRMER] Audit log JSONL des write-back implémenté ou pas ?
- [À CONFIRMER] Si fiche entité est en lecture seule côté Drive (partage restreint) : comportement attendu sur `updateFileContent` ?
