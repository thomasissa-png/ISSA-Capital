import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

/**
 * Sitemap statique — ISSA Capital.
 *
 * Mode monopage : seule la home et les mentions légales sont exposées.
 * Les anciennes pages internes existent dans le code mais ne sont plus
 * liées depuis la nav — elles sont retirées du sitemap pour ne pas
 * envoyer de signaux contradictoires aux moteurs.
 *
 * Les dates lastModified sont des CONSTANTES fixes (Bing pénalise les
 * sitemaps dont les dates changent à chaque build).
 */

const CONTENT_DATES = {
  accueil: '2026-04-11',
  mentionsLegales: '2026-04-07',
} as const;

type Route = {
  path: string;
  lastModified: string;
  priority: number;
  changeFreq: 'monthly' | 'yearly';
};

const routes: ReadonlyArray<Route> = [
  { path: '', lastModified: CONTENT_DATES.accueil, priority: 1.0, changeFreq: 'monthly' },
  { path: '/mentions-legales', lastModified: CONTENT_DATES.mentionsLegales, priority: 0.3, changeFreq: 'yearly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((r) => ({
    url: `${siteConfig.url}${r.path}`,
    lastModified: r.lastModified,
    changeFrequency: r.changeFreq,
    priority: r.priority,
  }));
}
