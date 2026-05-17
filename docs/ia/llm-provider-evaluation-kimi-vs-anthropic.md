# Evaluation LLM Provider : Kimi (MoonShot AI) vs Anthropic

> Produit par @ia le 2026-05-17, session S15.
> Demandeur : Thomas Issa (evaluation architecturale).
> Sources amont : `docs/ia/anya-spec.md`, `docs/ia/secretariat-architecture.md`, code `src/lib/secretariat/`.

---

## 1. Etat actuel -- appels LLM Anya

### Inventaire des appels LLM en production

| Tache | Modele | Fichier source | Input tokens estimes | Output tokens estimes |
|---|---|---|---|---|
| Generation CR reunion (texte FR structure) | Sonnet 4.6 (`claude-sonnet-4-20250514`) | `webhook/route.ts:227` | ~3 500 (system prompt + contacts + input) | ~1 500 (CR JSON complet) |
| Clarification CR (1 tour moyen) | Sonnet 4.6 | `webhook/route.ts` | ~3 700 | ~200 |
| Triage email-ingest (extraction JSON) | Haiku 4.5 (`claude-haiku-4-5-20251001`) | `triage/triage.ts:27` | ~2 000 (prompt + email body tronque 3 000 chars) | ~300 (JSON triage) |
| Router inbox texte court (Calendar/Todo) | Haiku 4.5 | `inbox-message-router.ts:48` | ~1 500 (system prompt + texte court) | ~200 (JSON extraction) |

### Volume mensuel estime

- **CR** : ~15/mois (4/semaine, source Thomas Q1.1) + 1 clarification moyenne = **30 appels Sonnet/mois**
- **Email-ingest triage** : ~300 emails/mois (10/jour ouvrable), dont ~70% pre-filtres par heuristique = **~90 appels Haiku/mois**
- **Router inbox** : ~5 messages courts/jour = **~100 appels Haiku/mois**
- **Total** : ~30 Sonnet + ~190 Haiku par mois

### Cout mensuel estime (tarifs Anthropic mai 2026)

Tarifs sources : [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing)

| Modele | Prix input / 1M tokens | Prix output / 1M tokens | Volume mensuel | Cout mensuel |
|---|---|---|---|---|
| Sonnet 4.6 | $3,00 | $15,00 | 30 appels x ~3 600 in + 1 200 out | ~$0,87 |
| Haiku 4.5 | $1,00 | $5,00 | 190 appels x ~1 800 in + 250 out | ~$0,58 |
| **Total** | | | | **~$1,45/mois (~1,35 EUR)** |

Avec prompt caching Anthropic (reduction 90% sur input cache) : **~0,60 EUR/mois**.

Seuil alerte Thomas : 10 EUR/mois. Marge actuelle : **x15**.

### Latence observee

- Sonnet 4.6 CR : ~5-8s completion totale (sous le seuil 10s)
- Haiku 4.5 triage/router : ~1-2s (sous le seuil 3s streaming)

---

## 2. Kimi (MoonShot AI) -- etat des lieux factuel

### Modeles actifs mai 2026

| Modele | Architecture | Params totaux | Params actifs/token | Contexte | Date sortie |
|---|---|---|---|---|---|
| Kimi K2.6 | MoE | 1 000 Md | 32 Md | 262 144 tokens | Avril 2026 |
| Kimi K2.5 | MoE | 1 000 Md | 32 Md | 262 144 tokens | Janvier 2026 |
| Kimi K2 Instruct | MoE | 1 000 Md | 32 Md | 131 072 tokens | 2025 |

