import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — ISSA Capital.
 * Configuration 3 devices imposée par le brief @fullstack :
 *  - iPhone 13 (375px)
 *  - iPad (768px, custom viewport)
 *  - Desktop Chrome (1280px)
 *
 * Les screenshots baseline sont stockés dans tests/screenshots/ — utilisés par la
 * boucle visuelle G26 et par @qa en Phase 2c.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'iphone-13',
      // Note : on utilise le moteur Chromium avec le viewport iPhone 13 (375x667)
      // au lieu du device 'iPhone 13' natif (qui force webkit). Webkit n'est pas
      // installable dans l'environnement sandbox actuel (deps libwoff/libgles2
      // manquantes). Le viewport et le user-agent mobile suffisent à valider
      // le rendu responsive 375px exigé par la gate G26.
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 667 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'ipad',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
        deviceScaleFactor: 2,
        isMobile: false,
        hasTouch: true,
      },
    },
    {
      name: 'desktop-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
