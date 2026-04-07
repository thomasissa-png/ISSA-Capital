import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

/**
 * Sitemap statique — ISSA Capital.
 *
 * IMPORTANT (Phase 3 — audit SEO) : les dates lastModified sont des CONSTANTES
 * fixes, pas `new Date()`. Bing pénalise les sitemaps dont les dates changent à
 * chaque build (signal de spam / contenu artificiellement frais). Mettre à jour
 * manuellement la date d'une page UNIQUEMENT lors d'une modification réelle de
 * son contenu éditorial.
 */

const CONTENT_DATES = {
  accueil: '2026-04-07',
  mission: '2026-04-07',
  participations: '2026-04-07',
  accompagnement: '2026-04-07',
  opportunites: '2026-04-07',
  contact: '2026-04-07',
} as const;

type Route = {
  path: string;
  lastModified: string;
  priority: number;
  changeFreq: 'monthly' | 'yearly';
};

const routes: ReadonlyArray<Route> = [
  { path: '', lastModified: CONTENT_DATES.accueil, priority: 1.0, changeFreq: 'monthly' },
  { path: '/mission', lastModified: CONTENT_DATES.mission, priority: 0.9, changeFreq: 'monthly' },
  { path: '/accompagnement', lastModified: CONTENT_DATES.accompagnement, priority: 0.9, changeFreq: 'monthly' },
  { path: '/opportunites', lastModified: CONTENT_DATES.opportunites, priority: 0.9, changeFreq: 'monthly' },
  { path: '/participations', lastModified: CONTENT_DATES.participations, priority: 0.8, changeFreq: 'monthly' },
  { path: '/contact', lastModified: CONTENT_DATES.contact, priority: 0.6, changeFreq: 'yearly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((r) => ({
    url: `${siteConfig.url}${r.path}`,
    lastModified: r.lastModified,
    changeFrequency: r.changeFreq,
    priority: r.priority,
  }));
}
