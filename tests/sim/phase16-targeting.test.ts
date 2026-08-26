import { describe, expect, it } from 'vitest';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { buildCandidates, originOf } from '../../src/game/sim/targeting/candidates.js';
import { chooseTarget, compareBreakdown, scoreCandidate } from '../../src/game/sim/targeting/target-score.js';
import { earliestRetargetTick, mayReevaluate } from '../../src/game/sim/targeting/target-lock.js';
import { healerEligible, roleNeedsPreferredRange } from '../../src/game/sim/targeting/roles.js';
import { queryValidCandidates } from '../../src/game/sim/targeting/target-query.js';
import type { Candidate, QueryContext, TargetLock } from '../../src/game/sim/targeting/types.js';
import { entity, tick } from './test-helpers.js';

function baseCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return Object.freeze({
    id: 'enemy_a',
    lane: 'middle',
    distance: 100,
    hp: 1000,
    maxHp: 1000,
    alive: true,
    removed: false,
    reachable: true,
    regular: true,
    summoned: false,
    shielded: false,
    construct: false,
    bossObject: false,
    backline: false,
    buffed: false,
    threatensSource: false,
    covered: false,
    ...overrides,
  });
}

function query(overrides: Partial<QueryContext> = {}): QueryContext {
  return {
    sourceId: 'unit_p',
    sourceLane: 'middle',
    role: 'fighter',
    ownLaneHasTarget: false,
    laneChangeRequired: () => false,
    ...overrides,
  };
}

describe('Phase 16 target score', () => {
  it('bases the score on proximity: closer candidates score higher', () => {
    const near = scoreCandidate(baseCandidate({ id: 'a', distance: 10 }), query());
    const far = scoreCandidate(baseCandidate({ id: 'b', distance: 200 }), query());
    expect(near.total).toBeGreaterThan(far.total);
    expect(near.base).toBe(80);
    expect(far.base).toBe(-300);
  });

  it('applies the same-lane pressure modifier and the adjacent-without-own-target fallback', () => {
    const same = scoreCandidate(baseCandidate({ id: 'a', lane: 'middle' }), query({ sourceLane: 'middle' }));
    expect(same.modifiers.some((m) => m.modifierId === 'same_lane' && m.value === 45)).toBe(true);
    const adjacent = scoreCandidate(baseCandidate({ id: 'b', lane: 'top' }), query({ sourceLane: 'middle', ownLaneHasTarget: false }));
    expect(adjacent.modifiers.some((m) => m.modifierId === 'adjacent_no_own_target' && m.value === 15)).toBe(true);
    // Once the own lane holds a target the adjacent bonus disappears.
    const withOwn = scoreCandidate(baseCandidate({ id: 'c', lane: 'bottom' }), query({ sourceLane: 'middle', ownLaneHasTarget: true }));
    expect(withOwn.modifiers.some((m) => m.modifierId === 'adjacent_no_own_target')).toBe(false);
  });

  it('applies the role hunt profiles (breaker, duelist, hunter, banisher)', () => {
    const breaker = scoreCandidate(baseCandidate({ id: 'a', shielded: true }), query({ role: 'breaker' }));
    expect(breaker.modifiers.some((m) => m.modifierId === 'breaker_shield_construct' && m.value === 30)).toBe(true);
    const duelist = scoreCandidate(baseCandidate({ id: 'b', hp: 200, maxHp: 1000 }), query({ role: 'duelist' }));
    expect(duelist.modifiers.some((m) => m.modifierId === 'duelist_low_hp' && m.value === 10)).toBe(true);
    const hunter = scoreCandidate(baseCandidate({ id: 'c', backline: true }), query({ role: 'duelist' }));
    expect(hunter.modifiers.some((m) => m.modifierId === 'hunter_backline' && m.value === 28)).toBe(true);
    const banisher = scoreCandidate(baseCandidate({ id: 'd', buffed: true }), query({ role: 'support' }));
    expect(banisher.modifiers.some((m) => m.modifierId === 'banisher_buffed' && m.value === 30)).toBe(true);
  });

  it('de-prioritizes summons unless anti-summoner, and applies cover against marksmen', () => {
    const summon = scoreCandidate(baseCandidate({ id: 'a', summoned: true }), query());
    expect(summon.modifiers.some((m) => m.modifierId === 'summoned_default' && m.value === -8)).toBe(true);
    const anti = scoreCandidate(baseCandidate({ id: 'b', summoned: true }), query({ antiSummoner: true }));
    expect(anti.modifiers.some((m) => m.modifierId === 'summoned_default')).toBe(false);
    const covered = scoreCandidate(baseCandidate({ id: 'c', covered: true }), query({ role: 'marksman' }));
    expect(covered.modifiers.some((m) => m.modifierId === 'cover' && m.value === -22)).toBe(true);
  });

  it('keeps the current target bound and penalizes lane changes', () => {
    const bound = scoreCandidate(baseCandidate({ id: 'a' }), query({ currentTargetId: 'a' }));
    expect(bound.modifiers.some((m) => m.modifierId === 'current_target_binding' && m.value === 18)).toBe(true);
    // A candidate on a neighboring lane is a required lane change; the source
    // query must not be in the same lane as that candidate for the penalty.
    const crossing = scoreCandidate(baseCandidate({ id: 'b', lane: 'top' }), query({ sourceLane: 'middle', laneChangeRequired: (c) => c.lane !== 'middle' }));
    expect(crossing.modifiers.some((m) => m.modifierId === 'lane_change_required' && m.value === -18)).toBe(true);
  });

  it('keeps the current target until a better candidate beats it by 20 (hysteresis)', () => {
    const current = scoreCandidate(baseCandidate({ id: 'cur', distance: 1 }), query());
    const threshold = current.total + 20;
    const challenger = (total: number) => ({ candidateId: 'cha', base: total, modifiers: [], total, distance: 1, hp: 10 });
    expect(chooseTarget([challenger(threshold - 1), current], current)?.candidateId).toBe('cur');
    expect(chooseTarget([challenger(threshold), current], current)?.candidateId).toBe('cha');
    expect(chooseTarget([challenger(threshold)], undefined)?.candidateId).toBe('cha');
  });

  it('breaks score ties by distance, then hp, then candidate id', () => {
    const a = { candidateId: 'a', base: 10, modifiers: [], total: 10, distance: 2, hp: 5 };
    const b = { candidateId: 'b', base: 10, modifiers: [], total: 10, distance: 2, hp: 5 };
    const c = { candidateId: 'c', base: 10, modifiers: [], total: 10, distance: 1, hp: 8 };
    const sorted = [a, b, c].sort(compareBreakdown);
    expect(sorted.map((v) => v.candidateId)).toEqual(['c', 'a', 'b']);
  });
});

