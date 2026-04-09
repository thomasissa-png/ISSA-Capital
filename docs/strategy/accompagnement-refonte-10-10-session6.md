> Sources amont : src/app/accompagnement/page.tsx, src/app/mission/page.tsx, docs/copy/page-accompagnement.md, docs/copy/landing-page-copy.md, docs/strategy/accompagnement-restructure.md, docs/strategy/brand-platform.md, docs/strategy/personas.md

# Accompagnement — Refonte 10/10 Session 6 (mode itération — lead Jean-Pierre + Thomas)

> @creative-strategy — 2026-04-08
> Mission : élargir le narratif de /accompagnement de Thomas seul à Jean-Pierre + Thomas (duo)
> Feedback Thomas verbatim : "Je veux qu'il s'agisse plus de Thomas uniquement, mais de Jean-Pierre et Thomas. Tous les deux on accompagne."

---

## 1. Diagnostic de la v1

### Ce que la v1 dit de l'accompagnement

La page actuelle (`src/app/accompagnement/page.tsx`) est entièrement centrée sur Thomas :
- H1 : "Thomas Issa accompagne fondateurs et dirigeants sur ce qu'il a lui-même construit."
- Section "Le parcours" : uniquement le CV Thomas (Sony, TEOS, agence)
- Section "Les sujets sur lesquels **Thomas** intervient"
- Section "Ce que **Thomas** fait"
- Section "Ce que **Thomas** n'accepte pas"
- Formulaire : "Quelques informations pour comprendre votre situation. Thomas lit chaque message."

Jean-Pierre apparaît uniquement en **mention de passage** dans le copy de `docs/copy/page-accompagnement.md` (Section 3, dernier paragraphe) :
> "Thomas n'est pas conseiller par option de carrière — il est conseiller parce qu'il a grandi en voyant son père racheter, développer et internationaliser une société en co-actionnariat."

Il n'apparaît **pas du tout** dans le code déployé (`page.tsx`). Il est invisible dans la page actuelle.

### Ce qui manque pour incarner le duo

1. **Absence totale de Jean-Pierre comme accompagnateur** : Jean-Pierre n'est pas mentionné dans la page. Il est un fantôme.
2. **Narratif de la lignée non activé** : /accompagnement devrait être la page où la complémentarité père/fils est la plus tangible — c'est exactement le sujet. Ce n'est pas le cas actuellement.
3. **Pas de distinction des registres d'expertise** : Jean-Pierre = 3 décennies de construction industrielle/commerciale (IBM, Lexmark, 2J Impression). Thomas = expertise corporate tech internationale + structuration patrimoniale depuis 2020. Les deux registres sont différents, complémentaires, et n'ont pas été mis en regard.
4. **Karim ne sait pas avec qui il va travailler concrètement** : si Jean-Pierre accompagne aussi, cette information est critique pour Karim. Si Jean-Pierre est une figure tutélaire dont la méthode irrigue Thomas, c'est différent — mais ça doit être dit.

### Point à arbitrer (formulé à Thomas — voir section 7)

La page doit répondre à une question que Karim se posera inévitablement : "Est-ce que je travaille avec Thomas ? Avec Jean-Pierre ? Avec les deux ensemble ?" Ce choix est déterminant pour toute la structure narrative.

---

## 2. Thèse stratégique

Ce que /accompagnement doit raconter à Karim :

Chez ISSA Capital, l'accompagnement n'est pas la prestation d'un consultant individuel. C'est la mise à disposition d'une méthode construite sur trois décennies, portée par deux générations qui l'ont appliquée pour leur propre compte. Jean-Pierre Issa a bâti de l'implication dans la durée — IBM, Lexmark, le rachat de 2J Impression en 2016. Thomas Issa a traduit cette méthode dans les contextes d'aujourd'hui — structuration de holding, participations, advisory corporate et tech. Ce que Karim vient chercher ici, ce n'est pas un expert en chambre : c'est l'accès à une lignée qui a construit ce qu'elle décrit, et qui peut l'accompagner parce qu'elle a fait le chemin avant lui.

La différence structurelle avec n'importe quel cabinet d'advisors : les Issa n'accompagnent pas pour vendre un service. Ils accompagnent parce que leur propre patrimoine, leurs propres structures et leurs propres décisions suivent les mêmes logiques que celles qu'ils transmettent. Ce n'est pas une promesse — c'est une posture.

---

## 3. Variante A — Duo opérationnel

### Hypothèse de structure

Jean-Pierre et Thomas accompagnent ensemble chaque mission. Jean-Pierre apporte la lecture de la durée (construction opérationnelle industrielle, rachat, développement international sur 30 ans). Thomas apporte la lecture du moment présent (structuration patrimoniale, tech, advisory corporate). Karim a accès aux deux.

### Architecture

1. **Hero** — "L'accompagnement à deux voix"
2. **Pour qui** — filtre de qualification Karim (conservé de la v1, adapté au duo)
3. **Jean-Pierre Issa** — parcours et domaine d'accompagnement
4. **Thomas Issa** — parcours et domaine d'accompagnement
5. **Ce que la lignée apporte** — ce que le duo produit ensemble que ni l'un ni l'autre ne produirait seul
6. **Ce qui ne correspond pas** — anti-personas (conservé, légèrement adapté)
7. **Deux formats** — conservé
8. **Signature + formulaire** — conservé

### Verbatim complet — Variante A

---

**[HERO]**
Overline : Un accompagnement à deux voix
H1 : Jean-Pierre Issa et Thomas Issa accompagnent fondateurs et dirigeants sur ce qu'ils ont eux-mêmes construit.

---

**[POUR QUI]**
Overline : Pour qui
H2 : Un fondateur ou dirigeant qui a déjà fait ses preuves.

