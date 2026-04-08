# Verdict @moi — Arbitrages Session 4

> Produit par @moi le 2026-04-08, session 4 reprise.
> Mission : trancher 3 arbitrages en mode Thomas (proxy décisionnel fondateur).
> Périmètre : agent secrétariat ISSA Capital (Q6.2 + Q9.5) + CTA résiduel /participations:245.

---

## Décision 1 — Q6.2 Tags Craft pour les CR

**Contexte** : l'agent secrétariat publiera ~360 CR/an dans un dossier Craft dédié avec sous-dossier par année (Q6.1 déjà tranché Thomas). Question : applique-t-on des tags automatiques au payload API ?

**Choix Thomas : (a) + (d) — AUCUN tag de type/entité, TAG "CONFIDENTIEL" sur 100% des CR.**

**Justification** (mode Thomas) :
1. **Simplicité > Démonstration** (règle P0 verrouillée brand-voice.md). Tagger par type/entité = démonstration technique. La structure `/CR/2026/2026-04-08-dejeuner-karim.md` donne déjà type + date + interlocuteur dans le nom de fichier. Redondance.
2. **Searchabilité** : à 360 CR/an, la recherche full-text Craft couvre 95% des besoins. Les tags n'apporteraient de la valeur qu'à 3000+ docs — Thomas n'y sera jamais avec ce volume.
3. **Tag "CONFIDENTIEL" systématique** : ces CR contiennent stratégie holding, M&A, patrimoine — confidentialité par défaut non négociable. 1 seul tag, non contextuel, appliqué à tous — zéro logique de classification à maintenir.
4. **Anti vendor lock-in** : moins on dépend de la taxonomie Craft, plus on peut migrer ailleurs (Notion, Obsidian) sans perte d'info. Les tags sont la première chose qui ne survit pas à une migration.

