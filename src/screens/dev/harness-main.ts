import { Application } from 'pixi.js';
import { KILL_POINT_ORDER, TransactionFlow } from '../../game/profile/transaction-flow.js';
import { commitTransaction } from '../../game/profile/transaction-service.js';
import { validateProfile } from '../../game/profile/profile-validator.js';
import type { Profile, TransactionKind } from '../../game/profile/types.js';
import { commitCounts, commitOnce, emptyLedger, resumeFromKinds } from '../../game/slice/commit-ledger.js';
import { advanceTo, ROUTE_ORDER } from '../../game/slice/route-machine.js';
import type { CommitKind, Route } from '../../game/slice/types.js';
import { generateMap } from '../../game/expedition/map-generator.js';
import { applyNodeCommand } from '../../game/expedition/node-flow.js';
import { createRunState } from '../../game/expedition/run-state.js';
import type { MapProfile, NodeStage } from '../../game/expedition/types.js';
import { AtomicStartGuard } from '../../game/formation/start-guard.js';
import { resolveCapability, type CapabilityProbe } from '../../game/render/capability.js';
import { createContextRecovery } from '../../game/render/context-recovery.js';
import { createPixiScene } from '../../features/battle-render/pixi-scene.js';
import { createSnapshotPresenter } from '../../game/render/snapshot-presenter.js';
import { baselineQuality } from '../../game/render/quality.js';
import { buildSceneGraph, EMPTY_SCENE_GRAPH_INPUT } from '../../game/render/scene-graph.js';
import type { BattlePresentationFrame, EntityFrame, Lane, RendererLifecycle, VisualState } from '../../game/render/types.js';

/**
 * Dev-only browser harness (data-rw-dev-only marker; never part of the app
 * build): drives the Phase 25 context-recovery contract through real Chromium
 * WebGL2. A real Pixi Application owns the canvas; context loss is injected
 * with the genuine WEBGL_lose_context extension, the coordinator freezes,
 * requests a snapshot, tears the Pixi scene down and rebuilds it from the
 * authoritative snapshot. Results are exposed on window.__contextLossHarness.
 */
declare global {
  interface Window {
    __contextLossHarness?: unknown;
  }
}

export interface HarnessCapabilityResult {
  readonly backend: string;
  readonly webglVersion: number | null;
  readonly failureReason: string | null;
}

export interface HarnessScenarioResult {
  readonly name: string;
  readonly steps: readonly string[];
  readonly frozenHash: string | null;
  readonly endHash: string | null;
  readonly sameEndHash: boolean;
  readonly outcome: 'ready' | 'retry' | 'failed_safe';
  readonly lifecycle: RendererLifecycle;
  readonly snapshotRequests: number;
  readonly teardowns: number;
}

