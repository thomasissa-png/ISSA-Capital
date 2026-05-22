---
name: draft-email
description: "Rédige un brouillon de réponse Gmail à partir d'un email entrant triagé. À utiliser pour toute catégorie hors spam et candidat. Le brouillon est créé via Gmail API et relu par Thomas avant envoi manuel."
---

# Skill draft-email — brouillon de réponse Gmail

> Fallback repo (R7). Source de vérité : vault Drive `00. Me/08. Outils/Skills/draft-email/SKILL.md`.
> Génère un brouillon de réponse Gmail prêt à être relu et envoyé manuellement par Thomas. Le ton et le registre (tu/vous) sont injectés dynamiquement à partir de la fiche contact et de la fiche Thomas Issa.

## 1. Trigger

Un email entrant a été triagé avec une catégorie qui mérite réponse (toute catégorie sauf `spam` et `candidat`). Le pipeline `email-ingest` appelle `composeDraft()` automatiquement.

## 2. Input

- **Email source** : expéditeur, objet, corps, date.
- **TriageResult** : catégorie, intent, summary, matchedContact éventuel.
- **Fiche contact vault** (`07. Contacts/`) : frontmatter `tutoiement` ou `registre` → tu/vous.
- **Fiche Thomas Issa** (`07. Contacts/02. Famille/Thomas Issa.md`) : section `## Tonalité` injectée dans le prompt.

## 3. Étapes

### 3.1 Skip si catégorie non éligible
Catégories sans brouillon : `spam`, `candidat`.

### 3.2 Charger le contexte tonalité
Lire la fiche contact (cache TTL 1h) → registre tu/vous. Lire la fiche Thomas → section Tonalité.

### 3.3 Générer le corps du brouillon via Sonnet
Appel Anthropic Sonnet 4, maxTokens 1024, timeout 30s.

### 3.4 Créer le brouillon Gmail
`drafts.create` via Gmail API. Sujet : `Re: <objet original>` si pas déjà préfixé.

### 3.5 Retourner l'URL Gmail
Pour le bouton Telegram « Ouvrir dans Gmail ».

## 4. Output

- `draftId` Gmail
- `gmailUrl` direct vers le brouillon
- `preview` : première ligne du brouillon (notif Telegram)

## 5. Méthode

### 5.1 Red lines

1. Ne JAMAIS inventer de dates, montants, noms de biens ou informations factuelles non présentes dans l'email source.
2. Si une info manque et que seul Thomas peut répondre → marqueur `[À COMPLÉTER : question]`.
3. Signature : « Thomas Issa » seul (pas de titre, pas de téléphone, pas de formule longue).
4. Format : texte brut uniquement, pas de HTML, pas de markdown.
5. Longueur : 3 à 10 lignes max. Plus court = mieux.
6. Pas de formules creuses (« j'espère que vous allez bien », « je me permets de », « n'hésitez pas »).
7. Pas d'envoi automatique — Thomas relit et envoie manuellement.

### 5.2 Arbre de décision — registre tu/vous

```
Fiche contact existe ?
├── Oui
│   ├── frontmatter.tutoiement = true → tu
│   └── frontmatter.registre contient "tu" → tu
│   └── sinon → vous
└── Non → vous (défaut)
```

### 5.3 Critères de qualité

- Réponse directe à la demande de l'email.
- Tonalité conforme à la section Tonalité de la fiche Thomas.
- Registre tu/vous conforme à la fiche contact.
- Marqueurs `[À COMPLÉTER]` explicites pour toute info dépendant de Thomas.
