import type {
  BootDiagnosticSnapshot,
  BootEvent,
  BootState,
  BootStep,
  BootTerminalStep,
} from './boot-types';

const NEXT_STEP = {
  BOOT_NATIVE: 'BOOT_WEB',
  BOOT_WEB: 'LOAD_SETTINGS',
  LOAD_SETTINGS: 'VALIDATE_CONTENT',
  VALIDATE_CONTENT: 'LOAD_SAVE',
} as const satisfies Partial<Record<BootStep, BootStep>>;

export function createInitialBootState(monotonicMs: number): BootState {
  return {
    step: 'BOOT_NATIVE',
    enteredAtMonotonicMs: monotonicMs,
    retryCount: 0,
    failure: null,
    sequence: 0,
  };
}

function isTerminal(step: BootStep): step is BootTerminalStep {
  return (
    step === 'RECOVERY_REQUIRED' ||
    step === 'FIRST_RUN' ||
    step === 'TITLE'
  );
}

function move(
  state: BootState,
  step: BootStep,
  monotonicMs: number,
  options?: {
    readonly failure?: BootState['failure'];
    readonly retryCount?: number;
  },
): BootState {
  return {
    step,
    enteredAtMonotonicMs: monotonicMs,
    retryCount: options?.retryCount ?? state.retryCount,
    failure: options?.failure ?? null,
    sequence: state.sequence + 1,
  };
}

function failToRecovery(
  state: BootState,
  event: Extract<BootEvent, { type: 'STEP_FAILED' | 'STEP_TIMED_OUT' }>,
): BootState {
  if (event.step !== state.step || event.failure.sourceStep !== event.step) {
    return state;
  }
  return move(state, 'RECOVERY_REQUIRED', state.enteredAtMonotonicMs, {
    failure: event.failure,
    retryCount: state.retryCount,
  });
}

export function reduceBootState(
  state: BootState,
  event: BootEvent,
): BootState {
  switch (event.type) {
    case 'STEP_SUCCEEDED': {
      if (event.step !== state.step || isTerminal(state.step)) {
        return state;
      }
      const next = NEXT_STEP[event.step];
      return move(state, next, state.enteredAtMonotonicMs);
    }

    case 'LOAD_SAVE_RESOLVED': {
      if (state.step !== 'LOAD_SAVE') {
        return state;
      }
      switch (event.outcome.kind) {
        case 'recovery':
          return move(
            state,
            'RECOVERY_REQUIRED',
            state.enteredAtMonotonicMs,
            { failure: event.outcome.failure },
          );
        case 'first_run':
          return move(state, 'FIRST_RUN', state.enteredAtMonotonicMs);
        case 'title':
          return move(state, 'TITLE', state.enteredAtMonotonicMs);
      }
      break;
    }

    case 'STEP_FAILED':
    case 'STEP_TIMED_OUT':
      return failToRecovery(state, event);

    case 'RETRY_REQUESTED': {
      if (state.step !== 'RECOVERY_REQUIRED' || state.failure === null) {
        return state;
      }
      return move(state, state.failure.sourceStep, event.monotonicMs, {
        retryCount: state.retryCount + 1,
      });
    }

    case 'RESET_REQUESTED':
      return createInitialBootState(event.monotonicMs);
  }
}

export function toBootDiagnosticSnapshot(
  state: BootState,
): BootDiagnosticSnapshot {
  return {
    step: state.step,
    retryCount: state.retryCount,
    failureCode: state.failure?.code ?? null,
    failureSourceStep: state.failure?.sourceStep ?? null,
    sequence: state.sequence,
  };
}
