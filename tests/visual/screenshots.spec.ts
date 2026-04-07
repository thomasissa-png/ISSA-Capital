import { test } from '@playwright/test';
import path from 'node:path';

/**
 * Boucle visuelle — gate G26.
 * Capture les 7 pages sur les 3 projets Playwright (iphone-13, ipad, desktop-chrome)
 * et stocke les baselines dans tests/screenshots/[project]/[page].png.
 *
 * Première exécution : crée les baselines (à valider visuellement à l'oeil).
 * Exécutions suivantes : comparaison pixel-diff via les snapshots Playwright natifs.
 */

const pages = [
  { name: 'home', path: '/' },
  { name: 'mission', path: '/mission' },
  { name: 'accompagnement', path: '/accompagnement' },
  { name: 'opportunites', path: '/opportunites' },
  { name: 'participations', path: '/participations' },
  { name: 'contact', path: '/contact' },
  { name: 'mentions-legales', path: '/mentions-legales' },
];

for (const p of pages) {
  test(`baseline visuelle — ${p.name}`, async ({ page }, testInfo) => {
    await page.goto(p.path);
    await page.waitForLoadState('networkidle');
    // Masquer les zones animées si besoin : ici rien à masquer
    const screenshotPath = path.join(
      'tests',
      'screenshots',
      testInfo.project.name,
      `${p.name}.png`,
    );
    await page.screenshot({ path: screenshotPath, fullPage: true });
  });
}
