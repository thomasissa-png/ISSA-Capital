# Phase 1 — Beeper Server headless sur le VPS (ingestion WhatsApp d'Anya)

> Objectif : faire tourner un **Beeper Server headless** sur le VPS (daemon, pas
> d'app GUI) qui tient le lien WhatsApp et expose l'API locale `127.0.0.1:23373`.
> Anya (même VPS) l'interrogera ensuite 4×/jour (Phase 2). Aucune dépendance à
> ton PC ni à une machine maison ; ton iPhone reste ton WhatsApp normal.
>
> ⚠️ À exécuter en SSH sur le VPS (Cowork ou Thomas). Le runtime Anya ne peut pas
> faire cette install (pas de shell via le MCP debug). Commandes vérifiées contre
> la doc Beeper CLI (developers.beeper.com/desktop-api-reference/cli).

## Pré-requis
- Accès SSH au VPS (user `thomas`).
- Node/npm déjà présents (le service `anya` est un Next.js → OK).
- WhatsApp sur l'iPhone (pour scanner le QR une fois).

## Étapes

### 1. Installer le CLI Beeper
```sh
npm install -g beeper-cli
beeper --version   # vérifier
```

### 2. Installer + démarrer le serveur headless
```sh
beeper setup --server --install
# → "Installed Beeper Server (stable)"
# → "Started server on http://127.0.0.1:23373"
```
Cette commande tente d'ouvrir un navigateur pour autoriser le **compte Beeper**
(OAuth). Sur un VPS headless, **pas de navigateur** → 2 options :
- **a)** copier l'URL OAuth affichée dans le terminal et l'ouvrir dans TON
  navigateur local, OU
- **b)** tunnel SSH puis ouvrir en local :
  ```sh
  # depuis TA machine :
  ssh -L 23373:127.0.0.1:23373 thomas@<VPS>
  # puis ouvrir http://127.0.0.1:23373 dans ton navigateur local
  ```

### 3. Lier WhatsApp (QR — une seule fois)
```sh
beeper accounts add
# choisir WhatsApp → "Scan this QR code with WhatsApp on your phone"
```
Sur iPhone : **WhatsApp → Réglages → Appareils connectés → Connecter un appareil**
→ scanner le QR affiché dans le terminal SSH.
> Si le QR ne s'affiche pas en ASCII scannable dans le terminal, utiliser le
> tunnel SSH (étape 2b) et faire le lien via l'UI web `127.0.0.1:23373`.

### 4. Rendre le daemon persistant (survit aux reboots)
```sh
beeper targets enable     # auto-start
beeper targets restart
beeper targets logs        # vérifier qu'il tourne
```

### 5. Vérifier l'API + récupérer le token
```sh
beeper api get /v1/info    # doit répondre OK
# Le token d'accès API est requis par Anya (Phase 2). Le récupérer :
#   variable BEEPER_ACCESS_TOKEN (cf. doc CLI `beeper api`).
```
➡️ **Noter le `BEEPER_ACCESS_TOKEN`** : il sera posé en Secret VPS pour qu'Anya
appelle l'API (comme `GOOGLE_REFRESH_TOKEN` / `TICKTICK_ACCESS_TOKEN`).

## Maintenance
- **Re-lien WhatsApp** : WhatsApp délie parfois les appareils liés (souvent si le
  téléphone reste longtemps offline). Si l'API renvoie « non connecté » → refaire
  l'étape 3 (`beeper accounts add`). Anya le signalera via le health-monitor
  (item à ajouter Phase 2).
- **Logs** : `beeper targets logs`.
- **Statut** : `beeper targets restart` si l'API ne répond plus.

## Ce qui suit (Phase 2 — côté Anya, par l'orchestrator)
1. Adaptateur `beeper-source` (jumeau de `gmail-source`) : lit les nouveaux
   messages via `GET 127.0.0.1:23373/v1/...` (Bearer `BEEPER_ACCESS_TOKEN`),
   curseur « dernier message traité ».
2. Endpoint `cron-whatsapp-ingest` + ligne `deploy/crontab.anya` (4×/jour).
3. Branchement sur le pipeline cohérence existant (triage → historiques
   projets/contacts + TickTick + médias/vocaux + validation Telegram).
4. **Liste blanche de contacts/chats pro** (Phase 3 — « tri une fois la
   connexion établie »).

## Coût / risque
- **Gratuit** (Beeper l'est ; self-host inclus).
- **Risque de ban** : appareil lié non-officiel (bridge Beeper) — faible en
  pratique (même classe que ton Beeper actuel), non nul.
