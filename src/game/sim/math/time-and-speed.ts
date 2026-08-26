import { SECONDS_PRECISION_WARNING_MICROS } from '../../rules/mechanic-rules.js';
import { TECHNICAL_RULES } from '../../rules/technical-rules.js';
import { basisPoints, tick, type BasisPoints, type Tick } from '../../rules/units.js';
import { clampInteger, mulDivRound } from './fixed-math.js';
import { MathInvariantError } from './invariant-error.js';
import { assertSafeInteger } from './numeric-validation.js';

export interface TickConversion { readonly ticks: Tick; readonly deviationMicros: number; readonly warningCode?: 'P12_SECONDS_PRECISION_WARNING'; }
function parseDecimal(value: string): { numerator: number; denominator: number } {
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) throw new MathInvariantError('P12_DECIMAL_SYNTAX', { value });
  const [whole, fraction=''] = value.split('.');
  const denominator = 10 ** fraction.length;
  if (!Number.isSafeInteger(denominator)) throw new MathInvariantError('P12_DECIMAL_SYNTAX', { value });
  const numerator = Number(whole) * denominator + Number(fraction || '0');
  if (!Number.isSafeInteger(numerator)) throw new MathInvariantError('P12_NOT_SAFE_INTEGER', { value });
  return { numerator, denominator };
}
export function secondsToTicks(value: string, ensurePositiveMinimum = false): TickConversion {
  const { numerator, denominator } = parseDecimal(value);
  const rounded = mulDivRound(numerator, TECHNICAL_RULES.simulationTicksPerSecond, denominator);
  const ticksValue = ensurePositiveMinimum && numerator > 0 ? Math.max(1, rounded) : rounded;
  const representedMicros = mulDivRound(ticksValue, 1_000_000, TECHNICAL_RULES.simulationTicksPerSecond);
  const authoredMicros = mulDivRound(numerator, 1_000_000, denominator);
  const deviationMicros = Math.abs(representedMicros - authoredMicros);
  return { ticks: tick(ticksValue), deviationMicros, ...(deviationMicros > SECONDS_PRECISION_WARNING_MICROS ? { warningCode: 'P12_SECONDS_PRECISION_WARNING' as const } : {}) };
}
export function numberSecondsToTicks(value: number, ensurePositiveMinimum = false): TickConversion {
  if (!Number.isFinite(value) || value < 0 || Object.is(value,-0)) throw new MathInvariantError('P12_SECONDS_NEGATIVE', { value });
  const source=String(value);
  if (/[eE]/.test(source)) throw new MathInvariantError('P12_DECIMAL_SYNTAX', { value });
  return secondsToTicks(source,ensurePositiveMinimum);
}
export const minimumAttackIntervalTicks = (): Tick => secondsToTicks('0.45',true).ticks;
export const clampMovementX100PerSecond = (value:number):number => clampInteger(value,200,1_400);
export function controlDurationTicks(base: Tick, resistance: BasisPoints, boss = false): Tick {
  assertSafeInteger(base,'base');
  const remaining = basisPoints(TECHNICAL_RULES.basisPointsScale - resistance,0,TECHNICAL_RULES.basisPointsScale);
  const reduced = Math.max(0,mulDivRound(base,remaining,10_000));
  const bossCap = secondsToTicks('0.65',true).ticks;
  return tick(boss ? Math.min(reduced,bossCap) : reduced);
}
