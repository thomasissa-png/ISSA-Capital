# Setup Asana MCP pour Claude Desktop

> Ce guide connecte Claude Desktop a ton workspace Asana. Apres ca, tu pourras demander a Claude "Liste mes projets Asana" ou "Cree une tache dans le projet X" directement dans Claude Desktop.

## Pre-requis

- **Node.js >= 18** installe sur ton Mac/PC. Verifie avec `node --version` dans un terminal. Si pas installe : [nodejs.org](https://nodejs.org) (prendre la version LTS).
- **Un compte Asana** avec au moins un projet.
- **Claude Desktop** installe et fonctionnel.

---

## Etape 1 — Generer ton Personal Access Token (PAT) Asana

1. Va sur [app.asana.com](https://app.asana.com)
2. Clique sur ta photo de profil (en haut a droite) > **My Settings**
3. Onglet **Apps**
4. Descends jusqu'a **Developer apps** > **Personal Access Tokens**
5. Clique **Create new token**
6. Nom du token : `Claude Desktop ISSA` (ou ce que tu veux)
7. Clique **Create token**
8. **Copie le token immediatement** — il ne sera plus visible apres.

**Securite** : ne partage jamais ce token. Ne le colle pas dans un fichier committe sur GitHub. Stocke-le dans `.env.local` du projet si besoin, ou uniquement dans le fichier de config Claude Desktop (etape 3).

---

## Etape 2 — Localiser le fichier de config Claude Desktop

Le fichier s'appelle `claude_desktop_config.json` :

- **macOS** : `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows** : `%APPDATA%\Claude\claude_desktop_config.json`

Si le fichier n'existe pas, cree-le avec `{}` comme contenu.

---

## Etape 3 — Verifier le bon package npm

Le serveur MCP officiel d'Asana est publie par Asana sur GitHub :
- Repo : [github.com/Asana/asana-mcp-server](https://github.com/Asana/asana-mcp-server)

**[A VERIFIER PAR THOMAS]** : avant de configurer, va sur ce repo GitHub et lis le README pour confirmer :
1. Le nom exact du package npm (probablement `@anthropic-ai/asana-mcp-server` ou `asana-mcp-server`)
2. La commande d'installation exacte
3. Les eventuelles mises a jour de configuration

Si le repo n'existe pas ou a change de nom, cherche "asana mcp server" sur npm ([npmjs.com](https://npmjs.com)) ou dans la doc officielle d'Asana.

---

## Etape 4 — Configurer Claude Desktop

Ouvre `claude_desktop_config.json` et ajoute la configuration MCP. Exemple type (adapter le nom du package selon ce que tu as trouve a l'etape 3) :

```json
{
  "mcpServers": {
    "asana": {
      "command": "npx",
      "args": ["-y", "asana-mcp-server"],
      "env": {
        "ASANA_ACCESS_TOKEN": "COLLE_TON_PAT_ICI"
      }
    }
  }
}
```

**Important** :
- Remplace `COLLE_TON_PAT_ICI` par le token copie a l'etape 1.
- Remplace `asana-mcp-server` par le nom exact du package confirme a l'etape 3.
- Si tu as deja d'autres MCP configures (ex: filesystem), ajoute `"asana": {...}` dans le bloc `mcpServers` existant sans supprimer les autres.

---

## Etape 5 — Redemarrer Claude Desktop

**Quitter completement** Claude Desktop (pas juste fermer la fenetre) :
- **macOS** : Cmd+Q ou clic droit icone Dock > Quitter
- **Windows** : clic droit dans la barre des taches > Quitter

Puis rouvre Claude Desktop.

---

## Etape 6 — Tester

Dans Claude Desktop, tape :

> "Liste mes projets Asana"

Si Claude repond avec la liste de tes projets Asana, c'est bon. Le MCP est connecte.

Tu peux aussi tester :
- "Cree une tache 'Test MCP' dans mon premier projet Asana"
- "Quelles sont les taches en cours dans mon projet [nom du projet] ?"

---

## Troubleshooting

### "MCP server failed to start" ou erreur au lancement

1. Verifie que Node.js >= 18 est installe : `node --version`
2. Verifie que le chemin du fichier config est correct (etape 2)
3. Essaie d'executer la commande manuellement dans un terminal :
   ```
   npx -y asana-mcp-server
   ```
   Si ca plante ici, c'est un probleme Node.js / npm, pas Claude.

### "Unauthorized" ou "Invalid token"

1. Va sur Asana > My Settings > Apps > Personal Access Tokens
2. Verifie que le token n'a pas expire ou ete revoque
3. Regenere un nouveau token si besoin, et mets a jour le fichier config

### Claude ne voit pas les outils Asana

1. Verifie que tu as bien **quitte et relance** Claude Desktop (pas juste ferme la fenetre)
2. Verifie qu'il n'y a pas d'erreur de syntaxe JSON dans le fichier config (virgule manquante, guillemet en trop)
3. Ouvre le fichier dans un editeur de code (VS Code) pour validation automatique du JSON

---

## Que faire avec Asana + Claude

Une fois connecte, Claude peut :
- Lister tes projets et taches
- Creer, modifier, completer des taches
- Chercher des taches par mot-cle
- Deplacer des taches entre sections/projets

Exemples concrets pour ISSA Capital :
- "Cree une tache 'Envoyer DPA Anthropic' avec deadline vendredi prochain"
- "Liste les taches en retard"
- "Marque la tache 'Preparer email RGPD Carl/Maxime' comme terminee"