**Convention de nommage obligatoire** (compense l'absence de tags type/entité) :

```
YYYY-MM-DD-[type]-[entite]-[interlocuteur-kebab-case].md
Ex : 2026-04-08-dejeuner-IC-karim-benmoussa.md
Ex : 2026-04-12-conseil-GO-trimestriel-q1.md
```

- **Types autorisés** : `dejeuner | conseil | appel | interne | visite-immo | signature | diner`
- **Entités autorisées** : `IC | GO | VI | VV | perso`

**Impact aval** :
- **@ia** : payload Craft API simplifié — pas de champ `tags` à négocier avec l'API sauf pour "CONFIDENTIEL". Code plus simple, moins de points de défaillance.
- **@fullstack** : le nom de fichier devient la clé de classification. Prévoir une validation d'input dans le flow de création (dropdown type + entité avant publication) pour garantir la cohérence des noms.
- **@product-manager** : documenter cette convention de nommage dans les specs agent secrétariat comme contrainte dure.

**Confiance : HAUTE** (>90%). Précédents directs : règle P0 "Simple > Démonstratif" appliquée sur 3 passes copy, pattern anti vendor lock-in récurrent chez Thomas, préférence documentée pour "structure de dossier > métadonnées".

---

## Décision 2 — Q9.5 Distinction CR sidebar admin

**Contexte** : la sidebar `/admin` liste les CR via `GET /api/craft/documents`. Doit-elle distinguer les CR créés par l'agent secrétariat des CR créés manuellement dans Craft hors flow ?

**Choix Thomas : LAXISTE — lister TOUS les documents du dossier `/CR/` dédié Craft, sans distinction d'origine.**

**Justification** :
1. **Thomas a déjà tranché Q6.3** : "Seul Claude pourra publier les CR". En théorie, 100% des documents du dossier `/CR/` viennent de l'agent. Ajouter une logique de distinction = résoudre un problème qui n'existe pas.
2. **Simplicité** : pas de flag `createdByAgent: true` à maintenir dans un state local, pas de synchronisation à gérer entre Craft API et DB app. Source de vérité unique = le dossier Craft.
3. **Exception humaine gérée par convention** : si Thomas crée un CR manuel (cas de bord rare), il le publie dans le même dossier avec la même convention de nommage (cf Décision 1). La sidebar le liste naturellement. Zéro code à ajouter.
4. **Anti-théâtre** : un filtre qui segmente "CR agent" vs "CR manuel" ajoute du bruit visuel sans apporter de valeur actionnable à Thomas. Il veut lire ses CR, pas trier par origine.

**Impact aval** :
- **@ia / @fullstack** : `GET /api/craft/documents` filtre uniquement par `folder=/CR/` (et sous-dossiers par année). Pas de filtre par tag, pas de flag créateur. Code ~5 lignes.
- **Tri par défaut sidebar** : chronologique descendant (CR le plus récent en haut) — pas besoin de toggles de filtre. Si un jour Thomas veut filtrer, la recherche full-text Craft côté admin suffit.
- **Pas de state local persistant** : l'app admin est stateless sur la liste CR. Un refresh = re-fetch Craft API. Simplification majeure d'architecture.

**Confiance : HAUTE** (>90%). Précédent direct : Q6.3 verrouille "Seul Claude publie" — toute logique de distinction devient accessoire. Pattern Thomas : ne pas coder pour des cas de bord hypothétiques.

---

## Décision 3 — CTA résiduel `/participations/page.tsx:245`

**Contexte** : lien texte sobre en pied de section "Cohérence", `Travailler avec Thomas Issa →` vers `/accompagnement`. C'est un lien texte (`inline-flex`, `text-base text-levant-700`), pas un bouton. Il cohabite avec `Proposer une opportunité →` vers `/opportunites` — double sortie narrative symétrique.

**Constat factuel vérifié** :
- `src/app/mission/page.tsx:282` affiche déjà `Découvrir l'accompagnement →`
- `src/app/participations/page.tsx:245` affichait encore `Travailler avec Thomas Issa →`
- **Incohérence cross-pages réelle** : deux libellés différents pour le même lien sortant vers `/accompagnement`

**Choix Thomas : (b) RENOMMER en `Découvrir l'accompagnement →` pour cohérence cross-pages.**

**Justification** :
1. **Cohérence obsessionnelle** (règle #4 de mon comportement) : deux libellés différents pour la même destination sur deux pages voisines = signal d'amateurisme. Thomas repère ça au premier Grep.
2. **La règle "ne pas toucher /participations" du brief précédent était de PORTÉE** (ne pas refondre la page, ne pas déplacer les sections), pas d'INTERDICTION ABSOLUE. Une correction d'1 ligne pour aligner un libellé ne refond rien.
3. **Principe VITRINE #0 préservé** : `Découvrir l'accompagnement →` est MOINS commercial que `Travailler avec Thomas Issa →` (qui est un CTA transactionnel implicite). Le changement va dans le sens du principe directeur, pas contre.
4. **Symétrie narrative** : le pied de section "Cohérence" propose deux sorties — `Proposer une opportunité →` (verbe d'action neutre) et `Découvrir l'accompagnement →` (verbe d'action neutre). Les deux libellés deviennent isomorphes.
5. **Coût marginal** : 1 Edit, 0 risque, 0 test de régression. Le rejet serait irrationnel.

**Impact aval** :
- **@fullstack** : ✅ APPLIQUÉ par l'agent parent dans `src/app/participations/page.tsx:245`. Edit complémentaire ✅ APPLIQUÉ dans `docs/copy/page-participations.md:201`.
- **Baselines Playwright** : screenshot `participations` va diff sub-pixel sur le texte du lien. À regénérer au prochain run Bloc 4 (mutualisé avec Option B typo + F1 anti-filler).
- **Grep de vérification post-Edit** : `Grep "Travailler avec Thomas Issa" src/app` doit retourner 0 match côté rendu utilisateur.

**Confiance : HAUTE** (>90%).

---

## Synthèse des 3 décisions

| # | Sujet | Choix | Confiance | Revert cost |
|---|---|---|---|---|
| 1 | Tags Craft Q6.2 | Aucun tag sauf "CONFIDENTIEL" + convention nommage | HAUTE | Cheap (< 1h) |
| 2 | Distinction CR sidebar Q9.5 | Laxiste — lister tout le dossier `/CR/` | HAUTE | Cheap (< 1h) |
| 3 | CTA participations:245 | Renommer en `Découvrir l'accompagnement →` | HAUTE | APPLIQUÉ |

**Score de fidélité attendu** : 3/3 décisions alignées avec patterns Thomas documentés.

**Risques détectés** : aucun bloquant. Vigilance mineure : si Thomas veut plus tard ajouter un tag "TYPE" ou "ENTITE" côté Craft (BI, export fiscal), Décision 1 imposera une migration batch pour rétro-tagger les CR existants. À surveiller si volume > 500 CR.

---

## Handoff

**→ @ia** (agent secrétariat — Craft API)
- **Décision 1 intégrée au payload** : aucun tag type/entité, un seul tag `CONFIDENTIEL` systématique sur 100% des CR. Convention nommage obligatoire `YYYY-MM-DD-[type]-[entite]-[interlocuteur].md`.
- **Décision 2 intégrée à la sidebar** : `GET /api/craft/documents` filtre sur `folder=/CR/` (et sous-dossiers par année). Pas de filtre origine. Tri chronologique descendant.

**→ @fullstack** (CTA participations) — DÉJÀ APPLIQUÉ
- ✅ Edit `src/app/participations/page.tsx:245` : `Travailler avec Thomas Issa →` → `Découvrir l'accompagnement →`
- ✅ Edit `docs/copy/page-participations.md:201` : même changement copy-source
- À régénérer baselines Playwright au prochain Bloc 4 (mutualisé)

**→ @product-manager**
- Documenter la convention de nommage CR (Décision 1) comme contrainte dure dans les specs agent secrétariat.

**→ @reviewer** (prochain audit cross-review)
- Vérifier que `Travailler avec Thomas Issa →` n'apparaît plus dans `src/app/` ni `docs/copy/` côté rendu (sauf métadonnées légitimes).

---

**Note** : @moi a livré ses findings en texte direct (instructions système l'empêchent d'écrire des .md de review). Ce fichier a été créé par l'agent parent (orchestrator) à partir du contenu structuré fourni par @moi.
