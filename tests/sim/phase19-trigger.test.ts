import { describe, expect, it } from 'vitest';
import { KernelInvariantError } from '../../src/game/sim/core/invariant-error.js';
import type { KernelEntity } from '../../src/game/sim/core/entity.js';
import { definePredicate, defineTrigger, MAX_TRIGGER_CHILDREN, MAX_TRIGGER_DEPTH, type TriggerNode } from '../../src/game/sim/ability/trigger-definition.js';
import { evaluatePredicate, evaluateTrigger, type TriggerContext, type TriggerEventRecord } from '../../src/game/sim/ability/trigger-evaluator.js';

function entity(id: string, side: 'player' | 'enemy', lp: number, maxLp = 1000, lane: 'top' | 'middle' | 'bottom' = 'middle', origin: 'regular' | 'summoned' | 'construct' = 'regular'): KernelEntity {
  return {
    id,
    side,
    phase: { phase: 'ACTIVE', enteredTick: 0, controlledReturn: null },
    maxLp,
    lp,
    shield: 0,
    lane,
    x100: 500,
    targetId: null,
    timers: {},
    origin,
  } as KernelEntity;
}

function ctx(overrides: Partial<TriggerContext> = {}): TriggerContext {
  const player = entity('hero', 'player', 800);
  const boss = entity('boss', 'enemy', 6000, 10000, 'middle', 'regular');
  return {
    battleTick: 0,
    ownerId: 'hero',
    ownerSide: 'player',
    entities: [player, boss],
    statuses: [],
    battlePhase: { phase: 'ACTIVE', enteredTick: 0, resolvingEndTicks: 0 },
    eventsThisTick: [],
    bossIds: new Set(['boss']),
    chargeReady: false,
    onceFired: false,
    hpBeforeTick: new Map(),
    ...overrides,
  } as TriggerContext;
}

function event(type: TriggerEventRecord['type'], side: 'player' | 'enemy', sourceId: string | null = null): TriggerEventRecord {
  return Object.freeze({ type, sourceId, targetIds: Object.freeze([]), side });
}

