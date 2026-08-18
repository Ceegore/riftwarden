import { createPhase16Systems, type Phase16SystemsConfig } from './phase16-systems.js';
import { createBasicAttackSystem, type BasicAttackSystemConfig } from '../attack/basic-attack-system.js';
import { createProjectileSystem } from '../projectile/projectile-system.js';
import { createCombatApplicationSystem } from '../combat/combat-application.js';
import type { KernelSystem } from './tick-context.js';

export interface Phase17SystemsConfig extends Phase16SystemsConfig {
  /** Stage-G attack lifecycle parameters per entity (T01). */
  readonly basicAttack?: BasicAttackSystemConfig;
}

/**
 * Phase 17 A–M composition. Builds on the Phase 16 kernel (targeting in E,
 * movement/spawn/endcap from Phase 15) and advances:
 * - stage G from the P16 attack-preparation foundation to the full T01
 *   basic-attack lifecycle (prepare → commit → recovery), which on commit
 *   queues hits or spawns projectiles (§5.3);
 * - stage H to the T02 projectile lifecycle (advance once per tick, sample
 *   impact once, resolve);
 * - stage I to the T04 damage/heal/shield integer pipeline (strict apply,
 *   shield ledger, §8.1–8.3).
 * Stages J (defeat/revive, T05) and L (battle end, T06) stay reserved noops —
 * deliberately not pre-taken here.
 */
export function createPhase17Systems(config: Phase17SystemsConfig): readonly KernelSystem[] {
  const base = createPhase16Systems(config);
  return Object.freeze(
    base.map((system): KernelSystem => {
      if (system.id === 'phase16.g1.attack_prep') return createBasicAttackSystem(config.basicAttack ?? { parameters: {} });
      if (system.id === 'noop.resolve_committed') return createProjectileSystem();
      if (system.id === 'noop.apply_effects') return createCombatApplicationSystem();
      return system;
    }),
  );
}
