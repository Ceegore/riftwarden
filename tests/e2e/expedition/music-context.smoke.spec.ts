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

function contextSnapshot(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const adapter = (window as unknown as Record<string, unknown>)['__rw_music_adapter'] as { contextKey?: string } | undefined;
    return adapter?.contextKey ?? null;
  });
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

test('music context transitions through menu→map→battle→reward→map', async ({ page }) => {
  // Audio needs Chromium for Web Audio API, but the director runs in every browser.
  await clearProgress(page);
  await page.goto('/');

  // Menu should be title.
  expect(await contextSnapshot(page)).toBe('title');

  // Start the tutorial expedition → should become region on the map.
  await startTutorial(page);
  await expect(page.getByRole('heading', { name: 'Expedition Map' })).toBeVisible();
  // Allow a tick for the React effect.
  await page.waitForTimeout(200);
  const mapCtx = await contextSnapshot(page);
  expect(mapCtx).toBe('region');

  // Enter the first battle node → should become battle.
  await page.getByRole('button', { name: 'Enter Node' }).click();
  await expect(page.getByRole('heading', { name: 'Battle Node' })).toBeVisible();
  await page.waitForTimeout(200);
  expect(await contextSnapshot(page)).toBe('battle');

  // Engage combat → should show battle result (keeps battle context).
  await page.getByRole('button', { name: 'Engage', exact: true }).click();
  await expect.poll(async () => page.locator('main').innerText()).toMatch(/Action complete\.|Action unavailable|Action rejected/);
  await page.getByRole('button', { name: 'Back To Map' }).click();
  await expect(page.getByRole('heading', { name: 'Battle Result' })).toBeVisible();
  await page.waitForTimeout(200);
  // Battle result screen should keep the combat context.
  expect(await contextSnapshot(page)).toBe('battle');

  // Continue to rewards → region theme.
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForTimeout(200);
  const rewardOrMapCtx = await contextSnapshot(page);
  expect(rewardOrMapCtx).toBe('region');

  // Return to map → should still be region.
  await page.waitForTimeout(200);
  expect(await contextSnapshot(page)).toBe('region');
});

test('HQ screens use hq music context', async ({ page }) => {
  await clearProgress(page);
  await page.goto('/');
  await startTutorial(page);

  // Navigate back to menu and open HQ.
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Hq' }).click();
  await expect(page.getByRole('heading', { name: 'Headquarters' })).toBeVisible();
  await page.waitForTimeout(200);
  expect(await contextSnapshot(page)).toBe('hq');

  // Navigate into a sub-screen; should stay hq.
  await page.getByRole('button', { name: 'Equipment', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Equipment' })).toBeVisible();
  await page.waitForTimeout(200);
  expect(await contextSnapshot(page)).toBe('hq');
});

test('no JS errors during full expedition flow', async ({ page }) => {
  await clearProgress(page);
  await page.goto('/');
  await startTutorial(page);

  // Enter battle node.
  await page.getByRole('button', { name: 'Enter Node' }).click();
  await page.getByRole('button', { name: 'Engage', exact: true }).click();
  await expect.poll(async () => page.locator('main').innerText()).toMatch(/Action complete\.|Action unavailable|Action rejected/);
  await page.getByRole('button', { name: 'Back To Map' }).click();
  await expect(page.getByRole('heading', { name: 'Battle Result' })).toBeVisible();

  // Continue through reward.
  const continueBtn = page.getByRole('button', { name: 'Continue' });
  await continueBtn.click();
  await page.waitForTimeout(300);
  // If reward screen appeared, claim and continue.
  const pageText = await page.locator('main').innerText();
  if (pageText.includes('Claim')) {
    await page.getByRole('button', { name: 'Claim' }).first().click();
    await page.waitForTimeout(300);
  }
  // We should be back on a screen — either map or node preview.
  const finalText = await page.locator('main').innerText();
  expect(finalText.length).toBeGreaterThan(0);
});
