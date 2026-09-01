import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalIntegerString, checkedAdd, assertSafeInteger, assertRange } from '../../src/game/sim/math/numeric-validation';

const here = path.dirname(fileURLToPath(import.meta.url));
const negative = JSON.parse(
  readFileSync(path.join(here, 'fixtures', 'negative', 'invalid-numeric-values.json'), 'utf8'),
) as { values: string[]; expectedCodes: string[] };

describe('canonicalIntegerString', () => {
  it('canonical forms', () => {
    expect(canonicalIntegerString(0)).toBe('0');
    expect(canonicalIntegerString(-42)).toBe('-42');
    expect(canonicalIntegerString(Number.MAX_SAFE_INTEGER)).toBe(String(Number.MAX_SAFE_INTEGER));
  });
  it('negative matrix from fixture', () => {
    for (const raw of negative.values) {
      const value = raw === 'NaN' ? NaN : raw === 'Infinity' ? Infinity : raw === '-Infinity' ? -Infinity : raw === '-0' ? -0 : Number(raw);
      const expected = raw === '-0' ? negative.expectedCodes[1] : negative.expectedCodes[0];
      expect(() => canonicalIntegerString(value)).toThrow(expected);
    }
  });
});

describe('checkedAdd', () => {
  it('adds safe integers', () => {
    expect(checkedAdd(2, 3)).toBe(5);
  });
  it('overflow blocks with P12_RESULT_OVERFLOW', () => {
    expect(() => checkedAdd(Number.MAX_SAFE_INTEGER, 1)).toThrow('P12_RESULT_OVERFLOW');
  });
  it('non-integer operands block', () => {
    expect(() => checkedAdd(1.5, 1)).toThrow('P12_NOT_SAFE_INTEGER');
  });
});

describe('assertSafeInteger and assertRange', () => {
  it('accepts safe integer', () => {
    expect(assertSafeInteger(7)).toBe(7);
  });
  it('rejects -0 with P12_NEGATIVE_ZERO', () => {
    expect(() => assertSafeInteger(-0)).toThrow('P12_NEGATIVE_ZERO');
  });
  it('rejects unsafe integer', () => {
    expect(() => assertSafeInteger(Number.MAX_SAFE_INTEGER + 1)).toThrow('P12_NOT_SAFE_INTEGER');
  });
  it('range violation blocks', () => {
    expect(() => assertRange(11, 0, 10)).toThrow('P12_RANGE');
    expect(assertRange(5, 0, 10)).toBe(5);
  });
});
