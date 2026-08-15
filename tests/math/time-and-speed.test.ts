import { describe, expect, it } from 'vitest';
import { tick, basisPoints } from '../../src/game/rules/units';
import {
  secondsToTicks,
  numberSecondsToTicks,
  minimumAttackIntervalTicks,
  clampMovementX100PerSecond,
  controlDurationTicks,
} from '../../src/game/sim/math/time-and-speed';

describe('secondsToTicks truth table at 30 TPS', () => {
  const table: readonly [string, number, number][] = [
    ['0', 0, 0],
    ['0.1', 3, 3],
    ['0.45', 13.5, 14],
    ['0.65', 19.5, 20],
    ['1.2', 36, 36],
    ['2.5', 75, 75],
  ];
  for (const [seconds, , expected] of table) {
    it(`${seconds}s -> ${String(expected)} ticks`, () => {
      expect(secondsToTicks(seconds).ticks).toBe(expected);
    });
  }
  it('tiny positive duration without minimum may round to zero', () => {
    expect(secondsToTicks('0.001').ticks).toBe(0);
  });
  it('tiny positive duration with minimum is 1', () => {
    expect(secondsToTicks('0.001', true).ticks).toBe(1);
  });
});

describe('secondsToTicks precision warning', () => {
  it('0.05s exceeds the 0.01s threshold', () => {
    expect(secondsToTicks('0.05').warningCode).toBe('P12_SECONDS_PRECISION_WARNING');
  });
  it('exact tick has no warning', () => {
    expect(secondsToTicks('0.1').warningCode).toBeUndefined();
  });
  it('deviation micros are structured', () => {
    const r = secondsToTicks('0.05');
    expect(typeof r.deviationMicros).toBe('number');
    expect(r.deviationMicros).toBeGreaterThan(10_000);
  });
});

describe('secondsToTicks syntax', () => {
  for (const bad of ['1e-3', '-1', '01.5', '1.', '1,5', ' 1', '1 ', 'NaN', 'Infinity', '']) {
    it(`rejects ${JSON.stringify(bad)}`, () => {
      expect(() => secondsToTicks(bad)).toThrow('P12_DECIMAL_SYNTAX');
    });
  }
});

describe('numberSecondsToTicks', () => {
  it('finite nonnegative numbers convert', () => {
    expect(numberSecondsToTicks(0.45, true).ticks).toBe(14);
  });
  it('negative blocks with P12_SECONDS_NEGATIVE', () => {
    expect(() => numberSecondsToTicks(-1)).toThrow('P12_SECONDS_NEGATIVE');
  });
  it('values that String() renders in exponent form block with P12_DECIMAL_SYNTAX', () => {
    expect(() => numberSecondsToTicks(1e21)).toThrow('P12_DECIMAL_SYNTAX');
  });
  it('tiny finite values convert from their decimal form', () => {
    expect(numberSecondsToTicks(1e-3, true).ticks).toBe(1);
  });
  it('infinity blocks', () => {
    expect(() => numberSecondsToTicks(Infinity)).toThrow('P12_SECONDS_NEGATIVE');
  });
});

describe('movement and control', () => {
  it('minimum attack interval is 14 ticks', () => {
    expect(minimumAttackIntervalTicks()).toBe(14);
  });
  it('movement clamps to [200, 1400]', () => {
    expect(clampMovementX100PerSecond(1)).toBe(200);
    expect(clampMovementX100PerSecond(200)).toBe(200);
    expect(clampMovementX100PerSecond(2000)).toBe(1400);
  });
  it('70% resistance reduces 75 ticks to 23', () => {
    expect(controlDurationTicks(tick(75), basisPoints(7000), false)).toBe(23);
  });
  it('boss hard control cap is 20 ticks', () => {
    expect(controlDurationTicks(tick(75), basisPoints(0), true)).toBe(20);
    expect(controlDurationTicks(tick(75), basisPoints(7000), true)).toBe(20);
  });
  it('resistance outside [0, 10000] blocks', () => {
    expect(() => controlDurationTicks(tick(75), basisPoints(10001))).toThrow();
  });
});
