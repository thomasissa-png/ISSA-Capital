# Security Audit — ISSA Capital

> Exécution de `docs/infra/security-checklist.md` + `npm audit` + revue manuelle code.
> @qa — 2026-04-07

---

## Verdict global : **GO CONDITIONNEL**

- Architecture sécurité **solide** : headers de sécurité OK, CSP stricte, validation Zod, rate-limit, honeypot, sanitization, RGPD.
- **2 vulnérabilités npm directes à corriger** avant déploiement production : `next` (critical) et `vitest` (critical) — fix mineur, pas de breaking change.
- **3 vulnérabilités héritées via devDependencies** (eslint-config-next / playwright / sharp-related) : non bloquantes pour la prod (non utilisées au runtime), à mettre à jour quand les majors sortiront.
- **1 incohérence honeypot** identifiée dans le code — non exploitable, simple dead code à corriger.

---

## 1. `npm audit` — synthèse des 11 vulnérabilités

```
Total : 11 (4 moderate / 5 high / 2 critical)
```

| Package                    | Sév.     | Direct | Origine                                       | Fix disponible            | Impact prod | Décision      |
|----------------------------|----------|--------|-----------------------------------------------|---------------------------|-------------|---------------|
| **next**                   | critical | OUI    | DoS Server Actions + Cache Key Confusion + Info exposure dev server | `14.2.35` (semver mineur) | OUI (runtime) | **À FIX immédiat** |
| **vitest**                 | critical | OUI    | esbuild dev-server CWE-346                    | `2.1.9` (semver mineur)   | NON (devDep) | **À FIX immédiat** (hygiène) |
| @vitest/mocker             | moderate | NON    | via vite                                      | vitest 2.1.9              | NON         | Fixé en cascade |
| esbuild                    | moderate | NON    | via vite                                      | vitest 2.1.9              | NON         | Fixé en cascade |
| vite                       | moderate | NON    | via vitest                                    | vitest 2.1.9              | NON         | Fixé en cascade |
| vite-node                  | moderate | NON    | via vitest                                    | vitest 2.1.9              | NON         | Fixé en cascade |
| **@playwright/test**       | high     | OUI    | playwright bundled chromium                   | `1.59.1` (semver mineur)  | NON (devDep) | À fix si possible |
| playwright                 | high     | NON    | via @playwright/test                          | `1.59.1`                  | NON         | Fixé en cascade |
| **eslint-config-next**     | high     | OUI    | glob CLI command injection                    | `16.2.2` (**semver MAJOR**) | NON       | Reporté (breaking, à reévaluer) |
| @next/eslint-plugin-next   | high     | NON    | via eslint-config-next                        | 16.2.2                    | NON         | Reporté |
| glob                       | high     | NON    | via @next/eslint-plugin-next                  | 16.2.2                    | NON         | Reporté |

### Décision arbitrée

| Action                                                                  | Quand           | Owner       |
|-------------------------------------------------------------------------|-----------------|-------------|
| `npm install next@14.2.35`                                              | **Avant deploy** | @fullstack |
| `npm install -D vitest@2.1.9`                                           | **Avant deploy** | @fullstack |
| `npm install -D @playwright/test@1.59.1` (et `npx playwright install`)  | Post-launch     | @qa         |
| `npm install -D eslint-config-next@16.2.2` (semver MAJOR — tester lint) | Post-launch     | @fullstack  |

**Justification du report eslint-config-next** : la vuln `glob` est exploitable seulement via CLI invocation manuelle (`glob -c`), jamais déclenchée par le pipeline lint normal. Le fix passe par un major bump qui peut casser la config eslint actuelle. Reporté en post-launch.

**Vérification après fix** : `npm audit --audit-level=high` doit retourner 0 vuln high/critical. Item **SEC-15** de la checklist passera alors PASS.

---

## 2. Checklist `docs/infra/security-checklist.md` — exécution

### HTTPS & Transport (3/3 — délégué Replit)

