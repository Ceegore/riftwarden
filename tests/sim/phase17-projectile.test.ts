import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { asX100 } from '../../src/game/sim/geometry/x100.js';
import { forecastTravelTicks, sampleImpactTargets, spawnProjectile, stepProjectile, validateProjectileState } from '../../src/game/sim/projectile/projectile-state.js';
import type { ProjectileParameters, ProjectileState } from '../../src/game/sim/projectile/projectile-state.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { KernelEvent } from '../../src/game/sim/events/event-types.js';
import { battle, entity, randomSession } from './test-helpers.js';
import type { KernelEntity } from '../../src/game/sim/core/entity.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

function unit(id: string, overrides: Parameters<typeof entity>[1] = {}, radius = 100) {
  return migrateEntity({ entity: entity(id, overrides), radiusX100: radius });
}

const PARAMS: ProjectileParameters = {
  speedX100PerSecond: 3000, // 100 X100 per tick at 30 TPS
  homing: false,
  maxTurnX100PerTick: 0,
  expiryTicks: 60,
  lostTargetPolicy: 'impact_stored_position',
  coverIgnoring: false,
  piercing: false,
  rawAmount: 100,
  damageTypeOrdinal: 0,
  defense: 0,
  bossCapBps: null,
};

function makeProjectile(overrides: Partial<ProjectileState> = {}): ProjectileState {
  const source = unit('unit_p', { x100: 1800 });
  const target = unit('unit_e', { side: 'enemy', x100: 6200 });
  const base = spawnProjectile({
    id: 'proj_1',
    attackInstanceId: 1,
    effectIndex: 0,
    sourceId: 'unit_p',
    targetId: 'unit_e',
    spawnTick: 0,
    source,
    target,
    params: PARAMS,
  });
  return Object.freeze({ ...base, ...overrides });
}

describe('P17 T02 §6 projectile state machine', () => {
  it('spawns with stored aim position and validates', () => {
    const p = makeProjectile();
    expect(p.storedTargetX100).toBe(6200);
    expect(p.x100).toBe(1800);
    expect(p.resolved).toBe(false);
    expect(() => { validateProjectileState(p); }).not.toThrow();
  });

  it('advances exactly once per tick toward the stored position', () => {
    let p = makeProjectile();
    p = stepProjectile(p, unit('unit_e', { side: 'enemy', x100: 6200 }), 1).state;
    expect(p.x100).toBe(1900);
    p = stepProjectile(p, unit('unit_e', { side: 'enemy', x100: 6200 }), 2).state;
    expect(p.x100).toBe(2000);
  });

  it('resolves on arrival at the stored position with a single impact sample', () => {
    // Distance 4400 at 100/tick → arrives at tick 44.
    let p = makeProjectile();
    const target = unit('unit_e', { side: 'enemy', x100: 6200 });
    for (let t = 1; t < 44; t++) p = stepProjectile(p, target, t).state;
    const step = stepProjectile(p, target, 44);
    expect(step.state.resolved).toBe(true);
    expect(step.impactAt).toBe(6200);
    expect(step.state.x100).toBe(6200);
  });

  it('forecast travel ticks matches the arrival tick', () => {
    const p = makeProjectile();
    expect(forecastTravelTicks(p)).toBe(44);
  });

  it('lost-target expire policy resolves immediately with no impact', () => {
    const p = makeProjectile({ lostTargetPolicy: 'expire' });
    const step = stepProjectile(p, undefined, 10);
    expect(step.state.resolved).toBe(true);
    expect(step.impactAt).toBeNull();
  });

  it('lost-target impact_stored_position flies to the stored aim', () => {
    let p = makeProjectile({ lostTargetPolicy: 'impact_stored_position' });
    for (let t = 1; t < 44; t++) p = stepProjectile(p, undefined, t).state;
    const step = stepProjectile(p, undefined, 44);
    expect(step.state.resolved).toBe(true);
    expect(step.impactAt).toBe(6200);
  });

  it('expires at the expiry tick without impact when not arrived', () => {
    // continue_straight honors expiry (impact_stored_position deliberately
    // flies to the stored aim even past expiry).
    const p = makeProjectile({ expiryTick: 10, lostTargetPolicy: 'continue_straight' });
    // Distance 4400 at 100/tick → not arrived by tick 10.
    const step = stepProjectile(p, unit('unit_e', { side: 'enemy', x100: 6200 }), 10);
    expect(step.state.resolved).toBe(true);
    expect(step.impactAt).toBeNull();
  });

  it('homing re-aims at the live target and resolves on reach', () => {
    const p = makeProjectile({ homing: true, maxTurnX100PerTick: 500, speedX100PerSecond: 6000 });
    const target = unit('unit_e', { side: 'enemy', x100: 2600 });
    // Aim at 2600, move 200/tick with turn cap → 2000 at t=1, 2200 at t=2...
    const t1 = stepProjectile(p, target, 1);
    expect(t1.state.x100).toBe(2000);
    const t2 = stepProjectile(t1.state, target, 2);
    expect(t2.state.x100).toBe(2200);
    const t3 = stepProjectile(t2.state, target, 3);
    expect(t3.state.x100).toBe(2400);
    const t4 = stepProjectile(t3.state, target, 4);
    expect(t4.state.resolved).toBe(true);
    expect(t4.impactAt).toBe(2600);
  });
});

