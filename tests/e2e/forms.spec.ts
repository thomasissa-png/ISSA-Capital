import { test, expect } from '@playwright/test';

/**
 * Tests E2E formulaires — couvrent US-A2, US-10, US-12, US-11.
 * Chaque variant du composant ContactForm est exercé avec :
 *  - rendu (champs attendus, labels, RGPD, consent)
 *  - validation côté client (consent obligatoire, types)
 *  - soumission échec contrôlée (mock côté API non disponible — voir api-contact.spec.ts)
 *
 * Voir docs/qa/TESTING.md.
 */

test.describe('US-A2 — Accompagnement : formulaire 4 champs', () => {
  test('le formulaire affiche les bons champs (name, email, message, consent)', async ({
    page,
  }) => {
    await page.goto('/accompagnement');
    const form = page.locator('form').first();
    await expect(form).toBeVisible();
    await expect(form.locator('#name')).toBeVisible();
    await expect(form.locator('#email')).toBeVisible();
    await expect(form.locator('#message')).toBeVisible();
    await expect(form.locator('input[name="consent"]')).toBeAttached();
    // Pas de select sujet (variant accompagnement)
    await expect(form.locator('#subject')).toHaveCount(0);
    // Honeypot présent et offscreen (left:-9999px) — pas display:none pour rester
    // accessible aux bots qui parsent le DOM mais invisible aux humains
    const honeypot = form.locator('input[name="website"]');
    await expect(honeypot).toBeAttached();
    const box = await honeypot.boundingBox();
    expect(box, 'honeypot doit avoir une boundingBox').not.toBeNull();
    expect(box!.x, 'honeypot doit être offscreen (x négatif)').toBeLessThan(-1000);
  });

  test('mention RGPD présente au-dessus du bouton', async ({ page }) => {
    await page.goto('/accompagnement');
    const text = (await page.locator('main').innerText()).toLowerCase();
    expect(text).toMatch(/issa capital.*conserv|données|rgpd|confidentialité/);
  });
});

test.describe('US-10 — Opportunités : formulaire 7 champs', () => {
  test('les 7 champs sont présents', async ({ page }) => {
    await page.goto('/opportunites');
    const form = page.locator('form').first();
    await expect(form).toBeVisible();
    await expect(form.locator('#name')).toBeVisible();
    await expect(form.locator('#email')).toBeVisible();
    await expect(form.locator('#opportunityType')).toBeVisible();
    await expect(form.locator('#location')).toBeVisible();
    await expect(form.locator('#description')).toBeVisible();
    await expect(form.locator('#ticket')).toBeVisible();
    await expect(form.locator('#source')).toBeVisible();
  });

  test('le select opportunityType propose les 3 types attendus', async ({ page }) => {
    await page.goto('/opportunites');
    const options = await page
      .locator('#opportunityType option')
      .allTextContents();
    const flat = options.join(' ').toLowerCase();
    expect(flat).toContain('immobilier');
    expect(flat).toContain('participation');
    expect(flat).toContain('autre');
  });
});

test.describe('US-12 — Contact générique : formulaire 4 champs avec sujet', () => {
  test('select sujet présent avec les 4 options', async ({ page }) => {
    await page.goto('/contact');
    const subject = page.locator('#subject');
    await expect(subject).toBeVisible();
    const options = await subject.locator('option').allTextContents();
    const flat = options.join(' ').toLowerCase();
    expect(flat).toContain('opportunité');
    expect(flat).toContain('accompagnement');
    expect(flat).toContain('presse');
    expect(flat).toContain('autre');
  });

  test('soumission sans consent ne déclenche pas success', async ({ page }) => {
    await page.goto('/contact');
    await page.fill('#name', 'Marc Dupont');
    await page.fill('#email', 'marc@journal.fr');
    await page.selectOption('#subject', 'presse');
    await page.fill('#message', 'Demande presse pour un article sur la holding.');
    // Ne pas cocher consent
    await page.click('button[type=submit]');
    await expect(page.locator('text=Message transmis')).not.toBeVisible();
  });
});

test.describe('US-11 — Protection anti-spam (honeypot + RGPD côté client)', () => {
  test('honeypot caché hors viewport', async ({ page }) => {
    await page.goto('/contact');
    const honeypot = page.locator('input[name="website"]');
    await expect(honeypot).toBeAttached();
    // Le parent doit avoir une position offscreen
    const parentClass = await honeypot.locator('..').getAttribute('class');
    expect(parentClass ?? '').toMatch(/-9999px|left-\[-9999/);
  });

  test('checkbox consent est required (HTML5)', async ({ page }) => {
    await page.goto('/accompagnement');
    const consent = page.locator('input[name="consent"]');
    await expect(consent).toHaveAttribute('required', '');
  });
});
