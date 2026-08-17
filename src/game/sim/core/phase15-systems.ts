import { createLaneChangeSystem, type LaneChangeSystemConfig } from '../movement/lane-change-system.js';
import { createMovementSystem, type MovementSystemConfig } from '../movement/movement-system.js';
import { createAntiStuckSystem } from '../anti-stuck/anti-stuck-system.js';
import { createEndcapSystem } from '../anti-stuck/endcap-system.js';
import { createSpawnSystem, type SpawnSystemConfig } from '../spawn/spawn-system.js';
import { createNoopSystems } from './noop-systems.js';
import type { KernelSystem } from './tick-context.js';

export interface Phase15SystemsConfig extends MovementSystemConfig {
  /** Lane-change start requests for this tick (defaults to none). */
  readonly laneChangeRequests?: LaneChangeSystemConfig['requests'];
  /** Spawn/construct placement requests for this tick (defaults to none). */
  readonly spawnRequests?: SpawnSystemConfig['requests'];
}

/**
 * Phase 15 A–M system composition (§10). Stage F runs the three deterministic
 * substeps in order — lane change, movement (with separation), anti-stuck —
 * stage K resolves summon/construct placement into commit/reject commands, and
 * stage L converts the global no-progress endcap into the rift-collapse end
 * request. G/H/I/J stay reserved noops: Phase 15 must not pre-take combat,
 * effect, or death semantics. M (snapshot projection) is performed by the
 * kernel itself at checkpoint ticks.
 */
export function createPhase15Systems(config: Phase15SystemsConfig): readonly KernelSystem[] {
  const reserved = createNoopSystems().filter((system) => system.stage !== 'F' && system.stage !== 'K' && system.stage !== 'L');
  return Object.freeze([
    ...reserved,
    createLaneChangeSystem(config.laneChangeRequests === undefined ? {} : { requests: config.laneChangeRequests }),
    createMovementSystem(config),
    createAntiStuckSystem(config),
    createSpawnSystem(config.spawnRequests === undefined ? {} : { requests: config.spawnRequests }),
    createEndcapSystem(),
  ]);
}
