import { describe, expect, it } from 'vitest';
import {
  buildBossObject,
  compareBossObjectSpecs,
  isBossObjectCategory,
  placeBossObject,
  validateBossObjectSpec,
  BOSS_OBJECT_SLOTS,
  type BossObjectSpec,
} from '../../src/game/sim/boss/boss-object-manager.js';

const spec = (extra: Partial<BossObjectSpec> = {}): BossObjectSpec => Object.freeze({
  slotId: 'boss_slot_0',
  lane: 'middle',
  x100: 5000,
  targetable: true,
  objectiveLink: 'obj_1',
  damagePolicy: 'normal',
  statusPolicy: 'allow',
  cleanupPolicy: 'on_objective',
  fallback: 'FAIL',
  ...extra,
});

describe('Phase 21 T03: boss objects', () => {
  it('validates a well-formed spec', () => {
    expect(() => { validateBossObjectSpec(spec()); }).not.toThrow();
  });

  it('rejects an unknown slot id', () => {
    expect(() => { validateBossObjectSpec(spec({ slotId: 'slot_9' } as unknown as Partial<BossObjectSpec>)); }).toThrow(/P21_OBJECT_INVALID/);
  });

  it('rejects an unknown lane', () => {
    expect(() => { validateBossObjectSpec(spec({ lane: 'side' } as unknown as Partial<BossObjectSpec>)); }).toThrow(/P21_OBJECT_INVALID/);
  });

  it('rejects a non-integer x100', () => {
    expect(() => { validateBossObjectSpec(spec({ x100: 10.5 })); }).toThrow(/X100/);
  });

  it('rejects an unknown damage policy', () => {
    expect(() => { validateBossObjectSpec(spec({ damagePolicy: 'reflect' } as unknown as Partial<BossObjectSpec>)); }).toThrow(/P21_OBJECT_INVALID/);
  });

  it('exposes exactly four stable slots', () => {
    expect(BOSS_OBJECT_SLOTS).toBe(4);
  });

  it('builds a BOSS_OBJECT temp entity with counted=false', () => {
    const entity = buildBossObject(spec(), 'obj_alpha', 'enemy', 'boss_ash', 'content_boss', 0, 0);
    expect(entity.kind).toBe('BOSS_OBJECT');
    expect(entity.counted).toBe(false);
    expect(entity.slotId).toBe('boss_slot_0');
    expect(isBossObjectCategory(entity)).toBe(true);
  });

  it('places into a free slot', () => {
    const entity = buildBossObject(spec(), 'obj_alpha', 'enemy', 'boss_ash', 'content_boss', 0, 0);
    expect(placeBossObject(spec(), entity, false).kind).toBe('PLACED');
  });

  it('blocks an occupied slot with FAIL fallback and a stable diagnostic', () => {
    const entity = buildBossObject(spec(), 'obj_alpha', 'enemy', 'boss_ash', 'content_boss', 0, 0);
    const result = placeBossObject(spec(), entity, true);
    expect(result.kind).toBe('BLOCKED');
    expect(result.diagnostic).toBe('P21_OBJECT_SLOT_BLOCKED');
    expect(result.entity).toBeNull();
  });

  it('defers an occupied slot with DEFER fallback (never silent stacking)', () => {
    const entity = buildBossObject(spec({ fallback: 'DEFER' }), 'obj_alpha', 'enemy', 'boss_ash', 'content_boss', 0, 0);
    const result = placeBossObject(spec({ fallback: 'DEFER' }), entity, true);
    expect(result.kind).toBe('DEFERRED');
    expect(result.diagnostic).toBe('P21_OBJECT_SLOT_BLOCKED');
  });

  it('orders specs by slot id code-unit order', () => {
    const a = spec({ slotId: 'boss_slot_1' });
    const b = spec({ slotId: 'boss_slot_0' });
    expect(compareBossObjectSpecs(b, a)).toBeLessThan(0);
  });
});
