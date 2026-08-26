import { roundToTenths } from '../../ui/format/rounding.js';
import { HudError } from './hud-error.js';

/**
 * "In N seconds" is derived exclusively from the tick difference and the
 * authoritative tick rate (handbook §8). Negative differences are displayed
 * as "now" (clamped to zero). The displayed duration may deviate at most
 * maxDurationDisplayErrorMs = 100 ms from the authoritative tick value
 * (HUD_TELEGRAPH_CONTRACT).
 */
export function remainingSeconds(currentTick: number, dueTick: number, tickRate: number): number {
  if (!Number.isInteger(currentTick) || !Number.isInteger(dueTick) || !Number.isInteger(tickRate) || tickRate <= 0) {
    throw new HudError('INVALID_TICK_INPUT', { currentTick, dueTick, tickRate });
  }
  return Math.max(0, dueTick - currentTick) / tickRate;
}

/** Tenth-of-a-second display rounding (bounded error for tick rates >= 5). */
export function formatTenths(seconds: number): number {
  return roundToTenths(seconds);
}
