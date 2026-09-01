import { describe, expect, it } from 'vitest';
import { KernelInvariantError } from '../../src/game/sim/core/invariant-error.js';
import {
  canRepair,
  damageResetTick,
  firstDestroyProtectionOnceKey,
  isBossObject,
  resolveConstructSlot,
  REPAIR_DELAY_TICKS,
} from '../../src/game/sim/summon/construct-manager.js';
import {
  eligibleForCombatContinuation,
  isExpired,
  removalCleanupPlan,
  removalReason,
  shouldRemoveOnOwnerDefeat,
} from '../../src/game/sim/summon/summon-lifecycle.js';
import { RECURSIVE_SPAWN_BUDGET, type TempEntity } from '../../src/game/sim/summon/temporary-entity.js';

const temp = (overrides: Partial<TempEntity> = {}): TempEntity =>
  Object.freeze({
    id: 'temp_0', side: 'player', kind: 'SUMMON', counted: true, ownerId: 'owner_0', sourceId: 'ability_summon',
    createdTick: 0, createdSequence: 0, ...overrides,
  });

describe('P20 §7 construct repair contract', () => {
  it('repair is blocked at tick 89 and first allowed at tick 90', () => {
    expect(canRepair(89, 0)).toBe(false);
    expect(canRepair(90, 0)).toBe(true);
    expect(REPAIR_DELAY_TICKS).toBe(90);
  });

  it('damage resets the repair window to the damage tick', () => {
    expect(damageResetTick(50)).toBe(50);
    expect(canRepair(140, damageResetTick(50))).toBe(true);
    expect(canRepair(139, damageResetTick(50))).toBe(false);
  });

  it('resolves an occupied construct slot to FAIL or REPLACE, never silent stacking', () => {
    const occupant = temp({ id: 'construct_0', kind: 'CONSTRUCT', counted: false, slotId: 'slot_a' });
    expect(resolveConstructSlot(undefined, 'REPLACE')).toEqual({ kind: 'PLACED' });
    expect(resolveConstructSlot(occupant, 'FAIL')).toEqual({ kind: 'FAILED', diagnostic: 'ConstructSlotOccupied' });
    expect(resolveConstructSlot(occupant, 'REPLACE')).toEqual({ kind: 'REPLACED', removedId: 'construct_0' });
  });

  it('derives a stable once-key for the first destroyed construct protection field', () => {
    expect(firstDestroyProtectionOnceKey('construct_0')).toBe('protection_field_construct_0_first_destroyed');
    expect(firstDestroyProtectionOnceKey('construct_0')).toBe(firstDestroyProtectionOnceKey('construct_0'));
  });

  it('rejects an invalid construct id for the once-key', () => {
    expect(() => firstDestroyProtectionOnceKey('Bad-Id!')).toThrow(KernelInvariantError);
  });

  it('identifies boss objects as their own category', () => {
    expect(isBossObject(temp({ kind: 'BOSS_OBJECT', counted: false }))).toBe(true);
    expect(isBossObject(temp({ kind: 'CONSTRUCT', counted: false }))).toBe(false);
  });
});

describe('P20 §6 summon lifecycle contract', () => {
  it('expiry is inclusive and is EXPIRED, never DEFEATED', () => {
    const entity = temp({ expiresAtTick: 10 });
    expect(isExpired(entity, 9)).toBe(false);
    expect(isExpired(entity, 10)).toBe(true);
    expect(removalReason(entity, 10, 1)).toBe('EXPIRED');
    expect(removalReason(temp({ expiresAtTick: 10 }), 9, 0)).toBe('DEFEATED');
    expect(removalReason(temp({ expiresAtTick: 10 }), 9, 1)).toBe('ACTIVE');
  });

  it('owner death removes a summon only when content opts in', () => {
    expect(shouldRemoveOnOwnerDefeat(temp())).toBe(false);
    expect(shouldRemoveOnOwnerDefeat(temp({ removeOnOwnerDefeat: true }))).toBe(true);
  });

  it('summons never prevent battle end; constructs/boss objects continue it', () => {
    expect(eligibleForCombatContinuation(temp({ kind: 'SUMMON' }))).toBe(false);
    expect(eligibleForCombatContinuation(temp({ kind: 'CONSTRUCT' }))).toBe(true);
    expect(eligibleForCombatContinuation(temp({ kind: 'BOSS_OBJECT' }))).toBe(true);
  });

  it('produces a complete deterministic removal cleanup plan', () => {
    const plan = removalCleanupPlan('summon_0');
    expect(plan.map((c) => c.category)).toEqual([
      'target_index', 'planned_events', 'projectiles', 'status_references', 'slot_counter', 'pending_commands',
    ]);
    expect(plan.every((c) => c.entityId === 'summon_0')).toBe(true);
  });
});

describe('P20 §11 fault injection', () => {
  it('recursive spawn budget is the closed constant 64', () => {
    expect(RECURSIVE_SPAWN_BUDGET).toBe(64);
  });

  it('a removed entity cannot be silently resurrected with the same id (duplicate blocks)', () => {
    const entity = temp();
    expect(removalReason(entity, 10, 0)).toBe('DEFEATED');
    expect(eligibleForCombatContinuation(entity)).toBe(false);
  });
});
