import type { SystemCopyKey } from '../../locales/system-copy';

export type SemanticSystemScreenId =
  | 'bootstrap'
  | 'recovery'
  | 'compatibility'
  | 'resume_summary'
  | 'fatal_error';

export type SystemScreenStatus =
  | 'loading'
  | 'ready'
  | 'blocked'
  | 'recoverable_error'
  | 'fatal_error';

export type SystemActionId =
  | 'retry_boot_step'
  | 'safe_restart'
  | 'continue'
  | 'open_diagnostics_summary'
  | 'export_diagnostics'
  | 'load_backup'
  | 'repair_save'
  | 'resume_battle';

export interface SystemActionModel {
  readonly id: SystemActionId;
  readonly labelKey: SystemCopyKey;
  readonly available: boolean;
  readonly reasonUnavailable?: string;
}

export interface SystemScreenModel {
  readonly screenId: SemanticSystemScreenId;
  readonly status: SystemScreenStatus;
  readonly titleKey: SystemCopyKey;
  readonly bodyKey: SystemCopyKey;
  readonly errorCode: string | null;
  readonly actions: readonly SystemActionModel[];
}

export function visibleActions(
  model: SystemScreenModel,
): readonly SystemActionModel[] {
  return model.actions.filter((action) => action.available);
}
