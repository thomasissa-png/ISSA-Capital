> Sources amont : src/app/page.tsx, src/app/accompagnement/page.tsx, src/app/opportunites/page.tsx, src/app/participations/page.tsx, src/app/contact/page.tsx, src/app/mission/page.tsx, src/app/a-propos/page.tsx, docs/copy/page-accompagnement.md, docs/copy/page-opportunites.md

# Audit transverse — Justifications explicites (pattern "décision noir sur blanc") — Session 6

## Synthèse exécutive

- **Occurrences détectées** : 5 (sur les pages actives) + 3 en zones de refonte
- **Répartition par sévérité** : P0 × 1 / P1 × 3 / P2 × 1
- **Pages les plus impactées** : /accompagnement (P0 + 1 P1), /opportunites (P1)
- **Pages indemnes** : /participations, /contact, /a-propos (aucune occurrence active)
- **Verdict global** : Un seul P0 criant (la phrase verbatim de Thomas), mais un pattern de fond plus diffus — des constructions en "Dans les deux cas :", "Quel que soit le dossier :", "Ces critères permettent à Thomas de..." qui sonnent décision transcrite plutôt que principe incarné.

---

## Le pattern (rappel)

Pendant les sessions précédentes, des décisions de conception ont été prises en échange oral avec Thomas puis écrites verbatim dans le copy public. Ces phrases ont le défaut suivant : elles **expliquent** la décision au lieu de l'**incarner**. Exemple cité par Thomas : *"Dans les deux cas : aucun tarif affiché. La mission commence par un échange de qualification."* — une réponse de réunion collée dans le site.

---

## Inventaire complet

### Page : /accompagnement

#### Occurrence 1 — P0
- **Fichier** : `src/app/accompagnement/page.tsx` ligne ~308 / `docs/copy/page-accompagnement.md` ligne 200
- **Verbatim** : *"Dans les deux cas : aucun tarif affiché. La mission commence par un échange de qualification."*
- **Diagnostic** : Phrase verbatim issue d'un échange Thomas/agent sur la politique tarifaire. Structure "Dans les deux cas :" = connecteur de compte-rendu de réunion. "La mission commence par..." = annonce de processus au lieu de vivre le processus. Le lecteur sent qu'on récite une décision prise en interne, pas qu'on incarne un positionnement.
- **Verdict** : REFORMULER
- **Reformulation suggérée** : Supprimer la phrase et laisser les deux formats se suffire à eux-mêmes. Si Thomas veut que l'absence de tarif soit signalée, l'intégrer dans l'intro de la section formulaire (section 7) : *"Chaque mission démarre par un échange — pas par un devis."*
- **Sévérité** : P0

---

#### Occurrence 2 — P1
- **Fichier** : `src/app/accompagnement/page.tsx` ligne ~274 / `docs/copy/page-accompagnement.md` ligne 181
- **Verbatim** : *"Ces critères permettent à Thomas de consacrer son attention aux projets où il apporte une vraie valeur."*
- **Diagnostic** : Phrase méta — elle **explique pourquoi les critères existent** au lieu de laisser les critères parler. Une liste d'anti-personas n'a pas besoin de se justifier. Un filtre qui se justifie perd la moitié de son autorité.
- **Verdict** : SUPPRIMER
- **Reformulation suggérée** : Supprimer la phrase. La liste d'anti-personas est assez claire — Karim comprend seul pourquoi ces critères existent.
- **Sévérité** : P1

---

### Page : /opportunites

#### Occurrence 3 — P1
- **Fichier** : `src/app/opportunites/page.tsx` ligne ~140
- **Verbatim** : *"Quel que soit le dossier : nous n'investissons pas dans ce qui contrevient à nos filtres de décision non négociables. Environnement : toute opportunité dont le modèle économique repose structurellement sur la dégradation de l'environnement est refusée. Éthique humaine : ISSA Capital n'investit jamais dans ce qui va à l'encontre de l'humanité."*
- **Diagnostic** : La structure "Quel que soit le dossier :" est un cousin direct de "Dans les deux cas :". C'est un connecteur de compte-rendu qui introduit un principe au lieu de l'affirmer. Par ailleurs, la répétition des filtres est ici redondante avec la section Trois filtres de /mission et de /home — le pattern "décision transcrite" est accentué par le sentiment de copier-coller une règle écrite en réunion.
- **Verdict** : REFORMULER
- **Reformulation suggérée** : *"Ces deux filtres précèdent toute analyse, sans exception : préservation de l'environnement — ISSA Capital n'entre pas dans un projet dont le modèle repose sur la dégradation environnementale. Éthique humaine — ISSA Capital n'investit jamais dans ce qui va à l'encontre de l'humanité."*
  Supprimer "Quel que soit le dossier :". Remplacer par une intro affirmatrice ("Ces deux filtres précèdent toute analyse") — plus court, plus tranchant, pas de connecteur de réunion.
- **Sévérité** : P1

---

### Page : /home

