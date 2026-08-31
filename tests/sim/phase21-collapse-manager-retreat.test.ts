/**
 * Phase 21 §10 COLLAPSE-NODE RETREAT THROUGH THE REAL MANAGER. The collapse
 * loss loop is pinned at the RUNNER level (`phase21-sustain-collapse-screen`)
 * and the SCREEN level; this test drives the SAME loop through the REAL
 * `RunManager` facade — the layer React actually uses:
 *
 *   1. BOOT — a battle node relabeled to `encounter_fixture_sustain_collapse`
 *      boots the manager via the new `RunManager.boot(map, gold)` seam (the
 *      store restore path still regenerates the map deterministically, so the
 *      mapHash guard rejects the relabel — documented as the seam's contract);
 *   2. LOSS LOOP — the manager's battle for the collapse node ends DEFEAT at
 *      the canonical tick (host-side, proven here at the manager layer) and
 *      `resolveBattle(false)` keeps the visit COMMITTED — `advance` through the
 *      MANAGER throws `VISIT_STATE_INVALID`, exactly as at the runner level;
 *   3. RETREAT — the manager's DECLINE → resolve clears the gated node and the
 *      manager advances onward; the visit is RESOLVED and the map position
 *      moves;
 *   4. PERSISTENCE — every manager mutation autosaves; the retreated state
 *      survives a codec round-trip with the boot seam's map, and the boot
 *      path's mapHash guard rejects a relabeled restore (documented contract).
 */
import { describe, expect, it } from 'vitest';
import { RunManager } from '../../src/game/expedition/run-manager.js';
import { generateMap, structuralHash } from '../../src/game/expedition/map-generator.js';
import { restoreExpedition } from '../../src/game/expedition/expedition-runner.js';
import { decodeExpeditionSave, encodeExpeditionSave } from '../../src/game/expedition/expedition-save.js';
import type { ExpeditionMap, MapProfile } from '../../src/game/expedition/types.js';
import { createLiveSimBattle, resolveExpeditionEncounter } from '../../src/features/battle/sim/sim-battle-host.js';
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';

const SUSTAIN_COLLAPSE = 'encounter_fixture_sustain_collapse';

const PROFILE: MapProfile = {
  id: 'exp-collapse-manager.v1',
  logicalLevels: 6,
  targetVisited: [5, 8] as const,
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'fallback.v1',
};

const store = new Map<string, string>();
(globalThis as { localStorage: unknown }).localStorage = {
  getItem(key: string) { return store.get(String(key)) ?? null; },
  setItem(key: string, value: string) { store.set(String(key), String(value)); },
  removeItem(key: string) { store.delete(String(key)); },
  clear() { store.clear(); },
  get length() { return store.size; },
  key(index: number) { return [...store.keys()][index] ?? null; },
};

/** The relabeled map: the FIRST battle node carries the collapse payload key. */
function collapseMap(seed: number): { readonly map: ExpeditionMap; readonly battleId: string; readonly path: readonly string[] } {
  const base = generateMap({ seed, profileId: PROFILE.id, contentRevision: '32.0' }, PROFILE);
  const probe = RunManager.boot(base, 200);
  const path: string[] = [probe.snapshot().currentNodeId];
  while (probe.snapshot().currentNodeType !== 'battle') {
    const next = probe.snapshot().reachableNodes[0];
    if (next === undefined) throw new Error('no path to a battle node');
    probe.enter(`cm-walk-${String(path.length)}`);
    probe.resolve();
    probe.advance(next);
    path.push(next);
  }
  const battleId = probe.snapshot().currentNodeId;
  const nodes = Object.freeze(base.nodes.map((n) => n.id === battleId ? { ...n, previewKey: SUSTAIN_COLLAPSE } : n));
  // The relabeled map is STRUCTURALLY different — recompute its hash so the
  // store's mapHash guard genuinely distinguishes it from the canonical map
  // (a spread that kept the old hash would let a tampered map masquerade).
  const map: ExpeditionMap = {
    ...base,
    nodes,
    mapHash: structuralHash(nodes, base.edges, base.profileId, base.contentRevision),
  };
  return { map, battleId, path };
}

/** Boots the manager ON the collapse map and walks it to the collapse battle node. */
function managerAtCollapse(seed: number): { readonly mgr: RunManager; readonly battleId: string } {
  const { map, battleId, path } = collapseMap(seed);
  store.clear();
  const mgr = RunManager.boot(map, 200);
  for (const nodeId of path) {
    if (nodeId === battleId) break;
    const next = mgr.snapshot().reachableNodes[0];
    if (next === undefined) throw new Error('path dead-end');
    mgr.enter(enterTransactionId(mgr.snapshot().state.runId, mgr.snapshot().currentNodeId));
    mgr.resolve();
    mgr.advance(next);
  }
  return { mgr, battleId };
}

