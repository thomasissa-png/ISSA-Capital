# Connecter Gmail et Calendar à Claude Desktop

Guide pas à pas — zéro terminal, zéro code. Tu installes, tu colles, tu cliques.

---

## Étape 1 — Installer Node.js (2 min)

1. Ouvre ton navigateur → va sur **nodejs.org**
2. Clique le gros bouton vert **"LTS"** (la version recommandée)
3. Un fichier `.msi` se télécharge
4. Double-clique dessus → **Next → Next → Next → Install → Finish**
5. C'est installé. Tu n'auras plus jamais besoin d'y toucher.

> **Pourquoi ?** Claude Desktop a besoin de Node.js pour faire tourner le connecteur Gmail/Calendar en arrière-plan. C'est comme installer Java pour faire tourner certains logiciels — tu l'installes une fois et tu oublies.

---

## Étape 2 — Créer les identifiants Google (10 min)

Tu vas créer une "clé" pour que Claude puisse lire tes emails et ton calendrier. Tout se passe dans ton navigateur.

### 2a. Créer un projet Google Cloud

1. Va sur **console.cloud.google.com**
2. Connecte-toi avec ton compte Google (celui de tes emails)
3. En haut à gauche, clique sur le nom du projet (ou "Sélectionner un projet")
4. Clique **"Nouveau projet"**
5. Nom : **Claude MCP** → clique **Créer**
6. Attends 10 secondes, puis sélectionne ce projet dans la liste

### 2b. Activer les API Gmail et Calendar

1. Dans la barre de recherche en haut, tape : **Gmail API** → clique dessus → clique **Activer**
2. Reviens à la recherche, tape : **Google Calendar API** → clique dessus → clique **Activer**

### 2c. Configurer l'écran de consentement

1. Menu hamburger (☰) en haut à gauche → **API et services** → **Écran de consentement OAuth**
2. Choisis **Externe** → clique **Créer**
3. Remplis :
   - Nom de l'application : **Claude MCP**
   - Adresse email d'assistance : **ton email**
   - Adresse email du développeur : **ton email**
4. Clique **Enregistrer et continuer**
5. Page "Champs d'application" → clique **Ajouter ou supprimer des champs d'application**
6. Coche :
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/calendar`
7. Clique **Mettre à jour** → **Enregistrer et continuer**
8. Page "Utilisateurs test" → clique **Ajouter des utilisateurs** → entre **ton adresse email** → **Enregistrer et continuer**
9. Clique **Retour au tableau de bord**

### 2d. Créer les identifiants OAuth

1. Menu ☰ → **API et services** → **Identifiants**
2. Clique **+ Créer des identifiants** → **ID client OAuth**
3. Type d'application : **Application de bureau**
4. Nom : **Claude Desktop**
5. Clique **Créer**
6. Une fenêtre apparaît avec **ID client** et **Code secret du client**
7. **Copie ces deux valeurs** dans un fichier texte temporaire (tu en auras besoin à l'étape 3)

> Tu peux aussi cliquer **Télécharger JSON** pour garder une copie.

---

## Étape 3 — Configurer Claude Desktop (3 min)

### 3a. Ouvrir le fichier de configuration

1. Sur ton clavier, appuie sur **Win + R** (la touche Windows + la lettre R)
2. Tape exactement ceci : `%APPDATA%\Claude`
3. Appuie sur **Entrée** → un dossier s'ouvre
4. Tu vois un fichier **claude_desktop_config.json**
   - S'il n'existe pas : clic droit dans le dossier → Nouveau → Document texte → renomme-le `claude_desktop_config.json`
5. Clic droit sur le fichier → **Ouvrir avec** → **Bloc-notes** (Notepad)

### 3b. Coller la configuration

Remplace TOUT le contenu du fichier par ceci :

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "npx",
      "args": [
        "-y",
        "@anthropic/google-workspace-mcp@latest"
      ],
      "env": {
        "GOOGLE_CLIENT_ID": "COLLE_TON_ID_CLIENT_ICI",
        "GOOGLE_CLIENT_SECRET": "COLLE_TON_CODE_SECRET_ICI",
        "GOOGLE_REDIRECT_URI": "http://localhost:3000/oauth/callback"
      }
    }
  }
}
```

**Remplace** les deux valeurs :
- `COLLE_TON_ID_CLIENT_ICI` → par l'ID client copié à l'étape 2d
- `COLLE_TON_CODE_SECRET_ICI` → par le code secret copié à l'étape 2d

> Garde bien les guillemets `"` autour des valeurs.

### 3c. Sauvegarder et relancer

1. **Ctrl + S** pour sauvegarder
2. Ferme le Bloc-notes
3. Ferme Claude Desktop complètement (clic droit sur l'icône dans la barre des tâches → Quitter)
4. Rouvre Claude Desktop

---

## Étape 4 — Première connexion Google (1 min)

1. Dans Claude Desktop, demande quelque chose comme : *"Montre-moi mes emails non lus"*
2. Une fenêtre de navigateur s'ouvre → connecte-toi avec ton compte Google
3. Clique **Continuer** (Google affichera un avertissement car l'app n'est pas vérifiée — c'est normal, c'est TON app)
4. Clique **Autoriser**
5. Reviens dans Claude Desktop → tes emails apparaissent

**C'est fait.** Claude peut maintenant lire/envoyer tes emails et gérer ton calendrier.

---

## Ce que Claude peut faire avec Gmail et Calendar

- Lire et chercher dans tes emails
- Créer des brouillons d'email
- Voir tes événements à venir
- Créer/modifier/supprimer des événements
- Suggérer des créneaux libres

---

## Si ça ne marche pas

| Problème | Solution |
|---|---|
| Claude ne voit pas le serveur Gmail | Vérifie que Node.js est bien installé : Win+R → tape `cmd` → tape `node --version` → tu dois voir un numéro |
| Erreur "redirect_uri_mismatch" | Vérifie que `GOOGLE_REDIRECT_URI` dans le fichier est bien `http://localhost:3000/oauth/callback` |
| Google refuse l'accès | Vérifie que tu as bien ajouté ton email comme "Utilisateur test" à l'étape 2c.8 |
| Le fichier JSON est "invalide" | Vérifie les virgules et guillemets — une virgule en trop ou en moins casse tout |

---

*Dernière mise à jour : 2026-05-10*