describe('P19 T01 trigger union — positive/negative', () => {
  it('battle_start matches only at tick 0', () => {
    const t = defineTrigger({ type: 'battle_start' });
    expect(evaluateTrigger(t, ctx({ battleTick: 0 })).matched).toBe(true);
    expect(evaluateTrigger(t, ctx({ battleTick: 1 })).matched).toBe(false);
  });

  it('tick_interval matches on the cadence with offset', () => {
    const t = defineTrigger({ type: 'tick_interval', everyTicks: 5, offsetTicks: 2 });
    for (const tick of [2, 7, 12]) expect(evaluateTrigger(t, ctx({ battleTick: tick })).matched).toBe(true);
    for (const tick of [0, 1, 3, 5, 8]) expect(evaluateTrigger(t, ctx({ battleTick: tick })).matched).toBe(false);
  });

  it('hp_threshold_crossed detects the crossing directionally', () => {
    const below = defineTrigger({ type: 'hp_threshold_crossed', scope: 'self', thresholdPercent: 50, direction: 'below' });
    const above = defineTrigger({ type: 'hp_threshold_crossed', scope: 'self', thresholdPercent: 50, direction: 'above' });
    // Before 800 (80%), now 400 (40%) -> crossed below.
    const c = ctx({ hpBeforeTick: Object.freeze(new Map([['hero', 800]])) });
    const cLow = Object.freeze({ ...c, entities: Object.freeze([entity('hero', 'player', 400), entity('boss', 'enemy', 6000, 10000)]) });
    expect(evaluateTrigger(below, cLow).matched).toBe(true);
    expect(evaluateTrigger(below, cLow).reasonCode).toBe('hp_below_crossed');
    expect(evaluateTrigger(above, cLow).matched).toBe(false);
    // Before 200 (20%), now 600 (60%) -> crossed above.
    const cHigh = Object.freeze({ ...c, entities: Object.freeze([entity('hero', 'player', 600), entity('boss', 'enemy', 6000, 10000)]) });
    const cHighBefore = Object.freeze({ ...cHigh, hpBeforeTick: Object.freeze(new Map([['hero', 200]])) });
    expect(evaluateTrigger(above, cHighBefore).matched).toBe(true);
    expect(evaluateTrigger(below, cHighBefore).matched).toBe(false);
  });

  it('ally_event / enemy_event match stable event ids on the right side', () => {
    const ally = defineTrigger({ type: 'ally_event', eventId: 'DamageApplied' });
    const enemy = defineTrigger({ type: 'enemy_event', eventId: 'DamageApplied' });
    const c = ctx({ eventsThisTick: Object.freeze([event('DamageApplied', 'enemy')]) });
    expect(evaluateTrigger(ally, c).matched).toBe(false);
    expect(evaluateTrigger(enemy, c).matched).toBe(true);
    const c2 = ctx({ eventsThisTick: Object.freeze([event('DamageApplied', 'player')]) });
    expect(evaluateTrigger(ally, c2).matched).toBe(true);
  });

  it('status_present / status_absent evaluate against the status collection', () => {
    const present = defineTrigger({ type: 'status_present', kind: 'burn', scope: 'self' });
    const absent = defineTrigger({ type: 'status_absent', kind: 'burn', scope: 'self' });
    const burning = ctx({
      statuses: Object.freeze([
        Object.freeze({
          statusId: 's1', kind: 'burn', polarity: 'negative', targetId: 'hero', sourceId: 'boss',
          effectId: 'burn_1', startTick: 0, endTick: 30, strength: 1, stackGroup: 'burn', sequence: 1,
          stackPolicy: 'independent_by_source', maxStacks: 5, flags: Object.freeze([]),
        }),
      ]),
    });
    expect(evaluateTrigger(present, burning).matched).toBe(true);
    expect(evaluateTrigger(absent, burning).matched).toBe(false);
    expect(evaluateTrigger(present, ctx()).matched).toBe(false);
    expect(evaluateTrigger(absent, ctx()).matched).toBe(true);
  });

  it('charge_ready and once compose', () => {
    const ready = defineTrigger({ type: 'charge_ready' });
    expect(evaluateTrigger(ready, ctx({ chargeReady: true })).matched).toBe(true);
    expect(evaluateTrigger(ready, ctx({ chargeReady: false })).matched).toBe(false);

    const once = defineTrigger({ type: 'once', child: { type: 'tick_interval', everyTicks: 10 } });
    expect(evaluateTrigger(once, ctx({ battleTick: 10, onceFired: false })).matched).toBe(true);
    expect(evaluateTrigger(once, ctx({ battleTick: 10, onceFired: true })).matched).toBe(false);
    expect(evaluateTrigger(once, ctx({ battleTick: 10, onceFired: true })).reasonCode).toBe('once_already_fired');
  });

  it('entity_defeated matches a Defeated event on the right side', () => {
    const allyDown = defineTrigger({ type: 'entity_defeated', side: 'ally' });
    const c = ctx({ eventsThisTick: Object.freeze([event('Defeated', 'player', 'hero')]) });
    expect(evaluateTrigger(allyDown, c).matched).toBe(true);
    const c2 = ctx({ eventsThisTick: Object.freeze([event('Defeated', 'enemy', 'boss')]) });
    expect(evaluateTrigger(allyDown, c2).matched).toBe(false);
  });

  it('boss_phase matches the battle phase', () => {
    const t = defineTrigger({ type: 'boss_phase', phase: 'PHASE_TRANSITION' });
    const c = ctx({ battlePhase: { phase: 'PHASE_TRANSITION', enteredTick: 900 as never, resolvingEndTicks: 0 } });
    expect(evaluateTrigger(t, c).matched).toBe(true);
    expect(evaluateTrigger(t, ctx()).matched).toBe(false);
  });

  it('target_condition and count_in_range use predicates', () => {
    const low = defineTrigger({ type: 'target_condition', predicate: { type: 'hp_below_percent', percent: 50 } });
    const bossTarget = ctx();
    expect(evaluateTrigger(low, bossTarget, 'boss').matched).toBe(false); // boss at 60%
    expect(evaluateTrigger(low, bossTarget, 'hero').matched).toBe(false); // hero at 80%

    const inRange = defineTrigger({ type: 'count_in_range', predicate: { type: 'is_boss' }, min: 1, max: 1 });
    expect(evaluateTrigger(inRange, bossTarget).matched).toBe(true);
    const none = defineTrigger({ type: 'count_in_range', predicate: { type: 'is_summoned' }, min: 2, max: 4 });
    expect(evaluateTrigger(none, bossTarget).matched).toBe(false);
  });

  it('all / any / not compose deterministically', () => {
    const all = defineTrigger({
      type: 'all',
      children: [
        { type: 'battle_start' },
        { type: 'status_absent', kind: 'stun', scope: 'self' },
      ],
    });
    expect(evaluateTrigger(all, ctx({ battleTick: 0 })).matched).toBe(true);
    expect(evaluateTrigger(all, ctx({ battleTick: 5 })).matched).toBe(false);

    const anyT = defineTrigger({
      type: 'any',
      children: [{ type: 'charge_ready' }, { type: 'tick_interval', everyTicks: 3 }],
    });
    expect(evaluateTrigger(anyT, ctx({ battleTick: 3, chargeReady: false })).matched).toBe(true);
    expect(evaluateTrigger(anyT, ctx({ battleTick: 4, chargeReady: false })).matched).toBe(false);

    const notT = defineTrigger({ type: 'not', child: { type: 'battle_start' } });
    expect(evaluateTrigger(notT, ctx({ battleTick: 1 })).matched).toBe(true);
    expect(evaluateTrigger(notT, ctx({ battleTick: 0 })).matched).toBe(false);
  });
});

