import type { KernelEntity } from '../core/entity.js';
import { LANE_ORDINAL, type Lane } from '../geometry/x100.js';
import { buildCandidates } from './candidates.js';
import { queryValidCandidates } from './target-query.js';
import { compareBreakdown, scoreCandidate } from './target-score.js';
import type { QueryContext, Role } from './types.js';

const LANES: readonly Lane[] = Object.freeze(['top', 'middle', 'bottom']);

/**
 * §9.2 lane fallback: after three repaths inside the rolling 120-tick window,
 * the stuck unit switches once into the valid neighboring lane with the LOWEST
 * target score (GDD: "niedrigste gültige Nachbarbahn nach Zielscore"); a lane
 * is valid when it holds at least one valid (alive, reachable) enemy candidate.
 * Ties are broken by lane ordinal, then the source entity id. Returns null
 * when no neighboring lane is valid (`P15_REPATH_LANE_UNAVAILABLE`).
 */
export function selectFallbackLane(source: KernelEntity, entities: readonly KernelEntity[], roles?: Readonly<Record<string, Role>>): Lane | null {
  const sourceIndex = LANE_ORDINAL[source.lane];
  const neighbors = LANES.filter((lane) => Math.abs(LANE_ORDINAL[lane] - sourceIndex) === 1);
  const candidates = buildCandidates(source, entities);
  const valid = queryValidCandidates(candidates);
  const query: QueryContext = {
    sourceId: source.id,
    sourceLane: source.lane,
    role: roles?.[source.id] ?? 'fighter',
    ownLaneHasTarget: valid.some((c) => c.lane === source.lane),
    laneChangeRequired: (c) => c.lane !== source.lane,
    ...(source.targetId === null ? {} : { currentTargetId: source.targetId }),
  };

  const scored: { lane: Lane; best: number }[] = [];
  for (const lane of neighbors) {
    const laneCandidates = valid.filter((c) => c.lane === lane);
    if (laneCandidates.length === 0) continue;
    const best = laneCandidates.map((c) => scoreCandidate(c, query)).sort(compareBreakdown)[0];
    if (best === undefined) continue;
    scored.push({ lane, best: best.total });
  }
  if (scored.length === 0) return null;
  scored.sort((a, b) => a.best - b.best || LANE_ORDINAL[a.lane] - LANE_ORDINAL[b.lane] || (source.id < source.id ? -1 : source.id > source.id ? 1 : 0));
  return scored[0]?.lane ?? null;
}