describe('P17 T02 §7 impact sampling', () => {
  it('hits targets whose collision circle touches the impact point in the lane', () => {
    const entities = [
      unit('unit_a', { side: 'enemy', lane: 'middle', x100: 6100 }),
      unit('unit_b', { side: 'enemy', lane: 'middle', x100: 5900 }),
      unit('unit_other_lane', { side: 'enemy', lane: 'top', x100: 6100 }),
    ];
    // Impact at 6200: unit_a (edge 6200-100-6100=0) touches; unit_b (200 away) not.
    const hits = sampleImpactTargets(asX100(6200), 'middle', entities, 'player');
    expect(hits.map((e) => e.id)).toEqual(['unit_a']);
  });

  it('excludes dead targets and own-side entities, sorts stably by id', () => {
    const entities = [
      unit('unit_b', { side: 'enemy', lane: 'middle', x100: 6100 }),
      unit('unit_a', { side: 'enemy', lane: 'middle', x100: 6200 }),
      Object.freeze({ ...unit('unit_dead', { side: 'enemy', lane: 'middle', x100: 6150 }), phase: Object.freeze({ phase: 'DEFEATED' as const, enteredTick: 0, controlledReturn: null }) }) as KernelEntity,
      unit('unit_own', { side: 'player', lane: 'middle', x100: 6100 }),
    ];
    const hits = sampleImpactTargets(asX100(6200), 'middle', entities, 'player');
    expect(hits.map((e) => e.id)).toEqual(['unit_a', 'unit_b']);
  });
});

describe('P17 T02 integration through the kernel', () => {
  function run(state: BattleModel, ticks: number, config: Parameters<typeof createPhase17Systems>[0]): { state: BattleModel; events: KernelEvent[] } {
    let current = state;
    const events: KernelEvent[] = [];
    const random = randomSession();
    const systems = createPhase17Systems(config);
    for (let i = 0; i < ticks; i++) {
      const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
      current = r.state;
      events.push(...r.events);
    }
    return { state: current, events };
  }

  function battleWith(entities: ReturnType<typeof unit>[]) {
    return battle({ simulationVersion: 'phase15-fixture-v1', entities });
  }

  it('spawns a projectile at commit, travels and queues damage on impact', () => {
    const entities = [unit('unit_p', { x100: 1800 }), unit('unit_e', { side: 'enemy', x100: 6200 })];
    const state = battleWith(entities);
    const { events } = run(state, 48, {
      speedsX100PerSecond: {},
      basicAttack: {
        parameters: {
          unit_p: {
            attackIntervalTicks: 60,
            prepareTicks: 1,
            recoveryTicks: 4,
            preferredRangeX100: asX100(5000),
            delivery: { kind: 'projectile', ...PARAMS, coverIgnoring: true },
          },
        },
      },
    });
    expect(events.filter((e) => e.type === 'ProjectileSpawned')).toHaveLength(1);
    // Commit at tick 1; travel 44 → impact tick 45; DamageApplied shortly after.
    expect(events.filter((e) => e.type === 'DamageApplied')).toHaveLength(1);
    const damage = events.find((e) => e.type === 'DamageApplied');
    expect(damage?.payload['rawAmount']).toBe(100);
    expect(damage?.payload['finalHpDelta']).toBe(100);
  });

  it('projectile cover reduction applies (12%) unless piercing/coverIgnoring', () => {
    const entities = [unit('unit_p', { x100: 1800 }), unit('unit_e', { side: 'enemy', x100: 6200 })];
    const state = battleWith(entities);
    const covered = run(state, 48, {
      speedsX100PerSecond: {},
      basicAttack: { parameters: { unit_p: { attackIntervalTicks: 60, prepareTicks: 1, recoveryTicks: 4, preferredRangeX100: asX100(5000), delivery: { kind: 'projectile', ...PARAMS, coverIgnoring: false } } } },
    });
    const dmg = covered.events.find((e) => e.type === 'DamageApplied');
    expect(dmg?.payload['finalHpDelta']).toBe(88); // 100 * 0.88
    const piercing = run(state, 48, {
      speedsX100PerSecond: {},
      basicAttack: { parameters: { unit_p: { attackIntervalTicks: 60, prepareTicks: 1, recoveryTicks: 4, preferredRangeX100: asX100(5000), delivery: { kind: 'projectile', ...PARAMS, piercing: true } } } },
    });
    const dmg2 = piercing.events.find((e) => e.type === 'DamageApplied');
    expect(dmg2?.payload['finalHpDelta']).toBe(100);
  });

  it('a direct hit queues an immediate damage application (§5.3)', () => {
    const entities = [unit('unit_p', { x100: 1800 }), unit('unit_e', { side: 'enemy', x100: 1900 })];
    const state = battleWith(entities);
    const { events } = run(state, 5, {
      speedsX100PerSecond: {},
      basicAttack: { parameters: { unit_p: { attackIntervalTicks: 60, prepareTicks: 1, recoveryTicks: 4, preferredRangeX100: asX100(500), delivery: { kind: 'direct', rawAmount: 100, damageTypeOrdinal: 0, defense: 0 } } } },
    });
    const dmg = events.find((e) => e.type === 'DamageApplied');
    expect(dmg).toBeDefined();
    expect(dmg?.payload['finalHpDelta']).toBe(100);
  });
});