#### Occurrence 4 — P1
- **Fichier** : `src/app/page.tsx` ligne ~219
- **Verbatim** : *"Nos décisions d'investissement ne sont pas négociables sur ces trois critères."*
- **Diagnostic** : Phrase méta qui **annonce** les filtres au lieu de les laisser s'imposer. "Ne sont pas négociables" + "sur ces trois critères" = registre de Note de Direction interne, pas de copy de marque. Le H2 "Trois filtres. Aucune exception." est déjà plus fort — la phrase intro le dilue.
- **Verdict** : SUPPRIMER
- **Reformulation suggérée** : Supprimer la phrase d'intro. Le H2 "Trois filtres. Aucune exception." suffit — les filtres suivent directement sans introduction méta.
- **Sévérité** : P1

---

### Page : /accompagnement (suite)

#### Occurrence 5 — P2
- **Fichier** : `src/app/accompagnement/page.tsx` ligne ~330
- **Verbatim** : *"Quelques informations pour comprendre votre situation. Le formulaire ci-dessous est court — il ne sert pas à qualifier mécaniquement, mais à permettre à Thomas de préparer un échange substantiel."*
- **Diagnostic** : Cas limite. La deuxième phrase ("il ne sert pas à qualifier mécaniquement, mais à...") est une justification du formulaire — le site s'explique sur son propre choix d'outil. Un site sûr de lui ne défend pas son formulaire. La première phrase ("Quelques informations pour comprendre votre situation.") reste correcte.
- **Verdict** : REFORMULER (partielle)
- **Reformulation suggérée** : Conserver la première phrase. Remplacer la seconde par : *"Thomas lit chaque message."* — plus court, plus puissant, incarne le principe sans l'expliquer.
- **Sévérité** : P2

---

## Zones en cours de refonte (à recroiser après Phase 2)

Ces occurrences sont sur /mission et /a-propos, en cours de travail par les autres agents session 6. Listées pour mémoire — ne pas corriger maintenant.

**Zone 1 — /mission, ligne ~207 :**
*"Ces filtres précèdent toute analyse financière."*
Limite acceptable (affirmatif court), mais à surveiller selon le sens que prend la refonte. Si la page /mission est retravaillée, vérifier que les filtres sont incarnés et non annoncés.

**Zone 2 — /mission, ligne ~229 :**
*"Ce n'est pas une démarche RSE — c'est un critère de sélection réel."*
Anti-pattern : définition par négation d'un concurrent ("pas RSE"). En page vitrine, cette antithèse défensive est de sévérité P1 selon les règles CLAUDE.md. À recroiser après refonte.

**Zone 3 — /a-propos — aucune occurrence du pattern détectée.** Page narrative, écriture biographique, aucune structure "Dans les deux cas" ni annonce de processus. Indemne.

---

## Recommandations transverses (5 règles éditoriales)

1. **Interdire "Dans les deux cas :" et "Quel que soit le dossier :"** — ces connecteurs sont des marqueurs de compte-rendu. Ils n'existent pas dans le copy d'une marque sûre d'elle. Règle : supprimer systématiquement avant livraison.

2. **Ne jamais expliquer pourquoi un filtre ou critère existe** — un filtre s'affirme, il ne se justifie pas. "Ce qui ne correspond pas au périmètre." est correct. "Ces critères permettent à Thomas de..." est du registre méta interdit.

3. **Ne jamais défendre un outil ou un format de page** — "le formulaire ne sert pas à qualifier mécaniquement" explique le choix d'outil. Un site incarné choisit ses outils sans les défendre. Règle : si une phrase commence par "le formulaire est..." ou "la page est...", la reformuler en principe ou la supprimer.

4. **Les antithèses défensives ("pas X, mais Y") sont limitées à 1 par page** — règle déjà dans CLAUDE.md mais à rappeler ici : une antithèse qui répond à un adversaire non nommé est défensive par nature. Au-delà de 1 par page, le copy bascule en mode justification.

5. **Test de lecture orale avant livraison** — lire chaque phrase en imaginant Thomas la dire à Karim dans un dîner d'affaires. Si la phrase sonne "décision de réunion" ou "process interne", reformuler. Si elle sonne "conviction naturelle", garder.

---

## Handoff

- **À Thomas** : 5 occurrences actives listées ci-dessus. Le seul P0 est tranché (reformuler). Les P1 demandent un arbitrage : SUPPRIMER (occurrences 2 et 4) ou REFORMULER (occurrences 3) — les reformulations suggérées sont des options, pas des obligations. Si Thomas veut une lecture différente, signaler avant la Phase 2.
- **À @copywriter (Phase 2 après validation Thomas)** : application des corrections en batch sur les 5 occurrences actives. Opération Edit ciblée fichier par fichier — ne pas toucher aux zones de refonte (/mission, /a-propos).
- **À @fullstack (Phase 3)** : propagation TSX des corrections validées (`src/app/accompagnement/page.tsx` lignes ~274, ~308, ~330 / `src/app/opportunites/page.tsx` ligne ~140 / `src/app/page.tsx` ligne ~219) + baselines Playwright à régénérer après corrections.
