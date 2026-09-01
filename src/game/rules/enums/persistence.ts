class EnumParseError extends Error { constructor(readonly enumName:string, readonly value:unknown) { super('P11_ENUM_UNKNOWN'); } }

export const SaveCommitReasonValues = Object.freeze(['profile_change', 'node_entered', 'decision_committed', 'battle_started', 'battle_snapshot', 'battle_finished', 'reward_committed', 'run_finished', 'settings_changed', 'manual_backup'] as const);
export type SaveCommitReason = (typeof SaveCommitReasonValues)[number];
export function parseSaveCommitReason(value:unknown):SaveCommitReason {
  if (typeof value === 'string' && (SaveCommitReasonValues as readonly string[]).includes(value)) return value as SaveCommitReason;
  throw new EnumParseError('SaveCommitReason', value);
}

export const RecoveryReasonValues = Object.freeze(['none', 'newest_slot_invalid', 'run_invalid', 'content_mismatch', 'migration_failed', 'renderer_unavailable', 'insufficient_storage'] as const);
export type RecoveryReason = (typeof RecoveryReasonValues)[number];
export function parseRecoveryReason(value:unknown):RecoveryReason {
  if (typeof value === 'string' && (RecoveryReasonValues as readonly string[]).includes(value)) return value as RecoveryReason;
  throw new EnumParseError('RecoveryReason', value);
}
