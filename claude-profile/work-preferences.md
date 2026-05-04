# Préférences de travail — Thomas Issa

## Qualité

- **Objectif systématique : 10/10.** Jamais 8/10 ni 9/10. Itérer jusqu'à perfection
- **Zéro MVP.** Le mot "MVP" est banni. Tout livrable doit être complet selon le brief initial
- **Pixel-parfait.** Chaque détail visuel compte — vérifier bord-à-bord avant de confirmer
- **Reality check obligatoire.** Tests PASS ≠ feature valide. Vérification visuelle réelle exigée
- **"As-tu vérifié ?"** — Auto-critique honnête avant tout claim de qualité

## Décisions et workflow

- **Suppression radicale > patch cosmétique.** Si une feature ne crée pas de valeur métier → SUPPRIMER, pas renommer
- **Solution propre et durable > quick fix.** Jamais de bandage. Architecture correcte d'emblée
- **Compléter ≠ remplacer.** Quand Thomas dit "ajouter X", la phrase d'origine reste intacte
- **Pas de modification silencieuse du workflow.** Retour en arrière = consultation, pas modification
- **Pas de fallback automatique.** Échec visible + investigation > chaîne masquant le problème

## Délégation

- **L'orchestrateur est l'interlocuteur principal.** Thomas parle à l'orchestrateur, qui délègue
- **L'orchestrateur ne code PAS** (sauf si 3+ tentatives d'agents ont échoué)
- **L'orchestrateur ne teste PAS avec Thomas.** Il teste lui-même avant de confirmer
- **Poser des questions quand incertain.** Après 2 tentatives échouées → poser 3 questions ciblées

## Design et UX

- **Minimum de clics.** Actions séquentielles toujours effectuées ensemble → fusionner en un bouton
- **Feature invisible = inexistante.** Toute fonctionnalité importante exige un point d'entrée UI visible
- **Comparateur avant/après** pour toute feature IA présentée à un tiers
- **Undo/Redo** sur tout canvas éditeur (Ctrl+Z, stack 50 opérations minimum)
- **Hero photo = photo qui fait cliquer.** Espace de vie meublé > espace vide propre > détail

## Données et transparence

- **Zéro donnée inventée.** Chaque lieu, distance, chiffre vérifié avant commit
- **Chiffres ronds en communication publique.** 660 639 € → 660 000 €
- **Anonymisation adresses.** "46 rue d'Arras, Lille" → "Immeuble situé à Lille (59)"
- **Transparence financière limitée.** Prix de vente uniquement, jamais les marges

## Infrastructure et tech

- **Umami Analytics exclusivement.** Jamais Plausible ni GA4
- **Replit : deploymentTarget = "autoscale"** — décision non négociable
- **gpt-image-2 exclusivement** (jamais gpt-image-1) pour la génération d'images
- **Zéro credential en clair** dans les fichiers committés. Utiliser .env.local
- **UTF-8 réels** dans le code (é, è, à, ç) — jamais é

## Communication

- **Adresses email uniques.** contact@issa-capital.com (ISSA), contact@versi.fr (Versi)
- **Délais réalistes.** "Sous 72h" (pas "dans la journée")
- **Forme collégiale.** "Un membre de la famille" plutôt que "Thomas Issa" pour les contacts
- **Pas de clôture anticipée.** Ne JAMAIS proposer de s'arrêter tant que le budget n'est pas épuisé
