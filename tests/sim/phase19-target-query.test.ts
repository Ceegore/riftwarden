import { describe, expect, it } from 'vitest';
import { KernelInvariantError } from '../../src/game/sim/core/invariant-error.js';
import {
  resolveTargetQuery,
  validateTargetQuery,
  type TargetQuery,
  type TargetQueryContext,
} from '../../src/game/sim/ability/ability-target-query.js';
import type { KernelEntity } from '../../src/game/sim/core/entity.js';
import { entity, tick } from './test-helpers.js';

function ctx(overrides: Partial<TargetQueryContext> = {}): TargetQueryContext {
  return {
    tick: 10,
    source: entity('source', { side: 'player', lane: 'middle', x100: 1000 }),
    entities: [],
    bossIds: new Set<string>(),
    ...overrides,
  };
}

function enemy(id: string, overrides: Partial<KernelEntity> = {}): KernelEntity {
  return entity(id, { side: 'enemy', lane: 'middle', x100: 2000, ...overrides });
}

function ally(id: string, overrides: Partial<KernelEntity> = {}): KernelEntity {
  return entity(id, { side: 'player', lane: 'middle', x100: 2000, ...overrides });
}

function query(overrides: Partial<TargetQuery> = {}): TargetQuery {
  return { space: 'enemy_entity', profile: 'nearest', ...overrides };
}

describe('P19-T02 target query — spaces', () => {
  it('selects the nearest enemy', () => {
    const near = enemy('enemy_near', { x100: 1200 });
    const far = enemy('enemy_far', { x100: 4000 });
    const outcome = resolveTargetQuery(query(), ctx({ entities: [far, near] }));
    expect(outcome.status).toBe('selected');
    if (outcome.status === 'selected') expect(outcome.target.entityId).toBe('enemy_near');
  });

  it('selects self space only for the source', () => {
    const outcome = resolveTargetQuery(query({ space: 'self' }), ctx());
    expect(outcome.status).toBe('selected');
    if (outcome.status === 'selected') expect(outcome.target.entityId).toBe('source');
  });

  it('allied space excludes self and enemies', () => {
    const a = ally('ally_a', { x100: 1500 });
    const e = enemy('enemy_e', { x100: 1300 });
    const outcome = resolveTargetQuery(query({ space: 'allied_entity' }), ctx({ entities: [e, a] }));
    expect(outcome.status).toBe('selected');
    if (outcome.status === 'selected') expect(outcome.target.entityId).toBe('ally_a');
  });

  it('boss_object selects only boss ids', () => {
    const boss = enemy('boss_1', { x100: 3000 });
    const minion = enemy('enemy_minion', { x100: 1200 });
    const outcome = resolveTargetQuery(query({ space: 'boss_object' }), ctx({ entities: [minion, boss], bossIds: new Set(['boss_1']) }));
    expect(outcome.status).toBe('selected');
    if (outcome.status === 'selected') expect(outcome.target.entityId).toBe('boss_1');
  });

  it('ground_point resolves a ground snapshot', () => {
    const outcome = resolveTargetQuery(
      query({ space: 'ground_point', groundKey: 'ground_center', groundLane: 'top', groundX100: 5000 }),
      ctx(),
    );
    expect(outcome.status).toBe('selected');
    if (outcome.status === 'selected') {
      expect(outcome.target.kind).toBe('ground');
      expect(outcome.target.groundKey).toBe('ground_center');
      expect(outcome.target.x100).toBe(5000);
    }
  });

  it('summon_slot resolves the typed port or reports slot_unavailable', () => {
    const missing = resolveTargetQuery(query({ space: 'summon_slot', groundKey: 'slot_1' }), ctx());
    expect(missing.status).toBe('invalid');
    if (missing.status === 'invalid') expect(missing.reason).toBe('slot_unavailable');

    const c = ctx({
      summonSlots: new Map([
        ['slot_1', { slotId: 'slot_1', lane: 'middle', x100: 3000, available: false }],
        ['slot_2', { slotId: 'slot_2', lane: 'middle', x100: 3100, available: true }],
      ]),
    });
    const busy = resolveTargetQuery(query({ space: 'summon_slot', groundKey: 'slot_1' }), c);
    expect(busy.status).toBe('invalid');
    const free = resolveTargetQuery(query({ space: 'summon_slot', groundKey: 'slot_2' }), c);
    expect(free.status).toBe('selected');
    if (free.status === 'selected') expect(free.target.kind).toBe('summon_slot');
  });
});

