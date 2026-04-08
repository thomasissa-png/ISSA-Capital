# Questions de cadrage — Agent Secrétariat ISSA Capital

> Fichier produit par @product-manager le 2026-04-07.
> Objectif : Thomas répond une fois, l'implémentation démarre sans nouveau cycle de questions.
> Format : Q[section].[numéro] — question + note de contexte.
> Total : 62 questions en 12 sections. 5 questions critiques identifiées dans le récapitulatif final.

---

## 1. Vision produit & success metrics

**Q1.1** Combien de comptes rendus produis-tu par mois aujourd'hui — à la main, par email, ou pas du tout ?
*Permet de calibrer le volume d'usage réel et de dimensionner le compteur de références (IC-CR-2026-XXXX).*
Aujourd'hui quasiment aucun, mais le but est d'en produire 3 à 4 par semaine

**Q1.2** Quel est le signe concret qui te dira, dans 3 mois, que cet outil est un succès ? (ex : "je n'ai plus jamais à écrire un CR à la main", "j'ai 20 CRs validés par mon comptable", "j'économise 2h/semaine")
*Définit le critère de succès qui guide les choix de scope — sans ça, on risque de surcharger la V1 de features non prioritaires.*
J'ai 30 CR de niveau parfait, en ayant passé quasiment aucun temps dessus

**Q1.3** Quelle est la douleur principale aujourd'hui : (a) tu n'as aucun CR structuré et tu en as besoin, (b) tu en fais mais ils prennent trop de temps, ou (c) tu en as mais ils ne résistent pas à un audit fiscal ?
*Change radicalement la priorité des features — si c'est (a), l'interface chat est le coeur ; si c'est (c), le système prompt juridique est le coeur.*
J'en ai pas et ca prendre du temps

**Q1.4** Cet outil est-il uniquement pour toi, ou envisages-tu de le déléguer à une assistante ou un office manager ?
*Impacte directement la décision d'authentification (section 8) et la granularité de l'interface.*
Probablement a deux de mes co-actionnaires sur des filiales

**Q1.5** Y a-t-il d'autres types d'événements que tu voudrais pouvoir documenter et qui ne sont pas couverts par les 4 types du brief (déjeuner, conseil, appel, interne) ? Par exemple : visites de biens immobiliers, signature de contrats, dîners de représentation ?
*Évite de devoir refaire le système prompt et les templates après le lancement.*
Oui: visites de biens immobiliers, signature de contrats, dîners de représentation
Globalement tout ce qui peut concerner une holding qui a des activtés financières et immmobilières

## 2. Scope fonctionnel V1

**Q2.1** Les 4 types de réunions du brief (déjeuner, conseil, appel, interne) sont-ils tous nécessaires en V1, ou certains peuvent attendre la V2 ?
*Options : (a) les 4 en V1, (b) prioriser déjeuner + appel d'abord (les plus fréquents pour une holding), (c) autre ordre.*
Vélocité IA. On fait tout. On peut commencer un pour tester, mais ensuite on fait tout

**Q2.2** Faut-il pouvoir modifier un CR après publication sur Craft — par exemple corriger un nom, une date, ou ajouter une action oubliée ?
*Si oui : implique un endpoint `PATCH /blocks` Craft + une interface d'édition côté app. Si non : le CR publié est considéré immuable (conforme au principe d'intégrité d'un document fiscal).*
Si claude m'a bien posé les bonnes questions et préparé le document, normalement pas besoin de modifier

**Q2.3** Faut-il pouvoir supprimer un CR publié sur Craft depuis l'application ?
*Attention : en contexte fiscal (Art. 39-1 CGI), supprimer un CR après publication peut poser problème. Options : (a) pas de suppression depuis l'app, (b) suppression avec confirmation et log de l'action, (c) archivage seulement (pas de suppression physique).*
On peut supprimer avec log - mais seulement moi doit avoir acces au log

**Q2.4** Faut-il une fonction de recherche dans les CRs publiés (dans la sidebar) ? Par exemple : rechercher par participant, par date, par type de réunion ?
*En V1, la sidebar est une liste simple. La recherche est une feature de confort — coût faible, mais à prioriser explicitement.*
Je pense que craft le permet de base mais oui ce serait bien si craft le fait pas

**Q2.5** Faut-il pouvoir filtrer ou trier les CRs dans la sidebar ? (par type, par date, par entité)
*Devient utile dès 20-30 CRs. Si tu prévois un usage intensif dès le lancement, à implémenter en V1.*
Meme commentaire que 2.4

