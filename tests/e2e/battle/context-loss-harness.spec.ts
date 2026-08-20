import { expect, test } from '@playwright/test';

interface HarnessScenario {
  readonly name: string;
  readonly steps: readonly string[];
  readonly frozenHash: string | null;
  readonly endHash: string | null;
  readonly sameEndHash: boolean;
  readonly outcome: string;
  readonly lifecycle: string;
}

interface HarnessResult {
  readonly capability: { readonly backend: string; readonly webglVersion: number | null; readonly failureReason: string | null };
  readonly scenarios: readonly HarnessScenario[];
  readonly error?: string;
}

test.beforeEach(async ({ context }) => {
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') await route.continue();
    else await route.abort('blockedbyclient');
  });
});

test('P25 context-loss matrix runs on real Chromium WebGL2 with identical end hashes', async ({ page }) => {
  await page.goto('/harness.html');
  await page.waitForFunction(() => window.__contextLossHarness !== undefined);
  const harness = (await page.evaluate(() => window.__contextLossHarness)) as HarnessResult;

  expect(harness.error).toBeUndefined();
  expect(harness.capability.backend).toBe('webgl2');
  expect(harness.capability.webglVersion).toBe(2);
  expect(harness.capability.failureReason).toBeNull();

  const expectedSteps = ['prevent_default', 'freeze', 'snapshot_request', 'teardown', 'rebuild_from_snapshot', 'ready_gate'];
  const scenarioNames = harness.scenarios.slice(0, 4).map((scenario) => scenario.name);
  expect(scenarioNames).toEqual(['during_cast', 'during_projectile', 'during_spawn', 'during_battle_end']);

  for (const scenario of harness.scenarios.slice(0, 4)) {
    expect(scenario.outcome).toBe('ready');
    expect(scenario.lifecycle).toBe('ready');
    expect(scenario.steps).toEqual(expectedSteps);
    expect(scenario.frozenHash).not.toBeNull();
    expect(scenario.endHash).toBe(scenario.frozenHash);
    expect(scenario.sameEndHash).toBe(true);
  }

  const failed = harness.scenarios[4];
  expect(failed?.name).toBe('during_cast_failed_restore');
  expect(failed?.outcome).toBe('failed_safe');
  expect(failed?.lifecycle).toBe('failed_safe');
  expect(failed?.steps).toContain('failed_safe');
});
