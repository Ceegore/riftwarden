import type { KernelEntity } from '../core/entity.js';
import { edgeDistanceX100, type Body } from '../geometry/distance.js';
import { LANE_ORDINAL, asX100 } from '../geometry/x100.js';
import type { Candidate, EntityOrigin } from './types.js';

/** Origin defaults to 'regular' for Phase 14/15 fixtures without the field. */
export function originOf(entity: KernelEntity): EntityOrigin {
  return entity.origin ?? 'regular';
}

function bodyOf(entity: KernelEntity): Body {
  return { id: entity.id, x100: asX100(entity.x100), radiusX100: asX100(entity.radiusX100 ?? 0), lane: entity.lane };
}

/**
 * Builds the enemy candidate list for one source entity. Distance is the Phase
 * 15 inclusive edge distance (§4.2) — never center distance, never floats.
 * Reachability is lane-local: the source lane and its two neighbors; a direct
 * top↔bottom jump is not reachable without two changes (§6.1).
 */
export function buildCandidates(source: KernelEntity, entities: readonly KernelEntity[]): Candidate[] {
  const sourceIndex = LANE_ORDINAL[source.lane];
  const sourceBody = bodyOf(source);
  const out: Candidate[] = [];
  for (const e of entities) {
    if (e.side === source.side) continue;
    const laneDelta = Math.abs(LANE_ORDINAL[e.lane] - sourceIndex);
    const origin = originOf(e);
    out.push({
      id: e.id,
      lane: e.lane,
      distance: Number(edgeDistanceX100(sourceBody, bodyOf(e))),
      hp: e.lp,
      maxHp: e.maxLp,
      alive: e.phase.phase !== 'DEFEATED' && e.phase.phase !== 'REMOVED',
      removed: e.phase.phase === 'REMOVED',
      reachable: laneDelta === 0 || laneDelta === 1,
      regular: origin === 'regular',
      summoned: origin === 'summoned',
      shielded: e.shield > 0,
      construct: origin === 'construct',
      // Not derivable from the Phase 16 kernel snapshot; the hook reports them
      // as false until Phase 17 content supplies the data.
      backline: false,
      buffed: false,
      threatensSource: false,
      covered: false,
    });
  }
  return out;
}
