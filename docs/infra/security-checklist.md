# Security Checklist — ISSA Capital

> Checklist binaire pré-déploiement (PASS/FAIL).
> Produit par @orchestrator — 2026-04-07
> Source : docs/legal/legal-audit.md + docs/legal/rgpd-checklist.md + best practices OWASP

---

## Checklist obligatoire (15 items)

### HTTPS & Transport
- [ ] **SEC-01** : HTTPS obligatoire sur toutes les routes (Let's Encrypt via Replit)
- [ ] **SEC-02** : Header `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` configuré
- [ ] **SEC-03** : Redirection HTTP → HTTPS active (301)

### Headers de sécurité HTTP
- [ ] **SEC-04** : `X-Frame-Options: DENY` (anti-clickjacking)
- [ ] **SEC-05** : `X-Content-Type-Options: nosniff`
- [ ] **SEC-06** : `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] **SEC-07** : `Content-Security-Policy` configurée (cf. `infrastructure.md`)
- [ ] **SEC-08** : `Permissions-Policy: camera=(), microphone=(), geolocation=()` (aucune feature sensible utilisée)

### API & formulaires
- [ ] **SEC-09** : Validation Zod côté serveur sur `/api/contact` (discriminated union par variant)
- [ ] **SEC-10** : Honeypot (champ caché `honeypot` qui doit être vide) sur les 3 formulaires
- [ ] **SEC-11** : Rate limiting `/api/contact` actif (5 requêtes/IP/10 min par défaut)
- [ ] **SEC-12** : Sanitization des entrées avant envoi Resend (escape HTML + suppression tags)
- [ ] **SEC-13** : CORS strict : `/api/contact` accessible uniquement depuis le domaine (pas `*`)

### Secrets & dépendances
- [ ] **SEC-14** : Aucun secret committé (vérification `git secrets` ou équivalent)
- [ ] **SEC-15** : `npm audit --audit-level=moderate` = zéro vulnérabilité critical/high

---

## Checklist RGPD (complémentaire — cf. `docs/legal/rgpd-checklist.md`)

- [ ] **RGPD-01** : Mention RGPD au-dessus du bouton de chaque formulaire (texte exact issu de `rgpd-checklist.md` section 2)
- [ ] **RGPD-02** : Checkbox consentement obligatoire avant soumission (base légale = consentement, art. 6.1.a)
- [ ] **RGPD-03** : Page `/mentions-legales` accessible depuis le footer sur toutes les pages
- [ ] **RGPD-04** : Politique de confidentialité incluse dans `/mentions-legales`
- [ ] **RGPD-05** : Pas de cookies de tracking (Plausible cookieless confirmé)
- [ ] **RGPD-06** : Pas de bandeau cookies nécessaire (Plausible cookieless)
- [ ] **RGPD-07** : Google Fonts en local (pas de CDN Google — obligation CNIL)
- [ ] **RGPD-08** : DPA Resend signé (art. 28 RGPD) — à valider avec Thomas
- [ ] **RGPD-09** : Adresse email pour exercice des droits : `contact@issa-capital.com`

---

## Anti-spam

- [ ] **SPAM-01** : Honeypot présent sur les 3 formulaires
- [ ] **SPAM-02** : Rate limit `/api/contact` configuré
- [ ] **SPAM-03** : (Optionnel) Cloudflare Turnstile ou équivalent si spam constaté post-launch

---

## Risque juridique L.411-1 CMF (cf. legal-audit.md)

- [ ] **CMF-01** : Aucune occurrence des mots interdits de la liste noire dans le copy final
- [ ] **CMF-02** : Clause de non-démarchage financier présente dans `/mentions-legales` + footer discret sur `/opportunites`
- [ ] **CMF-03** : Le copy positionne toujours ISSA comme *receveur* de propositions, jamais comme sollicitant des investisseurs

---

## Verdict global

**GO déploiement** : 100% des items ci-dessus PASS.
**NO-GO** : 1+ item FAIL → correction immédiate avant mise en ligne.

Exécuter cette checklist avant chaque déploiement majeur.

## Handoff → @qa, @fullstack

**@qa** : exécute cette checklist en pre-deploy. Tests automatisés recommandés pour SEC-09/10/11 et SPAM-01/02.

**@fullstack** : implémenter chaque item SEC-XX dans le code. Items RGPD à coordonner avec @copywriter + @legal.
