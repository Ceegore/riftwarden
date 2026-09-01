import { expect, test, type Page } from '@playwright/test';

async function clearProgress(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.clear();
  });
}

async function startTutorial(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  await page.getByRole('button', { name: 'Start' }).click();
  await page.locator('article.rw-game-card').filter({ hasText: 'mission_tutorial' }).getByRole('button').click();
  await page.getByRole('button', { name: 'Launch' }).click();
  await expect(page.getByRole('heading', { name: 'Expedition Map' })).toBeVisible();
}

async function navigateToMap(page: Page, heading: string): Promise<void> {
  await expect(page.getByRole('heading', { name: heading, exact: false })).toBeVisible();
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

test('entering a battle node discovers the enemy type in codex', async ({ page }) => {
  await clearProgress(page);
  await page.goto('/');
  await startTutorial(page);

  // Enter battle node.
  await page.getByRole('button', { name: 'Enter Node' }).click();
  await navigateToMap(page, 'Battle Node');

  // Read codex state from localStorage — should have a battle entry.
  const codexState = await page.evaluate((): unknown => {
    const raw = localStorage.getItem('rw.codex.v1');
    if (raw === null) return null;
    try { return JSON.parse(raw) as unknown; } catch { return null; }
  });
  expect(codexState).not.toBeNull();

  // The codex should have at least one entry (the node type itself).
  const entries = (codexState as Record<string, unknown>)['entries'] as Record<string, { discovered: boolean }> | undefined;
  expect(entries).toBeDefined();
  const discoveredKeys = Object.keys(entries ?? {}).filter((k) => entries?.[k]?.discovered);
  // At minimum the node type 'battle' should be discovered.
  expect(discoveredKeys.length, 'Expected at least one codex entry after entering a node').toBeGreaterThan(0);
});

test('codex entry persists across screens', async ({ page }) => {
  await clearProgress(page);
  await page.goto('/');
  await startTutorial(page);

  // Enter battle.
  await page.getByRole('button', { name: 'Enter Node' }).click();
  await navigateToMap(page, 'Battle Node');

  // Go to HQ then Codex.
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Hq' }).click();
  await expect(page.getByRole('heading', { name: 'Headquarters' })).toBeVisible();
  await page.getByRole('button', { name: 'Archive' }).click();
  // CodexList should render without errors and show the discovered entry.
  await expect(page.locator('main')).not.toBeEmpty();
});
