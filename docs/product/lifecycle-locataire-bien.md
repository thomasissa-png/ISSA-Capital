> Sources amont : src/lib/secretariat/rent/locataires.ts, src/lib/secretariat/rent/biens.ts, src/lib/secretariat/rent/types.ts, src/lib/secretariat/rent/bail-config.ts, src/lib/secretariat/workflows/candidat.ts, src/lib/secretariat/workflows/bail.ts, src/lib/secretariat/workflows/fin-de-bail.ts, src/lib/secretariat/rent/data/biens.json, src/lib/secretariat/rent/data/bail-config.json, docs/ia/anya-spec.md

# Cycle de vie locataire <> bien — note de design

## 1. Contexte & probleme

Thomas a identifie un trou dans la chaine Anya : les workflows `/bail` et `/findebail` produisent des documents (bail DOCX/PDF, attestation fin de bail PDF) et les uploade sur Drive dans `Baux/`, mais **aucune action en aval n'est declenchee** sur les fiches locataires ni sur les fiches biens.

Concretement, quand Thomas genere un bail pour un candidat qui devient locataire :
- La fiche candidat reste dans `_Candidats/` alors qu'elle devrait migrer vers `01. Actuels/`
- Le champ `statut: candidat` dans la fiche n'est pas mis a jour
- La fiche bien (loyer actuel, locataire en cours) n'est pas mise a jour
- Aucun historique n'est ecrit pour tracer le turnover

Quand Thomas genere une fin de bail :
- La fiche locataire reste dans `01. Actuels/` alors qu'elle devrait migrer vers `02. Anciens/`
- Le champ `date_fin_bail` dans la fiche n'est pas toujours renseigne
- La fiche bien ne reflete pas la vacance
- Aucun log ne capture "bien X est disponible depuis le XX/XX/XXXX"

Le resultat : Thomas doit faire ces mises a jour manuellement, a la main, dans Drive. Il oublie, les fiches divergent, et la source de verite (le vault Drive) devient progressivement incoherente.

**Cycle de vie complet attendu** :

```
Candidat → (bail signe) → Locataire actuel → (fin de bail) → Ancien locataire
                                                                     ↓
                                                              Bien : vacant
                                                                     ↓
                                                         Nouveau candidat → ...
```

## 2. Etat actuel du systeme

### 2.1 Structure Drive (arborescence locataires)

```
DRIVE_VAULT_ROOT_ID/
└── 07. Contacts/
    └── 05. Locataires/
        ├── 01. Actuels/          ← fiches .md (frontmatter YAML)
        │   ├── Kenan Beguigneau.md
        │   ├── Hella Taoutaou.md
        │   └── ...
        ├── _Candidats/           ← fiches .md (frontmatter YAML different)
        │   ├── Marie Dupont.md
        │   └── ...
        └── 02. Anciens/          ← [HYPOTHESE : ce dossier existe ou sera cree]
```

### 2.2 Format fiche locataire actuel (frontmatter)

```yaml
---
civilite: Monsieur
nom_officiel: Kenan Beguigneau
adresse_bien: 2 bis boulevard de la Seine, Studio 7, 92000 Nanterre
montant_loyer: 590
montant_charges: 100
date_entree_bail: 2024-05-23
email: kenan@example.com
---
```

Champs parsés par `locataires.ts` : `civilite`, `nom_officiel`, `adresse_bien`, `montant_loyer`, `montant_charges`, `date_entree_bail`, `date_fin_bail`, `email`, `moyen_paiement`, `date_naissance`, `lieu_naissance`, `nationalite`, `surface_m2`, `depot_garantie`, `jour_paiement`.

### 2.3 Format fiche candidat (frontmatter)

```yaml
---
prenom: "Marie"
nom: "Dupont"
email: "marie@email.com"
telephone: "0612345678"
situation_pro: "CDI chez Decathlon"
garanties: "Garant parent — revenus 4000E/mois"
bien_vise: "Studio 7, 2 bis bd de la Seine, Nanterre"
statut: candidat
date_candidature: 2026-05-10
---
```

**Ecart de schema** : la fiche candidat et la fiche locataire n'ont PAS le meme format. Le passage candidat → locataire necessite une **transformation de schema**, pas un simple deplacement de fichier.

### 2.4 Fiches biens

Les biens sont configures dans 2 fichiers JSON statiques (committes dans le repo, pas sur Drive) :
- `src/lib/secretariat/rent/data/biens.json` : adresses, matching, lignes d'adresse
- `src/lib/secretariat/rent/data/bail-config.json` : surface, pieces, charges, inventaire

**Il n'existe pas de "fiche bien" dynamique sur Drive.** Les biens sont statiques. Aucun champ "locataire_actuel", "statut_vacant", "loyer_actuel" ou "historique_locataires" n'existe dans la config actuelle.

Les 4 biens configures : `barbusse-studio`, `bd-seine-nanterre`, `myrha-paris`, `saint-michel-rue`.

### 2.5 Workflows existants

| Workflow | Declencheur | Source locataire | Output | Actions aval |
|---|---|---|---|---|
| `/candidat` | Thomas | Saisie manuelle | Fiche .md dans `_Candidats/` | **Aucune** |
| `/bail` | Thomas | Recherche dans `01. Actuels/` + `_Candidats/` | DOCX + PDF dans `Baux/{nom}/` | **Aucune** |
| `/findebail` | Thomas | Recherche dans `01. Actuels/` | PDF dans `Baux/{nom}/` | **Aucune** |
| `/quittance` | Thomas | Recherche dans `01. Actuels/` | PDFs dans `Quittances/{nom}/` | Aucune (normal) |

### 2.6 Ce qui manque (resume)

1. **Migration candidat → locataire** : deplacement + transformation de schema
2. **Migration locataire → ancien** : deplacement + ajout date_fin_bail
3. **Fiche bien dynamique** : n'existe pas — pas de suivi locataire/bien en temps reel
4. **Log d'actions** : aucune trace des transitions dans le vault