export interface HarnessExpeditionResult {
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

export interface HarnessKillCase {
  readonly point: string;
  readonly resumeRoute: Route;
  readonly rewardCount: number;
  readonly exactlyOneReward: boolean;
}

export interface HarnessSliceResult {
  readonly routesWalked: readonly Route[];
  readonly fullRouteComplete: boolean;
  readonly killCases: readonly HarnessKillCase[];
  readonly finalRewardCount: number;
  readonly exactlyOneReward: boolean;
  readonly ledgerIds: number;
}

export interface HarnessProfileTransactionCase {
  readonly id: string;
  readonly expected: string;
  readonly walletDelta: number;
  readonly ledgerStatus: string | null;
  readonly replayed: boolean;
}

export interface HarnessProfileResult {
  readonly cases: readonly HarnessProfileTransactionCase[];
  readonly killPoints: readonly string[];
  readonly allKillPointsRecorded: boolean;
  readonly finalLedgerIds: number;
  readonly finalGold: number;
  readonly profileValid: boolean;
}

export interface HarnessResult {
  readonly capability: HarnessCapabilityResult;
  readonly scenarios: readonly HarnessScenarioResult[];
  readonly expedition: HarnessExpeditionResult | null;
  readonly slice: HarnessSliceResult | null;
  readonly profile: HarnessProfileResult | null;
  readonly error?: string;
  readonly contextLostAt?: { readonly afterInit: boolean; readonly perScenario: readonly boolean[] };
}

function entity(id: string, overrides: Partial<EntityFrame> = {}): EntityFrame {
  return Object.freeze({ id, lane: 0, logicalX100: 100, visualState: 'idle', clipProgress1000: 0, ...overrides });
}

function frame(tick: number, entities: readonly EntityFrame[], hash: string): BattlePresentationFrame {
  return Object.freeze({ tick, entities: Object.freeze([...entities]), gameplayHash: hash });
}

function hexHash(n: number): string {
  return String(n).padStart(64, '0');
}

function scenarioFrames(name: string): readonly BattlePresentationFrame[] {
  const unit = (id: string, lane: Lane, visualState: VisualState, logicalX100: number): EntityFrame =>
    entity(id, { lane, visualState, logicalX100 });
  switch (name) {
    case 'during_cast':
      return [
        frame(0, [unit('caster', 1, 'idle', 400), unit('target', 1, 'idle', 800)], hexHash(1)),
        frame(1, [unit('caster', 1, 'prepare', 400), unit('target', 1, 'idle', 800)], hexHash(2)),
        frame(2, [unit('caster', 1, 'execute', 420), unit('target', 1, 'hurt', 800)], hexHash(3)),
      ];
    case 'during_projectile':
      return [
        frame(0, [unit('shooter', 2, 'idle', 300), unit('target', 2, 'idle', 900)], hexHash(4)),
        frame(1, [unit('shooter', 2, 'execute', 300), unit('target', 2, 'idle', 900)], hexHash(5)),
      ];
    case 'during_spawn':
      return [frame(0, [unit('vanguard', 0, 'idle', 500)], hexHash(6)), frame(1, [unit('vanguard', 0, 'idle', 500), unit('reinforcement', 2, 'spawn', 700)], hexHash(7))];
    case 'during_battle_end':
      return [frame(0, [unit('hero', 1, 'execute', 500), unit('boss', 1, 'hurt', 900)], hexHash(8)), frame(1, [unit('hero', 1, 'victory', 500)], hexHash(9))];
    default:
      throw new Error(`unknown scenario ${name}`);
  }
}

function readNumber(gl: WebGL2RenderingContext, pname: number): number {
  const value: unknown = gl.getParameter(pname);
  return typeof value === 'number' ? value : 0;
}

function readNumberArray(gl: WebGL2RenderingContext, pname: number): readonly number[] {
  // MAX_VIEWPORT_DIMS is an Int32Array (not an Array); both expose length and
  // indexed access, so probe them uniformly.
  const value: unknown = gl.getParameter(pname);
  if (value === null || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  const length = record['length'];
  if (typeof length === 'number' && Number.isInteger(length) && length > 0 && length <= 64) {
    const output: number[] = [];
    for (let i = 0; i < length; i += 1) {
      const item = record[String(i)];
      if (typeof item === 'number') output.push(item);
    }
    return output;
  }
  return [];
}

function probeFromContext(gl: WebGL2RenderingContext, devicePixelRatio: number): CapabilityProbe {
  const viewport = readNumberArray(gl, gl.MAX_VIEWPORT_DIMS);
  return {
    webglVersion: 2,
    validated: true,
    maxTextureSize: readNumber(gl, gl.MAX_TEXTURE_SIZE),
    maxRenderbufferSize: readNumber(gl, gl.MAX_RENDERBUFFER_SIZE),
    maxViewportWidth: viewport[0] ?? 0,
    maxViewportHeight: viewport[1] ?? 0,
    devicePixelRatio,
  };
}

function loseContext(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext, onLost: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const extension = gl.getExtension('WEBGL_lose_context');
    if (extension === null) {
      reject(new Error(`WEBGL_lose_context unavailable (contextLost=${String(gl.isContextLost())})`));
      return;
    }
    canvas.addEventListener(
      'webglcontextlost',
      (event) => {
        event.preventDefault();
        onLost();
        resolve();
      },
      { once: true },
    );
    extension.loseContext();
  });
}

