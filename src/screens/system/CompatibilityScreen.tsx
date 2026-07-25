import type { PreliminarySystemCopy } from '../../locales/system-copy';
import { SystemScreenShell } from './SystemScreenShell';
import type {
  SystemActionModel,
  SystemScreenModel,
} from './system-screen-model';

export interface CompatibilityScreenProps {
  readonly errorCode: 'WEBGL_UNAVAILABLE' | 'WEBGL_RESTORE_EXHAUSTED';
  readonly copy: PreliminarySystemCopy;
  readonly canViewDiagnostics: boolean;
  readonly onAction: (action: SystemActionModel) => void;
}

export function CompatibilityScreen({
  errorCode,
  copy,
  canViewDiagnostics,
  onAction,
}: CompatibilityScreenProps) {
  const model: SystemScreenModel = {
    screenId: 'compatibility',
    status: 'blocked',
    titleKey: 'ui.system.compatibility.title',
    bodyKey: 'ui.system.compatibility.body',
    errorCode,
    actions: [
      {
        id: 'safe_restart',
        labelKey: 'ui.system.action.safe_restart',
        available: true,
      },
      {
        id: 'open_diagnostics_summary',
        labelKey: 'ui.system.action.diagnostics',
        available: canViewDiagnostics,
      },
    ],
  };

  return <SystemScreenShell model={model} copy={copy} onAction={onAction} />;
}
