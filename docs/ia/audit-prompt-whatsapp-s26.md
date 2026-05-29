# Audit prompt système — extractChat WhatsApp (S26)

**Date** : 2026-05-29
**Auteur** : @ia
**Cible** : `src/lib/secretariat/whatsapp-ingest/whatsapp-ingest-runner.ts:256-268`
**Modèle** : DeepSeek V4 Flash (inchangé, validé S22) — `task: 'email-triage'`, `maxTokens: 600`, `responseFormat: 'json'`
**Contrat technique** : strictement préservé (cf. parsing ligne 283-301).

---

## A. Reproches concrets sur le prompt actuel

### A.1 Identité réductrice : « secrétariat IA »

Le prompt commence par « Tu es Anya, secrétariat IA de Thomas Issa (ISSA Capital — patrimoine, immobilier, business) ».

- **Problème** : « secrétariat IA » suggère un périmètre étroit (admin, RDV pro). Anya est en réalité **l'assistante personnelle de Thomas** sur TOUS ses sujets — ISSA Capital + Sarani Studio + Versi + famille + amis + perso + santé + voyages.
- **Conséquence prompt** : le LLM se cale sur le périmètre annoncé et écarte implicitement tout ce qui n'est pas business. Combiné à l'instruction explicite suivante, c'est la double peine.

### A.2 Anti-perso explicite : « Ignore le bavardage perso/famille/amical pur »

C'est la **cause racine du Bug #2 S26** (Thomas, 28/05 : « manque beaucoup de fiches contact »).

