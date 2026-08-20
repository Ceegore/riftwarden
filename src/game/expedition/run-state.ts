import { ExpeditionError } from './expedition-error.js';
import { reachableFrom, validateMap } from './reachability.js';
import type { ExpeditionMap, NodeId, RunState } from './types.js';

/**
 * Run domain (RUN_DOMAIN_CONTRACT): RunState is immutable and saveable —
 * canonical ids plus version references only, no wallclock-derived gameplay
 * and no offline progression. createRunState performs the structural checks
 * that make the state durable (valid map, start/boss on the map, resources
 * non-negative) so a malformed state can never be persisted.
 */
export interface RunStateSource {
  readonly runId: string;
  readonly modeId: string;
  readonly missionId: string;
  readonly map: ExpeditionMap;
  readonly startResources: Readonly<Record<string, number>>;
}

export function createRunState(source: RunStateSource): RunState {
  const map = source.map;
  const violations = validateMap(map);
  if (violations.length > 0) {
    throw new ExpeditionError('INVALID_MAP', { violations });
  }
  const startReachable = reachableFrom(map, map.startNodeId);
  if (!startReachable.includes(map.startNodeId)) {
    throw new ExpeditionError('INVALID_MAP', { reason: 'start-not-on-map' });
  }
  for (const [key, value] of Object.entries(source.startResources)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new ExpeditionError('NEGATIVE_RESOURCE', { key, value });
    }
  }
  const startNode = map.nodes.find((node) => node.id === map.startNodeId);
  if (startNode === undefined) throw new ExpeditionError('INVALID_MAP', { reason: 'start-missing' });
  const firstEdges = map.edges.filter((edge) => edge.from === map.startNodeId);
  const available = firstEdges.map((edge) => edge.to).sort();
  return {
    revision: 0,
    runId: source.runId,
    modeId: source.modeId,
    missionId: source.missionId,
    mapProfileId: map.profileId,
    seed: map.seed,
    mapHash: map.mapHash,
    currentLevel: startNode.level,
    currentNodeId: map.startNodeId,
    visitedNodeIds: [map.startNodeId],
    availableNodeIds: available,
    instability: 0,
    resources: { ...source.startResources },
    securedLoot: [],
    unsecuredLoot: [],
    committedTransactionIds: [],
  };
}

export function currentNode(map: ExpeditionMap, state: RunState): NodeId {
  const node = map.nodes.find((candidate) => candidate.id === state.currentNodeId);
  if (node === undefined) throw new ExpeditionError('INVALID_MAP', { reason: 'current-node-missing' });
  return node.id;
}
