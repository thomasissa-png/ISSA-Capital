# Cadrage — Email-ingest cohérent + hot-context événementiel (S23)

> Statut : **PROPOSITION à valider par Thomas**. Une seule architecture. Décisions ouvertes isolées en §6.
> Origine : retour Thomas S23 — « hot-context pas un cron : si on traite un email et qu'une info clé est là, on modifie hot-context » + « email → on met à jour l'historique projet si besoin, on copie les pièces jointes si besoin, de manière cohérente, pas de bruit ».

---

## 1. Principe directeur

Quand Anya **traite un email**, elle exécute — **selon pertinence, sans bruit** — toutes les mises à jour de fiches qui en découlent, dans le MÊME flux (pas de scan séparé, pas de cron). Tout converge sur le pipeline email-ingest existant.

---

## 2. Existant (à réutiliser, ne pas réinventer)

- **Pipeline** : `email-ingest-runner` → triage (DeepSeek V4 Pro) → handlers → `ActionProposal[]` → `autoExecute` (silencieux) OU pending Telegram (validation) → `executeAction`.
- **`ActionProposal`** (handlers/types.ts) : point d'extension. `autoExecute=true` = exécution silencieuse (déjà utilisé pour l'historique contact d'un expéditeur connu, décision Thomas S18.5).
- **Contact** : enrichissement historique + `date_dernière_interaction` déjà fait (auto pour contact connu).
- **PJ** : `gmail-source` extrait déjà les **métadonnées** des pièces jointes (`EmailAttachment` : filename, mimeType, `attachmentId`) — mais ne les **télécharge pas** encore.
- **Hot-context** : machinerie complète déjà écrite (`detectSignal` → `applyPatchToDrive`, idempotence `buildSignalId`, validation Telegram `hotcontext:` TTL 7j). Seul le **déclencheur cron** (S19) est à abandonner.
- **Détection projet** : `detectProjectFromEvent` (event-mapper S23) + `findProjetFicheByEntite` (vault-reader) + `appendToHistorique`.

---

## 3. Architecture cible — le flux email enrichi

Pour chaque email traité (après triage), Anya propose/exécute (selon pertinence) :

### A. Historique CONTACT (✅ existe)
Inchangé : expéditeur connu → append historique + `date_dernière_interaction` (autoExecute silencieux).

### B. Historique PROJET (NOUVEAU)
- Détecter le projet via le **triage** (ajouter un champ `projet?` à la sortie triage — PAS d'appel LLM supplémentaire) OU via match titre/objet contre les noms canoniques (réutilise la logique alias S23).
- **1 projet clair** → `append_projet_historique` (`findProjetFicheByEntite` + `appendToHistorique` sur `02. Projets/02. Pro/<Projet>.md`). Ligne : `<date> — Email : <objet> (de <expéditeur>)`.
- **0 ou ambigu** → rien (pas de bruit). Jamais de création de fiche projet.

### C. Pièces jointes (NOUVEAU)
- Nouveau type d'action `copy_attachment` : télécharge la PJ (via `attachmentId` Gmail) → upload Drive.
- **Filtre anti-bruit** : seulement (a) catégories pertinentes (locataire / contact-pro / administratif — PAS spam/newsletter/marketing), ET (b) types utiles (PDF, DOCX, images réelles — pas les pixels de tracking / signatures inline < seuil Ko).
- **Destination** : voir §6 (décision Thomas).

### D. Hot-context (NOUVEAU — événementiel, remplace le cron)
- Sur le texte de l'email : `detectSignal` (DeepSeek V4 Pro, tâche `hot-context-detect` déjà routée) + pré-filtre heuristique amont.
- Signal détecté → `update_hot_context` → carte Telegram de validation (`hotcontext:` existant, TTL 7j) → `applyPatchToDrive` sur clic. **Toujours validé** (modifie le briefing).
- Idempotence par `buildSignalId` (existant) → pas de doublon si le même email repasse.

### E. Brouillon réponse (✅ existe)
Inchangé (DeepSeek V4 Pro, `draft-email`), jamais d'envoi auto (règle 11).

---

## 4. Anti-bruit & validation (exigence Thomas « pas de bruit »)

- **Une seule carte Telegram par email** regroupant toutes les actions proposées (non-auto). Jamais N cartes.
- **autoExecute (silencieux)** : historique contact (existant) + historique projet si **match unique certain** + copie PJ si **clairement pertinente** (ex. facture d'un contact connu).
- **Toujours validé** : hot-context (modifie le briefing), création de fiche, actions ambiguës.
- **Rien du tout** si l'email n'a pas d'info actionnable (spam, newsletter) — comportement actuel conservé.

---

## 5. Abandon du cron hot-context

- Supprimer définitivement l'endpoint `api/secretariat/hot-context/cron-scan` + le rôle « scanner périodique » de `hot-context/scanner.ts` (le cron est déjà commenté dans `deploy/crontab.anya` → le retirer pour de bon).
- **Conserver** : `detectSignal`, `applier`, `signal-detector`, validation Telegram — désormais invoqués **inline** depuis email-ingest (et extensible à l'inbox/CR plus tard).
- Bénéfice : zéro scan à vide, mise à jour au moment exact où l'info arrive, cohérent avec « pas de bruit ».

---

## 6. Décisions VERROUILLÉES (Thomas, S23)

- **PJ — destination CONTEXTUELLE, rattachée à un SUJET SUIVI uniquement** : projet détecté → sous-dossier `Documents/` du projet ; sinon dossier du **contact/locataire** concerné ; **sinon (aucun sujet suivi) → on ne classe PAS** (pas de dépotoir inbox). Sous-dossier Drive exact confirmé contre `_README` vault par l'orchestrator (R1/R11 : sous-agent sans MCP).
- **PJ — filtre strict anti-clutter (verbatim Thomas : « attention à pas sauver tout et n'importe quoi »)** : on ne copie QUE les pièces **qui valent d'être gardées / qui enrichissent un sujet suivi** (projet, dossier locataire, doc administratif : facture, contrat, bail, état des lieux…). **Jugement par le triage LLM** (il lit déjà l'email — pas d'appel en plus) : il flague les PJ à garder + le sujet rattaché. Par défaut, dans le doute → **on ne copie pas**. Exclure : signatures inline, pixels de tracking, images < ~15 Ko, PJ de newsletters/marketing/spam.
- **PJ — validation** : copie **PROPOSÉE dans la carte Telegram** (Thomas valide), pas en silencieux — cohérent avec « pas n'importe quoi » (on garde le contrôle sur ce qui se classe dans le vault).
- **Historique projet** : silencieux si match unique certain (comme l'historique contact). Hot-context : toujours validé.

---

## 7. Plan d'exécution (post-validation)

1. **fullstack** : (a) étendre triage output `projet?` ; (b) `ActionType` += `append_projet_historique` | `copy_attachment` | `update_hot_context` + exécuteurs (runner + callback-handler) ; (c) `projet-enricher` réutilisé ; (d) download PJ Gmail (`attachmentId`) + upload Drive ; (e) brancher `detectSignal` inline ; (f) supprimer cron-scan + scanner périodique ; (g) tests mockés.
2. **orchestrator** : revue + run subset + walkthrough 3-5 scénarios (R9) + validation visuelle Obsidian 1 email réel (R6) avant batch.
3. **PR → merge `main`** → auto-deploy → vérifier `journal_anya` (enrichissements + 0 erreur, pas de bruit Telegram).

NB : tout reste **idempotent** (email marqué `Anya/traité` une fois) et **validé** (sauf les autoExecute sûrs). Modèles inchangés (V4 Pro déjà en place).