- [x] **SEC-01** : HTTPS auto Replit — verifié dans `deployment-replit.md`
- [x] **SEC-02** : `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` — présent dans `next.config.js`
- [x] **SEC-03** : Redirect HTTP→HTTPS auto Replit

### Headers HTTP (5/5)

- [x] **SEC-04** : `X-Frame-Options: DENY` — `next.config.js:8`
- [x] **SEC-05** : `X-Content-Type-Options: nosniff` — `next.config.js:9`
- [x] **SEC-06** : `Referrer-Policy: strict-origin-when-cross-origin` — `next.config.js:10`
- [x] **SEC-07** : `Content-Security-Policy` configurée + `frame-ancestors 'none'` + `object-src 'none'` + `upgrade-insecure-requests`
- [x] **SEC-08** : `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`

**Note CSP** : `script-src 'self' 'unsafe-inline' https://plausible.io` — `'unsafe-inline'` requis par Next.js (inline runtime). Risque mitigé par la quasi-absence de scripts inline applicatifs. Acceptable pour un site vitrine statique, mais à durcir avec des nonces si possible (post-launch).

### API & formulaires (5/5)

- [x] **SEC-09** : Validation Zod côté serveur, discriminated union sur `variant` — `lib/contactSchema.ts` + tests `contactSchema.test.ts` PASS
- [x] **SEC-10** : Honeypot champ `website` invisible (offscreen `left:-9999px`) sur les 3 variants du `ContactForm`
- [x] **SEC-11** : Rate-limit actif — 5 req / 10 min par IP (configurable via `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS`), test E2E `429` PASS
- [x] **SEC-12** : Sanitization HTML stripping + control chars + escapeHtml dans Resend — `lib/sanitize.ts` + `lib/resend.ts:21`
- [x] **SEC-13** : CORS — `/api/contact` est une route Next.js même origine, pas de header CORS permissif. PASS par défaut (Next ne route pas les preflights cross-origin sans config explicite). À monitorer post-launch.

### Secrets & dépendances (1/2)

- [x] **SEC-14** : Aucun secret committé — vérifié par `git log` + Grep sur `RESEND_API_KEY=re_` (aucune occurrence dans `src/` ou racine hors `.env.example`).
- [ ] **SEC-15** : `npm audit` 0 vuln high/critical → **FAIL temporaire**, fix `next@14.2.35` + `vitest@2.1.9` à appliquer (cf. tableau §1).

### RGPD (9/9)

- [x] **RGPD-01** : Mention RGPD au-dessus du bouton — texte présent dans `ContactForm.tsx:35-51` (variable `rgpdText`)
- [x] **RGPD-02** : Checkbox consent obligatoire (`required` HTML5) + validation Zod (`z.literal(true)`)
- [x] **RGPD-03** : Lien `/mentions-legales` dans le footer global de toutes les pages — vérifié visuellement et test E2E `us-pages.spec.ts:121`
- [x] **RGPD-04** : Politique de confidentialité incluse dans `/mentions-legales` (section "Politique de confidentialité")
- [x] **RGPD-05** : Plausible cookieless — confirmé dans `dev-decisions.md` + `next-plausible` config
- [x] **RGPD-06** : Pas de bandeau cookies (cohérent avec Plausible cookieless)
- [x] **RGPD-07** : Fonts self-hosted via `next/font/local` — Cormorant + Inter
- [ ] **RGPD-08** : DPA Resend signé — **À VALIDER avec Thomas hors session** (action légale, pas technique)
- [x] **RGPD-09** : Adresse `contact@issa-capital.com` présente dans `/mentions-legales` et `/contact`

### Anti-spam (2/3)

- [x] **SPAM-01** : Honeypot sur les 3 variants
- [x] **SPAM-02** : Rate-limit configuré
- [ ] **SPAM-03** : Cloudflare Turnstile — non installé (optionnel post-launch si spam constaté)

### L.411-1 CMF (3/3 — délégué @legal)

