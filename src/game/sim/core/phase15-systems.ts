import { createLaneChangeSystem, type LaneChangeSystemConfig } from '../movement/lane-change-system.js';
import { createMovementSystem, type MovementSystemConfig } from '../movement/movement-system.js';
import { createAntiStuckSystem } from '../anti-stuck/anti-stuck-system.js';
import { createEndcapSystem } from '../anti-stuck/endcap-system.js';
import { createNoopSystems } from './noop-systems.js';
import type { KernelSystem } from './tick-context.js';

export interface Phase15SystemsConfig extends MovementSystemConfig {
  /** Lane-change start requests for this tick (defaults to none). */
  readonly laneChangeRequests?: LaneChangeSystemConfig['requests'];
}

/* *
 * Phase 15 A–M system composition (§10). Stage F runs the three deterministic
 * substeps in order — lane change, movement, anti-stuck — and stage L converts
 * the global no-progress endcap into the rift-collapse end request. K (spawn
 * placement) requires its own battle-level persistent state and is migrated in
 * a follow-up increment, so it is intentionally not faked here. M (snapshot
 * projection) is performed by the kernel itself at checkpoint ticks.
 */
export function createPhase15Systems(config: Phase15SystemsConfig): readonly KernelSystem[] {
  const reserved = createNoopSystems().filter((system) => system.stage !== 'F' && system.stage !== 'L');
  return Object.freeze([
    ...reserved,
    createLaneChangeSystem(config.laneChangeRequests === undefined ? {} : { requests: config.laneChangeRequests }),
    createMovementSystem(config),
    createAntiStuckSystem(config),
    createEndcapSystem(),
  ]);
}