Qui gère une ou plusieurs structures, a déjà pris des décisions de capital, et n'attend pas qu'on lui apprenne son métier. Qui cherche des pairs pour structurer ce qui vient ensuite — patrimoine, holding, immobilier en direct, participations — pas des prestataires qui lui vendront une prestation.

Si vous vous reconnaissez, la suite de cette page est pour vous. Sinon, elle ne le sera pas — et c'est très bien.

---

**[JEAN-PIERRE ISSA]**
Overline : Jean-Pierre Issa
H2 : Trente ans de construction opérationnelle.

Jean-Pierre Issa est né à Dakar en 1958, dans une famille d'origine libanaise. Après IBM dans les années 1980, il fait partie de l'équipe fondatrice qui lance Lexmark en Europe lors de sa scission d'IBM : Directeur de filiales dans plusieurs pays, Directeur Marketing EMEA. Deux décennies à construire des organisations depuis le terrain, continent après continent.

En 2016, avec deux associés, il rachète 2J Impression à Mérignac — une structure de distribution multimarque de matériel d'impression numérique industrielle. L'entreprise atteint 4 millions d'euros de chiffre d'affaires et opère dans 17 pays. Co-Managing Director, Jean-Pierre Issa y applique la logique apprise chez IBM : construire avec méthode, tenir dans la durée, décider avec rigueur.

Ce qu'il apporte dans une mission d'accompagnement : la lecture longue. Rachat d'une structure, développement opérationnel dans la durée, internationalisation réelle, co-actionnariat. Pour les fondateurs qui veulent construire quelque chose qui tient sur dix ou vingt ans.

Domaines : rachat et développement d'entreprise, structuration co-actionnariat, internationalisation opérationnelle, gouvernance long terme.

---

**[THOMAS ISSA]**
Overline : Thomas Issa
H2 : De la création d'entreprise à la structuration patrimoniale.

Thomas Issa a passé 15 ans chez Sony Europe, où il a co-fondé TEOS — une solution de gestion d'espaces de travail construite à partir d'un deck de dix slides — et l'a déployée dans 7 régions du monde en moins d'un an, avec un ROI de 6 000 % la première année.

Depuis 2018, il accompagne des fondateurs en tant qu'advisor stratégique. Il a travaillé avec TikTok, Adidas, Lego. Il a fondé une agence de communication internationale qui a réuni plus de 35 experts, avec des missions dans les grandes verticales mondiales.

Depuis 2020, il co-fonde et développe l'écosystème ISSA Capital : holding patrimoniale, participations dans l'immobilier tech et les services aux professionnels, patrimoine résidentiel en gestion directe en Île-de-France.

Ce qu'il apporte dans une mission d'accompagnement : la lecture du moment présent. Structuration de holding, advisory corporate et tech, stratégie internationale, positionnement de marque. Pour les fondateurs qui veulent construire une architecture patrimoniale cohérente dans les contextes d'aujourd'hui.

Domaines : structuration de holding et écosystème patrimonial, investissement immobilier en direct, advisory corporate et stratégie internationale, product management, positionnement de marque.

Formation : HEC School of Management, University of California Irvine, IMT Atlantique, prépa Sainte-Geneviève. Major de promotion × 3. Quadrilingue.

---

**[CE QUE LA LIGNÉE APPORTE]**
Overline : Ce que le duo produit
H2 : Une méthode construite sur deux générations.

Jean-Pierre a appris à construire dans la durée — des structures qui tiennent, pas des décisions qui séduisent. Thomas a appris à lire les marchés d'aujourd'hui avec les lunettes de quelqu'un qui a grandi dans cette école. Les deux accompagnent depuis ce qu'ils ont eux-mêmes construit — pas depuis un cabinet d'analyse.

Ce que cela change pour vous : vous n'avez pas en face de vous un expert qui vous explique comment faire. Vous avez deux personnes qui ont fait des erreurs coûteuses, pris des décisions difficiles, et construit ce qu'elles décrivent.

---

**[CE QUI NE CORRESPOND PAS]**
Overline : Ce qui ne correspond pas
H2 : Ce qui est hors périmètre.

Jean-Pierre et Thomas accompagnent des fondateurs et des investisseurs qui ont déjà fait leurs preuves. Ils n'accompagnent pas les premières étapes d'un projet.

— Projets crypto / Web3 purs — hors scope.
— First-time founders en pre-seed.
— Démarches non sollicitées ou pitchs génériques sans lien avec le périmètre décrit ici.
— Missions de moins d'un mois — trop court pour apporter une valeur réelle.
— Tickets immobiliers inférieurs à 200 000 € dans le cadre d'un co-investissement.
— Projets contraires aux filtres éthiques d'ISSA Capital — environnement, humanité.
— Véhicules spéculatifs court-terme.

---

**[DEUX FORMATS]**
Overline : Deux formats
H2 : Deux formats.

Mission ponctuelle
Une intervention délimitée avec un objectif clair : structuration patrimoniale, positionnement, stratégie internationale, go-to-market, audit stratégique. Durée minimum : un mois. Livrables définis en amont.

Advisoring
Un rôle d'advisor récurrent auprès du fondateur ou du dirigeant — stratégie, développement, organisation. Sparring partner de fond, présence informelle au board possible.

---

**[SIGNATURE]**
Patient par choix. Exigeant par principe.

---

**[FORMULAIRE]**
Overline : Prenons contact
H2 : Si le périmètre correspond, prenons contact.
Corps : Chaque mission démarre par un échange — pas par un devis.

### Auto-évaluation 10 dimensions — Variante A v1

1. **Réponse au feedback Thomas** : Jean-Pierre ET Thomas apparaissent comme accompagnateurs ? → **9/10.** Les deux sont présents avec des sections dédiées et des domaines distincts. Légère incertitude : "accompagnent ensemble" n'est pas encore explicitement confirmé par Thomas (point d'arbitrage ouvert).

