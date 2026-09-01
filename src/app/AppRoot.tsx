import {
  Suspense,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactElement,
} from 'react';
import { SplashScreen } from '@capacitor/splash-screen';
import { AppErrorBoundary } from './AppErrorBoundary';
import {
  createInitialBootState,
  reduceBootState,
} from './boot/boot-state';
import type {
  BootEvent,
  BootState,
  BootTerminalStep,
} from './boot/boot-types';
import type { PreliminarySystemCopy } from '../locales/system-copy';
import { BootstrapScreen } from '../screens/system/BootstrapScreen';
import { RecoveryScreen } from '../screens/system/RecoveryScreen';
import type { SystemActionModel } from '../screens/system/system-screen-model';

export interface AppRootProps {
  readonly copy: PreliminarySystemCopy;
  readonly monotonicNow: () => number;
  readonly subscribeBootEvents: (
    state: BootState,
    dispatch: (event: BootEvent) => void,
  ) => () => void;
  readonly renderTerminal: (step: Exclude<BootTerminalStep, 'RECOVERY_REQUIRED'>) => ReactElement;
  readonly recordBoundaryError: (error: unknown) => void;
}

export function AppRoot({
  copy,
  monotonicNow,
  subscribeBootEvents,
  renderTerminal,
  recordBoundaryError,
}: AppRootProps) {
  const [boot, dispatch] = useReducer(
    reduceBootState,
    monotonicNow(),
    createInitialBootState,
  );
  const [stableFrameCommitted, setStableFrameCommitted] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => subscribeBootEvents(boot, dispatch), [boot, subscribeBootEvents]);

  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      setStableFrameCommitted(true);
    });
    return () => {
      cancelAnimationFrame(handle);
    };
  }, []);

  useEffect(() => {
    if (!stableFrameCommitted) {
      return;
    }
    void SplashScreen.hide();
  }, [stableFrameCommitted]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedMs(Math.max(0, monotonicNow() - boot.enteredAtMonotonicMs));
    }, 100);
    return () => {
      window.clearInterval(timer);
    };
  }, [boot.enteredAtMonotonicMs, monotonicNow]);

  // Handle system actions (retry/restart) by dispatching to the boot reducer.
  const onSystemAction = useMemo(() => {
    const now = monotonicNow();
    return (action: SystemActionModel): void => {
      switch (action.id) {
        case 'retry_boot_step':
          dispatch({ type: 'RETRY_REQUESTED', monotonicMs: now });
          break;
        case 'safe_restart':
          dispatch({ type: 'RESET_REQUESTED', monotonicMs: now });
          break;
        case 'continue':
        case 'open_diagnostics_summary':
        case 'export_diagnostics':
        case 'load_backup':
        case 'repair_save':
        case 'resume_battle':
          break;
      }
    };
  }, [monotonicNow]);

  const content = useMemo(() => {
    if (boot.step === 'RECOVERY_REQUIRED') {
      return (
        <RecoveryScreen
          errorCode={boot.failure?.code ?? 'UNEXPECTED_APP_ERROR'}
          capabilities={{
            canRetry: boot.failure?.recoverable ?? false,
            canSafeRestart: true,
            canViewDiagnostics: true,
            canExportDiagnostics: false,
            canLoadBackup: false,
          }}
          copy={copy}
          onAction={onSystemAction}
        />
      );
    }
    if (boot.step === 'FIRST_RUN' || boot.step === 'TITLE') {
      return renderTerminal(boot.step);
    }
    return <BootstrapScreen step={boot.step} elapsedMs={elapsedMs} copy={copy} />;
  }, [boot, copy, elapsedMs, onSystemAction, renderTerminal]);

  return (
    <AppErrorBoundary
      copy={copy}
      recordError={(error) => {
        recordBoundaryError(error);
      }}
      onAction={onSystemAction}
    >
      <Suspense
        fallback={
          <BootstrapScreen
            step={boot.step}
            elapsedMs={elapsedMs}
            copy={copy}
          />
        }
      >
        {content}
      </Suspense>
    </AppErrorBoundary>
  );
}
