import { createPhase16Systems, type Phase16SystemsConfig } from './phase16-systems.js';
import { createBasicAttackSystem, type BasicAttackSystemConfig } from '../attack/basic-attack-system.js';
import { createProjectileSystem } from '../projectile/projectile-system.js';
import { createCombatApplicationSystem } from '../combat/combat-application.js';
import { createDefeatResolverSystem, type DefeatHookInput } from '../combat/defeat-resolver.js';
import { createBattleEndResolverSystem, type BattleEndConfig } from '../combat/battle-end-resolver.js';
import type { KernelSystem } from './tick-context.js';

export interface Phase17SystemsConfig extends Phase16SystemsConfig {
  /** Stage-G attack lifecycle parameters per entity (T01). */
  readonly basicAttack?: BasicAttackSystemConfig;
  /** Stage-J defeat/revive content hooks (T05). Absent → no prevention/revive. */
  readonly defeatHooks?: Partial<DefeatHookInput>;
  /** Stage-L battle-end configuration (T06). Absent → normal/elite limits. */
  readonly battleEnd?: BattleEndConfig;
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
 *   shield ledger, §8.1–8.3);
 * - stage J to the T05 defeat resolver: death prevention, committed revives,
 *   Defeated + overkill, remove hooks (§9). Content supplies revive caps and
 *   HP return values — this phase provides the hooks, not a concrete ability;
 * - stage L to the T06 battle-end resolver: soft limits, rift-collapse damage
 *   and heal halving, Chapter-76 tie-break, and RESOLVING_END finalization
 *   (§10). The phase-15 endcap still requests RESOLVING_END on the
 *   no-progress path; this system finalizes both paths.
 */
export function createPhase17Systems(config: Phase17SystemsConfig): readonly KernelSystem[] {
  const base = createPhase16Systems(config);
  const mapped = base.map((system): KernelSystem => {
    if (system.id === 'phase16.g1.attack_prep') return createBasicAttackSystem(config.basicAttack ?? { parameters: {} });
    if (system.id === 'noop.resolve_committed') return createProjectileSystem();
    if (system.id === 'noop.apply_effects') return createCombatApplicationSystem();
    if (system.id === 'noop.death_resolution') return createDefeatResolverSystem(config.defeatHooks);
    return system;
  });
  // The phase-15 composition already replaced the L noop with the endcap, so
  // the T06 resolver is appended as a second stage-L system (id-sorted after
  // the endcap). It finalizes the endcap's RESOLVING_END request and handles
  // the time-limit/elimination paths itself.
  return Object.freeze([...mapped, createBattleEndResolverSystem(config.battleEnd ?? {})]);
}