2. **Crédibilité** : Karim y croit-il ? → **8/10.** Les faits biographiques sont réels (IBM, Lexmark, 2J 2016, Sony, TEOS, TikTok). Mais la crédibilité du duo comme entité d'accompagnement (vs Thomas seul) est nouvelle — Karim pourrait se demander si Jean-Pierre intervient vraiment ou si c'est une caution symbolique. À renforcer.

3. **Différenciation** : la lignée rend-elle ISSA Capital incomparable ? → **9/10.** Un cabinet d'advisors standard n'a pas ce narratif père/fils + 3 décennies + construction pour soi. Différenciation réelle.

4. **Voix de marque** : gravité sobre, zéro slogan, phrases courtes ? → **8/10.** La section "Ce que la lignée apporte" a deux phrases un peu longues. À resserrer.

5. **Persona Karim** : adresse ses frustrations et objections ? → **7/10.** La section "Pour qui" est conservée et adresse l'objection "pair vs prestataire". Mais l'objection "combien ça coûte ?" et "est-ce que son expérience s'applique à moi ?" ne sont pas adressées explicitement avec le duo — à renforcer dans la section "Ce que la lignée apporte".

6. **Simplicité > Démonstration** (P0) → **8/10.** Pas d'anaphore, pas de manifeste, pas d'effet de manche. Quelques formulations dans "Ce que la lignée apporte" flirtent avec la posture défensive.

7. **Cohérence avec /mission** → **9/10.** Jean-Pierre est présenté de manière cohérente avec /mission (même chronologie, même 2J 2016, même IBM/Lexmark). Thomas est cohérent. La page /accompagnement va plus loin dans les domaines d'expertise — c'est son rôle.

8. **VITRINE non-conversion** → **10/10.** Zéro CTA agressif. Formulaire sobre en fin de page. Aucun prix affiché.

9. **Pas de justification explicite** → **8/10.** "Ce que cela change pour vous" en section "Ce que la lignée apporte" est limite — reformuler.

10. **Faits biographiques corrects** → **10/10.** 2J = 2016 (rachat), Afrique du Sud dans la jeunesse de Thomas (Section Thomas : non mentionné ici — normal, la page /mission le couvre).

**Score v1 : 86/100 → 8.6/10**

### Itération v1 → v2 : corrections ciblées

Corrections identifiées :
- Dimension 2 (crédibilité duo) : ajouter dans "Ce que la lignée apporte" une phrase qui ancre que Jean-Pierre intervient réellement, pas symboliquement.
- Dimension 4 (voix de marque) : resserrer les phrases longues.
- Dimension 5 (objections Karim) : ajouter une ligne sur "ils ont fait le chemin avant vous, dans leurs propres structures".
- Dimension 9 (justification explicite) : reformuler "Ce que cela change pour vous".

**Section "Ce que la lignée apporte" — v2 :**

Overline : Ce que le duo produit
H2 : Une méthode héritée. Deux lectures du même sujet.

Jean-Pierre a bâti des structures qui tiennent sur vingt ans — dans l'industrie, dans le co-actionnariat, dans l'internationalisation réelle. Thomas a traduit cette méthode dans les contextes d'aujourd'hui — holding patrimoniale, advisory tech, marchés européens. Les deux ont fait leurs erreurs pour leur propre compte, pas pour celui d'un client.

Leurs structures actuelles — 2J Impression, l'écosystème ISSA Capital — suivent les mêmes logiques qu'ils transmettent. Ce n'est pas du conseil de cabinet. C'est la lecture de deux personnes qui ont la peau dans le jeu.

**Score v2 estimé : 92/100 → 9.2/10**

### Itération v2 → v3 : viser 10/10

Dimension restante à améliorer : Dimension 5 (objection Karim "est-ce que votre expérience s'applique à moi"). La section "Ce qui ne correspond pas" répond à qui ils N'acceptent pas — mais pas à ce que le duo apporte concrètement à Karim dans sa situation spécifique (structuration patrimoniale, 800K€ à investir, 1-3 structures).

Ajout d'une phrase ciblée dans la section Jean-Pierre ou dans "Ce que la lignée apporte" :

> "Si vous structurez une holding, cherchez à co-investir dans l'immobilier, ou cherchez un regard extérieur sur la constitution d'un écosystème de participations — c'est exactement le périmètre."

**Score v3 estimé : 95/100 → 9.5/10**

**Plafond Variante A** : le point non résolu est l'ambiguïté sur le mode d'intervention de Jean-Pierre (opérationnel vs tutélaire). Sans réponse de Thomas, impossible d'affirmer avec précision "Jean-Pierre intervient dans vos missions". La variante A atteint 9.5/10 avec l'hypothèse "duo opérationnel" — mais la crédibilité complète dépend de la confirmation de Thomas.

### Score final Variante A : **9.5/10** (sous réserve confirmation Thomas)

---

## 4. Variante B — Figure tutélaire

### Hypothèse de structure

Thomas opère seul les missions d'accompagnement. Jean-Pierre n'intervient pas directement auprès des clients — mais son expérience, sa méthode, sa lecture de la durée ont formé Thomas et irriguent sa façon de travailler. Jean-Pierre est la figure patriarche dont l'héritage donne du poids à l'accompagnement Thomas.

Karim travaille avec Thomas. Il sait que Thomas a grandi dans une école familiale de 30 ans.

### Architecture

1. **Hero** — "Une méthode héritée"
2. **Pour qui** — filtre de qualification Karim (conservé)
3. **La méthode héritée** — Jean-Pierre comme fondateur de l'école dans laquelle Thomas a appris
4. **Thomas Issa** — parcours complet, continuateur de la méthode dans les contextes d'aujourd'hui
5. **Ce qui ne correspond pas** — anti-personas (conservé)
6. **Deux formats** — conservé
7. **Signature + formulaire** — conservé

