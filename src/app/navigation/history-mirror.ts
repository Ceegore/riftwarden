import type { AppRoute } from './route-types';

export interface HistoryMirrorState {
  readonly navigationRevision: number;
  readonly routeSnapshot: string;
}

export interface BrowserHistoryPort {
  pushState(state: HistoryMirrorState): void;
  replaceState(state: HistoryMirrorState): void;
  subscribePopState(handler: (state: unknown) => void): () => void;
}

export interface HistoryMirrorCallbacks {
  onValidatedPop(serializedRoute: string, revision: number): void;
  onInvalidPop(): void;
}

export function attachHistoryMirror(
  port: BrowserHistoryPort,
  callbacks: HistoryMirrorCallbacks,
): () => void {
  return port.subscribePopState((raw) => {
    if (
      !raw ||
      typeof raw !== 'object' ||
      typeof (raw as HistoryMirrorState).routeSnapshot !== 'string' ||
      !Number.isInteger((raw as HistoryMirrorState).navigationRevision)
    ) {
      callbacks.onInvalidPop();
      return;
    }
    const state = raw as HistoryMirrorState;
    callbacks.onValidatedPop(state.routeSnapshot, state.navigationRevision);
  });
}

export function mirrorPush(
  port: BrowserHistoryPort,
  route: AppRoute,
  revision: number,
  encode: (route: AppRoute) => string,
): void {
  port.pushState({ navigationRevision: revision, routeSnapshot: encode(route) });
}
