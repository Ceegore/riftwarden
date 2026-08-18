import { describe, expect, it } from 'vitest';
import {
  PERMANENT_END_TICK,
  validateStatusInstance,
  type PeriodicState,
  type StatusInstance,
} from '../../src/game/sim/status/status-instance.js';
import {
  advancePeriodic,
  firstPeriodicTick,
  hasFiniteExpiry,
  isPeriodicDue,
} from '../../src/game/sim/status/periodic-status-system.js';

function periodic(overrides: Partial<PeriodicState> = {}): PeriodicState {
  return Object.freeze({
    effectKind: 'burn',
    intervalTicks: 5,
    nextTick: 20,
    tickIndex: 0,
    initialTick: false,
    dedupKey: 'effect_burn',
    ...overrides,
  });
}

function status(overrides: Partial<StatusInstance> = {}): StatusInstance {
  return Object.freeze({
    statusId: 'st_burn',
    kind: 'burn',
    polarity: 'negative',
    targetId: 'unit_target',
    sourceId: 'unit_source',
    effectId: 'effect_x',
    startTick: 10,
    endTick: 40,
    strength: 100,
    stackGroup: 'burn',
    sequence: 1,
    stackPolicy: 'refresh_duration',
    maxStacks: 1,
    flags: Object.freeze([]),
    ...overrides,
  });
}

describe('P18 T03 periodic scheduling (§7)', () => {
  it('first tick defaults to startTick + intervalTicks unless initialTick', () => {
    expect(firstPeriodicTick(status({ periodic: periodic() }))).toBe(15);
    expect(firstPeriodicTick(status({ periodic: periodic({ initialTick: true }) }))).toBe(10);
  });

  it('is due exactly at nextTick while the anchor precedes the exclusive endTick', () => {
    const s = status({ periodic: periodic() });
    expect(isPeriodicDue(s, 19)).toBe(false);
    expect(isPeriodicDue(s, 20)).toBe(true);
    // nextTick == endTick never fires (§7.3).
    expect(isPeriodicDue(status({ endTick: 20, periodic: periodic({ nextTick: 20 }) }), 20)).toBe(false);
    // Expired status (now >= endTick) never fires.
    expect(isPeriodicDue(status({ periodic: periodic({ nextTick: 35 }) }), 40)).toBe(false);
  });

  it('a permanent status keeps firing while its anchor advances', () => {
    const s = status({ endTick: PERMANENT_END_TICK, periodic: periodic({ nextTick: 100 }) });
    expect(hasFiniteExpiry(s)).toBe(false);
    expect(isPeriodicDue(s, 100)).toBe(true);
  });

  it('advancePeriodic moves nextTick by the interval and increments tickIndex immutably', () => {
    const s = status({ periodic: periodic({ nextTick: 20, intervalTicks: 5, tickIndex: 2 }) });
    const advanced = advancePeriodic(s);
    expect(advanced.periodic?.nextTick).toBe(25);
    expect(advanced.periodic?.tickIndex).toBe(3);
    // Input untouched.
    expect(s.periodic?.nextTick).toBe(20);
    expect(s.periodic?.tickIndex).toBe(2);
  });

  it('validates periodic fields strictly', () => {
    expect(() => { validateStatusInstance(status({ periodic: periodic() })); }).not.toThrow();
    expect(() => { validateStatusInstance(status({ periodic: periodic({ intervalTicks: 0 }) })); }).toThrow();
    expect(() => { validateStatusInstance(status({ periodic: periodic({ nextTick: -1 }) })); }).toThrow();
    expect(() => { validateStatusInstance(status({ periodic: periodic({ effectKind: 'bogus' as never }) })); }).toThrow();
    expect(() => { validateStatusInstance(status({ periodic: periodic({ dedupKey: 'BAD KEY' }) })); }).toThrow();
  });
});