### Verbatim complet — Variante B

---

**[HERO]**
Overline : Conseil & accompagnement
H1 : Thomas Issa accompagne fondateurs et dirigeants. Une méthode construite sur trente ans de filiation.

---

**[POUR QUI]**
Overline : Pour qui
H2 : Un fondateur ou dirigeant qui a déjà fait ses preuves.

Qui gère une ou plusieurs structures, a déjà pris des décisions de capital, et n'attend pas qu'on lui apprenne son métier. Qui cherche un pair pour structurer ce qui vient ensuite — patrimoine, holding, immobilier en direct, participations — pas un prestataire qui lui vendra une prestation.

Si vous vous reconnaissez, la suite de cette page est pour vous. Sinon, elle ne le sera pas — et c'est très bien.

---

**[LA MÉTHODE HÉRITÉE]**
Overline : L'héritage
H2 : Ce que Jean-Pierre Issa a construit.

Jean-Pierre Issa est né à Dakar en 1958, dans une famille d'origine libanaise. IBM dans les années 1980. Puis l'équipe fondatrice de Lexmark en Europe — Directeur de filiales, Directeur Marketing EMEA. Deux décennies à construire des organisations réelles dans des contextes difficiles.

En 2016, avec deux associés, il rachète 2J Impression à Mérignac — distribution multimarque de matériel d'impression numérique industrielle, aujourd'hui présente dans 17 pays, 4 millions d'euros de chiffre d'affaires. Co-Managing Director, il y applique la logique de toute sa carrière : construire avec méthode, tenir dans la durée, ne jamais sortir précipitamment.

Thomas a grandi dans cette école. Pas dans les livres — dans les décisions réelles de son père. Ce que Jean-Pierre appelle construire, Thomas l'a observé puis appliqué. L'accompagnement Thomas Issa ne part pas d'une théorie : il part de cette filiation.

---

**[THOMAS ISSA]**
Overline : Thomas Issa
H2 : La même logique. Les contextes d'aujourd'hui.

Thomas Issa a passé 15 ans chez Sony Europe, où il a co-fondé TEOS — une solution de gestion d'espaces de travail construite à partir d'un deck de dix slides — et l'a déployée dans 7 régions du monde en moins d'un an, avec un ROI de 6 000 % la première année. Les clients : Lego, Siemens, Netflix, Cap Gemini, Suzuki, Hilton, Mango.

Depuis 2018, il accompagne des fondateurs en tant qu'advisor stratégique — jusqu'à cinq projets par an. Il a travaillé avec TikTok, Adidas, Lego. Il a fondé une agence de communication internationale qui a réuni plus de 35 experts, avec des missions dans les grandes verticales mondiales.

Depuis 2020, il co-fonde et développe l'écosystème ISSA Capital : holding patrimoniale, participations dans l'immobilier tech et les services aux professionnels, patrimoine résidentiel en gestion directe en Île-de-France.

Il accompagne sur ce qu'il a lui-même construit. La structuration patrimoniale, la holding, l'investissement en direct, le co-actionnariat dans des structures opérationnelles : ce ne sont pas des sujets théoriques pour Thomas — ce sont ses propres décisions de la dernière décennie.

Domaines : structuration de holding et écosystème patrimonial, investissement immobilier en direct, advisory corporate et stratégie internationale, product management, positionnement de marque.

Formation : HEC School of Management, University of California Irvine, IMT Atlantique, prépa Sainte-Geneviève. Major de promotion × 3. Quadrilingue.

---

**[CE QUI NE CORRESPOND PAS]**
Overline : Ce qui ne correspond pas
H2 : Ce qui est hors périmètre.

Thomas accompagne des fondateurs et des investisseurs qui ont déjà fait leurs preuves. Il n'est pas un incubateur et n'accompagne pas les premières étapes d'un projet.

— Projets crypto / Web3 purs — hors scope.
— First-time founders en pre-seed.
— Démarches non sollicitées ou pitchs génériques sans lien avec le périmètre décrit ici.
— Missions de moins d'un mois — trop court pour apporter une valeur réelle.
— Tickets immobiliers inférieurs à 200 000 € dans le cadre d'un co-investissement.
— Projets contraires aux filtres éthiques d'ISSA Capital — environnement, humanité.
— Véhicules spéculatifs court-terme.

---

**[DEUX FORMATS]**
Overline : Deux formats
H2 : Deux formats.

Mission ponctuelle
Une intervention délimitée avec un objectif clair : structuration patrimoniale, positionnement, stratégie internationale, go-to-market, audit stratégique. Durée minimum : un mois. Livrables définis en amont.

Advisoring
Un rôle d'advisor récurrent auprès du fondateur ou du dirigeant — stratégie, développement, organisation. Sparring partner de fond, présence informelle au board possible.

---

**[SIGNATURE]**
Patient par choix. Exigeant par principe.

---

**[FORMULAIRE]**
Overline : Prenons contact
H2 : Si le périmètre correspond, prenons contact.
Corps : Chaque mission démarre par un échange — pas par un devis. Thomas lit chaque message.

### Auto-évaluation 10 dimensions — Variante B v1

1. **Réponse au feedback Thomas** : Jean-Pierre ET Thomas apparaissent comme accompagnateurs ? → **6/10.** Thomas dit "tous les deux on accompagne" — la Variante B fait apparaître Jean-Pierre comme formateur de Thomas, pas comme accompagnateur actif. Réponse partielle au feedback.

