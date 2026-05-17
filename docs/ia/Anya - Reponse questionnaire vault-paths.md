# Réponses questionnaire vault-paths — Anya email-ingest V1

> Source : `anya-vault-paths-questionnaire.md` (S14, 2026-05-14)
> Réponses vérifiées par scan direct du vault Drive le 2026-05-17.

## ⚠️ Préambule critique

**Le dossier racine du vault a été renommé** : `Obsidian/` → `00. Me/`.

Tous les paths ci-dessous sont relatifs à `00. Me/` (My Drive racine).
Si `DRIVE_VAULT_ROOT_ID` côté Replit pointe encore sur `Obsidian/`, c'est probablement le bug bloquant. À corriger d'abord.

---

## A. Structure racine du vault Drive

**A1.** Racine `00. Me/` = `01. Profil/`, `02. Projets/`, `03. Tâches/`, `04. Journal/`, `05. Notes/`, `06. Réunions/`, `07. Contacts/`, `08. Outils/`, `09. Administratif/`, `_Inbox/`, `Templates/`, `CLAUDE.md`. Accents préservés dans les noms de dossiers.

**A2.** `_Inbox/` existe à la racine. Sous-dossiers : `Plaud/`, `Photos/`, `Voice/`, `_Traité/`, **`AnyaLogs/`** ✅ (déjà actif, `2026-05-16.jsonl` contient 78 entrées valides). `AnyaState/` n'existe pas encore — Anya peut le créer.

---

## B. Paths exacts pour les 4 handlers

**B1.** Notes à classifier = `05. Notes/A classifier/`. **N'existe pas encore — à créer au premier handler.** Convention nom : `YYYY-MM-DD - Sujet email.md`.

**B2.** Contacts pro = `07. Contacts/03. Pro/`. Convention nom : `Prenom Nom.md` **ASCII sans accent** (ex : `Francois Xavier Lamarck.md`). **Tout à plat**, pas de sous-dossiers. 22 fiches existantes.

**B3.** Locataires actuels = `07. Contacts/05. Locataires/01. Actuels/`. Anciens = `07. Contacts/05. Locataires/02. Anciens/`. Convention nom : `Prenom Nom.md` (sans accent). 11 actuels + 4 anciens.

**B4.** Candidats locataires = `07. Contacts/05. Locataires/_Candidats/`. ✅ Existe avec `_README.md` documenté. Convention nom : `Prenom Nom.md`. Frontmatter : ajouter `statut: candidat`, retirer à la signature.

**B5.** Fiches biens = `02. Projets/01. Perso/Immobilier Direct/Biens/` (**pas dans Contacts**). Convention nom : adresse compacte (`74 rue Myrha.md`, `2bis bd de la Seine.md`). 4 biens existants. Pour opportunités/apporteurs : proposer création de `02. Projets/01. Perso/Immobilier Direct/Opportunités/` (à valider Thomas). Convention : `YYYY-MM-DD - Adresse courte.md`.

---

## C. Conventions de nommage

**C1.** Noms de fichiers **ASCII sans accent** pour contacts (règle CLAUDE.md vault). Contenu markdown en UTF-8 avec accents normalement. Anya doit utiliser `slugify()` (déjà en place).

**C2.** Caractères à transformer : `/` `\` `:` `*` `?` `"` `<` `>` `|` interdits → supprimer ou remplacer par espace. Apostrophe `'` → supprimer. Accents → NFD + remove diacritics.

