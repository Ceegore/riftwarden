import { createPhase16Systems, type Phase16SystemsConfig } from './phase16-systems.js';
import { createBasicAttackSystem, type BasicAttackSystemConfig } from '../attack/basic-attack-system.js';
import type { KernelSystem } from './tick-context.js';

export interface Phase17SystemsConfig extends Phase16SystemsConfig {
  /** Stage-G attack lifecycle parameters per entity (T01). */
  readonly basicAttack?: BasicAttackSystemConfig;
}

/**
 * Phase 17 A–M composition. Builds on the Phase 16 kernel (targeting in E,
 * movement/spawn/endcap from Phase 15) and advances stage G from the P16
 * attack-preparation foundation to the full T01 basic-attack lifecycle
 * (prepare → commit → recovery with interval gating and interrupt). Stages H
 * (projectile/AoE) and I/J (damage/heal/shield, defeat) stay reserved noops —
 * they are T02–T05, deliberately not pre-taken here.
 */
export function createPhase17Systems(config: Phase17SystemsConfig): readonly KernelSystem[] {
  const base = createPhase16Systems(config);
  return Object.freeze(
    base.map((system): KernelSystem => {
      if (system.id === 'phase16.g1.attack_prep') return createBasicAttackSystem(config.basicAttack ?? { parameters: {} });
      return system;
    }),
  );
}
