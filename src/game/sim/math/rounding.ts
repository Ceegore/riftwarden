import { MathInvariantError } from './invariant-error.js';
import { assertSafeInteger } from './numeric-validation.js';

export function roundDivHalfAwayFromZero(numerator: number, denominator: number): number {
  assertSafeInteger(numerator, 'numerator'); assertSafeInteger(denominator, 'denominator');
  if (denominator === 0) throw new MathInvariantError('P12_DIVIDE_BY_ZERO', { numerator });
  if (numerator === 0) return 0;
  const rawQuotient = Math.trunc(numerator / denominator);
  const quotient = Object.is(rawQuotient, -0) ? 0 : rawQuotient;
  const remainder = numerator % denominator;
  if (remainder === 0) return quotient;
  const absRemainder = Math.abs(remainder);
  const absDenominator = Math.abs(denominator);
  const threshold = Math.ceil(absDenominator / 2);
  if (absRemainder < threshold) return quotient;
  const direction = Math.sign(numerator) === Math.sign(denominator) ? 1 : -1;
  const result = quotient + direction;
  if (!Number.isSafeInteger(result) || Object.is(result, -0)) {
    throw new MathInvariantError('P12_RESULT_OVERFLOW', { numerator, denominator });
  }
  return result;
}
