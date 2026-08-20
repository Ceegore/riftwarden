import { ExpeditionError } from './expedition-error.js';
import type { NodeStage } from './types.js';

/**
 * Node state machine (NODE_TRANSACTION_CONTRACT): previewed -> entering ->
 * entered -> resolving -> decision_pending -> reward_pending -> exiting ->
 * completed. Commits precede success UI/navigation; a completed node rejects
 * further commands. Unsupported transitions are hard errors — the machine is
 * closed and deterministic.
 */
export const NODE_STAGES: readonly NodeStage[] = [
  'previewed',
  'entering',
  'entered',
  'resolving',
  'decision_pending',
  'reward_pending',
  'exiting',
  'completed',
];

const NEXT: Readonly<Record<NodeStage, readonly NodeStage[]>> = {
  previewed: ['entering'],
  entering: ['entered'],
  entered: ['resolving'],
  resolving: ['decision_pending', 'reward_pending'],
  decision_pending: ['reward_pending'],
  reward_pending: ['exiting'],
  exiting: ['completed'],
  completed: [],
};

export type NodeCommand =
  | 'enter'
  | 'commitEnter'
  | 'resolve'
  | 'commitDecision'
  | 'commitReward'
  | 'commitExit'
  | 'preview';

const COMMAND_TARGET: Readonly<Record<NodeCommand, NodeStage>> = {
  preview: 'previewed',
  enter: 'entering',
  commitEnter: 'entered',
  resolve: 'resolving',
  commitDecision: 'reward_pending',
  commitReward: 'exiting',
  commitExit: 'completed',
};

export function transition(from: NodeStage, to: NodeStage): NodeStage {
  if (!NEXT[from].includes(to)) {
    throw new ExpeditionError('INVALID_NODE_TRANSITION', { from, to });
  }
  return to;
}

/** Applies a command from the current stage; completed nodes reject all input. */
export function applyNodeCommand(stage: NodeStage, command: NodeCommand): NodeStage {
  if (stage === 'completed') {
    throw new ExpeditionError('NODE_ALREADY_COMPLETED', { command });
  }
  return transition(stage, COMMAND_TARGET[command]);
}

export function isNodeStage(value: unknown): value is NodeStage {
  return typeof value === 'string' && NODE_STAGES.includes(value as NodeStage);
}
