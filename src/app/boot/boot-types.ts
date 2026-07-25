export const BOOT_STEPS = [
  'BOOT_NATIVE',
  'BOOT_WEB',
  'LOAD_SETTINGS',
  'VALIDATE_CONTENT',
  'LOAD_SAVE',
  'RECOVERY_REQUIRED',
  'FIRST_RUN',
  'TITLE',
] as const;

export type BootStep = (typeof BOOT_STEPS)[number];

export const BOOT_TERMINAL_STEPS = [
  'RECOVERY_REQUIRED',
  'FIRST_RUN',
  'TITLE',
] as const;

export type BootTerminalStep = (typeof BOOT_TERMINAL_STEPS)[number];

export type BootErrorCode =
  | 'BOOT_NATIVE_UNAVAILABLE'
  | 'BOOT_WEB_FAILED'
  | 'SETTINGS_LOAD_FAILED'
  | 'CONTENT_NOT_AVAILABLE'
  | 'CONTENT_INVALID'
  | 'SAVE_NOT_AVAILABLE'
  | 'SAVE_INVALID'
  | 'UNEXPECTED_APP_ERROR';

export interface BootFailure {
  readonly code: BootErrorCode;
  readonly sourceStep: Exclude<BootStep, BootTerminalStep>;
  readonly recoverable: boolean;
  readonly safeContext: Readonly<Record<string, string | number | boolean>>;
}

export interface BootState {
  readonly step: BootStep;
  readonly enteredAtMonotonicMs: number;
  readonly retryCount: number;
  readonly failure: BootFailure | null;
  readonly sequence: number;
}

export type LoadSaveOutcome =
  | { readonly kind: 'recovery'; readonly failure: BootFailure }
  | { readonly kind: 'first_run' }
  | { readonly kind: 'title' };

export type BootEvent =
  | { readonly type: 'STEP_SUCCEEDED'; readonly step: 'BOOT_NATIVE' }
  | { readonly type: 'STEP_SUCCEEDED'; readonly step: 'BOOT_WEB' }
  | { readonly type: 'STEP_SUCCEEDED'; readonly step: 'LOAD_SETTINGS' }
  | { readonly type: 'STEP_SUCCEEDED'; readonly step: 'VALIDATE_CONTENT' }
  | {
      readonly type: 'LOAD_SAVE_RESOLVED';
      readonly outcome: LoadSaveOutcome;
    }
  | {
      readonly type: 'STEP_FAILED';
      readonly step: Exclude<BootStep, BootTerminalStep>;
      readonly failure: BootFailure;
    }
  | {
      readonly type: 'STEP_TIMED_OUT';
      readonly step: Exclude<BootStep, BootTerminalStep>;
      readonly failure: BootFailure;
    }
  | { readonly type: 'RETRY_REQUESTED'; readonly monotonicMs: number }
  | { readonly type: 'RESET_REQUESTED'; readonly monotonicMs: number };

export interface BootDiagnosticSnapshot {
  readonly step: BootStep;
  readonly retryCount: number;
  readonly failureCode: BootErrorCode | null;
  readonly failureSourceStep: BootFailure['sourceStep'] | null;
  readonly sequence: number;
}
