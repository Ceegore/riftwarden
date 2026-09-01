import { createPhase18Systems, type Phase18SystemsConfig } from './phase18-systems.js';
import { createAbilityTriggerSystem, createAbilityTargetSystem, type AbilityRuntimeConfig } from '../ability/ability-runtime.js';
import { createAbilityLifecycleSystem, createAbilityEffectDispatchSystem, type EffectDispatchStage } from '../ability/ability-lifecycle-system.js';
import type { KernelSystem } from './tick-context.js';

export interface Phase19SystemsConfig extends Phase18SystemsConfig {
  /** Ability definitions, triggers, target queries and effect factories (§4). */
  readonly abilities?: AbilityRuntimeConfig;
}

/**
 * Phase 19 A–M composition. Builds on the Phase 18 kernel and adds the
 * ability-trigger framework:
 * - stage D evaluates triggers (`ready` → `waiting_target`);
 * - stage E resolves targets and stores the target snapshot;
 * - stage G advances the charge/cast/commit/interrupt lifecycle and composes
 *   committed casts into the planned-effects queue;
 * - stages F/H/I/K dispatch planned effects onto the existing kernel commands.
 * Abilities never mutate battle state directly — they publish closed state via
 * `set_abilities` and effect commands (§3).
 */
export function createPhase19Systems(config: Phase19SystemsConfig): readonly KernelSystem[] {
  const base = createPhase18Systems(config);
  const abilityConfig = config.abilities ?? { definitions: {} };
  const dispatchStages: readonly EffectDispatchStage[] = ['F', 'H', 'I', 'K'];
  return Object.freeze([
    ...base,
    createAbilityTriggerSystem(abilityConfig),
    createAbilityTargetSystem(abilityConfig),
    createAbilityLifecycleSystem(abilityConfig),
    ...dispatchStages.map((stage) => createAbilityEffectDispatchSystem(stage)),
  ]);
}
