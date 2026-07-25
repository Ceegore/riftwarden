import { appRouteSchema, countReturnDepth } from './route-schema';
import type { AppRoute, DecodeRouteResult, RouteDiagnostic } from './route-types';
import { getScreenRegistration } from './screen-registry';

const MAX_RETURN_DEPTH = 8;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, canonicalize((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

function validateRegistryRoute(route: AppRoute): RouteDiagnostic | null {
  const registration = getScreenRegistration(route.screenKey);
  if (registration?.kind !== 'screen') {
    return { code: 'NAV_UNKNOWN_SCREEN', detail: route.screenKey };
  }
  if (countReturnDepth(route) > MAX_RETURN_DEPTH) return { code: 'NAV_RETURN_DEPTH' };
  return null;
}

export function encodeRoute(route: AppRoute): string {
  const parsed = appRouteSchema.parse(route);
  const diagnostic = validateRegistryRoute(parsed);
  if (diagnostic) throw new Error(diagnostic.code);
  return `${JSON.stringify(canonicalize(parsed), null, 2)}\n`;
}

export function decodeRoute(serialized: string, safeFallback: AppRoute): DecodeRouteResult {
  try {
    const parsed = appRouteSchema.parse(JSON.parse(serialized));
    const diagnostic = validateRegistryRoute(parsed);
    if (diagnostic) return { ok: false, route: safeFallback, diagnostic };
    return { ok: true, route: parsed };
  } catch {
    return {
      ok: false,
      route: safeFallback,
      diagnostic: { code: 'NAV_ROUTE_NOT_SERIALIZABLE' },
    };
  }
}
