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
- **Modèle adapté à la tâche** (nuance le "qualité > coût" S10) : Sonnet 4.6 pour génération texte structurée (CR, emails, voice/tone), Haiku 4.5 pour extraction JSON simple, résolution dates, classification binaire. **Verbatim S13** : "pourquoi pas haiku ?" après que j'avais mis Sonnet par inertie sur le router inbox. Haiku 4.5 a passé 25/25 cas de résolution dates+heures FR sans dégradation. Le dogme "qualité > coût" S10 reste valide mais **chaque appel LLM justifie son modèle par la complexité de la tâche, pas par défaut**.
- **Qualité > coût** (S10) : Refuse les optimisations coût qui dégradent l'UX. Optimisation valide = 100% transparente. Optimisation à rejeter = dégradation perçue.
- **Connectors natifs avant MCP custom** : préfère toujours les intégrations 1-clic OAuth dans claude.ai/customize/connectors aux setups MCP techniques (Node.js, PAT, config JSON). 2 récidives observées (Gmail/Calendar session 9, Asana/Craft session 10). Règle CLAUDE.md n°19.
- **Friction zéro sur données déjà saisies** : ne JAMAIS demander à Thomas de confirmer des données qu'il a lui-même saisies dans son vault/source de vérité. La confirmation n'est utile que pour des données calculées/inférées par l'IA dont la fiabilité est < 95 %. Verbatim S11 : "pas besoin de confirmé les infos locataires car elles sont préremplies dans le vault, on part du principe que c'est bon".
- **Pas de récap final dans les workflows batch** : si chaque étape précédente est self-documenting (sélection visible aux étapes précédentes), le récap est friction inutile. Génération directe après le dernier paramètre. Garder le récap UNIQUEMENT pour les actions irréversibles coûteuses (envoi email à 1000 personnes, suppression DB). Verbatim S11 : "également pas besoin de récapitulatif de quittance".
- **Recherche floue baseline, pas nice-to-have** : tout système de recherche utilisateur (locataires, contacts, projets, fiches) doit tolérer accents, casse, typos (Levenshtein ≤ 2), recherche par prénom seul ou nom de famille seul, match sur multiples champs (nom_fichier + nom_officiel du frontmatter). Verbatim S11 : "il faudrait quelle puisse se debrouiller a partir du prénom uniquement ou si y a une typo dans le nom, bref quelle soit un peu futée".
- **Livraison en vagues > attente décision groupée** (S12) : sur tout audit pluriel (legal, reviewer, qa), regrouper les recommandations en 2 colonnes "actionnable sans décision Thomas" vs "nécessite arbitrage Thomas". Livrer immédiatement la première colonne. Verbatim S12 : "Appliquons uniquement p0 #1 et #4".
- **Refus billing account pour service gratuit** (S13) : si un service externe est gratuit ≤ N usages/mois MAIS exige l'activation d'un billing account (carte bancaire, GCP, AWS), Thomas refuse. Préfère un service standalone (clé API simple, paiement à l'avance) même si légèrement plus cher. **Verbatim S13** : "il faut un billing account, du coup passons a open ai" (Google STT gratuit < 60min/mois mais billing GCP requis → switch OpenAI Whisper $0.006/min). **Règle** : pour tout choix de service externe gratuit/cloud, vérifier d'abord s'il exige un billing account AVANT de le proposer.
- **Contrôle explicite par boutons > décision auto IA** (S13) : pour les workflows où Anya doit choisir entre 2+ actions (ex: Calendar vs Todo, Photo vs CR), Thomas préfère 1 clic supplémentaire à un faux positif silencieux. **Verbatim S13** : choisit Option A (boutons à chaque fois) sur 3 options proposées (B=Anya décide auto, C=hybride). **Règle** : pour toute décision IA avec risque d'erreur non-nul, proposer A=Thomas valide par défaut. Auto-décision OK seulement si fiabilité prouvée > 99% sur 30 jours de calibration. Friction = 1 clic, coût erreur = faux contenu dans le vault/calendar.
- **"Teste avant de pusher"** (S13, urgent) : ne JAMAIS pusher un fix sur un bug reproductible sans avoir testé sur le fichier/données réels qui foirent. **Verbatim S13** : "jen ai marre de tatonner, sois sur" puis "12e commit sur ce sujet" après 8 commits de tâtonnement sur les photos HEIC. **Règle** : si l'utilisateur signale 2 itérations sans succès → STOP push, demander un sample du cas qui foire, écrire un test, valider, PUIS pusher. Aucun "commit hypothétique" sur un bug récurrent.
- **Mutualiser > dupliquer les patterns** (S13) : avant de créer un nouveau module pour une fonctionnalité, vérifier si un module existant fait déjà 80%+ du job. **Verbatim S13** : "unifions sans rien casser" (sur la duplication potentielle entre `inbox-message-router` et le futur `email-ingest`). Pattern : ajouter un prefix callback unique plutôt qu'un nouveau fichier dédié. ~30% moins de code, 1 seul système à maintenir.
- **Anya demande l'info manquante > extraction auto fragile** (S13) : quand un service externe (Telegram, iOS Photos) altère les données AVANT arrivée backend (ex: strip EXIF), abandonner l'extraction et demander l'info via prompt UX. **Verbatim S13** : "je veux que ca actionne ca de maniere intelligent, ou que ca log une action a faire pur plus tard" (sur les photos HEIC sans EXIF) → workflow `inbox-photo-batch` (Anya demande la date à Thomas). Pattern produit plus fiable que tâtonnement extraction.