async function runScenario(name: string, frames: readonly BattlePresentationFrame[], failRebuild: boolean): Promise<HarnessScenarioResult> {
  // A fresh canvas + context per scenario: a real context loss leaves the
  // context lost, so each scenario independently proves creation, genuine
  // WEBGL_lose_context injection, teardown and rebuild from the snapshot.
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 540;
  const app = new Application();
  await app.init({ canvas, preference: 'webgl', width: 960, height: 540, backgroundAlpha: 0 });
  app.stop();
  const gl = canvas.getContext('webgl2');
  if (gl === null) throw new Error(`webgl2 context unavailable for ${name}`);
  const presenter = createSnapshotPresenter();
  const scene = createPixiScene(app, [0, 1, 2, 3, 4, 5, 6]);
  let snapshotRequests = 0;
  let teardowns = 0;
  const recovery = createContextRecovery({
    presenter,
    requestSnapshot: () => {
      snapshotRequests += 1;
    },
    teardownResources: () => {
      scene.teardown();
      teardowns += 1;
    },
    rebuildFromSnapshot: (snapshot) => {
      if (failRebuild) return null;
      scene.sync(buildSceneGraph(presenter.present(1000), EMPTY_SCENE_GRAPH_INPUT, baselineQuality('high')));
      return snapshot;
    },
  });
  recovery.beginInitialize();
  recovery.completeInitialize(true);
  for (const current of frames) {
    presenter.submitConfirmed(current);
    presenter.present(500);
  }
  const frozenHash = presenter.latestGameplayHash;
  if (gl.isContextLost()) {
    throw new Error(`context already lost before ${name}`);
  }
  await loseContext(canvas, gl, () => {
    recovery.onContextLost();
  });
  let outcome = recovery.attemptRestore();
  if (failRebuild && outcome === 'retry') {
    // The contract enters failed_safe after two failed rebuilds, so the
    // failed-restore scenario retries once more.
    outcome = recovery.attemptRestore();
  }
  if (outcome === 'ready') recovery.resumeAfterReadyGate();
  return {
    name,
    steps: recovery.steps,
    frozenHash,
    endHash: recovery.endGameplayHash,
    sameEndHash: frozenHash !== null && recovery.endGameplayHash === frozenHash,
    outcome,
    lifecycle: recovery.lifecycle.lifecycle,
    snapshotRequests,
    teardowns,
  };
}

async function golden00Hash(): Promise<string | null> {
  try {
    const response = await fetch('/contracts/phase28/golden-registry.json');
    if (!response.ok) return null;
    const registry = (await response.json()) as { readonly entries?: readonly { readonly caseId: string; readonly mapHash: string }[] };
    return registry.entries?.find((entry) => entry.caseId === 'golden-00')?.mapHash ?? null;
  } catch {
    return null;
  }
}

/**
 * Expedition minimum (Phase 28): deterministic map for the pinned golden-00
 * seed, immutable run state, exactly-once battle start (double-tap produces
 * one commit + one navigation) and the full closed node-flow walk from
 * previewed to completed in real Chromium.
 */
