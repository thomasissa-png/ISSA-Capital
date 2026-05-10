# Setup Craft dans Claude

Craft est un **connector natif Claude** depuis mars 2026. Pas besoin de MCP technique, pas de URL à coller manuellement.

## Setup (60 secondes)

1. Va sur **claude.ai/customize/connectors**
2. Cherche **Craft** dans le directory
3. Clique **"Connect"**
4. Autorise via le flow OAuth Craft (sélectionne ton espace)
5. C'est connecté

## Test

Dans n'importe quelle conversation Claude :
- "Liste mes derniers documents Craft"
- "Résume la note Craft intitulée [nom]"
- "Cherche dans Craft toutes les notes contenant [mot-clé]"

## Usage pour la migration vers Obsidian

Workflow recommandé pour migrer progressivement Craft → Obsidian :

1. Identifie une note Craft à migrer
2. Demande à Claude : "Lis la note Craft [titre], reformate-la au format Obsidian (frontmatter YAML + Markdown standard) et sauvegarde dans `second-cerveau/[dossier]/[nom].md`"
3. Claude lit via le connector, transforme, écrit dans le vault
4. Tu vérifies, tu valides

## Plans requis

- Directory connectors : disponibles sur tous les plans Claude, y compris Free

## Source

- https://claude.com/connectors
