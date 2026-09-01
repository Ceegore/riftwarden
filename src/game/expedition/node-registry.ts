import { ExpeditionError } from './expedition-error.js';
import { NODE_TYPES, type NodeType } from './types.js';

/**
 * Closed node registry (NODE_TRANSACTION_CONTRACT): unsupported node types
 * are rejected. The registry is deliberately closed and extensible — adding a
 * node family (merchant, recruitment, treasure, workshop, altar, scout) is a
 * Phase 32 code change, never runtime improvisation. Every registered type
 * declares its presentation key and default instability delta. The Phase 28
 * pinned values (battle +5, anchor −10) are unchanged; the Phase 32 types
 * carry the GDD §19.1 defaults.
 */
export interface NodeTypeDefinition {
  readonly type: NodeType;
  readonly labelKey: string;
  readonly defaultInstabilityDelta: number;
}

export const NODE_REGISTRY: Readonly<Record<NodeType, NodeTypeDefinition>> = {
  battle: { type: 'battle', labelKey: 'node.type.battle', defaultInstabilityDelta: 5 },
  elite: { type: 'elite', labelKey: 'node.type.elite', defaultInstabilityDelta: 12 },
  boss: { type: 'boss', labelKey: 'node.type.boss', defaultInstabilityDelta: 0 },
  event: { type: 'event', labelKey: 'node.type.event', defaultInstabilityDelta: 3 },
  merchant: { type: 'merchant', labelKey: 'node.type.merchant', defaultInstabilityDelta: 3 },
  recruitment: { type: 'recruitment', labelKey: 'node.type.recruitment', defaultInstabilityDelta: 4 },
  treasure: { type: 'treasure', labelKey: 'node.type.treasure', defaultInstabilityDelta: 5 },
  workshop: { type: 'workshop', labelKey: 'node.type.workshop', defaultInstabilityDelta: 2 },
  altar: { type: 'altar', labelKey: 'node.type.altar', defaultInstabilityDelta: 8 },
  scout: { type: 'scout', labelKey: 'node.type.scout', defaultInstabilityDelta: 2 },
  anchor: { type: 'anchor', labelKey: 'node.type.anchor', defaultInstabilityDelta: -10 },
  story: { type: 'story', labelKey: 'node.type.story', defaultInstabilityDelta: 0 },
};

export function isNodeType(value: unknown): value is NodeType {
  return typeof value === 'string' && NODE_TYPES.includes(value as NodeType);
}

export function assertNodeType(value: unknown): asserts value is NodeType {
  if (!isNodeType(value)) {
    throw new ExpeditionError('UNKNOWN_NODE_TYPE', { type: value });
  }
}

export function definitionOf(type: NodeType): NodeTypeDefinition {
  return NODE_REGISTRY[type];
}