- **Problème** : le LLM marque `relevant: false` sur toute conv perso (famille, amis, voyages, santé) → fiche contact perso jamais enrichie au fil de l'eau, et **avant PR #70** la carte no-match n'était même pas envoyée (donc base contacts perso jamais construite).
- **PR #70 a découplé** la carte no-match du gate `relevant` côté runner (cf. ligne 492-500 + tests S26). Mais le prompt continue de pousser le LLM vers `relevant: false` sur tout le perso → **on enrichit toujours zéro fiche perso** (l'enrichissement vault contact + projet reste sous `if (ex.relevant)` ligne 506).
- **Conséquence** : Thomas reçoit la carte « contact inconnu » (correctif PR #70) mais une fois le contact lié, la conv suivante avec ce contact perso reste `relevant: false` → fiche jamais enrichie d'historique → la fiche perso se vide alors que la fiche pro de Jean s'épaissit.
- **Verbatim Thomas (preferences)** : « un contact reste un contact, une note reste une note ». Refus dichotomie pro/perso.

### A.3 Mission floue : « détermine ce qui mérite d'être consigné/agi »

- **Problème** : « mérite » est subjectif. Le LLM n'a aucun critère opérationnel pour trancher.
- **Conséquence** : variance forte selon le run, dépendance au jugement implicite du modèle, pas de garantie de comportement.
- **Manque** : la spec de chaque champ (`relevant`, `summary`, `todos`, `emailToPrepare`) n'est pas reliée à un effet concret côté runner. Le LLM ignore que `relevant: true` déclenche un append vault et que `todos: [...]` notifie Thomas sur Telegram.

---

## B. Mission Anya réécrite

Anya est **l'assistante personnelle IA de Thomas Issa**. Elle couvre TOUS ses sujets, sans dichotomie pro/perso : ISSA Capital (patrimoine), Sarani Studio (immobilier opéré), Versi (Immobilier / Invest / Versimo) et Gradient One / Immocrew côté business ; famille, amis, santé, voyages, organisation perso côté vie privée. Un contact perso vaut une fiche au même titre qu'un contact pro ; une note perso vaut une note. Sa boussole : **enrichir le vault Obsidian de Thomas** (fiches Contact, fiches Projet, historiques) pour que rien ne se perde — et n'alerter Thomas que quand une action concrète l'exige.

Sur WhatsApp en particulier, Anya lit les conversations **en silence** et, pour chaque conv : (1) décide si elle contient une info à inscrire dans le vault (fait, décision, demande, contexte utile pour plus tard — pro OU perso) ; (2) rattache cette info au bon contact connu si applicable ; (3) rattache à un projet ISSA si pertinent ; (4) liste les actions concrètes que **Thomas** doit faire ; (5) prépare un brouillon d'email Gmail uniquement si la conv appelle clairement un envoi de Thomas. Telegram n'est utilisé que pour les todos et les brouillons préparés — jamais pour du bruit informatif.

---

## C. Nouvelle définition de `relevant` (post PR #70)

`relevant` ne décide **plus** de l'envoi de la carte no-match (gérée côté runner pour tout DM inconnu). Sa sémantique unique est : **« faut-il enrichir l'historique du vault avec cette conv ? »**

### `relevant: true` quand la conv contient une info à conserver dans le vault

Critère : l'info serait utile à retrouver dans 3 mois en cherchant le contact ou le projet. Peu importe le registre (pro / perso / famille / santé / voyage / orga).

Exemples (pro ET perso) :
- Pro — Jean confirme le RDV de mardi 10h pour signer le compromis Versi Immobilier.
- Pro — Le notaire annonce que l'acte est repoussé d'une semaine.
- Perso — Maman dit qu'elle vient déjeuner dimanche et apporte le dossier passeport.
- Perso — Un ami recommande un médecin (nom + ville) pour le suivi cardio.
- Perso — Le voyagiste confirme les dates et le numéro de réservation du séjour Bali.
- Perso — Une connaissance demande un service précis (mise en relation, conseil patrimoine).

### `relevant: false` quand la conv n'apporte aucune info à conserver

Critère : pure salutation, échange logistique ultra-court sans contenu (« ok », « 👍 », « à demain »), bavardage sans fait/décision/demande.

Exemples (pro ET perso) :
- « Salut ça va ? — Oui et toi ? »
- « Ok ! » seul, sans contexte exploitable côté Anya.
- « 👍 » / réactions emoji seules.
- Conversation chargée mais entièrement passée (pas d'info actionnable ni à mémoriser, ex : débat sportif).

> Règle de tie-breaker en cas de doute : **préférer `true`**. Le coût d'un append vault inutile << coût d'une info perso perdue (le Bug #2 vient du biais inverse).

---

## D. Nouveau prompt (verbatim, prêt à copier)

Le prompt suivant remplace les lignes 256-268. Il préserve **strictement** le contrat JSON parsé ligne 283-301 (mêmes clés, mêmes types, mêmes red lines email).

```
Tu es Anya, l'assistante personnelle IA de Thomas Issa. Tu l'aides sur TOUS ses sujets, sans séparer pro et perso : ISSA Capital (patrimoine), Sarani Studio, Versi (Immobilier / Invest / Versimo), Gradient One, Immocrew — ET sa vie perso (famille, amis, santé, voyages, organisation). Un contact perso vaut une fiche au même titre qu'un contact pro.

On te donne les messages WhatsApp récents d'UNE conversation, la liste des contacts connus de Thomas (avec email + alias) et les codes projet ISSA. Ta mission : extraire ce qui doit être inscrit dans le vault Obsidian de Thomas, rattaché au bon contact / projet, et lister les actions concrètes que Thomas doit faire.

Réponds en JSON STRICT, exactement ces clés :
{"relevant": bool, "summary": "1-2 phrases FR", "contactEmail": "email EXACT depuis la liste fournie ou null", "projet": "code parmi [IC, GO, VI, VV, VM, IM] ou null", "todos": ["actions concrètes pour Thomas"], "emailToPrepare": {"to":"email","subject":"objet","intent":"ce que l'email doit dire"} ou null}

Règles par champ :
- relevant = true si la conv contient une info utile à conserver dans le vault (fait, décision, demande, contexte utile dans 3 mois) — pro OU perso, peu importe le registre. relevant = false UNIQUEMENT si la conv est une pure salutation, un "ok"/"👍" seul, ou un bavardage sans aucun fait/décision/demande. En cas de doute, mets true.
- summary = 1-2 phrases factuelles en français qui résument l'info à conserver. Vide si relevant = false.
- contactEmail = un email EXACT pris dans la liste des contacts connus si la conv concerne clairement CE contact. Sinon null. N'INVENTE JAMAIS d'email.
- projet = un code parmi [IC, GO, VI, VV, VM, IM] si un projet ISSA est clairement concerné. Sinon null. Codes : IC = ISSA Capital, GO = Gradient One, VI = Versi Immobilier, VV = Versi Invest, VM = Versimo, IM = Immocrew.
- todos = liste d'actions concrètes que THOMAS (pas Anya, pas l'interlocuteur) doit faire. Verbes à l'infinitif, factuel. [] si rien.
- emailToPrepare = uniquement si la conv appelle CLAIREMENT un envoi d'email de la part de Thomas (ex : "Envoie-moi le devis par mail", "Tu peux m'envoyer le PDF ?"). Sinon null. "to" doit être un email présent dans la liste OU explicitement cité dans la conv — JAMAIS inventé.
```

### Diff sémantique vs prompt actuel

| Avant | Après |
|---|---|
| « secrétariat IA » (périmètre pro implicite) | « assistante personnelle IA — pro ET perso » |
| « Ignore le bavardage perso/famille/amical pur » | « relevant = false uniquement sur salutation / ok / bavardage sans fait » |
| « détermine ce qui mérite d'être consigné/agi » (flou) | Spec opérationnelle par champ, reliée aux effets runner |
| Aucune règle anti-faux-positif `relevant` | Tie-breaker explicite : en cas de doute, true |
| `emailToPrepare` sans déclencheur clair | Déclencheur explicite : la conv DOIT appeler un envoi de Thomas |

### Contrat technique — vérification de compatibilité

- Clés JSON : `relevant`, `summary`, `contactEmail`, `projet`, `todos`, `emailToPrepare` — identiques.
- Types : `bool`, `string`, `string|null`, `enum|null`, `string[]`, `object|null` — identiques.
- Codes projet : `IC, GO, VI, VV, VM, IM` — identiques (toujours injectés via `PROJET_CODES.join(', ')`).
- Red line email : préservée mot pour mot (« N'INVENTE JAMAIS d'email »).
- Comportement no-match card : inchangé (géré côté runner, indépendant de `relevant`).

Tests de régression (cf. `whatsapp-ingest-runner.test.ts`) :
- `relevant: false` + numéro inconnu → carte envoyée (S26 fix) : OK, comportement runner inchangé.
- `relevant: true` + `todos: [...]` → Telegram envoyé : OK, contrat préservé.
- `emailToPrepare.to` sans `@` → pas de brouillon : OK, parsing inchangé.
