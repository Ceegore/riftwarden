import type { Lane } from '../geometry/x100.js';

/** Phase 16 role taxonomy (kit). Drives target-score modifiers. */
export type Role = 'defender'|'fighter'|'breaker'|'duelist'|'marksman'|'mage'|'controller'|'healer'|'support'|'summoner'|'constructor';

/** Where an entity came from; drives the regular/summoned/construct flags. */
export type EntityOrigin = 'regular'|'summoned'|'construct';

/** One target candidate for the query/score pipeline (kit shape, kernel ids). */
export interface Candidate {
  readonly id: string;
  readonly lane: Lane;
  readonly distance: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly alive: boolean;
  readonly removed: boolean;
  readonly reachable: boolean;
  readonly regular: boolean;
  readonly summoned: boolean;
  readonly shielded: boolean;
  readonly construct: boolean;
  readonly backline: boolean;
  readonly buffed: boolean;
  readonly threatensSource: boolean;
  readonly covered: boolean;
}

export interface Modifier {
  readonly modifierId: string;
  readonly value: number;
  readonly provenance: string;
}

export interface ScoreBreakdown {
  readonly candidateId: string;
  readonly base: number;
  readonly modifiers: readonly Modifier[];
  readonly total: number;
  readonly distance: number;
  readonly hp: number;
}

export interface QueryContext {
  readonly sourceId: string;
  readonly sourceLane: Lane;
  readonly role: Role;
  readonly currentTargetId?: string;
  readonly focusTargetId?: string;
  readonly antiSummoner?: boolean;
  readonly ownLaneHasTarget: boolean;
  readonly laneChangeRequired: (candidate: Candidate) => boolean;
}

export type LockKind = 'none'|'basic_until_hit_or_abort'|'signature_until_cast_end'|'fixed';

export interface TargetLock {
  readonly kind: LockKind;
  readonly targetId?: string;
  readonly acquiredTick: number;
}

export type ReevaluateReason = 'state_entry'|'target_invalid'|'explicit_trigger'|'lanechange_completed';
