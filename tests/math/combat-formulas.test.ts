import { describe, expect, it } from 'vitest';
import { milliValue, basisPoints } from '../../src/game/rules/units';
import { effectiveDefense, mitigatedDamage, cappedTrueDamage } from '../../src/game/sim/math/combat-formulas';

describe('effectiveDefense', () => {
  it('clamps below and above', () => {
    expect(effectiveDefense(-999)).toBe(-40);
    expect(effectiveDefense(-41)).toBe(-40);
    expect(effectiveDefense(-40)).toBe(-40);
    expect(effectiveDefense(0)).toBe(0);
    expect(effectiveDefense(200)).toBe(200);
    expect(effectiveDefense(201)).toBe(200);
    expect(effectiveDefense(999)).toBe(200);
  });
  it('idempotent', () => {
    expect(effectiveDefense(effectiveDefense(-999))).toBe(-40);
    expect(effectiveDefense(effectiveDefense(999))).toBe(200);
  });
});

describe('mitigatedDamage', () => {
  it('zero defense identity', () => {
    expect(mitigatedDamage(milliValue(1000), 0)).toBe(1000);
  });
  it('negative defense increases (1000 raw at -40 -> 1667)', () => {
    expect(mitigatedDamage(milliValue(1000), -40)).toBe(1667);
  });
  it('positive defense reduces (1000 raw at 200 -> 333)', () => {
    expect(mitigatedDamage(milliValue(1000), 200)).toBe(333);
  });
  it('60 defense -> 625', () => {
    expect(mitigatedDamage(milliValue(1000), 60)).toBe(625);
  });
  it('100 defense -> 500', () => {
    expect(mitigatedDamage(milliValue(1000), 100)).toBe(500);
  });
  it('raw zero yields zero', () => {
    expect(mitigatedDamage(milliValue(0), 0)).toBe(0);
  });
  it('raw negative yields zero', () => {
    expect(mitigatedDamage(milliValue(-1), 0)).toBe(0);
  });
  it('minimum successful damage is 1', () => {
    expect(mitigatedDamage(milliValue(1), 200, true)).toBe(1);
  });
  it('unsuccessful hit may stay zero', () => {
    expect(mitigatedDamage(milliValue(1), 200, false)).toBe(0);
  });
  it('result never negative', () => {
    for (let d = -40; d <= 200; d += 1) {
      expect(mitigatedDamage(milliValue(100000), d)).toBeGreaterThanOrEqual(0);
    }
  });
  it('defense monotonic: higher defense never increases damage', () => {
    let prev = Infinity;
    for (let d = -40; d <= 200; d += 1) {
      const x = mitigatedDamage(milliValue(100000), d);
      expect(x).toBeLessThanOrEqual(prev);
      prev = x;
    }
  });
});

describe('cappedTrueDamage', () => {
  it('boss cap 18% (1800 bps)', () => {
    expect(cappedTrueDamage(milliValue(9999), milliValue(10000), basisPoints(1800))).toBe(1800);
  });
  it('null cap leaves true damage uncapped', () => {
    expect(cappedTrueDamage(milliValue(9999), milliValue(10000), null)).toBe(9999);
  });
  it('raw below cap passes through', () => {
    expect(cappedTrueDamage(milliValue(1000), milliValue(10000), basisPoints(1800))).toBe(1000);
  });
  it('zero target max hp yields zero', () => {
    expect(cappedTrueDamage(milliValue(9999), milliValue(0), basisPoints(1800))).toBe(0);
  });
  it('raw zero yields zero', () => {
    expect(cappedTrueDamage(milliValue(0), milliValue(10000), basisPoints(1800))).toBe(0);
  });
  it('cap never exceeds the computed percentage', () => {
    expect(cappedTrueDamage(milliValue(9999), milliValue(10000), basisPoints(1800))).toBeLessThanOrEqual(1800);
  });
});
