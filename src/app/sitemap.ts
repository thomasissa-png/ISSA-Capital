import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: Array<{ path: string; priority: number; changeFreq: 'monthly' | 'yearly' }> = [
    { path: '', priority: 1.0, changeFreq: 'monthly' },
    { path: '/mission', priority: 0.9, changeFreq: 'monthly' },
    { path: '/accompagnement', priority: 0.9, changeFreq: 'monthly' },
    { path: '/opportunites', priority: 0.9, changeFreq: 'monthly' },
    { path: '/participations', priority: 0.8, changeFreq: 'monthly' },
    { path: '/contact', priority: 0.6, changeFreq: 'yearly' },
  ];

  return routes.map((r) => ({
    url: `${siteConfig.url}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFreq,
    priority: r.priority,
  }));
}
