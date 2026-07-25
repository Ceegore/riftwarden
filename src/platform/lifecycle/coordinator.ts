import type {
  AppLifecycleState,
  LifecycleCounters,
  LifecycleDiagnosticSink,
  LifecycleHooks,
} from './lifecycle-types';

const MEMORY_SNAPSHOT_BUDGET_MS = 250;

function withDeadline(
  operation: Promise<void>,
  deadlineMs: number,
): Promise<'completed' | 'timed_out' | 'failed'> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve('timed_out');
      }
    }, deadlineMs);

    operation.then(
      () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve('completed');
        }
      },
      () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve('failed');
        }
      },
    );
  });
}

function countersEqual(
  left: LifecycleCounters,
  right: LifecycleCounters,
): boolean {
  return (
    left.simulationTicks === right.simulationTicks &&
    left.renderFrames === right.renderFrames &&
    left.inputDispatches === right.inputDispatches &&
    left.audioFrames === right.audioFrames
  );
}

export class LifecycleCoordinator {
  private state: AppLifecycleState = 'ACTIVE';
  private backgroundBaseline: LifecycleCounters | null = null;

  public constructor(
    private readonly hooks: LifecycleHooks,
    private readonly diagnostics: LifecycleDiagnosticSink,
  ) {}

  public getState(): AppLifecycleState {
    return this.state;
  }

  public async onNativeState(next: AppLifecycleState): Promise<void> {
    if (next === this.state) {
      return;
    }

    switch (next) {
      case 'ACTIVE':
        await this.enterActive();
        return;
      case 'INACTIVE_TRANSITION':
        this.enterInactiveTransition();
        return;
      case 'BACKGROUND':
        await this.enterBackground();
        return;
      case 'TERMINATING_UNKNOWN':
        this.state = 'TERMINATING_UNKNOWN';
        await this.enterBackground();
        this.state = 'TERMINATING_UNKNOWN';
        return;
    }
  }

  private enterInactiveTransition(): void {
    if (this.state === 'BACKGROUND' || this.state === 'TERMINATING_UNKNOWN') {
      return;
    }
    this.state = 'INACTIVE_TRANSITION';
    this.hooks.pauseSimulationAtConfirmedTick();
  }

  private async enterBackground(): Promise<void> {
    if (this.state === 'BACKGROUND') {
      return;
    }

    this.state = 'INACTIVE_TRANSITION';
    this.hooks.pauseSimulationAtConfirmedTick();

    const snapshotResult = await withDeadline(
      this.hooks.requestMemorySnapshot(),
      MEMORY_SNAPSHOT_BUDGET_MS,
    );
    if (snapshotResult !== 'completed') {
      this.diagnostics.record('LIFECYCLE_SNAPSHOT_TIMEOUT', {
        result: snapshotResult,
        budgetMs: MEMORY_SNAPSHOT_BUDGET_MS,
      });
    }

    await this.hooks.fadeAndPauseAudio();
    await this.hooks.stopRenderer();
    await this.hooks.stopInput();

    this.state = 'BACKGROUND';
    this.backgroundBaseline = this.hooks.readCounters();
  }

  private async enterActive(): Promise<void> {
    if (this.state === 'ACTIVE') {
      return;
    }

    if (
      this.backgroundBaseline !== null &&
      !countersEqual(this.backgroundBaseline, this.hooks.readCounters())
    ) {
      this.diagnostics.record('BACKGROUND_ACTIVITY_DETECTED', {
        simulationTicks: this.hooks.readCounters().simulationTicks,
        renderFrames: this.hooks.readCounters().renderFrames,
      });
    }

    await this.hooks.restoreRendererCapability();
    await this.hooks.restoreAudioCapability();
    await this.hooks.restoreInputCapability();
    this.hooks.showPausedResumeUi();

    this.backgroundBaseline = null;
    this.state = 'ACTIVE';
  }
}
