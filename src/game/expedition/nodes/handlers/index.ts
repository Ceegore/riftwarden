/**
 * Phase 32 closed node registry: exactly one handler per node type. The
 * build fails on a missing or duplicate handler — there is no runtime
 * fallback for unknown nodes (NODE_REGISTRY_CONTRACT).
 */
import { buildRegistry, type NodeHandler } from '../registry.js';
import { altarHandler } from './altar.js';
import { anchorStoryHandlers } from './anchor.js';
import { battleHandler, bossHandler, eliteHandler } from './combat.js';
import { eventHandler } from './event.js';
import { merchantHandler } from './merchant.js';
import { recruitmentHandler } from './recruitment.js';
import { scoutHandler } from './scout.js';
import { treasureHandler } from './treasure.js';
import { workshopHandler } from './workshop.js';

export const NODE_HANDLERS: readonly NodeHandler[] = [
  battleHandler,
  eliteHandler,
  bossHandler,
  eventHandler,
  merchantHandler,
  recruitmentHandler,
  treasureHandler,
  workshopHandler,
  altarHandler,
  scoutHandler,
  ...anchorStoryHandlers,
];

/** The closed registry: twelve types, twelve handlers. */
export const nodeRegistry = buildRegistry(NODE_HANDLERS);
