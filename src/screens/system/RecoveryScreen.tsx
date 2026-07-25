import type { PreliminarySystemCopy } from '../../locales/system-copy';
import { SystemScreenShell } from './SystemScreenShell';
import type {
  SystemActionModel,
  SystemScreenModel,
} from './system-screen-model';

export interface RecoveryCapabilities {
  readonly canRetry: boolean;
  readonly canSafeRestart: boolean;
  readonly canViewDiagnostics: boolean;
  readonly canExportDiagnostics: boolean;
  readonly canLoadBackup: boolean;
}

export interface RecoveryScreenProps {
  readonly errorCode: string;
  readonly capabilities: RecoveryCapabilities;
  readonly copy: PreliminarySystemCopy;
  readonly onAction: (action: SystemActionModel) => void;
}

export function RecoveryScreen({
  errorCode,
  capabilities,
  copy,
  onAction,
}: RecoveryScreenProps) {
  const model: SystemScreenModel = {
    screenId: 'recovery',
    status: 'recoverable_error',
    titleKey: 'ui.system.recovery.title',
    bodyKey: 'ui.system.recovery.body',
    errorCode,
    actions: [
      {
        id: 'retry_boot_step',
        labelKey: 'ui.system.action.retry',
        available: capabilities.canRetry,
      },
      {
        id: 'safe_restart',
        labelKey: 'ui.system.action.safe_restart',
        available: capabilities.canSafeRestart,
      },
      {
        id: 'open_diagnostics_summary',
        labelKey: 'ui.system.action.diagnostics',
        available: capabilities.canViewDiagnostics,
      },
      {
        id: 'export_diagnostics',
        labelKey: 'ui.system.action.diagnostics',
        available: capabilities.canExportDiagnostics,
        reasonUnavailable: 'Owner phase 24',
      },
      {
        id: 'load_backup',
        labelKey: 'ui.system.action.continue',
        available: capabilities.canLoadBackup,
        reasonUnavailable: 'Owner phase 24',
      },
    ],
  };

  return <SystemScreenShell model={model} copy={copy} onAction={onAction} />;
}
