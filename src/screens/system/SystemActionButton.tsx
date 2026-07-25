import type { SystemActionModel } from './system-screen-model';
import type { PreliminarySystemCopy } from '../../locales/system-copy';

export interface SystemActionButtonProps {
  readonly action: SystemActionModel;
  readonly copy: PreliminarySystemCopy;
  readonly onAction: (action: SystemActionModel) => void;
}

export function SystemActionButton({
  action,
  copy,
  onAction,
}: SystemActionButtonProps) {
  if (!action.available) {
    return null;
  }

  return (
    <button
      type="button"
      data-action-id={action.id}
      onClick={() => {
        onAction(action);
      }}
    >
      {copy.t(action.labelKey)}
    </button>
  );
}
