# User Flows — ISSA Capital
> @ux — 2026-04-07
> Source : project-context.md + docs/strategy/personas.md + docs/product/functional-specs.md
> Personas : Karim (CTA A — accompagnement), Leila (CTA B — opportunités), Marc (secondaire — earned media)

---

## Architecture des 2 CTAs — Décision @ux

**Recommandation : 2 pages distinctes `/accompagnement` et `/opportunites` (pas une page unique à 2 zones).**

Justification : Karim et Leila ont des intentions radicalement différentes — l'un cherche un pair pour structurer son patrimoine (parcours lent, lecture longue, conviction progressive), l'autre a un deal et lit des critères en 90 secondes (parcours court, action immédiate). Fusionner ces deux intentions sur une seule page produirait une page schizophrène qui satisferait les deux personas à moitié. La séparation permet aussi deux registres de copy distincts : "coaching pair-à-pair" (Karim) vs "critères d'investissement lisibles" (Leila). Alternative écartée : page unique avec deux ancres — risque de dilution du CTA et de parcours parasité pour chacun des deux personas.

---

## Flux 1 — Karim, 42 ans (Persona A — CTA Accompagnement)

### Point d'entrée
LinkedIn : post de Thomas Issa, profil LinkedIn, ou recommandation réseau d'entrepreneurs. Recherche Google secondaire : "holding familiale conseil structuration patrimoine entrepreneur".

### Première impression — 5 premières secondes sur Accueil
Karim voit : le hero pleine largeur avec la headline "On décide. Pas un calendrier de fonds." + la baseline "Racines libanaises. Exigences sans exception." Le ton tranche immédiatement avec les sites de CGP et banquiers privés. Il perçoit un opérateur avec un point de vue, pas un vendeur de produits. La présence de 6 participations nommées sous le fold confirme que la holding existe vraiment.

### Parcours attendu

```
LinkedIn / recommandation
        │
        ▼
[Accueil] — hero, parcours Thomas en 2 lignes, 6 participations aperçu
        │
        ├── s'il cherche la légitimité → [Mission] — histoire famille, filiation JP→Thomas, convictions
        │         │
        │         └──────────────────┐
        │                            │
        ▼                            ▼
[Participations] ← preuve terrain   [Accompagnement] — expertise, domaines, CTA contact
        │                                    │
        └────────────────────────────────────┤
                                             ▼
                                    [Contact / formulaire]
                                    email : contact@issa-capital.com
```

Durée cible : 3 à 5 minutes. Pages visitées : 2 à 4.

### Moment de vérité
La page `/accompagnement`. Si les domaines d'expertise de Thomas résonnent avec la situation de Karim (holding IS, immo direct, participations), et si le ton est pair-à-pair (pas corporate), il clique sur le CTA. Si la page est trop vague ou trop commerciale, il quitte.

### Action finale
Formulaire CTA A — prise de contact pour une mission ou un advisoring. Ou email direct contact@issa-capital.com.

### Frictions et solutions

| Étape | Friction potentielle | Solution UX |
|-------|---------------------|-------------|
| Accueil | "C'est quoi la différence avec un CGP ?" | Hero : ton Ruler/Outlaw distinctif — pas de jargon financier standard. Section philosophie : filtres concrets (pas de fonds, pas de spéculatif) |
| Mission | "C'est du brand story — pas des preuves" | Section filiation JP→Thomas avec 2J Impression, TEOS, 6000% ROI — chiffres réels, pas des formules |
| Accompagnement | "Son expertise s'applique-t-elle à ma situation ?" | 6 domaines d'intervention clairs + format mission/advisoring explicité — Karim se reconnaît dans au moins 1 domaine |
| Accompagnement | "C'est combien ?" | Pas de pricing affiché = posture premium. Le CTA "Échanger sur votre projet" remplace un devis. Karim comprend que le premier échange qualifie la mission |
| Contact | Formulaire de 10 champs = abandon | Formulaire court : nom, email, contexte (1 champ libre) — 3 champs max pour CTA A |

---

## Flux 2 — Leila, 38 ans (Persona B — CTA Opportunités)

