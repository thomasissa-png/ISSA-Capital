# Evaluation LLM : alternatives open source pour Anya

> Produit par @ia le 2026-05-17, session S15.
> Complement de `docs/ia/llm-provider-evaluation-kimi-vs-anthropic.md` (Kimi rejete).
> Demandeur : Thomas Issa. Critere #1 = conformite RGPD.

---

## 1. Tableau recapitulatif -- tous les candidats

Sources tarifs : recherches WebSearch 2026-05-17.

| Candidat | Juridiction serveurs | RGPD | Open weights | Licence | Famille modeles (split cout/qualite) | Qualite FR | Tier gratuit API | Pref #94 (billing) | Tool use / JSON | Contexte | SDK Node.js |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Mistral AI** (FR) | **UE (Paris, Suede)** | **OK** | Oui (Small, Nemo) | Apache 2.0 (open) / Commercial (Large) | **Oui** : Large 3 + Medium 3 + Small 3.1 + Ministral 8B | **Excellente** (FR natif, entreprise FR) | Oui (experimentation) | **OK** (free tier dispo) | **Oui** (function calling + JSON schema mode) | 128K-256K | **Oui** (`@mistralai/mistralai` officiel + `@ai-sdk/mistral`) |
| **Meta Llama 4** (USA via Groq) | USA (GCP) | Conditionnel (DPF USA) | Oui (HuggingFace) | Llama Community License (restrictive) | **Oui** : Maverick 400B + Scout 109B + Llama 3.3 70B + 8B | Bonne (multilingue 12 langues) | Oui (Groq free tier) | **OK** (Groq free tier sans billing) | Oui (via Groq/Together) | 128K-1M | Oui (OpenAI-compatible via Groq) |
| **DeepSeek** (Chine) | **Chine** | **NOK** | Oui (HuggingFace) | MIT | Non (V3 seul tier) | Moyenne (EN+ZH dominant) | Oui | Recharge requise | Oui | 128K | Oui (OpenAI-compatible) |
| **Qwen** (Alibaba, Chine) | Chine / Singapour / **UE (Francfort)** | **Conditionnel** (UE endpoint dispo) | Oui (HuggingFace) | Apache 2.0 | **Oui** : Max + Plus + Turbo | Bonne (multilingue) | Oui (1M tokens gratuits) | OK (free tier Singapour) | Oui | 128K | Oui (OpenAI-compatible) |
| **Google Gemma 4** (USA) | Self-host uniquement | OK (si self-host UE) | Oui (HuggingFace) | Apache 2.0 | Oui : 31B Dense + 26B MoE + 4B + 2B | Correcte | **Pas d'API** (self-host) | N/A | Limitee (pas d'API native) | Variable | N/A (pas d'API hebergee) |
| **Microsoft Phi-4** (USA) | Self-host ou Azure (USA/UE) | Conditionnel (Azure UE) | Oui (HuggingFace) | MIT | Non (14B seul) | Limitee (14B, EN dominant) | Azure free tier | Azure billing requis | Limitee (petit modele) | 16K | Oui (Azure SDK) |
| **Cohere Command A** (Canada/USA) | **USA** (GCP US-Central) | Conditionnel (DPA + SCCs) | Non (API only) | Proprietaire | Non (Command A seul tier pertinent) | Moyenne (EN dominant) | Oui (rate-limited) | OK (free tier dispo) | **Oui** (strict_tools, JSON mode) | 128K | Oui (SDK officiel `cohere-ai`) |
| **Falcon H1R** (Emirats/TII) | Self-host uniquement | OK (si self-host UE) | Oui (HuggingFace) | Apache 2.0 (avec restriction hosting commercial) | Non (7B uniquement en 2026) | Non demontree | **Pas d'API** | N/A | Non documentee | Variable | N/A |

---

## 2. Elimination rapide -- candidats ecartes

### DeepSeek -- ECARTE (meme raison que Kimi)
Serveurs en Chine. Bloque en Italie, enquetes en France/Belgique/Irlande. Memes donnees sensibles Anya (locataires, patrimoine) = meme blocage RGPD que Kimi. Source : [DeepSeek GDPR](https://macaron.im/blog/deepseek-v4-gdpr-eu).

### Qwen -- ECARTE (risque juridictionnel)
API officielle Alibaba Cloud hebergee Singapour/Chine. L'endpoint UE (Francfort) existe mais les CGU Alibaba Cloud soumettent les donnees au droit chinois. Meme profil de risque que DeepSeek/Kimi pour une holding patrimoniale. L'option self-host via HuggingFace serait RGPD-safe mais necessite de l'infra GPU hors budget (< 30 EUR/mois).

### Google Gemma 4 -- ECARTE (pas d'API hebergee)
Modele open weights excellent, mais pas d'API hebergee par Google. Self-host = serveur GPU dedie = hors budget. Pertinent uniquement si Thomas deployait un serveur GPU dedie (Hetzner, RunPod), ce qui n'est pas le cas.

### Microsoft Phi-4 -- ECARTE (sous-dimensionne)
14B params, contexte 16K, qualite FR limitee. Tres bon pour du edge/mobile mais insuffisant pour les CR institutionnels FR d'Anya. Pas d'equivalent Haiku non plus.

### Falcon H1R -- ECARTE (pas d'API, ecosysteme immature)
Pas d'API hebergee. 7B uniquement. Pas de tool use documente. Ecosysteme trop jeune pour de la production.

### Cohere Command A -- ECARTE (trop cher, pas de split)
$2,50 / $10,00 par 1M tokens = plus cher que Sonnet 4.6 ($3 / $15 mais avec split Haiku a $1 / $5). Un seul tier de modele pertinent. Serveurs USA uniquement (meme profil RGPD qu'Anthropic mais sans l'avantage du DPF bien documente). Aucun avantage vs Anthropic.

---

## 3. Top 3 finalistes -- analyse detaillee

### Finaliste 1 : Mistral AI (La Plateforme)

**Pourquoi shortliste** : entreprise francaise, serveurs UE (Paris/Suede), conformite RGPD native, gamme complete de modeles (split cout/qualite), SDK Node.js officiel, tool use + structured output JSON.

**Forces**
- **RGPD natif** : SAS francaise, serveurs UE, pas soumis au CLOUD Act US. DPA conforme Article 46 RGPD. Source : [Mistral GDPR](https://www.waimakers.com/en/resources/gdpr-compliance/mistral-ai).
- **Split modeles** : Large 3 ($2 / $6) pour qualite max, Small 3.1 ($0,20 / $0,60) pour triage, Ministral 8B ($0,10 / $0,10) pour extraction JSON simple. Equivalent du split Sonnet/Haiku.
- **FR natif** : entreprise francaise, equipe francophone, modeles entraines avec donnees FR significatives. MMLU global Small 3.1 = 80,6%. Source : [Mistral benchmarks](https://docs.mistral.ai/getting-started/models/benchmark/).
- **Tool use + JSON schema** : function calling + JSON schema mode natifs. Source : [Mistral Structured Output](https://docs.mistral.ai/capabilities/structured_output).
- **SDK officiel** : `@mistralai/mistralai` (TypeScript, ESM) + `@ai-sdk/mistral` (Vercel AI SDK). Source : [npm](https://www.npmjs.com/package/@mistralai/mistralai).
- **Free tier** : experimentation sans billing account. Source : [Mistral Pricing](https://mistral.ai/pricing).

**Faiblesses**
- Qualite FR sur registre institutionnel/juridique non benchmarkee vs Anthropic Claude (qui est explicitement entraine pour le FR).
- Le SDK a subi une attaque supply chain le 2026-05-11 (170 packages npm compromis). Verifier la version. Source : [SafeDep](https://safedep.io/mass-npm-supply-chain-attack-tanstack-mistral/).
- Pas de prompt caching equivalent a Anthropic (reduction 90% input).
- Communaute et documentation moins matures qu'Anthropic.

**Cout mensuel projete Anya (volume actuel)**

| Tache | Modele Mistral | Volume | Cout |
|---|---|---|---|
| CR reunion (equiv. Sonnet) | Large 3 ($2 / $6) | 30 appels x 3 600 in + 1 200 out | ~$0,44 |
| Triage email (equiv. Haiku) | Ministral 8B ($0,10 / $0,10) | 90 appels x 2 000 in + 300 out | ~$0,02 |
| Router inbox (equiv. Haiku) | Ministral 8B ($0,10 / $0,10) | 100 appels x 1 500 in + 200 out | ~$0,02 |
| **Total** | | | **~$0,48/mois (~0,45 EUR)** |

**Economie vs Anthropic** : ~0,90 EUR/mois (66%). Mais sans prompt caching equivalent, l'ecart avec Anthropic cache (~0,60 EUR/mois) se reduit a ~0,15 EUR/mois.

**Risques specifiques**
- Migration prompts : tous les prompts Anya sont calibres pour Claude. Recalibration necessaire (formules F1-F15, registre editorial, vouvoiement).
- Qualite CR institutionnel : non testee. Le registre "holding patrimoniale, passe compose, vouvoiement strict" est un cas d'usage specifique.

**Adequation par tache Anya**

| Tache | Modele Mistral | Verdict |
|---|---|---|
| Triage email (JSON) | Ministral 8B | **Probable OK** -- extraction JSON simple, modele optimise pour ca |
| Draft reponse email (FR) | Large 3 | **A tester** -- qualite FR probable mais non demontree sur registre institutionnel |
| CR vocal (FR structure) | Large 3 | **A tester** -- tache la plus exigeante en FR, risque de regression |
| Router Calendar/Todo | Ministral 8B | **Probable OK** -- extraction date/entite simple |

---

### Finaliste 2 : Meta Llama 4 via Groq (USA)

**Pourquoi shortliste** : modeles open source performants, hebergement Groq ultra-rapide avec free tier sans billing, split Maverick/Scout, cout tres bas.

**Forces**
- **Free tier Groq sans billing** : cle API gratuite, pas de carte bancaire. Pref #94 = OK. Source : [Groq pricing](https://groq.com/pricing).
- **Split modeles** : Maverick ($0,50 / $0,77) pour qualite, Scout ($0,11 / $0,34) pour triage. Equivalent Sonnet/Haiku.
- **Latence Groq** : ~250+ tokens/sec output. Le plus rapide du marche. Source : [Artificial Analysis](https://artificialanalysis.ai/providers/groq).
- **Cout ultra-bas** : le moins cher de tous les candidats.
- **OpenAI-compatible** : drop-in avec SDK OpenAI Node.js.

**Faiblesses**
- **Serveurs USA (GCP)** : meme profil RGPD qu'Anthropic (Data Privacy Framework US). Pas d'avantage RGPD vs statu quo. Source : [Groq privacy](https://groq.com/privacy-policy).
- **Licence Llama** : Llama Community License, pas Apache 2.0. Restrictions pour entreprises >700M utilisateurs mensuels (non pertinent pour ISSA mais indicateur de controle Meta).
- **Qualite FR** : Llama 4 supporte 12 langues dont le francais, mais entrainement domine par l'anglais. Registre institutionnel FR non demontrable.
- **Free tier rate limits** : 30 RPM, 6 000 TPM pour Scout. Suffisant pour Anya (190 appels/mois = ~6/jour) mais fragile en cas de burst. Source : [Groq free tier](https://tokenmix.ai/blog/groq-free-tier-limits-2026).
- **Dependance Groq** : Groq est un hebergeur tiers. Si Groq change sa politique free tier, obligation de migrer ou payer.

**Cout mensuel projete Anya**

| Tache | Modele Llama/Groq | Volume | Cout |
|---|---|---|---|
| CR reunion | Maverick ($0,50 / $0,77) | 30 x 3 600 in + 1 200 out | ~$0,08 |
| Triage email | Scout ($0,11 / $0,34) | 90 x 2 000 in + 300 out | ~$0,03 |
| Router inbox | Scout ($0,11 / $0,34) | 100 x 1 500 in + 200 out | ~$0,02 |
| **Total** | | | **~$0,13/mois (~0,12 EUR)** |

Avec le free tier Groq : potentiellement **0 EUR/mois** (volume Anya sous les limites free tier).

**Risques specifiques**
- Meme juridiction USA qu'Anthropic = pas de gain RGPD.
- Qualite FR inconnue sur le registre cible.
- Dependance free tier Groq (peut changer sans preavis).

---

### Finaliste 3 : Mistral AI self-host via Ollama (local Replit)

**Pourquoi shortliste** : si le critere RGPD UE est prioritaire ET qu'on veut zero transfert de donnees, le self-host de Ministral 8B sur le serveur Replit existant elimine tout transfert.

**Forces**
- **RGPD maximal** : zero transfert de donnees. Tout reste sur le serveur Replit.
- **Cout API = 0** : pas de facturation tokens.
- **Ministral 8B** : assez petit pour tourner en CPU sur Replit (8B params, quantise INT4 = ~4-5 GB RAM).

**Faiblesses**
- **Performance CPU** : sur Replit (pas de GPU), un modele 8B en CPU = latence 10-30 secondes par appel. Hors seuils (3s first token).
- **Pas de modele large** : Ministral 8B ≠ Large 3. Les CR reunion exigeraient toujours un modele externe pour la qualite.
- **Complexite ops** : gestion du modele, mises a jour, RAM Replit limitee.
- **Replit n'est pas fait pour ca** : les plans Replit ne sont pas dimensionnes pour du serving LLM.

**Verdict** : **NON VIABLE** dans la config actuelle (Replit sans GPU). Ecarte.

---

## 4. Verdict comparatif final

Scoring sur 5 criteres Anya (poids RGPD x2 car critere #1 Thomas).

| Critere (poids) | Anthropic (statu quo) | Kimi (rejete S15) | Mistral API (top 1) | Llama/Groq (top 2) |
|---|---|---|---|---|
| RGPD compliance (x2) | 4/5 (USA, DPF) | 1/5 (Chine) | **5/5 (UE natif)** | 4/5 (USA, DPF) |
| Split cout/qualite | **5/5** (Sonnet/Haiku) | 2/5 (1 tier) | **5/5** (Large/Small/Ministral) | **5/5** (Maverick/Scout) |
| Qualite FR validee | **5/5** (en prod, 956 tests) | 2/5 (non testee) | 4/5 (FR natif, non testee registre cible) | 3/5 (multilingue, EN dominant) |
| Cout mensuel | 4/5 (1,35 EUR) | 5/5 (0,45 EUR) | 5/5 (0,45 EUR) | 5/5 (0,12 EUR ou 0 free) |
| Pref #94 + effort migration | **5/5** (en place) | 3/5 (prepay $1) | 4/5 (free tier, migration moyenne) | 4/5 (free tier, migration moyenne) |
| **Score pondere /30** | **27/30** | **14/30** | **28/30** | **25/30** |

**Classement** :
1. **Mistral API** (28/30) -- seul candidat avec avantage RGPD reel (UE natif) vs Anthropic
2. **Anthropic statu quo** (27/30) -- en production, valide, fiable, 1 point de moins sur RGPD
3. **Llama/Groq** (25/30) -- moins cher mais zero avantage RGPD vs Anthropic
4. **Kimi** (14/30) -- rejete (cf. livrable precedent)

---

## 5. Recommandation actionnable

**Verdict : Mistral AI est la seule alternative open source qui repond aux 3 problemes de Kimi** (RGPD, split modeles, qualite FR).

Mais la question reelle est : **le gain justifie-t-il la migration ?**

### Analyse ROI migration Mistral

```
Economie annuelle vs Anthropic : ~10,80 EUR (0,90 EUR/mois)
Economie annuelle vs Anthropic avec cache : ~1,80 EUR (0,15 EUR/mois)
Cout migration (effort @fullstack ~8h) : ~3-5 EUR (tokens Claude Code)
ROI = 10,80 / 5 = 2,16 (vs Anthropic sans cache)
ROI = 1,80 / 5 = 0,36 (vs Anthropic avec cache)
```

**ROI < 3** dans les deux cas. La migration n'est PAS justifiee economiquement.

**Le seul argument pour Mistral = RGPD UE natif** (serveurs FR/SE, pas soumis CLOUD Act US). C'est un argument reel pour une holding patrimoniale qui traite des donnees sensibles. Mais Anthropic est certifie DPF et offre un DPA conforme -- le risque est faible, pas inexistant.

### Recommandation finale

**Maintenir Anthropic (statu quo).** Pour trois raisons :

1. **ROI migration insuffisant.** L'economie est negligeable (0,15-0,90 EUR/mois). Le cout de migration (recalibration prompts, tests, risque de regression qualite) depasse le gain.

2. **Qualite FR non demontree chez Mistral pour le registre cible.** Les CR Anya exigent vouvoiement institutionnel, formules juridiques, registre editorial holding patrimoniale. Claude Sonnet est valide en production avec 956 tests. Mistral Large 3 est probablement bon en FR mais "probablement" n'est pas "valide".

3. **Priorite Anya = fonctionnalites, pas provider.** Les jalons 5A-5D (temps reel, drafts, vault live) apportent bien plus de valeur que d'economiser 0,15 EUR/mois sur le provider.

**Action optionnelle si Thomas souhaite la souverainete UE a terme** : planifier un POC Mistral en Session 16+ (hors jalons 5A-5D), avec le cadre ci-dessous.

---

## 6. Si POC Mistral recommande (optionnel)

### Perimetre

- **Tache unique** : triage email (extraction JSON). Tache la moins sensible, la plus facile a comparer.
- **Modele** : Ministral 8B ($0,10 / $0,10) -- equivalent Haiku pour le triage.
- **Volume** : 20 emails de test (memes fixtures matrice confusion S14).
- **Isolation** : fixtures anonymisees, zero donnee production.

### Criteres de succes binaires

- Matrice confusion triage : **100% categorie** (comme Haiku 4.5)
- Latence P95 : **< 3 secondes**
- JSON valide Zod : **100%** des reponses
- Cout par appel : **< cout Haiku equivalent** ($0,10 vs $1,00 = OK par defaut)

### Effort

- 1 session (2-3h) : setup client Mistral dans `src/lib/ai/mistral-client.ts`, run 20 fixtures, comparer.

### Criteres de rollback

- 1 FAIL matrice confusion = abandon.
- Latence P95 > 5s = abandon.
- JSON non valide Zod = abandon.

### Si POC reussi

Etape suivante : tester Large 3 sur les CR (tache la plus exigeante). Meme protocole (3 CR reels anonymises, comparaison qualite vs Sonnet). Si les deux passent : migration progressive (triage d'abord, CR ensuite).

---

## 7. Handoff

---
**Handoff -> Thomas (decision)**

- **Fichier produit** : `docs/ia/llm-provider-evaluation-opensource-alternatives.md`
- **Fichier connexe** : `docs/ia/llm-provider-evaluation-kimi-vs-anthropic.md` (verdict Kimi = rejete, inchange)
- **Recommandation** : maintenir Anthropic. Mistral AI = seule alternative credible mais ROI migration insuffisant.
- **Decision requise** : Thomas confirme le maintien Anthropic OU demande le POC Mistral (section 6)
- **Si maintien confirme** : aucune action. Pipeline Anya continue sur Anthropic.
- **Si POC demande** : @fullstack cree `src/lib/ai/mistral-client.ts`, run 20 fixtures triage Ministral 8B. Effort : 2-3h.
- **Action independante recommandee** : activer le prompt caching Anthropic sur tous les appels (1,35 EUR -> 0,60 EUR/mois). Plus impactant que tout changement de provider.
---
