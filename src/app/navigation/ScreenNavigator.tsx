/**
 * Screen navigator (SCREEN_NAVIGATOR_CONTRACT): renders the React component
 * for the current route by looking it up in the module map. All run screen
 * modules are statically imported — no async resolution needed during render.
 */
import type { JSX } from 'react';
import type { AppRoute } from './route-types.js';
import type { RoutableScreenKey } from './screen-id.js';
import { runScreenModules } from '../../screens/run/screen-modules.js';
import { getScreenRegistration } from './screen-registry.js';

const MODULES = runScreenModules as Record<string, { readonly default: (props: Record<string, unknown>) => JSX.Element }>;

function componentForRoute(route: AppRoute): ((props: Record<string, unknown>) => JSX.Element) | null {
  const reg = getScreenRegistration(route.screenKey);
  if (!reg) return null;
  const mod = MODULES[reg.loaderId];
  if (!mod) return null;
  return mod.default;
}

export function ScreenNavigator({ route }: { readonly route: AppRoute }): JSX.Element {
  const Component = componentForRoute(route);
  if (!Component) {
    return <p>Screen not found: {route.screenKey}</p>;
  }
  return <Component />;
}

/**
 * Build an AppRoute for a screen key. Used to construct navigation targets.
 */
export function routeFor(screenKey: RoutableScreenKey): AppRoute {
  return { screenKey, params: {} };
}

/**
 * Resolves which loaderId a screen key maps to (for use by parent code).
 */
export function resolveScreenComponent(screenKey: string): ((props: Record<string, unknown>) => JSX.Element) | null {
  const reg = getScreenRegistration(screenKey);
  if (!reg) return null;
  const mod = MODULES[reg.loaderId];
  return mod?.default ?? null;
}
