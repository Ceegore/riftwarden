import { expect, test, type Page } from '@playwright/test';

async function clearProgress(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.clear();
  });
}

async function startTutorial(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('heading', { name: 'New Expedition' })).toBeVisible();
  await page.locator('article.rw-game-card').filter({ hasText: 'mission_tutorial' }).getByRole('button').click();
  await expect(page.getByRole('heading', { name: 'mission_tutorial' })).toBeVisible();
  await page.getByRole('button', { name: 'Launch' }).click();
  await expect(page.getByRole('heading', { name: 'Expedition Map' })).toBeVisible();
}

test.beforeEach(async ({ page, context }) => {
  page.on('pageerror', (error) => {
    console.error(`[browser-pageerror] ${error.stack ?? error.message}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') console.error(`[browser-console] ${message.text()}`);
  });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') await route.continue();
    else await route.abort('blockedbyclient');
  });
});

test('boots through the live registry path and reaches HQ Phase 37 screens', async ({ page }) => {
  await clearProgress(page);
  await page.goto('/');
  await startTutorial(page);

  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Hq' }).click();
  await expect(page.getByRole('heading', { name: 'Headquarters' })).toBeVisible();

  await page.getByRole('button', { name: 'Equipment', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Equipment' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Headquarters' })).toBeVisible();

  await page.getByRole('button', { name: 'Formation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Formation', exact: true })).toBeVisible();
});

test('renders the Pixi battle canvas on the real combat node', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Pixi WebGL smoke runs on Chromium; the other projects cover navigation.');
  await clearProgress(page);
  await page.goto('/');
  await startTutorial(page);

  await page.getByRole('button', { name: 'Enter Node' }).click();
  await expect(page.getByRole('heading', { name: 'Battle Node' })).toBeVisible();
  const canvas = page.locator('canvas.rw-battle-canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(async () => canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL('image/png').length)).toBeGreaterThan(500);

  await page.getByRole('button', { name: 'Engage', exact: true }).click();
  await expect.poll(async () => page.locator('main').innerText()).toMatch(/Action complete\.|Action unavailable|Action rejected/);
  await page.getByRole('button', { name: 'Back To Map' }).click();
  await expect(page.getByRole('heading', { name: 'Battle Result' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Expedition Map' })).toBeVisible();
});
