import { describe, expect, it } from 'vitest';
import { KernelInvariantError } from '../../src/game/sim/core/invariant-error.js';
import { createTemporaryCollection } from '../../src/game/sim/summon/temporary-registry.js';
import { canonicalizeSynergyTiers } from '../../src/game/sim/synergy/synergy-counter.js';
import { createSnapshot, verifySnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { migrateBattleModel, SIM_VERSION_PHASE15 } from '../../src/game/sim/core/migrate.js';
import type { TempEntity } from '../../src/game/sim/summon/temporary-entity.js';
import { battle, entity } from './test-helpers.js';

const temp = (id: string, overrides: Partial<TempEntity> = {}): TempEntity =>
  Object.freeze({
    id, side: 'player', kind: 'SUMMON', counted: true, ownerId: 'owner_0', sourceId: 'ability_summon',
    createdTick: 0, createdSequence: 0, ...overrides,
  });

describe('P20 §8 temporary-entity collection', () => {
  it('sorts canonically by id (permutation-stable)', () => {
    const a = temp('temp_b');
    const b = temp('temp_a');
    expect(createTemporaryCollection([a, b]).map((e) => e.id)).toEqual(['temp_a', 'temp_b']);
    expect(createTemporaryCollection([b, a]).map((e) => e.id)).toEqual(['temp_a', 'temp_b']);
  });

  it('rejects duplicate ids', () => {
    expect(() => createTemporaryCollection([temp('temp_a'), temp('temp_a')])).toThrow(KernelInvariantError);
  });

  it('rejects more than six counted summons per side', () => {
    const seven = Array.from({ length: 7 }, (_, i) => temp(`summon_${String(i)}`, { createdSequence: i }));
    expect(() => createTemporaryCollection(seven)).toThrow(KernelInvariantError);
  });

  it('rejects duplicate construct slots per side', () => {
    const a = temp('construct_a', { kind: 'CONSTRUCT', counted: false, slotId: 'slot_a' });
    const b = temp('construct_b', { kind: 'CONSTRUCT', counted: false, slotId: 'slot_a' });
    expect(() => createTemporaryCollection([a, b])).toThrow(KernelInvariantError);
  });
});

describe('P20 §4 synergy-tier canonicalization', () => {
  it('is permutation-stable by key order', () => {
    expect(canonicalizeSynergyTiers({ kingdom: 3, faith: 2 })).toEqual({ faith: 2, kingdom: 3 });
    expect(canonicalizeSynergyTiers({ faith: 2, kingdom: 3 })).toEqual({ faith: 2, kingdom: 3 });
  });

  it('rejects an unknown synergy id', () => {
    expect(() => canonicalizeSynergyTiers({ dragon: 2 })).toThrow(KernelInvariantError);
  });

  it('rejects a non-closed tier', () => {
    expect(() => canonicalizeSynergyTiers({ kingdom: 1 })).toThrow(KernelInvariantError);
  });
});

describe('P20 snapshot projection', () => {
  it('hashes temporary entities permutation-stably and verifies symmetrically', () => {
    const a = temp('temp_a', { kind: 'SUMMON', counted: true });
    const b = temp('temp_b', { kind: 'CONSTRUCT', counted: false, slotId: 'slot_a' });
    const s1 = createSnapshot(battle({ temporaryEntities: Object.freeze([a, b]) }));
    const s2 = createSnapshot(battle({ temporaryEntities: Object.freeze([b, a]) }));
    expect(s1.checksum).toBe(s2.checksum);
    expect(verifySnapshot(s1)).toBe(true);
  });

  it('hashes synergy tiers permutation-stably', () => {
    const s1 = createSnapshot(battle({ synergyTiers: Object.freeze({ kingdom: 3, faith: 2 }) }));
    const s2 = createSnapshot(battle({ synergyTiers: Object.freeze({ faith: 2, kingdom: 3 }) }));
    expect(s1.checksum).toBe(s2.checksum);
  });

  it('hashes different temporary entity state differently', () => {
    const s1 = createSnapshot(battle({ temporaryEntities: Object.freeze([temp('temp_a')]) }));
    const s2 = createSnapshot(battle({ temporaryEntities: Object.freeze([temp('temp_b')]) }));
    expect(s1.checksum).not.toBe(s2.checksum);
  });
});

describe('P20 migration', () => {
  it('seeds empty temporary entities and synergy tiers', () => {
    const state = battle({ entities: [entity('entity_alpha')] });
    const migrated = migrateBattleModel({ state, radiiX100: { entity_alpha: 100 } });
    expect(migrated.simulationVersion).toBe(SIM_VERSION_PHASE15);
    expect(migrated.temporaryEntities).toEqual([]);
    expect(migrated.synergyTiers).toEqual({});
  });

  it('is idempotent at the Phase 15 version', () => {
    const migrated = migrateBattleModel({ state: battle({ entities: [entity('entity_alpha')] }), radiiX100: { entity_alpha: 100 } });
    expect(migrateBattleModel({ state: migrated, radiiX100: { entity_alpha: 100 } })).toBe(migrated);
  });
});
