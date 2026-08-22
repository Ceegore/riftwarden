/**
 * NodeRunState factory: builds the persisted Phase 32 run container from
 * the run identity and the profile's troop copy counts (Phase 31
 * copy-limit wiring is operator-side; the layer validates against the copy
 * counts it is given). All counters start at zero and every mutation flows
 * through the ledger.
 */
import type { NodeRunState, NodeVisitState } from './types.js';

export interface NodeRunStateSource {
  readonly runId: string;
  readonly modeId: string;
  readonly contentRevision: string;
  readonly seed: number;
  readonly mapHash: string;
  readonly gold: number;
  readonly troopCopies?: Readonly<Record<string, number>>;
}

export function createNodeRunState(source: NodeRunStateSource): NodeRunState {
  if (!Number.isSafeInteger(source.gold) || source.gold < 0) {
    throw new RangeError(`invalid starting gold: ${String(source.gold)}`);
  }
  return {
    revision: 0,
    runId: source.runId,
    modeId: source.modeId,
    contentRevision: source.contentRevision,
    seed: source.seed,
    mapHash: source.mapHash,
    gold: source.gold,
    instability: 0,
    goldEarned: 0,
    securedLoot: [],
    unsecuredLoot: [],
    relics: [],
    recruits: [],
    knowledge: [],
    troopCopies: { ...source.troopCopies },
    visits: {},
    snapshots: {},
    ledger: {},
  };
}

/** Opens a fresh visit (OPEN); re-opening an existing visit is idempotent. */
export function openVisit(state: NodeRunState, nodeId: string, previewRevision: number): NodeRunState {
  const existing = state.visits[nodeId];
  if (existing !== undefined) return state;
  const visit: NodeVisitState = { nodeId, status: 'OPEN', previewRevision };
  return { ...state, revision: state.revision + 1, visits: { ...state.visits, [nodeId]: visit } };
}
