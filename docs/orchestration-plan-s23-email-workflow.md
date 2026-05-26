# Cadrage — Refonte workflow email d'Anya (S23)

> Demande Thomas : le traitement email n'est pas fonctionnel (brouillons vides « juste Bonjour »). Nouveau comportement voulu, pour CHAQUE email reçu jugé intéressant.

## 1. Comportement cible (verbatim Thomas)

1. **Vérifier si une réponse a déjà été faite** (Thomas a peut-être déjà traité).
   - **Si déjà répondu** : documenter les historiques projet/contact (et autre si pertinent). Si le **contact n'existe pas** → proposer sur Telegram de le créer avec les infos clés ; si Thomas dit **oui**, Anya **scanne la boîte mail** pour retrouver d'autres emails du contact et **construire une fiche riche**. **Pas de brouillon.**
2. **Si pas encore répondu** : idem (documentation + proposition contact + scan boîte), **PLUS** préparer un **brouillon** (laissé dans Gmail) avec ce qu'Anya peut faire/sait à partir du contexte, notamment du contact.

## 2. Bug à corriger d'abord : brouillon vide

`draft-composer.composeDraft` (branché runner:345) appelle `callLLM(task:'email-draft', maxTokens:1024)`. La tâche `email-draft` est sur **DeepSeek V4 Pro**, qui rend un `content` vide/tronqué (même cause que triage 1024 + citation 400 : V4 mange le budget en « réflexion »). → corps quasi vide = « juste Bonjour ».

**Fix (décision §6) :** repasser `email-draft` sur **Sonnet 4.6** (fiable + qualité, faible volume) — V4 Pro a échoué 2× sur de la génération. + garde « corps non vide » (si le LLM rend &lt; N caractères → marquer échec, pas de brouillon « Bonjour » seul) + maxTokens 2048.

## 3. Architecture cible (sur le pipeline existant)

Dans `email-ingest-runner`, pour chaque email retenu (hors spam/newsletter), après triage :

### A. Détection « déjà répondu » (NOUVEAU)
- Nouveau helper `hasThomasReplied(email)` dans `gmail-source` : via `listMessages` chercher dans le **thread** un message envoyé par Thomas (`in:sent` sur le `threadId`, ou label SENT). Stocker `threadId` dans `EmailMessage` (à ajouter — gmail-source le connaît déjà, juste non exposé).
- Résultat `alreadyReplied: boolean` → pilote la suite.

### B. Documentation (existe en partie, à compléter)
- Historique **contact** : déjà fait (handlers → `append_historique` pour contact connu).
- Historique **projet** : déjà ajouté S23 (`coherence-actions`).
- → Conserver ; s'assurer que ça tourne que l'email soit répondu ou non.

### C. Contact inconnu → proposition + scan boîte (NOUVEAU)
- Contact non trouvé → carte Telegram « créer ce contact ? » (réutilise le no-match-card existant + ses 5 boutons type).
- Sur **Oui** : avant d'écrire la fiche, **scanner la boîte** : `listMessages("from:<sender>")` (cap ~20 derniers) → `getMessage`+`extractBodyPlain` → un LLM (Flash, tâche `contact-fiche`) **synthétise les infos clés** (rôle, société, sujets récurrents, coordonnées repérées) → fiche contact enrichie (au lieu d'un stub mono-email).

### D. Brouillon — SEULEMENT si pas répondu (NOUVEAU gating + fix)
- Si `alreadyReplied` → **pas** de brouillon.
- Sinon → `composeDraft` (corrigé §2), brouillon laissé dans Gmail, preview dans la carte Telegram. Le contexte inclut la fiche contact (déjà le cas) — enrichie si on vient de la créer.

## 4. Anti-bruit / validation
- Une carte Telegram par email regroupant : doc auto (silencieux pour contact connu), proposition contact (si inconnu), preview brouillon (si créé). Jamais N cartes.
- Rien si l'email n'est pas actionnable (spam/newsletter) — inchangé.
- Tout écrit vault = via validation (sauf historique contact auto, déjà le cas).

## 5. Modèles
- `email-draft` → **Sonnet 4.6** (fix fiabilité/qualité).
- `contact-fiche` (NOUVELLE tâche, synthèse fiche depuis N emails) → **Flash** (extraction lean).
- triage → Flash (inchangé).

## 6. Décision ouverte (Thomas)
- **Modèle brouillon** : reco = **Sonnet 4.6** (V4 Pro a échoué 2× sur la génération → pas fiable pour un brouillon client). Alternative : garder V4 Pro + maxTokens 2048 + garde non-vide (moins cher, mais risque résiduel). → à trancher.

## 7. Plan d'exécution
1. fullstack : (a) fix `email-draft` (modèle + maxTokens + garde non-vide) ; (b) `hasThomasReplied` + `threadId` exposé ; (c) gating brouillon ; (d) scan-boîte enrichissement contact + tâche `contact-fiche` ; (e) tests mockés.
2. orchestrator : revue + gates + walkthrough ; déploiement ; validation réelle sur emails entrants (R6/R9).
