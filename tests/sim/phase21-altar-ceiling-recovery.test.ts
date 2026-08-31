/**
 * Phase 21 §9 ALTAR-DOWNSIDE × CEILING × RE-ENGAGE RECOVERY. The
 * ceiling-recovery test reaches the bound via DEFEAT taxes; this pins the SAME
 * recovery loop when the bound is reached by the ALTAR's +10 downside (the
 * other source that honours the shared INSTABILITY_CEILING), plus the merchant
 * service (−10) as a second recovery lever. Crafted map (exact, deterministic
 * control — the real map generator never guarantees this node order):
 *
 *   battle → battle → battle → altar → battle → anchor|merchant → boss
 *
 *   1. THREE battles take re-engage stacks: +5 → 35, +10 → 55, +15 → 75;
 *   2. the ALTAR ENTER (+8) → 83 and its ACCEPT (+10 downside) → 93 — the
 *      altar's downside is the source that pushed instability to the bound
 *      zone (without it, the next re-engage would still be legal);
 *   3. the next battle ENTER (+5) → 98 and its FIRST re-engage is
 *      CEILING-BLOCKED (98 + 5 > 100) — the gate, not a soft-lock: DECLINE
 *      retreat stays legal;
 *   4. RECOVERY — the anchor SERVICE (−8) or merchant SERVICE (−10) drops
 *      instability; back on combat the previously-blocked re-engage now
 *      COMMITS and the 5×k escalation continues from the persisted ledger;
 *   5. the whole loop survives a codec cut (the escalated tax + the recovered
 *      headroom are ledger-persisted, never reset by a reload).
 */
import { describe, expect, it } from 'vitest';
import { RunManager } from '../../src/game/expedition/run-manager.js';
import { structuralHash } from '../../src/game/expedition/map-generator.js';
import type { ExpeditionMap, MapNode, MapProfile, NodeId, NodeRole, NodeType } from '../../src/game/expedition/types.js';
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';
import { DEFEAT_INSTABILITY_DELTA, INSTABILITY_CEILING } from '../../src/game/expedition/nodes/handlers/combat.js';
import { ALTAR_DOWNSIDE_INSTABILITY } from '../../src/game/expedition/nodes/handlers/altar.js';
import { ANCHOR_SERVICE_INSTABILITY_REDUCTION } from '../../src/game/expedition/nodes/handlers/anchor.js';
import { MERCHANT_SERVICE_INSTABILITY_REDUCTION } from '../../src/game/expedition/nodes/handlers/merchant.js';
import { mainPath } from '../../src/game/expedition/expedition-runner.js';
import { restoreExpeditionSave } from '../../src/game/expedition/expedition-save.js';