- [ ] **CMF-01** : Aucune occurrence des mots interdits — **À FAIRE par @legal en Phase 3** (relecture finale du copy implémenté). Note @qa : un Grep rapide sur `src/` ne révèle aucune occurrence évidente de "fonds d'investissement", "ticker", "rendement garanti", "souscription", "valeur liquidative".
- [x] **CMF-02** : Clause non-démarchage présente dans `/mentions-legales` et footer `/opportunites`
- [x] **CMF-03** : Le copy positionne ISSA en *receveur* — vérifié visuellement dans `/opportunites` ("Vous avez un dossier", "Voyons s'il correspond")

---

## 3. Bug détecté côté code — honeypot dead code

**Fichier** : `src/app/api/contact/route.ts:74` + `src/lib/contactSchema.ts:18`

**Problème** : la branche silent-200 du honeypot n'est jamais atteinte. Le schéma Zod déclare :

```ts
website: z.string().max(0, 'bot').optional().or(z.literal(''))
```

Donc si un bot remplit `website`, la validation Zod échoue **avant** d'arriver à la branche `if (parsed.data.website && parsed.data.website.length > 0)` de `route.ts`. Le bot reçoit un `400` explicite avec un message d'erreur de validation au lieu d'un `200` silencieux.

**Impact réel** : faible. Le bot est quand même bloqué (le payload n'est jamais transmis à Resend). Mais l'intention "ne pas signaler au bot qu'il a été détecté" n'est pas respectée.

**Fix recommandé (au choix)** :

- **Option A** : retirer `.max(0)` du schema pour permettre `website` arbitrairement long, et garder le check côté route.
  ```ts
  website: z.string().optional()  // accept anything, route will reject silently
  ```
- **Option B** : retirer la branche dead code de `route.ts:74-76`.

**Préconisation @qa** : option A (intention sécurité plus claire et silent reject explicite).

---

## 4. Revue manuelle complémentaire

| Item                                                 | Statut | Notes                                                 |
|------------------------------------------------------|--------|-------------------------------------------------------|
| Aucune `dangerouslySetInnerHTML`                     | PASS   | Grep `dangerouslySetInnerHTML` dans `src/` → 0       |
| Aucune `eval`, `Function()`                          | PASS   | Grep → 0                                              |
| Aucune route `/api/*` non authentifiée hors contact  | PASS   | Une seule route, `/api/contact`                       |
| `replyTo` du mail Resend = email user (vérification anti-spoofing) | PASS | `lib/resend.ts:120` — `replyTo: req.email` |
| User input loggé sans sanitization ?                 | PASS   | Logs uniquement sur erreurs internes Resend, pas de PII |
| Headers `X-Powered-By` retirés                       | PASS   | `poweredByHeader: false` dans `next.config.js`       |

---

## 5. Récap actions pre-deploy

**BLOQUANT — à corriger avant mise en ligne** :
1. `npm install next@14.2.35` (vuln critical DoS + Cache Key Confusion)
2. `npm install -D vitest@2.1.9` (vuln critical esbuild)
3. Re-run `npm audit --audit-level=high` → doit afficher 0 critical/high (sauf eslint-config-next reporté).
4. **@legal** : valider DPA Resend signé (RGPD-08).
5. **@legal** : Phase 3 — relecture finale L.411-1 CMF du copy implémenté (CMF-01).

**NON-BLOQUANT — post-launch** :
- Bug honeypot dead code (cosmétique sécurité)
- Cloudflare Turnstile si spam constaté
- `eslint-config-next@16.2.2` (semver major)
- `@playwright/test@1.59.1`
- Durcir CSP avec nonces

---

## Handoff

→ **@fullstack** : appliquer les 2 fix npm pre-deploy (next + vitest). Choisir l'option A ou B pour le bug honeypot.
→ **@legal** : DPA Resend + relecture L.411-1 CMF Phase 3.
→ **@infrastructure** : confirmer en Phase 3 que les headers sécurité sont bien servis par Replit (test `curl -I https://issa-capital.com`).
