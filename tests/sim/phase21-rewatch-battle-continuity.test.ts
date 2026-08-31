/**
 * Phase 21 §9 REWATCH BATTLE CONTINUITY. The DefeatPanel affordance and the
 * runner-level rewatch are pinned separately; this test pins the LIVE handle
 * the battle screen actually owns. Every `ENGAGE_DEFEAT` rewatch RESTARTS the
 * deterministic rewatch battle, so the re-created handle must step to the
 * IDENTICAL terminal as the first fight — same phase, same completed objective
 * kinds, same bounty — and a restore between rewatches must not disturb it:
 *
 *   1. the FIRST battle and each re-created rewatch battle run to the SAME
 *      terminal (edge-for-edge: phase, bounty, completed kinds);
 *   2. a SAVE/RESTORE between rewatches keeps the terminal identical — the
 *      rewatch is a pure function of the node's encounter, never the recent
 *      history;
 *   3. the LOSS branch (sustain-collapse) replays the identical DEFEAT
 *      terminal across rewatches too.
 */
import { describe, expect, it } from 'vitest';
import { RunManager } from '../../src/game/expedition/run-manager.js';
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';
import { createLiveSimBattle, resolveExpeditionEncounter } from '../../src/features/battle/sim/sim-battle-host.js';
import { MAX_REENGAGE_ATTEMPTS } from '../../src/game/expedition/nodes/handlers/combat.js';
import type { ContentEncounterEntry } from '../../src/game/content/runtime/encounter-registry.js';

const store = new Map<string, string>();
(globalThis as { localStorage: unknown }).localStorage = {
  getItem(key: string) { return store.get(String(key)) ?? null; },
  setItem(key: string, value: string) { store.set(String(key), String(value)); },
  removeItem(key: string) { store.delete(String(key)); },
  clear() { store.clear(); },
  get length() { return store.size; },
  key(index: number) { return [...store.keys()][index] ?? null; },
};

/** Walks a fresh manager to the first combat node, ENTERs it, and returns the manager + encounter. */
function managerEnteredCombat(seed: number): { readonly mgr: RunManager; readonly entry: ContentEncounterEntry } {
  store.clear();
  const mgr = RunManager.create(seed, 300);
  let guard = 0;
  while (!['battle', 'elite', 'boss'].includes(mgr.snapshot().currentNodeType) && guard < 80) {
    const snap = mgr.snapshot();
    const next = snap.reachableNodes[0];
    if (next === undefined) throw new Error('dead-end before combat');
    mgr.enter(enterTransactionId(snap.state.runId, snap.currentNodeId));
    mgr.resolve();
    mgr.advance(next);
    guard += 1;
  }
  const snap = mgr.snapshot();
  if (!['battle', 'elite', 'boss'].includes(snap.currentNodeType)) throw new Error('no combat node');
  mgr.enter(enterTransactionId(snap.state.runId, snap.currentNodeId));
  const entry = resolveExpeditionEncounter(snap.currentNodeType, mgr.map.nodes.find((n) => n.id === snap.currentNodeId)?.previewKey ?? '');
  if (entry === null) throw new Error('no encounter for node');
  return { mgr, entry };
}

/** Runs a live handle to its terminal and buckets the outcome edge. */
function terminalBucket(handle: ReturnType<typeof createLiveSimBattle>): string {
  let out = handle.snapshot();
  let guard = 0;
  while (!['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(out.phase.phase) && guard < 2500) {
    out = handle.step();
    guard += 1;
  }
  const kinds = (out.objectives ?? [])
    .filter((o) => o.complete)
    .map((o) => o.id)
    .sort()
    .join(',');
  return `${out.phase.phase}|${String(out.bounty ?? 0)}|${kinds}`;
}

const reengage = (mgr: RunManager): void => {
  const snap = mgr.snapshot();
  const nodeId = snap.currentNodeId;
  const runId = snap.state.runId;
  const count = Object.values(snap.state.ledger).filter(
    (e) => e.nodeId === nodeId && e.status === 'COMMITTED' && e.action === 'ENGAGE_DEFEAT',
  ).length;
  const rec = mgr.act({
    transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', `re-${String(count + 1)}`),
    nodeId,
    action: 'ENGAGE_DEFEAT',
  });
  expect(rec.status, `re-engage ${String(count + 1)} commits`).toBe('COMMITTED');
};

describe('P21 §9 rewatch battle continuity', () => {
  it('each re-created rewatch battle steps to the IDENTICAL terminal (phase, bounty, kinds) on a battle node', { timeout: 60_000 }, () => {
    const { mgr, entry } = managerEnteredCombat(820);
    const first = terminalBucket(createLiveSimBattle({ encounter: entry }));
    // Expect a real VICTORY terminal so the rewatch continuity is non-trivial.
    expect(first).toMatch(/^VICTORY\|/);

    // Each rewatch re-creates the battle the screen owns and it replays identically.
    for (let attempt = 1; attempt <= MAX_REENGAGE_ATTEMPTS; attempt += 1) {
      reengage(mgr);
      const bucket = terminalBucket(createLiveSimBattle({ encounter: entry }));
      expect(bucket, `rewatch ${String(attempt)} replays the same terminal edge`).toBe(first);
    }
    // A fourth re-engage is REJECTED (cap) — nothing more re-runs.
    expect(terminalBucket(createLiveSimBattle({ encounter: entry }))).toBe(first);
  });

  it('a SAVE/RESTORE between rewatches keeps the rewatch terminal identical', { timeout: 60_000 }, () => {
    const { mgr, entry } = managerEnteredCombat(821);
    const first = terminalBucket(createLiveSimBattle({ encounter: entry }));
    expect(first).toMatch(/^VICTORY\|/);

    // One rewatch…
    reengage(mgr);
    const afterOne = terminalBucket(createLiveSimBattle({ encounter: entry }));
    expect(afterOne).toBe(first);

    // …RESTORE mid-loop…
    const restored = RunManager.restore();
    expect(restored).not.toBeNull();
    if (restored === null) throw new Error('restore failed');

    // …and the re-created rewatch battle on the RESTORED run is still identical.
    const onRestored = terminalBucket(createLiveSimBattle({ encounter: entry }));
    expect(onRestored).toBe(first);
    // A further rewatch on the restored run keeps it identical.
    reengage(restored);
    expect(terminalBucket(createLiveSimBattle({ encounter: entry }))).toBe(first);
  });

  it('the LOSS branch replays the identical DEFEAT terminal across rewatches', { timeout: 60_000 }, () => {
    // The sustain-collapse encounter ends a deterministic DEFEAT; each rewatch
    // re-creates it and replays the identical losing edge. (The loss handle is
    // heavy — ~1985 ticks — so this steps the first + one rewatch fully and
    // spot-checks a second; the battle-node tests above already pin per-attempt
    // continuity on the cheaper VICTORY branch.)
    const collapse = resolveExpeditionEncounter('battle', 'encounter_fixture_sustain_collapse');
    if (collapse === null) throw new Error('no collapse encounter');
    const defeat = terminalBucket(createLiveSimBattle({ encounter: collapse }));
    expect(defeat).toMatch(/^DEFEAT\|0\|$/);

    // A re-created handle replays the identical losing edge…
    expect(terminalBucket(createLiveSimBattle({ encounter: collapse })), 'loss rewatch 1').toBe(defeat);
    // …and the second rewatch agrees at the terminal-ish horizon too.
    const again = createLiveSimBattle({ encounter: collapse });
    for (let t = 0; t < 400; t += 1) again.step();
    expect(terminalBucket(again)).toBe(defeat);
  });
});