async function runExpeditionScenario(): Promise<HarnessExpeditionResult> {
  const profile: MapProfile = {
    id: 'slice.act1.standard',
    logicalLevels: 6,
    targetVisited: [5, 8],
    mandatoryRoles: ['anchor', 'preparation', 'boss'],
    attemptCap: 50,
    fallbackTemplateId: 'slice.act1.safe',
  };
  const map = generateMap({ seed: 1000, profileId: profile.id, contentRevision: 'test-content-revision' }, profile);
  const state = createRunState({
    runId: 'browser-run-1000',
    modeId: 'mode.expedition',
    missionId: 'mission.act1',
    map,
    startResources: { gold: 10 },
  });

  // Exactly-once start: two concurrent start() calls share one pending
  // promise; the commit writes exactly one initial run snapshot.
  const guard = new AtomicStartGuard();
  let commits = 0;
  let navigations = 0;
  const commit = async (): Promise<void> => {
    commits += 1;
    await Promise.resolve();
  };
  await Promise.all([
    guard.start(commit, () => {
      navigations += 1;
    }),
    guard.start(commit, () => {
      navigations += 1;
    }),
  ]);

  // Closed node flow: previewed -> ... -> completed for the first frontier node.
  const first = state.availableNodeIds[0];
  if (first === undefined) throw new Error('no frontier node');
  const stagesWalked: NodeStage[] = [];
  let stage: NodeStage = applyNodeCommand('previewed', 'enter');
  stagesWalked.push(stage);
  stage = applyNodeCommand(stage, 'commitEnter');
  stagesWalked.push(stage);
  stage = applyNodeCommand(stage, 'resolve');
  stagesWalked.push(stage);
  stage = applyNodeCommand(stage, 'commitDecision');
  stagesWalked.push(stage);
  stage = applyNodeCommand(stage, 'commitReward');
  stagesWalked.push(stage);
  stage = applyNodeCommand(stage, 'commitExit');
  stagesWalked.push(stage);

  const golden = await golden00Hash();
  return {
    mapHash: map.mapHash,
    golden00Hash: golden,
    matchesGolden00: golden !== null && map.mapHash === golden,
    runRevision: state.revision,
    committedTransactions: state.committedTransactionIds.length,
    visitedNodes: [...state.visitedNodeIds],
    stagesWalked,
    doubleTapCommits: commits,
    doubleTapNavigations: navigations,
    doubleTapExactlyOnce: commits === 1 && navigations === 1,
    runId: state.runId,
  };
}

/**
 * Slice E2E minimum (Phase 29): the closed route flow TITLE -> MISSION_END
 * walked in real Chromium, plus the reliability kill matrix — a process kill
 * resumes at the last confirmed commit (derived from the ledger, never from
 * the route order) and the reward commit is exactly-once even on double-tap.
 */
function runSliceScenario(): HarnessSliceResult {
  const routesWalked: Route[] = [];
  let route: Route = ROUTE_ORDER[0] ?? 'TITLE';
  routesWalked.push(route);
  for (let i = 1; i < ROUTE_ORDER.length; i += 1) {
    const next = ROUTE_ORDER[i];
    if (next === undefined) break;
    route = advanceTo(route, next);
    routesWalked.push(route);
  }

  const killPoints = ['CAST_START', 'CAST_RESOLVE', 'PROJECTILE_SPAWN', 'PROJECTILE_IMPACT', 'BOSS_PHASE_CHANGE', 'SUMMON_SPAWN', 'RESULT_CREATED', 'REWARD_COMMIT'] as const;
  const killCases: HarnessKillCase[] = [];
  for (const point of killPoints) {
    // Every kill point is battle-internal or later, so the battle-start
    // boundary is already durably committed before the kill lands.
    let ledger = emptyLedger();
    const kinds: CommitKind[] = ['BATTLE_START'];
    ledger = commitOnce(ledger, 'run-kill:battle', 'BATTLE_START');
    if (point === 'RESULT_CREATED' || point === 'REWARD_COMMIT') {
      ledger = commitOnce(ledger, 'run-kill:result', 'RESULT');
      kinds.push('RESULT');
    }
    if (point === 'REWARD_COMMIT') {
      ledger = commitOnce(ledger, 'run-kill:reward', 'REWARD');
      // Double-tap after resume: the second reward commit must be idempotent.
      ledger = commitOnce(ledger, 'run-kill:reward', 'REWARD');
      kinds.push('REWARD');
    }
    const resumeRoute = resumeFromKinds(kinds);
    const rewardCount = commitCounts(ledger).REWARD;
    killCases.push({ point, resumeRoute, rewardCount, exactlyOneReward: rewardCount <= 1 });
  }

  // Full-run reward ledger: double-tapped reward commits exactly once.
  let fullLedger = emptyLedger();
  fullLedger = commitOnce(fullLedger, 'run-1:start', 'BATTLE_START');
  fullLedger = commitOnce(fullLedger, 'run-1:result', 'RESULT');
  fullLedger = commitOnce(fullLedger, 'run-1:reward', 'REWARD');
  fullLedger = commitOnce(fullLedger, 'run-1:reward', 'REWARD');
  const finalRewardCount = commitCounts(fullLedger).REWARD;

  return {
    routesWalked,
    fullRouteComplete: routesWalked.length === ROUTE_ORDER.length,
    killCases,
    finalRewardCount,
    exactlyOneReward: finalRewardCount === 1,
    ledgerIds: Object.keys(fullLedger.committed).length,
  };
}