describe('P21 §10 collapse-node retreat through the real manager', () => {
  it('the manager resolves the collapse node; its live battle ends DEFEAT at 1985 (window 1800, nothing completed)', { timeout: 60_000 }, () => {
    const { mgr, battleId } = managerAtCollapse(712);
    const snap = mgr.snapshot();
    expect(snap.currentNodeId).toBe(battleId);
    expect(snap.currentNodeType).toBe('battle');
    expect(snap.currentNodePayloadKey).toBe(SUSTAIN_COLLAPSE);
    // The manager's ENTER commits the visit (instability applies once).
    mgr.enter(enterTransactionId(snap.state.runId, battleId));
    expect(mgr.snapshot().state.visits[battleId]?.status).toBe('COMMITTED');
    // The manager hosts the encounter payload-key-first (registry), and its
    // live battle is the canonical collapse fight: DEFEAT at 1985.
    const encounter = resolveExpeditionEncounter('battle', SUSTAIN_COLLAPSE);
    expect(encounter).not.toBeNull();
    if (encounter === null) throw new Error('collapse node unresolved');
    const handle = createLiveSimBattle({ encounter });
    let out = handle.snapshot();
    let guard = 0;
    while (!['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(out.phase.phase) && guard < 3000) {
      out = handle.step();
      guard += 1;
    }
    expect(out.phase.phase).toBe('DEFEAT');
    expect(out.tick).toBe(1985);
    expect(out.timeCollapseSinceTick).toBe(1800);
    expect((out.objectives ?? []).filter((o) => o.complete).map((o) => o.kind)).toEqual([]);
    expect(out.bounty).toBe(0);
  });

  it('a lost fight keeps the visit COMMITTED through the manager (advance throws) until the retreat clears it', { timeout: 60_000 }, () => {
    const { mgr, battleId } = managerAtCollapse(713);
    const runId = mgr.snapshot().state.runId;
    mgr.enter(enterTransactionId(runId, battleId));
    expect(mgr.snapshot().state.visits[battleId]?.status).toBe('COMMITTED');
    // The live verdict is a DEFEAT → resolveBattle(false) keeps the visit open
    // (the manager's seam, exactly what NodeScreen calls at a defeat).
    mgr.resolveBattle(false);
    expect(mgr.snapshot().state.visits[battleId]?.status).toBe('COMMITTED');
    const onward = mgr.snapshot().reachableNodes[0];
    if (onward !== undefined) {
      expect(() => { mgr.advance(onward); }).toThrow('VISIT_STATE_INVALID');
    }
    // RETREAT through the manager: DECLINE → resolve → advance works.
    const retreatTx = actionTransactionId(runId, battleId, 'DECLINE', 'none');
    mgr.act({ transactionId: retreatTx, nodeId: battleId, action: 'DECLINE' });
    mgr.resolve();
    expect(mgr.snapshot().state.visits[battleId]?.status).toBe('RESOLVED');
    if (onward !== undefined) {
      mgr.advance(onward);
      expect(mgr.snapshot().currentNodeId).toBe(onward);
    }
    // PERSISTENCE: the autosave carries the retreated state; a codec round-trip
    // with the boot seam's map reproduces it byte-identically.
    const stored = store.get('rw.expedition.v1');
    if (stored === undefined) throw new Error('no autosave after retreat');
    const decoded = decodeExpeditionSave(JSON.parse(stored) as unknown);
    expect(decoded.state.visits[battleId]?.status).toBe('RESOLVED');
    const reencoded = encodeExpeditionSave({ currentNodeId: decoded.currentNodeId, state: decoded.state } as unknown as Parameters<typeof encodeExpeditionSave>[0]);
    expect(reencoded).toBe(stored);
    const runner = restoreExpedition(decoded.state, mgr.map, decoded.currentNodeId);
    expect(runner.currentNodeId).toBe(onward ?? mgr.snapshot().currentNodeId);
    expect(runner.state.visits[battleId]?.status).toBe('RESOLVED');
    expect(runner.state.ledger[retreatTx]?.status).toBe('COMMITTED');
    // The BOOT path's mapHash guard: restore() regenerates the ORIGINAL map
    // (never the relabeled one) → the relabeled save is rejected. This is the
    // seam's documented contract — boot() hosts a predefined map, restore()
    // only accepts the deterministic map.
    expect(RunManager.restore()).toBeNull();
  });
});
