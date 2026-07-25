export const SYSTEM_COPY_KEYS = [
  'ui.system.boot.title',
  'ui.system.boot.phase.native',
  'ui.system.boot.phase.web',
  'ui.system.boot.phase.settings',
  'ui.system.boot.phase.content',
  'ui.system.boot.phase.save',
  'ui.system.boot.long_wait',
  'ui.system.action.retry',
  'ui.system.action.safe_restart',
  'ui.system.action.continue',
  'ui.system.action.diagnostics',
  'ui.system.recovery.title',
  'ui.system.recovery.body',
  'ui.system.compatibility.title',
  'ui.system.compatibility.body',
  'ui.system.fatal.title',
  'ui.system.fatal.body',
  'ui.system.resume.title',
  'ui.system.resume.body',
  'ui.system.error.code_label',
] as const;

export type SystemCopyKey = (typeof SYSTEM_COPY_KEYS)[number];
export type PreliminaryLocale = 'de' | 'en' | 'pseudo';

export type SystemCopyBundle = Readonly<Record<SystemCopyKey, string>>;

export interface PreliminarySystemCopy {
  readonly locale: PreliminaryLocale;
  t(key: SystemCopyKey): string;
}
