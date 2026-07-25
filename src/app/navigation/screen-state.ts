export type ScreenStatus =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'blocked'
  | 'recoverable_error'
  | 'fatal_error';

export interface ScreenState<TData> {
  readonly status: ScreenStatus;
  readonly data: TData | null;
  readonly errorCode: string | null;
  readonly blockReasonKey: string | null;
  readonly pendingTransactionId: string | null;
}

export function canCommit(state: ScreenState<unknown>): boolean {
  return state.status === 'ready' && state.pendingTransactionId === null;
}
