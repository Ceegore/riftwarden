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

interface HarnessKillCase {
  readonly point: string;
  readonly resumeRoute: string;
  readonly rewardCount: number;
  readonly exactlyOneReward: boolean;
}

interface HarnessSlice {
  readonly routesWalked: readonly string[];
  readonly fullRouteComplete: boolean;
  readonly killCases: readonly HarnessKillCase[];
  readonly finalRewardCount: number;
  readonly exactlyOneReward: boolean;
  readonly ledgerIds: number;
}

interface HarnessProfileCase {
  readonly id: string;
  readonly expected: string;
  readonly walletDelta: number;
  readonly ledgerStatus: string | null;
  readonly replayed: boolean;
}

interface HarnessProfile {
  readonly cases: readonly HarnessProfileCase[];
  readonly killPoints: readonly string[];
  readonly allKillPointsRecorded: boolean;
  readonly finalLedgerIds: number;
  readonly finalGold: number;
  readonly profileValid: boolean;
}

interface HarnessResult {
  readonly capability: { readonly backend: string; readonly webglVersion: number | null; readonly failureReason: string | null };
  readonly scenarios: readonly HarnessScenario[];
  readonly expedition: HarnessExpedition | null;
  readonly slice: HarnessSlice | null;
  readonly profile: HarnessProfile | null;
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

test('P29 slice E2E route + reliability kill matrix run in real Chromium', async ({ page }) => {
  await page.goto('/harness.html');
  await page.waitForFunction(() => window.__contextLossHarness !== undefined);
  const harness = (await page.evaluate(() => window.__contextLossHarness)) as HarnessResult;

  expect(harness.error).toBeUndefined();
  expect(harness.slice).not.toBeNull();
  const slice = harness.slice ?? null;
  if (slice === null) throw new Error('slice result missing');

  // The closed route flow walks TITLE -> ... -> MISSION_END in order.
  const routes = [
    'TITLE',
    'HQ',
    'MISSION',
    'GROUP',
    'FORMATION',
    'DUNGEON_MAP',
    'NODE_PREVIEW',
    'PREBATTLE',
    'BATTLE',
    'RESULT',
    'REWARD_OR_ANCHOR',
    'MISSION_END',
  ];
  expect(slice.routesWalked).toEqual(routes);
  expect(slice.fullRouteComplete).toBe(true);

  // Reliability kill matrix: every point resumes at the last confirmed commit.
  const expectedResume: Record<string, string> = {
    CAST_START: 'BATTLE',
    CAST_RESOLVE: 'BATTLE',
    PROJECTILE_SPAWN: 'BATTLE',
    PROJECTILE_IMPACT: 'BATTLE',
    BOSS_PHASE_CHANGE: 'BATTLE',
    SUMMON_SPAWN: 'BATTLE',
    RESULT_CREATED: 'RESULT',
    REWARD_COMMIT: 'REWARD_OR_ANCHOR',
  };
  expect(slice.killCases).toHaveLength(8);
  for (const killCase of slice.killCases) {
    expect(killCase.resumeRoute, killCase.point).toBe(expectedResume[killCase.point]);
    expect(killCase.exactlyOneReward, killCase.point).toBe(true);
    expect(killCase.rewardCount).toBeLessThanOrEqual(1);
  }

  // Exactly-once reward across the full run (double-tap included).
  expect(slice.finalRewardCount).toBe(1);
  expect(slice.exactlyOneReward).toBe(true);
  expect(slice.ledgerIds).toBe(3);
});

test('P31 profile transactions replay the four pinned cases and five kill points in real Chromium', async ({ page }) => {
  await page.goto('/harness.html');
  await page.waitForFunction(() => window.__contextLossHarness !== undefined);
  const harness = (await page.evaluate(() => window.__contextLossHarness)) as HarnessResult;

  expect(harness.error).toBeUndefined();
  expect(harness.profile).not.toBeNull();
  const profile = harness.profile ?? null;
  if (profile === null) throw new Error('profile result missing');

  // The four pinned transaction cases replay with identical wallet semantics.
  expect(profile.cases).toHaveLength(4);
  const byId = new Map(profile.cases.map((c) => [c.id, c]));

  const buyCopy = byId.get('buy-copy-ok');
  expect(buyCopy?.expected).toBe('COMMITTED');
  expect(buyCopy?.walletDelta).toBe(30);
  expect(buyCopy?.ledgerStatus).toBe('COMMITTED');

  const insufficient = byId.get('insufficient');
  expect(insufficient?.expected).toBe('REJECTED');
  expect(insufficient?.walletDelta).toBe(0);
  expect(insufficient?.ledgerStatus).toBe('REJECTED');

  const duplicate = byId.get('duplicate-callback');
  expect(duplicate?.expected).toBe('COMMITTED_ONCE');
  expect(duplicate?.walletDelta).toBe(25);
  expect(duplicate?.replayed).toBe(true);

  const commitFailure = byId.get('commit-failure');
  expect(commitFailure?.expected).toBe('FAILED_NO_MUTATION');
  expect(commitFailure?.walletDelta).toBe(0);
  expect(commitFailure?.ledgerStatus).toBe('FAILED');

  // All five kill points are recorded in canonical order.
  expect(profile.killPoints).toEqual([
    'before-preview',
    'after-confirm-before-commit',
    'during-save-temp-write',
    'after-commit-before-feedback',
    'duplicate-callback',
  ]);
  expect(profile.allKillPointsRecorded).toBe(true);

  // The final profile is valid and its ledger holds exactly the banner commit.
  expect(profile.profileValid).toBe(true);
  expect(profile.finalLedgerIds).toBe(1);
  expect(profile.finalGold).toBe(100);
});
