import { createLaneChangeSystem, type LaneChangeSystemConfig } from '../movement/lane-change-system.js';
import { createMovementSystem, type MovementSystemConfig } from '../movement/movement-system.js';
import { createAntiStuckSystem } from '../anti-stuck/anti-stuck-system.js';
import { createNoopSystems } from './noop-systems.js';
import type { KernelSystem } from './tick-context.js';

export interface Phase15SystemsConfig extends MovementSystemConfig {
  /** Lane-change start requests for this tick (defaults to none). */
  readonly laneChangeRequests?: LaneChangeSystemConfig['requests'];
}

/**
 * Phase 15 A–M system composition (§10). Stage F runs the three deterministic
 * substeps in order — lane change, movement, anti-stuck — while the other stages
 * keep their Phase 14 noop reservation. K (spawn placement) and L (rift-collapse
 * end request) require their own battle-level persistent state and are migrated
 * in follow-up increments, so they are intentionally not faked here. M (snapshot
 * projection) is performed by the kernel itself at checkpoint ticks.
 */
export function createPhase15Systems(config: Phase15SystemsConfig): readonly KernelSystem[] {
  const reserved = createNoopSystems().filter((system) => system.stage !== 'F');
  return Object.freeze([
    ...reserved,
    createLaneChangeSystem(config.laneChangeRequests === undefined ? {} : { requests: config.laneChangeRequests }),
    createMovementSystem(config),
    createAntiStuckSystem(config),
  ]);
}
