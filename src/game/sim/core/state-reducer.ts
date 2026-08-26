import { isTerminalBattlePhase, transitionBattlePhase } from './battle-state.js';
import type { BattleModel } from './battle-model.js';
import type { KernelCommand, BattleTransitionRequest } from './command-types.js';
import { transitionEntityPhase, selectEntityTransition, type TransitionRequest } from './entity-state.js';
import { validateEntity, validateLaneChange, type KernelEntity } from './entity.js';
import { validateShieldSource, type ShieldSource } from '../combat/shield-ledger.js';
import { validatePendingCombatApplication } from '../combat/application-validation.js';
import { validateProjectileState, type ProjectileState } from '../projectile/projectile-state.js';
import { createStatusCollection } from '../status/status-collection.js';
import type { StatusInstance } from '../status/status-instance.js';
import { createAbilityCollection } from '../ability/ability-collection.js';
import { canonicalizeEffectBatch } from '../ability/effect-executor.js';
import { createTemporaryCollection } from '../summon/temporary-registry.js';
import { canonicalizeSynergyTiers } from '../synergy/synergy-counter.js';
import { createBossPhaseSnapshot } from '../boss/boss-phase-system.js';
import { createModifierCollection } from '../world/modifier-system.js';
import { createHazardCollection } from '../world/hazard-system.js';
import { createObjectiveCollection } from '../objectives/combat-objective.js';
import { createSpawnedWaveCursor } from '../world/reinforcement-system.js';
import { KernelInvariantError } from './invariant-error.js';
import type { EventPriority, EventSequence, Tick } from './primitives.js';
import type { EventQueue } from '../scheduler/event-queue.js';
import type { EventLog } from '../events/event-log.js';
import { EVENT_SPEC } from '../events/event-spec.js';

export interface ApplyStageCommandsArgs {
  state: BattleModel;
  commands: readonly KernelCommand[];
  atTick: Tick;
  stagePriority: EventPriority;
  queue: EventQueue;
  log: EventLog;
  allocate: () => EventSequence;
}

const CLEANSE_KINDS = ['cleanse', 'dispel'] as const;
function requireEntity(entities: readonly KernelEntity[], entityId: string): KernelEntity {
  const entity = entities.find((candidate) => candidate.id === entityId);
  if (!entity) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'unknown-entity', entityId });
  return entity;
}

const LANES = ['top', 'middle', 'bottom'] as const;

function assertLane(lane: string): void {
  if (!(LANES as readonly string[]).includes(lane)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'lane-invalid', lane });
}

function assertNonNegativeSafe(value: number, reason: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason, value });
}

