# Cadrage — Skill « Brief du matin » (S23)

> Statut : décisions VERROUILLÉES (Thomas S23). Skill **bot Anya** (cron + Telegram).
> Demande Thomas : « qu'Anya m'envoie à 7h un petit message tous les jours avec les éléments TickTick, une citation du jour, et ce qui peut être utile pour débuter la journée ».

## 1. Déclencheur
Cron quotidien **7h heure de Paris** (DST-aware via `CRON_TZ=Europe/Paris` dans `deploy/crontab.anya`). Nouvel endpoint `GET /api/secretariat/cron-morning-brief` (auth `CRON_SECRET`, pattern aligné sur les autres crons).

## 2. Contenu du message (un seul message Telegram à Thomas)
1. **📋 TickTick** — tâches **dues aujourd'hui + en retard**. Réutilise la connexion TickTick existante (`ticktick-client`, déjà utilisé par le miroir/poll). Groupées par projet, triées par échéance. Déterministe (0 LLM).
2. **🗓️ Agenda du jour** — réunions Google Calendar du jour (heure + titre + participants). Réutilise `calendar-ingest/calendar-source` (fenêtre = aujourd'hui). Déterministe (0 LLM).
3. **💬 Citation du jour** — tirée d'une **fiche de lecture / learning de Thomas** :
   - Source : ses fiches `[Livre] …md` sous `02. Projets/01. Perso/Skills/<domaine>/Fiches de lecture/` (vraies fiches ; le dossier `Notes/Learnings/` ne contient que des stubs de redirection — R1, vérifié S23).
   - Sélection : rotation déterministe par jour (ex. day-of-year % N) → 1 fiche.
   - Rendu : **Flash distille 1 citation/insight** (1-2 lignes) depuis la fiche + mentionne le livre source. Coût ~0 €.
4. Format court, lisible, emojis légers. Si une section est vide (0 tâche / 0 réunion), ligne sobre (« rien aujourd'hui »).

## 3. Modèle
- Citation : DeepSeek V4 **Flash** (extraction/distillation lean — cohérent avec le routage classement→Flash S23).
- TickTick + agenda : déterministe, aucun LLM.

## 4. Anti-bruit / robustesse
- **Un seul message/jour**. Jamais de carte de validation (c'est un push informatif, pas une action sur le vault).
- Chaque section en `try/catch` indépendant : si TickTick OU calendar OU citation échoue, le brief part quand même avec les sections disponibles (jamais de brief manqué pour une source down). Erreurs loggées.
- Idempotence : 1 run/jour par le cron ; pas d'état à persister (lecture seule + envoi).

## 5. Source live, jamais de hardcoded (R7)
Tâches (TickTick API), agenda (Calendar API), citation (vault live). Aucune copie statique.

## 6. Livrables
- **Code (repo)** : endpoint cron + module `morning-brief/` (collecte TickTick + calendar + citation, formatage, envoi Telegram) + ligne `deploy/crontab.anya` (`CRON_TZ=Europe/Paris` + `0 7 * * *`) + tests mockés.
- **Vault (orchestrator)** : `08. Outils/Skills/brief-du-matin/SKILL.md` + `08. Outils/Workflows/Workflow Brief du matin.md` (format 5 sections), alignés (pas de drift), créés après lecture des `_README`/gabarit. Validation visuelle Thomas (R6).

## 7. Plan
1. fullstack : code + tests (R11 : pas de MCP, tests mockés ; la citation lit le vault via Drive REST au runtime — fonction de recherche Drive `files.list q=...` à ajouter si besoin).
2. orchestrator : revue + gates + walkthrough ; crée les 2 fiches vault ; confirme l'envoi réel (1er brief) avec Thomas.
3. PR → merge `main` → cron actif <5 min. **À configurer** : `TELEGRAM_CHAT_ID_THOMAS` (déjà présent), aucune nouvelle clé.
