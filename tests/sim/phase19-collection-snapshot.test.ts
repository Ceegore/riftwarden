import { describe, expect, it } from 'vitest';
import { KernelInvariantError } from '../../src/game/sim/core/invariant-error.js';
import { createAbilityInstance, type AbilityConfig, type AbilityInstance } from '../../src/game/sim/ability/ability-system.js';
import { createAbilityCollection } from '../../src/game/sim/ability/ability-collection.js';
import { createSnapshot, verifySnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { migrateBattleModel } from '../../src/game/sim/core/migrate.js';
import { battle, entity } from './test-helpers.js';

const config: AbilityConfig = Object.freeze({
  abilityId: 'ability_fireball',
  chargeTicks: null,
  cooldownTicks: null,
  castTicks: 3,
  recoveryTicks: 2,
  interruptPolicy: 'interruptible',
  usesPerBattle: null,
  invalidTargetPolicy: 'wait',
  bossPhaseCancelAllowed: false,
});

const inst = (id: string, ownerId: string, overrides: Partial<AbilityInstance> = {}): AbilityInstance =>
  Object.freeze({ ...createAbilityInstance(config, id, ownerId), ...overrides });

describe('P19 ability collection', () => {
  it('sorts canonically by (ownerId, abilityInstanceId)', () => {
    const b = inst('instance_b', 'unit_b');
    const a = inst('instance_a', 'unit_a');
    const out = createAbilityCollection([b, a]);
    expect(out.map((i) => i.abilityInstanceId)).toEqual(['instance_a', 'instance_b']);
  });

  it('rejects duplicate abilityInstanceId', () => {
    const a = inst('instance_a', 'unit_a');
    const dup = inst('instance_a', 'unit_b');
    expect(() => {
      createAbilityCollection([a, dup]);
    }).toThrow(KernelInvariantError);
  });

  it('rejects malformed instances via validateAbilityInstance', () => {
    const bad = inst('instance_a', 'unit_a', { state: 'flying' as never });
    expect(() => {
      createAbilityCollection([bad]);
    }).toThrow(KernelInvariantError);
  });
});

describe('P19 ability snapshot projection', () => {
  it('projects abilities into the snapshot and is permutation-stable', () => {
    const a = inst('instance_a', 'unit_a', { chargeTicks: 3, sequence: 1 });
    const b = inst('instance_b', 'unit_b', { chargeTicks: 7, sequence: 2 });
    const s1 = createSnapshot(battle({ abilities: Object.freeze([a, b]) }));
    const s2 = createSnapshot(battle({ abilities: Object.freeze([b, a]) }));
    expect(s1.checksum).toBe(s2.checksum);
  });

  it('hashes different ability state differently', () => {
    const a = inst('instance_a', 'unit_a', { chargeTicks: 3 });
    const aChanged = inst('instance_a', 'unit_a', { chargeTicks: 9 });
    expect(createSnapshot(battle({ abilities: Object.freeze([a]) })).checksum).not.toBe(
      createSnapshot(battle({ abilities: Object.freeze([aChanged]) })).checksum,
    );
  });

  it('verifySnapshot accepts the canonical snapshot (symmetric)', () => {
    const a = inst('instance_a', 'unit_a');
    const b = inst('instance_b', 'unit_b');
    const snap = createSnapshot(battle({ abilities: Object.freeze([b, a]) }));
    expect(verifySnapshot(snap)).toBe(true);
  });
});

describe('P19 ability migration', () => {
  it('seeds an empty abilities collection', () => {
    const state = battle({ entities: Object.freeze([entity('unit_a')]) });
    const migrated = migrateBattleModel({ state, radiiX100: { unit_a: 100 } });
    expect(migrated.abilities).toEqual([]);
  });
});
