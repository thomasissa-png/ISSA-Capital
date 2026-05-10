# Setup Google Drive + Obsidian

## Le problème à résoudre

Thomas veut que :
1. Claude.ai puisse lire/écrire dans le vault Obsidian (via le connector Google Drive)
2. Les changements apparaissent automatiquement dans Obsidian sur son PC/iPhone
3. Le vault reste versionné quelque part (pas de perte de données)

## Les 3 options

### Option A — Vault dans un dossier Google Drive synchronisé (RECOMMANDÉE)

**Principe** : le vault Obsidian vit dans un dossier Google Drive. Google Drive Desktop (l'app) synchronise ce dossier sur le PC de Thomas. Obsidian pointe vers ce dossier local. Claude.ai, via le connector Drive, peut lire et écrire dans ce même dossier.

**Avantages** :
- Claude.ai peut écrire directement dans le vault (via connector Drive)
- Obsidian voit les changements instantanément (sync locale)
- Gratuit (Google Drive 15 Go gratuit, largement suffisant pour du Markdown)
- iPhone : utiliser l'app Google Drive pour accéder aux fichiers, ou Obsidian mobile avec le dossier synchronisé

**Inconvénients** :
- Le dossier `.obsidian/` (config, plugins, thèmes) peut créer des conflits de sync si Obsidian est ouvert sur 2 appareils en même temps. Solution : ajouter `.obsidian/` dans les exclusions de sync Google Drive (voir procédure ci-dessous).
- Pas de chiffrement de bout en bout (Google peut lire les fichiers)
- On perd la versionning git du vault (le vault vit dans Drive, plus dans le repo). Solution : voir "Git + Drive en parallèle" ci-dessous.

**Procédure d'installation (15 min)** :

1. **Installer Google Drive Desktop** sur le PC
   - Télécharger : https://www.google.com/drive/download/
   - Se connecter avec le compte Google
   - Choisir "Préférences" → méthode de sync : **Fichiers en streaming** (par défaut) ou **Dupliquer les fichiers** (plus fiable pour Obsidian — recommandé)
   - Si "Dupliquer les fichiers" : le dossier `Google Drive` apparaît dans `C:\Users\Thomas\Google Drive\` (Windows) ou `~/Google Drive/` (Mac)

2. **Créer le dossier vault dans Drive**
   - Dans l'explorateur de fichiers : `Google Drive/Second Cerveau/`
   - Copier le contenu actuel de `second-cerveau/` dans ce dossier

3. **Ouvrir le vault dans Obsidian**
   - Obsidian → "Open folder as vault" → sélectionner `Google Drive/Second Cerveau/`
   - Vérifier que tous les fichiers apparaissent

4. **Exclure `.obsidian/` de la sync Drive** (important)
   - Google Drive Desktop → Préférences → sélectionner le dossier `Second Cerveau` → exclure le sous-dossier `.obsidian`
   - Alternative : si l'exclusion n'est pas disponible, ne PAS ouvrir Obsidian sur 2 appareils en même temps (le risque est le conflit sur workspace.json et les plugins)

5. **Vérifier que Claude.ai voit le vault**
   - Ouvrir Claude.ai → connector Google Drive activé
   - Demander : "Liste les fichiers dans mon dossier Google Drive 'Second Cerveau'"
   - Si Claude.ai voit les fichiers → c'est bon

6. **iPhone** : Obsidian mobile peut ouvrir un vault depuis iCloud ou un stockage local, mais PAS directement depuis Google Drive. Deux solutions :
   - **Solution simple** : utiliser Obsidian uniquement sur PC, consulter les notes sur iPhone via l'app Google Drive (lecture seule confortable)
   - **Solution avancée** : payer Obsidian Sync (8 EUR/mois) pour synchroniser entre PC et iPhone, et utiliser Drive uniquement pour le pont Claude.ai → vault

### Option B — Obsidian Sync officiel (sans Drive)

**Principe** : Obsidian Sync (payant, 8 EUR/mois) synchronise le vault entre appareils de manière native, chiffrée E2E.

**Avantages** :
- Conçu pour Obsidian (gère les conflits, chiffrement, historique des versions)
- Sync PC + iPhone native et fiable
- Pas de risque de corruption du dossier `.obsidian/`

**Inconvénients** :
- Claude.ai NE PEUT PAS écrire dans un vault Obsidian Sync (pas de connector Obsidian dans Claude.ai)
- 8 EUR/mois
- Ne résout pas le problème initial (Claude.ai → vault)

**Verdict** : ne résout PAS le besoin. Claude.ai n'a pas accès à Obsidian Sync.

### Option C — Hybride (Drive + Obsidian Sync)

**Principe** : vault dans Google Drive (pour Claude.ai) + Obsidian Sync en parallèle (pour PC ↔ iPhone).

**Verdict** : trop lourd, risque de conflit entre 2 systèmes de sync sur le même dossier. À éviter.

## Recommandation

**Option A** — vault dans Google Drive synchronisé localement. C'est la seule option qui permet le circuit complet : Claude.ai écrit dans Drive → Drive sync sur PC → Obsidian voit les changements.

Pour l'iPhone : commencer par consulter via l'app Google Drive. Si besoin d'éditer sur iPhone, ajouter Obsidian Sync plus tard (mais uniquement pour la sync mobile, pas en doublon de Drive).

## Git + Drive en parallèle (optionnel mais recommandé)

Le vault actuel est dans le repo git ISSA-Capital (`second-cerveau/`). Si on le déplace dans Google Drive, on perd la versionning git.

**Solution** : garder les deux.
1. Le vault "live" est dans Google Drive (c'est celui qu'Obsidian ouvre et que Claude.ai modifie)
2. Périodiquement (1x/semaine ou avant chaque session Claude Code), copier le vault Drive dans `second-cerveau/` du repo et committer
3. Alternative automatisée : un script qui copie `Google Drive/Second Cerveau/` → `ISSA-Capital/second-cerveau/` et commit. Mais c'est du bonus, pas prioritaire.

Le repo git reste la sauvegarde versionnée. Google Drive est le canal de travail quotidien.

## Résumé

| | Claude.ai écrit | Obsidian PC | Obsidian iPhone | Git | Complexité |
|---|---|---|---|---|---|
| Option A (Drive) | Oui | Oui | Lecture Drive app | Copie manuelle | Simple |
| Option B (Obsidian Sync) | Non | Oui | Oui | Dans le repo | Simple mais pas le besoin |
| Option C (Hybride) | Oui | Oui | Oui | Copie manuelle | Trop lourd |
