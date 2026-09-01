import { KernelInvariantError } from '../core/invariant-error.js';
import { PERMANENT_END_TICK, type StatusInstance } from './status-instance.js';

/**
 * Phase 18 T03 periodic scheduling core (§7). Pure and deterministic — the
 * stage-C system consumes these helpers to plan due periodics and the stage-I
 * pipeline applies them through the Phase-17 damage/heal/shield commands.
 *
 * §7.3 default anchor: a periodic is due only while `nextTick < endTick`
 * (endTick is exclusive). `nextTick == endTick` never fires — expiry wins.
 */

/** §7.1: first tick is `startTick + intervalTicks`, unless `initialTick` authorizes an apply-time tick. */
export function firstPeriodicTick(status: StatusInstance): number {
  const periodic = status.periodic;
  if (periodic === undefined) {
    throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'status-periodic-missing', statusId: status.statusId });
  }
  return periodic.initialTick ? status.startTick : status.startTick + periodic.intervalTicks;
}

/** §7.3: due iff the tick anchor is reached, the status is still active, and the anchor precedes the exclusive endTick. */
export function isPeriodicDue(status: StatusInstance, now: number): boolean {
  const periodic = status.periodic;
  if (periodic === undefined) return false;
  return now >= periodic.nextTick && now < status.endTick && periodic.nextTick < status.endTick;
}

/**
 * §7.1: advance `nextTick` by exactly `intervalTicks` (never `now + interval`),
 * so save/resume cannot drift, double-fire or skip a tick. Returns a new
 * frozen instance; the input is never mutated.
 */
export function advancePeriodic(status: StatusInstance): StatusInstance {
  const periodic = status.periodic;
  if (periodic === undefined) {
    throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'status-periodic-missing', statusId: status.statusId });
  }
  return Object.freeze({
    ...status,
    periodic: Object.freeze({
      ...periodic,
      nextTick: periodic.nextTick + periodic.intervalTicks,
      tickIndex: periodic.tickIndex + 1,
    }),
  });
}

/** A permanent status (no expiry) always remains eligible for periodic ticks. */
export function hasFiniteExpiry(status: StatusInstance): boolean {
  return status.endTick !== PERMANENT_END_TICK;
}
