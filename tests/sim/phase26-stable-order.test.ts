import { describe, expect, it } from 'vitest';
import { compareCodeUnits, filterActiveWarnings, sortEntities, sortWarnings } from '../../src/game/hud/stable-order.js';
import type { PresentedEntity } from '../../src/game/hud/types.js';
import { presentedEntity, warningItem } from './phase26-helpers.js';

describe('sortEntities (semantic order golden)', () => {
  it('orders player before enemy, then lane, x, stable id', () => {
    const entities = [
      presentedEntity('e1', { side: 'ENEMY', lane: 'TOP', x: 10 }),
      presentedEntity('p2', { side: 'PLAYER', lane: 'BOTTOM', x: 10 }),
      presentedEntity('p1', { side: 'PLAYER', lane: 'MIDDLE', x: 5 }),
      presentedEntity('p0', { side: 'PLAYER', lane: 'TOP', x: 5 }),
    ];
    expect(sortEntities(entities).map((e) => e.id)).toEqual(['p0', 'p1', 'p2', 'e1']);
  });

  it('resolves ties with the stable entity id (code units)', () => {
    const entities = [
      presentedEntity('b', { lane: 'TOP', x: 10 }),
      presentedEntity('a', { lane: 'TOP', x: 10 }),
      presentedEntity('aa', { lane: 'TOP', x: 10 }),
    ];
    expect(sortEntities(entities).map((e) => e.id)).toEqual(['a', 'aa', 'b']);
  });

  it('orders lanes canonically top, middle, bottom', () => {
    const entities = [
      presentedEntity('m', { lane: 'MIDDLE' }),
      presentedEntity('b', { lane: 'BOTTOM' }),
      presentedEntity('t', { lane: 'TOP' }),
    ];
    expect(sortEntities(entities).map((e) => e.id)).toEqual(['t', 'm', 'b']);
  });

  it('is stable under any input permutation', () => {
    const a = presentedEntity('a', { side: 'ENEMY', lane: 'BOTTOM', x: 40 });
    const b = presentedEntity('b', { side: 'PLAYER', lane: 'BOTTOM', x: 40 });
    const c = presentedEntity('c', { side: 'PLAYER', lane: 'BOTTOM', x: 10 });
    const expected = ['c', 'b', 'a'];
    const permutations: PresentedEntity[][] = [
      [a, b, c],
      [c, a, b],
      [b, c, a],
      [a, c, b],
      [c, b, a],
      [b, a, c],
    ];
    for (const permutation of permutations) {
      expect(sortEntities(permutation).map((e) => e.id)).toEqual(expected);
    }
  });
});

describe('sortWarnings (warning timeline)', () => {
  it('orders by due tick ascending', () => {
    const warnings = [warningItem('late', { dueTick: 200 }), warningItem('early', { dueTick: 50 })];
    expect(sortWarnings(warnings).map((w) => w.id)).toEqual(['early', 'late']);
  });

  it('breaks due-tick ties by descending severity', () => {
    const warnings = [warningItem('low', { dueTick: 10, severity: 1 }), warningItem('high', { dueTick: 10, severity: 3 })];
    expect(sortWarnings(warnings).map((w) => w.id)).toEqual(['high', 'low']);
  });

  it('breaks severity ties by lane, x, then stable id', () => {
    const warnings = [
      warningItem('d', { dueTick: 5, severity: 2, lane: 'BOTTOM', x: 1 }),
      warningItem('a', { dueTick: 5, severity: 2, lane: 'TOP', x: 1 }),
      warningItem('b', { dueTick: 5, severity: 2, lane: 'TOP', x: 9 }),
      warningItem('c', { dueTick: 5, severity: 2, lane: 'TOP', x: 9 }),
    ];
    expect(sortWarnings(warnings).map((w) => w.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('filterActiveWarnings', () => {
  it('removes expired warnings deterministically', () => {
    const warnings = [warningItem('expired', { dueTick: 99 }), warningItem('now', { dueTick: 100 }), warningItem('future', { dueTick: 101 })];
    expect(filterActiveWarnings(warnings, 100).map((w) => w.id)).toEqual(['now', 'future']);
  });

  it('keeps due warnings that are exactly current', () => {
    const warnings = [warningItem('due', { dueTick: 42 })];
    expect(filterActiveWarnings(warnings, 42).map((w) => w.id)).toEqual(['due']);
  });
});

describe('compareCodeUnits', () => {
  it('is deterministic and locale-independent', () => {
    expect(compareCodeUnits('a', 'b')).toBe(-1);
    expect(compareCodeUnits('b', 'a')).toBe(1);
    expect(compareCodeUnits('a', 'a')).toBe(0);
    expect(compareCodeUnits('Z', 'a')).toBe(-1);
    // Code-unit order differs from locale collation: 'ä' (U+00E4) sorts
    // after 'z' regardless of locale.
    expect(compareCodeUnits('ä', 'z')).toBe(1);
  });
});
