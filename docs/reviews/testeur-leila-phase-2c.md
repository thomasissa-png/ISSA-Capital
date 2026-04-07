# Verdict @testeur-leila — Phase 2c

> **Date** : 2026-04-07
> **Calibration** : VITRINE pas conversion (Principe directeur #0)
> **Périmètre testé** : `/`, `/opportunites`, `/participations` + `ContactForm` variant opportunite

> **Note orchestrator** : le bug P0 `levant-600` mentionné par Leila a été lu dans `docs/qa/a11y-audit.md` qui était la version PRÉ-FIX. Le bug est **déjà corrigé** dans le commit `5c27064` (levant-700, ratios > 5:1, axe-core PASS sur les 7 pages). À ignorer dans les corrections résiduelles.

---

## Verdict global

**GO CONDITIONNEL**

Tous les gates BLOQUANT sont PASS. Le site tient sa promesse de vitrine premium : il inspire le respect, il est mémorable, il est lisible. ISSA Capital ne ressemble ni à un family office générique ni à une startup opportuniste. La promesse "réponse dans la journée" est différenciante et visible.

**2 corrections prioritaires effectives** (hors P0 levant-600 déjà fixé) :
1. Message de succès formulaire /opportunites sans rappel du délai (P1)
2. Ticket minimum absent pour les participations minoritaires (P1)

---

## Simulation parcours — mercredi 9h30, immeuble Montreuil 980 K€

**0-15s — Page d'accueil.** J'ouvre le site. Le hero est sombre, typographie imposante : "On décide. Pas un calendrier de fonds." L'overline dit "Holding patrimoniale — famille libanaise". En cinq secondes je comprends que c'est une holding, pas un fonds, pas une plateforme, et que la décision est rapide. Le mot "décide" est dans le titre.

**15-30s — Navigation /opportunites.** Un clic depuis le hero. Aussi accessible directement depuis la nav. Deux chemins, tous les deux en 1 clic.

**30-60s — Lecture des critères.** H1 : "Vous avez un dossier. Voyons s'il correspond." Direct. Je scanne les deux cards : Immobilier / Participations. "Île-de-France", "ticket minimum 200 000 €", "immeubles de rapport". Mon deal Montreuil 980 K€ rentre. "Réponse dans la journée" dans l'étape 2. Objection délai traitée.

**60-90s — Évaluation formulaire.** 7 champs visibles. "7 champs. Deux lignes suffisent pour démarrer." Bouton : "Soumettre ma proposition". RGPD présent. Clause L.411-1 en bas. Je remplis. Moins de 4 minutes.

**Verdict simulation** : parcours fluide, critères lisibles, deal qualifié en 30 secondes, formulaire raisonnable. Seul point manquant : le message de succès ne rappelle pas le délai.

---

## Gates GP1-GP10 recalibrées VITRINE

### Gates BLOQUANT

**GP1 — Compréhension immédiate : PASS**
En 5 secondes : "On décide. Pas un calendrier de fonds." + overline "Holding patrimoniale — famille libanaise" + bouton "Présenter une opportunité d'affaires". Je comprends immédiatement.

**GP2 — Valeur perçue : PASS**
Ni trop startup, ni opaque. Adresse Nanterre, SIREN footer, structure réelle. Ton direct sans arrogance. Holding sérieuse et accessible pour un premier contact.

**GP3 — Crédibilité : PASS (avec réserve)**
/participations : Gradient One (50%, 2020), 4 filiales nommées (Versi Immobilier, Versi Invest, Immocrew, Versimo). Deux sites live cliquables. Thomas Issa nommé étape 3. SIREN visible. Pas du discours, des entités nommées et dates précises. Réserve : l'immobilier direct volontairement vague (pas de chiffre, pas de nombre de lots) — décision stratégique compréhensible mais atténue légèrement la preuve.

**GP4 — Parcours fluide : PASS**
/opportunites en 1 clic depuis le hero ou la nav. Critères visibles dès la section 2 sans scroll excessif. Hiérarchie correcte (étudie / ticket / pas étudié). Ancre `id="formulaire"`.

**GP7 — Respect inspiré : PASS**
Après 90 secondes, ISSA paraît sérieuse, assumée, différente des family offices classiques. "Trois étapes. Pas de comité trimestriel." répond directement à ma frustration principale. Thomas Issa nommé dans le process — je sais à qui je parle. Je respecte cette holding.

**GP9 — Identité lisible : PASS**
Qui (famille Issa, racines libanaises, SAS Nanterre), quoi (immo IDF + participations minoritaires), à qui je parle (Thomas Issa). Trois piliers lisibles en moins de 2 minutes.

### Gates REQUIS

**GP5 — Critères explicites : PASS (avec réserve)**
Immobilier : zone IDF, ticket min 200 000 € en h4, types d'actifs, horizon long terme. Exclusions explicites (crypto/Web3, spéculatif court terme, first-time founders sans traction). Je sais en 30 secondes si mon dossier passe.

**Réserve mineure** : ticket minimum **absent pour les participations**. Un fondateur cherchant 80 K€ ou 10 M€ ne peut pas auto-qualifier.

**GP6 — Recommandation : PASS**
Je recommanderais ISSA Capital à un collègue apporteur d'affaires. Critères clairs, délai annoncé, Thomas nommé. Mieux que 90% des family offices qui ne répondent jamais.

**GP8 — Look & feel : PASS**
Cohérent avec une holding patrimoniale premium. Sobre, lisible, adulte. Pas de couleurs flashy, pas de badges "trust".

**GP10 — Mémorabilité : PASS**
"On décide. Pas un calendrier de fonds." reste. "Trois étapes. Pas de comité trimestriel." aussi. Filiation libanaise différenciante. Dans 3 mois, si un immeuble IDF tombe sur mon bureau, je penserai à ISSA Capital avant un family office anonyme.

---

## Évaluation spécifique /opportunites

### Critères immobilier — COMPLET
Explicites, lisibles en scan vertical. Zone IDF (précisée). Ticket 200 000 € mis en évidence (h4). Types : immeubles de rapport, biens à rénover, lots multiples. Horizon long terme. Exclusions : hors-IDF (sauf cas structurant), tickets < 200 K€, plus-value court terme. Mon deal Montreuil 980 K€ rentre en 10 secondes.

### Critères participations — PARTIELLEMENT COMPLET
Secteurs cibles listés (tech, services aux pros, immo, cohérent écosystème). Posture : actionnaire long terme. Exclusions précises et tranchantes. **Manque** : le ticket minimum ou la fourchette de taille.

### Exclusions — BIEN ASSUMÉES
"Ce que nous ne faisons jamais" : 2 filtres éthiques non négociables (environnement, humanité). "Ce que nous n'étudions pas" pour chaque catégorie. Pas de diplomatie inutile.

### Délai "réponse dans la journée"
Présent étape 2 du process. Formulation directe et non conditionnelle. Différenciante. **Mais 2 problèmes** :

1. **Le message de succès post-soumission ne rappelle pas ce délai.** Texte actuel : "Votre proposition a été transmise. Nous étudions chaque dossier soumis et prenons contact avec les opportunités qualifiées." C'est exactement le moment où Leila a besoin d'être rassurée. Le délai aurait dû être rappelé ici.
2. **Ambiguïté implicite** : "réponse dans la journée" = positive ou négative ? Un "réponse dans la journée — positive ou négative" serait encore plus crédible.

### Formulaire (7 champs)
**Points forts** : labels au-dessus des champs, placeholders concrets ("Ex. : Paris 11e, Montreuil, IDF"), tooltip "Pas besoin d'être exhaustif", champ Source facultatif, bouton verbe d'action ("Soumettre ma proposition"), honeypot anti-spam invisible.

**Points de friction** :
- Label "Email" vs "Email professionnel" prévu dans le copy de référence
- Champ Localisation non obligatoire → pour un deal immo, premier filtre de qualification
- Message de succès sans rappel délai

### Conformité juridique perçue
Clause L.411-1 CMF présente sur /opportunites + dans le footer global. Formulation conforme @legal. RGPD checkbox obligatoire dans le formulaire. **Conforme.**

---

## Page-par-page

### Page / (Accueil)

**Ce qui marche**
1. "On décide. Pas un calendrier de fonds." dans le H1 — promesse de réactivité stratégiquement juste pour Leila.
2. Section "Pour les apporteurs d'affaires" : "Critères explicites. Aucun comité d'investissement qui se réunit une fois par trimestre." Je sais que c'est pour moi.
3. Écosystème avec 4 noms de participations + lien — crédibilise sans longueur.

**Ce qui cloche**
1. Stat "50% / 2020 / 4" cryptique pour qui découvre. "50%" — de quoi ? Label "Gradient One" insuffisant sans contexte.
2. CTA final "Soumettez votre opportunité" moins tranchant que le H1 de /opportunites. Léger affaiblissement.
3. Email `contact@issa-capital.com` générique — peut sonner comme service anonyme pour qui veut savoir si Thomas lira l'email.

**Score** : 8/10

### Page /opportunites

**Ce qui marche**
1. H1 "Vous avez un dossier. Voyons s'il correspond." — ton deal-oriented exact. Pas de discours, une question directe.
2. Cards critères Immobilier/Participations en grid côte à côte sur desktop. 20 secondes pour les 2 en parallèle.
3. Thomas Issa nommé étape 3 — je sais qui je rencontrerai.

**Ce qui cloche**
1. Pas de ticket minimum participations.
2. Message de succès post-soumission sans rappel du délai.
3. Tagline "Vingt ans devant. Pas de sortie prévue." entre process et formulaire — belle mais coupe le flux vers le formulaire (scroll mobile supplémentaire).

**Score** : 8.5/10

### Page /participations

**Ce qui marche**
1. Hiérarchie claire : ISSA Capital → Gradient One → 4 filiales. Architecture en 30 secondes.
2. Rôles précis par participation + dates d'entrée + 2 liens cliquables. Substance, pas discours.
3. Section "Une thèse, pas un portefeuille opportuniste" + mention Sonia Issa (architecte d'intérieur) → cohérence narrative immobilier (héritage familial).

**Ce qui cloche**
1. Immobilier direct volontairement discret — décision stratégique mais Leila n'a pas de données concrètes sur cet actif.
2. Versi Invest et Versi Immobilier sans URL live (2/4 sites en construction).
3. Section cohérence dense en copy mais mince en faits concrets.

**Score** : 7.5/10

---

## Crédibilité de la holding — irais-je effectivement soumettre un deal ?

**Oui, sans hésitation sur un dossier immobilier IDF entre 200 K€ et 1,5 M€.**

Éléments décisifs :
1. Structure juridique réelle (SAS, SIREN, Nanterre, capital social mentions légales)
2. Participations nommées et traçables (2 sites live)
3. Thomas Issa nommé dans le process
4. Délai "dans la journée" — différent de tous les family offices approchés
5. Clause L.411-1 CMF présente

Ce qui me retient à 100% : absence de chiffre sur l'immobilier direct + absence de ticket minimum participations. Pas bloquant — je qualifie à l'oral.

---

## Vérification L.411-1 CMF

**Conforme.** La page /opportunites NE franchit PAS la ligne offre publique de titres.

Vérifications :
- "ISSA Capital investit son propre patrimoine familial" — investisseur, pas émetteur
- "Prises de participation minoritaires" — investisseur actif, pas offre de titres
- "Réponse dans la journée" — délai opérationnel, pas promesse financière
- 0 chiffre rendement/TRI/ROI
- 0 appel à "investir dans ISSA Capital"
- 0 instrument financier mentionné
- Clause de non-démarchage présente sur la page ET footer global
- CTA entrant ("Soumettre ma proposition") — tiers prennent l'initiative

**Point de surveillance futur** : si le capital social (1 047 562 €) devait apparaître sur /opportunites elle-même (pas seulement mentions légales), encadrer la formulation. Dans l'état actuel : pas de risque.

---

## Bugs / Frictions / P0 à signaler

### ~~P0 — Bug color-contrast `levant-600`~~ ✅ DÉJÀ CORRIGÉ
**Note orchestrator** : ce bug a été lu dans `docs/qa/a11y-audit.md` PRÉ-FIX. Le commit `5c27064` (@fullstack mode fix) a déjà appliqué `text-levant-600` → `text-levant-700` (#8B5E2A) sur les 9 pages + composants. Axe-core PASS sur les 7 pages. **À ignorer.**

### P1 — Message de succès formulaire /opportunites sans rappel du délai
@fullstack ou @copywriter. Le message actuel doit ajouter "Nous vous répondrons dans la journée." C'est le moment précis où Leila a besoin d'être rassurée — pas avant, pas après. Localisation : `ContactForm.tsx`, variant `opportunite`, message de succès.

### P1 — Ticket minimum absent pour les participations minoritaires
@copywriter. Page /opportunites : aucun ticket pour les participations (vs 200 000 € clairement affiché immobilier). Un fondateur ne peut pas auto-qualifier. Ajouter une fourchette indicative (ex : "500 000 € à 2 M€ typiquement") ou "Dossiers à partir de [X]€ d'apport en capital". À valider avec Thomas sur le seuil exact.

### P2 — Label "Email" au lieu de "Email professionnel"
Mineur. Aligner avec le copy de référence (`page-opportunites.md`). Localisation : `ContactForm.tsx`, label Email pour variant opportunite. @fullstack.

### P2 — Champ Localisation non obligatoire
Pour les deals immo, premier filtre IDF/hors-IDF. Envisager note conditionnelle ("Requis pour les opportunités immobilières") plutôt qu'un required global qui casserait le cas participations. @copywriter + @fullstack.

### P2 — Stat "50%" sur la home sans contexte immédiat
Sous-label "Gradient One" insuffisant. Envisager "50% de Gradient One — co-fondée en 2020" ou tooltip au survol. @copywriter.

### P3 — Deux filiales sur quatre sans URL live
Versi Immobilier + Versi Invest. Non modifiable à ce stade — limitation temporaire de la preuve d'écosystème. À noter pour suivi futur.

---

## Top 3 blocages prioritaires (post-fix levant-600)

1. **Message de succès formulaire /opportunites sans rappel délai (P1)** — friction post-soumission principale. Leila a un vendeur qui attend, doit être rassurée immédiatement. @fullstack + @copywriter.
2. **Ticket minimum participations absent (P1)** — seul trou dans les critères. Lacune sur la dimension taille. @copywriter (validation Thomas requise).
3. **Label "Email professionnel" + Localisation requise pour immo (P2 cumulé)** — qualification implicite, premier filtre. @fullstack.

---

**Handoff → @orchestrator**

- **Verdict** : GO CONDITIONNEL
- Gates BLOQUANT : 6/6 PASS
- Gates REQUIS : 4/4 PASS (GP5 PASS avec réserve participations)
- 2 P1 + 3 P2 + 1 P3 à arbitrer Phase 3
- Conformité L.411-1 CMF : **PASS**
- Identité libanaise et différenciation : PASS
- @fullstack : message succès + label Email + localisation requise immo
- @copywriter : ticket min participations + stat "50%" + label Email pro
- @legal : aucune correction requise
