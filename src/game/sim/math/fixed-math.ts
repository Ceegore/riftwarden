import { TECHNICAL_RULES } from '../../rules/technical-rules.js';
import { basisPoints, type BasisPoints } from '../../rules/units.js';
import { MathInvariantError } from './invariant-error.js';
import { assertSafeInteger, checkedMultiply } from './numeric-validation.js';
import { roundDivHalfAwayFromZero } from './rounding.js';

function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b !== 0) { const next = a % b; a = b; b = next; }
  return a || 1;
}
export function clampInteger(value: number, min: number, max: number): number {
  assertSafeInteger(value); assertSafeInteger(min); assertSafeInteger(max);
  if (min > max) throw new MathInvariantError('P12_RANGE', { value, min, max });
  return Math.min(max, Math.max(min, value));
}
export function mulDivRound(a: number, b: number, denominator: number): number {
  assertSafeInteger(a, 'a'); assertSafeInteger(b, 'b'); assertSafeInteger(denominator, 'denominator');
  if (denominator === 0) throw new MathInvariantError('P12_DIVIDE_BY_ZERO', { a, b });
  let aa=a, bb=b, dd=denominator;
  const g1=gcd(aa,dd); aa/=g1; dd/=g1;
  const g2=gcd(bb,dd); bb/=g2; dd/=g2;
  return roundDivHalfAwayFromZero(checkedMultiply(aa,bb),dd);
}
export function applyBasisPoints(value: number, bps: BasisPoints): number {
  return mulDivRound(value, bps, TECHNICAL_RULES.basisPointsScale);
}
export function ratioBasisPoints(numerator: number, denominator: number): BasisPoints {
  return basisPoints(mulDivRound(numerator, TECHNICAL_RULES.basisPointsScale, denominator), -TECHNICAL_RULES.basisPointsNormalMax, TECHNICAL_RULES.basisPointsNormalMax);
}
