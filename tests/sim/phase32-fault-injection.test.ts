/**
 * Phase 32 fault injection and save migration tests.
 * Covers: corrupted localStorage recovery, storage not set, and
 * abnormal save values during decode.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { EXPEDITION_SAVE_VERSION, decodeExpeditionSave } from '../../src/game/expedition/expedition-save.js';
import { restoreStoredExpedition } from '../../src/game/expedition/expedition-store.js';
import { generateMap } from '../../src/game/expedition/map-generator.js';
import type { ExpeditionMap, MapProfile } from '../../src/game/expedition/types.js';

const DEFAULT_PROFILE: MapProfile = {
  id: 'test.fault.v1', logicalLevels: 6, targetVisited: [5, 8],
  mandatoryRoles: ['anchor', 'preparation', 'boss'], attemptCap: 50,
  fallbackTemplateId: 'fallback.test',
};

function testMap(): ExpeditionMap {
  return generateMap({ seed: 704, profileId: 'test.fault.v1', contentRevision: '32.0' }, DEFAULT_PROFILE);
}

beforeEach(() => {
  localStorage.clear();
});

/** A minimal valid save payload for decode tests. */
function validPayload(): string {
  return JSON.stringify({
    schemaVersion: EXPEDITION_SAVE_VERSION,
    currentNodeId: 'n0_000',
    state: {
      revision: 1, runId: 'test-run', modeId: 'normal',
      contentRevision: '32.0', seed: 704, mapHash: 'abc',
      gold: 100, instability: 0, goldEarned: 0, killsEarned: 0,
      masteryKillsApplied: 0,
      securedLoot: [], unsecuredLoot: [], relics: [], recruits: [], knowledge: [],
      troopCopies: {},
      visits: {}, snapshots: {}, ledger: {},
      runStatus: 'active',
    },
  });
}

describe('save migration', () => {
  it('rejects schema version 0', () => {
    const raw = validPayload().replace(/"schemaVersion":1/, '"schemaVersion":0');
    expect(() => decodeExpeditionSave(JSON.parse(raw))).toThrow();
  });

  it('accepts the current schema version', () => {
    const raw = validPayload();
    const decoded = decodeExpeditionSave(JSON.parse(raw));
    expect(decoded.schemaVersion).toBe(EXPEDITION_SAVE_VERSION);
  });

  it('schema version 999 is rejected', () => {
    const raw = validPayload().replace(/"schemaVersion":1/, '"schemaVersion":999');
    expect(() => decodeExpeditionSave(JSON.parse(raw))).toThrow();
  });
});

describe('fault injection - storage corruption', () => {
  it('handles truncated JSON gracefully', () => {
    localStorage.setItem('rw.expedition.v1', '{"schemaVersion":1,"cur');
    const map = testMap();
    const result = restoreStoredExpedition(map);
    expect(result).toBeNull();
  });

  it('handles completely invalid JSON', () => {
    localStorage.setItem('rw.expedition.v1', 'not-json-at-all');
    const map = testMap();
    const result = restoreStoredExpedition(map);
    expect(result).toBeNull();
  });

  it('handles storage key not set', () => {
    const map = testMap();
    const result = restoreStoredExpedition(map);
    expect(result).toBeNull();
  });

  it('storage with wrong structure returns null', () => {
    localStorage.setItem('rw.expedition.v1', JSON.stringify({ some: 'garbage' }));
    const map = testMap();
    const result = restoreStoredExpedition(map);
    expect(result).toBeNull();
  });
});

describe('fault injection - abnormal save values', () => {
  it('decode rejects negative gold', () => {
    const raw = validPayload().replace(/"gold":100/, '"gold":-100');
    expect(() => decodeExpeditionSave(JSON.parse(raw))).toThrow();
  });

  it('decode rejects non-array securedLoot', () => {
    const raw = validPayload().replace(/"securedLoot":\[\]/, '"securedLoot":"not-an-array"');
    expect(() => decodeExpeditionSave(JSON.parse(raw))).toThrow();
  });

  it('decode rejects missing required field', () => {
    const raw = validPayload().replace(/"gold":100,/, '');
    expect(() => decodeExpeditionSave(JSON.parse(raw))).toThrow();
  });

  it('decode accepts valid minimal payload', () => {
    const raw = validPayload();
    const decoded = decodeExpeditionSave(JSON.parse(raw));
    expect(decoded.schemaVersion).toBe(EXPEDITION_SAVE_VERSION);
    expect(decoded.currentNodeId).toBe('n0_000');
  });
});
