# Database de contacts — Agent Secrétariat ISSA Capital

> Fichier de pré-remplissage initial (RES2 — décision Thomas 2026-04-08).
> Format : un contact par bloc, séparés par `---`.
> Source : `project-context.md` + réponses Thomas Q4.1 (Emmanuel Gomez = Président Gradient One).
> **Action Thomas** : compléter les champs `[À COMPLÉTER]`, ajouter les contacts manquants, valider/corriger les contacts pré-remplis.
> **Action @fullstack/@ia** : importer ce fichier comme seed initial dans la base de données de l'agent secrétariat. Format final probable : SQLite ou JSON sur Replit, structure `{ id, prenom, nom, titre, societe, email, telephone, entites_visibles, notes, source, created_at }`.

---

## Famille Issa — actionnariat & gouvernance

### Thomas Issa
- **Rôle** : Président, ISSA Capital
- **Entité principale** : ISSA Capital
- **Accès agent secrétariat** : TOUT (toutes entités)
- **Numéro WhatsApp** : `[À COMPLÉTER PAR THOMAS]`
- **Email** : `[À COMPLÉTER PAR THOMAS]`
- **Notes** : fondateur, dirigeant, signature scannée à uploader (RES5)

---

### Jean-Pierre Issa
- **Rôle** : Co-Managing Director, 2J Impression / Père de Thomas
- **Entité principale** : 2J Impression (participation personnelle, hors périmètre ISSA Capital SAS)
- **Notes** : co-actionnariat 2J Impression depuis ~1994, board majoritaire désormais. Mention dans CR uniquement si réunion familiale ou board impliquant la famille élargie. Racines libanaises (origine Liban → France années 70).
- **Source** : `project-context.md` ligne 142

---

### Sonia Issa
- **Rôle** : Architecte d'intérieur / Mère de Thomas
- **Entité principale** : (indépendante)
- **Notes** : non opérationnelle dans ISSA Capital. À mentionner uniquement si réunion familiale.
- **Source** : `project-context.md` ligne 108

---

## Gradient One — co-actionnariat (3 actionnaires)

### Carl `[NOM DE FAMILLE À COMPLÉTER]`
- **Rôle** : Co-actionnaire Gradient One `[TITRE EXACT À COMPLÉTER]`
- **Entité principale** : Gradient One
- **Accès agent secrétariat** : Gradient One + Versi Immobilier + Versi Invest + filiales du périmètre Gradient One (Versimo, Immocrew). **PAS d'accès aux CR ISSA Capital.**
- **Numéro WhatsApp** : `[À COMPLÉTER PAR THOMAS]`
- **Email** : `[À COMPLÉTER PAR THOMAS]`
- **Notes** : co-actionnaire Gradient One avec Thomas et Maxime. À whitelister sur l'agent secrétariat.

---

### Maxime `[NOM DE FAMILLE À COMPLÉTER]`
- **Rôle** : Co-actionnaire Gradient One `[TITRE EXACT À COMPLÉTER]`
- **Entité principale** : Gradient One
- **Accès agent secrétariat** : Gradient One + Versi Immobilier + Versi Invest + filiales du périmètre Gradient One (Versimo, Immocrew). **PAS d'accès aux CR ISSA Capital.**
- **Numéro WhatsApp** : `[À COMPLÉTER PAR THOMAS]`
- **Email** : `[À COMPLÉTER PAR THOMAS]`
- **Notes** : co-actionnaire Gradient One avec Thomas et Carl. À whitelister sur l'agent secrétariat.

---

### Emmanuel Gomez
- **Rôle** : Président, Gradient One
- **Entité principale** : Gradient One
- **Notes** : président opérationnel de Gradient One. Cité par Thomas dans Q4.1 comme cas d'usage type ("déjeuner avec Emmanuel Gomez ce midi au restaurant pour discuter des prochains lancements Versimo"). Lien direct avec Versimo (filiale de Gradient One) suggère un rôle transverse.
- **Source** : Q4.1 réponse Thomas
- **À confirmer Thomas** : Emmanuel Gomez fait-il partie des 3 co-actionnaires Gradient One, ou est-il président opérationnel séparé ? `[À CONFIRMER PAR THOMAS]`

---

## 2J Impression (participation historique famille Issa, hors périmètre juridique ISSA Capital SAS)