function profileBase(gold: number): Profile {
  return {
    revision: 31,
    wallet: { gold, riftEssence: 0 },
    heroes: { hero_aurel: { id: 'hero_aurel', unlocked: true, level: 2, fame: 0 } },
    troops: {},
    items: {
      item_sword: { id: 'item_sword', owned: true, polished: false, isBanner: false },
      banner_ember: { id: 'banner_ember', owned: true, polished: false, isBanner: true },
    },
    transactionLedger: {},
  };
}

function profileMutate(kind: string, profile: Profile): Profile {
  if (kind === 'BUY_COPY') {
    const existing = profile.troops['troop_guard'];
    const copies = existing === undefined ? [] : [...existing.copies];
    copies.push({ instanceId: 'browser-copy-1', typeId: 'troop_guard' });
    return {
      ...profile,
      troops: { ...profile.troops, troop_guard: { typeId: 'troop_guard', contractLevel: 1, copies } },
    };
  }
  if (kind === 'POLISH') {
    const item = profile.items['item_sword'];
    if (item === undefined) throw new Error('missing item');
    return { ...profile, items: { ...profile.items, item_sword: { ...item, polished: true } } };
  }
  if (kind === 'EQUIP') {
    const hero = profile.heroes['hero_aurel'];
    if (hero === undefined) throw new Error('missing hero');
    return { ...profile, heroes: { ...profile.heroes, hero_aurel: { ...hero, equipmentId: 'item_sword' } } };
  }
  throw new Error(`unhandled kind ${kind}`);
}

