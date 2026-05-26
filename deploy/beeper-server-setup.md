# Beeper Server sur le VPS — installation pas à pas (copier-coller)

> Pour Thomas. Tout se fait **en SSH sur le VPS**, sauf l'étape 0 (depuis TON
> Mac/PC). Copie-colle chaque bloc **dans l'ordre**, attends le résultat indiqué
> avant de passer au suivant. Commandes vérifiées contre la doc Beeper CLI.
>
> But : faire tourner un Beeper Server (daemon) sur le VPS qui tient le lien
> WhatsApp et expose son API en local. Anya s'en servira ensuite (Phase 2).

---

## ÉTAPE 0 — Se connecter au VPS (depuis TON Mac/PC)

Ouvre un terminal sur ton ordinateur et colle (le `-L` ouvre un tunnel qd'on
utilisera à l'étape 3 pour le navigateur) :

```sh
ssh -L 23373:127.0.0.1:23373 thomas@VPS_IP
```
> Remplace `VPS_IP` par l'adresse de ton VPS. Tu es maintenant **sur le VPS** :
> toutes les étapes suivantes se collent dans CE terminal.

---

## ÉTAPE 1 — Installer le CLI Beeper

```sh
npm install -g beeper-cli
```
```sh
beeper --version
```
→ tu dois voir un numéro de version (ex. `1.x.x`).

---

## ÉTAPE 2 — Installer et démarrer le serveur

```sh
beeper setup --server --install
```
→ tu dois voir : `Installed Beeper Server (stable)` puis
`Started server on http://127.0.0.1:23373`.

Il va te demander d'**autoriser ton compte Beeper** et afficher une **URL**
(`https://...`). Garde-la pour l'étape 3.

---

## ÉTAPE 3 — Autoriser ton compte Beeper (navigateur)

Grâce au tunnel de l'étape 0, ouvre sur **TON** ordinateur l'URL affichée à
l'étape 2 (ou, si on te donne une adresse locale, ouvre directement) :

```
http://127.0.0.1:23373
```
→ connecte-toi à ton compte Beeper et valide l'autorisation. Reviens au terminal.

---

## ÉTAPE 4 — Lier WhatsApp (QR, une seule fois)

```sh
beeper accounts add
```
→ choisis **WhatsApp** dans la liste. Un **QR code** s'affiche dans le terminal.

Sur ton **iPhone** : **WhatsApp → Réglages → Appareils connectés → Connecter un
appareil** → scanne le QR du terminal.

→ tu dois voir une confirmation type `WhatsApp connected` / le compte listé.
> Si le QR ne s'affiche pas correctement dans le terminal, dis-le moi : on passe
> par l'interface web `http://127.0.0.1:23373` (via le tunnel de l'étape 0).

---

## ÉTAPE 5 — Rendre le serveur permanent (survit aux reboots)

```sh
beeper targets enable
```
```sh
beeper targets restart
```
```sh
beeper targets logs
```
→ les logs doivent montrer le serveur qui tourne, sans erreur.

---

## ÉTAPE 6 — Vérifier que l'API répond

```sh
beeper api get /v1/info
```
→ tu dois recevoir une réponse JSON (infos du serveur). **Si oui : c'est gagné.**

---

## ÉTAPE 7 — Récupérer le token pour Anya

```sh
beeper api get /v1/info
```
> Le **token d'accès API** (`BEEPER_ACCESS_TOKEN`) sert à Anya pour lire WhatsApp.
> Récupère-le (cf. `beeper api` / variable `BEEPER_ACCESS_TOKEN`) et **pose-le en
> Secret VPS** sous le nom `BEEPER_ACCESS_TOKEN` (comme `GOOGLE_REFRESH_TOKEN`).
> Si tu n'es pas sûr de comment l'obtenir, copie-moi la sortie de
> `beeper api get /v1/info` et je te dis exactement quoi récupérer.

---

## C'est fini pour toi 🎉
Dis-moi simplement :
1. ✅ `beeper api get /v1/info` répond,
2. ✅ `BEEPER_ACCESS_TOKEN` posé en Secret VPS.

→ J'enchaîne la **Phase 2** côté Anya (lecture WhatsApp 4×/jour → historiques +
TickTick + médias/vocaux + validation Telegram), puis **Phase 3** (tri des
contacts pro).

---

## En cas de souci plus tard
- **WhatsApp s'est délié** (Anya ne lit plus) → refaire l'**ÉTAPE 4**
  (`beeper accounts add`). C'est la seule maintenance récurrente (rare).
- **Voir les logs** : `beeper targets logs`.
- **Redémarrer** : `beeper targets restart`.