**Q2.6** Le brief mentionne un bouton "Éditer" sur la carte preview. Qu'est-ce que ça veut dire concrètement : (a) modifier le JSON brut avant publication, (b) relancer Claude avec des corrections, (c) éditer le texte directement dans les champs de la carte ?
*Ces 3 options ont des complexités techniques très différentes. Clarifier pour que @fullstack implémente exactement ce que tu veux.*
on modifie avant publication

**Q2.7** Faut-il un historique des versions d'un même CR ? (ex : brouillon v1 → après clarification v2 → version publiée)
*Utile pour l'audit trail, mais complexifie le state management. Options : (a) pas de versionning — seule la version publiée compte, (b) conserver les brouillons dans la session en cours uniquement, (c) versionning persistant.*
non pas besoin, seul compte la version publiée

**Q2.8** La section "Suites à donner" (tableau actions/responsable/échéance) — les échéances sont-elles en texte libre ("fin avril") ou en date précise ("30 avril 2026") ? Et faut-il un rappel automatique (notification, email) quand une échéance approche ?
*Le rappel automatique est une feature significative — à mettre en V2 sauf si c'est un besoin immédiat.*
il faut etre flexible, suivant les rendez vous. A noter quil se peut quil y ai tdes rendezvous sans suites. Auquel cas la seciton ne doit pas apparaitre.

## 3. Workflow & UX

**Q3.1** Est-ce un outil desktop uniquement, ou dois-tu pouvoir l'utiliser depuis ton téléphone (ex : juste après un déjeuner, en saisissant les notes dans le taxi) ?
*Si mobile : l'interface doit être responsive et le textarea doit s'adapter. Si desktop only : on peut se concentrer sur la densité d'information.*
Je veux pouvoir envoyer les demandes par whatsapp ou imessage.

**Q3.2** Le brief décrit un workflow en 2 étapes (générer → publier). Est-ce que tu veux parfois générer sans publier — par exemple pour garder un brouillon, relire le lendemain, ou envoyer par email ?
*Si oui : implique un système de sauvegarde locale des brouillons non publiés. Sinon : le flux est linéaire et on peut simplifier le state management.*
oui, on garde brouillon tant que pas publié

**Q3.3** Que se passe-t-il si tu fermes l'onglet navigateur avec un CR généré mais non publié ? Options : (a) tout est perdu (acceptable si le workflow est toujours fait en une fois), (b) un avertissement "vous avez un brouillon non publié" s'affiche, (c) sauvegarde automatique dans localStorage.
*La sauvegarde localStorage est facile à implémenter — mais si tu travailles toujours en une session continue, c'est du bruit inutile.*
sauvegarde automatique brouillon

**Q3.4** Le brief mentionne des raccourcis pour les 4 types de réunion qui pré-remplissent le textarea. Quel texte doit apparaître dans le textarea quand tu cliques sur "Déjeuner d'affaires" ? Un exemple de phrase d'amorce, ou le champ reste vide avec juste un placeholder ?
*Exemple : "Déjeuner d'affaires avec [prénom + société] le [date] au [lieu]. Points abordés : ..." — confirmer ce niveau de guidage.*
Jamais de placeholder sur une version finale. SI on a les infos on remplit. Si on a pas, claude demande piur confirmation et ajuste que le CR final soit propre.

**Q3.5** Est-ce que tu veux une confirmation ("Êtes-vous sûr ?") avant de publier sur Craft, ou tu préfères publier direct sans confirmation ?
*La confirmation réduit les erreurs de publication accidentelle. Mais si tu valides toujours le preview avant, c'est un clic de friction inutile.*
Oui

**Q3.6** Faut-il pouvoir copier le Markdown généré directement (bouton "Copier Markdown") pour le coller ailleurs — dans un email, un autre outil ? Et le PDF : est-ce un besoin réel à court terme ou une feature future ?
*Le brief mentionne "Copier Markdown" sur la carte preview. Le PDF est listé dans les extensions futures — confirmation que c'est bien V2+.*
pas sur que je comprenne cette question?

## 4. Génération Claude — qualité & contrôle

**Q4.1** Peux-tu me donner un exemple réel d'une réunion récente que tu aurais voulu documenter — les notes brutes que tu aurais tapées dans le chat, et ce que tu aurais attendu comme CR en sortie ?
*Un exemple concret vaut 100 specs abstraites. Il permet de calibrer exactement le niveau de formalisme, de longueur de paragraphes, et de "comblement" des détails manquants.*
déjeuner avec Emmanuel Gomez ce midi au restaurant pour discuter des prochains lancements Versimo

