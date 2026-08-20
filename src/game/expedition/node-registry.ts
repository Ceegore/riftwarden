import { ExpeditionError } from './expedition-error.js';
import { NODE_TYPES, type NodeType } from './types.js';

/**
 * Closed node registry (NODE_TRANSACTION_CONTRACT): unsupported node types
 * are rejected. The registry is deliberately closed and extensible — adding a
 * node family (merchant, recruitment, treasure, workshop, altar, scout) is a
 * Phase 32 code change, never runtime improvisation. Every registered type
 * declares its presentation key and default instability delta.
 */
export interface NodeTypeDefinition {
  readonly type: NodeType;
  readonly labelKey: string;
  readonly defaultInstabilityDelta: number;
}

export const NODE_REGISTRY: Readonly<Record<NodeType, NodeTypeDefinition>> = {
  battle: { type: 'battle', labelKey: 'node.type.battle', defaultInstabilityDelta: 5 },
  anchor: { type: 'anchor', labelKey: 'node.type.anchor', defaultInstabilityDelta: -10 },
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