2. **Crédibilité** : Karim y croit-il ? → **9/10.** Le narratif "méthode héritée" est crédible et sobre. Thomas opère — pas d'ambiguïté sur qui Karim va appeler. Mais on pourrait arguer que mentionner Jean-Pierre sans qu'il accompagne est une forme de caution indirecte qui dilue la promesse.

3. **Différenciation** : la lignée rend-elle ISSA Capital incomparable ? → **7/10.** La filiation est évoquée mais n'est pas l'argument central — Thomas reste l'argument principal. La différenciation est moins forte que la Variante A.

4. **Voix de marque** : gravité sobre, zéro slogan, phrases courtes ? → **9/10.** La Variante B est plus épurée, plus sobre. Le narratif "méthode héritée" est factuellement ancré sans effet de manche.

5. **Persona Karim** : adresse ses frustrations et objections ? → **8/10.** L'objection principale de Karim ("quelqu'un qui l'a fait") est bien traitée. Le duo père/fils est moins visible, donc l'angle différenciant est moins fort.

6. **Simplicité > Démonstration** (P0) → **9/10.** Pas d'anaphore. Formulations directes. La section "La méthode héritée" est sobre sans être sèche.

7. **Cohérence avec /mission** → **9/10.** Jean-Pierre est présenté de manière cohérente avec /mission. Pas de contradiction.

8. **VITRINE non-conversion** → **10/10.** Zéro CTA agressif.

9. **Pas de justification explicite** → **9/10.** Aucune phrase méta détectée.

10. **Faits biographiques corrects** → **10/10.** 2J = 2016 (rachat). Afrique du Sud non mentionné ici (couvert par /mission — logique).

**Score v1 Variante B : 86/100 → 8.6/10**

### Itération v1 → v2 : corrections ciblées

Le problème structurel de la Variante B est la dimension 1 (réponse au feedback Thomas). Thomas a dit "tous les deux on accompagne" — la Variante B n'y répond qu'à moitié. Deux options :

Option 1 : rester sur la Variante B mais reformuler le hero pour que Jean-Pierre apparaisse comme co-présence (pas co-opérateur), et ajouter une ligne dans "La méthode héritée" qui dit explicitement : "Jean-Pierre n'intervient pas dans vos missions — mais sa méthode est là, dans chaque recommandation que Thomas formule."

Option 2 : accepter que la Variante B ne peut pas répondre pleinement au feedback "tous les deux on accompagne" — et en faire une variante honnêtement partielle, à proposer si Thomas confirme que Jean-Pierre n'intervient pas opérationnellement.

**Correction v2 appliquée (Option 1) — section "La méthode héritée" reformulée :**

Ajout en fin de section :
> "Jean-Pierre ne prend pas de missions clients à la journée — ce n'est pas son rôle. Mais quand Thomas formule une recommandation sur la structuration d'une co-actionnariat ou la logique d'un rachat, c'est trente ans d'expérience de Jean-Pierre qui informent le raisonnement. Ce n'est pas un argument de vente — c'est la réalité de comment Thomas a appris à penser ces sujets."

**Score v2 Variante B estimé : 88/100 → 8.8/10**

**Plafond Variante B** : la dimension 1 (réponse au feedback Thomas) ne peut pas dépasser 7/10 dans ce cadre. Thomas a dit "tous les deux on accompagne" — la Variante B ne répond pas à cette formulation. Le score plafonne à 8.8/10.

### Score final Variante B : **8.8/10**

---

## 5. Variante C — Proposition libre : La maison et l'héritier

### Hypothèse de structure

Ni duo opérationnel symétrique, ni tutelle silencieuse. La structure narrative est : ISSA Capital est une maison familiale. Jean-Pierre en est le fondateur de la méthode (présent institutionnellement, disponible si la complexité le justifie). Thomas en est l'opérateur quotidien et l'interlocuteur principal. Cette variante est honnête sur le fait que c'est Thomas qui mène les missions — mais que la maison dans laquelle il travaille n'est pas la sienne seule.

Ce cadrage est le plus proche de la réalité présumée d'une holding familiale fonctionnant avec un père actif (2J Impression — Co-Managing Director) et un fils fondateur (ISSA Capital). Il évite de promettre une intervention de Jean-Pierre qui ne serait peut-être pas systématique, tout en répondant au feedback "tous les deux on accompagne" : Jean-Pierre accompagne au sens de "la maison accompagne", pas au sens "Jean-Pierre vient en réunion".

### Architecture

1. **Hero** — "La maison Issa accompagne"
2. **Pour qui** — filtre de qualification Karim
3. **Jean-Pierre Issa — la fondation** — son parcours, ce qu'il a bâti, ce qu'il représente pour la maison
4. **Thomas Issa — l'opérateur** — son parcours, ce qu'il conduit au quotidien
5. **Ce que la maison apporte** — pas "le duo" mais "ce que cette structure familiale rend possible"
6. **Ce qui ne correspond pas** — anti-personas
7. **Deux formats**
8. **Signature + formulaire**

### Verbatim complet — Variante C

---

**[HERO]**
Overline : Conseil & accompagnement
H1 : Chez ISSA Capital, l'accompagnement est familial. Jean-Pierre Issa a bâti. Thomas Issa opère. Les deux sont là.

---

**[POUR QUI]**
Overline : Pour qui
H2 : Un fondateur ou dirigeant qui a déjà fait ses preuves.

Qui gère une ou plusieurs structures, a déjà pris des décisions de capital, et n'attend pas qu'on lui apprenne son métier. Qui cherche un pair pour structurer ce qui vient ensuite — patrimoine, holding, immobilier en direct, participations — pas un prestataire qui lui vendra une prestation.

Si vous vous reconnaissez, la suite de cette page est pour vous. Sinon, elle ne le sera pas — et c'est très bien.

---

