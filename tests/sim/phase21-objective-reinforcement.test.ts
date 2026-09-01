import { describe, expect, it } from 'vitest';
import {
  applyEventProgress,
  applyProgress,
  evaluateComposite,
  evaluateSurvival,
  isObjectiveImpossible,
  objectiveAllowsBattleEnd,
  validateObjective,
  type Objective,
} from '../../src/game/sim/objectives/combat-objective.js';
import { dueWaves, validateWave, type Wave } from '../../src/game/sim/world/reinforcement-system.js';
import type { KernelEvent } from '../../src/game/sim/events/event-types.js';
import { tick, sequence } from '../../src/game/sim/core/primitives.js';

const objective = (extra: Partial<Objective> = {}): Objective => Object.freeze({
  id: 'obj_alpha',
  kind: 'kill_regulars',
  targetId: null,
  required: 3,
  progress: 0,
  complete: false,
  ...extra,
});

function defeatEvent(targetId: string): KernelEvent {
  return Object.freeze({
    type: 'Defeated',
    sourceId: 'unit_p',
    targetIds: Object.freeze([targetId]),
    contentIds: Object.freeze([]),
    payload: Object.freeze({ overkill: 0 }),
    logTags: Object.freeze(['sim.fixture']),
    tick: tick(0),
    sequence: sequence(0),
  });
}

describe('Phase 21 T05: objectives', () => {
  it('validates a well-formed objective', () => {
    expect(() => { validateObjective(objective()); }).not.toThrow();
  });

  it('rejects an unknown objective kind', () => {
    expect(() => { validateObjective(objective({ kind: 'capture_flag' } as never)); }).toThrow(/P21_OBJECTIVE_INVALID/);
  });

  it('rejects progress over required', () => {
    expect(() => { validateObjective(objective({ progress: 4 })); }).toThrow(/P21_OBJECTIVE_INVALID/);
  });

  it('applies progress monotonically with an exact cap', () => {
    const o = objective({ required: 2, progress: 1 });
    const result = applyProgress(o, 9);
    expect(result.progress).toBe(2);
    expect(result.complete).toBe(true);
    expect(applyProgress(result, 1)).toBe(result);
  });

  it('is monotonic across 10000 random vectors', () => {
    for (let i = 0; i < 10000; i++) {
      const req = (i % 97) + 1;
      const p = i % req;
      const d = i % 19;
      const o = objective({ required: req, progress: p, complete: p >= req });
      const n = applyProgress(o, d);
      expect(n.progress).toBeGreaterThanOrEqual(p);
      expect(n.progress).toBeLessThanOrEqual(req);
    }
  });

  it('derives kill_regulars progress from Defeated events only', () => {
    const o = objective({ kind: 'kill_regulars', required: 2 });
    const once = applyEventProgress(o, defeatEvent('unit_q'));
    expect(once.progress).toBe(1);
    const twice = applyEventProgress(once, defeatEvent('unit_r'));
    expect(twice.complete).toBe(true);
  });

  it('derives destroy_object progress only from its own target', () => {
    const o = objective({ kind: 'destroy_object', targetId: 'obj_1', required: 1 });
    expect(applyEventProgress(o, defeatEvent('obj_2')).progress).toBe(0);
    expect(applyEventProgress(o, defeatEvent('obj_1')).complete).toBe(true);
  });

  it('evaluates survive_until from the tick', () => {
    const o = objective({ kind: 'survive_until', required: 100, progress: 0 });
    const atTick50 = evaluateSurvival(o, 50);
    expect(atTick50.progress).toBe(50);
    expect(atTick50.complete).toBe(false);
    expect(evaluateSurvival(o, 100).complete).toBe(true);
  });

  it('blocks battle end until every objective is complete', () => {
    const done = objective({ complete: true });
    const pending = objective({ id: 'obj_b', complete: false });
    expect(objectiveAllowsBattleEnd([done])).toBe(true);
    expect(objectiveAllowsBattleEnd([done, pending])).toBe(false);
  });

  it('detects an impossible protect_object (target already defeated)', () => {
    const o = objective({ kind: 'protect_object', targetId: 'obj_1' });
    expect(isObjectiveImpossible(o, { defeatedTargetIds: new Set(['obj_1']), activeWavesRemaining: 0 })).toBe(true);
    expect(isObjectiveImpossible(o, { defeatedTargetIds: new Set(['obj_2']), activeWavesRemaining: 0 })).toBe(false);
  });

  it('detects an impossible complete_waves with no waves remaining', () => {
    const o = objective({ kind: 'complete_waves', required: 3, progress: 1 });
    expect(isObjectiveImpossible(o, { defeatedTargetIds: new Set(), activeWavesRemaining: 0 })).toBe(true);
    expect(isObjectiveImpossible(o, { defeatedTargetIds: new Set(), activeWavesRemaining: 2 })).toBe(false);
  });

  it('evaluates composite all/any conditions', () => {
    const a = objective({ id: 'a', complete: true });
    const b = objective({ id: 'b', complete: false });
    expect(evaluateComposite(Object.freeze({ id: 'c', mode: 'all', objectiveIds: Object.freeze(['a', 'b']) }), [a, b])).toBe(false);
    expect(evaluateComposite(Object.freeze({ id: 'c', mode: 'any', objectiveIds: Object.freeze(['a', 'b']) }), [a, b])).toBe(true);
    expect(() => evaluateComposite(Object.freeze({ id: 'c', mode: 'all', objectiveIds: Object.freeze(['missing']) }), [a])).toThrow(/P21_OBJECTIVE_INVALID/);
  });
});

const wave = (extra: Partial<Wave> = {}): Wave => Object.freeze({
  id: 'wave_a',
  scheduledTick: 10,
  side: 'enemy',
  entityIds: Object.freeze(['unit_e1', 'unit_e2']),
  spawnProfile: 'profile_grunt',
  capPolicy: 'BLOCK',
  ...extra,
});

describe('Phase 21 T05: reinforcements', () => {
  it('validates a well-formed wave', () => {
    expect(() => { validateWave(wave()); }).not.toThrow();
  });

  it('rejects an empty spawn order', () => {
    expect(() => { validateWave(wave({ entityIds: Object.freeze([]) })); }).toThrow(/P21_WAVE_INVALID/);
  });

  it('rejects a duplicate spawn order', () => {
    expect(() => { validateWave(wave({ entityIds: Object.freeze(['unit_e1', 'unit_e1']) })); }).toThrow(/P21_WAVE_INVALID/);
  });

  it('rejects an unknown cap policy', () => {
    expect(() => { validateWave(wave({ capPolicy: 'SPILL' } as never)); }).toThrow(/P21_WAVE_INVALID/);
  });

  it('returns due waves ordered by (scheduledTick, id) and skips spawned', () => {
    const a = wave({ id: 'wave_a', scheduledTick: 3 });
    const b = wave({ id: 'wave_b', scheduledTick: 3 });
    const c = wave({ id: 'wave_c', scheduledTick: 5 });
    const due = dueWaves([c, a, b], 3, new Set());
    expect(due.map((w) => w.id)).toEqual(['wave_a', 'wave_b']);
    const afterSpawn = dueWaves([c, a, b], 5, new Set(['wave_a', 'wave_b']));
    expect(afterSpawn.map((w) => w.id)).toEqual(['wave_c']);
  });
});