**C3.** Longueur max : 80 caractères (les réunions vont jusqu'à ~50, marge OK).

---

## D. Structure interne fiches contacts

**D1.** Frontmatter réel (Martin Yhuel, contact pro) :
```yaml
---
type: contact
categorie: pro
societe: PNM Avocats
role: Avocat Associé
email: myhuel@pnmavocats.law
telephone: +33 6 82 85 14 83
rencontre_via: 
date_premier_contact: 
date_derniere_interaction: 2026-04-11
classification: 
tags:
  - pro
  - juridique
---
```

Locataire (Kenan) — champs en plus : `civilite`, `nom_officiel` (NOM majuscule), `date_naissance`, `lieu_naissance`, `nationalite`, `adresse_bien`, `surface_m2`, `date_entree_bail`, `date_fin_bail`, `montant_loyer`, `montant_charges`, `jour_paiement`, `depot_garantie`, `garant`.

Clés frontmatter **sans accent** (`societe`, `categorie`). Valeurs avec accents OK.

**D2.** Email **unique** dans le frontmatter (`email: x@y.com`, pas tableau). Emails secondaires en **texte libre dans `## Notes`** au format `Emails secondaires: a@x, b@y`.

Pour matcher sender → contact, Anya parse :
1. frontmatter `email:` (primaire)
2. regex sur section `## Notes` : `/[Ee]mails?\s+secondaires?\s*:\s*(.+)/`

**D3.** Section `## Historique`, format H3 :
```markdown
## Historique

### 2026-05-14 — Demande validation clause bail

Avocat demande validation clause bail spécifique. (cf. thread Gmail `19xxxxxxx`)
```

Em-dash `—` (U+2014), pas tiret simple. Ajouter référence email en fin : `(cf. thread Gmail <thread_id>)` ou `(cf. email Outlook <internetMessageId>)`.

**D4.** **Chrono-inverse** (nouvelle entrée en haut). État actuel des fiches : pas cohérent — ne PAS réorganiser rétroactivement, appliquer chrono-inverse pour les nouvelles entrées Anya uniquement.

---

## E. Todo.md

**E1.** Chemin : `03. Tâches/Todo.md` (mode d'emploi dans `03. Tâches/_comment-utiliser.md`).

**E2.** Sections (dans l'ordre) :
```
## Inbox
## Aujourd'hui
## Cette semaine
## Ce mois
## Planning futur
   ### Voyages
   ### Famille
   ### Administratif
## Délégué / En attente
## Un jour
## Récurrents
   ### Garde et finance (mensuel)
   ### Dates fixes famille (anniversaires)
   ### Amis (anniversaires)
   ### Fêtes annuelles
## Précisions à apporter
```

**E3.** Format ligne :
```
- [ ] Action 📅 YYYY-MM-DD #tag #ctx-xxx
- [ ] [Projet] Action (cf. [[wikilink]]) 📅 YYYY-MM-DD #tag #ctx-xxx
- [ ] Récurrent 🔁 every month on the 25th #tag
- [x] Cochée ✅ YYYY-MM-DD
```

⚠️ Utiliser `#ctx-xxx`, **pas `@xxx`** (bug Tasks plugin v8). Tags : `#famille #maison #sante #admin #finance #perso #garde #issa #versi #gradient-one #immobilier-direct #sarani #outils`.

**E4.** Anya peut ajouter dans `## Inbox` auto — **déjà codé** dans `src/lib/secretariat/drive-todo.ts` (workflow `inbox-message-router` S13). Réutiliser ce module pour les handlers email.

---

## F. Réunions

**F1.** Chemin : `06. Réunions/YYYY/MM/`.

**F2.** Convention nom : `YYYY-MM-DD - Personnes - Sujet.md`. Accents OK dans la partie sujet (ex : `2026-04-09 - Thomas Maxime Carl - Pacte associes Gradient One.md`).

**F3.** Pas de `Calendrier.md` central. Agrégation via Full Calendar plugin + frontmatter. Création d'événements Google Calendar gérée par `inbox-message-router`.

---

## G. Cas particuliers

**G1. Versi vs ISSA = un seul vault**. Distinction par tags frontmatter (`tags: [pro, juridique]`, `tags: [pro, versi]`) + section `## Projets liés` avec wikilinks (`[[ISSA Capital]]`, `[[Gradient One]]`, `[[Versi Immobilier]]`). **Ne pas créer de sous-arborescence par entité.**

**G2. Famille vs Pro = séparation par dossier** :
- `07. Contacts/01. Famille/` (parents, enfants, fratrie, conjoint, belle-famille)
- `07. Contacts/02. Amis/` (Carl et Maxime y sont, malgré statut de cofondateurs)
- `07. Contacts/03. Pro/`
- `07. Contacts/04. Autres/`

Hybrides (ami + associé) : par défaut `02. Amis/` + tags additionnels. Anya **ne re-classe pas** un contact existant.

**G3. Comptes mail** :
- Gmail : `thomas.issa@gmail.com` ✅ confirmé
- Outlook : **à confirmer avec Thomas** — pas de référence explicite trouvée dans le vault. Si pas d'Outlook actif → P1 = Gmail seul, Outlook reporté.

Anya traite tout (pas de filtre adresse), le triage Haiku se charge de classer.

---

## H. Listes maîtres

**H1. Locataires actuels = listing dynamique** de `07. Contacts/05. Locataires/01. Actuels/`. Pas de fichier centralisé.

11 locataires au 2026-05-17 (emails extraits du frontmatter) :
```
Hella Taoutaou         hallataoutaou08@gmail.com
Jhon Michael Completo  jhayanglo25@gmail.com
Kenan Beguigneau       kbeguigneau@gmail.com  (+ kenanbe@gmail.com en notes)
Laurene Leguay         laurene.lgy@gmail.com
Leo Fanorenantsoa      oel.nafo@gmail.com
Lia Taisnime           liataisnime2004@gmail.com
Lucas Geoffroy         (email à vérifier — paie depuis REIKI FZCO Émirats)
Milo Rouille           milorouille@orange.fr
Nzioka Mutheu          (email à vérifier dans la fiche)
Pauline Farssi         (email à vérifier dans la fiche)
Sacha Tanguy           sacha.tanguy14@gmail.com
Timilas Mehmel         timimehmel@gmail.com
```

**Garants connus** (à mapper vers le locataire) :
- Timilas Mehmel → garant père `amrouchemehmel971@gmail.com` (Amrouche Mehmel) — quittances libellées à Timilas, envoi au père.

**H2. Top contacts pro principaux** (à injecter en contexte triage) :

| Nom | Email | Rôle |
|---|---|---|
| Martin Yhuel | myhuel@pnmavocats.law | Avocat PNM (toutes entités) |
| Anna Lasseri | annalasseri@marvellavocats.com | Avocate Marvell |
| Clarisse Chevalier | c.chevalier@chevalierconseil.fr | Comptable |
| Lucie Aubry | l.aubry@chevalierconseil.fr | Comptable |
| Julien Ren | j.ren@chevalierconseil.fr | Comptable |
| Mathias Dubot | mathias.dubot@ubp.com | UBP |
| Paul Guadagnin | paul@lusignan.eu | UBP / Lusignan |
| Jerome Rubin | jerome.rubin@prmexpert.com | PRM Expert |
| Philippe Heuberger | philippe.heuberger@notaires.fr | Notaire |
| Arthur Etienne | arthur.etienne@bnpparibas.com | BNP Paribas |
| Carl Standertskjold-Nordenstam | c.standertskjold@gmail.com | Cofondateur Versi/Gradient One (rangé en `02. Amis/`) |
| Maxime Lemoine | maxime.lemoine@edhec.com | Cofondateur Versi/Gradient One (rangé en `02. Amis/`) |

À étendre via listing dynamique `07. Contacts/03. Pro/` + `02. Amis/`.

**H3.** No-match contact → **pas de fiche stub auto-créée**. Dépôt dans `05. Notes/A classifier/YYYY-MM-DD - Sujet email.md` + ping Telegram avec boutons `[Créer fiche Pro] [Créer fiche Famille] [Créer fiche Amis] [Créer fiche Autres] [Skip]`. Sur clic, Anya crée la fiche depuis le template correspondant.

---

## I. Permissions Drive

**I1.** OAuth Anya a déjà droit d'écriture sur tout le vault (vérifié — AnyaLogs/2026-05-16.jsonl confirme l'accès). Scope `drive + calendar.events`. Si 403 → vérifier que `00. Me/` est bien dans My Drive (pas Shared Drive).

**I2.** Dossiers **read-only Anya** :
- `01. Profil/` — source de vérité Thomas (red-lines, voice, work, brand)
- `Templates/` — modèles versionnés
- `09. Administratif/` — documents légaux sensibles
- `04. Journal/<années passées>/` — historique figé, pas d'auto-MAJ rétroactive
- `07. Contacts/01. Famille/` — append Historique OK, mais **création de nouvelle fiche famille uniquement sur action manuelle Thomas**

Anya peut écrire dans : `02. Projets/`, `03. Tâches/Todo.md`, `05. Notes/A classifier/`, `06. Réunions/<année courante>/`, `07. Contacts/{02,03,04,05}/`, `_Inbox/`.

---

## Question bonus — paths workflows existants

**Workflow Quittance (S12)** : lit `07. Contacts/05. Locataires/01. Actuels/<Nom>.md`. PDF sortie : `02. Projets/01. Perso/Immobilier Direct/Quittances/<Nom>/Quittance-<Nom>-YYYY-MM.pdf`. (Note : `Workflow Quittances.md` mentionne encore l'ancien chemin `08. Outils/Quittances/_generees/` pour le script Python local, à ignorer côté Anya.)

**Workflow Bail (S12)** : lit `07. Contacts/05. Locataires/_Candidats/<Nom>.md`. DOCX+PDF sortie : **à clarifier** — `Anya.md` indique `07. Contacts/05. Locataires/01. Actuels/<nom>/Bail/`, mais la structure nouvelle a `02. Projets/01. Perso/Immobilier Direct/Baux/`. **Question pour Thomas** : destination unique à choisir.

**Workflow Fin de bail (S12)** : sortie `02. Projets/01. Perso/Immobilier Direct/Fins de bail/<Nom>/`.

**Workflow Candidat (S12)** : crée `07. Contacts/05. Locataires/_Candidats/<Nom>.md`. Dépend de `DRIVE_VAULT_ROOT_ID` → `00. Me/`.

**Workflow inbox-photo-batch (S13)** : sortie `_Inbox/Photos/YYYY-MM-DD_HH-mm_photo.jpg`.

**Workflow inbox-message-router (S13)** : Calendar dans `thomas.issa@gmail.com` primary OU append `03. Tâches/Todo.md > ## Inbox` via `src/lib/secretariat/drive-todo.ts`.

**Audit trail (S14, actif)** : `_Inbox/AnyaLogs/YYYY-MM-DD.jsonl`, format `{ts, op, target, trigger, payload, status}`. Run du 16/05 21:32 = 50 emails listés, 23 pre-filter + 25 haiku-spam + 2 pendingCreated, 0 erreur, 178s. **Le pré-filtre tourne déjà** — il manque juste les handlers (`a-classifier`, `contact-pro`, `locataire`, `apporteur`) pour traiter les `pendingCreated`.

---

## Décisions ouvertes à trancher avec Thomas avant implémentation

1. **Adresse Outlook active ?** Sinon P1 = Gmail seul.
2. **Créer `02. Projets/01. Perso/Immobilier Direct/Opportunités/`** pour les apporteurs ?
3. **Garants locataires** : ajouter champ `emails_garants: [a@x]` au frontmatter (Timilas, Lucas Geoffroy…) ou rester texte libre ?
4. **Workflow Bail destination unique** : `02. Projets/.../Baux/` ou `07. Contacts/.../<nom>/Bail/` ? Une seule source de vérité.
