import { KernelInvariantError } from '../core/invariant-error.js';
import type { KernelEntity } from '../core/entity.js';
import type { KernelSystem, TickContext } from '../core/tick-context.js';
import { advanceAbilityTick, tryCast, type AbilityEvent, type AbilityInstance } from './ability-system.js';
import { abilityEventInput, abilityRejectOrdinal } from './ability-events.js';
import { canonicalizeEffectBatch, enqueueEffect } from './effect-executor.js';
import type { EffectCommand, SourceSnapshot } from './effect-command.js';
import type { AbilityRuntimeConfig, AbilityRuntimeDefinition, EffectComposeContext } from './ability-runtime.js';

/**
 * Phase 19 stage-G lifecycle (handbook step 7). Drives the pure
 * charge/cooldown/cast/interrupt state machine once per tick and composes the
 * committed cast's effect batch into the §11 planned-effects queue. Effects
 * are dispatched at their target stage by `createAbilityEffectDispatchSystem`
 * (F/H/I/K — stage G has no kernel command a closed effect maps onto). The
 * stage-G system never mutates HP/shield/status/position directly; it only
 * publishes ability state and closed effect commands (§3).
 */

export type EffectDispatchStage = 'F' | 'H' | 'I' | 'K';
export const EFFECT_DISPATCH_STAGES = ['F', 'H', 'I', 'K'] as const;

function definitionOf(config: AbilityRuntimeConfig, abilityId: string): AbilityRuntimeDefinition {
  const definition = config.definitions[abilityId];
  if (definition === undefined) throw new KernelInvariantError('P19_ABILITY_MISSING_DEFINITION', { abilityId });
  return definition;
}

function ownerOf(entities: readonly KernelEntity[], ownerId: string): KernelEntity | undefined {
  return entities.find((e) => e.id === ownerId);
}

function isAlive(entity: KernelEntity): boolean {
  return entity.phase.phase !== 'DEFEATED' && entity.phase.phase !== 'REMOVED';
}

function sourceSnapshotOf(owner: KernelEntity): SourceSnapshot {
  return Object.freeze({ sourceId: owner.id, sourceLane: owner.lane, sourceX100: owner.x100, sourceLp: owner.lp, sourceMaxLp: owner.maxLp });
}

function replaceInstance(abilities: readonly AbilityInstance[], next: AbilityInstance): readonly AbilityInstance[] {
  return Object.freeze(abilities.map((i) => (i.abilityInstanceId === next.abilityInstanceId ? next : i)));
}

function emitLifecycleEvent(context: TickContext, event: AbilityEvent, instance: AbilityInstance): void {
  const contentIds = [instance.abilityId];
  const sourceId = instance.ownerId;
  switch (event) {
    case 'ready':
      context.commands.push({ kind: 'append_event', event: abilityEventInput('AbilityReady', sourceId, [], contentIds, { chargeTicks: instance.chargeTicks }) });
      break;
    case 'cast_started':
      context.commands.push({ kind: 'append_event', event: abilityEventInput('AbilityCastStarted', sourceId, [], contentIds, { commitTick: instance.commitTick ?? 0 }) });
      break;
    case 'committed':
      context.commands.push({ kind: 'append_event', event: abilityEventInput('AbilityCommitted', sourceId, [], contentIds, { commitTick: instance.commitTick ?? 0 }) });
      break;
    case 'consumed':
      context.commands.push({ kind: 'append_event', event: abilityEventInput('AbilityConsumed', sourceId, [], contentIds, { usesRemaining: instance.usesRemaining }) });
      break;
    case 'recovery_started':
      context.commands.push({ kind: 'append_event', event: abilityEventInput('AbilityRecovered', sourceId, [], contentIds, {}) });
      break;
    case 'cooldown_started':
      context.commands.push({ kind: 'append_event', event: abilityEventInput('AbilityCooldownStarted', sourceId, [], contentIds, { cooldownTicks: instance.cooldownRemaining }) });
      break;
    case 'interrupted':
      context.commands.push({ kind: 'append_event', event: abilityEventInput('AbilityInterrupted', sourceId, [], contentIds, { remainingChargeTicks: instance.chargeTicks }) });
      break;
    case 'rejected':
    case 'exhausted':
      context.commands.push({ kind: 'append_event', event: abilityEventInput('AbilityRejected', sourceId, [], contentIds, { reasonOrdinal: abilityRejectOrdinal('exhausted') }) });
      break;
  }
}

