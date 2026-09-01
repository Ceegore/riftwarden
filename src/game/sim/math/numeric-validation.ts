import { MathInvariantError } from './invariant-error.js';

export function assertSafeInteger(value: number, label = 'value'): number {
  if (!Number.isSafeInteger(value)) throw new MathInvariantError('P12_NOT_SAFE_INTEGER', { label, value });
  if (Object.is(value, -0)) throw new MathInvariantError('P12_NEGATIVE_ZERO', { label });
  return value;
}
export function assertRange(value: number, min: number, max: number, label = 'value'): number {
  assertSafeInteger(value, label); assertSafeInteger(min, 'min'); assertSafeInteger(max, 'max');
  if (min > max || value < min || value > max) throw new MathInvariantError('P12_RANGE', { label, value, min, max });
  return value;
}
export function checkedAdd(a: number, b: number): number {
  assertSafeInteger(a, 'a'); assertSafeInteger(b, 'b');
  const result = a + b;
  if (!Number.isSafeInteger(result) || Object.is(result, -0)) throw new MathInvariantError('P12_RESULT_OVERFLOW', { a, b, operation: 'add' });
  return result;
}
export function checkedMultiply(a: number, b: number): number {
  assertSafeInteger(a, 'a'); assertSafeInteger(b, 'b');
  if (a === 0 || b === 0) return 0;
  if (Math.abs(a) > Math.floor(Number.MAX_SAFE_INTEGER / Math.abs(b))) {
    throw new MathInvariantError('P12_MULTIPLY_OVERFLOW', { a, b });
  }
  const result = a * b;
  if (!Number.isSafeInteger(result) || Object.is(result, -0)) throw new MathInvariantError('P12_MULTIPLY_OVERFLOW', { a, b });
  return result;
}
export function canonicalIntegerString(value: number): string {
  assertSafeInteger(value);
  return String(value);
}
