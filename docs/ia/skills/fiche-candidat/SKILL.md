---
name: fiche-candidat
description: "Crée ou complète la fiche d'un candidat à la location dans 07. Contacts/05. Locataires/_Candidats/. À utiliser quand Thomas dit 'crée une fiche candidat pour X', 'nouveau candidat locataire', ou quand un email arrive d'une personne intéressée par un bien à louer. Produit une fiche markdown de suivi au format unifié (suivi du candidat + état civil pour générer le bail s'il signe). Ne produit aucun document, n'établit aucun score, ne contacte pas le candidat."
---

# Skill fiche-candidat — fiche de candidat à la location

> Créer (ou compléter) la fiche d'un **candidat à la location** dans `07. Contacts/05. Locataires/_Candidats/`. Fiche de suivi qui accompagne le candidat de la première prise de contact à une éventuelle signature de bail. Aucun document produit, aucun score, aucun envoi — uniquement une fiche markdown. Copie exécutable du workflow maître `08. Outils/Anya/Skills/Workflow Fiche Candidat Locataire.md`.

## 1. Trigger

### Déclencheurs verbaux

« crée une fiche candidat pour [nom] », « nouveau candidat locataire », « fiche candidat : [nom], [infos] ».

### Déclencheur contextuel

Un email entrant d'une personne intéressée par un bien à louer (dossier locatif, demande de visite, candidature plateforme) → création ou mise à jour de la fiche.

### Skill

La skill s'appelle **`fiche-candidat`**. Chargée sur phrase déclencheuse ou invoquée par son nom. Canaux : Cowork, email transmis, Telegram via Anya.

### Hors trigger

- Locataire déjà en place → fiche dans `01. Actuels/`.
- Génération de bail → workflow Baux.
- Contact non lié à une location → fiche contact standard.

## 2. Input

Données du candidat, collectées auprès de Thomas ou extraites d'un email : identité (prénom, nom), contact (email, téléphone), situation professionnelle, garanties, bien visé, notes de suivi.

Aucune donnée ne s'invente : une information non fournie reste un champ vide.

À consulter : `_Candidats/` (fiche déjà existante ?), le référentiel des biens (adresse exacte du lot si le bien visé est connu).

Nommage : `07. Contacts/05. Locataires/_Candidats/Prénom Nom.md` — sans accent dans le nom de fichier.

## 3. Étapes

### 3.1 Vérifier l'existant

Chercher une fiche du même candidat dans `_Candidats/`. Si elle existe → compléter (§ 3.4), ne pas recréer.

### 3.2 Collecter les informations

Réunir les données du candidat. En conversationnel, les demander une par une ; depuis un email, les extraire. Information non disponible → champ laissé vide.

### 3.3 Créer la fiche

Créer `_Candidats/Prénom Nom.md` avec le **frontmatter unifié** — les champs d'état civil et de bail peuvent rester vides au stade candidature, ils servent à générer le bail si le candidat signe :

```yaml
---
type: contact
categorie: locataire
statut: candidat
prenom: <Prénom>
nom: <Nom>
nom_officiel: <Nom complet officiel — pour le bail>
civilite: <Monsieur | Madame | Mademoiselle>
email: <email>
telephone: <téléphone>
date_naissance: <AAAA-MM-JJ — pour le bail>
lieu_naissance: <lieu — pour le bail>
nationalite: <nationalité — pour le bail>
bien_vise: <bien souhaité>
adresse_bien: <adresse exacte du lot — pour le bail>
montant_loyer: <€ — pour le bail>
montant_charges: <€ — pour le bail>
depot_garantie: <€ — défaut 1000>
date_entree_bail: <AAAA-MM-JJ — si connue>
jour_paiement: <1-28 — défaut 1>
date_premier_contact: <AAAA-MM-JJ>
date_derniere_interaction: <AAAA-MM-JJ>
tags: [locataire, candidat]
---
```

