import type { ExpeditionMap, MapProfile, NodeId } from './types.js';

/**
 * Reachability and structural validation (MAP_GENERATOR_CONTRACT §6):
 * reachability is computed from the saved graph only; the boss must be
 * reachable from the start; anchor/preparation/boss must exist on a valid
 * route; levels, ids, edges, attempt cap and target visit length are checked.
 * Violations are reported as closed codes, never silently relaxed.
 */
export type MapViolationCode =
  | 'DUPLICATE_NODE_ID'
  | 'INVALID_LEVEL'
  | 'EDGE_MISSING_NODE'
  | 'UNREACHABLE_BOSS'
  | 'MISSING_ANCHOR'
  | 'MISSING_PREPARATION'
  | 'MISSING_BOSS'
  | 'ATTEMPT_CAP'
  | 'VISIT_LENGTH_BELOW_MIN'
  | 'VISIT_LENGTH_ABOVE_MAX'
  | 'MISSING_START';

export const MAP_VIOLATION_CODES: readonly MapViolationCode[] = [
  'DUPLICATE_NODE_ID',
  'INVALID_LEVEL',
  'EDGE_MISSING_NODE',
  'UNREACHABLE_BOSS',
  'MISSING_ANCHOR',
  'MISSING_PREPARATION',
  'MISSING_BOSS',
  'ATTEMPT_CAP',
  'VISIT_LENGTH_BELOW_MIN',
  'VISIT_LENGTH_ABOVE_MAX',
  'MISSING_START',
];

export function reachableFrom(map: ExpeditionMap, start: NodeId): readonly NodeId[] {
  const seen = new Set<NodeId>();
  const queue: NodeId[] = [start];
  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    for (const edge of map.edges) {
      if (edge.from === id && !seen.has(edge.to)) queue.push(edge.to);
    }
  }
  return [...seen];
}

/** Length of the main start→boss path: the target visit profile. */
export function mainPathLength(map: ExpeditionMap): number {
  const nodesById = new Map(map.nodes.map((node) => [node.id, node]));
  let current = map.startNodeId;
  let length = 0;
  const visited = new Set<NodeId>();
  while (current.length > 0 && !visited.has(current)) {
    visited.add(current);
    length += 1;
    const node = nodesById.get(current);
    if (node === undefined) break;
    if (current === map.bossNodeId) break;
    const next = map.edges.find((edge) => edge.from === current);
    current = next?.to ?? '';
  }
  return length;
}

export function validateMap(map: ExpeditionMap, profile?: MapProfile): readonly MapViolationCode[] {
  const errors: MapViolationCode[] = [];
  const ids = new Set<string>();
  const byLevel = new Map<number, number>();
  for (const node of map.nodes) {
    if (ids.has(node.id)) errors.push('DUPLICATE_NODE_ID');
    ids.add(node.id);
    if (node.level < 0 || node.level >= (profile?.logicalLevels ?? 6)) errors.push('INVALID_LEVEL');
    byLevel.set(node.level, (byLevel.get(node.level) ?? 0) + 1);
  }
  for (const edge of map.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) errors.push('EDGE_MISSING_NODE');
  }
  const reach = new Set(reachableFrom(map, map.startNodeId));
  if (!ids.has(map.startNodeId)) errors.push('MISSING_START');
  if (!reach.has(map.bossNodeId)) errors.push('UNREACHABLE_BOSS');
  for (const role of ['anchor', 'preparation', 'boss'] as const) {
    if (!map.nodes.some((node) => node.role === role)) {
      errors.push(role === 'anchor' ? 'MISSING_ANCHOR' : role === 'preparation' ? 'MISSING_PREPARATION' : 'MISSING_BOSS');
    }
  }
  if (map.attempts < 1 || map.attempts > (profile?.attemptCap ?? 50)) errors.push('ATTEMPT_CAP');
  const length = mainPathLength(map);
  const [minVisit, maxVisit] = profile?.targetVisited ?? [5, 8];
  if (length < minVisit) errors.push('VISIT_LENGTH_BELOW_MIN');
  if (length > maxVisit) errors.push('VISIT_LENGTH_ABOVE_MAX');
  return [...new Set(errors)].sort();
}
