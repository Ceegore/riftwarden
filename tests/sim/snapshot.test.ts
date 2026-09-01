import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../../src/game/sim/snapshot/sha256.js';
import { createSnapshot, verifySnapshot, shouldCheckpoint } from '../../src/game/sim/snapshot/snapshot.js';
import { canonicalJson } from '../../src/game/sim/snapshot/canonical-json.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import { battle, entity, tick } from './test-helpers.js';

const enc = new TextEncoder();

describe('kernel SHA-256', () => {
  it('matches known vectors', () => {
    expect(sha256Hex(enc.encode(''))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex(enc.encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('snapshot canonicalization', () => {
  it('entity insertion and object key order do not change snapshot bytes', () => {
    const a = battle({ entities: Object.freeze([entity('entity_b'), entity('entity_a')]) });
    const b = battle({ entities: Object.freeze([entity('entity_a'), entity('entity_b')]) });
    expect(canonicalJson(createSnapshot(a))).toBe(canonicalJson(createSnapshot(b)));
  });

  it('authoritative bit changes hash while presentation extras are excluded', () => {
    const base = battle();
    const hash = createSnapshot(base).checksum;
    const first = base.entities[0];
    if (first) {
      expect(createSnapshot({ ...base, entities: [{ ...first, lp: 999 }] }).checksum).not.toBe(hash);
    }
    const withPresentation = { ...base, renderer: { cameraX: 999 }, audio: { volume: 0 }, locale: 'de' } as unknown as BattleModel;
    expect(createSnapshot(withPresentation).checksum).toBe(hash);
  });

  it('cosmetic stream extra is excluded', () => {
    const base = battle();
    const hacked = { ...base, authoritativeStreams: { ...base.authoritativeStreams, combatCosmetic: [1, 2, 3, 4] } } as unknown as BattleModel;
    expect(createSnapshot(hacked).checksum).toBe(createSnapshot(base).checksum);
  });

  it('checksum verifies and tamper fails', () => {
    const snap = createSnapshot(battle());
    expect(verifySnapshot(snap)).toBe(true);
    expect(verifySnapshot({ ...snap, tick: tick(9) })).toBe(false);
  });

  it('checkpoint cadence is every 30 ticks plus terminal', () => {
    for (let i = 0; i < 90; i++) expect(shouldCheckpoint(i, false)).toBe(i % 30 === 0);
    expect(shouldCheckpoint(7, true)).toBe(true);
  });

  it('ten identical runs create byte-identical snapshot', () => {
    const outputs = Array.from({ length: 10 }, () => canonicalJson(createSnapshot(battle())));
    expect(new Set(outputs).size).toBe(1);
  });
});
