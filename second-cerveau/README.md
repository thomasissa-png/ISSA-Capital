# Baux & Fins de bail — outils

> Génération de baux meublés et d'attestations de fin de bail pour le parc immobilier en direct (LMNP Thomas Issa).

## Fichiers

| Fichier | Rôle |
|---|---|
| `bail-config.yml` | Bailleur étendu (état civil) + caractéristiques bail par bien + inventaires-types |
| `generer_bail.py` | Génère un nouveau bail meublé (DOCX + PDF) à partir d'une fiche locataire |
| `generer_fin_de_bail.py` | Génère une attestation post-départ pour la banque/assurance d'un ex-locataire |
| `requirements.txt` | Dépendances Python |
| `_generes/` | Sortie (par locataire) |

## Pré-requis

```bash
pip install -r requirements.txt
```

Pour la conversion DOCX→PDF : avoir **Microsoft Word installé** sur Windows (utilisé par `docx2pdf`). Si pas de Word, la conversion utilise `libreoffice --headless` en fallback (sur Mac/Linux). À défaut, le DOCX seul est produit — tu peux l'ouvrir dans Word et faire "Enregistrer sous → PDF" à la main.

## Workflow nouveau locataire (candidat → signature)

1. **Qualification du candidat** → créer une fiche dans `07. Contacts/05. Locataires/_Candidats/<Prenom Nom>.md` (template dans le `_README.md` de ce dossier)
2. **Génération du bail** → le script cherche d'abord dans `01. Actuels/`, puis dans `_Candidats/`
3. **Bail signé** → déplacer la fiche de `_Candidats/` vers `01. Actuels/`
4. **Candidat refuse ou se retire** → supprimer ou archiver la fiche

## Champs frontmatter requis dans la fiche locataire

Pour générer un bail, la fiche `07. Contacts/05. Locataires/{01. Actuels|_Candidats}/<Locataire>.md` doit contenir :

```yaml
civilite: Monsieur          # ou Madame / Mademoiselle
nom_officiel: Hella Atika Taoutaou   # nom complet officiel (avec prénoms secondaires si présents)
date_naissance: 2002-04-08
lieu_naissance: Hydra
nationalite: Française
adresse_bien: 54 rue Henri Barbusse, 92000 Nanterre
montant_loyer: 590
montant_charges: 100
depot_garantie: 1000        # optionnel (défaut config = 1000)
date_entree_bail: 2024-05-23
jour_paiement: 1            # 1, 2, 5, 10... (défaut config = 1)
```

Pour une **fin de bail**, seuls `nom_officiel` et `adresse_bien` sont strictement nécessaires (la date de fin est passée en argument CLI).

## Utilisation — bail

### Génération basique

```bash
cd "G:\Mon Drive\Obsidian\08. Outils\Baux"
python generer_bail.py --locataire "Hella Taoutaou" --date-debut 2024-05-23
```

→ Génère :
- `_generes/Hella Taoutaou/Bail-barbusse-studio-Hella-Taoutaou-2024-05-23.docx`
- `_generes/Hella Taoutaou/Bail-barbusse-studio-Hella-Taoutaou-2024-05-23.pdf` (si conversion OK)

### Overrides en argument

```bash
# Loyer différent du frontmatter (par exemple négociation finale)
python generer_bail.py -l "Milo" --date-debut 2026-04-11 --loyer 600 --charges 90

# Date de signature distincte (généralement la veille du début)
python generer_bail.py -l "Hella" --date-debut 2024-05-23 --date-signature 2024-05-22

# Délai restitution dépôt customisé
python generer_bail.py -l "Hella" --date-debut 2024-05-23 --delai-restitution "2 mois"

# Sans PDF (DOCX uniquement, si pas de Word/LibreOffice dispo)
python generer_bail.py -l "Hella" --date-debut 2024-05-23 --no-pdf

# Dry-run pour vérifier les variables sans générer
python generer_bail.py -l "Hella" --date-debut 2024-05-23 --dry-run
```

## Utilisation — attestation fin de bail

```bash
python generer_fin_de_bail.py --locataire "Léa Lebioda" --date-fin 2024-05-17
```

→ Génère une attestation comme celle envoyée à Léa LEBIODA en mai 2024. Cherche le locataire dans Actuels ET Anciens. La date d'émission par défaut = aujourd'hui.

## Audit juridique des baux générés

Les baux générés respectent la loi n° 89-462 du 6 juillet 1989 (bail meublé en résidence principale) :
- Mention obligatoire des parties (état civil complet)
- Adresse + description du logement (surface, pièces)
- Durée 1 an avec tacite reconduction
- Préavis 1 mois (locataire) / 3 mois (bailleur) avec motif obligatoire
- Loyer + charges détaillés (en lettres et en chiffres)
- **Indexation IRL** (Indice de Référence des Loyers, art. 17-1 — pas l'indice INSEE coût construction qui est pour le commercial)
- Dépôt de garantie ≤ 2 mois de loyer (1000€ standard)
- Délai restitution dépôt : **1 mois** si rien à déduire, 2 mois maximum si litige
- Clause résolutoire en cas d'impayé (1 mois de commandement, loi ELAN)
- **Clause pénale 10%** (au lieu de 20% — disproportion = risque de clause abusive)
- Obligation locataire d'assurance habitation
- Liste des annexes obligatoires : DPE, ERP, CREP (avant 1949), état électricité/gaz (+15 ans), état des lieux + inventaire, notice d'information

Corrections apportées vs. tes anciens baux :
- Hella : "Melle" → "Mademoiselle" + "désigné" → "désignée" (féminin)
- Jhon Michael : "Née" → "Né" (masculin)
- Milo : titre "CONTRAT DE LOCATION MEUBLEE" ajouté
- Milo : délai restitution 3 semaines → 1 mois (légal)
- **Tous** : indexation INSEE construction → IRL (corrige une erreur de catégorie)
- **Tous** : clause pénale 20% → 10% (validation jurisprudentielle plus solide)
- **Tous** : ajout de la liste des annexes obligatoires

## Architecture

```
Fiche locataire (.md frontmatter)        bail-config.yml
        │                                       │
        │  civilité, état civil,                │  caractéristiques bien
        │  loyer, charges, adresse              │  (m², pièces, charges incluses)
        ▼                                       ▼
       generer_bail.py  ─────►  croisement     ─────►  python-docx
                                       │                 │
                                       ▼                 ▼
                              biens.yml (Quittances)   DOCX → PDF
                              (résolution adresse)
```

## Évolutions possibles (phase 2)

- **Congé bailleur** (lettre RAR de fin de bail à l'initiative de Thomas — motif vente/reprise/sérieux)
- **Avenant** (modification loyer, changement de colocataire, etc.)
- **État des lieux d'entrée/sortie** stand-alone (séparé du bail)
- **Quittance de dépôt de garantie** restitué
