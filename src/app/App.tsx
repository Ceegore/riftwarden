/**
 * App root: wires AppRoot with real boot services, system copy, and the
 * post-boot screen router. The boot sequence cascades through each step
 * automatically — each step's completion dispatches the event that moves
 * the reducer to the next step, which triggers re-subscription and runs
 * the next step. After boot reaches TITLE, the PostBootScreen (expedition
 * map / continue / new game) renders.
 */
import { type ReactElement } from 'react';
import { AppRoot } from './AppRoot';
import { runCurrentBootStep, type BootServices } from './boot/boot-runtime';
import type { BootEvent, BootState, BootTerminalStep } from './boot/boot-types';
import type { PreliminarySystemCopy, SystemCopyKey } from '../locales/system-copy';
import { PostBootScreen } from '../screens/PostBootScreen';

// -- System copy (mock for now; real localization replaces this) -----------
const MOCK_COPY: Record<SystemCopyKey, string> = {
  'ui.system.boot.title': 'Riftwarden',
  'ui.system.boot.phase.native': 'Starting engine…',
  'ui.system.boot.phase.web': 'Loading web layer…',
  'ui.system.boot.phase.settings': 'Loading settings…',
  'ui.system.boot.phase.content': 'Validating content…',
  'ui.system.boot.phase.save': 'Loading save…',
  'ui.system.boot.long_wait': 'This is taking longer than expected…',
  'ui.system.action.retry': 'Retry',
  'ui.system.action.safe_restart': 'Safe restart',
  'ui.system.action.continue': 'Continue',
  'ui.system.action.diagnostics': 'Diagnostics',
  'ui.system.recovery.title': 'Recovery',
  'ui.system.recovery.body': 'Something went wrong during startup.',
  'ui.system.compatibility.title': 'Compatibility',
  'ui.system.compatibility.body': 'Your device may not support this game.',
  'ui.system.fatal.title': 'Fatal Error',
  'ui.system.fatal.body': 'An unexpected error occurred.',
  'ui.system.resume.title': 'Resume',
  'ui.system.resume.body': 'Resuming your game…',
  'ui.system.error.code_label': 'Error',
};

const systemCopy: PreliminarySystemCopy = {
  locale: 'en',
  t(key: SystemCopyKey): string {
    return MOCK_COPY[key] ?? key;
  },
};

// -- Boot services (minimal stubs; real platform adapters replace these) ---
const bootServices: BootServices = {
  async bootNative(_signal): Promise<void> { /* web-only */ },
  async bootWeb(_signal): Promise<void> { /* CSS/fonts already loaded */ },
  async loadSettings(_signal): Promise<void> { /* default settings */ },
  async validateContent(_signal): Promise<void> { /* content revision ok */ },
  async loadSave(_signal) {
    return { kind: 'title' as const };
  },
};

// -- Boot event subscription -----------------------------------------------
function subscribeBootEvents(
  state: BootState,
  dispatch: (event: BootEvent) => void,
): () => void {
  let cancelled = false;
  void runCurrentBootStep(state, bootServices, { now: () => performance.now() })
    .then((event) => {
      if (!cancelled && event !== null) dispatch(event);
    })
    .catch(() => { /* step failure yields a STEP_FAILED event, not a throw */ });
  return () => { cancelled = true; };
}

// -- Terminal screen renderer ----------------------------------------------
function renderTerminal(step: Exclude<BootTerminalStep, 'RECOVERY_REQUIRED'>): ReactElement {
  return <PostBootScreen step={step} />;
}

// -- App component ---------------------------------------------------------
export function App() {
  return (
    <AppRoot
      copy={systemCopy}
      monotonicNow={() => performance.now()}
      subscribeBootEvents={subscribeBootEvents}
      renderTerminal={renderTerminal}
      recordBoundaryError={(error) => { console.error('[AppBoundary]', error); }}
    />
  );
}