A noter que on doit avoir une database des contacts principaux comme ca tu sauras par exemple que emmanuel comez est président de gradient one etc. pour compléter les CR sans que j'ai a repeter

**Q4.2** Le brief précise "français juridique formel narratif — jamais de bullet points". Y a-t-il des formules ou tournures que tu veux absolument voir apparaître dans tous les CRs ? Et des tournures que tu trouves trop pompeuses / à bannir ?
*Exemple de tournure prescrite : "En foi de quoi..." ou "Il a été décidé de...". Tournure proscrite : "Il a été globalement mentionné que..."*
A @legal de choisir

**Q4.3** Quand Claude "comble les détails manquants" (heure approximative, lieu générique), jusqu'où peut-il inventer ? Options : (a) libre — si ça tient juridiquement, peu importe, (b) uniquement les données de contexte neutres (heure, lieu), jamais les participants ou les décisions, (c) aucun comblement — s'il manque une info critique, Claude doit toujours poser la question.
*Ce choix définit le comportement du champ `needs_clarification`. Si tu veux le minimum de questions, option (a). Si tu veux la rigueur maximale, option (c).*
Jamais les particpants et les lieux. Si claude manque une info, il demande. Je donnerai le go pour inventer si besoin

**Q4.4** Combien de tours de clarification maximum avant que Claude génère quand même ? Le brief dit `needs_clarification: true` avec "une seule question" — mais si tu réponds de manière incomplète, doit-il reposer une question ou générer avec les données disponibles ?
*Options : (a) 1 seul tour de clarification max, (b) 2 tours max, (c) jamais forcer — tant qu'il manque une info critique, on reste en clarification.*
Jusqua ma validation

**Q4.5** Faut-il une bibliothèque de participants récurrents ? Par exemple : quand tu tapes "réunion avec Pierre", l'app suggère "Pierre Dupont, Associé — Cabinet X" depuis une liste que tu as constituée.
*Économise du temps et garantit la cohérence des titres professionnels. Mais implique un mini carnet d'adresses à maintenir. À évaluer selon la fréquence de tes réunions avec les mêmes personnes.*
Oui tout a fait !

**Q4.6** Faut-il un système de templates personnalisables par type de réunion ? Par exemple : le template "Déjeuner d'affaires" insère toujours la mention Art. 39-1 CGI avec la justification standard d'ISSA Capital, tandis que le template "Réunion interne" peut être moins formel.
*Le brief utilise un seul system prompt. Si tu veux des tonalités différentes selon le type, il faut 4 system prompts (ou un prompt conditionnel).*
a @legal de choisir en ayant la vue d'ensemble et en se mettant a la place de l'administration francaise en cas de controle

**Q4.7** Quel niveau de contrôle veux-tu sur la génération avant publication ? Options : (a) je lis le preview et je publie — pas d'édition possible, (b) je peux modifier les champs texte directement dans la carte preview avant publication, (c) je peux relancer Claude avec des instructions correctives ("rends la section 2 plus concise").
*Option (c) implique de conserver le contexte de la conversation pour que Claude comprenne les corrections — c'est le vrai avantage d'une interface chat vs un simple formulaire.*
Plutot C et peut etre b

## 5. Conformité juridique & fiscale

**Q5.1** As-tu consulté un avocat fiscaliste ou ton expert-comptable pour valider que le format de CR proposé (narratif, mention Art. 39-1, "certifié exact par Thomas Issa") est suffisant en cas de contrôle fiscal sur les charges de représentation ?
*C'est la question la plus importante de ce document. Si la réponse est non, l'outil peut générer des CRs qui ne résisteront pas à un contrôle. Recommandation : validation par un fiscaliste avant mise en production.*
Je compte sur @legal pour confirmer

**Q5.2** Quelle est la durée de conservation légale que tu veux appliquer à ces CRs ? (La durée légale pour les pièces justificatives de charges est 10 ans en droit fiscal français.) Le stockage est géré par Craft — as-tu une politique de conservation dans Craft ?
*Si Craft ne garantit pas la conservation 10 ans, il faut prévoir un export/archivage parallèle.*
Je pourrais teelcharger de craft si besoin

