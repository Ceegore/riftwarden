import { describe, expect, it } from 'vitest';
import {
  PERMANENT_END_TICK,
  controlCategoryOf,
  isStatusKind,
  statusKindOrdinal,
  validateStatusInstance,
  type StatusInstance,
  type StatusKind,
  type StackPolicy,
} from '../../src/game/sim/status/status-instance.js';
import {
  activeForTarget,
  byStatusId,
  byTargetAndKind,
  byTargetAndSource,
  byTargetAndStackGroup,
  byTargetId,
  createStatusCollection,
} from '../../src/game/sim/status/status-collection.js';
import { compareStable, compareStrength, remainingTicks, resolveStack } from '../../src/game/sim/status/status-stacking.js';

let seq = 0;
function status(
  kind: StatusKind,
  overrides: Partial<StatusInstance> = {},
): StatusInstance {
  seq += 1;
  return Object.freeze({
    statusId: `st_${String(seq)}`,
    kind,
    polarity: 'negative',
    targetId: 'unit_target',
    sourceId: 'unit_source',
    effectId: 'effect_x',
    startTick: 10,
    endTick: 40,
    strength: 100,
    stackGroup: 'burn',
    sequence: seq,
    stackPolicy: 'replace_if_stronger',
    maxStacks: 3,
    flags: Object.freeze([]),
    ...overrides,
  });
}

describe('P18 T01 status-instance', () => {
  it('control category maps hard vs soft control', () => {
    expect(controlCategoryOf('stun')).toBe('hard');
    expect(controlCategoryOf('silence')).toBe('hard');
    expect(controlCategoryOf('confusion')).toBe('hard');
    expect(controlCategoryOf('slow')).toBe('soft');
    expect(controlCategoryOf('burn')).toBeNull();
    expect(controlCategoryOf('regeneration')).toBeNull();
  });

  it('accepts a valid instance and rejects unknown kinds/policies/flags', () => {
    expect(() => { validateStatusInstance(status('burn')); }).not.toThrow();
    expect(() => { validateStatusInstance(status('shield' as StatusKind)); }).toThrow();
    expect(() => { validateStatusInstance(status('burn', { stackPolicy: 'bogus' as StackPolicy })); }).toThrow();
    expect(() => { validateStatusInstance(status('burn', { flags: ['nope' as never] })); }).toThrow();
    expect(() => { validateStatusInstance(status('burn', { flags: ['unremovable', 'unremovable'] })); }).toThrow();
  });

  it('rejects non-integer, negative, non-exclusive and invalid-integer fields', () => {
    expect(() => { validateStatusInstance(status('burn', { startTick: 1.5 })); }).toThrow();
    expect(() => { validateStatusInstance(status('burn', { strength: -1 })); }).toThrow();
    expect(() => { validateStatusInstance(status('burn', { endTick: 10, startTick: 10 })); }).toThrow();
    expect(() => { validateStatusInstance(status('burn', { maxStacks: 0 })); }).toThrow();
    expect(() => { validateStatusInstance(status('burn', { targetId: 'BAD ID' })); }).toThrow();
    expect(() => { validateStatusInstance(status('burn', { endTick: PERMANENT_END_TICK })); }).not.toThrow();
  });

  it('ordinals are stable and shield is not a status kind', () => {
    expect(statusKindOrdinal('attack_up')).toBe(0);
    expect(isStatusKind('burn')).toBe(true);
    expect(isStatusKind('shield')).toBe(false);
  });
});

describe('P18 T02 status-collection', () => {
  it('rejects duplicate statusId and duplicate sequence', () => {
    const a = status('burn', { statusId: 'dup', sequence: 5 });
    expect(() => createStatusCollection([a, status('poison', { statusId: 'dup', sequence: 6 })])).toThrow();
    expect(() => createStatusCollection([a, status('poison', { sequence: 5 })])).toThrow();
  });

  it('queries by the five indices and returns canonically sorted copies', () => {
    const a = status('burn', { targetId: 't1', stackGroup: 'burn', sourceId: 's1', statusId: 'st_b', sequence: 1 });
    const b = status('poison', { targetId: 't1', stackGroup: 'poison', sourceId: 's2', statusId: 'st_a', sequence: 2 });
    const c = status('slow', { targetId: 't2', stackGroup: 'slow', sourceId: 's1', statusId: 'st_c', sequence: 3 });
    const col = createStatusCollection([c, a, b]);
    expect(byStatusId(col, 'st_b')).toBe(a);
    expect(byStatusId(col, 'missing')).toBeUndefined();
    expect(byTargetId(col, 't1').map((i) => i.statusId)).toEqual(['st_b', 'st_a']);
    expect(byTargetAndKind(col, 't1', 'burn')).toEqual([a]);
    expect(byTargetAndStackGroup(col, 't1', 'burn')).toEqual([a]);
    expect(byTargetAndSource(col, 't1', 's1')).toEqual([a]);
    expect(Object.isFrozen(byTargetId(col, 't1'))).toBe(true);
  });

  it('activeForTarget honors the exclusive endTick boundary', () => {
    const a = status('burn', { startTick: 10, endTick: 40 });
    const col = createStatusCollection([a]);
    expect(activeForTarget(col, 'unit_target', 39)).toHaveLength(1);
    expect(activeForTarget(col, 'unit_target', 40)).toHaveLength(0);
  });
});

