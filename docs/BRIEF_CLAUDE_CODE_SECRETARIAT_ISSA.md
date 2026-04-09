# Brief Claude Code — Agent Secrétariat ISSA Capital
## Application web de génération et publication de Comptes Rendus professionnels

---

## CONTEXTE MÉTIER

Thomas Issa est Président d'ISSA Capital, société holding familiale française.
Il a besoin d'un outil web permanent pour générer des comptes rendus de réunions
professionnels (déjeuners d'affaires, réunions avec conseils, appels, réunions internes)
et les publier automatiquement dans son espace Craft.

Ces CRs doivent être **défendables devant la DGFiP** en cas de contrôle fiscal,
au standard d'un avocat d'affaires (art. 39-1 CGI).

---

## OBJECTIF

Construire et déployer sur Replit une **application web Node.js/Express** avec :
- Interface chat minimaliste et élégante (HTML/CSS/JS vanilla)
- Génération des CRs via l'API Anthropic (Claude Sonnet)
- Publication automatique dans Craft via l'API Craft
- Zéro framework frontend (pas de React/Vue) — HTML/CSS/JS pur côté client

---

## STACK TECHNIQUE

- **Backend** : Node.js + Express
- **Frontend** : HTML + CSS + JS vanilla (un seul fichier `public/index.html`)
- **APIs** : Anthropic API + Craft API
- **Hébergement** : Replit (le projet existe déjà sur le compte ISSA Capital)
- **Secrets** : stocker les clés dans les Secrets Replit (pas dans le code)

---

## CREDENTIALS & ENDPOINTS

### Anthropic API
- **Clé** : à stocker dans Replit Secrets sous le nom `ANTHROPIC_API_KEY`
- **Modèle** : `claude-sonnet-4-20250514`
- **Endpoint** : `https://api.anthropic.com/v1/messages`
- **Max tokens** : 1500

### Craft API — ISSA Capital
- **Base URL** : `https://connect.craft.do/links/EgdwyOCC09S/api/v1`
- **Clé** : stockée dans `secretariat/.env.local` sous `CRAFT_IC_KEY` (gitignored — voir `secretariat/.env.example` pour le template)
- **Auth header** : `Authorization: Bearer {CRAFT_IC_KEY}`
- **Content-Type** : `application/json`

> Note sécurité session 7 : la valeur en clair de la clé est purgée de ce fichier. Elle reste dans `.env.local` local (gitignored) et dans les Replit Secrets. La clé est toujours valide (décision Thomas session 7 — pas de rotation). L'historique git contient encore la valeur antérieure — à rotate en cas de leak suspect.

---

## STRUCTURE DU PROJET

```
/
├── server.js           ← serveur Express principal
├── package.json
├── .replit
└── public/
    └── index.html      ← toute l'UI (HTML + CSS + JS inline)
```

---

## ARCHITECTURE FONCTIONNELLE

### Flux utilisateur
1. L'utilisateur décrit sa réunion en langage libre dans le chat
2. Le frontend envoie le message à `POST /api/generate`
3. Le backend appelle Claude avec le system prompt fiscal (voir ci-dessous)
4. Claude retourne un JSON structuré du CR
5. Le frontend affiche le CR en aperçu
6. L'utilisateur clique "Publier dans Craft"
7. Le frontend appelle `POST /api/publish`
8. Le backend pousse le document dans Craft via `POST /blocks`
9. Confirmation affichée, CR listé dans la sidebar

### Endpoints backend à créer

#### `GET /api/craft/documents`
- Appelle `GET {CRAFT_BASE}/documents`
- Retourne la liste des documents de l'espace ISSA Capital
- Utilisé au démarrage pour vérifier la connexion et lister les docs cibles

#### `POST /api/generate`
- Body : `{ messages: [...], ref: "IC-CR-2026-0001" }`
- Appelle Claude API avec le system prompt (voir ci-dessous)
- Retourne le JSON du CR parsé

#### `POST /api/publish`
- Body : `{ cr: {...}, ref: "..." }`
- Construit le Markdown du CR (voir format ci-dessous)
- Appelle `POST {CRAFT_BASE}/blocks` pour créer le document dans Craft
- Retourne succès/erreur

---

## SYSTEM PROMPT CLAUDE (à utiliser tel quel dans `/api/generate`)

```
Tu es le secrétariat juridique de Thomas Issa, Président d'ISSA Capital.
Ta mission : transformer des bribes d'informations en comptes rendus professionnels
défendables devant la DGFiP (article 39-1 CGI).

ENTITÉ : ISSA Capital
SIGNATAIRE : Thomas Issa, Président — ISSA Capital

RÈGLES DE RÉDACTION (impératives) :
1. Style narratif, paragraphes rédigés — jamais de bullets minimalistes
2. Établir explicitement le lien entre la réunion et l'intérêt social d'ISSA Capital,
   avec référence à l'article 39-1 CGI pour les charges de représentation
3. Style affirmatif : "il a été décidé que", "les parties ont convenu de" —
   jamais "on a discuté de"
4. Mentionner la qualité professionnelle précise de chaque interlocuteur
5. Combler sobrement les informations manquantes (heure, lieu) :
   "en milieu de journée", "dans les locaux du cabinet"
6. Toujours marquer CONFIDENTIEL et inclure la notice de diffusion restreinte
7. Langue : français juridique formel

RÉPONDS UNIQUEMENT EN JSON VALIDE, structure exacte :
{
  "type": "dejeuner|reunion_conseil|appel|reunion_interne",
  "titre": "titre court et précis de la réunion",
  "date": "date en français complet (ex: 7 avril 2026)",
  "heure": "plage horaire approximative (ex: 12h30 – 14h00)",
  "lieu": "lieu précis ou approximatif",
  "participants": "liste complète avec qualités professionnelles",
  "section1_objet": "paragraphe rédigé sur l'objet et le lien avec l'intérêt social + art. 39-1 CGI",
  "section2_points": "paragraphes numérotés 2.1, 2.2... des points abordés, style narratif",
  "section3_conclusions": "paragraphe de synthèse des conclusions, style affirmatif",
  "section4_suites": [{"action":"...","responsable":"...","echeance":"..."}],
  "has_suites": true,
  "needs_clarification": false,
  "clarification_question": ""
}

Si une information critique manque (identité interlocuteur, objet principal),
retourner needs_clarification: true avec une seule question dans clarification_question.
```

---

## FORMAT MARKDOWN À PUBLIER DANS CRAFT

Quand l'utilisateur valide, le backend construit ce Markdown et le pousse via l'API Craft :

```markdown
# {titre}

> **Réf.** {ref} · **Entité** ISSA Capital · **CONFIDENTIEL** · *Diffusion restreinte*

---

| | |
|---|---|
| **Date** | {date} |
| **Heure** | {heure} |
| **Lieu** | {lieu} |
| **Participants** | {participants} |
| **Établi par** | Thomas Issa, Président — ISSA Capital |
| **Référence** | {ref} |

---

## 1. Objet de la réunion et lien avec l'intérêt social

{section1_objet}

## 2. Points abordés

{section2_points}

## 3. Conclusions et positions arrêtées

{section3_conclusions}

## 4. Suites à donner (si applicable)

| Action | Responsable | Échéance |
|--------|-------------|----------|
| {action} | {responsable} | {echeance} |

---

*Établi et certifié exact par Thomas Issa, Président — ISSA Capital*
*Enregistré le {date_heure_publication}*

*Document confidentiel — diffusion restreinte. Établi à titre de compte rendu interne,
susceptible d'être produit à l'administration fiscale sur demande (art. 39-1 CGI).*
```

### Appel Craft pour publication

```javascript
POST https://connect.craft.do/links/EgdwyOCC09S/api/v1/blocks
Authorization: Bearer {CRAFT_IC_KEY}
Content-Type: application/json

{
  "markdown": "{le markdown complet ci-dessus}",
  "position": {
    "position": "end"
  }
}
```

---

## RÉFÉRENCEMENT DES CRs

Format de référence : `IC-CR-{ANNÉE}-{NUMÉRO 4 chiffres}`
Exemple : `IC-CR-2026-0001`, `IC-CR-2026-0002`...

Le compteur est géré côté serveur (variable en mémoire, incrémentée à chaque publication réussie).
Pas besoin de base de données pour l'instant.

---

## UI — SPÉCIFICATIONS DÉTAILLÉES

### Layout général
```
┌─────────────────────────────────────────────────┐
│  TOPBAR : "ISSA Capital · Secrétariat"  [statut Craft]  │
├──────────────┬──────────────────────────────────┤
│              │                                  │
│   SIDEBAR    │         ZONE CHAT                │
│   230px      │                                  │
│              │  [messages + aperçu CR]           │
│  [+ Nouveau] │                                  │
│              │  ─────────────────────────────   │
│  [liste CRs] │  [textarea] [Générer →]          │
└──────────────┴──────────────────────────────────┘
```

### Palette couleurs
- Fond global : `#F4F2ED`
- Surface (sidebar, header, input) : `#FAFAF7`
- Accent principal (topbar, boutons primaires, bulles user) : `#1A3A2A`
- Accent hover : `#2D5A3D`
- Vert clair (badge actif) : `#E8F0EB`
- Texte principal : `#1A1A18`
- Texte secondaire : `#6B6B65`
- Texte tertiaire : `#9A9A94`
- Rouge confidentiel bg : `#FDF0F0` / texte : `#8B1A1A`

### Typographie
- Titres : `'Instrument Serif'` (Google Fonts)
- Corps : `'DM Sans'` (Google Fonts)
- Codes/refs : `'DM Mono'` (Google Fonts)

### Composants UI

**Topbar**
- Fond `#1A3A2A`
- Logo "ISSA Capital" en Instrument Serif blanc
- Séparateur + "Secrétariat — Comptes Rendus" en majuscules, opacité 0.5
- Indicateur Craft à droite : point coloré (vert = connecté, rouge = erreur) + label

**Sidebar**
- Bouton "+ Nouveau CR" pleine largeur, fond accent
- Liste des CRs publiés pendant la session (ref + titre + date + badge type)
- Badges colorés : déjeuner=ambre, conseil=bleu, appel=vert, interne=violet

**Zone chat**
- Header : titre du CR en cours + badge CONFIDENTIEL rouge + méta (entité, date, ref)
- Bulles utilisateur : fond `#1A3A2A`, texte blanc, border-radius 10px 10px 3px 10px
- Bulles agent : fond blanc, bordure légère, border-radius 10px 10px 10px 3px
- Labels au-dessus des bulles : "Thomas Issa" / "Secrétariat IA" en 10px uppercase

**Aperçu CR** (carte générée par l'agent)
- Header vert foncé avec ref + titre + badge CONFIDENTIEL
- Corps avec sections : Participants, Objet, Points, Conclusions, Suites
- Footer avec 3 boutons : "Publier dans Craft →" (primaire) | "Modifier" | "Copier MD"

**Chips de raccourcis** (au-dessus du textarea)
- "Déjeuner d'affaires" | "Réunion conseil" | "Appel / Visio" | "Réunion interne"
- Au clic : pré-remplit le textarea avec un template correspondant

**Toast notifications**
- Succès publication : fond vert, texte blanc, 3.5s
- Erreur : fond rouge, texte blanc, 3.5s
- Position : bottom-right fixe

### Comportements UX
- Enter = soumettre (Shift+Enter = saut de ligne)
- Textarea auto-resize (min 44px, max 110px)
- Scroll automatique vers le bas après chaque message
- Bouton "Publier" se désactive pendant la publication avec texte "Publication…"
- Statut Craft vérifié au démarrage via GET /api/craft/documents

---

## TEMPLATES DE RACCOURCIS (pré-remplissage textarea)

```javascript
const hints = {
  dej: "Déjeuner aujourd'hui avec [Prénom Nom], [qualité / société], au restaurant [Lieu]. Sujets abordés : [sujet 1], [sujet 2]. Suite : [action].",
  rdv: "Réunion ce matin avec Me [Nom], [spécialité], à son cabinet. Points : [sujet 1], [sujet 2]. Décision arrêtée : [décision].",
  tel: "Appel cet après-midi avec [Nom], [qualité]. Durée ~[X] min. Sujet : [sujet]. Suite : [action].",
  int: "Réunion interne avec [participants]. Ordre du jour : [points]. Décisions actées : [décision 1], [décision 2]."
}
```

---

## GESTION D'ERREURS

- Si Craft API inaccessible au démarrage → statut rouge + message "Craft hors ligne — publication désactivée"
- Si génération Claude échoue → message d'erreur dans le chat, bouton réactivé
- Si publication Craft échoue → toast erreur + bouton "Réessayer" sur la carte CR
- Si parsing JSON Claude échoue → afficher la réponse brute dans le chat

---

## SÉCURITÉ

- Les clés API ne sont JAMAIS exposées côté client
- Tous les appels API (Anthropic + Craft) se font exclusivement depuis le backend Express
- Le frontend ne connaît que les endpoints `/api/...` du serveur local
- Pas d'authentification utilisateur pour l'instant (usage solo Thomas Issa)

---

## INSTRUCTIONS DE DÉPLOIEMENT REPLIT

1. Créer un nouveau Repl Node.js sur le compte ISSA Capital
2. Ajouter les Secrets Replit :
   - `ANTHROPIC_API_KEY` = [clé Anthropic de Thomas]
   - `CRAFT_IC_KEY` = `pdk_9b7bbef8-4907-d7b6-b0a2-cc509648352a`
3. `npm install express node-fetch`
4. Configurer `.replit` pour lancer `node server.js`
5. L'app tourne sur le port fourni par Replit (`process.env.PORT || 3000`)

---

## ÉVOLUTIONS PRÉVUES (ne pas implémenter maintenant, juste prévoir la structure)

- Ajout Gradient One (endpoint Craft + code entité `GO`)
- Ajout Versi Développement (endpoint Craft + code entité `VD`)
- Connexion Google Calendar pour enrichissement automatique des métadonnées
- Export PDF du CR
- Authentification multi-utilisateurs

La structure du backend doit donc prévoir une configuration par entité (objet `ENTITIES`)
plutôt que des valeurs hardcodées ISSA Capital partout.
```javascript
const ENTITIES = {
  IC: {
    name: 'ISSA Capital',
    craftBase: process.env.CRAFT_IC_BASE,
    craftKey: process.env.CRAFT_IC_KEY,
    refPrefix: 'IC'
  },
  // GO et VD à ajouter plus tard
}
```
