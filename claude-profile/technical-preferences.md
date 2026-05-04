# Préférences techniques — Thomas Issa

> Stack et outils préférés. Ces choix sont des points de départ pour un nouveau projet — pas des obligations absolues. Mais si un choix alternatif est fait, le justifier.

## Stack web

- **Framework** : Next.js (App Router) — SSG par défaut, SSR quand nécessaire
- **Styling** : Tailwind CSS
- **Langage** : TypeScript strict (`noUnusedLocals`, `noUncheckedIndexedAccess`)
- **Hébergement dev** : Replit (`deploymentTarget = "autoscale"`)
- **Hébergement prod** : Replit ou Vercel selon le projet

## Analytics

- **Umami** exclusivement. Cookieless, open source, EU-hosted, RGPD-compliant.
- Jamais Plausible. Jamais GA4.

## IA

- **LLM** : Claude (Anthropic) par défaut. Sonnet pour les tâches courantes, Opus pour le raisonnement complexe.
- **Images** : gpt-image-2 exclusivement (jamais gpt-image-1). Si échec → investigation, pas fallback.
- **Pas de fallback automatique** sur les tâches IA critiques. Échec visible > dégradation silencieuse.

## SEO / GEO

- **Les H1 sont du copywriting** — jamais modifiés pour le SEO
- **Optimisation via** : meta tags, schema.org (JSON-LD), robots.txt, sitemap, llms.txt
- **FAQ en bas de page**, jamais au cœur du parcours
- **Opt-in explicite** pour les crawlers IA (GPTBot, ClaudeBot, PerplexityBot)

## Qualité code

- **UTF-8 réels** dans le code (é, è, à, ç) — jamais `é`
- **Zéro credential en clair** dans les fichiers committés → `.env.local` systématique
- **Tests** : Vitest (unitaires) + Playwright (E2E). Pipeline : tsc + lint + tests avant chaque push
- **Monorepo** : exclure les sous-projets du tsconfig racine si cohabitation

## Outils

- **Facturation** : Tiime
- **Documents internes** : Craft (en cours de remplacement par Google Drive)
- **Communication** : Telegram (bot Anya pour les CR)
- **Email** : une adresse unique par projet (contact@domaine)
