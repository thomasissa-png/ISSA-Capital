# Plan d'orchestration — Session 15

> Produit par @orchestrator le 2026-05-17. Thomas doit trancher Q1/Q2/Q3 avant lancement.

---

## 1. Etat d'entree S15

- **HEAD** : `f576b0f` (branche `claude/issa-capital-s14-ttl-audit-ZQcQS`)
- **Tests** : 956 verts, 0 erreur `tsc --noEmit`, pipeline stable
- **Scope** : email-ingest V1 100% complete (15 commits S14, 2 fixes prod)
- **Beneficiaires** : Anya (secretariat IA Thomas) + Thomas (validation Telegram)
- **Learnings S14** : 4 P0/P1 propages (R1-R4 dans CLAUDE.md). 0 non-propage.

---

## 2. Tableau jalons

| Code | Nom | Agents | Livrables | Effort | Dependances |
|------|-----|--------|-----------|--------|-------------|
| 5B | Draft reponse Gmail | @fullstack + @ia | `draft-composer.ts`, scope OAuth `gmail.compose`, notif Telegram | ~1 session | TODO #1 Thomas (Tonalite dans `Thomas Issa.md`) |
| 5A | Webhook Gmail temps reel | @fullstack + @infrastructure | endpoint `/api/secretariat/gmail-webhook`, Pub/Sub OU cron polling, dedup messageId | ~1 session | Q2 Thomas (billing GCP ou cron) |
| 5D | Migration cache vers vault live | @fullstack + @qa | `vault-reader.ts` (cache TTL 1h), migration `findContactByEmail` + listes triage, suppression caches | ~1-2 sessions | Aucune (independant) |
| 5C | Tache TickTick si action | @fullstack | `ticktick-client.ts`, integration handler email-ingest | ~0.5 session | Q1 Thomas (API TickTick / Zapier / Asana) |

**Total estime** : 3-4 sessions IA (mindset R5 CLAUDE.md : parallelisation par defaut, features/heure).

---

## 3. Graphe de dependances

```
TODO #1 Thomas ─────────────┐
(Tonalite Thomas Issa.md)   │
                            v
                         [ 5B Drafts ]
                            │
Q2 Thomas ──────────────┐   │
(Pub/Sub vs cron)       │   │
                        v   v
                     [ 5A Webhook ] ──> (5A + 5B = pipeline email complet temps reel)
                     
                     [ 5D Vault live ] ──> (independant, parallelisable des le depart)

Q1 Thomas ──────────────┐
(TickTick API)          │
                        v
                     [ 5C TickTick ] ──> (dernier, plus faible priorite)
```

**Parallelisation possible** : 5D demarre en parallele de 5B ou 5A (zero dependance). 5C attend Q1 resolue.

---

## 4. Sequencement recommande

Le memo S15 propose **5B > 5A > 5D > 5C**. Confirmation avec justification :

| Ordre | Jalon | Justification |
|-------|-------|---------------|
| 1 | **5B** (Drafts) | Valeur operationnelle maximale pour Thomas : chaque email entrant genere un draft pret a envoyer. Gain quotidien immediat. |
| 2 | **5A** (Webhook) | Deblocage temps reel : sans 5A, le pipeline depend d'un lancement CLI manuel. 5A rend 5B automatique (email arrive -> draft cree -> notif Telegram). |
| 3 | **5D** (Vault live) | Amelioration architecturale : fiabilite des donnees contacts (live > cache), prerequis moyen-terme pour enrichir 5B (tonalite par contact en live). Parallelisable avec 5B/5A. |
| 4 | **5C** (TickTick) | Plus faible valeur relative : Thomas peut creer une tache manuellement en attendant. Bloque par Q1. |

**Application R5 (mindset IA)** : 5D se lance en parallele de 5B des que la session demarre (zero dependance). Pas de sequencement artificiel. Si Q1 est resolue rapidement, 5C peut aussi demarrer en parallele de 5A.

---

## 5. Questions ouvertes Thomas (BLOQUANTES)

### Q1 — TickTick : comment s'integrer ? (bloquant 5C)

Thomas, 3 options :

| Option | Effort | Avantage | Inconvenient |
|--------|--------|----------|--------------|
| **(A) API TickTick native + token** | Moyen | Controle total, pas de dependance tierce | API TickTick peu documentee, OAuth potentiellement complexe |
| **(B) Via Zapier MCP** | Faible | Zapier MCP deja disponible dans cette session. Si TickTick y est dispo, zero code custom | Dependance Zapier, latence possible |
| **(C) Bascule sur Asana** | Faible | MCP Asana natif disponible (confirme scan MCP S15) | Thomas utilise TickTick, pas Asana — changement d'habitude |

> Avant de trancher : veux-tu que je lance un `discover_zapier_actions` pour verifier si TickTick est dispo dans Zapier ? Cela permettrait de trancher A vs B en connaissance de cause.

### Q2 — Pub/Sub GCP : billing ou cron ? (bloquant 5A)

