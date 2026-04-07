import { chromium, devices } from 'playwright';

const targets = [
  { name: 'iphone-13', device: devices['iPhone 13'] },
  { name: 'ipad', device: devices['iPad (gen 7)'] },
  { name: 'desktop-chrome', device: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false } },
];

const browser = await chromium.launch();
for (const t of targets) {
  const ctx = await browser.newContext({ ...t.device });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: `tests/screenshots/homepage-p0-${t.name}.png`, fullPage: true });
  console.log(`OK ${t.name}`);
  await ctx.close();
}
await browser.close();
