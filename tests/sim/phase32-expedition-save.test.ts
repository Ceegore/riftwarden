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

  it('rejects a serialized save against a different map', () => {
    const runner = createExpedition(mapFor(704), { startGold: 100 });
    const serialized = encodeExpeditionSave(runner);
    expect(() => restoreExpeditionSave(serialized, mapFor(705))).toThrow('expedition.SAVE_MAP_MISMATCH');
  });
});