describe('P18 T02 stack policies (§6)', () => {
  const now = 20;

  it('replace_if_stronger: stronger replaces, weaker ignored, equal refreshes', () => {
    const current = status('burn', { strength: 100, endTick: 50, statusId: 'st_old' });
    const stronger = status('burn', { strength: 200, endTick: 60 });
    const weaker = status('burn', { strength: 50, endTick: 60 });
    const equal = status('burn', { strength: 100, endTick: 60 });

    expect(resolveStack([current], stronger, { now }).kind).toBe('applied');
    expect(resolveStack([current], weaker, { now }).kind).toBe('ignored_weaker');
    const refreshed = resolveStack([current], equal, { now });
    expect(refreshed.kind).toBe('refreshed');
    expect(refreshed.kept[0]?.endTick).toBe(60);
    expect(refreshed.kept[0]?.statusId).toBe('st_old');
  });

  it('refresh_duration keeps existing strength and refreshes the endTick', () => {
    const current = status('burn', { strength: 300, endTick: 50, stackPolicy: 'refresh_duration' });
    const weakReapply = status('burn', { strength: 10, endTick: 70, stackPolicy: 'refresh_duration' });
    const out = resolveStack([current], weakReapply, { now });
    expect(out.kind).toBe('refreshed');
    expect(out.kept[0]?.strength).toBe(300);
    expect(out.kept[0]?.endTick).toBe(70);
  });

  it('extend_duration_capped adds duration and caps, and reports no-op at cap', () => {
    const current = status('burn', { endTick: 30, stackPolicy: 'extend_duration_capped' });
    // remaining 10, added 30 → 40 (under cap 50).
    const incoming = status('burn', { startTick: 20, endTick: 50, stackPolicy: 'extend_duration_capped' });
    const extended = resolveStack([current], incoming, { now, durationCapTicks: 50 });
    expect(extended.kind).toBe('refreshed');
    expect(extended.kept[0]?.endTick).toBe(20 + 40);

    const atCap = status('burn', { endTick: 70, stackPolicy: 'extend_duration_capped' });
    const capped = resolveStack([atCap], incoming, { now, durationCapTicks: 50 });
    expect(capped.kind).toBe('ignored_duration_cap');
  });

  it('independent_by_source: one per source, refreshes same source, caps by maxStacks', () => {
    const a = status('burn', { sourceId: 's1', endTick: 40, stackPolicy: 'independent_by_source', maxStacks: 2, statusId: 'st_a' });
    const b = status('burn', { sourceId: 's2', endTick: 40, stackPolicy: 'independent_by_source', maxStacks: 2, statusId: 'st_b' });
    const sameSourceReapply = status('burn', { sourceId: 's1', endTick: 70, stackPolicy: 'independent_by_source', maxStacks: 2 });
    const refreshed = resolveStack([a, b], sameSourceReapply, { now });
    expect(refreshed.kind).toBe('refreshed');
    expect(refreshed.kept).toHaveLength(2);
    expect(refreshed.kept.find((i) => i.sourceId === 's1')?.endTick).toBe(70);

    const c = status('burn', { sourceId: 's3', endTick: 40, stackPolicy: 'independent_by_source', maxStacks: 2, strength: 10 });
    const replaced = resolveStack([a, b], c, { now });
    expect(replaced.kind).toBe('applied');
    expect(replaced.kept).toHaveLength(2);
    // Weakest (strength 100 a/b, incoming 10) — but the incoming replaces a weaker existing only.
    // Here a and b are both strength 100; incoming strength 10 is weaker, so it replaces by the
    // stable comparison (same strength → shortest remaining → sourceId order).
  });

  it('no_reapply rejects a matching instance while active', () => {
    const current = status('burn', { stackPolicy: 'no_reapply', endTick: 60 });
    const reapply = status('burn', { stackPolicy: 'no_reapply', endTick: 80 });
    expect(resolveStack([current], reapply, { now }).kind).toBe('ignored_no_reapply');
    const differentKind = status('poison', { stackPolicy: 'no_reapply', endTick: 80 });
    expect(resolveStack([current], differentKind, { now }).kind).toBe('applied');
  });

  it('compareStrength uses strength alone', () => {
    const strong = status('burn', { strength: 200, endTick: 30 });
    const weak = status('burn', { strength: 100, endTick: 30 });
    expect(compareStrength(strong, weak)).toBeGreaterThan(0);
    expect(compareStrength(weak, strong)).toBeLessThan(0);
    expect(compareStrength(strong, status('burn', { strength: 200, endTick: 90 }))).toBe(0);
  });

  it('compareStable orders by strength, remaining duration, sourceId, statusId', () => {
    const strong = status('burn', { strength: 200, endTick: 30 });
    const weak = status('burn', { strength: 100, endTick: 30 });
    expect(compareStable(strong, weak, now)).toBeGreaterThan(0);

    const longDur = status('burn', { strength: 100, endTick: 90, statusId: 'st_long' });
    const shortDur = status('burn', { strength: 100, endTick: 30, statusId: 'st_short' });
    expect(compareStable(longDur, shortDur, now)).toBeGreaterThan(0);

    const same = status('burn', { strength: 100, endTick: 30, sourceId: 's_a', statusId: 'st_a' });
    const other = status('burn', { strength: 100, endTick: 30, sourceId: 's_b', statusId: 'st_b' });
    expect(compareStable(same, other, now)).toBeLessThan(0);
    expect(compareStable(same, same, now)).toBe(0);
  });

  it('remainingTicks clamps to zero at the exclusive endTick', () => {
    expect(remainingTicks(status('burn', { endTick: 25 }), now)).toBe(5);
    expect(remainingTicks(status('burn', { endTick: 15 }), now)).toBe(0);
  });
});