/** Stage G: advance lifecycle, start casts, commit casts and compose effects. */
export function createAbilityLifecycleSystem(config: AbilityRuntimeConfig = { definitions: {} }): KernelSystem {
  return Object.freeze({
    id: 'phase19.g2.ability_lifecycle',
    stage: 'G' as const,
    run(context: TickContext): void {
      const abilities = context.state.abilities;
      if (abilities === undefined || abilities.length === 0) return;
      const now = context.state.tick;
      let next = abilities;
      let changed = false;
      const committedEffects: EffectCommand[] = [];
      let hadCommit = false;
      for (const instance of abilities) {
        const definition = definitionOf(config, instance.abilityId);
        const config0 = definition.config;
        let current = instance;

        const advanced = advanceAbilityTick(current, config0, now);
        current = advanced.instance;
        for (const event of advanced.events) emitLifecycleEvent(context, event, current);

        if (advanced.events.includes('committed')) {
          const target = current.targetSnapshot;
          const source = current.sourceSnapshot;
          if (target !== null && source !== null) {
            const compose: EffectComposeContext = Object.freeze({
              abilityInstanceId: current.abilityInstanceId,
              abilityId: current.abilityId,
              commitTick: current.commitTick ?? now,
              source,
              target,
            });
            const batch = canonicalizeEffectBatch(definition.effects(compose));
            for (const effect of batch) {
              context.commands.push({
                kind: 'append_event',
                event: abilityEventInput('AbilityEffectQueued', source.sourceId, [], [current.abilityId], { effectIndex: effect.effectIndex }),
              });
            }
            committedEffects.push(...batch);
            hadCommit = true;
          }
        }

        // Only a triggered (`waiting_target`) ability casts; `ready` abilities
        // wait for the stage-D trigger to fire first.
        if (current.state === 'waiting_target') {
          const target = current.targetSnapshot;
          if (target === null) continue;
          const owner = ownerOf(context.state.entities, current.ownerId);
          if (owner === undefined || !isAlive(owner)) continue;
          const cast = tryCast(current, config0, now, target, sourceSnapshotOf(owner));
          current = cast.instance;
          for (const event of cast.events) emitLifecycleEvent(context, event, current);
        }

        if (current !== instance) {
          next = replaceInstance(next, current);
          changed = true;
        }
      }
      if (changed) context.commands.push({ kind: 'set_abilities', abilities: next });
      if (hadCommit) context.commands.push({ kind: 'set_planned_effects', effects: canonicalizeEffectBatch(committedEffects) });
    },
  });
}

/** Dispatches planned effects at their target stage (F/H/I/K); never at G. */
export function createAbilityEffectDispatchSystem(stage: EffectDispatchStage): KernelSystem {
  const index = EFFECT_DISPATCH_STAGES.indexOf(stage);
  const id = index === 0 ? 'phase19.f4.ability_effects' : index === 1 ? 'phase19.h2.ability_effects' : index === 2 ? 'phase19.i2.ability_effects' : 'phase19.k2.ability_effects';
  return Object.freeze({
    id,
    stage,
    run(context: TickContext): void {
      const planned = context.state.plannedEffects;
      if (planned === undefined || planned.length === 0) return;
      const now = context.state.tick;
      const remaining: EffectCommand[] = [];
      let consumed = false;
      for (const effect of planned) {
        if (effect.stage !== stage || effect.scheduledTick > now) {
          remaining.push(effect);
          continue;
        }
        consumed = true;
        const outcome = enqueueEffect(effect);
        // Deferred kinds (spawn/taunt/objective/world, internal charge/status)
        // are dropped here — they have no kernel port this phase (§6.1/§7).
        if (outcome.status === 'mapped') context.commands.push(outcome.command);
      }
      if (consumed) context.commands.push({ kind: 'set_planned_effects', effects: remaining });
    },
  });
}
