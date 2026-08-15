export type Brand<T, Name extends string> = T & { readonly __brand: Name };
export type ContentId = Brand<string, "ContentId">;
export type LocalizationKey = Brand<string, "LocalizationKey">;
export type Tick = Brand<number, "Tick">;
export type MilliValue = Brand<number, "MilliValue">;
export type BasisPoints = Brand<number, "BasisPoints">;
export type PositionX100 = Brand<number, "PositionX100">;
export type CurrencyAmount = Brand<number, "CurrencyAmount">;

import { TECHNICAL_RULES } from "../../rules/technical-rules";

export const TICKS_PER_SECOND = TECHNICAL_RULES.simulationTicksPerSecond;
export function materializeTicks(seconds: number): Tick {
  const ticks = Math.round(seconds * TICKS_PER_SECOND);
  const drift = Math.abs(ticks / TICKS_PER_SECOND - seconds);
  if (!Number.isFinite(seconds) || seconds < 0 || drift > 0.01) {
    throw new Error("P09_TICK_ROUNDING");
  }
  return ticks as Tick;
}
