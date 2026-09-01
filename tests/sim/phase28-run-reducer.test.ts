import { describe, expect, it } from 'vitest';
import { createRunState } from '../../src/game/expedition/run-state.js';
import {
  applyInstabilityDelta,
  applyResourceDelta,
  beginTransaction,
  commitVisit,
  dropUnsecuredLoot,
  secureLoot,
} from '../../src/game/expedition/run-reducer.js';
import { catchExpeditionCode, mapFor, runFor, standardProfile } from './phase28-helpers.js';
import { reachableFrom } from '../../src/game/expedition/reachability.js';

describe('phase28 run state', () => {
  it('creates a valid immutable state from a generated map', () => {
    const map = mapFor(3);
    const state = createRunState({
      runId: 'run-3',
      modeId: 'mode.expedition',
      missionId: 'mission.act1',
      map,
      startResources: { gold: 10 },
    });
    expect(state.revision).toBe(0);
    expect(state.currentNodeId).toBe(map.startNodeId);
    expect(state.visitedNodeIds).toEqual([map.startNodeId]);
    expect(state.instability).toBe(0);
    expect(state.resources['gold']).toBe(10);
    expect(state.availableNodeIds.length).toBeGreaterThan(0);
  });

  it('rejects invalid maps and negative resources', () => {
    const broken = { ...mapFor(3), nodes: [] };
    expect(catchExpeditionCode(() =>
      createRunState({ runId: 'r', modeId: 'm', missionId: 'x', map: broken, startResources: {} }),
    )).toBe('INVALID_MAP');
    expect(catchExpeditionCode(() =>
      createRunState({ runId: 'r', modeId: 'm', missionId: 'x', map: mapFor(3), startResources: { gold: -1 } }),
    )).toBe('NEGATIVE_RESOURCE');
  });
});

describe('phase28 transactions', () => {
  function firstVisitState() {
    const map = mapFor(3);
    const state = createRunState({ runId: 'r', modeId: 'm', missionId: 'x', map, startResources: { gold: 10 } });
    const next = state.availableNodeIds[0];
    if (next === undefined) throw new Error('no available node');
    return { state, next, map };
  }

  it('begins, commits and clears a visit transaction', () => {
    const { state, next } = firstVisitState();
    const pending = beginTransaction(state, 'tx-visit', 0);
    expect(pending.pendingTransactionId).toBe('tx-visit');
    const committed = commitVisit(pending, 'tx-visit', next, [], 0);
    expect(committed.currentNodeId).toBe(next);
    expect(committed.visitedNodeIds).toContain(next);
    expect(committed.committedTransactionIds).toEqual(['tx-visit']);
    expect(committed.pendingTransactionId).toBeUndefined();
    expect(committed.revision).toBe(1);
  });

  it('duplicate committed transactions return the prior receipt unchanged', () => {
    const { state, next } = firstVisitState();
    const committed = commitVisit(beginTransaction(state, 'tx', 0), 'tx', next, [], 0);
    const duplicate = commitVisit(committed, 'tx', next, [], 1);
    expect(duplicate).toBe(committed);
    expect(duplicate.revision).toBe(1);
  });

  it('enforces the pending lock and transaction identity', () => {
    const { state, next } = firstVisitState();
    const pending = beginTransaction(state, 'tx-1', 0);
    expect(catchExpeditionCode(() => beginTransaction(pending, 'tx-2', 0))).toBe('TRANSACTION_PENDING');
    expect(catchExpeditionCode(() => commitVisit(pending, 'wrong-id', next, [], 0))).toBe('TRANSACTION_MISMATCH');
  });

  it('rejects visits to unreachable nodes', () => {
    const { state } = firstVisitState();
    const pending = beginTransaction(state, 'tx', 0);
    expect(catchExpeditionCode(() => commitVisit(pending, 'tx', 'lane_0:front', [], 0))).toBe('NODE_NOT_REACHABLE');
  });

  it('validates the expected revision on every transition', () => {
    const { state, next } = firstVisitState();
    const pending = beginTransaction(state, 'tx', 0);
    expect(catchExpeditionCode(() => commitVisit(pending, 'tx', next, [], 7))).toBe('REVISION_MISMATCH');
    expect(catchExpeditionCode(() => beginTransaction(state, 'tx-2', 3))).toBe('REVISION_MISMATCH');
  });
});

