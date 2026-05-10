# Setup MCP Craft pour Claude

Connecter Claude (Desktop ou web) à ton compte Craft pour lire, résumer et modifier tes notes Craft directement depuis une conversation Claude.

## Pré-requis

- **Abonnement Claude Pro ou Max** (les custom connectors ne sont pas disponibles en plan Free)
- Un compte Craft actif avec au moins un espace
- Aucun Node.js, aucun token à générer manuellement (l'auth se fait via OAuth Craft, géré par Claude)

## Setup pas-à-pas

**1. Ouvre les paramètres Claude**
Va sur https://claude.ai/settings/connectors

**2. Ajoute un custom connector**
Clique sur "Connectors" puis "Add custom connector"

**3. Configure le connecteur**
- Nom : `Craft` (ou ce que tu veux — ex. `Craft ISSA`)
- URL MCP : `https://mcp.craft.do/my/mcp`
- Champs OAuth : laisser vides (Claude gère l'auth automatiquement)

**4. Autorise Craft**
Une fenêtre Craft s'ouvre. Sélectionne l'espace Craft à connecter (si tu as plusieurs espaces) et clique "Approve".

**5. Confirme**
Tu reviens dans Claude. Le connecteur apparaît dans la liste, statut "connected".

## Test

Dans une conversation Claude, demande :
- "Liste mes derniers documents Craft"
- "Résume la note Craft intitulée [nom]"
- "Ajoute une ligne à la note [nom]"

Si ça répond → connecteur opérationnel.

## Fonctionnalités confirmées

- Lecture des documents
- Résumé des notes
- Mise à jour des documents

Création et recherche avancée non documentées explicitement par Craft — à tester dans la pratique.

## Usage pour la migration vers Obsidian

Le MCP Craft permet à Claude de lire tes notes Craft à la demande. Workflow recommandé pour la migration progressive vers le vault `second-cerveau/` :

1. Tu identifies une note Craft à migrer
2. Tu demandes à Claude : "Lis la note Craft [titre], reformate-la au format Obsidian (frontmatter YAML + Markdown standard) et sauvegarde dans `second-cerveau/[dossier]/[nom].md`"
3. Claude lit via MCP, transforme, écrit dans le vault
4. Tu vérifies, tu valides

Pas besoin de tout migrer d'un coup. Au fur et à mesure que tu reviens sur une note Craft, tu la rapatries dans Obsidian.

## Troubleshooting

| Problème | Cause probable | Résolution |
|---|---|---|
| "Custom connector option not visible" | Plan Free | Upgrade vers Pro/Max |
| Auth Craft échoue | Cookies bloqués | Désactiver bloqueurs sur claude.ai et craft.do |
| Connector connecté mais "no documents found" | Mauvais espace sélectionné | Reconfigurer et re-choisir l'espace |
| Claude ne propose pas le tool Craft | Claude ne sait pas qu'il a le tool | Mentionner explicitement "via Craft MCP" dans la requête |

## Source

Documentation officielle Craft : https://www.craft.do/imagine/guide/mcp/claude
