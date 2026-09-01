/**
 * Closed node handler registry (NODE_REGISTRY_CONTRACT): every one of the
 * twelve node types maps to exactly one handler. A missing or duplicate
 * handler is a content build error — there is no generic "unknown node"
 * runtime fallback. Handlers declare required data, allowed actions, a
 * preview/prepare step (materialized and persisted at first open), a
 * rule-level validate step and an atomic commit phase.
 */
import { ExpeditionError, type NodeRejectionCode } from '../expedition-error.js';
import { NODE_TYPES, type NodeType } from '../types.js';
import type { NodeActionRequest, NodeDefinition, NodePreviewData, NodeRunState } from './types.js';

export interface NodeCommitResult {
  readonly state: NodeRunState;
  readonly outcomeIds: readonly string[];
}

export interface NodeHandler {
  readonly type: NodeType;
  readonly allowedActions: readonly string[];
  readonly requiredData: readonly string[];
  readonly commitPhase: 'ATOMIC';
  /** First open: materializes + persists the snapshot, returns the preview. */
  prepare(definition: NodeDefinition, state: NodeRunState): { readonly state: NodeRunState; readonly preview: NodePreviewData };
  /** Rule-level rejection or null; structural misuse throws ExpeditionError. */
  validate(definition: NodeDefinition, request: NodeActionRequest, state: NodeRunState): NodeRejectionCode | null;
  commit(definition: NodeDefinition, request: NodeActionRequest, state: NodeRunState): NodeCommitResult;
}

export function buildRegistry(handlers: readonly NodeHandler[]): ReadonlyMap<NodeType, NodeHandler> {
  const map = new Map<NodeType, NodeHandler>();
  for (const handler of handlers) {
    if (map.has(handler.type)) {
      throw new ExpeditionError('CONTENT_BUILD_ERROR', { type: handler.type, reason: 'duplicate handler' });
    }
    map.set(handler.type, handler);
  }
  for (const type of NODE_TYPES) {
    if (!map.has(type)) {
      throw new ExpeditionError('CONTENT_BUILD_ERROR', { type, reason: 'missing handler' });
    }
  }
  return map;
}

export function handlerFor(registry: ReadonlyMap<NodeType, NodeHandler>, type: NodeType): NodeHandler {
  const handler = registry.get(type);
  if (handler === undefined) {
    throw new ExpeditionError('UNKNOWN_HANDLER', { type });
  }
  return handler;
}

/** ENTER is shared by every handler: instability applies at enter, exactly once. */
export function enterAction(): NodeActionRequest['action'] {
  return 'ENTER';
}
