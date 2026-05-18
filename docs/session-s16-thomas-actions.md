# Session S16 — Actions Thomas (autopilote)

> Rédigé par orchestrator en autopilote S16 le 2026-05-18.
> Suite au filtrage du `session-memo-s16.md`. A1/A2/A3 déjà faites par Thomas.

---

## A4 — Souscrire l'URL iCal Anya dans Google Calendar

**Objectif** : voir les tâches TickTick (créées par Anya) dans Google Calendar.

### Étapes

1. **Récupère l'URL iCal Anya** : visite `https://issa-capital.com/api/secretariat/ticktick/ical?secret=<TICKTICK_ICAL_SECRET>`
   - Remplace `<TICKTICK_ICAL_SECRET>` par la valeur du secret Replit (même valeur que celle ajoutée à A1)
   - Vérifie que la réponse est un fichier `.ics` valide (commence par `BEGIN:VCALENDAR`)

2. **Ajoute le calendrier dans Google Calendar** :
   - Ouvre [Google Calendar](https://calendar.google.com)
   - Dans la barre latérale gauche, à côté de "Autres agendas", clique le `+`
   - Choisis "**À partir de l'URL**"
   - Colle l'URL complète (avec `?secret=...`)
   - Clique "Ajouter un agenda"

3. **Vérifie** : les tâches TickTick d'Anya devraient apparaître sous "Autres agendas" → "TickTick — Anya" (rafraîchissement Google ~6-12h, parfois plus).

### Notes
- L'URL contient un secret → ne JAMAIS la partager (la cron-poll TickTick génère/met à jour les events toutes les 15 min).
- Si tu veux le calendrier sur ton iPhone/Mac : Apple Calendar → Préférences → Comptes → `+` → "Autre" → "Ajouter un compte calendrier CalDAV" → URL directe.

---

## A5 — Fiche `Thomas Issa.md` cassée (wikilinks vers vide)

### Diagnostic

La fiche `Thomas Issa.md` actuelle dans Drive (`00. Me/Thomas Issa.md`, fileId `1QYGnsqx9iGG-FPPbJGvEdQGbguQ0MH2d`) est **vide (0 bytes)**, créée today 2026-05-18T20:58:51 à la racine du vault `00. Me`.

C'est cohérent avec le mémo S15 : "delete Thomas Issa de Contacts/" — la fiche a été supprimée mais une fiche vide a été re-créée (peut-être par Obsidian sync ou un commit manuel). Tous les `[[Thomas Issa]]` du vault pointent vers ce fichier vide → "mène nulle part".

### Solution recommandée (manuelle, 30 secondes)

1. Dans Obsidian, ouvre `00. Me/Thomas Issa.md` (ou via la palette Cmd+P → "Thomas Issa")
2. Supprime tout le contenu (vide actuel)
3. Colle le contenu ci-dessous
4. Sauve (Cmd+S). Sync Drive automatique.

**Contenu à coller** (copié depuis `second-cerveau/Contacts/Thomas Issa.md`) :

```markdown
---
type: contact
société: ISSA Capital SAS
rôle: Président
tags:
  - fondateur
  - famille
  - dirigeant
date_dernière_interaction: [à compléter par Thomas]
---

# Thomas Issa

## Qui c'est

Fondateur et Président de [[Projets/ISSA Capital]]. Co-fondateur de [[Projets/Gradient One]] (2020) avec [[Contacts/Carl Standertskjold-Nordenstam]] et [[Contacts/Maxime Lemoine]]. Co-fondateur de Versi (2022). Entrepreneur, investisseur, conseiller stratégique. Fils de [[Contacts/Jean-Pierre Issa]] et [[Contacts/Sonia Issa]].

## Parcours

- Né en 1986, vit à Nanterre (92)
- Classe prépa Sainte-Geneviève, Versailles
- IMT Atlantique (ingénieur)
- UC Irvine (échange international)
- HEC Paris (Master Marketing)
- Gartner (2011-2012) — analyse et conseil IT
- Sony (2012-2015+) — Product Manager, co-fondateur TEOS (6000% ROI en 1 an, 7 régions mondiales)
- Strategy & Marketing Executive Adviser (depuis 2018)
- Gradient One (2020) — co-fondateur
- Versi (2022) — co-fondateur
- ISSA Capital (2026) — Président et fondateur

## Projets liés

- [[Projets/ISSA Capital]] — Président
- [[Projets/Gradient One]] — co-fondateur (50% via ISSA Capital)
- [[Projets/Versi Immobilier]] — co-gérant
- [[Projets/Versi Invest]] — co-gérant
- [[Projets/Immocrew]] — actionnaire via Gradient One
- [[Projets/Versimo]] — actionnaire via Gradient One
- [[Projets/Immobilier Direct]] — gestion directe

## Notes

Accès toutes entités. Signataire de tous les CR. Langues : français (natif), anglais (bilingue), allemand (pro limité), arabe (élémentaire).
```

### Alternative automatique (refusée en autopilote S16)

Patcher la fiche directement via Zapier MCP `_zap_raw_request PATCH` (méthode R5) est techniquement possible mais : (a) le risque d'écraser un contenu en cours de saisie côté Thomas est non-nul, (b) règle R6 = test 1 fichier + validation Thomas avant batch. Pour 1 fichier auto-référent (ta propre fiche), je préfère te rendre la main.

### Si tu veux que je le fasse côté autopilote
Dis "patche la fiche Thomas Issa" et je le ferai via Zapier MCP (R5).

---

## B1 — Cartographie CR Drive : OK en l'état

### Cartographie réelle (vérifiée via MCP Drive S16)

Les CR sont **déjà** uploadés dans des dossiers cohérents par projet, **hors du vault Obsidian** (`00. Me`) :

```
Mon Drive / [racine partagée]
├── ISSA Capital/                          (fileId 1qD93ff8ll5AEMiP7Og_oZ9wLlmP9WDpq)
│   └── 02. Comptes Rendus/                (← code IC upload ici)
└── Gradient One/                          (fileId 1oz3Dlq9Q-8XnenHm8RIkX_zAKVkjMU4Z)
    └── 02. Compte-Rendus/
        ├── 01. Gradient One/              (← code GO upload ici)
        ├── 02. Versi Immobilier/          (← code VI upload ici)
        └── 03. Versi Invest/              (← code VV upload ici)
```

**Le code `src/lib/secretariat/drive-upload.ts` pointe déjà vers les bons dossiers** (`DRIVE_FOLDERS` lignes 26-31).

### Reste à faire pour boucler ton besoin "lien CR dans le vault"

Tu m'as dit : "Mon besoin est simple, je veux qu'on upload dans des dossiers qui font sens dans la section projets". Les CR uploadent au bon endroit, mais **les liens ne sont pas visibles depuis tes fiches Projets du vault Obsidian**.

**Action concrète** : Q3 du mémo S16 = "Write-back CR → fiches vault via inbox". Une fois un CR uploadé en Drive, on ajoute automatiquement un lien dans la fiche `00. Me/02. Projets/02. Pro/<projet>.md` (section "Comptes Rendus") via PATCH in-place (R5).

→ **Délégué à @fullstack en autopilote S16** (voir C2 dans memo S16). Pas d'action Thomas requise.

---

## B2 — Merge branche S15 sur main (autopilote)

Décision en autopilote : **MERGE OUI**.

Justification : 1220 tests verts, 0 erreur TS, 0 lint, build OK, 8 commits S15 stables. Risque acceptable. Si rejet hook pre-commit ou conflit : rollback et retour vers toi.

→ Exécuté par orchestrator après C1+C2 (cf. plan execution S16).

---

## B3 — Décisions bail (P0 #2 #3 etc.)

Repoussé à fin S16 (comme demandé). À traiter dans une session dédiée ou en parallèle d'une autre.
