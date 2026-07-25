import type { PreliminarySystemCopy } from '../../locales/system-copy';
import { SystemScreenShell } from './SystemScreenShell';
import type {
  SystemActionModel,
  SystemScreenModel,
} from './system-screen-model';

export interface FatalErrorScreenProps {
  readonly errorCode: string;
  readonly copy: PreliminarySystemCopy;
  readonly canViewDiagnostics: boolean;
  readonly onAction: (action: SystemActionModel) => void;
}

export function FatalErrorScreen({
  errorCode,
  copy,
  canViewDiagnostics,
  onAction,
}: FatalErrorScreenProps) {
  const model: SystemScreenModel = {
    screenId: 'fatal_error',
    status: 'fatal_error',
    titleKey: 'ui.system.fatal.title',
    bodyKey: 'ui.system.fatal.body',
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
