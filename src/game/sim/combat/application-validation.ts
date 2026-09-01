import { KernelInvariantError } from '../core/invariant-error.js';
import type { PendingCombatApplication } from './combat-application.js';

/**
 * §8 strict validation for every queued combat application. Stage H queues
 * applications; the reducer validates each one before it enters the pending
 * list so a corrupted snapshot or a malformed command can never reach the
 * stage-I apply pipeline.
 */
export function validatePendingCombatApplication(application: PendingCombatApplication): void {
  for (const key of ['sourceId', 'targetId', 'effectId'] as const) {
    if (!/^[a-z][a-z0-9_]*$/.test(application[key])) {
      throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'combat-ids-invalid', key, value: application[key] });
    }
  }
  for (const key of ['attackInstanceId', 'effectIndex'] as const) {
    if (!Number.isSafeInteger(application[key]) || application[key] < 0) {
      throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'combat-instance-invalid', key });
    }
  }
  if (!Number.isSafeInteger(application.rawAmount) || application.rawAmount < 0) {
    throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'combat-raw-invalid', rawAmount: application.rawAmount });
  }
  if (application.kind === 'damage') {
    if (application.damageTypeOrdinal < 0 || application.damageTypeOrdinal > 2) {
      throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'combat-type-invalid', damageTypeOrdinal: application.damageTypeOrdinal });
    }
    if (!Number.isSafeInteger(application.defense) || application.defense < -1000 || application.defense > 1000) {
      throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'combat-defense-invalid', defense: application.defense });
    }
    if (!Number.isSafeInteger(application.coverReductionBps) || application.coverReductionBps < 0 || application.coverReductionBps > 10000) {
      throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'combat-cover-invalid', coverReductionBps: application.coverReductionBps });
    }
    if (application.bossCapBps !== null && (!Number.isSafeInteger(application.bossCapBps) || application.bossCapBps < 0 || application.bossCapBps > 10000)) {
      throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'combat-boss-cap-invalid', bossCapBps: application.bossCapBps });
    }
  }
  if (application.kind === 'heal') {
    if (!Number.isSafeInteger(application.healFactorBps) || application.healFactorBps < 0 || application.healFactorBps > 10000) {
      throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'combat-heal-factor-invalid', healFactorBps: application.healFactorBps });
    }
  }
  if (application.kind === 'shield') {
    if (!Number.isSafeInteger(application.expiryTick) || application.expiryTick < 0) {
      throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'combat-shield-expiry-invalid', expiryTick: application.expiryTick });
    }
    if (!Number.isSafeInteger(application.priority) || application.priority < 0) {
      throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'combat-shield-priority-invalid', priority: application.priority });
    }
    if (!Number.isSafeInteger(application.applicationSequence) || application.applicationSequence < 0) {
      throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'combat-shield-seq-invalid', applicationSequence: application.applicationSequence });
    }
  }
}