### Najib Bahous
- **Rôle** : Président, 2J Impression
- **Entité principale** : 2J Impression
- **Notes** : co-actionnaire présumé, partenaire historique de Jean-Pierre Issa
- **Source** : `project-context.md` ligne 140

---

### Willy Peltier
- **Rôle** : CEO + Co-owner, 2J Impression
- **Entité principale** : 2J Impression
- **Notes** : 2e co-actionnaire, partenaire historique de Jean-Pierre Issa
- **Source** : `project-context.md` ligne 141

---

### Xavier Briols
- **Rôle** : Systems Engineer / Project Manager, 2J Impression
- **Entité principale** : 2J Impression
- **Source** : `project-context.md` ligne 143

---

### Jocelyn Darre
- **Rôle** : Commercial Engineer, 2J Impression
- **Entité principale** : 2J Impression
- **Source** : `project-context.md` ligne 144

---

## Contacts à compléter par Thomas (placeholders pour ajout)

### Versi Immobilier — équipe / co-gérants
`[À COMPLÉTER PAR THOMAS]` — qui sont les co-gérants opérationnels Versi Immobilier ?

### Versi Invest — équipe / co-gérants
`[À COMPLÉTER PAR THOMAS]` — qui sont les co-gérants opérationnels Versi Invest ?

### Immocrew — équipe / dirigeants
`[À COMPLÉTER PAR THOMAS]` — qui dirige Immocrew ?

### Versimo — équipe / dirigeants
`[À COMPLÉTER PAR THOMAS]` — qui dirige Versimo (au-delà d'Emmanuel Gomez) ?

### Conseillers ISSA Capital
- Expert-comptable : `[À COMPLÉTER PAR THOMAS]`
- Avocat fiscaliste : `[À COMPLÉTER PAR THOMAS]`
- Notaire : `[À COMPLÉTER PAR THOMAS]`
- Banquier privé : `[À COMPLÉTER PAR THOMAS]`

### Conseillers immobilier
- Agents immo récurrents : `[À COMPLÉTER PAR THOMAS]`
- Promoteurs / chasseurs : `[À COMPLÉTER PAR THOMAS]`

---

## Schéma de données proposé pour l'implémentation

```json
{
  "id": "uuid-v4",
  "prenom": "string",
  "nom": "string",
  "titre": "string (ex: 'Président', 'Associé', 'Directeur Général')",
  "societe": "string (ex: 'Gradient One')",
  "email": "string (optionnel)",
  "telephone": "string (optionnel)",
  "whatsapp_authorized": "boolean (true si la personne a accès à l'agent secrétariat)",
  "entites_visibles": ["IC", "GO", "VI", "VV"],
  "notes": "string (libre)",
  "source": "string (ex: 'import_initial', 'creation_inline_2026-04-15')",
  "created_at": "ISO timestamp",
  "updated_at": "ISO timestamp"
}
```

**Codes entités** :
- `IC` = ISSA Capital
- `GO` = Gradient One
- `VI` = Versi Immobilier (cf. Q7.1 réponse Thomas)
- `VV` = Versi Invest (cf. Q7.1 réponse Thomas)

---

## Handoff

**→ @fullstack & @ia (agent secrétariat ISSA Capital)**
- Fichier produit : `docs/product/secretariat-contacts-database.md`
- **Action V1** : importer ce fichier comme seed initial dans la base contacts (SQLite recommandé sur Replit Pro Autoscale, ou JSON file persistant)
- **Action V1** : implémenter le flow de saisie inline ("le bot demande Qui est X ?") avec stockage automatique
- **Action V1** : implémenter le CRUD admin sur `issa-capital.com/admin` (module 1 de RES3)
- **Compléments à demander à Thomas avant production** :
  1. Noms de famille de Carl et Maxime
  2. Confirmation du rôle exact d'Emmanuel Gomez (co-actionnaire ou président opérationnel ?)
  3. Numéros WhatsApp de Thomas + Carl + Maxime à whitelister
  4. Equipes opérationnelles Versi Immobilier, Versi Invest, Immocrew, Versimo
  5. Conseillers (expert-comptable, fiscaliste, notaire, banquier)
- **Sécurité** : ce fichier contient des données personnelles professionnelles → traitement RGPD applicable. À cadrer avec @legal (Q5.6 — registre de traitement RGPD à produire)