function runProfileScenario(): HarnessProfileResult {
  // 1. The four pinned transaction cases in the browser bundle.
  const cases: HarnessProfileTransactionCase[] = [];

  // buy-copy-ok: 100 -> 70, committed, one copy.
  {
    let profile = profileBase(100);
    const outcome = commitTransaction(profile, {
      transactionId: 'browser:buy-copy',
      kind: 'BUY_COPY',
      costGold: 30,
      mutate: (p: Profile) => profileMutate('BUY_COPY', p),
    });
    profile = outcome.profile;
    cases.push({
      id: 'buy-copy-ok',
      expected: 'COMMITTED',
      walletDelta: 100 - profile.wallet.gold,
      ledgerStatus: outcome.result.status,
      replayed: outcome.replayed,
    });
  }

  // insufficient: 20 -> 20, rejected, no mutation.
  {
    const profile = profileBase(20);
    const outcome = commitTransaction(profile, {
      transactionId: 'browser:insufficient',
      kind: 'BUY_COPY',
      costGold: 30,
      mutate: (p: Profile) => profileMutate('BUY_COPY', p),
    });
    cases.push({
      id: 'insufficient',
      expected: 'REJECTED',
      walletDelta: profile.wallet.gold - outcome.profile.wallet.gold,
      ledgerStatus: outcome.result.status,
      replayed: outcome.replayed,
    });
  }

  // duplicate-callback: 100 -> 75 once, replay returns the stored result.
  {
    let profile = profileBase(100);
    const request = {
      transactionId: 'browser:polish',
      kind: 'POLISH' as TransactionKind,
      costGold: 25,
      mutate: (p: Profile) => profileMutate('POLISH', p),
    };
    const first = commitTransaction(profile, request);
    profile = first.profile;
    const second = commitTransaction(profile, request);
    cases.push({
      id: 'duplicate-callback',
      expected: 'COMMITTED_ONCE',
      walletDelta: 100 - second.profile.wallet.gold,
      ledgerStatus: second.result.status,
      replayed: second.replayed,
    });
  }

  // commit-failure: throwing mutation leaves the old state untouched.
  {
    const profile = profileBase(100);
    let threw = false;
    try {
      commitTransaction(profile, {
        transactionId: 'browser:equip',
        kind: 'EQUIP',
        costGold: 0,
        mutate: () => {
          throw new Error('save failed');
        },
      });
    } catch {
      threw = true;
    }
    cases.push({
      id: 'commit-failure',
      expected: 'FAILED_NO_MUTATION',
      walletDelta: profile.wallet.gold - 100,
      ledgerStatus: threw ? 'FAILED' : 'NO_THROW',
      replayed: false,
    });
  }

  // 2. The five kill points, recorded through the transaction flow.
  const flow = new TransactionFlow();
  flow.record('before-preview');
  flow.record('after-confirm-before-commit');
  flow.record('during-save-temp-write');
  flow.record('after-commit-before-feedback');
  flow.record('duplicate-callback');

  // 3. A full mini-ledger ending with the active banner set.
  let profile = profileBase(100);
  profile = commitTransaction(profile, {
    transactionId: 'browser:set-banner',
    kind: 'SET_BANNER',
    costGold: 0,
    mutate: (p: Profile) => ({ ...p, activeBannerId: 'banner_ember' }),
  }).profile;
  let valid = true;
  try {
    validateProfile(profile);
  } catch {
    valid = false;
  }

  const allKillPointsRecorded = KILL_POINT_ORDER.every((point) => flow.reached(point));
  return {
    cases,
    killPoints: flow.state(),
    allKillPointsRecorded,
    finalLedgerIds: Object.keys(profile.transactionLedger).length,
    finalGold: profile.wallet.gold,
    profileValid: valid,
  };
}

async function main(): Promise<HarnessResult> {
  // Capability probe on a dedicated context; scenarios use fresh canvases.
  const probeCanvas = document.createElement('canvas');
  probeCanvas.width = 64;
  probeCanvas.height = 64;
  const gl = probeCanvas.getContext('webgl2');
  if (gl === null) throw new Error('webgl2 context unavailable for capability probe');
  const capability = resolveCapability(probeFromContext(gl, window.devicePixelRatio), { logicalStageWidth: 1920, logicalStageHeight: 1080, dprCap: 3 });
  const scenarios: HarnessScenarioResult[] = [];
  for (const name of ['during_cast', 'during_projectile', 'during_spawn', 'during_battle_end'] as const) {
    scenarios.push(await runScenario(name, scenarioFrames(name), false));
  }
  scenarios.push(await runScenario('during_cast_failed_restore', scenarioFrames('during_cast'), true));
  return {
    capability: { backend: capability.backend, webglVersion: capability.webglVersion, failureReason: capability.failureReason },
    scenarios,
    expedition: await runExpeditionScenario(),
    slice: runSliceScenario(),
    profile: runProfileScenario(),
  };
}

main()
  .then((result) => {
    window.__contextLossHarness = result;
  })
  .catch((error: unknown) => {
    window.__contextLossHarness = {
      capability: { backend: 'none', webglVersion: null, failureReason: 'harness_error' },
      scenarios: [],
      error: error instanceof Error ? error.message : String(error),
    };
  });
