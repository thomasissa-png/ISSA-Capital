---
name: draft-email
description: "Rédige un brouillon d'email pour Thomas — réponse à un message reçu ou nouveau message — calibré sur le destinataire (sa fiche contact) et le ton de Thomas. À utiliser quand Thomas dit 'réponds à cet email', 'rédige un mail à X sur Y', 'prépare une réponse à X'. Le brouillon est déposé dans Gmail ; il n'est JAMAIS envoyé — Thomas le relit et l'envoie lui-même."
---

# Skill draft-email — rédiger un brouillon d'email

> Rédiger un **brouillon** d'email pour Thomas — réponse à un message reçu, ou nouveau message — calibré sur le destinataire et le ton de Thomas. Le brouillon est créé dans Gmail via le connecteur ; **il n'est jamais envoyé**. Copie exécutable du workflow maître `08. Outils/Anya/Skills/Workflow Draft Email.md`.

## 1. Trigger

### Déclencheurs verbaux

- **Réponse** : « réponds à [cet email / l'email de X] », « prépare une réponse à [contact] ».
- **Nouveau message** : « rédige un mail à [contact] sur [sujet] », « écris à [contact] pour [intention] ».

### Déclencheur contextuel

Un email entrant appelant une réponse (question, demande, RDV à fixer).

### Skill

La skill s'appelle **`draft-email`**. Chargée sur phrase déclencheuse ou invoquée par son nom. Canaux : Cowork, Telegram via Anya.

### Hors trigger

- Jamais d'envoi automatique — la skill produit un brouillon, point.
- Email de spam → pas de brouillon.

> Le pipeline d'ingestion du bot ne draftait pas automatiquement pour les candidats locataires (ils ont leur propre workflow). Mais si Thomas demande explicitement de répondre à un candidat, la skill le fait normalement.

## 2. Input

### Selon le cas

- **Réponse** : l'email reçu (expéditeur, objet, corps).
- **Nouveau message** : la consigne de Thomas (destinataire, sujet, intention).

### Fiche du contact destinataire

À lire **en entier** (`07. Contacts/`). Elle calibre le ton **et** le fond du brouillon :

- le **registre** — tutoiement si le frontmatter porte `tutoiement: true` ou un champ `registre` contenant « tu » ; vouvoiement par défaut ;
- le **rôle, la fonction, la société** du contact ;
- l'**historique des échanges** et les **dossiers en cours** — pour rester cohérent et ne pas redemander une information déjà connue.

### Autres sources

- **Tonalité de Thomas** — `01. Profil/voice-preferences.md` (source de référence, déjà chargée en session) ; à défaut, la section `## Tonalité` de sa fiche contact.
- **`hot-context.md`** — contexte récent si pertinent.

Sortie via le connecteur Gmail (création de brouillon). Jamais d'envoi.

## 3. Étapes

### 3.1 Identifier le destinataire et lire sa fiche

Déterminer le destinataire. Lire **sa fiche contact en entier** : registre (tu / vous), rôle et société, historique des échanges, dossiers en cours. Destinataire inconnu (aucune fiche) → demander une précision à Thomas, ne pas deviner.

### 3.2 Réunir le reste du contexte

Pour une **réponse** : lire l'email reçu en entier. Pour un **nouveau message** : la consigne de Thomas. Charger la tonalité de Thomas et, si pertinent, le `hot-context`.

### 3.3 Rédiger le brouillon

Rédiger le corps en respectant les règles de rédaction (§ 5.2) et en s'appuyant sur le contexte du contact (§ 3.1). Sujet : pour une réponse, « Re: » + sujet d'origine s'il ne l'a pas déjà ; pour un nouveau message, un objet clair et court.

### 3.4 Créer le brouillon Gmail

Créer le brouillon dans Gmail (destinataire, sujet, corps texte brut) via le connecteur. **Ne jamais envoyer.**

### 3.5 Confirmer

Rendre le récap : destinataire, sujet, aperçu, lien du brouillon. Inviter Thomas à relire, compléter les `[À COMPLÉTER]`, et envoyer lui-même.

## 4. Output

- Un brouillon dans Gmail (jamais envoyé).
- Un récap rendu à Thomas avec le lien.

### Récap (rendu à Thomas)

```
Brouillon créé.

À : [Nom] <[email]>
Objet : [sujet]
Aperçu : [3 premières lignes]
Gmail : [lien du brouillon]

À relire, compléter les [À COMPLÉTER] éventuels, et envoyer manuellement.
```

## 5. Méthode

### 5.1 Red lines

1. **Jamais d'envoi** — la skill crée un brouillon, jamais ne l'expédie.
2. **Zéro invention** — aucun fait (date, montant, nom de bien, engagement) absent de l'email source, de la consigne ou de la fiche contact. Manquant → `[À COMPLÉTER : …]`.
3. **Signature** — « Thomas Issa », sans titre, sans téléphone, sans formule de politesse longue.
4. **Pas de destinataire inventé** — contact non identifiable → demander à Thomas.

### 5.2 Règles de rédaction

- **Phrases courtes et directes.** Répondre précisément à la demande.
- **Bannir les formules creuses** : « j'espère que vous allez bien », « je me permets de », « n'hésitez pas à ».
- **Registre** : tutoiement seulement si la fiche contact l'indique (`tutoiement: true` ou `registre` mentionnant « tu ») ; vouvoiement par défaut, notamment pour tout contact professionnel.
- **S'appuyer sur la fiche contact** : tenir compte du rôle du destinataire et de l'historique de la relation pour calibrer le fond. Ne pas redemander ce que la fiche indique déjà.
- **Format** : texte brut — pas de HTML, pas de markdown.
- **Longueur** : 3 à 10 lignes maximum. Plus court vaut mieux.
- **Information que seul Thomas peut fournir** (montant, date, décision) → `[À COMPLÉTER : la question]`.
- **Signature** : « Thomas Issa ».

### 5.3 Exemple — comment la fiche contact calibre le brouillon

**Demande** : « réponds à Karim Mokhtar, il relance sur le compromis Henri Barbusse 3 ».

**Fiche contact lue** — `Karim Mokhtar` : apporteur d'affaires (donc vouvoiement) ; historique : c'est lui qui a présenté le Lot Henri Barbusse 3, le RDV notaire est en cours de calage.

Ce que la fiche apporte : on **sait déjà** qui est Karim et de quel dossier il s'agit — inutile de le faire préciser ; le ton est celui d'un partenaire d'affaires ; on le remercie pour la coordination, cohérent avec son rôle d'apporteur.

**Brouillon** :

```
Objet : Re: Compromis Lot Henri Barbusse 3 — RDV notaire

Bonjour Karim,

Je vous confirme le rendez-vous chez le notaire mercredi [À COMPLÉTER : heure]
pour la signature du compromis sur le Lot 3 de la rue Henri Barbusse.

Merci pour la coordination.

À mercredi,
Thomas Issa
```

L'heure exacte n'étant ni dans la demande ni dans la fiche, elle est laissée en `[À COMPLÉTER]`.

## Contenu du bundle

- `SKILL.md` — ce fichier. La skill n'a pas de script : la rédaction est faite par Claude, le brouillon créé via le connecteur Gmail de Cowork.

## Liens

- Workflow maître : `08. Outils/Anya/Skills/Workflow Draft Email.md`
- Skill de référence (modèle d'usage) : `08. Outils/Skills/traite-inbox/`
- Préférences de voix : `01. Profil/voice-preferences.md`
- Conventions vault : `CLAUDE.md` (racine vault)
