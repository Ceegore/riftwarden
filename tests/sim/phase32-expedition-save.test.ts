import { describe, expect, it } from 'vitest';
import { createExpedition } from '../../src/game/expedition/expedition-runner.js';
import { decodeExpeditionSave, encodeExpeditionSave, restoreExpeditionSave } from '../../src/game/expedition/expedition-save.js';
import { generateMap } from '../../src/game/expedition/map-generator.js';
import type { ExpeditionMap, MapProfile } from '../../src/game/expedition/types.js';
import { SaveError } from '../../src/game/save/save-error.js';

const PROFILE: MapProfile = {
  id: 'exp-save.v1',
  logicalLevels: 6,
  targetVisited: [5, 8] as const,
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'fallback.v1',
};

function mapFor(seed: number): ExpeditionMap {
  return generateMap({ seed, profileId: PROFILE.id, contentRevision: '32.0' }, PROFILE);
}

describe('phase32 expedition save codec', () => {
  it('round-trips a fresh runner with canonical JSON', () => {
    const runner = createExpedition(mapFor(700), { startGold: 125 });
    const encoded = encodeExpeditionSave(runner);
    const decoded = decodeExpeditionSave(JSON.parse(encoded));
    expect(encoded).toBe(encodeExpeditionSave(runner));
    expect(decoded.currentNodeId).toBe(runner.currentNodeId);
    expect(decoded.state).toEqual(runner.state);
  });

  it('restores a serialized runner against its matching map', () => {
    const map = mapFor(701);
    let runner = createExpedition(map, { startGold: 100 });
    runner = runner.enter('save-enter').resolve();
    const restored = restoreExpeditionSave(encodeExpeditionSave(runner), map);
    expect(restored.currentNodeId).toBe(runner.currentNodeId);
    expect(restored.state).toEqual(runner.state);
  });

  it('rejects unknown fields and unsupported schema versions', () => {
    const value = JSON.parse(encodeExpeditionSave(createExpedition(mapFor(702), { startGold: 100 }))) as Record<string, unknown>;
    expect(() => decodeExpeditionSave({ ...value, extra: true })).toThrow(SaveError);
    expect(() => decodeExpeditionSave({ ...value, schemaVersion: 2 })).toThrow(SaveError);
  });

  it('rejects malformed state fields', () => {
    const value = JSON.parse(encodeExpeditionSave(createExpedition(mapFor(703), { startGold: 100 }))) as {
      state: Record<string, unknown>;
    };
    expect(() => decodeExpeditionSave({ ...value, state: { ...value.state, gold: -1 } })).toThrow(SaveError);
    expect(() => decodeExpeditionSave({ ...value, state: { ...value.state, unknown: true } })).toThrow(SaveError);
  });

  it('rejects an OFFERS snapshot whose offers field is not an array', () => {
    // Enter the start node to materialize a snapshot, then corrupt it.
    const runner = createExpedition(mapFor(707), { startGold: 100 }).enter('offers-corrupt');
    const value = JSON.parse(encodeExpeditionSave(runner)) as {
      state: { snapshots: Record<string, unknown> };
    };
    const snapshots = { ...value.state.snapshots };
    // A corrupted OFFERS snapshot must fail loudly instead of silently
    // decoding to an empty offer list (which could grant nothing on resume).
    const nodeId = Object.keys(snapshots)[0];
    if (nodeId === undefined) throw new Error('fixture has no snapshots');
    snapshots[nodeId] = {
      ...(snapshots[nodeId] as Record<string, unknown>),
      kind: 'OFFERS',
      offers: 'not-an-array',
    };
    expect(() => decodeExpeditionSave({ ...value, state: { ...value.state, snapshots } })).toThrow(SaveError);
  });

  it('rejects a serialized save against a different map', () => {
    const runner = createExpedition(mapFor(704), { startGold: 100 });
    const serialized = encodeExpeditionSave(runner);
    expect(() => restoreExpeditionSave(serialized, mapFor(705))).toThrow('expedition.SAVE_MAP_MISMATCH');
  });

  it('round-trips a mid-expedition save with enter, action, and resolve', () => {
    const map = mapFor(706);
    let runner = createExpedition(map, { startGold: 150 });
    runner = runner.enter('mtx-01');
    // Take the first action: ENGAGE for a battle node, CONFIRM for events, BUY for merchants.
    const def = runner.definition;
    const snapshot = runner.state.snapshots[runner.currentNodeId];
    if (def.type === 'battle' || def.type === 'elite' || def.type === 'boss') {
      runner = runner.act({ transactionId: 'mtx-02', nodeId: runner.currentNodeId, action: 'ENGAGE' });
    } else if (def.type === 'event' && snapshot?.kind === 'EVENT') {
      const first = snapshot.options.find((o) => o.available);
      runner = first
        ? runner.act({ transactionId: 'mtx-02', nodeId: runner.currentNodeId, action: 'CONFIRM', optionId: first.optionId })
        : runner.act({ transactionId: 'mtx-02', nodeId: runner.currentNodeId, action: 'DECLINE' });
    } else if (def.type === 'treasure') {
      runner = runner.act({ transactionId: 'mtx-02', nodeId: runner.currentNodeId, action: 'TAKE' });
    } else if (def.type === 'anchor' && runner.state.unsecuredLoot.length > 0) {
      runner = runner.act({ transactionId: 'mtx-02', nodeId: runner.currentNodeId, action: 'SECURE' });
    } else {
      // No second action needed — just resolve.
    }
    runner = runner.resolve();
    const serialized = encodeExpeditionSave(runner);
    const restored = restoreExpeditionSave(serialized, map);
    expect(restored.currentNodeId).toBe(runner.currentNodeId);
    expect(restored.state.gold).toBe(runner.state.gold);
    expect(restored.state.instability).toBe(runner.state.instability);
    // Restored runner can continue: advance and enter the next node.
    const nextIds = map.edges.filter((e) => e.from === runner.currentNodeId).map((e) => e.to);
    if (nextIds.length > 0 && nextIds[0]) {
      restored.advance(nextIds[0]);
    }
  });
});
