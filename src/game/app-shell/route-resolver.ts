/**
 * Phase 30 route resolver (APP_SHELL_ROUTE_CONTRACT): routes are versioned
 * serializable data. Boot resolution picks the first screen from validated
 * save state (fresh install -> first-run, corrupt -> recovery, otherwise title).
 * Unknown route values fall back to title/recovery deterministically — never a
 * blank screen. Every transition carries an optional return route and initial
 * focus id so Back and modal restore behave deterministically.
 */
import { AppShellError } from './app-shell-error.js';
import { ROUTE_IDS, type RouteId, type RouteState } from './types.js';

export const ROUTE_VERSION = 1 as const;

export type BootState = 'fresh' | 'valid-profile' | 'valid-run' | 'valid-battle' | 'corrupt';

/** Boot resolution per the canonical app-shell state model. */
export function resolveBoot(state: BootState): RouteState {
  if (state === 'fresh') return { version: ROUTE_VERSION, id: 'first-run' };
  if (state === 'corrupt') return { version: ROUTE_VERSION, id: 'recovery' };
  return { version: ROUTE_VERSION, id: 'title' };
}

export function isRouteId(value: unknown): value is RouteId {
  return typeof value === 'string' && (ROUTE_IDS as readonly string[]).includes(value);
}

/**
 * Parses an unknown route value into a RouteState. Unknown ids resolve to the
 * title route (never a blank screen); malformed payloads also fall back. A
 * non-title fallback is available for recovery-sensitive flows.
 */
export function safeRoute(value: unknown): RouteState {
  if (typeof value !== 'object' || value === null) return { version: ROUTE_VERSION, id: 'title' };
  const id = (value as { id?: unknown }).id;
  if (typeof id !== 'string' || !isRouteId(id)) return { version: ROUTE_VERSION, id: 'title' };
  const record = value as { returnTo?: unknown; focusId?: unknown };
  const returnTo = typeof record.returnTo === 'string' && isRouteId(record.returnTo) ? record.returnTo : undefined;
  const focusId = typeof record.focusId === 'string' && record.focusId.length > 0 ? record.focusId : undefined;
  return { version: ROUTE_VERSION, id, ...(returnTo !== undefined ? { returnTo } : {}), ...(focusId !== undefined ? { focusId } : {}) };
}

/** Strict variant: unknown route ids throw instead of silently falling back. */
export function parseRoute(value: unknown): RouteState {
  const state = safeRoute(value);
  if (state.id === 'title' && value !== null && typeof value === 'object') {
    const id = (value as { id?: unknown }).id;
    if (typeof id === 'string' && id !== 'title' && !isRouteId(id)) {
      throw new AppShellError('UNKNOWN_ROUTE_ID', { id });
    }
  }
  return state;
}

/** Serializes a RouteState to JSON-serializable form (no undefined members). */
export function serializeRoute(state: RouteState): Record<string, string | number> {
  const out: Record<string, string | number> = { version: state.version, id: state.id };
  if (state.returnTo !== undefined) out['returnTo'] = state.returnTo;
  if (state.focusId !== undefined) out['focusId'] = state.focusId;
  return out;
}
