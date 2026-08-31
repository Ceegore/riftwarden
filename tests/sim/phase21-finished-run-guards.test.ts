/**
 * Phase 21 §9 FINISHED-RUN GUARD BREADTH. `finish()` marks the run finished
 * and the runner's `guard()` rejects EVERY further mutation with
 * `RUN_ALREADY_FINISHED`. This sweeps the FULL mutation surface of the REAL
 * `RunManager` (the facade React uses) — enter / act / resolve / resolveBattle
 * (both verdicts) / advance / visit — plus the durability contract of a
 * finished run:
 *
 *   1. EVERY mutation family throws cleanly (an ExpeditionError with code
 *      RUN_ALREADY_FINISHED), including a replay of the exact transaction that
 *      committed the last action before finish;
 *   2. the finished AUTOSAVE stays byte-identical — encode → decode → restore
 *      → re-encode is a fixed point, and `RunManager.restore()` reloads the
 *      finished run (still finished, still guarded);
 *   3. `RunManager.abandon()` clears cleanly EVEN WHEN the run is finished —
 *      no stale active instance, no stale save;
 *   4. the runner-level guard is identical (the manager is a thin autosaving
 *      facade over the same runner — both layers must agree).
 */
import { describe, expect, it } from 'vitest';
import { RunManager } from '../../src/game/expedition/run-manager.js';
import { mainPath, restoreExpedition } from '../../src/game/expedition/expedition-runner.js';
import { decodeExpeditionSave, encodeExpeditionSave, restoreExpeditionSave } from '../../src/game/expedition/expedition-save.js';
import { ExpeditionError } from '../../src/game/expedition/expedition-error.js';
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';

const store = new Map<string, string>();
(globalThis as { localStorage: unknown }).localStorage = {
  getItem(key: string) { return store.get(String(key)) ?? null; },
  setItem(key: string, value: string) { store.set(String(key), String(value)); },
  removeItem(key: string) { store.delete(String(key)); },
  clear() { store.clear(); },
  get length() { return store.size; },
  key(index: number) { return [...store.keys()][index] ?? null; },
};

/** Walks a fresh manager down the main path and calls finish(). */
function finishedManager(seed: number): RunManager {
  store.clear();
  const mgr = RunManager.create(seed, 300);
  const path = mainPath(mgr.map);
  const runId = mgr.snapshot().state.runId;
  for (let guard = 0; guard < path.length; guard += 1) {
    const snap = mgr.snapshot();
    const nodeId = snap.currentNodeId;
    const type = snap.currentNodeType;
    mgr.enter(enterTransactionId(runId, nodeId));
    if (type === 'battle' || type === 'elite' || type === 'boss') {
      mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE', 'none'), nodeId, action: 'ENGAGE', completedKinds: [] });
    } else {
      mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', 'none'), nodeId, action: 'DECLINE' });
    }
    mgr.resolve();
    const next = path[guard + 1];
    if (next === undefined) break;
    mgr.advance(next);
  }
  mgr.finish();
  return mgr;
}

function expectFinishedGuard(fn: () => unknown): void {
  let thrown: unknown;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(ExpeditionError);
  expect((thrown as ExpeditionError).code).toBe('RUN_ALREADY_FINISHED');
}

