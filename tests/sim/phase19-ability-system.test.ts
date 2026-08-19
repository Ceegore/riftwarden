import { describe, expect, it } from 'vitest';
import { KernelInvariantError } from '../../src/game/sim/core/invariant-error.js';
import {
  advanceAbilityTick,
  applyBossPhaseChange,
  applySilence,
  createAbilityInstance,
  interruptAbility,
  tryCast,
  validateAbilityConfig,
  type AbilityConfig,
  type AbilityInstance,
} from '../../src/game/sim/ability/ability-system.js';
import type { TargetSnapshot } from '../../src/game/sim/ability/ability-target-query.js';
import type { SourceSnapshot } from '../../src/game/sim/ability/effect-command.js';

const config = (overrides: Partial<AbilityConfig> = {}): AbilityConfig => ({
  abilityId: 'ability_fireball',
  chargeTicks: 10,
  cooldownTicks: 5,
  castTicks: 3,
  recoveryTicks: 2,
  interruptPolicy: 'interruptible',
  usesPerBattle: 2,
  invalidTargetPolicy: 'wait',
  bossPhaseCancelAllowed: false,
  ...overrides,
});

const target: TargetSnapshot = Object.freeze({ kind: 'entity', entityId: 'enemy_1', groundKey: null, slotId: null, lane: 'middle', x100: 2000, acquiredTick: 5 });
const source: SourceSnapshot = Object.freeze({ sourceId: 'source', sourceLane: 'middle', sourceX100: 1000, sourceLp: 800, sourceMaxLp: 1000 });

function charged(): AbilityInstance {
  const inst = createAbilityInstance(config(), 'instance_1', 'source');
  let current = inst;
  for (let t = 0; t < 10; t += 1) current = advanceAbilityTick(current, config(), t).instance;
  expect(current.state).toBe('ready');
  return current;
}

describe('P19-T04 ability lifecycle — charge and ready', () => {
  it('starts charging when a charge duration exists', () => {
    expect(createAbilityInstance(config(), 'instance_1', 'source').state).toBe('charging');
  });

  it('starts ready when chargeTicks is null or zero', () => {
    expect(createAbilityInstance(config({ chargeTicks: null }), 'instance_1', 'source').state).toBe('ready');
    expect(createAbilityInstance(config({ chargeTicks: 0 }), 'instance_1', 'source').state).toBe('ready');
  });

  it('charges to ready exactly at the full charge tick', () => {
    const inst = createAbilityInstance(config(), 'instance_1', 'source');
    let current = inst;
    for (let t = 0; t < 9; t += 1) current = advanceAbilityTick(current, config(), t).instance;
    expect(current.state).toBe('charging');
    const done = advanceAbilityTick(current, config(), 9);
    expect(done.instance.state).toBe('ready');
    expect(done.events).toContain('ready');
  });

  it('caps charge at the full charge value', () => {
    const inst = createAbilityInstance(config(), 'instance_1', 'source');
    const done = advanceAbilityTick(advanceAbilityTick(inst, config(), 0).instance, config(), 1);
    expect(done.instance.chargeTicks).toBe(2);
  });
});

describe('P19-T04 ability lifecycle — cast, commit, recovery, cooldown', () => {
  it('casts from ready and commits at castStart + castTicks', () => {
    const started = tryCast(charged(), config(), 20, target, source);
    expect(started.instance.state).toBe('casting_precommit');
    expect(started.instance.commitTick).toBe(23);
    expect(started.events).toContain('cast_started');

    let current = started.instance;
    for (let t = 20; t < 23; t += 1) current = advanceAbilityTick(current, config(), t).instance;
    const committed = advanceAbilityTick(current, config(), 23);
    expect(committed.instance.state).toBe('cast_committed');
    expect(committed.events).toContain('committed');
    expect(committed.events).toContain('consumed');
    expect(committed.instance.usesRemaining).toBe(1);
    expect(committed.instance.chargeTicks).toBe(0);
  });

  it('recovers then enters cooldown then recharges', () => {
    const started = tryCast(charged(), config(), 20, target, source).instance;
    let current = advanceAbilityTick(started, config(), 23).instance; // committed
    current = advanceAbilityTick(current, config(), 24).instance; // recovering
    expect(current.state).toBe('recovering');

    // recovery ends at commit(23) + recoveryTicks(2) = 25
    current = advanceAbilityTick(current, config(), 25).instance;
    expect(current.state).toBe('cooldown');
    expect(current.cooldownRemaining).toBe(5);

    for (let t = 25; t < 30; t += 1) current = advanceAbilityTick(current, config(), t).instance;
    expect(current.state).toBe('charging');
  });

  it('keeps committed snapshots so effects continue after source death', () => {
    const started = tryCast(charged(), config(), 20, target, source).instance;
    const committed = advanceAbilityTick(started, config(), 23).instance;
    expect(committed.targetSnapshot).toEqual(target);
    expect(committed.sourceSnapshot).toEqual(source);
  });
});

