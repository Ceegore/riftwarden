import { isTerminalBattlePhase, transitionBattlePhase } from './battle-state.js';
import type { BattleModel } from './battle-model.js';
import type { KernelCommand, BattleTransitionRequest } from './command-types.js';
import { transitionEntityPhase, selectEntityTransition, type TransitionRequest } from './entity-state.js';
import { validateEntity, validateLaneChange, type KernelEntity } from './entity.js';
import { validateShieldSource, type ShieldSource } from '../combat/shield-ledger.js';
import { validatePendingCombatApplication } from '../combat/application-validation.js';
import { validateProjectileState, type ProjectileState } from '../projectile/projectile-state.js';
import { createStatusCollection, type StatusCollection } from '../status/status-collection.js';
import type { StatusInstance } from '../status/status-instance.js';
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
  let entities = [...args.state.entities];
  let phase = args.state.phase;
  let endReason = args.state.endReason;
  let globalNoProgressTicks = args.state.globalNoProgressTicks;
  let riftCollapseTicks = args.state.riftCollapseTicks;
  let riftCollapseWarningEmitted = args.state.riftCollapseWarningEmitted;
  let projectiles = args.state.projectiles;
  let pendingCombatApplications = args.state.pendingCombatApplications;
  let combatApplicationSeq = args.state.combatApplicationSeq;
  let timeCollapseSinceTick = args.state.timeCollapseSinceTick;
  let bossDamageDealt = args.state.bossDamageDealt;
  let statuses: StatusCollection | undefined = args.state.statuses;
  const beforeEvents = args.log.size();
  const transitions = new Map<string, TransitionRequest[]>();
  const battleTransitions: BattleTransitionRequest[] = [];

  for (const command of args.commands) {
    if (args.state.phase.phase === 'INTRO') {
      const eventType = command.kind === 'schedule_event' ? command.event.event.type : command.kind === 'append_event' ? command.event.type : null;
      if (eventType !== null && (EVENT_SPEC[eventType].category === 'combat' || EVENT_SPEC[eventType].category === 'ability')) {
        throw new KernelInvariantError('P14_STATE_TRANSITION_INVALID', { reason: 'intro-authoritative-action', type: eventType });
      }
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
      case 'set_position': {
        requireEntity(entities, command.entityId);
        if (!Number.isSafeInteger(command.x100) || command.x100 < 0 || command.x100 > 10000 || Object.is(command.x100, -0)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'x100-out-of-range', entityId: command.entityId, x100: command.x100 });
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, lane: command.lane, x100: command.x100 }) : e));
        break;
      }
      case 'set_movement_remainder': {
        requireEntity(entities, command.entityId);
        if (!Number.isInteger(command.remainder) || command.remainder < 0 || command.remainder >= 30 || Object.is(command.remainder, -0)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'movement-remainder-invalid', entityId: command.entityId, remainder: command.remainder });
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, movementRemainder: command.remainder }) : e));
        break;
      }
      case 'set_lane': {
        requireEntity(entities, command.entityId);
        assertLane(command.lane);
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, lane: command.lane }) : e));
        break;
      }
      case 'set_lane_change': {
        requireEntity(entities, command.entityId);
        if (command.state !== null) validateLaneChange(command.state);
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, laneChange: command.state }) : e));
        break;
      }
      case 'set_attack_state': {
        requireEntity(entities, command.entityId);
        if (command.inRangeSinceTick !== null) assertNonNegativeSafe(command.inRangeSinceTick, 'in-range-since-tick-invalid');
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, inRangeSinceTick: command.inRangeSinceTick }) : e));
        break;
      }
      case 'set_attack_instance_seq': {
        requireEntity(entities, command.entityId);
        if (!Number.isSafeInteger(command.seq) || command.seq < 0 || Object.is(command.seq, -0)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'attack-instance-seq-invalid', entityId: command.entityId, seq: command.seq });
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, attackInstanceSeq: command.seq }) : e));
        break;
      }
      case 'set_attack_interval_ready': {
        requireEntity(entities, command.entityId);
        if (!Number.isSafeInteger(command.readyTick) || command.readyTick < 0 || Object.is(command.readyTick, -0)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'attack-interval-ready-invalid', entityId: command.entityId, readyTick: command.readyTick });
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, attackIntervalReadyTick: command.readyTick }) : e));
        break;
      }
      case 'set_attack_lifecycle': {
        requireEntity(entities, command.entityId);
        if (command.state !== null && (!Number.isSafeInteger(command.recoveryMovementLockedUntilTick) || command.recoveryMovementLockedUntilTick < 0 || Object.is(command.recoveryMovementLockedUntilTick, -0))) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'attack-recovery-lock-invalid', entityId: command.entityId });
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze(command.state === null ? { ...e, attackState: null, recoveryMovementLockedUntilTick: 0 } : { ...e, attackState: command.state, recoveryMovementLockedUntilTick: command.recoveryMovementLockedUntilTick }) : e));
        break;
      }
      case 'set_lane_change_cooldown': {
        requireEntity(entities, command.entityId);
        assertNonNegativeSafe(command.untilTick, 'lane-change-cooldown-invalid');
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, normalLaneChangeCooldownUntilTick: command.untilTick }) : e));
        break;
      }
      case 'set_stuck_state': {
        requireEntity(entities, command.entityId);
        assertNonNegativeSafe(command.noProgressTicks, 'no-progress-ticks-invalid');
        for (const value of command.repathTicks) assertNonNegativeSafe(value, 'repath-tick-invalid');
        if (typeof command.laneFallbackUsed !== 'boolean') throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'lane-fallback-invalid' });
        assertNonNegativeSafe(command.stopGapBonusUntilTick, 'stop-gap-bonus-until-tick-invalid');
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, noProgressTicks: command.noProgressTicks, repathTicks: Object.freeze([...command.repathTicks]), laneFallbackUsed: command.laneFallbackUsed, stuckStopGapBonusUntilTick: command.stopGapBonusUntilTick }) : e));
        break;
      }
      case 'set_deadlock_state': {
        requireEntity(entities, command.entityId);
        assertNonNegativeSafe(command.blockedTicks, 'deadlock-blocked-ticks-invalid');
        if (typeof command.buffConsumed !== 'boolean') throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'deadlock-buff-consumed-invalid' });
        if (command.buffedEntityId !== null && !/^[a-z][a-z0-9_]*$/.test(command.buffedEntityId)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'deadlock-buffed-entity-invalid', buffedEntityId: command.buffedEntityId });
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, frontDeadlockBlockedTicks: command.blockedTicks, deadlockBuffConsumed: command.buffConsumed, deadlockBuffedEntityId: command.buffedEntityId }) : e));
        break;
      }
      case 'set_global_progress': {
        assertNonNegativeSafe(command.noProgressTicks, 'global-no-progress-invalid');
        assertNonNegativeSafe(command.collapseTicks, 'rift-collapse-ticks-invalid');
        if (typeof command.warned !== 'boolean') throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'rift-warned-invalid' });
        globalNoProgressTicks = command.noProgressTicks; riftCollapseTicks = command.collapseTicks; riftCollapseWarningEmitted = command.warned;
        break;
      }
      case 'set_shields': {
        requireEntity(entities, command.entityId);
        if (!Array.isArray(command.shields)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'shields-not-array' });
        const shields: ShieldSource[] = command.shields.map((source) => {
          if (typeof source !== 'object' || source === null) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'shields-source-invalid' });
          validateShieldSource(source as ShieldSource);
          return source as ShieldSource;
        });
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
      case 'set_pending_overkill': {
        requireEntity(entities, command.entityId);
        if (!Number.isSafeInteger(command.overkill) || command.overkill < 0 || Object.is(command.overkill, -0)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'overkill-invalid', entityId: command.entityId, overkill: command.overkill });
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, pendingOverkill: command.overkill }) : e));
        break;
      }
      case 'set_revive_count': {
        requireEntity(entities, command.entityId);
        if (!Number.isSafeInteger(command.count) || command.count < 0 || Object.is(command.count, -0)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'revive-count-invalid', entityId: command.entityId, count: command.count });
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, reviveCount: command.count }) : e));
        break;
      }
      case 'set_time_collapse': {
        if (command.sinceTick !== null && (!Number.isSafeInteger(command.sinceTick) || command.sinceTick < 0 || Object.is(command.sinceTick, -0))) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'time-collapse-invalid', sinceTick: command.sinceTick });
        timeCollapseSinceTick = command.sinceTick ?? undefined;
        break;
      }
      case 'record_boss_damage': {
        if (!Number.isSafeInteger(command.amount) || command.amount < 0) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'boss-damage-amount', amount: command.amount });
        const current = bossDamageDealt ?? Object.freeze({ player: 0, enemy: 0 });
        bossDamageDealt = Object.freeze({ ...current, [command.side]: current[command.side] + command.amount });
        break;
      }
      case 'set_projectiles': {
        if (!Array.isArray(command.projectiles)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'projectiles-not-array' });
        const validated: ProjectileState[] = command.projectiles.map((projectile) => {
          if (typeof projectile !== 'object' || projectile === null) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'projectile-invalid' });
          validateProjectileState(projectile as ProjectileState);
          return projectile as ProjectileState;
        });
        projectiles = Object.freeze(validated);
        break;
      }
      case 'set_statuses': {
        if (!Array.isArray(command.statuses)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'statuses-not-array' });
        statuses = createStatusCollection(command.statuses as readonly StatusInstance[]);
        break;
      }
      case 'apply_lp_delta': {
        requireEntity(entities, command.entityId);
        if (!Number.isSafeInteger(command.delta)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'lp-delta-not-integer', entityId: command.entityId, delta: command.delta });
        // §9.3: the deadlock melee buff ends on the buffed unit's first hit.
        entities = entities.map((e) => {
          if (e.id !== command.entityId) return e;
          const next = Object.freeze({ ...e, lp: Math.max(0, Math.min(e.maxLp, e.lp + command.delta)) });
          if (command.delta < 0 && command.sourceId != null && next.deadlockBuffedEntityId != null) return Object.freeze({ ...next, deadlockBuffedEntityId: null, deadlockBuffConsumed: true });
          return next;
        });
        break;
      }
      case 'set_timer': {
        requireEntity(entities, command.entityId);
        if (!Number.isSafeInteger(command.ticks) || command.ticks < 0 || Object.is(command.ticks, -0)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'timer-ticks-invalid', entityId: command.entityId, ticks: command.ticks });
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, timers: Object.freeze({ ...e.timers, [command.timer]: command.ticks }) }) : e));
        break;
      }
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
    const winner = ordered[0];
    const conflict = ordered[1];
    if (winner !== undefined && conflict?.priority === winner.priority && conflict.to !== winner.to) {
      throw new KernelInvariantError('P14_TRANSITION_CONFLICT', { kind: 'battle' });
    }
    if (winner) {
      phase = transitionBattlePhase(phase, winner.to, args.atTick);
      if (isTerminalBattlePhase(phase.phase)) endReason = winner.reason;
    }
  }

  args.queue.commitPlanned(args.allocate);
  const extras: Record<string, unknown> = {};
  if (globalNoProgressTicks !== undefined) extras['globalNoProgressTicks'] = globalNoProgressTicks;
  if (riftCollapseTicks !== undefined) extras['riftCollapseTicks'] = riftCollapseTicks;
  if (riftCollapseWarningEmitted !== undefined) extras['riftCollapseWarningEmitted'] = riftCollapseWarningEmitted;
  if (projectiles !== undefined) extras['projectiles'] = projectiles;
  if (pendingCombatApplications !== undefined) extras['pendingCombatApplications'] = pendingCombatApplications;
  if (combatApplicationSeq !== undefined) extras['combatApplicationSeq'] = combatApplicationSeq;
  if (timeCollapseSinceTick !== undefined) extras['timeCollapseSinceTick'] = timeCollapseSinceTick;
  if (bossDamageDealt !== undefined) extras['bossDamageDealt'] = bossDamageDealt;
  if (statuses !== undefined) extras['statuses'] = statuses;
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