**Q5.3** La mention "Établi et certifié exact par Thomas Issa, Président — ISSA Capital" est-elle suffisante comme preuve d'authenticité, ou as-tu besoin d'une signature électronique qualifiée (eIDAS niveau avancé ou qualifié) ?
*La signature qualifiée implique un outil tiers (DocuSign, YouSign, etc.) et une intégration supplémentaire. Elle est rarement nécessaire pour des charges de représentation ordinaires — mais à confirmer avec ton fiscaliste.*
Puis je fournir ma signature a apposer ? Autrement que @legal confirme ce quil y a de mieux

**Q5.4** L'horodatage du CR (date de publication) — un timestamp serveur Replit est-il suffisant, ou as-tu besoin d'un horodatage qualifié (RFC 3161, service de tiers de confiance) ?
*L'horodatage qualifié est très rare pour ce type de document interne. Mais si un litige ou un contrôle fiscal approfondi est envisageable, c'est une protection.*
Pareil @legal doit choisir, le plus le mieux si pas trop contraignant

**Q5.5** Les participants nommés dans les CRs sont-ils tous des interlocuteurs professionnels (personnes morales / représentants de sociétés), ou y a-t-il des particuliers dont les données personnelles seraient stockées dans Craft ?
*Si des particuliers sont nommés : obligation RGPD (base légale, durée de conservation, droit à l'effacement). Si uniquement des représentants de sociétés dans un contexte professionnel : régime allégé.*
normalment professionnels only

**Q5.6** As-tu besoin d'un registre de traitement RGPD pour cette application ? (Obligatoire si tu traites des données personnelles de manière régulière, même en usage solo.) L'application back office d'une SAS tombe sous le RGPD même si elle n'est pas publique.
*Si oui : @legal peut produire la fiche de traitement correspondante en 30 min.*
Ok faisons

## 6. Intégration Craft

**Q6.1** Dans quel document Craft les CRs doivent-ils être publiés ? Options : (a) un document unique "Comptes Rendus ISSA Capital" avec un bloc par CR (liste chronologique), (b) un document par CR (un nouveau document créé pour chaque CR), (c) une page parent "CRs" avec des sous-pages par CR, (d) un document par mois ou par trimestre.
*Le choix impacte directement l'endpoint utilisé (`/blocks` vs création de document) et l'organisation dans Craft.*
Idéalement un dossier dédié, avec un sous dossier peut etre par année ? Puis un CR = un document

**Q6.2** As-tu des tags ou labels Craft que tu veux appliquer automatiquement aux CRs publiés ? (ex : tag "ISSA Capital", tag par type de réunion, tag "CONFIDENTIEL")
*Si Craft supporte les tags via API, c'est trivial à ajouter dans le payload. Sinon on laisse le classement à la structure de document.*
A @moi de choisir

**Q6.3** La sidebar de l'app affiche la liste des CRs publiés. Cette liste vient de l'API Craft (`GET /api/craft/documents`). Si tu publies un CR depuis Craft directement (sans passer par l'app), apparaîtra-t-il dans la sidebar ?
*Selon la réponse, l'architecture de la sidebar change : (a) source de vérité = Craft API (tout est visible), (b) source de vérité = state local de l'app (seuls les CRs créés via l'app sont listés).*
Seul claude pourrra publier les CR

**Q6.4** Si Craft est inaccessible au moment où tu veux publier, que doit faire l'app ? Options : (a) afficher l'erreur et attendre que tu réessaies manuellement, (b) mettre le CR en file d'attente et réessayer automatiquement toutes les X minutes, (c) sauvegarder le CR en local (fichier ou base de données) pour publication ultérieure.
*Option (b) ou (c) impliquent une persistance locale — complexité supplémentaire mais fiabilité maximale.*
b ou c

**Q6.5** As-tu accès à la documentation officielle complète de l'API Craft (au-delà de l'endpoint `/blocks`) ? En particulier : y a-t-il une limite de taille pour un bloc, un rate limit documenté, et un format Markdown spécifique à Craft ?
*Le brief suppose que le Markdown standard fonctionne. Mais les tables Markdown ne sont pas supportées par toutes les implémentations Craft. À tester sur un vrai document avant de coder.*
La ovici : https://support.craft.do/en/integrate/api

**Q6.6** Faut-il un lien depuis Craft vers l'application (pour retrouver le contexte de la conversation qui a généré le CR) ? Ou le CR dans Craft est-il autosuffisant ?
*Si oui : le bloc Craft contiendrait un lien retour type `https://monapp.replit.app/?cr=IC-CR-2026-0001`. Utile si tu veux relire la conversation de génération plus tard.*
Auto suffisant

## 7. Multi-entités — anticipation architecture

**Q7.1** Le brief cite Gradient One (GO) et Versi Développement (VD) comme futures entités dans l'objet `ENTITIES`. Y a-t-il d'autres entités à anticiper ? (ex : Immocrew, Versimo, immobilier en direct, la holding personnelle de Jean-Pierre ?)
*Permet de dimensionner la structure `ENTITIES` dès la V1 sans refactoring.*
On part sur : 
1) ISSA Capital
2) Gradient One
3) Versi Immobilier
4) Versi Invest

