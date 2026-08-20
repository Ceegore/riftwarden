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

interface HarnessExpedition {
  readonly mapHash: string;
  readonly golden00Hash: string | null;
  readonly matchesGolden00: boolean;
  readonly runRevision: number;
  readonly committedTransactions: number;
  readonly visitedNodes: readonly string[];
  readonly stagesWalked: readonly string[];
  readonly doubleTapCommits: number;
  readonly doubleTapNavigations: number;
  readonly doubleTapExactlyOnce: boolean;
  readonly runId: string;
}

interface HarnessResult {
  readonly capability: { readonly backend: string; readonly webglVersion: number | null; readonly failureReason: string | null };
  readonly scenarios: readonly HarnessScenario[];
  readonly expedition: HarnessExpedition | null;
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

test('P28 battle-start runs exactly once with the golden-00 map in real Chromium', async ({ page }) => {
  await page.goto('/harness.html');
  await page.waitForFunction(() => window.__contextLossHarness !== undefined);
  const harness = (await page.evaluate(() => window.__contextLossHarness)) as HarnessResult;

  expect(harness.error).toBeUndefined();
  expect(harness.expedition).not.toBeNull();
  const expedition = harness.expedition ?? null;
  if (expedition === null) throw new Error('expedition result missing');

  // Deterministic map: the browser bundle reproduces the pinned golden-00 hash.
  expect(expedition.matchesGolden00).toBe(true);
  expect(expedition.golden00Hash).not.toBeNull();
  expect(expedition.mapHash).toHaveLength(64);

  // Exactly-once start: two invocations, one commit, one navigation.
  expect(expedition.doubleTapExactlyOnce).toBe(true);
  expect(expedition.doubleTapCommits).toBe(1);
  expect(expedition.doubleTapNavigations).toBe(1);

  // The initial run snapshot is a single committed, immutable state.
  expect(expedition.runRevision).toBe(0);
  expect(expedition.committedTransactions).toBe(0);
  expect(expedition.visitedNodes.length).toBeGreaterThanOrEqual(1);
  expect(expedition.runId).toBe('browser-run-1000');

  // Closed node flow walks previewed -> ... -> completed in order.
  expect(expedition.stagesWalked).toEqual(['entering', 'entered', 'resolving', 'reward_pending', 'exiting', 'completed']);
});
