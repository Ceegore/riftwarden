import type { KernelEventInput } from '../events/event-types.js';
import type { KernelEntity } from '../core/entity.js';
import type { KernelSystem, TickContext } from '../core/tick-context.js';
import {
  MIN_ATTACK_INTERVAL_TICKS,
  commitAttack,
  completeRecovery,
  interruptAttack,
  isAttackTargetValid,
  recoveryLockedUntilTick,
  startPrepare,
  validateAttackParameters,
  type AttackParameters,
  type AttackTransition,
} from './attack-state.js';

export interface BasicAttackSystemConfig {
  /**
   * Attack parameters per entity (ticks converted from seconds at content
   * load). Entities without an entry never start an attack.
   */
  readonly parameters: Readonly<Record<string, AttackParameters>>;
}

function eventFor(type: 'AttackPrepared'|'AttackInterrupted'|'AttackCommitted'|'AttackRecoveryStarted'|'AttackCycleCompleted', entityId: string, payload: Record<string, number>): KernelEventInput {
  return Object.freeze({ type, sourceId: entityId, targetIds: Object.freeze([]), contentIds: Object.freeze([]), payload: Object.freeze(payload), logTags: Object.freeze(['sim.phase17']) });
}

function findEntity(entities: readonly KernelEntity[], id: string): KernelEntity | undefined {
  return entities.find((e) => e.id === id);
}

function emit(context: TickContext, transition: AttackTransition, entityId: string): void {
  const eventName = {
    prepared: 'AttackPrepared',
    committed: 'AttackCommitted',
    recovery_started: 'AttackRecoveryStarted',
    cycle_completed: 'AttackCycleCompleted',
    interrupted: 'AttackInterrupted',
  }[transition.event] as 'AttackPrepared'|'AttackInterrupted'|'AttackCommitted'|'AttackRecoveryStarted'|'AttackCycleCompleted';
  context.commands.push({ kind: 'append_event', event: eventFor(eventName, entityId, transition.payload) });
}

/**
 * Stage-G basic-attack lifecycle (§P17-T01). From the frozen prior state:
 *
 * - IDLE: an entity with a valid, in-range target and `tick >= intervalReady`
 *   starts preparing (one instance per entity; §5.1 "previous begin + interval"
 *   gates the next attack, so tempo never double-fires).
 * - PREPARE: if the target becomes invalid before the wind-up ends, the attack
 *   is interrupted (§5.3 "target loss before commit") and the E stage
 *   re-targets at the earliest next tick — never a retarget-and-commit in the
 *   same tick. Otherwise the wind-up commits, which starts recovery and locks
 *   movement through the first half (§5.2, odd counts use ceil).
 * - RECOVERY: after the recovery window the cycle completes and the entity
 *   returns to IDLE; the next attack is gated by the interval.
 *
 * Damage application is Phase 17 T04 (stage I); this system only records the
 * authoritative lifecycle and its diagnostics.
 */
export function createBasicAttackSystem(config: BasicAttackSystemConfig): KernelSystem {
  for (const [id, params] of Object.entries(config.parameters)) {
    try {
      validateAttackParameters(params);
    } catch (error) {
      throw error instanceof Error ? new Error(`attack parameters invalid for ${id}: ${error.message}`) : error;
    }
  }
  return {
    id: 'phase17.g1.basic_attack',
    stage: 'G',
    run(context: TickContext): void {
      const tick = context.state.tick;
      for (const source of context.state.entities) {
        if (source.phase.phase !== 'ACTIVE') continue;
        const params = config.parameters[source.id];
        if (params === undefined) continue;
        const current = source.attackState ?? null;

        if (current === null) {
          // IDLE → PREPARE. Needs a committed target, inclusive range and the
          // interval gate (previous begin + interval, §5.2) to have elapsed.
          const targetId = source.targetId;
          if (targetId === null || tick < (source.attackIntervalReadyTick ?? 0)) continue;
          const target = findEntity(context.state.entities, targetId);
          if (!isAttackTargetValid(source, target, params.preferredRangeX100)) continue;
          const instance = (source.attackInstanceSeq ?? 0) + 1; // per-entity monotonic counter
          const transition = startPrepare(instance, source.id, targetId, tick, params.prepareTicks);
          context.commands.push({ kind: 'set_attack_lifecycle', entityId: source.id, state: transition.state, recoveryMovementLockedUntilTick: 0 });
          context.commands.push({ kind: 'set_attack_instance_seq', entityId: source.id, seq: instance });
          emit(context, transition, source.id);
          continue;
        }

        if (current.commitTick === null) {
          // PREPARE: abort on target loss, else commit when wind-up elapses.
          const target = findEntity(context.state.entities, current.targetId);
          const targetStillValid = isAttackTargetValid(source, target, params.preferredRangeX100);
          if (!targetStillValid) {
            const transition = interruptAttack(0);
            context.commands.push({ kind: 'set_attack_lifecycle', entityId: source.id, state: null, recoveryMovementLockedUntilTick: 0 });
            emit(context, transition, source.id);
            continue;
          }
          if (tick >= current.prepareStartedTick + params.prepareTicks) {
            const committed = commitAttack(current, tick, params);
            const lockUntil = recoveryLockedUntilTick(tick, params.recoveryTicks);
            const interval = Math.max(params.attackIntervalTicks, MIN_ATTACK_INTERVAL_TICKS);
            context.commands.push({ kind: 'set_attack_lifecycle', entityId: source.id, state: committed.state, recoveryMovementLockedUntilTick: lockUntil });
            context.commands.push({ kind: 'set_attack_interval_ready', entityId: source.id, readyTick: current.prepareStartedTick + interval });
            emit(context, committed, source.id);
            // §5.4 recovery diagnostic: recovery begins at commit.
            const recovery = { event: 'recovery_started' as const, state: committed.state, payload: Object.freeze({ recoveryEndTick: tick + params.recoveryTicks }) };
            emit(context, recovery, source.id);
          }
          continue;
        }

        // RECOVERY: complete when the window elapses.
        if (current.recoveryEndTick !== null && tick >= current.recoveryEndTick) {
          const transition = completeRecovery();
          context.commands.push({ kind: 'set_attack_lifecycle', entityId: source.id, state: null, recoveryMovementLockedUntilTick: 0 });
          emit(context, transition, source.id);
        }
      }
    },
  };
}
