import { createMovementSystem, type MovementSystemConfig } from '../movement/movement-system.js';
import { createNoopSystems } from './noop-systems.js';
import type { KernelSystem } from './tick-context.js';

export type Phase15SystemsConfig = MovementSystemConfig;

/**
 * Phase 15 A–M system composition (§10). Stage F is wired to the movement
 * system; the other stages keep their Phase 14 noop reservation. K (spawn
 * placement), L (rift-collapse endcap) and the separation/lane-change/anti-stuck
 * F-substeps require additional battle-level persistent state (spawn requests,
 * progress counters, lane-change state) that is migrated in follow-up increments,
 * so they are intentionally not faked here. M (snapshot projection) is performed
 * by the kernel itself at checkpoint ticks.
 */
export function createPhase15Systems(config: Phase15SystemsConfig): readonly KernelSystem[] {
  const reserved = createNoopSystems().filter((system) => system.stage !== 'F');
  return Object.freeze([...reserved, createMovementSystem(config)]);
}
