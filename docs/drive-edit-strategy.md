# Strategie d'edition Drive (vault) — REGLE DURE

**Session 15 — leçon couteuse :** edit IN-PLACE via PATCH, jamais create+delete.

## ✅ Pattern correct : PATCH via Zapier `_zap_raw_request`

```
Action: google_drive _zap_raw_request (Make API Mutating Request)
params:
  url: https://www.googleapis.com/upload/drive/v3/files/{fileId}
  method: PATCH
  querystring: { uploadType: "media" }
  headers: { Content-Type: "text/markdown" }   # selon type
  body: <contenu complet du fichier en raw text>
  fail_on_errors: "true"
```

**Avantages** :
- fileId preserve → wikilinks Obsidian intacts, partages preserves
- mimeType correct selon Content-Type header
- Pas de doublon, pas de suffixe `(1)`
- Pas de race condition

## ❌ Anti-pattern : create + delete

Sequence `newtxtfile` puis `delete_file` SUR LE MEME NOM :
- Drive cree des doublons temporaires (`Nom (1).md`)
- Obsidian recopie/cache l'ancien fileId → wikilinks casses
- mimeType `text/plain` (newtxtfile bug)
- Liens directs Drive (URL avec fileId) morts a vie

NE JAMAIS UTILISER cette sequence pour modifier un fichier existant.

## Cas d'usage typique : update frontmatter fiche contact vault

```
1. download_file_content(fileId)
2. decoder base64, parser frontmatter, modifier les champs
3. encoder le nouveau contenu complet
4. _zap_raw_request PATCH avec body = nouveau contenu raw
5. lire pour valider (optionnel)
```

## Anti-pattern alternatif : `replace_file` Zapier

Le param `file` demande "actual file or public URL" (upload binaire),
`old_file` est en format SELECT (dropdown UI). Inadapte aux appels API
directs. Preferer `_zap_raw_request PATCH`.

## Workaround mimeType `newtxtfile` Zapier

L'action Zapier `newtxtfile` (Google Drive — New Text File) cree systematiquement
un fichier avec mimeType `text/plain`, meme si l'extension est `.md`. Resultat :
Obsidian ne reconnait pas le fichier comme markdown (icone generique, pas de rendu).

**Patterns acceptables** (par ordre de preference) :

1. **Creation directe via raw API** (recommande pour code prod) :
   - `_zap_raw_request POST` vers `/upload/drive/v3/files?uploadType=multipart`
   - Header `Content-Type: text/markdown` dans la partie body
   - Preserve le mimeType correct des le depart, pas de doublon

2. **`newtxtfile` + PATCH de correction immediat** (acceptable pour scripts ponctuels) :
   - `newtxtfile` cree le fichier (mimeType `text/plain`)
   - Recuperer le fileId
   - `_zap_raw_request PATCH` vers `/files/{fileId}` avec body `{"mimeType":"text/markdown"}`
   - **JAMAIS** suivi d'un delete+recreate (anti-pattern R5)

**Anti-pattern** : laisser le fichier en `text/plain` "ca marche dans Obsidian quand
meme" — non, Obsidian Sync ne le voit pas comme markdown editable.

## Pour le code Anya (jalon S16 ou apres)

Le module `src/lib/secretariat/drive-upload.ts` doit etre etendu avec
`updateFileContent(fileId, content, mimeType)` qui appelle directement
`/upload/drive/v3/files/{fileId}?uploadType=media` via `getAccessToken()`.
Ca debloque le write-back CR → fiches (Q3 S15 Thomas).
