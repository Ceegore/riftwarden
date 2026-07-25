import { getBootStepPolicy } from './boot-timeouts';
import type {
  BootErrorCode,
  BootEvent,
  BootFailure,
  BootState,
  LoadSaveOutcome,
} from './boot-types';

export interface BootServices {
  readonly bootNative: (signal: AbortSignal) => Promise<void>;
  readonly bootWeb: (signal: AbortSignal) => Promise<void>;
  readonly loadSettings: (signal: AbortSignal) => Promise<void>;
  readonly validateContent: (signal: AbortSignal) => Promise<void>;
  readonly loadSave: (signal: AbortSignal) => Promise<LoadSaveOutcome>;
}

export interface MonotonicClock {
  now(): number;
}

function defaultFailure(
  state: BootState,
  code: BootErrorCode,
  recoverable: boolean,
): BootFailure {
  if (
    state.step === 'RECOVERY_REQUIRED' ||
    state.step === 'FIRST_RUN' ||
    state.step === 'TITLE'
  ) {
    throw new Error('Terminal boot state cannot create a step failure.');
  }
  return {
    code,
    sourceStep: state.step,
    recoverable,
    safeContext: {},
  };
}

const FAILURE_CODES = {
  BOOT_NATIVE: ['BOOT_NATIVE_UNAVAILABLE', true],
  BOOT_WEB: ['BOOT_WEB_FAILED', false],
  LOAD_SETTINGS: ['SETTINGS_LOAD_FAILED', true],
  VALIDATE_CONTENT: ['CONTENT_INVALID', false],
  LOAD_SAVE: ['SAVE_INVALID', true],
} as const;

export async function runCurrentBootStep(
  state: BootState,
  services: BootServices,
  clock: MonotonicClock,
): Promise<BootEvent | null> {
  if (
    state.step === 'RECOVERY_REQUIRED' ||
    state.step === 'FIRST_RUN' ||
    state.step === 'TITLE'
  ) {
    return null;
  }

  const policy = getBootStepPolicy(state.step);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('BOOT_STEP_TIMEOUT'));
      }, policy.timeoutMs);
    });

    const operation = (() => {
      switch (state.step) {
        case 'BOOT_NATIVE':
          return services.bootNative(controller.signal);
        case 'BOOT_WEB':
          return services.bootWeb(controller.signal);
        case 'LOAD_SETTINGS':
          return services.loadSettings(controller.signal);
        case 'VALIDATE_CONTENT':
          return services.validateContent(controller.signal);
        case 'LOAD_SAVE':
          return services.loadSave(controller.signal);
      }
    })();

    const result = await Promise.race([operation, timeout]);
    if (state.step === 'LOAD_SAVE') {
      return {
        type: 'LOAD_SAVE_RESOLVED',
        outcome: result as LoadSaveOutcome,
      };
    }
    return { type: 'STEP_SUCCEEDED', step: state.step };
  } catch (error: unknown) {
    const [code, recoverable] = FAILURE_CODES[state.step];
    const failure = defaultFailure(state, code, recoverable);
    return {
      type:
        error instanceof Error && error.message === 'BOOT_STEP_TIMEOUT'
          ? 'STEP_TIMED_OUT'
          : 'STEP_FAILED',
      step: state.step,
      failure: {
        ...failure,
        safeContext: { elapsedMs: Math.max(0, clock.now() - state.enteredAtMonotonicMs) },
      },
    };
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
