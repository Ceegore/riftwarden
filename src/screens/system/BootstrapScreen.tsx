import type { BootStep } from '../../app/boot/boot-types';
import type { PreliminarySystemCopy, SystemCopyKey } from '../../locales/system-copy';

const PHASE_KEYS: Readonly<Record<BootStep, SystemCopyKey>> = {
  BOOT_NATIVE: 'ui.system.boot.phase.native',
  BOOT_WEB: 'ui.system.boot.phase.web',
  LOAD_SETTINGS: 'ui.system.boot.phase.settings',
  VALIDATE_CONTENT: 'ui.system.boot.phase.content',
  LOAD_SAVE: 'ui.system.boot.phase.save',
  RECOVERY_REQUIRED: 'ui.system.recovery.body',
  FIRST_RUN: 'ui.system.boot.title',
  TITLE: 'ui.system.boot.title',
};

export interface BootstrapScreenProps {
  readonly step: BootStep;
  readonly elapsedMs: number;
  readonly copy: PreliminarySystemCopy;
}

export function BootstrapScreen({
  step,
  elapsedMs,
  copy,
}: BootstrapScreenProps) {
  const loadingBand =
    elapsedMs < 150 ? 'instant' : elapsedMs < 2_000 ? 'short' : 'long';

  return (
    <main
      data-screen-id="bootstrap"
      data-loading-band={loadingBand}
      aria-labelledby="bootstrap-title"
      aria-busy="true"
    >
      <h1 id="bootstrap-title">{copy.t('ui.system.boot.title')}</h1>
      {elapsedMs < 150 ? null : <p>{copy.t(PHASE_KEYS[step])}</p>}
      {elapsedMs < 2_000 ? null : (
        <p>{copy.t('ui.system.boot.long_wait')}</p>
      )}
    </main>
  );
}