describe('P19-T04 ability lifecycle — interrupt', () => {
  it('interrupts before commit with a 35% charge loss', () => {
    const started = tryCast(charged(), config(), 20, target, source).instance;
    const interrupted = interruptAbility(started, config());
    expect(interrupted.instance.state).toBe('charging');
    expect(interrupted.instance.chargeTicks).toBe(6); // 10 - round_half_away_from_zero(10*35/100) = 10 - 4
    expect(interrupted.events).toContain('interrupted');
  });

  it('does not interrupt cast_committed or uninterruptible policies', () => {
    const committed = advanceAbilityTick(tryCast(charged(), config(), 20, target, source).instance, config(), 23).instance;
    expect(interruptAbility(committed, config()).instance.state).toBe('cast_committed');

    const uninterruptible = tryCast(charged(), config({ interruptPolicy: 'uninterruptible' }), 20, target, source).instance;
    expect(interruptAbility(uninterruptible, config({ interruptPolicy: 'uninterruptible' })).instance.state).toBe('casting_precommit');
  });

  it('does not interrupt outside casting_precommit', () => {
    expect(interruptAbility(charged(), config()).instance.state).toBe('ready');
  });
});

describe('P19-T04 ability lifecycle — silence, boss phase, exhaustion', () => {
  it('silence blocks cast but does not stop charge', () => {
    const silenced = applySilence(createAbilityInstance(config(), 'instance_1', 'source'), config(), true);
    expect(silenced.instance.state).toBe('disabled');

    let current = silenced.instance;
    for (let t = 0; t < 10; t += 1) current = advanceAbilityTick(current, config(), t).instance;
    expect(current.state).toBe('disabled');
    expect(current.chargeTicks).toBe(10);

    const unsilenced = applySilence(current, config(), false);
    expect(unsilenced.instance.state).toBe('ready');
  });

  it('rejects a cast while silenced', () => {
    const silenced = applySilence(createAbilityInstance(config(), 'instance_1', 'source'), config(), true).instance;
    expect(tryCast(silenced, config(), 0, target, source).events).toContain('rejected');
  });

  it('exhausts once usesPerBattle casts are consumed', () => {
    const one = config({ usesPerBattle: 1 });
    let current = createAbilityInstance(one, 'instance_1', 'source');
    for (let t = 0; t < 10; t += 1) current = advanceAbilityTick(current, one, t).instance;
    current = tryCast(current, one, 20, target, source).instance;
    current = advanceAbilityTick(current, one, 23).instance; // commit → uses 1→0
    expect(current.usesRemaining).toBe(0);

    current = advanceAbilityTick(current, one, 24).instance; // → recovering
    current = advanceAbilityTick(current, one, 25).instance; // → cooldown
    for (let t = 26; t <= 30; t += 1) current = advanceAbilityTick(current, one, t).instance;
    for (let t = 31; t < 41; t += 1) current = advanceAbilityTick(current, one, t).instance;
    expect(current.state).toBe('ready');
    expect(tryCast(current, one, 50, target, source).instance.state).toBe('exhausted');
  });

  it('boss phase change only cancels when authorized', () => {
    const started = tryCast(charged(), config(), 20, target, source).instance;
    expect(applyBossPhaseChange(started, config()).instance.state).toBe('casting_precommit');
    expect(applyBossPhaseChange(started, config({ bossPhaseCancelAllowed: true })).instance.state).toBe('charging');
  });
});

describe('P19-T04 ability lifecycle — validation', () => {
  it.each([
    { abilityId: 'Bad Id' },
    { chargeTicks: -1 },
    { castTicks: -1 },
    { interruptPolicy: 'sometimes' },
    { invalidTargetPolicy: 'nope' },
    { usesPerBattle: 0 },
  ] as unknown as AbilityConfig[])('rejects malformed config %#', (bad) => {
    expect(() => {
      validateAbilityConfig({ ...config(), ...bad });
    }).toThrow(KernelInvariantError);
  });
});