**Q7.2** Chaque entité a-t-elle son propre espace Craft (workspace ou document racine différent), ou toutes les entités publient dans le même workspace Craft avec juste des dossiers distincts ?
*Si workspaces séparés : chaque entité aura sa propre `craftBase` et `craftKey` dans l'objet `ENTITIES`. Si même workspace : structure de dossier uniquement, une seule clé API.*
On va dissocier en 2 : 
Issa Capital = 1 workspace
Le reste = 1 autre worskpace

**Q7.3** Pour les entités futures, le format de référence est-il le même — `GO-CR-2026-0001`, `VD-CR-2026-0001` — ou chaque entité a-t-elle sa propre logique de numérotation ?
*Permet de coder le générateur de référence de manière générique dès V1.*
Oui le même

**Q7.4** Quand les entités multiples seront activées, l'interface aura-t-elle un sélecteur d'entité (dropdown dans la topbar) ou des instances séparées de l'application ?
*Le sélecteur est plus élégant mais plus complexe à gérer côté state. Des instances séparées (URLs différentes) sont plus simples.*
le plus important est que ce soit gerable par message facilement

**Q7.5** Gradient One est présenté dans `project-context.md` comme une holding intermédiaire détenue à 50% par ISSA Capital. Les CRs Gradient One seront-ils des CRs de réunions ISSA Capital avec Gradient One, ou des CRs de réunions internes à Gradient One ?
*La distinction change le contenu du system prompt et la mention "Établi par" dans le template Markdown.*
Plutot des CRs de réunions internes à Gradient One 

## 8. Sécurité & confidentialité