### Point d'entrée
LinkedIn (réseau apporteurs d'affaires, post Thomas), recommandation notaire/courtier, recherche directe "holding familiale immobilier Paris partenariat co-investissement".

### Première impression — 5 premières secondes sur Accueil
Leila voit le hero et le CTA "Proposer une opportunité". Elle comprend en 5 secondes qu'elle peut soumettre un deal. Elle ne lit pas l'histoire de la famille — elle scanne la navigation pour trouver "Opportunités". Si elle ne voit pas de page dédiée en 10 secondes, elle risque de bouncer.

### Parcours attendu

```
LinkedIn / recommandation / Google
        │
        ▼
[Accueil] — scan rapide, cherche "Opportunités" dans la nav
        │
        ▼ (navigation directe ou clic CTA hero)
[Opportunités] — critères immo/participations, formulaire 7 champs
        │
        ├── si doute sur la capacité financière → [Mentions légales] capital social 1 047 562€
        │
        ▼
[Formulaire soumis] → confirmation, retour email sous X jours ouvrés
```

Durée cible : 90 secondes. Pages visitées : 1 à 2.

### Moment de vérité
La page `/opportunites`, section "Critères d'investissement". Si les critères correspondent à son deal (géographie, ticket, secteur, horizon), elle remplit le formulaire immédiatement. Si les critères sont flous ou absents, elle passe à autre chose.

### Action finale
Formulaire CTA B — soumission d'une opportunité d'investissement (7 champs qualifiants).

### Frictions et solutions

| Étape | Friction potentielle | Solution UX |
|-------|---------------------|-------------|
| Accueil | "Où est le bouton pour soumettre un deal ?" | "Opportunités" dans la nav principale visible immédiatement + CTA hero "Proposer une opportunité" above-the-fold |
| Opportunités | "Quelle est leur capacité d'investissement ?" | Capital social 1 047 562€ visible dans les mentions légales (lien discret) + critères de ticket minimum affichés dans la page |
| Opportunités | "Vont-ils répondre ?" | Délai de réponse annoncé dans la page : "Nous répondons à chaque opportunité qualifiée sous [X] jours ouvrés" |
| Formulaire | 7 champs = trop long | Champs qualifiants pertinents pour Leila (secteur, taille, géographie, contact) — elle les a déjà en tête. Pas de champ narratif superflu |
| Post-soumission | "Ma soumission a disparu dans le vide ?" | Email de confirmation automatique + message de succès dans la page. État "succès" clair et rassurant |

---

## Flux 3 — Marc, 38 ans (Persona Secondaire — Earned Media)

### Point d'entrée
Recherche Google sur "Thomas Issa ISSA Capital", mention dans un article, profil LinkedIn de Thomas, ou base de données presse/Pappers.

### Première impression — 5 premières secondes sur Accueil
Marc évalue la crédibilité en 30 secondes : site professionnel ? holding réelle ? fondateur identifiable ? La typographie Cormorant Garamond et l'absence de gadgets visuels signalent le sérieux. La baseline "Racines libanaises. Exigences sans exception." lui donne un angle éditorial.

### Parcours attendu

```
Google / LinkedIn / presse
        │
        ▼
[Accueil] — évaluation crédibilité 30s, identité, 6 participations nommées
        │
        ├────────────────────────────────┐
        ▼                                ▼
[Mission] — histoire famille,       [Participations] — écosystème
  filiation JP→Thomas,                concret, URLs sites
  convictions, identité libanaise      Gradient One, Versimo, Immocrew
        │                                ▼
        └──────────────────────────────[Contact]
                                    email direct visible
                                    contact@issa-capital.com
```

Durée cible : 5 minutes de lecture. Pages visitées : 3 à 4.

### Moment de vérité
La page `/mission`. Si la page est dense, éditoriale, et dit quelque chose de vrai sur la famille et les convictions d'ISSA Capital, Marc note le nom pour un futur article ou contacte directement Thomas.

### Action finale
Email direct à contact@issa-capital.com pour solliciter Thomas pour un entretien. Pas de formulaire — Marc n'utilisera pas un formulaire de proposition d'investissement.

### Frictions et solutions

| Étape | Friction potentielle | Solution UX |
|-------|---------------------|-------------|
| Accueil | "Pas assez de substance visible sans scroller" | Section écosystème above-the-fold ou proche du fold — 6 participations nommées avec URLs = signal de holding réelle |
| Mission | "Story brand trop lisse — pas de vrai point de vue" | Page Mission éditoriale dense : arc JP→Thomas, identité libanaise de la diaspora, vision 30 ans, filtres de décision assumés |
| Participations | "Gradient One n'a pas de site — c'est flou" | Description des activités + chiffres CA 2J Impression si pertinent, organigramme lisible à 2 niveaux |
| Contact | "Aucun nom ni email visible directement" | Email contact@issa-capital.com visible dans la page Contact ET dans le footer — pas seulement dans un formulaire |

---

## Métriques HEART — Synthèse flows

| Dimension | Signal | Métrique cible | Méthode de mesure |
|-----------|--------|---------------|-------------------|
| Happiness | Satisfaction post-soumission Leila | CSAT formulaire ≥ 8/10 | Enquête inline post-soumission (optionnelle) |
| Engagement | Profondeur de lecture Karim | Scroll depth ≥ 75% sur /accompagnement | Plausible event scroll_depth |
| Adoption | Activation formulaire Leila | Taux complétion formulaire ≥ 60% | Plausible event form_submit |
| Retention | Retour Marc après publication | Retours directs qualifiés (email presse) | Suivi manuel (tag email) |
| Task success | Karim trouve le CTA accompagnement | Taux clic CTA A ≥ 30% des visiteurs /accompagnement | Plausible event cta_click |

---

**Handoff → @design + @fullstack**
- Fichier produit : `docs/ux/user-flows.md`
- Décisions prises : 2 pages distinctes /accompagnement et /opportunites (pas une page unique) — justification documentée dans section "Architecture des 2 CTAs"
- Points d'attention : formulaire CTA A court (3 champs max) vs formulaire CTA B qualifiant (7 champs) ; email contact@issa-capital.com visible dans footer ET page Contact ; délai de réponse annoncé sur /opportunites (valeur à confirmer par Thomas)
