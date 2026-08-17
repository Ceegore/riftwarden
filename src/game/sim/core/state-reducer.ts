import { isTerminalBattlePhase, transitionBattlePhase } from './battle-state.js';
import type { BattleModel } from './battle-model.js';
import type { KernelCommand, BattleTransitionRequest } from './command-types.js';
import { transitionEntityPhase, selectEntityTransition, type TransitionRequest } from './entity-state.js';
import { validateEntity } from './entity.js';
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

export function applyStageCommands(args: ApplyStageCommandsArgs): BattleModel {
  let entities = [...args.state.entities];
  let phase = args.state.phase;
  let endReason = args.state.endReason;
  const beforeEvents = args.log.size();
  const transitions = new Map<string, TransitionRequest[]>();
  const battleTransitions: BattleTransitionRequest[] = [];

  for (const command of args.commands) {
    if (args.state.phase.phase === 'INTRO') {
      const eventType = command.kind === 'schedule_event' ? command.event.event.type : command.kind === 'append_event' ? command.event.type : null;
      if (eventType !== null) {
        const category = EVENT_SPEC[eventType].category;
        if (category === 'combat' || category === 'ability') {
          throw new KernelInvariantError('P14_STATE_TRANSITION_INVALID', { reason: 'intro-authoritative-action', type: eventType });
        }
      }
    }
    switch (command.kind) {
      case 'schedule_event':
        if (args.state.emittedEventCount + args.log.size() + args.queue.size() >= 10000) throw new KernelInvariantError('P14_QUEUE_CAP', { kind: 'battle-total' });
        args.queue.plan(command.event, args.atTick, args.stagePriority);
        break;
      case 'append_event':
        if (args.state.emittedEventCount + args.log.size() + args.queue.size() >= 10000) throw new KernelInvariantError('P14_QUEUE_CAP', { kind: 'battle-total' });
        args.log.append(args.atTick, args.allocate(), command.event);
        break;
      case 'entity_transition': {
        const list = transitions.get(command.entityId) ?? [];
        list.push(command.request);
        transitions.set(command.entityId, list);
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
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, lp: 0, shield: 0, phase: transitionEntityPhase(e.phase, 'REMOVED', args.atTick) }) : e));
        break;
      case 'set_target':
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, targetId: command.targetId }) : e));
        break;
      case 'set_position':
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, lane: command.lane, x100: command.x100 }) : e));
        break;
      case 'apply_lp_delta':
        entities = entities.map((e) => (e.id === command.entityId ? Object.freeze({ ...e, lp: Math.max(0, Math.min(e.maxLp, e.lp + command.delta)) }) : e));
        break;
      case 'set_timer':
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
  return Object.freeze({
    ...args.state,
    phase,
    endReason,
    emittedEventCount: args.state.emittedEventCount + (args.log.size() - beforeEvents),
    entities: Object.freeze(entities),
    scheduledEvents: args.queue.snapshot(),
  });
}
