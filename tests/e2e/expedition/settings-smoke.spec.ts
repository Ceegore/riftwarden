import { expect, test, type Page } from '@playwright/test';

async function clearProgress(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.clear();
  });
}

test.beforeEach(async ({ page, context }) => {
  page.on('pageerror', (error) => {
    console.error(`[browser-pageerror] ${error.stack ?? error.message}`);
  });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') await route.continue();
    else await route.abort('blockedbyclient');
  });
});

test('opens settings and navigates through all four settings screens', async ({ page }) => {
  await clearProgress(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();

  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  await page.getByRole('button', { name: 'Accessibility' }).click();
  await expect(page.getByRole('heading', { name: 'Accessibility' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  await page.getByRole('button', { name: 'Audio' }).click();
  await expect(page.getByRole('heading', { name: 'Audio' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();

  await page.getByRole('button', { name: 'Controls' }).click();
  await expect(page.getByRole('heading', { name: 'Controls' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();

  await page.getByRole('button', { name: 'Graphics' }).click();
  await expect(page.getByRole('heading', { name: 'Graphics' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
});

test('toggles accessibility settings and persists the a11y CSS class', async ({ page }) => {
  await clearProgress(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Accessibility' }).click();

  await page.getByRole('button', { name: 'High Contrast: OFF' }).click();
  await expect(page.getByRole('button', { name: 'High Contrast: ON' })).toBeVisible();

  const hasClass = await page.evaluate(() => document.documentElement.classList.contains('rw-high-contrast'));
  expect(hasClass).toBe(true);

  await page.getByRole('button', { name: 'Reduced Motion: OFF' }).click();
  const hasReduced = await page.evaluate(() => document.documentElement.classList.contains('rw-reduced-motion'));
  expect(hasReduced).toBe(true);
});
