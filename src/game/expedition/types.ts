/**
 * Phase 28 expedition domain types (RUN_DOMAIN_CONTRACT + MAP_GENERATOR_CONTRACT):
 * deterministic maps with stable node/edge ids over six logical levels, an
 * immutable saveable RunState, reachability-based previews and the closed
 * node stage machine. References are ids plus version references — never UI
 * text or object identity.
 */
export type NodeId = string;

/** Closed, extensible node registry: minimum types only (Phase 32 adds more). */
export const NODE_TYPES = ['battle', 'anchor'] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export type NodeRole = 'start' | 'normal' | 'preparation' | 'anchor' | 'boss';

export interface MapNode {
  readonly id: NodeId;
  readonly level: number;
  readonly type: NodeType;
  readonly role: NodeRole;
  /** Persisted preview payload key; offers are resolved at generation, never rerolled. */
  readonly previewKey: string;
  readonly instabilityDelta: number;
}

export interface MapEdge {
  readonly id: string;
  readonly from: NodeId;
  readonly to: NodeId;
}

export interface ExpeditionMap {
  readonly profileId: string;
  readonly seed: number;
  readonly contentRevision: string;
  readonly nodes: readonly MapNode[];
  readonly edges: readonly MapEdge[];
  readonly startNodeId: NodeId;
  readonly bossNodeId: NodeId;
  readonly usedFallback: boolean;
  readonly attempts: number;
  /** Structural hash over canonical nodes/edges/profile revision (no presentation order). */
  readonly mapHash: string;
}

/** Map profile comes from content authority; never hardcoded in UI. */
export interface MapProfile {
  readonly id: string;
  readonly logicalLevels: number;
  readonly targetVisited: readonly [number, number];
  readonly mandatoryRoles: readonly NodeRole[];
  readonly attemptCap: number;
  readonly fallbackTemplateId: string;
}

export type NodeStage =
  | 'previewed'
  | 'entering'
  | 'entered'
  | 'resolving'
  | 'decision_pending'
  | 'reward_pending'
  | 'exiting'
  | 'completed';

export interface RunState {
  readonly revision: number;
  readonly runId: string;
  readonly modeId: string;
  readonly missionId: string;
  readonly mapProfileId: string;
  readonly seed: number;
  readonly mapHash: string;
  readonly currentLevel: number;
  readonly currentNodeId: NodeId;
  readonly visitedNodeIds: readonly NodeId[];
  readonly availableNodeIds: readonly NodeId[];
  readonly instability: number;
  readonly resources: Readonly<Record<string, number>>;
  readonly securedLoot: readonly string[];
  readonly unsecuredLoot: readonly string[];
  readonly committedTransactionIds: readonly string[];
  readonly pendingTransactionId?: string;
}

export interface NodePreview {
  readonly nodeId: NodeId;
  readonly reachable: boolean;
  readonly previewKey: string;
  readonly instabilityDelta: number;
}
