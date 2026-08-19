import { describe, expect, it } from 'vitest';
import {
  HARD_BATTLE_LIMIT_TICKS,
  MAX_EVENTS_PER_BATTLE,
  canonicalJson,
  canonicalize,
  compareCodeUnits,
  firstViolation,
  inspectBattle,
  stableHashText,
  type BattleProbe,
  type EntityProbe,
} from '../../src/game/sim/monitor/invariant-monitor.js';

function entity(overrides: Partial<EntityProbe> & { id: string }): EntityProbe {
  return { hp: 100, maxHp: 100, shield: 0, lane: 1, x100: 3000, state: 'ACTIVE', ...overrides };
}

function probe(overrides: Partial<BattleProbe> = {}): BattleProbe {
  return { tick: 1, events: 0, entities: [entity({ id: 'unit_a' })], ...overrides };
}

/** First violation code, or null when clean — avoids non-null assertions. */
function firstCode(p: BattleProbe): string | null {
  return firstViolation(p)?.code ?? null;
}

describe('Phase 22 invariant monitor', () => {
  it('reports nothing for a clean probe', () => {
    expect(inspectBattle(probe())).toEqual([]);
  });

  it('P22_INV_HP_RANGE: hp below zero and above max', () => {
    expect(firstCode(probe({ entities: [entity({ id: 'a', hp: -1 })] }))).toBe('P22_INV_HP_RANGE');
    expect(firstCode(probe({ entities: [entity({ id: 'a', hp: 101, maxHp: 100 })] }))).toBe('P22_INV_HP_RANGE');
    const v = firstViolation(probe({ entities: [entity({ id: 'a', hp: -1 })] }));
    expect(v?.path).toBe('entities.a.lp');
    expect(v?.tick).toBe(1);
  });

  it('P22_INV_NEGATIVE_SHIELD', () => {
    expect(firstCode(probe({ entities: [entity({ id: 'a', shield: -5 })] }))).toBe('P22_INV_NEGATIVE_SHIELD');
  });

  it('P22_INV_GEOMETRY: bad lane or unsafe x100', () => {
    expect(firstCode(probe({ entities: [entity({ id: 'a', lane: 3 })] }))).toBe('P22_INV_GEOMETRY');
    expect(firstCode(probe({ entities: [entity({ id: 'a', lane: -1 })] }))).toBe('P22_INV_GEOMETRY');
    expect(firstCode(probe({ entities: [entity({ id: 'a', x100: 1.5 })] }))).toBe('P22_INV_GEOMETRY');
  });

  it('P22_INV_DUPLICATE_ID', () => {
    const v = firstViolation(probe({ entities: [entity({ id: 'a' }), entity({ id: 'a' })] }));
    expect(v?.code).toBe('P22_INV_DUPLICATE_ID');
    expect(v?.path).toBe('entities.a.id');
  });

  it('contradictory phase states: DEFEATED/REMOVED with hp, ACTIVE with zero hp', () => {
    expect(firstCode(probe({ entities: [entity({ id: 'a', state: 'DEFEATED', hp: 50 })] }))).toBe('P22_INV_DEFEATED_WITH_HP');
    expect(firstCode(probe({ entities: [entity({ id: 'a', state: 'REMOVED', hp: 50 })] }))).toBe('P22_INV_REMOVED_WITH_HP');
    expect(firstCode(probe({ entities: [entity({ id: 'a', state: 'ACTIVE', hp: 0 })] }))).toBe('P22_INV_ACTIVE_ZERO_HP');
  });

  it('P22_INV_SIDE_CAP: active entities over configured cap', () => {
    const v = firstViolation(
      probe({
        sideCaps: { player: 1, enemy: 1 },
        entities: [entity({ id: 'unit_a' }), entity({ id: 'unit_b' }), entity({ id: 'unit_c' })],
      }),
    );
    expect(v?.code).toBe('P22_INV_SIDE_CAP');
    expect(v?.path).toBe('entities.player');
  });

  it('P22_INV_EVENT_CAP at the 10000 boundary and over', () => {
    expect(firstCode(probe({ events: MAX_EVENTS_PER_BATTLE }))).toBeNull();
    expect(firstCode(probe({ events: MAX_EVENTS_PER_BATTLE + 1 }))).toBe('P22_INV_EVENT_CAP');
  });

  it('P22_INV_BATTLE_CAP: hard limit and mission cap', () => {
    expect(firstCode(probe({ tick: HARD_BATTLE_LIMIT_TICKS }))).toBeNull();
    expect(firstCode(probe({ tick: HARD_BATTLE_LIMIT_TICKS + 1 }))).toBe('P22_INV_BATTLE_CAP');
    expect(firstCode(probe({ tick: 31, missionCapTicks: 30 }))).toBe('P22_INV_BATTLE_CAP');
  });

  it('P22_INV_REWARD_COMMIT: rewards committed before terminal tick', () => {
    expect(firstCode(probe({ rewardsCommitted: true }))).toBe('P22_INV_REWARD_COMMIT');
    expect(firstCode(probe({ rewardsCommitted: false }))).toBeNull();
  });

  it('firstViolation returns the earliest (single canonical answer)', () => {
    const v = firstViolation(probe({ entities: [entity({ id: 'a', hp: -1 }), entity({ id: 'a' })] }));
    expect(v?.code).toBe('P22_INV_HP_RANGE');
  });

  it('bounded excerpts cap array length', () => {
    const many = Array.from({ length: 100 }, (_, i) => entity({ id: `u${String(i)}` }));
    const v = firstViolation(probe({ entities: [...many, entity({ id: 'u0' })] }));
    expect(v?.excerpt).toBe('u0');
  });
});

describe('Phase 22 canonical JSON helpers', () => {
  it('compareCodeUnits is a stable code-unit comparator', () => {
    expect(compareCodeUnits('a', 'b')).toBe(-1);
    expect(compareCodeUnits('b', 'a')).toBe(1);
    expect(compareCodeUnits('a', 'a')).toBe(0);
  });

  it('canonicalize sorts keys recursively and rejects unsafe numbers', () => {
    expect(canonicalize({ b: 1, a: [3, 1] })).toEqual({ a: [3, 1], b: 1 });
    expect(() => canonicalize({ x: 1.5 })).toThrow(/P22_UNSAFE_NUMBER/);
  });

  it('canonicalJson emits fixed key order with trailing LF', () => {
    const a = canonicalJson({ b: 1, a: 2 });
    const b = canonicalJson({ a: 2, b: 1 });
    expect(a).toBe(b);
    expect(a).toMatch(/\n$/);
  });

  it('stableHashText is deterministic and 8-hex', () => {
    expect(stableHashText('vector_alpha')).toBe(stableHashText('vector_alpha'));
    expect(stableHashText('vector_alpha')).toMatch(/^[0-9a-f]{8}$/);
  });
});
