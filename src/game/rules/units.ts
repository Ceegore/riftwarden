import { TECHNICAL_RULES } from './technical-rules.js';
declare const unitBrand: unique symbol;
type Brand<Name extends string> = number & { readonly [unitBrand]: Name };
export type Tick = Brand<'Tick'>;
export type PositionX100 = Brand<'PositionX100'>;
export type MilliValue = Brand<'MilliValue'>;
export type BasisPoints = Brand<'BasisPoints'>;
export type Currency = Brand<'Currency'>;
export type CommitId = Brand<'CommitId'>;
export type Sequence = Brand<'Sequence'>;
export class RuleInvariantError extends Error {
  constructor(readonly code: string, readonly value: unknown) { super(code); this.name = 'RuleInvariantError'; }
}
function safeInteger(value: number, code: string, min = -Number.MAX_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value)) throw new RuleInvariantError('P11_UNIT_NOT_INTEGER', value);
  if (Object.is(value, -0)) throw new RuleInvariantError('P11_UNIT_NEGATIVE_ZERO', value);
  if (value < min || value > max) throw new RuleInvariantError(code, value);
  return value;
}
export const tick = (v:number):Tick => safeInteger(v,'P11_UNIT_OUT_OF_RANGE',0) as Tick;
export const positionX100 = (v:number):PositionX100 => safeInteger(v,'P11_UNIT_OUT_OF_RANGE',TECHNICAL_RULES.positionMinX100,TECHNICAL_RULES.positionMaxX100) as PositionX100;
export const milliValue = (v:number):MilliValue => safeInteger(v,'P11_UNIT_OUT_OF_RANGE') as MilliValue;
export const basisPoints = (v: number, min: number = TECHNICAL_RULES.basisPointsNormalMin, max: number = TECHNICAL_RULES.basisPointsNormalMax): BasisPoints => safeInteger(v, 'P11_UNIT_OUT_OF_RANGE', min, max) as BasisPoints;
export const currency = (v:number):Currency => safeInteger(v,'P11_UNIT_OUT_OF_RANGE',0) as Currency;
export const commitId = (v:number):CommitId => safeInteger(v,'P11_UNIT_OUT_OF_RANGE',0) as CommitId;
export const sequence = (v:number):Sequence => safeInteger(v,'P11_UNIT_OUT_OF_RANGE',0) as Sequence;
export const unbrand = (value: number): number => value;
function checked(value:number):number { if (!Number.isSafeInteger(value) || Object.is(value,-0)) throw new RuleInvariantError('P11_UNIT_OVERFLOW',value); return value; }
export const addTicks = (a:Tick,b:Tick):Tick => tick(checked(a+b));
export const addMilli = (a:MilliValue,b:MilliValue):MilliValue => milliValue(checked(a+b));
export const subtractCurrency = (a:Currency,b:Currency):Currency => currency(checked(a-b));
export const nextSequence = (v:Sequence):Sequence => sequence(checked(v+1));