describe('Phase 16 lock policy', () => {
  it('never re-evaluates a fixed lock', () => {
    const lock: TargetLock = { kind: 'fixed', targetId: 'x', acquiredTick: 0 };
    expect(mayReevaluate(lock, 'target_invalid', false)).toBe(false);
    expect(mayReevaluate(lock, 'lanechange_completed', false)).toBe(false);
  });

  it('suppresses re-evaluation while a lane change is in flight, except its own completion', () => {
    const lock: TargetLock = { kind: 'basic_until_hit_or_abort', acquiredTick: 0 };
    expect(mayReevaluate(lock, 'target_invalid', true)).toBe(false);
    expect(mayReevaluate(lock, 'lanechange_completed', true)).toBe(true);
  });

  it('only re-evaluates signature locks on an invalid target', () => {
    const lock: TargetLock = { kind: 'signature_until_cast_end', acquiredTick: 0 };
    expect(mayReevaluate(lock, 'state_entry', false)).toBe(false);
    expect(mayReevaluate(lock, 'target_invalid', false)).toBe(true);
  });

  it('holds a basic attack for one tick before it may retarget', () => {
    expect(earliestRetargetTick(41, true)).toBe(42);
    expect(earliestRetargetTick(41, false)).toBe(41);
  });
});

describe('Phase 16 roles and healer eligibility', () => {
  it('marks ranged roles as preferred-range roles', () => {
    for (const role of ['marksman', 'mage', 'controller', 'healer', 'support'] as const) {
      expect(roleNeedsPreferredRange(role)).toBe(true);
    }
    expect(roleNeedsPreferredRange('fighter')).toBe(false);
  });

  it('treats the 12% healer threshold as inclusive', () => {
    expect(healerEligible(88, 100)).toBe(true);
    expect(healerEligible(89, 100)).toBe(false);
  });
});

describe('Phase 16 candidate builder', () => {
  const source = migrateEntity({ entity: entity('unit_p', { x100: 1800 }), radiusX100: 100 });

  function candidateEntity(id: string, overrides: Partial<Parameters<typeof entity>[1]> = {}) {
    return migrateEntity({
      entity: entity(id, { side: 'enemy', x100: 2600, ...overrides }),
      radiusX100: 100,
    });
  }

  it('marks only lane-local enemies reachable (no direct top-to-bottom jump)', () => {
    const candidates = buildCandidates(source, [
      candidateEntity('mid', { lane: 'middle' }),
      candidateEntity('top', { lane: 'top' }),
      candidateEntity('bottom', { lane: 'bottom' }),
    ]);
    const byId = new Map(candidates.map((c) => [c.id, c]));
    expect(byId.get('mid')?.reachable).toBe(true);
    expect(byId.get('top')?.reachable).toBe(true);
    expect(byId.get('bottom')?.reachable).toBe(true);
    // A source on the top lane cannot reach bottom in one change.
    const topSource = migrateEntity({ entity: entity('unit_t', { x100: 1800, lane: 'top' }), radiusX100: 100 });
    const fromTop = buildCandidates(topSource, [candidateEntity('bottom', { lane: 'bottom' })]);
    expect(fromTop[0]?.reachable).toBe(false);
  });

  it('reports edge distance and excludes defeated/removed enemies from the valid query', () => {
    const candidates = buildCandidates(source, [
      candidateEntity('far', { x100: 3000 }),
      candidateEntity('dead', { phase: Object.freeze({ phase: 'DEFEATED', enteredTick: tick(0), controlledReturn: null }) }),
    ]);
    const byId = new Map(candidates.map((c) => [c.id, c]));
    // 3000 − 1800 − 100 − 100 = 1000 edge distance.
    expect(byId.get('far')?.distance).toBe(1000);
    expect(byId.get('dead')?.alive).toBe(false);
    expect(queryValidCandidates(candidates).map((c) => c.id)).toEqual(['far']);
  });

  it('defaults origin to regular and reads summoned/construct from the snapshot', () => {
    expect(originOf(entity('plain'))).toBe('regular');
    expect(originOf(entity('sum', { origin: 'summoned' as const }))).toBe('summoned');
    expect(originOf(entity('con', { origin: 'construct' as const }))).toBe('construct');
    const candidates = buildCandidates(source, [
      entity('regular', { side: 'enemy', x100: 2600 }),
      entity('summoned', { side: 'enemy', x100: 2600, origin: 'summoned' as const }),
      entity('construct', { side: 'enemy', x100: 2600, origin: 'construct' as const }),
    ]);
    const byId = new Map(candidates.map((c) => [c.id, c]));
    expect(byId.get('regular')?.regular).toBe(true);
    expect(byId.get('summoned')?.summoned).toBe(true);
    expect(byId.get('construct')?.construct).toBe(true);
  });
});