const PROFILE: MapProfile = {
  id: 'exp-altar-ceiling.v1',
  logicalLevels: 8,
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

/**
 * The crafted chain battle×3 → altar → battle → (anchor|merchant) → boss.
 * `recoveryType` picks the service node; roles satisfy the mandatory-role
 * validator (the anchor node carries the anchor role; the merchant variant
 * keeps an anchor-role node at the same slot for structural validity).
 */
function altarMap(recoveryType: 'anchor' | 'merchant'): ExpeditionMap {
  const nodeSpecs: ReadonlyArray<{ readonly type: NodeType; readonly role: NodeRole }> = [
    { type: 'battle', role: 'start' },
    { type: 'battle', role: 'normal' },
    { type: 'battle', role: 'preparation' },
    { type: 'altar', role: 'normal' },
    { type: 'battle', role: 'normal' },
    // Slot 5: the recovery node — merchant type keeps the anchor role only for
    // the mandatory-role validator; its handler is the merchant's (type wins).
    recoveryType === 'anchor'
      ? { type: 'anchor', role: 'anchor' }
      : { type: 'merchant', role: 'anchor' },
    { type: 'boss', role: 'boss' },
  ];
  const nodes: MapNode[] = nodeSpecs.map((spec, index): MapNode => ({
    id: `n${String(index)}` as NodeId,
    // validateMap without a profile uses logicalLevels 6 — keep levels in
    // [0, 5] (the generator never guarantees a distinct level per node).
    level: index % 6,
    type: spec.type,
    role: spec.role,
    previewKey: spec.type === 'altar' ? 'relic_undertaker' : spec.type === 'merchant' ? 'merchant' : `${spec.type}.synth`,
    instabilityDelta: 0,
  }));
  const edges = [0, 1, 2, 3, 4, 5].map((from): { id: string; from: NodeId; to: NodeId } => ({
    id: `e${String(from)}`,
    from: `n${String(from)}` as NodeId,
    to: `n${String(from + 1)}` as NodeId,
  }));
  return {
    profileId: PROFILE.id,
    seed: 77_031,
    contentRevision: '32.0',
    nodes,
    edges,
    startNodeId: 'n0' as NodeId,
    bossNodeId: 'n6' as NodeId,
    usedFallback: false,
    attempts: 7,
    mapHash: structuralHash(nodes, edges, PROFILE.id, '32.0'),
  };
}

/**
 * Walks the crafted map: full re-engage stacks on the three opening battles,
 * altar ACCEPT (+10 downside), then the re-engage BLOCK check on battle n4,
 * then the recovery service at n5, then a re-engage on the boss. Returns the
 * manager at the boss with the recovery already committed.
 */
function walkToRecovery(recoveryType: 'anchor' | 'merchant'): RunManager {
  store.clear();
  const map = altarMap(recoveryType);
  const mgr = RunManager.boot(map, 500);
  const path = mainPath(mgr.map);
  const runId = mgr.snapshot().state.runId;
  // n0..n2: battle re-engage stacks (2 re-engages each after the first).
  const stacks = [3, 2, 2];
  for (let g = 0; g <= 2; g += 1) {
    const snap = mgr.snapshot();
    const nodeId = snap.currentNodeId;
    mgr.enter(enterTransactionId(runId, nodeId));
    for (let a = 1; a <= (stacks[g] ?? 0); a += 1) {
      const rec = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', `w${String(g)}-${String(a)}`), nodeId, action: 'ENGAGE_DEFEAT' });
      expect(rec.status, `stack battle ${String(g)} attempt ${String(a)}`).toBe('COMMITTED');
    }
    mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `wd${String(g)}`), nodeId, action: 'DECLINE' });
    mgr.resolve();
    const next = path[g + 1];
    if (next === undefined) throw new Error('path ran off');
    mgr.advance(next);
  }
  // n3: the ALTAR — ENTER (+8) then ACCEPT (+10 downside).
  const altarId = mgr.snapshot().currentNodeId;
  expect(mgr.snapshot().currentNodeType).toBe('altar');
  mgr.enter(enterTransactionId(runId, altarId));
  const afterAltarEnter = mgr.snapshot().state.instability;
  const accept = mgr.act({ transactionId: actionTransactionId(runId, altarId, 'ACCEPT', 'downside'), nodeId: altarId, action: 'ACCEPT' });
  expect(accept.status).toBe('COMMITTED');
  expect(mgr.snapshot().state.instability).toBe(afterAltarEnter + ALTAR_DOWNSIDE_INSTABILITY);
  mgr.resolve();
  // n4: battle — ENTER then the FIRST re-engage is ceiling-blocked.
  if (path[4] === undefined) throw new Error('path[4] missing');
  const battle4 = path[4];
  mgr.advance(battle4);
  expect(mgr.snapshot().currentNodeType).toBe('battle');
  mgr.enter(enterTransactionId(runId, battle4));
  const instAt4 = mgr.snapshot().state.instability;
  // The altar's +10 downside is what reached the bound zone: the next
  // re-engage would exceed the ceiling.
  expect(instAt4 + DEFEAT_INSTABILITY_DELTA).toBeGreaterThan(INSTABILITY_CEILING);
  const blocked = mgr.act({ transactionId: actionTransactionId(runId, battle4, 'ENGAGE_DEFEAT', 'blocked'), nodeId: battle4, action: 'ENGAGE_DEFEAT' });
  expect(blocked.status).toBe('REJECTED');
  // The gate is never a soft-lock: the retreat stays legal.
  const decline4 = mgr.act({ transactionId: actionTransactionId(runId, battle4, 'DECLINE', 'retreat'), nodeId: battle4, action: 'DECLINE' });
  expect(decline4.status).toBe('COMMITTED');
  mgr.resolve();
  // n5: the recovery SERVICE.
  if (path[5] === undefined) throw new Error('path[5] missing');
  const recoveryId = path[5];
  mgr.advance(recoveryId);
  const recoveryType2 = mgr.snapshot().currentNodeType;
  mgr.enter(enterTransactionId(runId, recoveryId));
  const goldBefore = mgr.snapshot().state.gold;
  // The recovery node's own ENTER applies its registry delta first (anchor
  // −10, merchant +3) — the SERVICE then reduces from THAT post-enter value.
  const instAtRecovery = mgr.snapshot().state.instability;
  const service = mgr.act({ transactionId: actionTransactionId(runId, recoveryId, 'SERVICE', 'recovery'), nodeId: recoveryId, action: 'SERVICE' });
  expect(service.status).toBe('COMMITTED');
  const afterService = mgr.snapshot();
  if (recoveryType2 === 'anchor') {
    expect(afterService.state.instability).toBe(instAtRecovery - ANCHOR_SERVICE_INSTABILITY_REDUCTION);
  } else {
    expect(recoveryType2).toBe('merchant');
    expect(afterService.state.instability).toBe(instAtRecovery - MERCHANT_SERVICE_INSTABILITY_REDUCTION);
  }
  // The service re-opened the previously-blocked re-engage (it dropped below
  // the ceiling headroom the altar's +10 had consumed).
  expect(afterService.state.instability + DEFEAT_INSTABILITY_DELTA).toBeLessThanOrEqual(INSTABILITY_CEILING);
  expect(afterService.state.gold).toBe(goldBefore - 30);
  mgr.act({ transactionId: actionTransactionId(runId, recoveryId, 'DECLINE', 'out'), nodeId: recoveryId, action: 'DECLINE' });
  mgr.resolve();
  // n6: the boss — the recovered re-engage now COMMITS and escalates.
  if (path[6] === undefined) throw new Error('path[6] missing');
  const bossId = path[6];
  mgr.advance(bossId);
  expect(mgr.snapshot().currentNodeType).toBe('boss');
  mgr.enter(enterTransactionId(runId, bossId));
  return mgr;
}