describe('P19-T02 target query — filters and invalid reasons', () => {
  it('filters by alive vs defeated', () => {
    const dead = enemy('enemy_dead', { x100: 1200, lp: 0, phase: Object.freeze({ phase: 'DEFEATED', enteredTick: tick(0), controlledReturn: null }) });
    const live = enemy('enemy_live', { x100: 4000 });
    const outcome = resolveTargetQuery(query({ filters: [{ type: 'alive' }] }), ctx({ entities: [dead, live] }));
    expect(outcome.status).toBe('selected');
    if (outcome.status === 'selected') expect(outcome.target.entityId).toBe('enemy_live');
  });

  it('reports defeated when no candidate is alive', () => {
    const dead = enemy('enemy_dead', { lp: 0, phase: Object.freeze({ phase: 'DEFEATED', enteredTick: tick(0), controlledReturn: null }) });
    const outcome = resolveTargetQuery(query(), ctx({ entities: [dead] }));
    expect(outcome.status).toBe('invalid');
    if (outcome.status === 'invalid') expect(outcome.reason).toBe('defeated');
  });

  it('reports empty when the space has no entity', () => {
    const outcome = resolveTargetQuery(query(), ctx({ entities: [] }));
    expect(outcome.status).toBe('invalid');
    if (outcome.status === 'invalid') expect(outcome.reason).toBe('empty');
  });

  it('reports out_of_range when a range filter excludes everyone', () => {
    const far = enemy('enemy_far', { x100: 9000 });
    const outcome = resolveTargetQuery(query({ filters: [{ type: 'range', rangeX100: 100 }] }), ctx({ entities: [far] }));
    expect(outcome.status).toBe('invalid');
    if (outcome.status === 'invalid') expect(outcome.reason).toBe('out_of_range');
  });

  it('reports untargetable when all alive candidates are untargetable', () => {
    const e = enemy('enemy_stealth', { x100: 1200 });
    const outcome = resolveTargetQuery(query(), ctx({ entities: [e], untargetableIds: new Set(['enemy_stealth']) }));
    expect(outcome.status).toBe('invalid');
    if (outcome.status === 'invalid') expect(outcome.reason).toBe('untargetable');
  });

  it('reports disclosure_forbidden in preview context', () => {
    const e = enemy('enemy_e', { x100: 1200 });
    const outcome = resolveTargetQuery(query(), ctx({ entities: [e], disclosureForbidden: true }));
    expect(outcome.status).toBe('invalid');
    if (outcome.status === 'invalid') expect(outcome.reason).toBe('disclosure_forbidden');
  });

  it('reports ground_invalid for out-of-field ground coordinates', () => {
    const outcome = resolveTargetQuery(query({ space: 'ground_point', groundKey: 'ground_bad', groundLane: 'top', groundX100: 20000 }), ctx());
    expect(outcome.status).toBe('invalid');
    if (outcome.status === 'invalid') expect(outcome.reason).toBe('ground_invalid');
  });

  it('filters by origin and lane', () => {
    const construct = enemy('enemy_construct', { x100: 1200, origin: 'construct', lane: 'bottom' });
    const regular = enemy('enemy_regular', { x100: 1300, lane: 'middle' });
    const outcome = resolveTargetQuery(
      query({ filters: [{ type: 'origin', origin: 'construct' }, { type: 'lane', lane: 'bottom' }] }),
      ctx({ entities: [construct, regular] }),
    );
    expect(outcome.status).toBe('selected');
    if (outcome.status === 'selected') expect(outcome.target.entityId).toBe('enemy_construct');
  });
});