describe('P19 T01 predicates', () => {
  const hero = entity('hero', 'player', 300, 1000);
  const summoned = entity('minion', 'player', 900, 1000, 'top', 'summoned');
  const boss = entity('boss', 'enemy', 6000, 10000);

  it('hp percent uses integer-safe comparison', () => {
    expect(evaluatePredicate({ type: 'hp_below_percent', percent: 40 }, hero, ctx())).toBe(true); // 30% < 40%
    expect(evaluatePredicate({ type: 'hp_above_percent', percent: 20 }, hero, ctx())).toBe(true); // 30% > 20%
    expect(evaluatePredicate({ type: 'hp_below_percent', percent: 20 }, hero, ctx())).toBe(false);
  });

  it('origin and lane filters', () => {
    expect(evaluatePredicate({ type: 'is_regular' }, hero, ctx())).toBe(true);
    expect(evaluatePredicate({ type: 'is_summoned' }, summoned, ctx())).toBe(true);
    expect(evaluatePredicate({ type: 'is_construct' }, summoned, ctx())).toBe(false);
    expect(evaluatePredicate({ type: 'lane_is', lane: 'top' }, summoned, ctx())).toBe(true);
    expect(evaluatePredicate({ type: 'lane_is', lane: 'middle' }, summoned, ctx())).toBe(false);
  });

  it('is_boss uses the authoritative boss id set', () => {
    expect(evaluatePredicate({ type: 'is_boss' }, boss, ctx())).toBe(true);
    expect(evaluatePredicate({ type: 'is_boss' }, hero, ctx())).toBe(false);
  });

  it('has_status / lacks_status', () => {
    const burning = ctx({
      statuses: Object.freeze([
        Object.freeze({
          statusId: 's1', kind: 'burn', polarity: 'negative', targetId: 'hero', sourceId: 'boss',
          effectId: 'burn_1', startTick: 0, endTick: 30, strength: 1, stackGroup: 'burn', sequence: 1,
          stackPolicy: 'independent_by_source', maxStacks: 5, flags: Object.freeze([]),
        }),
      ]),
    });
    expect(evaluatePredicate({ type: 'has_status', kind: 'burn' }, hero, burning)).toBe(true);
    expect(evaluatePredicate({ type: 'lacks_status', kind: 'burn' }, hero, burning)).toBe(false);
    expect(evaluatePredicate({ type: 'has_status', kind: 'stun' }, hero, burning)).toBe(false);
  });
});

