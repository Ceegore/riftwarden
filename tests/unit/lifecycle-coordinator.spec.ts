import { describe, expect, it, vi } from 'vitest';
import { LifecycleCoordinator } from '../../src/platform/lifecycle/coordinator';

function createHarness() {
  const order: string[] = [];
  const counters = {
    simulationTicks: 1,
    renderFrames: 1,
    inputDispatches: 1,
    audioFrames: 1,
  };
  const diagnostics: { code: string }[] = [];
  const coordinator = new LifecycleCoordinator(
    {
      pauseSimulationAtConfirmedTick: () => {
        order.push('pause');
      },
      requestMemorySnapshot: () => {
        order.push('snapshot');
        return Promise.resolve();
      },
      fadeAndPauseAudio: () => {
        order.push('audio');
      },
      stopRenderer: () => {
        order.push('render');
      },
      stopInput: () => {
        order.push('input');
      },
      restoreRendererCapability: () => {
        order.push('restore-render');
        return Promise.resolve();
      },
      restoreAudioCapability: () => {
        order.push('restore-audio');
        return Promise.resolve();
      },
      restoreInputCapability: () => {
        order.push('restore-input');
        return Promise.resolve();
      },
      showPausedResumeUi: () => {
        order.push('paused-ui');
      },
      readCounters: () => ({ ...counters }),
    },
    { record: (code) => diagnostics.push({ code }) },
  );
  return { coordinator, order, counters, diagnostics };
}

describe('LifecycleCoordinator', () => {
  it('executes background hooks in the required order', async () => {
    const { coordinator, order } = createHarness();
    await coordinator.onNativeState('BACKGROUND');
    expect(order).toEqual(['pause', 'snapshot', 'audio', 'render', 'input']);
  });

  it('is idempotent for duplicate background events', async () => {
    const { coordinator, order } = createHarness();
    await coordinator.onNativeState('BACKGROUND');
    await coordinator.onNativeState('BACKGROUND');
    expect(order.filter((step) => step === 'snapshot')).toHaveLength(1);
  });

  it('restores capabilities but presents paused UI', async () => {
    const { coordinator, order } = createHarness();
    await coordinator.onNativeState('BACKGROUND');
    await coordinator.onNativeState('ACTIVE');
    expect(order.slice(-4)).toEqual([
      'restore-render',
      'restore-audio',
      'restore-input',
      'paused-ui',
    ]);
  });

  it('reports snapshot timeout without throwing', async () => {
    vi.useFakeTimers();
    const { diagnostics } = createHarness();
    const never = new LifecycleCoordinator(
      {
        pauseSimulationAtConfirmedTick: () => undefined,
        requestMemorySnapshot: () => new Promise<void>(() => undefined),
        fadeAndPauseAudio: () => undefined,
        stopRenderer: () => undefined,
        stopInput: () => undefined,
        restoreRendererCapability: () => Promise.resolve(),
        restoreAudioCapability: () => Promise.resolve(),
        restoreInputCapability: () => Promise.resolve(),
        showPausedResumeUi: () => undefined,
        readCounters: () => ({
          simulationTicks: 0,
          renderFrames: 0,
          inputDispatches: 0,
          audioFrames: 0,
        }),
      },
      { record: (code) => diagnostics.push({ code }) },
    );
    const pending = never.onNativeState('BACKGROUND');
    await vi.advanceTimersByTimeAsync(251);
    await pending;
    expect(diagnostics.some((item) => item.code === 'LIFECYCLE_SNAPSHOT_TIMEOUT')).toBe(true);
    vi.useRealTimers();
  });
});