Source : [HuggingFace moonshotai/Kimi-K2.6](https://huggingface.co/moonshotai/Kimi-K2.6), [GitHub MoonshotAI/Kimi-K2](https://github.com/moonshotai/Kimi-K2)

### Open source ou API only ?

**Les deux.** Les poids sont ouverts sur HuggingFace sous licence Modified MIT. Mais le self-hosting exige **8x H200 SXM5 (>1 TB VRAM)** en INT4, soit un cout infra de milliers d'euros/mois. Totalement hors scope pour ISSA Capital (budget infra < 30 EUR/mois).

Source : [GPU System Requirements Kimi K2](https://apxml.com/posts/gpu-system-requirements-kimi-llm), [Spheron Deploy Guide](https://www.spheron.network/blog/deploy-kimi-k2-6-gpu-cloud/)

### Pricing API

| | Input / 1M tokens | Output / 1M tokens | Avec cache input |
|---|---|---|---|
| Kimi K2.6 | $0,55 | $2,65 | $0,15 (cache auto) |
| Kimi K2.5 | $0,60 | $2,50 | $0,15 (cache auto) |

**Billing requis : OUI.** Recharge minimum $1 pour commencer. Rate limits lies au cumul recharge ($10 = 50 concurrents, 200 RPM).

Source : [Kimi Pricing & Rate Limits](https://platform.kimi.ai/docs/pricing/limits), [NxCode Kimi K2.5 Pricing](https://www.nxcode.io/resources/news/kimi-k2-5-pricing-plans-api-costs-2026)

**ALERTE preference Thomas #94** : Thomas refuse les services gratuits qui necessitent un billing account. L'API Kimi necessite une recharge minimum de $1. C'est un compte prepaye, pas un billing account a proprement parler (pas de carte de credit recurrente ni de facturation variable). A confirmer avec Thomas si cette distinction est acceptable.

### Juridiction et hebergement serveurs

**Serveurs en Chine continentale** pour l'API officielle (platform.moonshot.ai / platform.kimi.ai). La privacy policy mentionne un stockage a Singapour pour certaines donnees, mais les prompts API transitent par des serveurs chinois.

Source : [HuggingFace Privacy Discussion](https://huggingface.co/moonshotai/Kimi-K2-Thinking/discussions/24), [innFactory Analysis](https://innfactory.ai/en/ai-models/moonshot-kimi/), [Harmonic Security Report](https://www.harmonic.security/resources/a-year-after-deepseek-launch-1-in-12-employees-used-china-based-ai-tools-in-the-last-month-but-kimi-moonshot-way-ahead-of-all-other-chinese-ai-tools-hiding-in-your-enterprise)

**Italie a deja bloque Kimi pour non-conformite RGPD.**

### EU AI Act / GPAI

MoonShot AI n'a **pas** declare ses modeles comme GPAI aupres de l'UE a ce jour. Les obligations GPAI de l'AI Act sont en vigueur depuis aout 2025. Moonshot a explicitement declare n'avoir **"aucun plan pour developper et lancer des produits a l'international"**.

Source : [Wikipedia Moonshot AI](https://en.wikipedia.org/wiki/Moonshot_AI), [DELine Compliance Guide](https://www.de-line.net/2026/02/compliance-guide-foreign-companies-china-deepseek-kimi-moonshot-minimax/)

### Benchmarks

| Benchmark | Kimi K2.5 | Kimi K2.6 | Claude Sonnet 4.6 | Claude Haiku 4.5 |
|---|---|---|---|---|
| MMLU | 92,0 | [A verifier] | ~90 | ~85 |
| HumanEval | 99,0 | [A verifier] | ~92 | ~85 |
| GPQA Diamond | 87,6 | [A verifier] | ~78 | [A verifier] |
| SWE-Bench Pro | [A verifier] | 58,6 | [A verifier] | N/A |
| **Performance FR specifique** | **Non benchmarkee publiquement** | **Non benchmarkee publiquement** | **Excellente (entrainent explicitement FR)** | **Bonne** |

Source : [BenchLM Kimi K2.6](https://llm-stats.com/models/kimi-k2.6), [Kimi-K2.org Benchmarks](https://kimi-k2.org/blog/04-benchmark-analysis-en)

**Point critique** : aucun benchmark public FR pour Kimi. Modeles chinois entraines majoritairement EN + ZH. Anthropic declare explicitement le support multilingue FR dans son entrainement.

### Tool use / Structured output

Kimi supporte le function calling et le JSON mode via l'API OpenAI-compatible. Tool calling documente. Fonctionne via le SDK OpenAI Node.js en changeant le `baseURL`.

Source : [Kimi API Tool Calling Guide](https://kimi-ai.chat/docs/kimi-api-tool-calling/), [Kimi K2.6 Quickstart](https://platform.kimi.ai/docs/guide/kimi-k2-6-quickstart)

### SDK Node.js

- **SDK officiel** : aucun SDK MoonShot officiel pour Node.js
- **Compatible OpenAI SDK** : oui, drop-in avec `baseURL: 'https://api.moonshot.ai/v1'`
- **SDK communautaire** : `@jacksontian/kimi` sur npm (non-officiel)

Source : [GitHub JacksonTian/kimi](https://github.com/JacksonTian/kimi), [npm @jacksontian/kimi](https://www.npmjs.com/package/@jacksontian/kimi)

---

## 3. Adequation par tache Anya

| Tache Anya | Modele actuel | Kimi equivalent | Verdict | Justification |
|---|---|---|---|---|
| Triage email (extraction JSON) | Haiku 4.5 | Kimi K2.6 (JSON mode) | **Possible techniquement** | Tool use + JSON mode supportes. Mais K2.6 est un modele 1T params, pas un modele leger type Haiku. Pas d'equivalent "petit modele rapide" chez Kimi. |
| Draft reponse email (texte FR) | Sonnet 4.6 | Kimi K2.6 | **Risque qualite FR** | Aucun benchmark FR public. Modele entraine EN+ZH. Le vouvoiement institutionnel et le registre editorial requis par Thomas sont des competences FR subtiles. |
| CR vocal (texte FR long structure) | Sonnet 4.6 | Kimi K2.6 | **Risque eleve** | Le CR exige vouvoiement, registre passe compose, formules F1-F15, zero formules bannies B1-B12. Calibration FR non demontree. |
| Router Calendar/Todo (extraction date FR) | Haiku 4.5 | Kimi K2.6 | **Sur-dimensionne** | K2.6 (1T params) pour extraire une date d'un texte de 50 chars = gaspillage. Haiku 4.5 fait ca parfaitement pour 5x moins cher que Sonnet. |
| Email-ingest handlers (classifier) | Haiku 4.5 | Kimi K2.6 | **Possible** | Classification JSON simple. Mais meme reserve : pas de petit modele Kimi equivalent Haiku. |

**Constat structurel** : Kimi n'a **pas d'equivalent Haiku** (modele leger, rapide, 5x moins cher). La gamme Kimi = un seul tier de modeles MoE 1T. Or la strategie Anya repose sur le split Sonnet (qualite) / Haiku (economie) valide en S13 (lessons-learned #94 bis "modele adapte a la tache"). Basculer vers Kimi = perdre ce split.

---

## 4. Risques d'une bascule vers Kimi

### 4.1 Juridique RGPD -- BLOQUANT

- **Serveurs Chine continentale** : les emails traites par Anya contiennent des donnees personnelles (noms, adresses, montants loyers, coordonnees locataires). Transfert vers serveurs chinois = transfert hors UE sans cadre adequat.
- **Loi cybersecurite chinoise** : autorise l'acces gouvernemental aux donnees traitees en Chine.
- **Asset confidentiel NDA agence com** (`project-context.md`) : tout email ou CR mentionnant l'agence = donnee sensible sous NDA.
- **Precedent** : Italie a bloque Kimi pour non-conformite RGPD.
- **Holding patrimoniale** : ISSA Capital gere des donnees financieres/patrimoniales familiales. Le risque reputationnel d'un incident data via un provider chinois est disproportionne par rapport a l'economie realisee.

### 4.2 EU AI Act -- RISQUE

- MoonShot AI n'a pas declare ses modeles comme GPAI aupres de l'UE.
- L'obligation de declaration est en vigueur depuis aout 2025.
- MoonShot a declare n'avoir "aucun plan pour des produits internationaux".

### 4.3 Continuite de service -- RISQUE MOYEN

- Acces API depuis la France vers des serveurs chinois : risque de blocage geopolitique (precedent : restrictions TikTok dans certains pays UE).
- Pas de SLA publie pour l'API internationale.
- Moonshot AI ne cible pas le marche europeen.

### 4.4 Qualite FR -- RISQUE NON QUANTIFIE

- Zero benchmark FR public.
- Entrainement majoritaire EN + ZH.
- Les CR Anya exigent : vouvoiement institutionnel, registre passe compose, formules juridiques FR precises, zero anglicismes. Ce niveau de maitrise FR n'est pas demonstre.

### 4.5 Perte du split Sonnet/Haiku -- REGRESSION ARCHITECTURALE

- Kimi n'a qu'un tier de modeles (~K2.6). Pas de modele leger equivalent Haiku.
- Le pre-filtre heuristique + Haiku 4.5 pour le triage economise ~70% de tokens (lessons-learned S14).
- Basculer tout sur K2.6 = utiliser un modele 1T pour des taches d'extraction JSON simple.

### 4.6 Cout de migration

- Refactor : remplacement `@anthropic-ai/sdk` par SDK OpenAI-compatible dans 4 fichiers.
- Prompts : recalibration totale des prompts FR (triage, CR, router). Le prompt CR fait ~2 500 tokens avec des instructions FR specifiques optimisees pour Claude.
- Tests : 956 tests actuels dont ~200 lies aux appels LLM. Recalibration des fixtures d'evaluation (matrice confusion triage, test cases CR).
- Estimation effort : **8-12h de travail @fullstack** pour une migration complete, **sans garantie de qualite equivalente en FR**.

---

## 5. Scenarios

### Tableau comparatif

| Critere | A. Statu quo Anthropic | B. Bascule complete Kimi | C. Hybride (Kimi triage + Anthropic CR) |
|---|---|---|---|
| **Cout mensuel** | ~1,35 EUR (0,60 avec cache) | ~0,45 EUR | ~0,80 EUR |
| **Economie vs statu quo** | reference | ~0,90 EUR/mois (~66%) | ~0,55 EUR/mois (~40%) |
| **Economie annuelle** | reference | ~10,80 EUR | ~6,60 EUR |
| **Qualite CR (FR structure)** | Excellente (validee, 956 tests) | Non demontree | Inchangee (Anthropic) |
| **Qualite triage JSON** | Excellente (matrice 100%) | Probable OK (JSON simple) | Probable OK |
| **RGPD** | Conforme (DPA Anthropic, serveurs US, DPF) | **NON CONFORME** (serveurs Chine) | Partiellement (triage = metadata email seulement) |
| **EU AI Act** | Conforme | **Non declare GPAI** | Risque partiel |
| **Split modeles (Sonnet/Haiku)** | Oui | Non (1 seul tier) | Partiel |
| **Effort migration** | 0 | 8-12h | 4-6h |
| **Risque operationnel** | Zero (en production) | Eleve | Moyen |
| **Billing requis** | Oui (deja actif) | Oui (recharge $1 min) | Oui (2 providers) |

### Analyse ROI de la migration

```
Economie annuelle scenario B : ~10,80 EUR
Cout migration (effort @fullstack 10h x cout IA) : ~3-5 EUR (tokens Claude Code)
ROI migration = 10,80 / 5 = 2,16
```

**ROI < 3** : la migration n'est PAS justifiee economiquement, meme en ignorant les risques.

Pour memoire, le ROI d'Anya elle-meme (vs redaction manuelle Thomas) = **150** (calcul `secretariat-architecture.md` section 11.4). L'enjeu n'est pas le provider LLM a 1,35 EUR/mois, c'est les 1 500 EUR/mois de temps Thomas economise.

---

## 6. Recommandation @ia

**Verdict : maintenir Anthropic (scenario A). Ne pas basculer vers Kimi.**

Trois raisons :

1. **RGPD bloquant.** Les emails traites par Anya contiennent des donnees personnelles (locataires, contacts pro, patrimoine familial). Les envoyer vers des serveurs en Chine continentale est incompatible avec le RGPD, incompatible avec le statut de holding patrimoniale, et incompatible avec la posture "vitrine premium" d'ISSA Capital. L'Italie a deja bloque Kimi pour cette raison.

2. **Economie negligeable.** L'ecart est de ~0,90 EUR/mois (10,80 EUR/an). Le budget actuel est a 1,35 EUR/mois sur un seuil alerte de 10 EUR/mois. Risquer la qualite, la conformite et la stabilite pour economiser moins qu'un cafe par mois n'a aucun sens business.

3. **Qualite FR non demontree.** Anya genere des CR institutionnels en francais avec vouvoiement, formules juridiques precises, et un registre editorial calibre pour une holding patrimoniale. Aucun benchmark FR public n'existe pour Kimi. L'entrainement EN+ZH ne garantit pas ce niveau de finesse FR.

**Facteur additionnel** : la preference Thomas #94 (pas de billing account pour services gratuits). L'API Kimi necessite une recharge prepayee minimum $1. Si Thomas considere que toute forme de compte payant chez un provider chinois est inacceptable, le sujet est clos avant meme l'analyse technique.

---

## 7. Conditions d'experimentation

**Non recommandees.** Mais si Thomas souhaite quand meme tester Kimi pour sa culture technique, voici un cadre :

### Perimetre POC

- **Tache unique** : triage email (extraction JSON). C'est la tache la moins sensible (metadata email, pas de donnees patrimoniales dans l'output).
- **Volume** : 20 emails de test (les memes 20 fixtures de la matrice confusion S14).
- **Isolation** : aucune donnee reelle de production. Fixtures anonymisees.

### Criteres de succes binaires

- Matrice confusion triage : **100% categorie** (comme Haiku 4.5 actuellement)
- Latence P95 : **< 3 secondes** (seuil par defaut)
- JSON valide Zod : **100%** des reponses (comme Haiku actuellement)
- Cout par appel : **< cout Haiku equivalent**

### Metriques a comparer

- Precision/rappel par categorie de triage (locataire, contact-pro, apporteur, spam, a-classifier)
- Latence moyenne et P95
- Taux d'echec JSON (validation Zod)
- Cout par appel

### Duree

- 1 session de travail (2-3h max) pour setup + run des 20 fixtures + analyse.

### Criteres de rollback

- 1 seul FAIL sur la matrice confusion = abandon.
- Latence P95 > 5s = abandon.
- Tout echec JSON non recuperable = abandon.

---

## 8. Handoff

---
**Handoff -> Thomas (decision)**

- **Fichier produit** : `docs/ia/llm-provider-evaluation-kimi-vs-anthropic.md`
- **Recommandation** : maintenir Anthropic, ne pas basculer vers Kimi
- **Decision requise** : Thomas confirme le maintien Anthropic, ou demande le POC cadre (section 7)
- **Si maintien confirme** : aucune action, la pipeline continue sur Anthropic telle quelle
- **Si POC demande** : @fullstack cree un client Kimi parallele dans `src/lib/ai/kimi-client.ts`, run les 20 fixtures triage, compare. Effort : 2-3h. Zero impact sur la production.
- **Point d'attention** : le cout Anthropic actuel (1,35 EUR/mois) est negligeable. L'optimisation de cout la plus impactante serait d'activer le prompt caching systematiquement sur tous les appels (reduction a ~0,60 EUR/mois) -- action @fullstack independante de cette evaluation.

---
