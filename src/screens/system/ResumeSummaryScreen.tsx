import type { PreliminarySystemCopy } from '../../locales/system-copy';
import { SystemScreenShell } from './SystemScreenShell';
import type {
  SystemActionModel,
  SystemScreenModel,
} from './system-screen-model';

export interface ResumeSummaryScreenProps {
  readonly copy: PreliminarySystemCopy;
  readonly canContinue: boolean;
  readonly onAction: (action: SystemActionModel) => void;
}

export function ResumeSummaryScreen({
  copy,
  canContinue,
  onAction,
}: ResumeSummaryScreenProps) {
  const model: SystemScreenModel = {
    screenId: 'resume_summary',
    status: canContinue ? 'ready' : 'blocked',
    titleKey: 'ui.system.resume.title',
    bodyKey: 'ui.system.resume.body',
    errorCode: null,
    actions: [
      {
        id: 'continue',
        labelKey: 'ui.system.action.continue',
        available: canContinue,
      },
    ],
  };

  return <SystemScreenShell model={model} copy={copy} onAction={onAction} />;
}
