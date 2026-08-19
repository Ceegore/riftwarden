import type { BattlePresentationFrame } from './types.js';
import { RenderError } from './render-error.js';

/**
 * Presentation clock (handbook §4/§6): speeds 0.5x/1x/2x/3x affect only the
 * presentation rate, never simulation order or determinism. The clock is
 * purely deterministic (no wallclock): each present() call is one render
 * frame at the configured fps. When the renderer lags, at most
 * maxCatchUpTicks extra sim ticks may be caught up per render frame; beyond
 * that, pressure is reported so quality degrades — sim ticks are never
 * dropped and every confirmed frame is eventually presented in order.
 */
export const SPEED_MILLI: readonly number[] = Object.freeze([500, 1000, 2000, 3000]);
export const RENDER_FPS: readonly number[] = Object.freeze([15, 30, 60, 120]);

export interface PresentationClockConfig {
  readonly speedMilli: number;
  readonly renderFps: number;
  readonly simTicksPerSecond: number;
  readonly maxCatchUpTicks: number;
}

export interface PresentationStep {
  /** Confirmed frames to submit to the presenter this render frame. */
  readonly submitted: readonly BattlePresentationFrame[];
  /** Interpolation alpha for this render frame (integer 0..1000). */
  readonly alpha1000: number;
  readonly catchUpUsed: number;
  /** True when the queue is still behind after the catch-up cap. */
  readonly pressure: boolean;
}

export interface PresentationClock {
  readonly pendingTicks: number;
  readonly presentedTicks: number;
  push(frame: BattlePresentationFrame): void;
  present(): PresentationStep;
}

export function createPresentationClock(config: PresentationClockConfig): PresentationClock {
  if (!SPEED_MILLI.includes(config.speedMilli)) throw new RenderError('CLOCK_INVALID_CONFIG', { field: 'speedMilli' });
  if (!RENDER_FPS.includes(config.renderFps)) throw new RenderError('CLOCK_INVALID_CONFIG', { field: 'renderFps' });
  if (!Number.isSafeInteger(config.simTicksPerSecond) || config.simTicksPerSecond <= 0) {
    throw new RenderError('CLOCK_INVALID_CONFIG', { field: 'simTicksPerSecond' });
  }
  if (!Number.isSafeInteger(config.maxCatchUpTicks) || config.maxCatchUpTicks < 0) {
    throw new RenderError('CLOCK_INVALID_CONFIG', { field: 'maxCatchUpTicks' });
  }

  const queue: BattlePresentationFrame[] = [];
  // Nominal sim ticks per render frame, in thousandths (integer math).
  const nominal1000 = Math.floor((config.speedMilli * config.simTicksPerSecond) / config.renderFps);
  const alphaStep1000 = Math.min(1000, nominal1000);
  let acc1000 = 0;
  let presentedTicks = 0;
  let alpha = 1000;
  let lastTick: number | null = null;

  return {
    get pendingTicks() {
      return queue.length;
    },
    get presentedTicks() {
      return presentedTicks;
    },
    push(frame) {
      if (!Number.isSafeInteger(frame.tick) || frame.tick < 0) throw new RenderError('CLOCK_NON_MONOTONIC', { tick: frame.tick });
      if (lastTick !== null && frame.tick < lastTick) throw new RenderError('CLOCK_NON_MONOTONIC', { tick: frame.tick, lastTick });
      lastTick = frame.tick;
      queue.push(frame);
    },
    present() {
      if (queue.length === 0) {
        alpha = Math.min(1000, alpha + alphaStep1000);
        return { submitted: [], alpha1000: alpha, catchUpUsed: 0, pressure: false };
      }
      acc1000 += nominal1000;
      const budget = Math.floor(acc1000 / 1000);
      acc1000 %= 1000;
      if (budget === 0) {
        alpha = Math.min(1000, alpha + alphaStep1000);
        return { submitted: [], alpha1000: alpha, catchUpUsed: 0, pressure: false };
      }
      let catchUpUsed = 0;
      if (queue.length > budget) {
        catchUpUsed = Math.min(config.maxCatchUpTicks, queue.length - budget);
      }
      const consume = budget + catchUpUsed;
      const submitted = queue.splice(0, consume);
      presentedTicks += submitted.length;
      alpha = 0;
      return { submitted, alpha1000: 0, catchUpUsed, pressure: queue.length > 0 };
    },
  };
}
