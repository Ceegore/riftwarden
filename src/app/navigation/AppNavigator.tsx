import type { ReactNode } from 'react';
import type { AppRoute } from './route-types';
import type { ScreenModuleResolver } from './screen-registration';
import { loadScreenModule } from './screen-registry';

export interface AppNavigatorProps {
  readonly route: AppRoute;
  readonly resolver: ScreenModuleResolver;
  readonly renderLoading: () => ReactNode;
  readonly renderError: (code: string) => ReactNode;
  readonly renderResolved: (component: unknown, route: AppRoute) => ReactNode;
}

export async function AppNavigator(props: AppNavigatorProps): Promise<ReactNode> {
  try {
    const component = await loadScreenModule(props.route.screenKey, props.resolver);
    return await props.renderResolved(component, props.route);
  } catch {
    return props.renderError('NAV_UNKNOWN_SCREEN');
  }
}
