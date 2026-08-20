import { SliceError } from './slice-error.js';
import { ROUTES, type Route } from './types.js';

/**
 * E2E route machine (E2E_FLOW_CONTRACT): the vertical slice flows through a
 * closed, ordered route set TITLE -> HQ -> MISSION -> GROUP -> FORMATION ->
 * DUNGEON_MAP -> NODE_PREVIEW -> PREBATTLE -> BATTLE -> RESULT ->
 * REWARD_OR_ANCHOR -> MISSION_END. Transitions are guarded: jumping over
 * routes or replaying completed ones is a hard error; resume targets come
 * from the commit ledger, not from the route order.
 */
export const ROUTE_ORDER: readonly Route[] = ROUTES;

const ROUTE_SET: ReadonlySet<Route> = new Set(ROUTES);

export function isRoute(value: unknown): value is Route {
  return typeof value === 'string' && ROUTE_SET.has(value as Route);
}

export function nextRoute(route: Route): Route {
  const index = ROUTES.indexOf(route);
  if (index === -1) throw new SliceError('INVALID_ROUTE_TRANSITION', { route });
  const next = ROUTES[Math.min(index + 1, ROUTES.length - 1)];
  if (next === undefined) throw new SliceError('INVALID_ROUTE_TRANSITION', { route });
  return next;
}

/** Advances only when `to` is exactly the next route in the closed order. */
export function advanceTo(route: Route, to: Route): Route {
  if (to !== nextRoute(route)) {
    throw new SliceError('INVALID_ROUTE_TRANSITION', { from: route, to });
  }
  return to;
}

/** The forward prefix reachable from a route (the closed flow's allowed tails). */
export function allowedTails(route: Route): readonly Route[] {
  const index = ROUTES.indexOf(route);
  if (index === -1) throw new SliceError('INVALID_ROUTE_TRANSITION', { route });
  return ROUTES.slice(index + 1);
}
