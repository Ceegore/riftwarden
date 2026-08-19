import { describe, expect, it } from 'vitest';
import { createPresentationClock, RENDER_FPS, SPEED_MILLI, type PresentationStep } from '../../src/game/render/presentation-clock.js';
import { createSnapshotPresenter } from '../../src/game/render/snapshot-presenter.js';
import { catchRenderCode, entity, frame, hexHash } from './phase25-helpers.js';

const BASE = { simTicksPerSecond: 30, maxCatchUpTicks: 8 };

function simSequence(tickCount: number, hashPrefix = 0): { ticks: number[]; lastHash: string } {
  const ticks: number[] = [];
  let lastHash = hexHash(hashPrefix);
  for (let tick = 0; tick < tickCount; tick += 1) {
    ticks.push(tick);
    lastHash = hexHash(hashPrefix + tick + 1);
  }
  return { ticks, lastHash };
}

/** Drains a clock completely, recording submitted tick order and steps. */
function drain(clock: ReturnType<typeof createPresentationClock>): { ticks: number[]; steps: PresentationStep[] } {
  const ticks: number[] = [];
  const steps: PresentationStep[] = [];
  let guard = 0;
  while (clock.pendingTicks > 0) {
    const step = clock.present();
    steps.push(step);
    for (const submitted of step.submitted) ticks.push(submitted.tick);
    guard += 1;
    if (guard > 10_000) throw new Error('clock drain did not terminate');
  }
  return { ticks, steps };
}

