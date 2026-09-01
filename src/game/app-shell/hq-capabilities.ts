/**
 * Phase 30 HQ capability registry (HQ_CAPABILITY_CONTRACT): six areas are
 * registry entries with routeId, labelKey, capability, unlockReasonKey and
 * newMarker. Locked entries must explain their reason and unlock condition —
 * no dead interactive void. Decoration is read-only and never carries domain
 * truth.
 */
import { AppShellError } from './app-shell-error.js';

export type CapabilityState = 'available' | 'locked';

export interface HqArea {
  readonly id: string;
  readonly routeId: string;
  readonly state: CapabilityState;
  readonly labelKey: string;
  readonly reasonKey?: string;
  readonly newMarker?: boolean;
}

export const HQ_AREA_COUNT = 6;

/** Validates a full HQ registry; throws on structural violations. */
export function validateHqAreas(areas: readonly HqArea[]): void {
  if (areas.length !== HQ_AREA_COUNT) {
    throw new AppShellError('HQ_AREA_COUNT', { count: areas.length, required: HQ_AREA_COUNT });
  }
  const seen = new Set<string>();
  for (const area of areas) {
    if (area.id.length === 0 || seen.has(area.id)) {
      throw new AppShellError('HQ_AREA_DUPLICATE', { id: area.id });
    }
    seen.add(area.id);
    if (area.routeId.length === 0) {
      throw new AppShellError('HQ_AREA_MISSING_ROUTE', { id: area.id });
    }
    if (area.state === 'locked' && area.reasonKey === undefined) {
      throw new AppShellError('HQ_AREA_LOCKED_WITHOUT_REASON', { id: area.id });
    }
  }
}

/** Read-only lookup of an area by id; undefined when absent. */
export function findArea(areas: readonly HqArea[], id: string): HqArea | undefined {
  return areas.find((area) => area.id === id);
}

/** Routeability follows the capability registry: available areas are routable. */
export function isRoutable(area: HqArea): boolean {
  return area.state === 'available';
}
