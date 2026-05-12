# Préférences fondateur — Thomas Issa

> Source de vérité pour l'agent @moi. Mis à jour à chaque session.
> Les learnings de catégorie "préférence fondateur" de docs/lessons-learned.md sont copiés ici.

## Identité et culture

- **Famille Issa** : ne JAMAIS écrire "famille libanaise". Formulations autorisées : "racines libanaises" (tagline), "d'origine libanaise" (bios), "famille Issa", "héritage libanais". Retour Jean-Pierre Issa session 9 : "On n'est pas tout à fait libanais comme on a pas tous la nationalité."
- **Double identité** : SAS française + famille d'origine libanaise. Asset différenciant à valoriser.
- **Mission vs Valeurs** : la Mission = intérêts famille + transmission. Les Valeurs (éthique, environnement) sont des FILTRES, pas la finalité.

## Qualité et standards

- **Zéro MVP** : le mot "MVP" est banni. Tout livrable doit être fini, pas bancal. Le brief initial EST le scope minimum.
- **Simplicité > Démonstration > Élégance** : pas d'antithèses défensives, pas d'anaphores rhétoriques, pas de sur-intellectualisation.
- **Humilité confiante** : "je suis humble mais sûr de mes forces". Pas de superlatifs, les faits parlent.
- **Si on n'a rien à dire, on ne dit rien** : Claude n'invente JAMAIS un contenu — il structure la matière que Thomas fournit.
- **Triple audit >= 9/10 avant soumission** : Thomas ne beta-teste pas. Claude livre du fini.

## Stack technique

- **Analytics** : Umami uniquement (cookieless, open source, RGPD). Jamais Plausible ni GA4.
- **Hébergement** : Replit.
- **Framework** : Next.js 14 App Router, Tailwind, TypeScript strict.
- **Images IA** : gpt-image-2 (préférence).

## Contenu et communication

- **Storytelling-first** : tout contenu (post LinkedIn, email, deck) part d'un récit vécu, pas d'une thèse abstraite.
- **3 questions avant d'écrire** : Qu'est-ce que Thomas veut dire ? À qui ? Pourquoi maintenant ?
- **Justifications interdites** : une marque sûre d'elle ne se justifie pas. Pas de "Dans les deux cas :", "Ce que nous ne faisons pas :".
- **Chiffres narratifs > chiffres factuels** : "Co-fondation 2020 / 6 Participations / 3 Générations" pas "50% de détention".
- **Volume bio calibré** : max 4 phrases en version RICHE, 2-3 en INT, 1 en MIN. Couper ce qui n'apporte rien au persona.

## Site vitrine

- **VITRINE, PAS CONVERSION** : "On est pas là pour plaire au prospect. On est là pour avoir une belle vitrine."
- **Délais réalistes** : "sous 72h" pas "dans la journée". Le message est "nous prenons le temps de bien étudier".
- **Forme collégiale** : "l'un des membres de la famille" plutôt que "Thomas Issa" pour les contacts.
- **Placeholders** : éviter archétypes (Dupont, Martin). Utiliser des noms distinctifs neutres (ex: "Antoine Vasseur").

## Organisation personnelle

- **Pas de dichotomie Pro/Perso** : Thomas refuse la séparation systématique Pro/Perso dans ses outils (vault, contacts, notes). Un contact reste un contact, une note reste une note. Les containers sont structurels (Projets, Contacts, Réunions), pas catégoriels (Pro vs Perso). Le personnel est rangé par thème dans Notes/ (Idées, Learnings, Cuisine, Voyages).

## Processus décisionnel

- **Paralléliser par défaut** : valeur > effort. Ne pas séquencer sans raison.
- **Après 1 rejet visuel** : toujours fournir 3+ variantes à la passe suivante.
- **Signal "pauvre/moche/fade"** : déclencher un audit @design complet, pas juste un fix ponctuel.
- **Qualité > coût** : verbatim session 10 "ne gâchons ni l'usage ni la qualité, optimisons ce qui doit l'être tant que pas d'impact négatif". Refuse les optimisations coût qui dégradent l'UX. Sonnet 4.6 conservé pour les workflows IA (vs Haiku qui économiserait 10€/an). Optimiser ce qui est 100% transparent (ex: mode inbox sans API), pas ce qui dégrade.
- **Connectors natifs avant MCP custom** : préfère toujours les intégrations 1-clic OAuth dans claude.ai/customize/connectors aux setups MCP techniques (Node.js, PAT, config JSON). 2 récidives observées (Gmail/Calendar session 9, Asana/Craft session 10). Règle CLAUDE.md n°19.
- **Friction zéro sur données déjà saisies** : ne JAMAIS demander à Thomas de confirmer des données qu'il a lui-même saisies dans son vault/source de vérité. La confirmation n'est utile que pour des données calculées/inférées par l'IA dont la fiabilité est < 95 %. Verbatim S11 : "pas besoin de confirmé les infos locataires car elles sont préremplies dans le vault, on part du principe que c'est bon".
- **Pas de récap final dans les workflows batch** : si chaque étape précédente est self-documenting (sélection visible aux étapes précédentes), le récap est friction inutile. Génération directe après le dernier paramètre. Garder le récap UNIQUEMENT pour les actions irréversibles coûteuses (envoi email à 1000 personnes, suppression DB). Verbatim S11 : "également pas besoin de récapitulatif de quittance".
- **Recherche floue baseline, pas nice-to-have** : tout système de recherche utilisateur (locataires, contacts, projets, fiches) doit tolérer accents, casse, typos (Levenshtein ≤ 2), recherche par prénom seul ou nom de famille seul, match sur multiples champs (nom_fichier + nom_officiel du frontmatter). Verbatim S11 : "il faudrait quelle puisse se debrouiller a partir du prénom uniquement ou si y a une typo dans le nom, bref quelle soit un peu futée".
