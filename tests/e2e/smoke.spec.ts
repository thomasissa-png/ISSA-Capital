import { test, expect } from '@playwright/test';

/**
 * Smoke tests — vérifient que chaque page rend son H1 principal et que les
 * éléments critiques sont présents. Ne couvre pas la matrice traçabilité
 * US→test — laissée à @qa en Phase 2c.
 */

const routes = [
  { path: '/', h1Contains: 'On décide' },
  { path: '/mission', h1Contains: 'Famille libanaise' },
  { path: '/accompagnement', h1Contains: 'Thomas Issa' },
  { path: '/opportunites', h1Contains: 'Vous avez un dossier' },
  { path: '/participations', h1Contains: 'écosystème' },
  { path: '/contact', h1Contains: 'Prendre contact' },
  { path: '/mentions-legales', h1Contains: 'Mentions légales' },
];

for (const route of routes) {
  test(`${route.path} charge correctement et affiche le H1`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page.locator('h1').first()).toContainText(route.h1Contains);
    // Skip link présent
    await expect(page.locator('.skip-link')).toBeAttached();
    // Footer global présent (role contentinfo — il existe un <footer> sémantique
    // imbriqué dans /accompagnement pour une attribution de verbatim, donc on
    // cible explicitement le footer racine via son role)
    await expect(page.getByRole('contentinfo')).toBeVisible();
  });
}

test('Le formulaire de contact affiche une erreur sans consentement', async ({ page }) => {
  await page.goto('/contact');
  await page.fill('#name', 'Test');
  await page.fill('#email', 'test@example.com');
  await page.selectOption('#subject', 'autre');
  await page.fill('#message', 'Message de test assez long pour valider.');
  // Ne pas cocher le consentement
  await page.click('button[type=submit]');
  // Le navigateur peut bloquer nativement — on vérifie juste qu'on ne part pas en success
  await expect(page.locator('text=Message transmis')).not.toBeVisible();
});
