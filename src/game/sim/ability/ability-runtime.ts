import { KernelInvariantError } from '../core/invariant-error.js';
import type { KernelEntity } from '../core/entity.js';
import type { KernelSystem, TickContext } from '../core/tick-context.js';
import type { StatusInstance } from '../status/status-instance.js';
import { abilityEventInput, abilityRejectOrdinal, triggerReasonOrdinal } from './ability-events.js';
import { validateAbilityConfig, type AbilityConfig, type AbilityInstance } from './ability-system.js';
import { resolveTargetQuery, type TargetQuery, type TargetSnapshot } from './ability-target-query.js';
import { resolveInvalidTarget } from './invalid-target-policy.js';
import { evaluateTrigger, type TriggerContext, type TriggerEventRecord } from './trigger-evaluator.js';
import { validateTriggerNode, type TriggerNode } from './trigger-definition.js';
import type { EffectCommand, SourceSnapshot } from './effect-command.js';

/**
 * Phase 19 runtime wiring (handbook step 7). The pure trigger/target/lifecycle
 * modules are driven by two systems here:
 *
 * - stage D `phase19.d1.ability_trigger`: evaluates each `ready` ability's
 *   trigger against the immutable tick context; a match moves it to
 *   `waiting_target`, marks the §11 once-marker, and emits `AbilityTriggered`;
 * - stage E `phase19.e2.ability_target`: resolves the target query for each
 *   `waiting_target` ability and stores the target snapshot (or applies the
 *   closed invalid-target policy) with `AbilityTargetSelected`/
 *   `AbilityWaitingTarget`/`AbilityConsumed` events.
 *
 * The stage-G lifecycle (charge/cast/commit + effect dispatch) lives in
 * `ability-lifecycle-system.ts`. Abilities never mutate HP/shield/status/
 * position directly — they only publish state via `set_abilities` and compose
 * closed effect commands (§3).
 *
 * Deferred (documented): `eventsThisTick` and `hpBeforeTick` are empty until
 * event/HP-history persistence lands, so `ally_event`/`enemy_event`/
 * `entity_defeated`/`hp_threshold_crossed` triggers evaluate to `no_match` in
 * the runtime (the pure evaluator is fully tested).
 */

export interface EffectComposeContext {
  readonly abilityInstanceId: string;
  readonly abilityId: string;
  readonly commitTick: number;
  readonly source: SourceSnapshot;
  readonly target: TargetSnapshot;
}

export interface AbilityRuntimeDefinition {
  readonly config: AbilityConfig;
  readonly trigger: TriggerNode;
  readonly targetQuery: TargetQuery;
  readonly effects: (ctx: EffectComposeContext) => readonly EffectCommand[];
  /** §9: explicit authorization for `consume_without_effect` (default false). */
  readonly consumeAuthorized?: boolean;
}

export interface AbilityRuntimeConfig {
  readonly definitions: Readonly<Record<string, AbilityRuntimeDefinition>>;
  /** Authoritative boss ids for `boss_object` target space (content-supplied). */
  readonly bossIds?: ReadonlySet<string>;
}

const EMPTY_STATUSES: readonly StatusInstance[] = Object.freeze([]);
const EMPTY_EVENTS: readonly TriggerEventRecord[] = Object.freeze([]);
const EMPTY_SET: ReadonlySet<string> = new Set();

function definitionOf(config: AbilityRuntimeConfig, abilityId: string): AbilityRuntimeDefinition {
  const definition = config.definitions[abilityId];
  if (definition === undefined) {
    throw new KernelInvariantError('P19_ABILITY_MISSING_DEFINITION', { abilityId });
  }
  return definition;
}

function ownerOf(entities: readonly KernelEntity[], ownerId: string): KernelEntity | undefined {
  return entities.find((e) => e.id === ownerId);
}

function isAlive(entity: KernelEntity): boolean {
  return entity.phase.phase !== 'DEFEATED' && entity.phase.phase !== 'REMOVED';
}

function replaceInstance(abilities: readonly AbilityInstance[], next: AbilityInstance): readonly AbilityInstance[] {
  return Object.freeze(abilities.map((i) => (i.abilityInstanceId === next.abilityInstanceId ? next : i)));
}

function triggerContainsOnce(node: TriggerNode): boolean {
  if (node.type === 'once') return true;
  if (node.type === 'all' || node.type === 'any') return node.children.some(triggerContainsOnce);
  if (node.type === 'not') return triggerContainsOnce(node.child);
  return false;
}

function buildTriggerContext(context: TickContext, instance: AbilityInstance, owner: KernelEntity, config: AbilityRuntimeConfig): TriggerContext {
  return {
    battleTick: context.state.tick,
    ownerId: instance.ownerId,
    ownerSide: owner.side,
    entities: context.state.entities,
    statuses: context.state.statuses ?? EMPTY_STATUSES,
    battlePhase: context.state.phase,
    eventsThisTick: EMPTY_EVENTS,
    bossIds: config.bossIds ?? EMPTY_SET,
    chargeReady: instance.state === 'ready',
    onceFired: instance.onceFired,
    hpBeforeTick: new Map(),
  };
}

