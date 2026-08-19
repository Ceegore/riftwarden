import type { RecoveryReason } from '../schema/types.js';
import { SaveError } from '../save-error.js';

export interface SlotFinding {
  readonly valid: boolean;
  readonly commitId: number;
}

export interface RecoveryInput {
  readonly active: SlotFinding;
  readonly others: readonly SlotFinding[];
  readonly profileValid: boolean;
  readonly runValid: boolean;
  readonly migrationFailed: boolean;
  readonly contentCompatible: boolean;
  readonly diskFull: boolean;
  readonly rendererAvailable: boolean;
}

export interface RecoveryDecision {
  readonly reason: RecoveryReason;
  readonly action: string;
  readonly requiresConfirmation: boolean;
}

/**
 * Pure recovery decision table (handbook §10). Priority:
 * disk full -> renderer unavailable -> migration failed -> content mismatch
 * -> valid profile with invalid run -> newest slot invalid (highest valid
 * commitId fallback) -> no valid slot. Corrupted slots are never deleted
 * automatically; run abort requires explicit confirmation.
 */
export function decideRecovery(input: RecoveryInput): RecoveryDecision {
  if (input.diskFull) {
    return { reason: 'insufficient_storage', action: 'keep_old_valid_and_explain_storage', requiresConfirmation: false };
  }
  if (!input.rendererAvailable) {
    return { reason: 'renderer_unavailable', action: 'snapshot_and_reinit_renderer', requiresConfirmation: false };
  }
  if (input.migrationFailed) {
    return { reason: 'migration_failed', action: 'retain_original_and_offer_export', requiresConfirmation: false };
  }
  if (!input.contentCompatible) {
    return { reason: 'content_mismatch', action: 'block_and_offer_diagnostics', requiresConfirmation: false };
  }
  if (input.profileValid && !input.runValid) {
    return { reason: 'run_invalid', action: 'confirm_safe_abort', requiresConfirmation: true };
  }
  if (!input.active.valid) {
    const valid = input.others
      .filter((slot) => slot.valid)
      .sort((a, b) => b.commitId - a.commitId);
    if (valid.length > 0) {
      return { reason: 'newest_slot_invalid', action: 'load_highest_valid', requiresConfirmation: false };
    }
    return { reason: 'newest_slot_invalid', action: 'offer_import_or_new_profile', requiresConfirmation: true };
  }
  return { reason: 'none', action: 'load_active', requiresConfirmation: false };
}

export function assertValidFinding(finding: SlotFinding): void {
  if (!Number.isSafeInteger(finding.commitId) || finding.commitId < 0) throw new SaveError('INVALID_ARGUMENT');
}