**[JEAN-PIERRE ISSA — LA FONDATION]**
Overline : Jean-Pierre Issa
H2 : La fondation.

Né à Dakar en 1958, dans une famille d'origine libanaise. IBM dans les années 1980. Équipe fondatrice de Lexmark Europe — Directeur de filiales, Directeur Marketing EMEA. En 2016, avec deux associés, rachat de 2J Impression à Mérignac : 17 pays, 4 millions d'euros de chiffre d'affaires. Co-Managing Director aujourd'hui.

Trente ans de construction réelle — dans l'industrie, dans l'international, dans le co-actionnariat. Pas de sortie précipitée. Pas de raccourci. C'est ce modèle que Jean-Pierre a transmis à Thomas, et c'est ce modèle qui structure la façon dont ISSA Capital accompagne.

---

**[THOMAS ISSA — L'OPÉRATEUR]**
Overline : Thomas Issa
H2 : L'opérateur.

15 ans chez Sony Europe, co-fondateur de TEOS — déployé dans 7 régions, ROI de 6 000 % la première année. Lego, Siemens, Netflix, Cap Gemini parmi les clients. Advisor stratégique depuis 2018 — TikTok, Adidas, Lego. Fondateur d'une agence de communication internationale de 35 experts. Depuis 2020, co-fondateur et opérateur d'ISSA Capital : holding patrimoniale, participations, 15 lots résidentiels en Île-de-France.

Thomas conduit les missions d'accompagnement. Il accompagne sur ce qu'il construit pour lui-même — pas sur ce qu'il a lu ou théorisé. La différence n'est pas rhétorique.

Domaines : structuration de holding, investissement immobilier en direct, advisory corporate, stratégie internationale, positionnement de marque.

Formation : HEC, UC Irvine, IMT Atlantique, prépa Sainte-Geneviève. Major de promotion × 3. Quadrilingue.

---

**[CE QUE LA MAISON APPORTE]**
Overline : Ce que cela change
H2 : Pas un consultant. Une maison.

Un consultant travaille pour vous. Une maison travaille avec ses propres règles, ses propres critères, ses propres structures en jeu. Chez ISSA Capital, les logiques que Jean-Pierre et Thomas transmettent dans une mission sont les mêmes qu'ils appliquent à leur propre patrimoine.

Si vous cherchez quelqu'un qui a les mêmes questions que vous — holding ou pas, immo en direct ou fonds, horizon 10 ans ou 20 — c'est ici que ça se passe.

---

**[CE QUI NE CORRESPOND PAS]**
[identique à Variante A/B]

---

**[DEUX FORMATS — SIGNATURE — FORMULAIRE]**
[identiques à Variante A/B]

### Auto-évaluation 10 dimensions — Variante C v1

1. **Réponse au feedback Thomas** → **8/10.** "Jean-Pierre a bâti. Thomas opère. Les deux sont là." — formulation honnête qui répond à "tous les deux on accompagne" sans promettre une intervention opérationnelle de Jean-Pierre non confirmée.

2. **Crédibilité** → **9/10.** Pas d'ambiguïté sur le rôle de chacun. Karim sait que Thomas opère, et que la maison inclut Jean-Pierre.

3. **Différenciation** → **9/10.** "Pas un consultant. Une maison." — formulation différenciante, ancre ISSA Capital dans la durée et la structure familiale.

4. **Voix de marque** → **9/10.** Sobre, direct, phrases courtes. "La fondation / L'opérateur" — titres nets.

5. **Persona Karim** → **8/10.** "Si vous cherchez quelqu'un qui a les mêmes questions que vous" — verbatim proche du persona. L'objection prix n'est pas traitée explicitement (cohérent avec la vitrine).

6. **Simplicité > Démonstration** (P0) → **9/10.** "Pas un consultant. Une maison." est une affirmation d'identité, pas une démonstration défensive.

7. **Cohérence avec /mission** → **9/10.** Jean-Pierre présenté de manière cohérente. Thomas cohérent.

8. **VITRINE non-conversion** → **10/10.**

9. **Pas de justification explicite** → **9/10.** "La différence n'est pas rhétorique" est limite — à surveiller.

10. **Faits biographiques corrects** → **10/10.** 2J = 2016. Afrique du Sud non mentionné ici (couvert par /mission).

**Score v1 Variante C : 90/100 → 9.0/10**

### Itération v1 → v2

Corrections :
- Dimension 9 : supprimer "La différence n'est pas rhétorique" — formulation méta.
- Dimension 1 : renforcer le H1 — actuellement long et maladroit. Reformuler.

**H1 v2 :** "Jean-Pierre Issa a bâti pendant trente ans. Thomas Issa opère aujourd'hui. ISSA Capital accompagne depuis ce qu'elle a construit."

Trop long. Reformulation v3 :
**H1 v3 :** "L'accompagnement ISSA Capital. Deux générations. Un seul périmètre."

Test P0 : affirme l'identité, ne défend pas, ne se justifie pas. OK.

**"La différence n'est pas rhétorique" → supprimée. Remplacée par :** "C'est la différence entre quelqu'un qui a lu les mêmes livres que vous et quelqu'un qui a pris les mêmes risques."

Test : encore une justification implicite. Reformuler : supprimer la phrase et finir par "Thomas conduit les missions d'accompagnement. Il accompagne sur ce qu'il construit pour lui-même." Point.

**Score v2 Variante C estimé : 94/100 → 9.4/10**

### Score final Variante C : **9.4/10**

---

## 6. Ma recommandation

**Variante A — Duo opérationnel**, sous réserve confirmation Thomas.

**Raison** : Thomas a dit "tous les deux on accompagne" — c'est une instruction explicite. La Variante A est la seule qui répond pleinement à cette formulation. Elle pose Jean-Pierre et Thomas comme deux accompagnateurs avec des domaines distincts et complémentaires, ce qui est différenciant, crédible et honnête si Thomas confirme que Jean-Pierre intervient réellement dans les missions. Les Variantes B et C sont des alternatives solides si Jean-Pierre n'intervient pas opérationnellement — mais elles répondent imparfaitement au brief.

**Si Thomas confirme "Jean-Pierre n'intervient pas opérationnellement dans les missions"** → basculer sur Variante C ("La maison et l'héritier") qui est la plus honnête et la plus sobre dans ce cas.

---

## 7. Question à Thomas

**Une seule question :**

> "Quand tu dis 'tous les deux on accompagne', est-ce que Jean-Pierre intervient directement dans les missions clients — réunions, recommandations, échanges — ou est-ce qu'il est présent au sens de 'la maison Issa accompagne via sa méthode et son héritage', et c'est toi qui opères ?"

Cette réponse détermine si on implémente la Variante A (opérationnel) ou la Variante C (maison). Les deux sont prêtes.

---

## Handoff

**À @fullstack (Phase 7)** : implémenter la variante retenue dans `src/app/accompagnement/page.tsx` après arbitrage Thomas sur la question section 7.

- **Sections à conserver de la v1** : Pour qui (overline + H2 + corps), Ce qui ne correspond pas (liste), Deux formats (2 cartes), Signature "Patient par choix. Exigeant par principe.", formulaire ContactForm.
- **Sections à supprimer de la v1** : Section "La proposition / Ce que Thomas fait" (absorbée dans la nouvelle section Thomas), Section "Parcours / 15 ans de décisions" (remplacée par sections biographiques Jean-Pierre + Thomas restructurées), Section "Sept domaines / Patrimonial / Corporate" (domaines intégrés dans les sections biographiques respectives).
- **Nouvelles sections à créer** :
  - Section "Jean-Pierre Issa" (`tone="elevated"`, cohérent avec /mission Section 2)
  - Section "Thomas Issa" (`tone="default"`)
  - Section "Ce que la lignée/maison apporte" (`tone="subtle"`)
  - Mise à jour du H1 (passer de "Thomas Issa accompagne" à la formulation duo retenue)
- **Mise à jour metadata** : `title`, `description`, `openGraph.title/description` — Thomas seul → duo Jean-Pierre + Thomas.
- **Impact SEO** : H1 change (Thomas seul → duo), H2 "Jean-Pierre Issa" nouveau, H2 "Ce que la lignée apporte" nouveau. Metadata description à mettre à jour pour inclure Jean-Pierre Issa.
- **À @qa** : régénération baselines Playwright `/accompagnement` sur 3 devices (iPhone 13 375px, iPad 768px, Desktop 1280px) après implémentation.

---

**Handoff → @orchestrator**
- Fichier produit : `docs/strategy/accompagnement-refonte-10-10-session6.md`
- Décisions prises : 3 variantes complètes avec verbatim + auto-évaluation. Recommandation = Variante A (duo opérationnel), score 9.5/10 sous réserve confirmation Thomas.
- Points d'attention : un arbitrage Thomas est nécessaire AVANT implémentation @fullstack. Question verrouillée dans section 7. Ne pas implémenter sans réponse.
- Variante de repli prête : Variante C à 9.4/10 si Jean-Pierre n'intervient pas opérationnellement.

---

## 8. Variante A flexible — verbatim ajusté session 7 (SOURCE DE VÉRITÉ POUR L'IMPLÉMENTATION)

> Ajout @orchestrator — 2026-04-08 — CHECKPOINT #5 session 7
> Décision Thomas (verbatim) : *"A, ça peut être aussi l'un, l'autre ou les 2 suivant les missions"*

### Interprétation verrouillée

Thomas valide Variante A sur le principe (Jean-Pierre ET Thomas sont opérationnels dans les missions clients), **MAIS** la composition de l'équipe mission est **flexible** selon le contexte :
- Certaines missions = Jean-Pierre seul
- Certaines missions = Thomas seul
- Certaines missions = les deux ensemble

Ce n'est **pas** Variante C (où Jean-Pierre serait uniquement figure tutélaire). C'est bien Variante A (Jean-Pierre est opérationnel), mais avec **flexibilité de composition**.

**Implication narrative** : la promesse passe de "duo systématique" à "duo flexible". Les 2 bios distinctes sont conservées, l'architecture 8 sections est conservée, mais les formulations qui sous-entendent "systématiquement ensemble" doivent être ajustées.

### Les 4 passages à remplacer dans le verbatim Variante A (sections 3.1 à 3.8 ci-dessus)

**Remplacement 1 — HERO (section 3, lignes 72-74)**

Verbatim session 6 (à NE PAS utiliser) :
> Overline : Un accompagnement à deux voix
> H1 : Jean-Pierre Issa et Thomas Issa accompagnent fondateurs et dirigeants sur ce qu'ils ont eux-mêmes construit.

**Verbatim session 7 verrouillé (à utiliser dans `src/app/accompagnement/page.tsx`)** :
> Overline : Conseil & accompagnement
> H1 : Jean-Pierre Issa et Thomas Issa accompagnent fondateurs et dirigeants sur ce qu'ils ont eux-mêmes construit.

Raison de l'ajustement : "à deux voix" sous-entend une présence systématique des deux. L'overline "Conseil & accompagnement" est sobre et n'engage pas la composition.

---

**Remplacement 2 — CE QUE LA LIGNÉE APPORTE (section 3, lignes 120-127 v1 + lignes 200-207 v2)**

La v2 ci-dessus (section "Itération v1 → v2") reste la base, **mais** ajouter une phrase d'ancrage "flexibilité de composition" avant le paragraphe final.

**Verbatim session 7 verrouillé** :
> Overline : Ce que le duo produit
> H2 : Une méthode héritée. Deux lectures du même sujet.
>
> Jean-Pierre a bâti des structures qui tiennent sur vingt ans — dans l'industrie, dans le co-actionnariat, dans l'internationalisation réelle. Thomas a traduit cette méthode dans les contextes d'aujourd'hui — holding patrimoniale, advisory tech, marchés européens. Les deux ont fait leurs erreurs pour leur propre compte, pas pour celui d'un client.
>
> Selon la nature de la mission, Jean-Pierre, Thomas, ou les deux interviennent directement. Le duo s'adapte au contexte — pas l'inverse. Une mission de structuration patrimoniale et d'advisory tech sera portée par Thomas. Un rachat industriel ou une question de gouvernance long terme mobilisera Jean-Pierre. Une mission qui croise les deux registres mobilisera les deux.
>
> Leurs structures actuelles — 2J Impression, l'écosystème ISSA Capital — suivent les mêmes logiques qu'ils transmettent. Ce n'est pas du conseil de cabinet. C'est la lecture de deux personnes qui ont la peau dans le jeu.

Raison de l'ajustement : le paragraphe central (nouveau) explicite la flexibilité avant que le lecteur ne se demande "mais alors qui m'accompagne concrètement ?". Le paragraphe final reste inchangé car il parle de la méthode, pas de la composition.

---

**Remplacement 3 — CE QUI NE CORRESPOND PAS (section 3, lignes 133-141)**

Verbatim session 6 (à NE PAS utiliser, phrase d'ouverture uniquement) :
> Jean-Pierre et Thomas accompagnent des fondateurs et des investisseurs qui ont déjà fait leurs preuves. Ils n'accompagnent pas les premières étapes d'un projet.

**Verbatim session 7 verrouillé** :
> Le périmètre d'accompagnement ISSA Capital — qu'il soit porté par Jean-Pierre, Thomas, ou les deux — concerne des fondateurs et des investisseurs qui ont déjà fait leurs preuves. Pas les premières étapes d'un projet.

Le reste de la liste (7 puces "Projets crypto/Web3 purs", "First-time founders", etc.) reste **inchangé**.

---

**Remplacement 4 — FORMULAIRE (section 3, lignes 164-166)**

Verbatim session 6 :
> Overline : Prenons contact
> H2 : Si le périmètre correspond, prenons contact.
> Corps : Chaque mission démarre par un échange — pas par un devis.

**Verbatim session 7 verrouillé (inchangé — était déjà générique)** :
> Overline : Prenons contact
> H2 : Si le périmètre correspond, prenons contact.
> Corps : Chaque mission démarre par un échange — pas par un devis. Selon le contexte, Jean-Pierre, Thomas, ou les deux répondront.

Raison : ajout d'une seule phrase finale qui confirme la flexibilité au moment du contact, sans fermer la porte au duo ni la forcer.

---

### Sections INCHANGÉES par rapport à Variante A session 6

Les sections suivantes du verbatim Variante A (section 3 ci-dessus) restent **inchangées** et sont implémentées telles quelles :

- **[POUR QUI]** (section 3, lignes 78-84) — texte complet inchangé
- **[JEAN-PIERRE ISSA]** (section 3, lignes 88-98) — bio complète inchangée, 4 paragraphes, domaines conservés
- **[THOMAS ISSA]** (section 3, lignes 102-116) — bio complète inchangée, 5 paragraphes, domaines conservés, formation conservée
- **[DEUX FORMATS]** (section 3, lignes 146-154) — 2 cartes inchangées (Mission ponctuelle + Advisoring)
- **[SIGNATURE]** (section 3, lignes 158-159) — "Patient par choix. Exigeant par principe." inchangé

### Architecture 8 sections verrouillée

1. **Hero** — overline "Conseil & accompagnement" + H1 inchangé
2. **Pour qui** — filtre Karim inchangé
3. **Jean-Pierre Issa** — bio opérationnelle 4 paragraphes
4. **Thomas Issa** — bio 5 paragraphes + formation
5. **Ce que le duo produit** — section centrale AJUSTÉE (ajout paragraphe flexibilité)
6. **Ce qui ne correspond pas** — phrase d'ouverture AJUSTÉE + liste inchangée
7. **Deux formats** — inchangé
8. **Signature + formulaire** — signature inchangée + formulaire AJUSTÉ (ajout 1 phrase finale)

### Faits biographiques verrouillés (rappel @fullstack)

- **2J Impression rachat = 2016** (PAS 1994) — ligne 94 et ligne 131 du verbatim Variante A
- **Jean-Pierre Issa né à Dakar en 1958** — ligne 92 du verbatim Variante A
- **Thomas : 15 ans chez Sony Europe, TEOS co-fondé, ROI 6000% première année** — ligne 106
- **Mention Sony/TEOS/TikTok/Adidas/Lego : AUTORISÉE ici** (exception Q2 session 5) — mais coupée de la bio /mission
- **Identité libanaise** jamais française
- **Zéro mention nom agence Thomas** — utiliser "une agence de communication internationale" ligne 108
- **UTF-8 réels** dans le code TSX (é è à ç ê î ô û ë ï ù) — jamais `\u00E9` ni `&eacute;` dans les strings JS

### Handoff vers @fullstack (Phase 7 mega-passe session 7)

@fullstack DOIT utiliser la **section 8 ci-dessus comme source de vérité** pour `src/app/accompagnement/page.tsx`. Les sections 3 (Variante A session 6) et 6 (recommandation session 6) restent utiles comme contexte mais ne sont plus la source primaire — la section 8 prévaut en cas de divergence.

Score estimé Variante A flexible : **9.5/10** (identique à Variante A systématique — le score n'est pas dégradé car la flexibilité est explicitée, pas cachée).




