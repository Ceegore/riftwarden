import { Component, type ErrorInfo, type ReactNode } from 'react';
import type { PreliminarySystemCopy } from '../locales/system-copy';
import { FatalErrorScreen } from '../screens/system/FatalErrorScreen';
import type { SystemActionModel } from '../screens/system/system-screen-model';

export interface AppErrorBoundaryProps {
  readonly children: ReactNode;
  readonly copy: PreliminarySystemCopy;
  readonly recordError: (error: unknown, info: ErrorInfo) => void;
  readonly onAction: (action: SystemActionModel) => void;
}

interface AppErrorBoundaryState {
  readonly failed: boolean;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  public override state: AppErrorBoundaryState = { failed: false };

  public static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.recordError(error, info);
  }

  public override render(): ReactNode {
    if (this.state.failed) {
      return (
        <FatalErrorScreen
          errorCode="UNEXPECTED_APP_ERROR"
          copy={this.props.copy}
          canViewDiagnostics={true}
          onAction={this.props.onAction}
        />
      );
    }
    return this.props.children;
  }
}
