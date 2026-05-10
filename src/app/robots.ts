import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Opt-in explicite pour les crawlers IA (GEO — Generative Engine Optimization)
      // Signal d'intentionnalité fort pour ChatGPT, Claude, Perplexity, Google AI
      {
        userAgent: [
          'GPTBot',
          'ChatGPT-User',
          'OAI-SearchBot',
          'ClaudeBot',
          'Claude-Web',
          'anthropic-ai',
          'PerplexityBot',
          'Perplexity-User',
          'Google-Extended',
          'CCBot',
          'cohere-ai',
        ],
        allow: '/',
      },
      // Crawlers traditionnels (Google, Bing, etc.)
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/mentions-legales'],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