function validateDefinitions(config: AbilityRuntimeConfig): void {
  for (const [abilityId, definition] of Object.entries(config.definitions)) {
    if (definition.config.abilityId !== abilityId) {
      throw new KernelInvariantError('P19_ABILITY_INVALID', { reason: 'definition-id-mismatch', abilityId, configAbilityId: definition.config.abilityId });
    }
    validateAbilityConfig(definition.config);
    validateTriggerNode(definition.trigger);
  }
}

/** Stage D: evaluate triggers for `ready` abilities and move matches to `waiting_target`. */
export function createAbilityTriggerSystem(config: AbilityRuntimeConfig = { definitions: {} }): KernelSystem {
  validateDefinitions(config);
  return Object.freeze({
    id: 'phase19.d1.ability_trigger',
    stage: 'D' as const,
    run(context: TickContext): void {
      const abilities = context.state.abilities;
      if (abilities === undefined || abilities.length === 0) return;
      let next = abilities;
      let changed = false;
      for (const instance of abilities) {
        if (instance.state !== 'ready') continue;
        const definition = definitionOf(config, instance.abilityId);
        const owner = ownerOf(context.state.entities, instance.ownerId);
        if (owner === undefined || !isAlive(owner)) continue;
        const result = evaluateTrigger(definition.trigger, buildTriggerContext(context, instance, owner, config), instance.targetSnapshot?.entityId ?? null);
        if (!result.matched) continue;
        const updated: AbilityInstance = Object.freeze({
          ...instance,
          state: 'waiting_target',
          targetSnapshot: null,
          onceFired: instance.onceFired || triggerContainsOnce(definition.trigger),
        });
        next = replaceInstance(next, updated);
        changed = true;
        context.commands.push({
          kind: 'append_event',
          event: abilityEventInput('AbilityTriggered', owner.id, [], [instance.abilityId], { triggerOrdinal: triggerReasonOrdinal(result.reasonCode) }),
        });
      }
      if (changed) context.commands.push({ kind: 'set_abilities', abilities: next });
    },
  });
}

/** Stage E: resolve targets for `waiting_target` abilities and store the snapshot. */
export function createAbilityTargetSystem(config: AbilityRuntimeConfig = { definitions: {} }): KernelSystem {
  validateDefinitions(config);
  return Object.freeze({
    id: 'phase19.e2.ability_target',
    stage: 'E' as const,
    run(context: TickContext): void {
      const abilities = context.state.abilities;
      if (abilities === undefined || abilities.length === 0) return;
      const now = context.state.tick;
      let next = abilities;
      let changed = false;
      for (const instance of abilities) {
        if (instance.state !== 'waiting_target') continue;
        const definition = definitionOf(config, instance.abilityId);
        const owner = ownerOf(context.state.entities, instance.ownerId);
        if (owner === undefined || !isAlive(owner)) continue;
        const outcome = resolveTargetQuery(definition.targetQuery, {
          tick: now,
          source: owner,
          entities: context.state.entities,
          bossIds: config.bossIds ?? EMPTY_SET,
        });
        if (outcome.status === 'selected') {
          next = replaceInstance(next, Object.freeze({ ...instance, targetSnapshot: outcome.target }));
          changed = true;
          context.commands.push({
            kind: 'append_event',
            event: abilityEventInput('AbilityTargetSelected', owner.id, outcome.target.entityId === null ? [] : [outcome.target.entityId], [instance.abilityId], {}),
          });
          continue;
        }
        const policy = definition.config.invalidTargetPolicy;
        const resolution = resolveInvalidTarget(policy, {
          tick: now,
          policy,
          retargetedThisTick: false,
          consumeAuthorized: definition.consumeAuthorized === true,
        });
        if (resolution.action === 'consume_without_effect') {
          const usesRemaining = Math.max(0, instance.usesRemaining - 1);
          next = replaceInstance(next, Object.freeze({ ...instance, state: 'cooldown', chargeTicks: 0, usesRemaining, targetSnapshot: null, castStartTick: null, commitTick: null, cooldownRemaining: definition.config.cooldownTicks ?? 0 }));
          changed = true;
          context.commands.push({
            kind: 'append_event',
            event: abilityEventInput('AbilityConsumed', owner.id, [], [instance.abilityId], { usesRemaining }),
          });
          context.commands.push({
            kind: 'append_event',
            event: abilityEventInput('AbilityRejected', owner.id, [], [instance.abilityId], { reasonOrdinal: abilityRejectOrdinal('no_target') }),
          });
        } else {
          context.commands.push({
            kind: 'append_event',
            event: abilityEventInput('AbilityWaitingTarget', owner.id, [], [instance.abilityId], {}),
          });
        }
      }
      if (changed) context.commands.push({ kind: 'set_abilities', abilities: next });
    },
  });
}