describe('P21 §9 finished-run guard breadth', () => {
  it('EVERY mutation family on a finished manager throws RUN_ALREADY_FINISHED (enter/act/resolve/resolveBattle×2/advance/visit)', () => {
    const mgr = finishedManager(801);
    const snap = mgr.snapshot();
    const nodeId = snap.currentNodeId;
    const runId = snap.state.runId;
    expect(snap.runStatus).toBe('finished');

    // enter — including a brand-new transaction id.
    expectFinishedGuard(() => mgr.enter(enterTransactionId(runId, 'n_phantom')));
    // act — including a replay of an action that COMMITTED pre-finish (the
    // last DECLINE/ENGAGE on the final node): exactly-once must not resurrect.
    expectFinishedGuard(() => mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', 'none'), nodeId, action: 'DECLINE' }));
    // resolve / resolveBattle (both verdicts) / advance / visit.
    expectFinishedGuard(() => mgr.resolve());
    expectFinishedGuard(() => mgr.resolveBattle(true));
    expectFinishedGuard(() => mgr.resolveBattle(false));
    const reachable = snap.reachableNodes[0];
    if (reachable !== undefined) {
      expectFinishedGuard(() => mgr.advance(reachable));
    }
    expectFinishedGuard(() => mgr.visit(enterTransactionId(runId, nodeId)));
    // The run state never moved: still finished, same revision.
    expect(mgr.snapshot().state.revision).toBe(snap.state.revision);
    expect(mgr.snapshot().runStatus).toBe('finished');
  });

  it('the finished AUTOSAVE is a fixed point: encode → decode → restore → re-encode is byte-identical', () => {
    const mgr = finishedManager(802);
    const runner = restoreExpedition(mgr.snapshot().state, mgr.map, mgr.snapshot().currentNodeId);
    const serialized = encodeExpeditionSave(runner);
    const decoded = decodeExpeditionSave(JSON.parse(serialized));
    expect(decoded.state.runStatus).toBe('finished');
    const restored = restoreExpeditionSave(serialized, mgr.map);
    expect(restored.state.runStatus).toBe('finished');
    expect(encodeExpeditionSave(restored)).toBe(serialized);
    // The restored finished runner guards identically.
    expectFinishedGuard(() => restored.enter('post-restore-enter'));
  });

  it('RunManager.restore() reloads a FINISHED run — still finished, still guarded — and a second finish() is a no-op', () => {
    const mgr = finishedManager(803);
    const revision = mgr.snapshot().state.revision;
    // finish() twice: idempotent, no revision bump, no error.
    mgr.finish();
    expect(mgr.snapshot().state.revision).toBe(revision);
    expect(mgr.snapshot().runStatus).toBe('finished');
    // Restore: the persisted finished save reloads as a finished run.
    const restored = RunManager.restore();
    expect(restored).not.toBeNull();
    if (restored === null) throw new Error('restore failed');
    expect(restored.snapshot().runStatus).toBe('finished');
    expect(restored.snapshot().state.revision).toBe(revision);
    // The restored finished manager is guarded too.
    expectFinishedGuard(() => restored.resolve());
    expectFinishedGuard(() => restored.act({ transactionId: 'post-restore-act', nodeId: restored.snapshot().currentNodeId, action: 'DECLINE' }));
  });

  it('abandon() clears a finished run cleanly: no active instance, no stale save, and the store is empty', () => {
    const mgr = finishedManager(804);
    expect(mgr.snapshot().runStatus).toBe('finished');
    expect(RunManager.hasSave()).toBe(true);
    RunManager.abandon();
    expect(RunManager.active).toBeNull();
    expect(RunManager.hasSave()).toBe(false);
    expect(store.size).toBe(0);
    // A fresh run can start immediately after abandoning a finished one.
    const fresh = RunManager.create(805, 300);
    expect(fresh.snapshot().runStatus).toBe('active');
    expect(fresh.snapshot().state.revision).toBeGreaterThanOrEqual(0);
  });

  it('the RUNNER-level guard is identical to the manager-level guard (both layers agree)', () => {
    const mgr = finishedManager(806);
    const runner = restoreExpedition(mgr.snapshot().state, mgr.map, mgr.snapshot().currentNodeId);
    const runId = runner.state.runId;
    const nodeId = runner.currentNodeId;
    expectFinishedGuard(() => runner.enter('runner-enter'));
    expectFinishedGuard(() => runner.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', 'none'), nodeId, action: 'DECLINE' }));
    expectFinishedGuard(() => runner.resolve());
    expectFinishedGuard(() => runner.resolveBattle(true));
    const reachable = runner.reachableNodes[0];
    if (reachable !== undefined) {
      expectFinishedGuard(() => runner.advance(reachable));
    }
    expectFinishedGuard(() => runner.visit('runner-visit'));
  });
});