describe('phase28 resources and instability', () => {
  it('never lets resources go negative', () => {
    const state = runFor(4);
    expect(applyResourceDelta(state, 'gold', -3, 0).resources['gold']).toBe(7);
    expect(catchExpeditionCode(() => applyResourceDelta(state, 'gold', -11, 0))).toBe('NEGATIVE_RESOURCE');
    expect(catchExpeditionCode(() => applyResourceDelta(state, 'gold', 0.5, 0))).toBe('NEGATIVE_RESOURCE');
  });

  it('clamps instability at zero', () => {
    const state = runFor(4);
    const raised = applyInstabilityDelta(state, 15, 0);
    expect(raised.instability).toBe(15);
    expect(applyInstabilityDelta(raised, -10, 1).instability).toBe(5);
    expect(catchExpeditionCode(() => applyInstabilityDelta(state, -1, 0))).toBe('NEGATIVE_RESOURCE');
  });

  it('advances the revision on every mutation', () => {
    const state = runFor(4);
    const next = applyResourceDelta(state, 'gold', 1, 0);
    expect(next.revision).toBe(1);
    expect(catchExpeditionCode(() => applyResourceDelta(next, 'gold', 1, 0))).toBe('REVISION_MISMATCH');
  });
});

describe('phase28 loot and anchor', () => {
  function lootState() {
    const state = runFor(5);
    const withLoot: typeof state = { ...state, unsecuredLoot: ['loot_a', 'loot_b'] };
    return withLoot;
  }

  it('secures unsecured loot idempotently via a committed transaction', () => {
    const state = lootState();
    const pending = beginTransaction(state, 'tx-secure', 0);
    const secured = secureLoot(pending, 'tx-secure', ['loot_a'], 0);
    expect(secured.securedLoot).toEqual(['loot_a']);
    expect(secured.unsecuredLoot).toEqual(['loot_b']);
    expect(secured.committedTransactionIds).toContain('tx-secure');
    const duplicate = secureLoot(secured, 'tx-secure', ['loot_a'], 1);
    expect(duplicate).toBe(secured);
  });

  it('rejects securing loot that is not unsecured', () => {
    const state = lootState();
    const pending = beginTransaction(state, 'tx', 0);
    expect(catchExpeditionCode(() => secureLoot(pending, 'tx', ['loot_missing'], 0))).toBe('LOOT_NOT_AVAILABLE');
  });

  it('drops unsecured loot without touching secured loot', () => {
    const state = { ...lootState(), securedLoot: ['loot_a'], unsecuredLoot: ['loot_b'] };
    const dropped = dropUnsecuredLoot(state, ['loot_b'], 0);
    expect(dropped.unsecuredLoot).toEqual([]);
    expect(dropped.securedLoot).toEqual(['loot_a']);
    expect(catchExpeditionCode(() => dropUnsecuredLoot(state, ['loot_a'], 0))).toBe('LOOT_NOT_AVAILABLE');
  });
});

describe('phase28 selectors', () => {
  it('available nodes are exactly the reachable frontier', () => {
    const map = mapFor(6);
    const state = createRunState({ runId: 'r', modeId: 'm', missionId: 'x', map, startResources: {} });
    const expected = map.edges.filter((edge) => edge.from === map.startNodeId).map((edge) => edge.to).sort();
    expect(state.availableNodeIds).toEqual(expected);
    expect(reachableFrom(map, map.startNodeId).length).toBeGreaterThanOrEqual(standardProfile().logicalLevels);
  });
});