describe('P19 T01 §5.3 safety bounds', () => {
  it('rejects unknown variants', () => {
    expect(() => defineTrigger({ type: 'bogus' } as unknown as TriggerNode)).toThrow(KernelInvariantError);
    expect(() => definePredicate({ type: 'bogus' } as never)).toThrow(KernelInvariantError);
  });

  it('rejects NaN, floats, negative and oversized values', () => {
    expect(() => defineTrigger({ type: 'tick_interval', everyTicks: NaN })).toThrow(KernelInvariantError);
    expect(() => defineTrigger({ type: 'tick_interval', everyTicks: 1.5 })).toThrow(KernelInvariantError);
    expect(() => defineTrigger({ type: 'tick_interval', everyTicks: -3 })).toThrow(KernelInvariantError);
    expect(() => defineTrigger({ type: 'tick_interval', everyTicks: 0 })).toThrow(KernelInvariantError);
    expect(() => defineTrigger({ type: 'hp_threshold_crossed', scope: 'self', thresholdPercent: 0, direction: 'below' })).toThrow(KernelInvariantError);
    expect(() => defineTrigger({ type: 'hp_threshold_crossed', scope: 'self', thresholdPercent: 101, direction: 'below' })).toThrow(KernelInvariantError);
    expect(() => defineTrigger({ type: 'count_in_range', predicate: { type: 'is_alive' }, min: 4, max: 2 })).toThrow(KernelInvariantError);
  });

  it('rejects invalid ids, kinds, lanes and unknown events', () => {
    expect(() => defineTrigger({ type: 'ally_event', eventId: 'NotARealEvent' as never })).toThrow(KernelInvariantError);
    expect(() => defineTrigger({ type: 'status_present', kind: 'not_a_kind' as never, scope: 'self' })).toThrow(KernelInvariantError);
    expect(() => definePredicate({ type: 'lane_is', lane: 'sideways' as never })).toThrow(KernelInvariantError);
    expect(() => defineTrigger({ type: 'entity_defeated', side: 'other' as never })).toThrow(KernelInvariantError);
  });

  it('enforces the AST depth cap', () => {
    let deep: TriggerNode = { type: 'battle_start' };
    for (let i = 0; i <= MAX_TRIGGER_DEPTH + 1; i++) deep = { type: 'not', child: deep };
    expect(() => defineTrigger(deep)).toThrow(KernelInvariantError);
  });

  it('enforces the child cap', () => {
    const leaf = (): TriggerNode => ({ type: 'battle_start' });
    const many = Array.from({ length: MAX_TRIGGER_CHILDREN + 1 }, leaf);
    expect(() => defineTrigger({ type: 'all', children: many })).toThrow(KernelInvariantError);
    const ok = Array.from({ length: MAX_TRIGGER_CHILDREN }, leaf);
    expect(() => defineTrigger({ type: 'all', children: ok })).not.toThrow();
  });

  it('pure evaluation is deterministic across identical inputs', () => {
    const t = defineTrigger({ type: 'all', children: [{ type: 'tick_interval', everyTicks: 4 }, { type: 'charge_ready' }] });
    const c = ctx({ battleTick: 8, chargeReady: true });
    const a = evaluateTrigger(t, c);
    const b = evaluateTrigger(t, c);
    expect(a.matched).toBe(true);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