describe('P19-T02 target query — profiles and deterministic ties', () => {
  const base = (): [KernelEntity, KernelEntity, KernelEntity] => [
    enemy('enemy_b', { x100: 2000, lp: 400, lane: 'top' }),
    enemy('enemy_a', { x100: 2000, lp: 300, lane: 'middle' }),
    enemy('enemy_c', { x100: 1800, lp: 900, lane: 'bottom' }),
  ];

  it('lowest_effective_lp picks the lowest current LP', () => {
    const outcome = resolveTargetQuery(query({ profile: 'lowest_effective_lp' }), ctx({ entities: base() }));
    expect(outcome.status).toBe('selected');
    if (outcome.status === 'selected') expect(outcome.target.entityId).toBe('enemy_a');
  });

  it('highest_threat picks the maximum threat', () => {
    const threat = new Map<string, number>([['enemy_b', 50], ['enemy_a', 10], ['enemy_c', 90]]);
    const outcome = resolveTargetQuery(query({ profile: 'highest_threat' }), ctx({ entities: base(), threat }));
    expect(outcome.status).toBe('selected');
    if (outcome.status === 'selected') expect(outcome.target.entityId).toBe('enemy_c');
  });

  it('nearest picks minimum distance', () => {
    const outcome = resolveTargetQuery(query({ profile: 'nearest' }), ctx({ entities: base() }));
    expect(outcome.status).toBe('selected');
    if (outcome.status === 'selected') expect(outcome.target.entityId).toBe('enemy_c');
  });

  it('fixed content targets take precedence over generic selection', () => {
    const outcome = resolveTargetQuery(query({ fixedTargetIds: ['enemy_b'] }), ctx({ entities: base() }));
    expect(outcome.status).toBe('selected');
    if (outcome.status === 'selected') expect(outcome.target.entityId).toBe('enemy_b');
  });

  it('is permutation-stable: entity input order never changes selection', () => {
    const [e0, e1, e2] = base();
    const selectedIds = new Set<string>();
    for (const ordered of [
      [e0, e1, e2],
      [e2, e1, e0],
      [e1, e0, e2],
    ] as const) {
      const outcome = resolveTargetQuery(query({ profile: 'lowest_effective_lp' }), ctx({ entities: ordered }));
      if (outcome.status === 'selected') selectedIds.add(outcome.target.entityId ?? '');
    }
    expect(selectedIds).toEqual(new Set(['enemy_a']));
  });

  it('tie-breaks identical score/distance/lane by entityId code-unit order', () => {
    const a = enemy('enemy_alpha', { x100: 2000, lp: 500 });
    const b = enemy('enemy_beta', { x100: 2000, lp: 500 });
    const outcome = resolveTargetQuery(query({ profile: 'lowest_effective_lp' }), ctx({ entities: [b, a] }));
    expect(outcome.status).toBe('selected');
    if (outcome.status === 'selected') expect(outcome.target.entityId).toBe('enemy_alpha');
  });
});

describe('P19-T02 target query — validation faults', () => {
  it.each([
    [{ space: 'nope', profile: 'nearest' }],
    [{ space: 'enemy_entity', profile: 'nope' }],
    [{ space: 'enemy_entity', profile: 'nearest', filters: [{ type: 'nope' }] }],
    [{ space: 'enemy_entity', profile: 'nearest', filters: [{ type: 'range', rangeX100: -1 }] }],
    [{ space: 'enemy_entity', profile: 'nearest', filters: [{ type: 'lane', lane: 'sideways' }] }],
    [{ space: 'enemy_entity', profile: 'nearest', fixedTargetIds: ['BadId'] }],
    [{ space: 'ground_point', profile: 'nearest', groundKey: 'ground_x' }],
    [{ space: 'ground_point', profile: 'nearest', groundKey: 'ground_x', groundLane: 'top', groundX100: 1.5 }],
  ] as unknown as TargetQuery[])('rejects malformed query %#', (bad) => {
    expect(() => {
      validateTargetQuery(bad);
    }).toThrow(KernelInvariantError);
  });
});
