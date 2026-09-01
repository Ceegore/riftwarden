import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));

interface RenderResult {
  readonly rendered: readonly string[];
  readonly mapHashes: Readonly<Record<string, string>>;
  readonly error?: string;
}

const GOLDEN_SEEDS = [
  { caseId: 'golden-00', seed: 1000 },
  { caseId: 'golden-01', seed: 1001 },
  { caseId: 'golden-02', seed: 1002 },
  { caseId: 'golden-03', seed: 1003 },
  { caseId: 'golden-04', seed: 1004 },
  { caseId: 'golden-05', seed: 1005 },
  { caseId: 'golden-06', seed: 1006 },
  { caseId: 'golden-07', seed: 1007 },
  { caseId: 'golden-08', seed: 1008 },
  { caseId: 'golden-09', seed: 1009 },
  { caseId: 'golden-10', seed: 1010 },
  { caseId: 'golden-11', seed: 1011 },
];

test.beforeEach(async ({ context }) => {
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') await route.continue();
    else await route.abort('blockedbyclient');
  });
});

test('S40 golden-seed maps render deterministically and match the pinned registry', async ({ page }) => {
  await page.goto('/harness-map.html');
  await page.waitForFunction(() => window.__mapRenderHarness !== undefined);
  const result = (await page.evaluate(() => window.__mapRenderHarness)) as RenderResult;

  expect(result.error).toBeUndefined();
  expect(result.rendered).toEqual(GOLDEN_SEEDS.map((entry) => entry.caseId));

  const registry = JSON.parse(
    readFileSync(resolve(here, '..', '..', '..', 'contracts', 'phase28', 'golden-registry.json'), 'utf8'),
  ) as { readonly entries: readonly { readonly caseId: string; readonly mapHash: string }[] };
  const registryById = new Map(registry.entries.map((entry) => [entry.caseId, entry.mapHash]));

  for (const { caseId } of GOLDEN_SEEDS) {
    expect(result.mapHashes[caseId], caseId).toBe(registryById.get(caseId));
  }
});

for (const { caseId } of GOLDEN_SEEDS) {
  test(`S40 golden seed ${caseId} matches the pinned visual golden`, async ({ page }) => {
    await page.goto('/harness-map.html');
    await page.waitForFunction(() => window.__mapRenderHarness !== undefined);
    const locator = page.locator(`#map-${caseId}`);
    await expect(locator).toHaveScreenshot(`${caseId}.png`, { maxDiffPixelRatio: 0.02 });
  });
}