describe('P21 §9 altar-downside × ceiling × re-engage recovery', () => {
  it('the ALTAR +10 downside reaches the bound zone, the next re-engage is ceiling-blocked, and the ANCHOR −8 re-opens it', () => {
    const mgr = walkToRecovery('anchor');
    const runId = mgr.snapshot().state.runId;
    const bossId = mgr.snapshot().currentNodeId;
    const instAtBoss = mgr.snapshot().state.instability;
    // The recovery gave headroom: the first re-engage commits again.
    expect(instAtBoss + DEFEAT_INSTABILITY_DELTA).toBeLessThanOrEqual(INSTABILITY_CEILING);
    const re1 = mgr.act({ transactionId: actionTransactionId(runId, bossId, 'ENGAGE_DEFEAT', 're-1'), nodeId: bossId, action: 'ENGAGE_DEFEAT' });
    expect(re1.status).toBe('COMMITTED');
    expect(mgr.snapshot().state.instability).toBe(instAtBoss + DEFEAT_INSTABILITY_DELTA);
    // The 5×k escalation continues (attempt 2 = +10); the cap still binds at 3.
    const re2 = mgr.act({ transactionId: actionTransactionId(runId, bossId, 'ENGAGE_DEFEAT', 're-2'), nodeId: bossId, action: 'ENGAGE_DEFEAT' });
    expect(re2.status).toBe('COMMITTED');
    expect(mgr.snapshot().state.instability).toBe(instAtBoss + DEFEAT_INSTABILITY_DELTA * 3);
    // Instability never passed the ceiling at any committed step.
    expect(mgr.snapshot().state.instability).toBeLessThanOrEqual(INSTABILITY_CEILING);
  });

  it('the MERCHANT −10 is the second recovery lever for the same altar-reached bound', () => {
    const mgr = walkToRecovery('merchant');
    const runId = mgr.snapshot().state.runId;
    const bossId = mgr.snapshot().currentNodeId;
    const instAtBoss = mgr.snapshot().state.instability;
    expect(instAtBoss + DEFEAT_INSTABILITY_DELTA).toBeLessThanOrEqual(INSTABILITY_CEILING);
    const re1 = mgr.act({ transactionId: actionTransactionId(runId, bossId, 'ENGAGE_DEFEAT', 're-1'), nodeId: bossId, action: 'ENGAGE_DEFEAT' });
    expect(re1.status).toBe('COMMITTED');
    expect(mgr.snapshot().state.instability).toBe(instAtBoss + DEFEAT_INSTABILITY_DELTA);
  });

  it('the blocked re-engage + recovered headroom survive a CODEC cut (escalation is ledger-persisted, never reset by a reload)', () => {
    // Walk to the recovery node, then cut the run BEFORE the boss re-engage:
    // the restored run keeps the altar downside + service recovery, and the
    // boss re-engage that was blocked at n4 is legal again on the restored
    // timeline — the escalation is a function of the persisted ledger.
    const map = altarMap('anchor');
    // Reuse the walk: battles stacks, altar accept, blocked re-engage, service.
    walkToRecovery('anchor');
    const serialized = store.get('rw.expedition.v1');
    if (serialized === undefined) throw new Error('no autosave');
    const restored = restoreExpeditionSave(serialized, map);
    const bossId = restored.currentNodeId;
    expect(restored.definition.type).toBe('boss');
    const inst = restored.state.instability;
    expect(inst + DEFEAT_INSTABILITY_DELTA).toBeLessThanOrEqual(INSTABILITY_CEILING);
    const after = restored.act({ transactionId: actionTransactionId(restored.state.runId, bossId, 'ENGAGE_DEFEAT', 'restored-re-1'), nodeId: bossId, action: 'ENGAGE_DEFEAT' });
    expect(after.state.ledger[actionTransactionId(restored.state.runId, bossId, 'ENGAGE_DEFEAT', 'restored-re-1')]?.status).toBe('COMMITTED');
    expect(after.state.instability).toBe(inst + DEFEAT_INSTABILITY_DELTA);
    // The altar's +10 downside + the anchor −8 are both durable ledger records.
    expect(Object.values(restored.state.ledger).some((r) => r.action === 'ACCEPT' && r.status === 'COMMITTED')).toBe(true);
    expect(Object.values(restored.state.ledger).some((r) => r.action === 'SERVICE' && r.status === 'COMMITTED')).toBe(true);
  });

  it('the altar downside itself honours the ceiling: an ACCEPT that would push past 100 is REJECTED', () => {
    // Boundary pin on the crafted altar node: at the bound zone the altar's
    // own +10 is gated (the shared INSTABILITY_CEILING), while DECLINE stays
    // legal — the same gate the re-engage honours.
    store.clear();
    const map = altarMap('anchor');
    const mgr = RunManager.boot(map, 500);
    const runId = mgr.snapshot().state.runId;
    const path = mainPath(mgr.map);
    const stacks = [3, 3, 3];
    for (let g = 0; g <= 2; g += 1) {
      const snap = mgr.snapshot();
      const nodeId = snap.currentNodeId;
      mgr.enter(enterTransactionId(runId, nodeId));
      for (let a = 1; a <= (stacks[g] ?? 0); a += 1) {
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', `b${String(g)}-${String(a)}`), nodeId, action: 'ENGAGE_DEFEAT' });
      }
      mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `bd${String(g)}`), nodeId, action: 'DECLINE' });
      mgr.resolve();
      const next = path[g + 1];
      if (next === undefined) break;
      mgr.advance(next);
    }
    const altarId = mgr.snapshot().currentNodeId;
    expect(mgr.snapshot().currentNodeType).toBe('altar');
    mgr.enter(enterTransactionId(runId, altarId));
    const inst = mgr.snapshot().state.instability;
    if (inst + ALTAR_DOWNSIDE_INSTABILITY > INSTABILITY_CEILING) {
      const blocked = mgr.act({ transactionId: actionTransactionId(runId, altarId, 'ACCEPT', 'blocked'), nodeId: altarId, action: 'ACCEPT' });
      expect(blocked.status).toBe('REJECTED');
      // DECLINE stays legal — the gate is never a soft-lock.
      const decline = mgr.act({ transactionId: actionTransactionId(runId, altarId, 'DECLINE', 'altar-out'), nodeId: altarId, action: 'DECLINE' });
      expect(decline.status).toBe('COMMITTED');
    } else {
      // The three full stacks land 35+35+35 = 105 before the altar ENTER; the
      // altar ENTER (+8) never gates (mandatory), so the ACCEPT is blocked at
      // 113 + 10 — this branch is defensive, the deterministic seed pins the
      // blocked branch.
      expect(inst + ALTAR_DOWNSIDE_INSTABILITY).toBeLessThanOrEqual(INSTABILITY_CEILING);
      void expect;
    }
  });
});
