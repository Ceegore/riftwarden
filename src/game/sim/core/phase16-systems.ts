import { createPhase15Systems, type Phase15SystemsConfig } from './phase15-systems.js';
import { createTargetingSystem, type TargetingConfig } from '../targeting/targeting-system.js';
import { createAttackPrepSystem, type AttackPrepConfig } from '../targeting/attack-prep-system.js';
import type { KernelSystem } from './tick-context.js';

export interface Phase16SystemsConfig extends Phase15SystemsConfig {
  /** Stage-E targeting options (roles, focus fire, anti-summoner). */
  readonly targeting?: TargetingConfig;
  /** Stage-G attack-preparation options (preferred ranges per entity). */
  readonly attackPrep?: AttackPrepConfig;
}

/**
 * Phase 16 A–M composition (§10 integration boundary). Adds the authorized
 * Phase 16 stages on top of the Phase 15 kernel: stage E runs target selection
 * (query/score/lock) and stage G runs attack preparation (inclusive preferred
 * range, edge-triggered). Movement in F, spawn in K and the endcap in L are
 * untouched — Phase 16 must not reinterpret Phase 15 geometry.
 */
export function createPhase16Systems(config: Phase16SystemsConfig): readonly KernelSystem[] {
  const base = createPhase15Systems(config);
  return Object.freeze(
    base.map((system): KernelSystem => {
      if (system.id === 'noop.targeting') return createTargetingSystem(config.targeting);
      if (system.id === 'noop.cast_progress') return createAttackPrepSystem(config.attackPrep);
      return system;
    }),
  );
}