describe('Presentation clock', () => {
  it('rejects invalid configurations', () => {
    expect(catchRenderCode(() => createPresentationClock({ speedMilli: 750, renderFps: 60, ...BASE }))).toBe('CLOCK_INVALID_CONFIG');
    expect(catchRenderCode(() => createPresentationClock({ speedMilli: 1000, renderFps: 24, ...BASE }))).toBe('CLOCK_INVALID_CONFIG');
    expect(catchRenderCode(() => createPresentationClock({ speedMilli: 1000, renderFps: 60, simTicksPerSecond: 0, maxCatchUpTicks: 8 }))).toBe('CLOCK_INVALID_CONFIG');
    expect(catchRenderCode(() => createPresentationClock({ speedMilli: 1000, renderFps: 60, simTicksPerSecond: 30, maxCatchUpTicks: -1 }))).toBe('CLOCK_INVALID_CONFIG');
  });

  it('rejects non-monotonic frame pushes', () => {
    const clock = createPresentationClock({ speedMilli: 1000, renderFps: 60, ...BASE });
    clock.push(frame(5, [entity('a')], hexHash(5)));
    expect(catchRenderCode(() => {
      clock.push(frame(4, [entity('a')], hexHash(4)));
    })).toBe('CLOCK_NON_MONOTONIC');
  });

  it('holds with an empty queue and ramps alpha to 1000', () => {
    const clock = createPresentationClock({ speedMilli: 1000, renderFps: 60, ...BASE });
    const step = clock.present();
    expect(step.submitted).toEqual([]);
    expect(step.alpha1000).toBe(1000);
    expect(step.pressure).toBe(false);
  });

  it('presents every sim tick exactly once in order at 1x/60fps', () => {
    const clock = createPresentationClock({ speedMilli: 1000, renderFps: 60, ...BASE });
    const { ticks, lastHash } = simSequence(100);
    for (const tick of ticks) clock.push(frame(tick, [entity('a')], hexHash(tick + 1)));
    const { ticks: presented, steps } = drain(clock);
    expect(presented).toEqual(ticks);
    expect(clock.presentedTicks).toBe(100);
    expect(clock.pendingTicks).toBe(0);
    // Gameplay hashes are untouched by presentation.
    expect(steps.at(-1)?.submitted.at(-1)?.gameplayHash).toBe(lastHash);
  });

  it('keeps gameplay hashes identical across the full speed x fps matrix', () => {
    for (const speedMilli of SPEED_MILLI) {
      for (const renderFps of RENDER_FPS) {
        const clock = createPresentationClock({ speedMilli, renderFps, ...BASE });
        const { ticks, lastHash } = simSequence(120, speedMilli + renderFps);
        const presenter = createSnapshotPresenter();
        for (const tick of ticks) {
          const simFrame = frame(tick, [entity('a', { logicalX100: tick % 100 })], hexHash(speedMilli + renderFps + tick + 1));
          clock.push(simFrame);
          const step = clock.present();
          for (const submitted of step.submitted) presenter.submitConfirmed(submitted);
        }
        while (clock.pendingTicks > 0) {
          const step = clock.present();
          for (const submitted of step.submitted) presenter.submitConfirmed(submitted);
        }
        expect(clock.presentedTicks).toBe(ticks.length);
        expect(presenter.latestGameplayHash).toBe(lastHash);
      }
    }
  });

  it('catches up at most maxCatchUpTicks beyond the nominal budget', () => {
    const clock = createPresentationClock({ speedMilli: 3000, renderFps: 15, ...BASE });
    // Nominal budget at 3x/15fps/30tps = 6 ticks per render frame.
    for (let tick = 0; tick < 50; tick += 1) clock.push(frame(tick, [entity('a')], hexHash(tick + 1)));
    let maxConsumed = 0;
    let sawPressure = false;
    let guard = 0;
    while (clock.pendingTicks > 0) {
      const step = clock.present();
      maxConsumed = Math.max(maxConsumed, step.submitted.length);
      if (step.pressure) sawPressure = true;
      guard += 1;
      if (guard > 1000) throw new Error('drain did not terminate');
    }
    expect(maxConsumed).toBeLessThanOrEqual(6 + 8);
    expect(sawPressure).toBe(true);
    expect(clock.pendingTicks).toBe(0);
    expect(clock.presentedTicks).toBe(50);
  });

  it('never drops sim ticks under a burst: every pushed frame is presented', () => {
    for (const speedMilli of SPEED_MILLI) {
      const clock = createPresentationClock({ speedMilli, renderFps: 15, ...BASE });
      for (let tick = 0; tick < 200; tick += 1) clock.push(frame(tick, [entity('a')], hexHash(tick + 1)));
      const { ticks } = drain(clock);
      expect(ticks).toEqual(Array.from({ length: 200 }, (_, i) => i));
    }
  });

  it('ramps alpha across hold frames at 1x/60fps', () => {
    const clock = createPresentationClock({ speedMilli: 1000, renderFps: 60, ...BASE });
    clock.push(frame(0, [entity('a')], hexHash(1)));
    // 60fps renders 2 frames per 30tps sim tick: the first render frame
    // holds while the budget accumulates, the second consumes the tick.
    const hold = clock.present();
    expect(hold.submitted).toEqual([]);
    expect(hold.alpha1000).toBe(1000);
    const consume = clock.present();
    expect(consume.submitted.map((f) => f.tick)).toEqual([0]);
    expect(consume.alpha1000).toBe(0);
    const ramp = clock.present();
    expect(ramp.submitted).toEqual([]);
    expect(ramp.alpha1000).toBe(500);
    expect(clock.present().alpha1000).toBe(1000);
  });

  it('keeps the final presentation hash stable across quality tiers', () => {
    // Quality is presentation-side only; the clock and presenter never touch
    // the gameplay hash, so every tier sees the same final hash.
    for (const tier of ['high', 'medium', 'low', 'reduced'] as const) {
      const clock = createPresentationClock({ speedMilli: 2000, renderFps: 30, ...BASE });
      const presenter = createSnapshotPresenter();
      for (let tick = 0; tick < 60; tick += 1) {
        const simFrame = frame(tick, [entity('a')], hexHash(1000 + tick + 1));
        clock.push(simFrame);
        const step = clock.present();
        for (const submitted of step.submitted) presenter.submitConfirmed(submitted);
      }
      while (clock.pendingTicks > 0) {
        const step = clock.present();
        for (const submitted of step.submitted) presenter.submitConfirmed(submitted);
      }
      expect(presenter.latestGameplayHash).toBe(hexHash(1060));
      expect(tier.length).toBeGreaterThan(0);
    }
  });

  it('interleaves with the presenter without losing frames', () => {
    const clock = createPresentationClock({ speedMilli: 500, renderFps: 120, ...BASE });
    const presenter = createSnapshotPresenter();
    const pushed: number[] = [];
    for (let tick = 0; tick < 40; tick += 1) {
      clock.push(frame(tick, [entity('a', { logicalX100: tick })]));
      pushed.push(tick);
      const step = clock.present();
      for (const submitted of step.submitted) presenter.submitConfirmed(submitted);
    }
    while (clock.pendingTicks > 0) {
      const step = clock.present();
      for (const submitted of step.submitted) presenter.submitConfirmed(submitted);
    }
    expect(clock.presentedTicks).toBe(pushed.length);
    expect(presenter.next?.tick).toBe(39);
    expect(RENDER_FPS.length).toBe(4);
  });
});
