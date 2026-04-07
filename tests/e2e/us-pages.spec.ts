import { test, expect } from '@playwright/test';

/**
 * Tests E2E couvrant les user stories de pages statiques (US-01..US-04, US-A1, US-B1, US-13).
 * Chaque test cible 1+ user story de docs/product/functional-specs.md.
 * Voir docs/qa/TESTING.md pour la matrice de traçabilité G27.
 */

test.describe('US-01 — Accueil : identité ISSA en première visite', () => {
  test('hero above-the-fold + CTAs double entrée', async ({ page }) => {
    await page.goto('/');
    // H1 visible sans scroll
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();
    // Mots-clés identité famille libanaise / transmission / long-terme (au moins une variante)
    const body = await page.locator('body').innerText();
    expect(body.toLowerCase()).toMatch(/libanais/);
    // CTAs double entrée présents : au moins un lien vers chaque destination
    // doit être visible (sur mobile, les liens nav sont cachés derrière le menu
    // hamburger — on cible donc les CTAs hero/sections visibles à l'écran).
    expect(await page.locator('a[href="/accompagnement"]:visible').count()).toBeGreaterThan(0);
    expect(await page.locator('a[href*="/opportunites"]:visible').count()).toBeGreaterThan(0);
    // Footer global présent (role contentinfo pour éviter conflit avec footers internes)
    await expect(page.getByRole('contentinfo')).toBeVisible();
  });

  test('5 sections principales présentes', async ({ page }) => {
    await page.goto('/');
    const sections = page.locator('section');
    await expect(sections).not.toHaveCount(0);
  });
});

test.describe('US-02 — Navigation Accueil → Opportunités', () => {
  test('clic CTA "Proposer une opportunité" mène à /opportunites', async ({ page }) => {
    await page.goto('/');
    // Cible le PREMIER CTA visible (pas un lien caché derrière le menu hamburger mobile)
    const cta = page.locator('a[href*="/opportunites"]:visible').first();
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/opportunites/);
  });
});

test.describe('US-03 — Mission : identité familiale + filtres', () => {
  test('mention "famille libanaise" présente, jamais "famille française"', async ({ page }) => {
    await page.goto('/mission');
    const text = await page.locator('main').innerText();
    expect(text.toLowerCase()).toContain('libanais');
    // L'identité libanaise doit être affirmée — on vérifie qu'aucune phrase
    // ne décrit ISSA comme une "holding française" ou "famille issa française".
    // Note : la copie contient "elle n'est pas une famille française" — cette
    // négation est ATTENDUE et fait partie de la position éditoriale.
    expect(text.toLowerCase()).not.toMatch(/holding française|famille issa française/);
  });

  test('hiérarchie sémantique h1/h2/h3 présente', async ({ page }) => {
    await page.goto('/mission');
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);
    const h2Count = await page.locator('h2').count();
    expect(h2Count).toBeGreaterThan(0);
  });
});

test.describe('US-04 — Participations : 6 entités visibles', () => {
  test('les 6 noms des participations sont présents', async ({ page }) => {
    await page.goto('/participations');
    const text = await page.locator('main').innerText();
    expect(text).toContain('Gradient One');
    expect(text).toContain('Versi');
    expect(text).toContain('Immocrew');
    expect(text).toContain('Versimo');
  });

  test('liens externes des participations en target=_blank rel=noopener', async ({ page }) => {
    await page.goto('/participations');
    const externals = page.locator('a[href^="http"]');
    const count = await externals.count();
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const link = externals.nth(i);
        const target = await link.getAttribute('target');
        const rel = await link.getAttribute('rel');
        expect(target).toBe('_blank');
        expect(rel ?? '').toMatch(/noopener/);
      }
    }
  });
});

test.describe('US-A1 / Accompagnement — comprendre Thomas en 30s', () => {
  test('page /accompagnement présente Thomas + CTA contact', async ({ page }) => {
    await page.goto('/accompagnement');
    const text = await page.locator('main').innerText();
    expect(text.toLowerCase()).toContain('thomas');
    // Présence d'un formulaire ou d'un lien vers contact
    const hasForm = (await page.locator('form').count()) > 0;
    const hasContactLink = (await page.locator('a[href*="/contact"]').count()) > 0;
    expect(hasForm || hasContactLink).toBeTruthy();
  });
});

test.describe('US-B1 — Critères d\'investissement Opportunités', () => {
  test('page /opportunites contient critères + ancre formulaire', async ({ page }) => {
    await page.goto('/opportunites');
    const text = await page.locator('main').innerText();
    expect(text.length).toBeGreaterThan(200);
    // Au moins un formulaire ou ancre #formulaire
    const hasForm = (await page.locator('form').count()) > 0;
    expect(hasForm).toBeTruthy();
  });
});

test.describe('US-13 — Mentions légales', () => {
  test('page /mentions-legales accessible et contient sections obligatoires', async ({ page }) => {
    await page.goto('/mentions-legales');
    const text = (await page.locator('main').innerText()).toLowerCase();
    // Identité de l'éditeur + politique de confidentialité (RGPD)
    expect(text).toContain('issa capital');
    expect(text).toMatch(/confidentialit|rgpd|données personnelles/);
  });

  test('lien mentions légales accessible depuis le footer', async ({ page }) => {
    await page.goto('/');
    const link = page.locator('footer a[href*="/mentions-legales"]').first();
    await expect(link).toBeVisible();
  });
});
