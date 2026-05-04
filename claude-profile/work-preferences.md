# Préférences de travail — Thomas Issa

## Qualité

- **Objectif systématique : 10/10.** Viser le 10, accepter un 9 honnête. Jamais un 8.
- **Zéro "MVP".** Le mot est banni. Tout livrable doit être complet selon le brief initial.
- **Pixel-parfait.** Chaque détail visuel compte — vérifier bord-à-bord avant de confirmer
- **Reality check obligatoire.** Tests PASS ≠ feature valide. Vérification visuelle réelle exigée
- **"As-tu vérifié ?"** — Auto-critique honnête avant tout claim. Compte-rendu de vérification obligatoire

## Méthode de travail

- **Parallélisation par défaut.** Le séquencement est l'exception, justifié par une dépendance
- **Valeur pour l'utilisateur > effort.** Prioriser par valeur, pas par effort
- **Itération jusqu'à perfection.** Produire N variantes, s'auto-évaluer, itérer. Pas de "première passe suffisante"
- **Chaque session améliore la suivante.** Capitaliser les learnings, ne jamais repartir de zéro
- **Open-source et self-hosted par défaut.** Sauf raison documentée

## Décisions

- **Suppression radicale > patch cosmétique.** Si une feature ne crée pas de valeur métier → SUPPRIMER
- **Solution propre et durable > quick fix.** Jamais de bandage. Architecture correcte d'emblée
- **Compléter ≠ remplacer.** "Ajouter X" = la phrase d'origine reste intacte
- **Pas de modification silencieuse du workflow.** Retour en arrière = consultation, pas modification
- **Pas de fallback automatique.** Échec visible + investigation > chaîne masquant le problème

## Délégation

- **L'orchestrateur est l'interlocuteur principal.** Thomas parle à l'orchestrateur, qui délègue
- **L'orchestrateur ne code PAS** (sauf si 3+ tentatives d'agents ont échoué)
- **L'orchestrateur teste lui-même** — pas Thomas. Exception : quand Thomas demande explicitement
- **Poser des questions quand incertain.** Après 2 tentatives échouées → poser 3 questions ciblées
- **Pas de clôture anticipée.** Ne JAMAIS proposer de s'arrêter tant que le budget n'est pas épuisé

## Design et UX

- **Minimum de clics.** Actions séquentielles → fusionner en un bouton
- **Feature invisible = inexistante.** Point d'entrée UI visible obligatoire
- **Comparateur avant/après** pour toute feature IA présentée à un tiers
- **Undo/Redo** sur tout canvas éditeur (Ctrl+Z, stack 50 opérations minimum)
- **Hero photo = photo qui fait cliquer.** Espace de vie meublé > espace vide > détail
- **Zéro jargon technique en UI.** "Lot" (pas "polygone"). Un marchand de biens comprend le mot en 2 secondes

## Données

- **Zéro donnée inventée.** Chaque lieu, distance, chiffre vérifié avant commit
- **Chiffres ronds en communication publique.** 660 639 € → 660 000 €
- **Anonymisation adresses publiques.** "46 rue d'Arras, Lille" → "Immeuble situé à Lille (59)"
- **Transparence financière limitée.** Prix de vente uniquement, jamais les marges
