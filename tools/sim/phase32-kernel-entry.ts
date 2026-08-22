/**
 * Golden-harness kernel entry (bundled through Vite SSR): exposes the pure
 * Phase 32 kernel surface that the harness pins. Not part of the game
 * runtime — this file exists only for the deterministic evidence harness.
 */
export { createNodeRunState, openVisit } from '../../src/game/expedition/nodes/run-state.js';
export { materializeOffers, MERCHANT_OFFER_COUNT, MERCHANT_MAX_REROLLS } from '../../src/game/expedition/offers/offer-service.js';
export { materializeEvent, buildEventCommands } from '../../src/game/expedition/events/event-service.js';
export { EVENT_DEFINITIONS } from '../../src/game/expedition/events/event-content.js';
export { validateEvents, EVENT_COUNT } from '../../src/game/expedition/events/event-validator.js';
export { commitNodeAction, prepareNodeCommit, resolveNode } from '../../src/game/expedition/nodes/node-transaction.js';
export { buildRegistry } from '../../src/game/expedition/nodes/registry.js';
export { nodeRegistry, NODE_HANDLERS } from '../../src/game/expedition/nodes/handlers/index.js';
export { merchantHandler } from '../../src/game/expedition/nodes/handlers/merchant.js';
export { recruitmentHandler } from '../../src/game/expedition/nodes/handlers/recruitment.js';
export { settleDefeat, settleRetreat, relicLimitForMode } from '../../src/game/expedition/run-economy.js';
export { pickFromPool, rewardChoice, validatePool } from '../../src/game/expedition/reward-pool.js';
export {
  createExpeditionRun,
  definitionOf,
  handlerForNode,
  dispatchPrepare,
  dispatchCommit,
  dispatchResolve,
  dispatchEnterNode,
  advanceToNode,
} from '../../src/game/expedition/nodes/node-run-reducer.js';
export { generateMap, buildCandidate, structuralHash } from '../../src/game/expedition/map-generator.js';
export { reachableFrom, mainPathLength } from '../../src/game/expedition/reachability.js';
export { applyOutcomeCommands } from '../../src/game/expedition/outcome-commands.js';
export { createExpedition, mainPath, nodesOfType, restoreExpedition } from '../../src/game/expedition/expedition-runner.js';
