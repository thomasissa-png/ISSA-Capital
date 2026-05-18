# Plan d'orchestration — Jalon S15.5E health-monitor

Date : 2026-05-18
Session : S15
Branche : `claude/issa-capital-s14-ttl-audit-ZQcQS` (HEAD `9e1149c`)
Tests baseline : 1097/1097 verts, 0 erreur TS

## Decisions Thomas actées
- Scope V1 = tous les items du tableau (7 items)
- Canal = Telegram uniquement
- Timing = maintenant (mini-jalon avant clôture S15)

## Findings vérification initiale

- **Pas de callback OAuth Google côté Next.js classique** : `drive-auth` est un script one-time (CLI). Pas de callback à brancher.
  - Stratégie alternative : `recordOAuthUsage('gmail'|'drive')` appelé dans `gmail-client.ts` et `drive-resolver.ts`, throttle 1×/jour pour éviter spam disque.
- **Anthropic non tracké** : aucun fichier `anthropic-usage.json`. Création requise. Branchement dans `triage.ts` + `draft-composer.ts` (recordAnthropicUsage avec tokens cumulés mensuels).
- **CRON_SECRET** : pattern établi (cron-ticktick-poll, cron-email-ingest). Réutilisé.
- **Persistence** : `/home/runner/issa-data/` (pattern poll.ts). Pas de DB.
- **Webhook dispatch** : dispatch par `callbackData.startsWith()` dans `webhook/route.ts` ligne 1620+. G33 obligatoire pour `health_renewed:` + `health_snooze:`.

## Découpe — 3 sous-Tasks @fullstack séquentielles

### Task A — Registre + items OAuth (TickTick, Gmail, Drive)
Livrables :
- `src/lib/secretariat/health-monitor/types.ts` (interface MonitoredItem)
- `src/lib/secretariat/health-monitor/oauth-timestamps.ts` (recordOAuthCallback / recordOAuthUsage / getOAuthTimestamp)
- `src/lib/secretariat/health-monitor/monitored-items.ts` (registre, items 1-3 seulement)
- Branchement `recordOAuthCallback('ticktick')` dans `src/app/api/secretariat/ticktick/oauth/callback/route.ts`
- Branchement `recordOAuthUsage('gmail')` dans `src/lib/secretariat/gmail-source/gmail-client.ts` (throttle 1×/jour)
- Branchement `recordOAuthUsage('drive')` dans `src/lib/secretariat/vault-client/drive-resolver.ts` (throttle 1×/jour)
- Tests : `oauth-timestamps.test.ts`, `monitored-items.test.ts` (items 1-3)
- Critère done : `npm test` passe (+~15-20 tests), `npm run typecheck` 0 erreur

### Task B — Items 4-7 + monitor core + dedup
Livrables :
- Items 4-7 dans `monitored-items.ts` :
  - 4. Telegram bot token (getMe API, 2 fails consécutifs avant alerte)
  - 5. Anthropic quota mensuel (lecture `anthropic-usage.json`, seuils 80%/95%)
  - 6. Domaine `issa-capital.com` (date manuelle via ENV `DOMAIN_RENEWAL_DATE`)
  - 7. Certificats SSL (`tls.connect()` + parsing expiry)
- `src/lib/secretariat/health-monitor/anthropic-usage.ts` (nouveau module : recordAnthropicUsage, getMonthlyUsageEur)
- Branchement `recordAnthropicUsage()` dans `triage.ts` + `draft-composer.ts`
- `src/lib/secretariat/health-monitor/dedup-store.ts` (notifications-sent.json, clé `${itemId}:${threshold}`, TTL 1 an + snooze)
- `src/lib/secretariat/health-monitor/health-monitor.ts` (runHealthCheck() core)
- Tests : items 4-7 + dedup-store + health-monitor (+~30-40 tests)
- Critère done : tests verts, typecheck 0 erreur

### Task C — Endpoint + workflow + handlers Telegram (G33)
Livrables :
- `src/lib/secretariat/telegram-validation/health-card.ts` (format carte 2 boutons + URL renewal)
- `src/lib/secretariat/telegram-validation/handlers/health-renewed.ts`
- `src/lib/secretariat/telegram-validation/handlers/health-snooze.ts`
- Dispatch `health_renewed:` + `health_snooze:` dans `src/app/api/telegram/webhook/route.ts` (G33 BLOQUANT)
- `src/app/api/secretariat/cron-health-check/route.ts` (GET, Bearer CRON_SECRET)
- `.github/workflows/cron-health-check.yml` (daily 8h UTC)
- Tests E2E callback → handler (G33), tests endpoint, tests health-card
- Critère done : tests verts (+~20-30 tests, total ~1180+), typecheck 0 erreur, G33 PASS

## Variables Replit à ajouter (Task C handoff)
- `ANTHROPIC_MONTHLY_BUDGET_EUR` (défaut: `50` si non set — alerte si > 80% = 40 EUR)
- `DOMAIN_RENEWAL_DATE` (format ISO `2027-03-15`, à confirmer par Thomas via registrar)
- `HEALTH_MONITOR_DISABLED` (optionnel, défaut `false` — kill switch)
- `CRON_SECRET` (déjà existant, réutilisé)
- `APP_BASE_URL` (déjà existant côté GitHub Actions, réutilisé)

## Commits prévus
- 3 commits incrémentaux (1 par Task) pour traçabilité.
- Format messages : `feat(health-monitor): <description> [S15.5E task A/B/C]`

## Contraintes critiques rappelées
1. ANTI-TIMEOUT : Write d'abord, Edit ensuite. Max ~150 lignes par Write.
2. G33 BLOQUANT en Task C : tout callback DOIT avoir dispatch testé E2E.
3. UTF-8 directs (é, è, à).
4. Pas d'invention : ANTHROPIC_MONTHLY_BUDGET_EUR défaut documenté si absent.
5. Entre Tasks : `npm test` + `npm run typecheck`. Si fail → fixer avant Task suivante.
