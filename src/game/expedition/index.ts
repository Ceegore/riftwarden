/**
 * Expedition public API barrel: all stable exports from the Phase 32
 * expedition layer. Consumers import from '@game/expedition' (or the
 * direct path) to get the complete runner, save, economy, settlement,
 * and manager surface without reaching into internal implementations.
 */
// Runner and core types.
export { createExpedition, restoreExpedition, mainPath, nodesOfType, availableNodes, type ExpeditionRunner, type ExpeditionConfig } from './expedition-runner.js';

// Save codec.
export { encodeExpeditionSave, decodeExpeditionSave, restoreExpeditionSave, EXPEDITION_SAVE_VERSION, type ExpeditionSave } from './expedition-save.js';

// Map generation.
export { generateMap, buildCandidate, buildFallback, structuralHash, type MapGenerationInput } from './map-generator.js';

// Reachability.
export { validateMap } from './reachability.js';

// Run economy.
export { settleVictory, settleDefeat, settleRetreat, secureCommands, relicLimitForMode, hasReward, duplicateConversionGold, type Settlement } from './run-economy.js';

// Outcome commands.
export { applyOutcomeCommands, rejectionOf } from './outcome-commands.js';

// Node reducer.
export { createExpeditionRun, definitionOf, handlerForNode, dispatchPrepare, dispatchCommit, dispatchResolve, dispatchEnterNode, advanceToNode, applyGoldDelta, applyInstabilityDelta, finishExpeditionRun } from './nodes/node-run-reducer.js';

// Node transaction.
export { prepareNodeCommit, commitNodeAction, resolveNode, type NodeCommitOutcome, type NodeCommitStep } from './nodes/node-transaction.js';

// Node run state.
export { createNodeRunState, openVisit, type NodeRunStateSource } from './nodes/run-state.js';

// Node registry.
export { buildRegistry } from './nodes/registry.js';

// Node handlers.
export { nodeRegistry } from './nodes/handlers/index.js';

// Offer and event services.
export { materializeOffers, MERCHANT_OFFER_COUNT, MERCHANT_MAX_REROLLS } from './offers/offer-service.js';
export { materializeEvent, buildEventCommands } from './events/event-service.js';
export { EVENT_DEFINITIONS } from './events/event-content.js';

// Reward pool.
export { pickFromPool, rewardChoice, validatePool } from './reward-pool.js';

// Stable RNG.
export { fnv1a, fnv1a32, nextU32, compareCodeUnit } from './stable.js';

// Store (local persistence).
export { saveExpedition, readMeta, hasStoredExpedition, clearStore, restoreStoredExpedition, createAndSaveExpedition, type StoreMeta } from './expedition-store.js';

// Run manager (React bridge).
export { RunManager, type RunSnapshot } from './run-manager.js';

// Settlement bridge.
export { buildSettlementRequests, type ExpeditionOutcome, type SettlementRequests } from './expedition-settlement.js';

// Types.
export type { ExpeditionMap, MapNode, MapEdge, MapProfile, NodeId, NodeType, NodeRole } from './types.js';
export type { NodeRunState, NodeVisitState, NodeActionRequest, NodeDefinition, NodePreviewData, NodeSnapshot, OfferSnapshot, EventSnapshot, RewardSnapshot, TransactionRecord, OutcomeCommand, CommandBatchResult, Offer, EventOptionState, RunStatus, VisitStatus } from './nodes/types.js';
export type { NodeHandler } from './nodes/registry.js';
