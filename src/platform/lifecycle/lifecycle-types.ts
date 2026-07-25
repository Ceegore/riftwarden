export const APP_LIFECYCLE_STATES = [
  'ACTIVE',
  'INACTIVE_TRANSITION',
  'BACKGROUND',
  'TERMINATING_UNKNOWN',
] as const;

export type AppLifecycleState = (typeof APP_LIFECYCLE_STATES)[number];

export interface LifecycleCounters {
  readonly simulationTicks: number;
  readonly renderFrames: number;
  readonly inputDispatches: number;
  readonly audioFrames: number;
}

export interface LifecycleHooks {
  readonly pauseSimulationAtConfirmedTick: () => void;
  readonly requestMemorySnapshot: () => Promise<void>;
  readonly fadeAndPauseAudio: () => Promise<void> | void;
  readonly stopRenderer: () => Promise<void> | void;
  readonly stopInput: () => Promise<void> | void;
  readonly restoreRendererCapability: () => Promise<void>;
  readonly restoreAudioCapability: () => Promise<void>;
  readonly restoreInputCapability: () => Promise<void>;
  readonly showPausedResumeUi: () => void;
  readonly readCounters: () => LifecycleCounters;
}

export interface LifecycleDiagnosticSink {
  readonly record: (
    code: string,
    context: Readonly<Record<string, string | number | boolean>>,
  ) => void;
}
