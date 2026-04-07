# Performance Audit — ISSA Capital

> Cibles Core Web Vitals + checklist pré-déploiement.
> Produit par @orchestrator — 2026-04-07

---

## Cibles Core Web Vitals (verrouillées)

| Métrique | Cible | Seuil Google "bon" |
|---|---|---|
| **LCP** (Largest Contentful Paint) | < 2.0s | < 2.5s |
| **INP** (Interaction to Next Paint) | < 100ms | < 200ms |
| **CLS** (Cumulative Layout Shift) | < 0.05 | < 0.1 |
| **FCP** (First Contentful Paint) | < 1.5s | < 1.8s |
| **TTFB** (Time to First Byte) | < 500ms | < 800ms |

**Cible Lighthouse globale** : **95+/100** sur Performance, Accessibility, Best Practices, SEO. Pour un site vitrine statique, ces scores sont atteignables sans compromis.

---

## Stratégie performance

### Fonts (self-hosted)
- `next/font/local` avec fichiers WOFF2 dans `/public/fonts/`
- `display: 'swap'` obligatoire pour éviter FOIT
- Subset Latin uniquement (pas de caractères cyrilliques/asiatiques inutiles)
- Preload automatique géré par `next/font`
- **Aucun CDN Google Fonts** (RGPD + performance + indépendance)

### Images
- `next/image` obligatoire pour toute image (lazy loading natif, AVIF/WebP automatique, responsive)
- `priority={true}` uniquement sur l'image hero de la page Accueil (LCP)
- Dimensions explicites (width + height) pour éviter CLS
- Alt text obligatoire (accessibilité + SEO)
- Images servies depuis `/public/` (pas d'images externes sauf nécessité absolue)

### CSS
- Tailwind : purge automatique en production (JIT)
- CSS critique inline (géré par Next.js App Router par défaut)
- Pas de CSS tiers lourd (pas de Bootstrap, pas de Bulma, pas de UI kit externe)

### JavaScript
- Server Components par défaut (App Router)
- `use client` uniquement quand strictement nécessaire (formulaires interactifs, hooks)
- Pas de framer-motion sauf si utilisé extensivement (alternative : CSS animations)
- Pas de GSAP, Lottie, Three.js, etc. — site vitrine n'en a pas besoin
- Plausible : script chargé avec `next-plausible` (non-bloquant)

### Preconnect/DNS-prefetch
```html
<link rel="preconnect" href="https://plausible.io" />
<link rel="dns-prefetch" href="https://plausible.io" />
```

### Caching
- Static pages : cache immuable (géré par Next.js + Replit CDN)
- Headers `Cache-Control` : `public, max-age=31536000, immutable` pour `/_next/static/*`
- API `/api/contact` : pas de cache (POST only)

---

## Checklist pré-déploiement performance

### Build
- [ ] `npm run build` passe sans warnings
- [ ] `tsc --noEmit` : zéro erreur TypeScript
- [ ] `next lint` : zéro erreur ESLint (warnings tolérés)
- [ ] Bundle size vérifié (`@next/bundle-analyzer`) : First Load JS < 100 kB
- [ ] Pas de dépendances non utilisées (`depcheck`)
- [ ] `npm audit --audit-level=moderate` : zéro vulnérabilité critique ou high

### Assets
- [ ] Toutes les images en AVIF ou WebP (sauf SVG)
- [ ] og-image.png < 200 kB (compressé)
- [ ] favicon.ico < 10 kB
- [ ] Fonts WOFF2 uniquement (pas de WOFF ni TTF)
- [ ] Total `/public/` < 2 MB (hors vidéos)

### Runtime
- [ ] Lighthouse mobile Performance ≥ 95
- [ ] Lighthouse mobile Accessibility ≥ 95
- [ ] Lighthouse mobile Best Practices ≥ 95
- [ ] Lighthouse mobile SEO ≥ 95
- [ ] Lighthouse desktop mêmes scores
- [ ] LCP mesuré < 2.5s sur Fast 3G
- [ ] CLS mesuré < 0.1
- [ ] Pas de layout shift visible au chargement (images sans dimensions, fonts sans fallback)

### Monitoring
- [ ] UptimeRobot configuré (ping `/` toutes les 5 min)
- [ ] Plausible vérifié (pageview enregistré sur une visite de test)
- [ ] Healthcheck simple : `curl -I https://issa-capital.com` retourne 200

---

## Handoff → @fullstack, @qa

**@fullstack** : implémente selon ces cibles et checklist. Pre-commit hook recommandé pour bloquer les commits qui font chuter Lighthouse sous 95.

**@qa** : exécute Lighthouse CI sur la preview Replit avant merge. Bloque si score < 95 sur un axe.
