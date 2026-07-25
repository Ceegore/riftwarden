import type { BootStep, BootTerminalStep } from './boot-types';

type RunnableBootStep = Exclude<BootStep, BootTerminalStep>;

export interface BootStepPolicy {
  readonly timeoutMs: number;
  readonly maxAutomaticRetries: number;
}

export const BOOT_STEP_POLICIES: Readonly<
  Record<RunnableBootStep, BootStepPolicy>
> = {
  BOOT_NATIVE: { timeoutMs: 5_000, maxAutomaticRetries: 1 },
  BOOT_WEB: { timeoutMs: 5_000, maxAutomaticRetries: 1 },
  LOAD_SETTINGS: { timeoutMs: 3_000, maxAutomaticRetries: 1 },
  VALIDATE_CONTENT: { timeoutMs: 10_000, maxAutomaticRetries: 0 },
  LOAD_SAVE: { timeoutMs: 10_000, maxAutomaticRetries: 0 },
};

export function getBootStepPolicy(step: RunnableBootStep): BootStepPolicy {
  return BOOT_STEP_POLICIES[step];
}
