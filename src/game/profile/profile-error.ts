/**
 * Closed error-code union for the Phase 31 profile pure layer. Invalid
 * references, revision mismatches, duplicate instance ids, copy/level/contract
 * limit violations and banner inconsistencies throw a ProfileError with one of
 * these codes; transaction outcomes (COMMITTED/REJECTED/replay) are results,
 * not exceptions.
 */
export type ProfileErrorCode =
  | 'PROFILE_REVISION'
  | 'NEGATIVE_VALUE'
  | 'INVALID_HERO_REFERENCE'
  | 'INVALID_TROOP_REFERENCE'
  | 'INVALID_ITEM_REFERENCE'
  | 'DUPLICATE_INSTANCE_ID'
  | 'COPY_LIMIT'
  | 'HERO_LEVEL_RANGE'
  | 'CONTRACT_LEVEL_RANGE'
  | 'INVALID_ACTIVE_BANNER'
  | 'UNKNOWN_TRANSACTION_KIND';

export class ProfileError extends Error {
  readonly code: ProfileErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: ProfileErrorCode, details: Readonly<Record<string, unknown>> = {}) {
    super(`profile.${code}`);
    this.name = 'ProfileError';
    this.code = code;
    this.details = details;
  }
}