**Q8.1** L'application sera déployée sur Replit avec une URL publique (type `secretariat-issa.replit.app`). Est-ce acceptable que cette URL soit techniquement accessible à quiconque la connaît, ou veux-tu une protection minimale d'accès ?
*Options : (a) aucune protection — l'URL est obscure et ça suffit (sécurité par obscurité), (b) basic auth (login/mot de passe HTTP simple — 15 min à implémenter), (c) token Bearer passé dans l'URL (`?token=xxxx`), (d) domaine custom avec accès restreint par IP si tu as une IP fixe.*
*Rappel : l'application contiendra des noms de personnes, des détails financiers, et des informations stratégiques confidentielles. Si quelqu'un trouve l'URL, tout est lisible.*
Je veux quelle soit en back office de issa-capital.com (par exemple issa-capital.com/admin avec un mot de passe allezpsg  => a noter que le chat sera linterface principale

**Q8.2** Si une assistante ou un tiers doit accéder à l'application dans le futur, par quel mécanisme leur donnes-tu l'accès ?
*Si tu restes solo, la question ne se pose pas. Mais si tu délègues un jour, l'absence de système d'accès devient un blocage.*
Rajouter dans le chat ou donner numéro de telephone ?

**Q8.3** Faut-il logger les générations (quel prompt a été envoyé à Claude, quelle réponse a été reçue, quel CR a été publié) ? Si oui, ce log doit être stocké où et pendant combien de temps ?
*Utile pour debug et audit trail. Mais les logs contiennent des données confidentielles — leur stockage doit être sécurisé.*
tu decides

**Q8.4** En cas de fuite de la clé `CRAFT_IC_KEY`, quelle est l'exposition maximale ? Quelqu'un peut-il lire tous tes documents Craft, écrire dessus, les supprimer ?
*Évaluer le risque pour décider si une rotation régulière des clés est nécessaire, et si l'app doit afficher un indicateur de dernier changement de clé.*
c'est pas grave

**Q8.5** Les CRs générés par Claude mais non publiés (brouillons dans l'interface) — sont-ils stockés quelque part côté serveur ? Ou uniquement en mémoire dans la session du navigateur ?
*Si côté serveur : données confidentielles à sécuriser. Si uniquement en mémoire navigateur : pas de risque serveur, mais perte en cas de refresh.*
coté serveur replit

## 9. Données & state management

**Q9.1** Le compteur de référence (`IC-CR-2026-0001 → 0002...`) est le numéro unique de chaque CR. Si Replit redémarre (ce qui arrive), le compteur en mémoire repart à 0 et le prochain CR pourrait recevoir un numéro déjà utilisé. Comment veux-tu gérer ça ? Options : (a) fichier JSON local sur Replit (simple, risque de corruption), (b) variable d'environnement Replit mise à jour (lourd), (c) le numéro séquentiel est déduit du nombre de documents existants dans Craft (source de vérité externe), (d) laisser l'utilisateur saisir manuellement le numéro du prochain CR.
*C'est le seul choix d'architecture vraiment irréversible si on a déjà publié 50 CRs.*
Evidemment quon continue a incrementer ! on fait ce quil y a de mieux pour qu'il y ait 0 probleme

**Q9.2** La sidebar affiche les CRs publiés. Si tu as 100 CRs dans Craft, comment veux-tu qu'ils soient chargés ? Options : (a) tout charger au démarrage (simple, lent si beaucoup), (b) pagination (10 par page), (c) les 20 plus récents uniquement.
*Avec 1-2 CRs/semaine, 100 CRs = 1 an d'usage. Calibrer selon tes prévisions.*
Pagination

**Q9.3** L'historique de la conversation chat (les messages échangés avec l'IA pour générer un CR) est-il utile à conserver après publication ? Options : (a) non — dès que le CR est publié, la session se réinitialise pour un nouveau CR, (b) oui — je veux pouvoir relire le contexte de la conversation pour chaque CR publié.
*Option (b) implique de stocker les conversations (données confidentielles) côté serveur ou dans Craft.*
plutot b

**Q9.4** Si tu travailles sur un CR et que tu cliques sur "Nouveau CR" dans la sidebar sans avoir publié, que doit-il se passer ? Options : (a) réinitialisation immédiate sans avertissement, (b) popup de confirmation "Vous avez un brouillon non publié — continuer ?", (c) le brouillon est auto-sauvegardé dans la sidebar avec un badge "brouillon".
*Option (c) implique un système de gestion de brouillons.*
brouillon 

**Q9.5** La liste des CRs dans la sidebar doit-elle distinguer les CRs publiés depuis l'app de ceux qui existent déjà dans Craft (créés autrement) ? Ou tous les documents Craft sont traités de la même façon ?
*Impacte la logique de `GET /api/craft/documents` — doit-on filtrer par tag/dossier ou lister tout ?*
@moi décide

## 10. Déploiement & maintenance

**Q10.1** Veux-tu un domaine custom pour l'application (ex : `cr.issa-capital.com` ou `secretariat.issa-capital.com`) ou l'URL Replit native est suffisante en V1 ?
*Un domaine custom sur Replit est possible avec un DNS CNAME. Donne un aspect plus professionnel mais nécessaire uniquement si d'autres personnes voient l'URL.*
issa-capital.com/admin ? Autrement fait moi une autre proposition

**Q10.2** Replit met les Repls en veille après inactivité (sur les plans gratuits/hacker). La première requête après une période d'inactivité peut prendre 5-15 secondes. Est-ce acceptable, ou as-tu besoin d'une instance Always On ?
*Replit Always On est inclus dans certains plans payants. Alternatives : ping automatique toutes les 10 min via un cron externe gratuit (UptimeRobot). À décider selon l'usage.*
Uptimerobot si pénible a lusage

**Q10.3** Si le modèle Claude change (Sonnet 4 → Sonnet 5 demain), veux-tu être notifié et choisir de mettre à jour manuellement, ou est-ce que l'app peut se mettre à jour automatiquement vers le dernier modèle disponible ?
*Recommandation : spécifier `claude-sonnet-4-20250514` en dur et changer manuellement à chaque upgrade — évite les régressions de qualité du system prompt.*
App mettre a jour automatiquement idéalement

**Q10.4** En cas de bug en production (CR mal généré, publication échouée, compteur cassé), qui gère la maintenance ? Toi directement sur Replit, ou tu veux un runbook simple d'auto-diagnostic ?
*Un runbook (5 étapes de debug) permettrait de gérer 80% des incidents sans expertise technique.*
runbook + moi

**Q10.5** Y a-t-il un monitoring uptime que tu veux mettre en place ? (ex : alerte email ou SMS si l'app est down plus de 5 min)
*UptimeRobot gratuit suffit pour surveiller une URL et alerter par email. Simple à configurer.*
OK pour uptimerobot

## 11. Coûts & budget API

**Q11.1** Combien de CRs par mois prévois-tu de générer en rythme de croisière ? (ex : 2/semaine = ~8/mois ; 1/jour = ~20/mois)
*Base pour calculer le coût mensuel API Anthropic. Avec claude-sonnet-4, un CR = ~2 000 tokens input + 1 500 tokens output ≈ 0,01-0,02$ par CR. À 20 CRs/mois : <0,50$/mois — coût négligeable.*
2 à 4 par semaine ?

**Q11.2** Quel est le budget mensuel maximum acceptable pour l'API Anthropic ?
*La question est plus de principe que de besoin réel — avec l'usage solo prévu, les coûts seront très faibles. Mais une limite permet de détecter un usage anormal (ex : boucle infinie de requêtes).*
evitons les boucles infinies ! sinon pas de soucis

**Q11.3** Faut-il un mécanisme d'alerte si le coût mensuel API dépasse un seuil ? (ex : email automatique si > X€/mois via le dashboard Anthropic ou une vérification mensuelle manuelle)
*Le dashboard Anthropic permet de configurer des alertes directement — probablement suffisant sans code custom.*
oui, à 10€ / mois

**Q11.4** Le plan Replit actuel — tu utilises quel plan (gratuit, Hacker, Pro) ? Le plan impacte les limites de CPU, RAM, et la disponibilité Always On.
*Information nécessaire pour @fullstack pour dimensionner correctement le serveur Express.*
Pro autoscale

## 12. Planning & priorités

**Q12.1** Y a-t-il une réunion ou un événement précis à venir pour lequel tu as besoin du premier CR produit par l'outil ? (ex : "j'ai un déjeuner avec un partenaire la semaine prochaine et je veux tester")
*Permet de cibler la V1 sur le type de réunion le plus urgent.*
non pas forcément

**Q12.2** Veux-tu une phase de test avant l'usage en conditions réelles — par exemple : 3 CRs de test sur des réunions passées, pour valider la qualité du rendu avant de l'utiliser pour de vrais documents fiscaux ?
*Fortement recommandé. Un CR qui ne correspond pas à ton standard de qualité dès le premier usage réel est un problème de confiance dans l'outil.*
1 CR de test

**Q12.3** Qui valide la qualité du premier CR de test ? Toi seul, ou ton expert-comptable ou avocat fiscaliste ?
*Si un tiers doit valider, prévoir ce délai dans l'ordre d'implémentation.*
probablement que moi

**Q12.4** Y a-t-il une contrainte liée au site issa-capital.com en cours de développement — par exemple, ne pas déployer l'agent secrétariat avant que le site principal soit live, pour ne pas surcharger Replit ?
*Les deux sont sur Replit mais sont des Repls distincts — normalement pas de conflit. À confirmer.*
non pas de soucis, mais on le met sur issa-capital

---

## Réponses Thomas (consolidées le 2026-04-08, session 4)

### Questions résiduelles RES1-RES6 (post-62 questions initiales)

**RES1 — Multi-utilisateurs** (réf. Q1.4 + Q8.2 + N5)
- (a) **3 personnes** au total : Thomas Issa, Carl, Maxime
- (b) **Thomas voit TOUT**. Carl et Maxime voient **uniquement Gradient One et les Versi** (Versi Immobilier + Versi Invest + filiales du périmètre Gradient One). **Pas d'accès aux CR ISSA Capital.**
- (c) **Whitelisting numéros WhatsApp via admin page** : OK

**RES2 — Database contacts** (réf. Q4.1)
- **Option (c) acquise** : import initial + saisie au fil de l'eau
- **Action** : préparer un fichier `docs/product/secretariat-contacts-database.md` pré-rempli avec ce qui est connu, Thomas complétera. Ensuite saisie progressive : à chaque nouveau nom rencontré, le bot demande "Qui est X ? Titre ? Société ?" et l'enregistre

**RES3 — Backoffice /admin** (réf. Q10.1)
- URL : `issa-capital.com/admin` (mot de passe : `allezpsg` — à changer en production)
- **4 modules validés** :
  1. Gestion database contacts (CRUD)
  2. Historique CRs publiés (lecture seule + lien Craft)
  3. Logs de génération (lecture seule, accès Thomas uniquement)
  4. Paramètres (whitelist numéros WhatsApp, switch entités, upload signature)

**RES4 — Export PDF** (réf. Q3.6 reformulée)
- **NON, pas besoin**. Pas d'export PDF, ni V1 ni V2. Le CR vit dans Craft, point.

**RES5 — Signature scannée** (réf. Q5.3)
- **OUI**, Thomas uploadera un **PNG transparent** de sa signature
- L'image sera intégrée au bas du CR publié sur Craft (markdown image embed)
- En attendant l'upload, fallback texte : "Établi et certifié exact par Thomas Issa, Président — ISSA Capital"

**RES6 — Backup parallèle** (réf. Q5.2)
- **Option (a) acquise** : Craft seul = source de vérité. Pas de backup auto. Thomas téléchargera depuis Craft si besoin (export manuel)

### Nouvelles exigences architecture (réponses N1-N8)

- **N1** Une seule plateforme : **WhatsApp uniquement** (pas iMessage)
- **N2** iMessage abandonné (pas d'API publique Apple)
- **N3** Stack : **WhatsApp Cloud API officielle Meta** (gratuit jusqu'à 1000 conversations/mois, vérification numéro pro requise)
- **N4** **Numéro pro dédié WhatsApp** : Thomas en prendra un pour l'agent
- **N5** Multi-utilisateur dès V1 (cf. RES1 : Thomas + Carl + Maxime)
- **N6** Preview CR dans WhatsApp = texte Markdown brut + message "Réponds OK pour publier ou corrige"
- **N7** Publication Craft : appel API en arrière-plan
- **N8** Hébergement : **Replit Pro Autoscale** (Thomas a déjà ce plan)

### Agents délégués pour décisions résiduelles

- **@legal** doit trancher : Q4.2 (formules juridiques), Q4.6 (templates par type), Q5.1 (validation Art. 39-1 + format conforme contrôle fiscal), Q5.2 (durée conservation), Q5.4 (horodatage), Q5.6 (registre RGPD)
- **@moi** doit trancher : Q6.2 (tags Craft), Q9.5 (distinction CRs sidebar)
- **@orchestrator + @ia** : structure logs, gestion brouillons, pagination

---

## Récapitulatif — questions critiques à trancher avant de coder

Ces questions bloquent l'architecture ou sont irréversibles une fois l'implémentation démarrée. Elles doivent recevoir une réponse en priorité absolue.

| # | Question | Section | Pourquoi c'est bloquant |
|---|---|---|---|
| 1 | As-tu validé le format CR avec un fiscaliste ? | Q5.1 | Si non : l'outil peut générer des documents non conformes |
| 2 | Comment stocker le compteur de référence (résistant aux redémarrages Replit) ? | Q9.1 | Choix d'architecture irréversible dès le premier CR publié |
| 3 | Où publier dans Craft : 1 document unique vs 1 document par CR ? | Q6.1 | Détermine l'endpoint et la structure Craft entière |
| 4 | Protection d'accès : aucune / basic auth / token ? | Q8.1 | Document confidentiel exposé sans protection = risque immédiat |
| 5 | Validation humaine systématique avant publication, ou option auto-publish ? | Q4.7 | Détermine le flow UX principal de l'application |

---

## Handoff

---
**Handoff → @fullstack & @ia**
- Fichier produit : `docs/product/secretariat-agent-questions.md`
- Décisions prises : aucune — ce fichier est un formulaire de cadrage. Les décisions découlent des réponses Thomas.
- Points d'attention :
  - L'implémentation NE DOIT PAS démarrer avant que Thomas ait répondu aux questions des sections 5 (fiscale/juridique), 8 (sécurité) et 9 (state management) — ces 3 sections contiennent des choix irréversibles à l'architecture.
  - Section 6 (Craft API) : vérifier la documentation officielle des endpoints `/blocks` avant de coder le module de publication — en particulier le support des tables Markdown et le rate limit.
  - Section 7 (multi-entités) : la structure `ENTITIES` est à implémenter en V1 même si une seule entité est active — Thomas l'a explicitement demandé dans le brief.
  - Section 4 (system prompt) : demander à Thomas un exemple concret de notes brutes (Q4.1) avant d'écrire le system prompt final — un exemple réel vaut toutes les spécifications abstraites.
---
