import type { AppRoute } from './route-types.js';
import type { RoutableScreenKey } from './screen-id.js';
import { resolveRegisteredScreen } from '../../screens/screen-renderer.js';

export function routeFor(screenKey: RoutableScreenKey): AppRoute {
  return { screenKey, params: {} };
}

export function resolveScreenComponent(screenKey: string) {
  return resolveRegisteredScreen(screenKey);
}