| Option | Cout | Latence | Inconvenient |
|--------|------|---------|--------------|
| **(A) Google Pub/Sub** | Gratuit < 10 Go/mois | Temps reel (~1-5s) | **Exige un projet GCP avec billing active** (pref fondateur #94 : Thomas refuse les services qui exigent billing) |
| **(B) Cron polling 5 min** | 0 EUR (Replit scheduled task) | 0-5 min delai | Pas temps reel, consomme des appels Gmail API toutes les 5 min |

**Recommandation** : option B (cron polling). Coherent avec pref fondateur #94. Le delai de 5 min est acceptable pour un secretariat email (Thomas ne repond pas a la seconde). Si Thomas veut du vrai temps reel, option A est possible mais exige billing GCP.

### Q3 — Priorite jalons : 5B > 5A > 5D > 5C confirme ?

Le sequencement 5B > 5A > 5D > 5C est justifie en section 4. Confirmes-tu ou reordonnes-tu ?

Rappel : 5D est parallelisable avec 5B/5A. Si tu confirmes, je lance 5B + 5D en parallele des ta reponse.

---

## 6. TODOs Thomas en attente

| # | Action | Statut | Bloquant pour | Urgence S15 |
|---|--------|--------|---------------|-------------|
| 1 | Copier la section Tonalite dans `Thomas Issa.md` (vault Drive) | En attente action manuelle Thomas | 5B (drafts : fallback tonalite) | **CRITIQUE** — sans ca, 5B fonctionne mais sans calibration tonalite de fallback |
| 2 | Re-test E2E pipeline email-ingest avec TTL 7j (commit `f315a59`) | En attente confirmation Thomas | Validation prod fix #2 | Moyenne — fix deja committe, test = confirmation |
| 3 | Encadrement loyers EUR/m2 Nanterre + Paris 18 | Depuis S12 | Bail conforme | Hors scope S15 |
| 4 | Arbitrage IRL : API INSEE auto OU saisie trimestrielle | Depuis S12 | Bail conforme | Hors scope S15 |

**Note** : si TODO #1 tarde, 5B peut demarrer avec un fallback tonalite generique ("vouvoiement professionnel") qui sera remplace des que la section est ajoutee. Pas ideal mais non bloquant techniquement.

---

## 7. Risques et mitigations

| Risque | Impact | Probabilite | Mitigation |
|--------|--------|-------------|------------|
| Latence MCP Drive en prod (5D) | Triage ralenti si Drive lent | Moyenne | Cache read-through TTL 1h : lire MCP, stocker en memoire, re-lire si expire |
| Re-OAuth Thomas pour scope `gmail.compose` (5B) | 1 action manuelle Thomas, interruption ponctuelle | Certaine | Documenter la procedure, faire en 1 session. Scope additif (pas de re-auth complete) |
| Pub/Sub billing refuse (pref #94) | 5A en mode cron polling au lieu de temps reel | Haute | Cron polling 5 min = fallback viable. Pas de perte fonctionnelle, juste latence |
| API TickTick inexistante ou trop complexe (5C) | 5C impossible en API native | Moyenne | Zapier MCP (option B) ou bascule Asana (option C) |
| Timeout session sur 5D (migration progressive, 4-6h estimees) | Migration incomplete | Moyenne | Migration fichier par fichier avec fallback cache a chaque etape. Chaque commit = etat stable |

---

## 8. Criteres de done S15

**S15 complete** si :
- [ ] 5B en prod : chaque email entrant genere un draft Gmail + notif Telegram
- [ ] 5A en prod : pipeline email-ingest declenche automatiquement (cron ou Pub/Sub) sans CLI manuelle
- [ ] 5D en prod : `findContactByEmail` et listes triage lisent le vault live (cache TTL 1h), caches statiques supprimes
- [ ] 5C en prod : `action_required: true` cree une tache dans le task manager de Thomas
- [ ] Tests verts sur les 4 jalons (objectif : > 1000 tests)
- [ ] 0 regression sur le pipeline email-ingest V1

**S15 partielle acceptable** (si sessions insuffisantes) :
- 5B + 5A en prod (pipeline email complet temps reel avec drafts)
- 5D + 5C documentes pour S16

---

## 9. Plan d'execution post-reponses Thomas

Une fois Q1/Q2/Q3 tranchees :

**Batch 1** (parallele) :
- @fullstack : 5B draft-composer + OAuth compose + notif Telegram
- @fullstack : 5D vault-reader.ts + migration findContactByEmail

**Batch 2** (sequentiel apres 5B) :
- @fullstack : 5A webhook/cron endpoint + dedup + integration runEmailIngest

**Batch 3** (apres Q1 resolue) :
- @fullstack : 5C ticktick-client OU integration Zapier/Asana

**QA transversal** : @qa apres chaque batch (tests unitaires + E2E pipeline complet).

---

## Handoff

**Handoff -> Thomas**
- Fichier produit : `docs/orchestration-plan-s15.md`
- Decisions requises : Q1 (TickTick), Q2 (Pub/Sub vs cron), Q3 (ordre jalons)
- TODO #1 rappele : section Tonalite dans `Thomas Issa.md` (bloquant calibration 5B)
- Prochaine action : Thomas repond Q1/Q2/Q3 -> orchestrator lance les batches @fullstack + @qa