Corps : titre `# Prénom Nom`, puis sections `## Contact`, `## Situation professionnelle`, `## Garanties`, `## Bien visé`, `## Dossier locatif`, `## Historique` (une ligne datée pour la prise de contact), `## Notes` (vide).

### 3.4 Compléter une fiche existante

Ajouter une ligne datée dans `## Historique`, combler les champs encore vides, mettre à jour `date_derniere_interaction`. Ne jamais écraser le contenu existant.

### 3.5 Confirmer

Rendre le récap : nom, bien visé, lien de la fiche, champs encore à compléter.

## 4. Output

- Une fiche markdown `_Candidats/Prénom Nom.md` créée ou complétée.
- Un récap signalant les champs vides à compléter.

### Récap (rendu à Thomas)

```
Fiche candidat créée.

Candidat : [Prénom Nom]
Bien visé : [bien]
Fiche : [lien]
À compléter : [champs encore vides — état civil, loyer, etc.]
```

## 5. Méthode

### 5.1 Red lines

1. **Zéro invention** — toute donnée vient du candidat ou de Thomas. Information non fournie → champ vide, jamais devinée.
2. **Compléter ≠ remplacer** — une fiche existante s'enrichit, son contenu n'est jamais écrasé.
3. **Aucune décision** — la skill ne valide ni ne refuse, n'établit aucun score. Elle enregistre les faits ; Thomas décide.
4. **Aucun critère discriminatoire** — ne consigner que des éléments objectifs et licites du dossier locatif. Jamais d'appréciation sur l'origine, la religion, la situation familiale, l'âge ou tout critère prohibé.
5. **Pas d'envoi** — la skill ne contacte pas le candidat.

### 5.2 Critères de qualité

- Fiche au format unifié : frontmatter complet (champs vides admis), corps structuré.
- Nom de fichier `Prénom Nom.md` sans accent, dans `_Candidats/`.
- Aucune donnée inventée.
- Fiche existante enrichie sans perte.
- Récap signalant les champs à compléter.

### 5.3 Cycle de vie

- **Candidature** : fiche dans `_Candidats/`, `statut: candidat`.
- **Signature du bail** : déplacer vers `01. Actuels/`, retirer `statut: candidat`, compléter les champs d'état civil et de bail → fiche prête pour le workflow Baux.
- **Non retenue / abandonnée** : archiver ou supprimer selon le choix de Thomas.

### 5.4 Exemple

**Demande** : « crée une fiche candidat — Marie Dupont, marie.dupont@email.com, CDI cadre, garant parents, intéressée par le studio Henri Barbusse ».

**Traitement** : aucune fiche `Marie Dupont` dans `_Candidats/` → création. Frontmatter renseigné pour prénom, nom, email, `statut: candidat`, `bien_vise: studio Henri Barbusse` ; les champs d'état civil (civilité, date et lieu de naissance, nationalité) et de bail (loyer, charges, date d'entrée) restent **vides** — ils ne sont pas devinés, ils se compléteront si le candidat signe.

**Fiche produite** : `_Candidats/Marie Dupont.md`. Corps avec `## Contact` (email, canal d'arrivée), `## Situation professionnelle` (CDI cadre), `## Garanties` (garant parents), `## Bien visé` (studio Henri Barbusse) renseignés ; `## Dossier locatif` et `## Notes` vides ; `## Historique` avec la ligne datée du jour.

**Récap** : « Fiche candidat créée — Marie Dupont, studio Henri Barbusse. À compléter : civilité, date et lieu de naissance, nationalité, loyer, charges, date d'entrée. »

## Contenu du bundle

- `SKILL.md` — ce fichier. La skill n'a pas de script : créer une fiche markdown est une opération que Claude exécute nativement.

## Liens

- Workflow maître : `08. Outils/Anya/Skills/Workflow Fiche Candidat Locataire.md`
- Skill de référence (modèle d'usage) : `08. Outils/Skills/traite-inbox/`
- Workflow aval (génération du bail) : `08. Outils/Workflows/Workflow Baux.md`
- Conventions vault : `CLAUDE.md` (racine vault)
