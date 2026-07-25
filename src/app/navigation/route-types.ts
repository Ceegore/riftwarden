import type { RoutableScreenKey } from './screen-id';

export type RouteParam = string | number | boolean;

export interface AppRoute {
  readonly screenKey: RoutableScreenKey;
  readonly params: Readonly<Record<string, RouteParam>>;
  readonly returnRoute?: AppRoute;
  readonly restoreToken?: string;
}

export interface RouteDiagnostic {
  readonly code:
    | 'NAV_UNKNOWN_SCREEN'
    | 'NAV_PARAM_UNKNOWN'
    | 'NAV_PARAM_MISSING'
    | 'NAV_PARAM_TYPE'
    | 'NAV_PARAM_NON_PRIMITIVE'
    | 'NAV_RETURN_DEPTH'
    | 'NAV_ROUTE_NOT_SERIALIZABLE';
  readonly detail?: string;
}

export type DecodeRouteResult =
  | { readonly ok: true; readonly route: AppRoute }
  | { readonly ok: false; readonly route: AppRoute; readonly diagnostic: RouteDiagnostic };
