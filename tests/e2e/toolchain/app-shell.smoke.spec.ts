import { expect, test } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') await route.continue();
    else await route.abort('blockedbyclient');
  });
});

test('phase-02 shell boots from local assets only', async ({ page }) => {
  await page.goto('/');
  const shell = page.getByTestId('phase02-shell');
  await expect(shell).toBeAttached();
  await expect(shell).toHaveAttribute('data-build-channel', 'qa');
});
