import type { JSX } from 'react';
import type { AppRoute } from './route-types.js';
import { renderRegisteredRoute } from '../../screens/screen-renderer.js';

export function ScreenNavigator({ route }: { readonly route: AppRoute }): JSX.Element {
  try {
    return renderRegisteredRoute(route);
  } catch {
    return <p>Screen not found: {route.screenKey}</p>;
  }
}
