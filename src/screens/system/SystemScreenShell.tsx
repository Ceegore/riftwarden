import type { PreliminarySystemCopy } from '../../locales/system-copy';
import { SystemActionButton } from './SystemActionButton';
import {
  visibleActions,
  type SystemActionModel,
  type SystemScreenModel,
} from './system-screen-model';

export interface SystemScreenShellProps {
  readonly model: SystemScreenModel;
  readonly copy: PreliminarySystemCopy;
  readonly onAction: (action: SystemActionModel) => void;
}

export function SystemScreenShell({
  model,
  copy,
  onAction,
}: SystemScreenShellProps) {
  return (
    <main
      data-screen-id={model.screenId}
      data-screen-status={model.status}
      aria-labelledby="system-screen-title"
    >
      <section>
        <h1 id="system-screen-title">{copy.t(model.titleKey)}</h1>
        <p>{copy.t(model.bodyKey)}</p>
        {model.errorCode === null ? null : (
          <p>
            <span>{copy.t('ui.system.error.code_label')}:</span>{' '}
            <code>{model.errorCode}</code>
          </p>
        )}
        <nav aria-label={copy.t(model.titleKey)}>
          {visibleActions(model).map((action) => (
            <SystemActionButton
              key={action.id}
              action={action}
              copy={copy}
              onAction={onAction}
            />
          ))}
        </nav>
      </section>
    </main>
  );
}
