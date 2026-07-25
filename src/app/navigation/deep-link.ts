import type { AppRoute } from './route-types';

export interface ApprovedDeepLink {
  readonly destination: string;
  readonly routeFactory: () => AppRoute;
}

export interface DeepLinkContract {
  readonly scheme: 'riftwarden';
  readonly approved: boolean;
  readonly destinations: readonly ApprovedDeepLink[];
}

export function resolveDeepLink(raw: string, contract: DeepLinkContract): AppRoute {
  if (!contract.approved) throw new Error('NAV_DEEP_LINK_ALLOWLIST_UNAPPROVED');
  const url = new URL(raw);
  if (url.protocol !== `${contract.scheme}:` || url.search || url.hash) {
    throw new Error('NAV_INVALID_DEEP_LINK');
  }
  const destination = url.hostname || url.pathname.replace(/^\/+/u, '');
  const match = contract.destinations.find((entry) => entry.destination === destination);
  if (!match) throw new Error('NAV_INVALID_DEEP_LINK');
  return match.routeFactory();
}