export function applyStageCommands(args: ApplyStageCommandsArgs): BattleModel {
  let entities = [...args.state.entities], phase = args.state.phase, endReason = args.state.endReason;
  let globalNoProgressTicks = args.state.globalNoProgressTicks, riftCollapseTicks = args.state.riftCollapseTicks, riftCollapseWarningEmitted = args.state.riftCollapseWarningEmitted;
  let projectiles = args.state.projectiles, pendingCombatApplications = args.state.pendingCombatApplications, combatApplicationSeq = args.state.combatApplicationSeq;
  let timeCollapseSinceTick = args.state.timeCollapseSinceTick, bossDamageDealt = args.state.bossDamageDealt, forcedOutcome = args.state.forcedOutcome;
  let statuses = args.state.statuses, pendingCleanses = args.state.pendingCleanses;
  let abilities = args.state.abilities, plannedEffects = args.state.plannedEffects, temporaryEntities = args.state.temporaryEntities, synergyTiers = args.state.synergyTiers, bossPhase = args.state.bossPhase, modifiers = args.state.modifiers, hazards = args.state.hazards, objectives = args.state.objectives, spawnedWaves = args.state.spawnedWaves;
  const beforeEvents = args.log.size();
  const transitions = new Map<string, TransitionRequest[]>();
  const battleTransitions: BattleTransitionRequest[] = [];

  for (const command of args.commands) {
    if (args.state.phase.phase === 'INTRO') {
      const eventType = command.kind === 'schedule_event' ? command.event.event.type : command.kind === 'append_event' ? command.event.type : null;
      if (eventType !== null && (EVENT_SPEC[eventType].category === 'combat' || EVENT_SPEC[eventType].category === 'ability')) throw new KernelInvariantError('P14_STATE_TRANSITION_INVALID', { reason: 'intro-authoritative-action', type: eventType });
    }
    switch (command.kind) {
      case 'schedule_event':
        if (args.state.emittedEventCount + (args.log.size() - beforeEvents) + args.queue.size() >= 10000) throw new KernelInvariantError('P14_QUEUE_CAP', { kind: 'battle-total' });
        args.queue.plan(command.event, args.atTick, args.stagePriority);
        break;
      case 'append_event':
        if (args.state.emittedEventCount + (args.log.size() - beforeEvents) + args.queue.size() >= 10000) throw new KernelInvariantError('P14_QUEUE_CAP', { kind: 'battle-total' });
        args.log.append(args.atTick, args.allocate(), command.event);
        break;
      case 'entity_transition': {
        const list = transitions.get(command.entityId) ?? [];
        transitions.set(command.entityId, [...list, command.request]);
        break;
      }
      case 'battle_transition':
        battleTransitions.push(command);
        break;
      case 'force_battle_outcome':
        if (!(['VICTORY', 'DEFEAT', 'DRAW_ABORT'] as readonly string[]).includes(command.outcome)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'forced-outcome-invalid', outcome: command.outcome });
        if (typeof command.reason !== 'string' || command.reason.length === 0) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'forced-outcome-reason-invalid' });
        forcedOutcome = Object.freeze({ outcome: command.outcome, reason: command.reason });
        break;
      case 'spawn_entity':
        if (entities.some((e) => e.id === command.entity.id)) throw new KernelInvariantError('P14_DUPLICATE_ENTITY', { id: command.entity.id });
        validateEntity(command.entity);
        entities.push(command.entity);
        break;
      case 'remove_entity':
        requireEntity(entities, command.entityId);
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, lp: 0, shield: 0, phase: transitionEntityPhase(e.phase, 'REMOVED', args.atTick) }) : e));
        break;
      case 'set_target':
        requireEntity(entities, command.entityId);
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, targetId: command.targetId }) : e));
        break;
      case 'set_position':
        requireEntity(entities, command.entityId);
        assertLane(command.lane);
        if (!Number.isSafeInteger(command.x100) || command.x100 < 0 || command.x100 > 10000 || Object.is(command.x100, -0)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'x100-out-of-range', entityId: command.entityId, x100: command.x100 });
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, lane: command.lane, x100: command.x100 }) : e));
        break;
      case 'set_movement_remainder':
        requireEntity(entities, command.entityId);
        if (!Number.isInteger(command.remainder) || command.remainder < 0 || command.remainder >= 30 || Object.is(command.remainder, -0)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'movement-remainder-invalid', entityId: command.entityId, remainder: command.remainder });
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, movementRemainder: command.remainder }) : e));
        break;
      case 'set_lane':
        requireEntity(entities, command.entityId);
        assertLane(command.lane);
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, lane: command.lane }) : e));
        break;
      case 'set_lane_change':
        requireEntity(entities, command.entityId);
        if (command.state !== null) validateLaneChange(command.state);
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, laneChange: command.state }) : e));
        break;
      case 'set_attack_state':
        requireEntity(entities, command.entityId);
        if (command.inRangeSinceTick !== null) assertNonNegativeSafe(command.inRangeSinceTick, 'in-range-since-tick-invalid');
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, inRangeSinceTick: command.inRangeSinceTick }) : e));
        break;
      case 'set_attack_instance_seq':
        requireEntity(entities, command.entityId);
        if (!Number.isSafeInteger(command.seq) || command.seq < 0 || Object.is(command.seq, -0)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'attack-instance-seq-invalid', entityId: command.entityId, seq: command.seq });
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, attackInstanceSeq: command.seq }) : e));
        break;
      case 'set_attack_interval_ready':
        requireEntity(entities, command.entityId);
        if (!Number.isSafeInteger(command.readyTick) || command.readyTick < 0 || Object.is(command.readyTick, -0)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'attack-interval-ready-invalid', entityId: command.entityId, readyTick: command.readyTick });
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, attackIntervalReadyTick: command.readyTick }) : e));
        break;
      case 'set_attack_lifecycle':
        requireEntity(entities, command.entityId);
        if (command.state !== null && (!Number.isSafeInteger(command.recoveryMovementLockedUntilTick) || command.recoveryMovementLockedUntilTick < 0 || Object.is(command.recoveryMovementLockedUntilTick, -0))) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'attack-recovery-lock-invalid', entityId: command.entityId });
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze(command.state === null ? { ...e, attackState: null, recoveryMovementLockedUntilTick: 0 } : { ...e, attackState: command.state, recoveryMovementLockedUntilTick: command.recoveryMovementLockedUntilTick }) : e));
        break;
      case 'set_lane_change_cooldown':
        requireEntity(entities, command.entityId);
        assertNonNegativeSafe(command.untilTick, 'lane-change-cooldown-invalid');
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, normalLaneChangeCooldownUntilTick: command.untilTick }) : e));
        break;
      case 'set_stuck_state':
        requireEntity(entities, command.entityId);
        assertNonNegativeSafe(command.noProgressTicks, 'no-progress-ticks-invalid');
        for (const value of command.repathTicks) assertNonNegativeSafe(value, 'repath-tick-invalid');
        if (typeof command.laneFallbackUsed !== 'boolean') throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'lane-fallback-invalid' });
        assertNonNegativeSafe(command.stopGapBonusUntilTick, 'stop-gap-bonus-until-tick-invalid');
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, noProgressTicks: command.noProgressTicks, repathTicks: Object.freeze([...command.repathTicks]), laneFallbackUsed: command.laneFallbackUsed, stuckStopGapBonusUntilTick: command.stopGapBonusUntilTick }) : e));
        break;
      case 'set_deadlock_state':
        requireEntity(entities, command.entityId);
        assertNonNegativeSafe(command.blockedTicks, 'deadlock-blocked-ticks-invalid');
        if (typeof command.buffConsumed !== 'boolean') throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'deadlock-buff-consumed-invalid' });
        if (command.buffedEntityId !== null && !/^[a-z][a-z0-9_]*$/.test(command.buffedEntityId)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'deadlock-buffed-entity-invalid', buffedEntityId: command.buffedEntityId });
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, frontDeadlockBlockedTicks: command.blockedTicks, deadlockBuffConsumed: command.buffConsumed, deadlockBuffedEntityId: command.buffedEntityId }) : e));
        break;
      case 'set_global_progress':
        assertNonNegativeSafe(command.noProgressTicks, 'global-no-progress-invalid');
        assertNonNegativeSafe(command.collapseTicks, 'rift-collapse-ticks-invalid');
        if (typeof command.warned !== 'boolean') throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'rift-warned-invalid' });
        globalNoProgressTicks = command.noProgressTicks; riftCollapseTicks = command.collapseTicks; riftCollapseWarningEmitted = command.warned;
        break;
      case 'set_shields': {
        requireEntity(entities, command.entityId);
        if (!Array.isArray(command.shields)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'shields-not-array' });
        const shields: ShieldSource[] = command.shields.map((source) => { if (typeof source !== 'object' || source === null) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'shields-source-invalid' }); validateShieldSource(source as ShieldSource); return source as ShieldSource; });
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, shields: Object.freeze(shields) }) : e));
        break;
      }
      case 'queue_combat_application': {
        validatePendingCombatApplication(command.application);
        const seq = (combatApplicationSeq ?? 0) + 1;
        combatApplicationSeq = seq;
        const queued = command.application.kind === 'shield' ? Object.freeze({ ...command.application, applicationSequence: seq }) : command.application;
        pendingCombatApplications = Object.freeze([...(pendingCombatApplications ?? []), queued]);
        break;
      }
      case 'clear_combat_applications':
        pendingCombatApplications = Object.freeze([]);
        break;
      case 'set_pending_overkill':
        requireEntity(entities, command.entityId);
        if (!Number.isSafeInteger(command.overkill) || command.overkill < 0 || Object.is(command.overkill, -0)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'overkill-invalid', entityId: command.entityId, overkill: command.overkill });
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, pendingOverkill: command.overkill }) : e));
        break;
      case 'set_revive_count':
        requireEntity(entities, command.entityId);
        if (!Number.isSafeInteger(command.count) || command.count < 0 || Object.is(command.count, -0)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'revive-count-invalid', entityId: command.entityId, count: command.count });
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, reviveCount: command.count }) : e));
        break;
      case 'set_time_collapse':
        if (command.sinceTick !== null && (!Number.isSafeInteger(command.sinceTick) || command.sinceTick < 0 || Object.is(command.sinceTick, -0))) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'time-collapse-invalid', sinceTick: command.sinceTick });
        timeCollapseSinceTick = command.sinceTick ?? undefined;
        break;
      case 'record_boss_damage':
        if (!Number.isSafeInteger(command.amount) || command.amount < 0) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'boss-damage-amount', amount: command.amount });
        bossDamageDealt = Object.freeze({ ...(bossDamageDealt ?? Object.freeze({ player: 0, enemy: 0 })), [command.side]: (bossDamageDealt?.[command.side] ?? 0) + command.amount });
        break;
      case 'set_projectiles': {
        if (!Array.isArray(command.projectiles)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'projectiles-not-array' });
        const validated: ProjectileState[] = command.projectiles.map((projectile) => { if (typeof projectile !== 'object' || projectile === null) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'projectile-invalid' }); validateProjectileState(projectile as ProjectileState); return projectile as ProjectileState; });
        projectiles = Object.freeze(validated);
        break;
      }
      case 'set_statuses':
        if (!Array.isArray(command.statuses)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'statuses-not-array' });
        statuses = createStatusCollection(command.statuses as readonly StatusInstance[]);
        break;
      case 'queue_cleanse_dispel':
        if (!/^[a-z][a-z0-9_]*$/.test(command.targetId) || !(CLEANSE_KINDS as readonly string[]).includes(command.request)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'cleanse-request-invalid', targetId: command.targetId, kind: command.request });
        pendingCleanses = Object.freeze([...(pendingCleanses ?? []), Object.freeze({ targetId: command.targetId, kind: command.request })]);
        break;
      case 'clear_pending_cleanses':
        pendingCleanses = Object.freeze([]);
        break;
      case 'set_abilities':
        if (!Array.isArray(command.abilities)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'abilities-not-array' });
        abilities = createAbilityCollection(command.abilities);
        break;
      case 'set_planned_effects':
        if (!Array.isArray(command.effects)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'planned-effects-not-array' });
        plannedEffects = canonicalizeEffectBatch(command.effects);
        break;
      case 'set_temporary_entities':
        if (!Array.isArray(command.entities)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'temporary-entities-not-array' });
        temporaryEntities = createTemporaryCollection(command.entities);
        break;
      case 'set_synergy_tiers':
        synergyTiers = canonicalizeSynergyTiers(command.tiers);
        break;
      case 'set_boss_phase': bossPhase = createBossPhaseSnapshot(command.bossPhase); break;
      case 'set_modifiers': modifiers = createModifierCollection(command.modifiers); break;
      case 'set_hazards': hazards = createHazardCollection(command.hazards); break;
      case 'set_objectives': objectives = createObjectiveCollection(command.objectives); break;
      case 'set_spawned_waves': spawnedWaves = createSpawnedWaveCursor(command.spawnedWaves); break;
      case 'apply_lp_delta': {
        requireEntity(entities, command.entityId);
        if (!Number.isSafeInteger(command.delta)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'lp-delta-not-integer', entityId: command.entityId, delta: command.delta });
        // §9.3: the deadlock melee buff ends on the buffed unit's first hit.
        entities = entities.map((e) => {
          if (e.id !== command.entityId) return e;
          const next = Object.freeze({ ...e, lp: Math.max(0, Math.min(e.maxLp, e.lp + command.delta)) });
          return command.delta < 0 && command.sourceId != null && next.deadlockBuffedEntityId != null ? Object.freeze({ ...next, deadlockBuffedEntityId: null, deadlockBuffConsumed: true }) : next;
        });
        break;
      }
      case 'set_timer':
        requireEntity(entities, command.entityId);
        if (!Number.isSafeInteger(command.ticks) || command.ticks < 0 || Object.is(command.ticks, -0)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'timer-ticks-invalid', entityId: command.entityId, ticks: command.ticks });
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, timers: Object.freeze({ ...e.timers, [command.timer]: command.ticks }) }) : e));
        break;
      case 'checkpoint_marker':
        break;
    }
  }

  for (const [id, requests] of transitions) {
    const entity = entities.find((e) => e.id === id);
    if (!entity) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'transition-unknown-entity', id });
    const selected = selectEntityTransition(requests);
    if (selected) entities = entities.map((e) => (e.id === id ? Object.freeze({ ...e, phase: transitionEntityPhase(e.phase, selected.to, args.atTick) }) : e));
  }

  if (battleTransitions.length > 0) {
    const ordered = [...battleTransitions].sort((a, b) => b.priority - a.priority || (a.to < b.to ? -1 : a.to > b.to ? 1 : 0));
    const winner = ordered[0] ?? Object.freeze({ to: 'ACTIVE' as const, priority: 0, reason: 'unreachable' });
    // Like selectEntityTransition: ANY same-priority request targeting another phase is a hard conflict — not just the second element, so [VICTORY, VICTORY, DEFEAT] is caught too.
    if (ordered.some((r, i) => i > 0 && r.priority === winner.priority && r.to !== winner.to)) throw new KernelInvariantError('P14_TRANSITION_CONFLICT', { kind: 'battle', winner: winner.to });
    phase = transitionBattlePhase(phase, winner.to, args.atTick);
    if (isTerminalBattlePhase(phase.phase)) endReason = winner.reason;
  }

  args.queue.commitPlanned(args.allocate);
  const extras: Record<string, unknown> = {};
  if (globalNoProgressTicks !== undefined) extras['globalNoProgressTicks'] = globalNoProgressTicks; if (riftCollapseTicks !== undefined) extras['riftCollapseTicks'] = riftCollapseTicks; if (riftCollapseWarningEmitted !== undefined) extras['riftCollapseWarningEmitted'] = riftCollapseWarningEmitted;
  if (projectiles !== undefined) extras['projectiles'] = projectiles; if (pendingCombatApplications !== undefined) extras['pendingCombatApplications'] = pendingCombatApplications; if (combatApplicationSeq !== undefined) extras['combatApplicationSeq'] = combatApplicationSeq;
  if (timeCollapseSinceTick !== undefined) extras['timeCollapseSinceTick'] = timeCollapseSinceTick; if (bossDamageDealt !== undefined) extras['bossDamageDealt'] = bossDamageDealt; if (forcedOutcome !== undefined) extras['forcedOutcome'] = forcedOutcome; if (statuses !== undefined) extras['statuses'] = statuses;
  if (pendingCleanses !== undefined) extras['pendingCleanses'] = pendingCleanses; if (abilities !== undefined) extras['abilities'] = abilities; if (plannedEffects !== undefined) extras['plannedEffects'] = plannedEffects;
  if (temporaryEntities !== undefined) extras['temporaryEntities'] = temporaryEntities; if (synergyTiers !== undefined) extras['synergyTiers'] = synergyTiers; if (bossPhase !== undefined) extras['bossPhase'] = bossPhase;
  if (modifiers !== undefined) extras['modifiers'] = modifiers; if (hazards !== undefined) extras['hazards'] = hazards; if (objectives !== undefined) extras['objectives'] = objectives;
  if (spawnedWaves !== undefined) extras['spawnedWaves'] = spawnedWaves;
  return Object.freeze({
    ...args.state,
    phase,
    endReason,
    emittedEventCount: args.state.emittedEventCount + (args.log.size() - beforeEvents),
    entities: Object.freeze(entities),
    scheduledEvents: args.queue.snapshot(),
    ...extras,
  });
}
