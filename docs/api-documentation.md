# API Documentation — ISSA Capital

> @fullstack — 2026-04-07.
> Documente l'unique endpoint API exposé par le site vitrine.

---

## POST /api/contact

Endpoint unifié qui traite les 3 formulaires du site via un discriminator `variant`.

### URL

```
POST /api/contact
Content-Type: application/json
```

### Runtime

- `runtime = 'nodejs'` (Resend SDK a besoin de Node, pas d'Edge).
- `dynamic = 'force-dynamic'` — jamais cached.

### Pipeline de traitement

1. **Extraction IP** : depuis `x-forwarded-for` ou `x-real-ip`.
2. **Rate limit** : 5 requêtes / 10 min par IP par défaut (voir `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`). Si dépassé → 429 avec header `Retry-After`.
3. **Parsing JSON** : body parsé, erreur 400 si invalide.
4. **Validation Zod** : `contactRequestSchema` (discriminated union sur `variant`).
5. **Honeypot** : si le champ `website` est rempli → réponse 200 silencieuse (pas d'envoi).
6. **Envoi Resend** : email HTML + text vers `RESEND_TO_EMAIL` avec `replyTo` = email du contact.
7. **Réponse** : 200 success / 500 server error.

---

### Schémas de requête (Zod)

Tous les variants partagent une base commune :

```ts
{
  name: string        // 2..120 chars, obligatoire
  email: string       // format email valide, max 200
  consent: true       // doit être strictement true (checkbox RGPD)
  website?: string    // honeypot — doit être vide
}
```

#### Variant : contact

```ts
{
  variant: 'contact',
  ...base,
  subject: 'opportunite' | 'accompagnement' | 'presse' | 'autre',
  message: string,  // 10..1000 chars
}
```

#### Variant : accompagnement

```ts
{
  variant: 'accompagnement',
  ...base,
  message: string,  // 10..1000 chars
}
```

#### Variant : opportunite

```ts
{
  variant: 'opportunite',
  ...base,
  opportunityType: 'immobilier_residentiel' | 'participation_entreprise' | 'autre',
  location?: string,      // max 200
  description: string,    // 10..500 chars
  ticket?: string,        // max 100
  source?: 'linkedin' | 'recommandation' | 'recherche' | 'autre',
}
```

---

### Réponses

#### 200 OK — Succès

```json
{ "success": true, "message": "Votre message a été transmis." }
```

#### 400 Bad Request — Erreur de validation

```json
{
  "success": false,
  "error": "validation",
  "message": "Certains champs sont invalides.",
  "fields": {
    "email": ["Email invalide"],
    "message": ["Message trop court"]
  }
}
```

#### 400 Bad Request — JSON invalide

```json
{ "success": false, "error": "invalid_json", "message": "Requête invalide." }
```

#### 429 Too Many Requests — Rate limit

Headers additionnels : `Retry-After: <secondes>`, `X-RateLimit-Remaining: 0`.

```json
{
  "success": false,
  "error": "rate_limit",
  "message": "Trop de demandes. Merci de réessayer plus tard."
}
```

#### 500 Internal Server Error — Échec Resend

```json
{
  "success": false,
  "error": "server",
  "message": "Le message n'a pas pu être envoyé. Merci d'écrire directement à contact@issa-capital.com."
}
```

---

### Exemple d'appel

```bash
curl -X POST https://issa-capital.com/api/contact \
  -H "Content-Type: application/json" \
  -d '{
    "variant": "opportunite",
    "name": "Leila Benamar",
    "email": "leila@apporteur.fr",
    "opportunityType": "immobilier_residentiel",
    "location": "Paris 11e",
    "description": "Immeuble de rapport 6 lots, opportunité rare à valoriser.",
    "ticket": "980 000 €",
    "source": "linkedin",
    "consent": true
  }'
```

---

### Variables d'environnement consommées

| Variable | Obligatoire | Description |
|---|---|---|
| `RESEND_API_KEY` | Oui (runtime) | Clé API Resend. Détecte et refuse les placeholders (`re_xxxxx…`). |
| `RESEND_FROM_EMAIL` | Oui (runtime) | Email d'envoi, format `ISSA Capital <contact@issa-capital.com>`. |
| `RESEND_TO_EMAIL` | Oui (runtime) | Destinataire unique. |
| `RATE_LIMIT_MAX` | Non (default 5) | Nombre max de requêtes dans la fenêtre. |
| `RATE_LIMIT_WINDOW_MS` | Non (default 600000) | Largeur de la fenêtre en ms (10 min par défaut). |

---

### Sécurité

- **Honeypot** : champ `website` caché visuellement (positionné hors viewport, `tabIndex=-1`, `aria-hidden`). Si rempli, la requête est silencieusement ignorée (réponse 200 pour ne pas informer le bot).
- **Consent RGPD** : `consent` doit être `true`, validé par Zod.
- **Sanitization serveur** : `sanitizeString` supprime les balises HTML et les caractères de contrôle avant d'insérer les valeurs dans l'email.
- **Escape HTML** : le template email passe chaque valeur dans `escapeHtml()` avant l'insertion dans la table HTML.
- **Rate limit** : 5 req/10 min/IP par défaut, protège contre spam et brute force.
- **CSP / headers** : gérés par `next.config.js` globalement.
- **Pas de PII en log** : seules les erreurs internes sont loggées, pas les payloads.

---

### Tests

- **Unitaires** : `src/lib/contactSchema.test.ts` + `src/lib/rateLimit.test.ts` — couvrent les cas de validation Zod (valide/invalide) et le comportement du limiter sur les 3 premières requêtes + la 4e refusée.
- **E2E** : `tests/e2e/smoke.spec.ts` — vérifie que le formulaire ne soumet pas sans consentement. À étendre par @qa en Phase 2c.

---

### Limitations connues

1. **Rate limit in-memory** : si Replit scale horizontalement, chaque instance a son propre compteur. Migration vers Upstash Redis documentée dans `rateLimit.ts`.
2. **Pas de file d'attente** : si Resend est down, la requête échoue directement avec 500. Pas de retry asynchrone. Le message d'erreur invite l'utilisateur à écrire directement à `contact@issa-capital.com`.
3. **Pas de webhook/notification** : pas de Slack / Discord / SMS. Les seuls destinataires sont les emails via Resend.
