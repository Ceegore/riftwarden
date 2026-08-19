import { KernelInvariantError } from '../core/invariant-error.js';

/**
 * Phase 19 T06 coverage inventory (§10). Every ability definition needs at
 * least the eight closed contract cases below; the inventory maps each
 * extracted ability id to a `planned`/`active`/`blocked`/`covered` status and
 * reports which required cases are still missing. An unmapped ability blocks
 * later content-complete claims.
 */

export const REQUIRED_ABILITY_CASES = [
  'positive_trigger',
  'negative_trigger',
  'invalid_target',
  'interrupt_before_commit',
  'post_commit',
  'recovery_cooldown_uses',
  'event_command_order',
  'save_resume_replay',
] as const;
export type AbilityCase = (typeof REQUIRED_ABILITY_CASES)[number];

export type CoverageStatus = 'planned' | 'active' | 'blocked' | 'covered';

export interface CoverageEntry {
  readonly abilityId: string;
  readonly status: CoverageStatus;
  readonly coveredCases: readonly AbilityCase[];
  readonly blocker: string | null;
}

const ID = /^[a-z][a-z0-9_]*$/;

function missingCases(entry: CoverageEntry): readonly AbilityCase[] {
  const covered = new Set<string>(entry.coveredCases);
  return Object.freeze(REQUIRED_ABILITY_CASES.filter((c) => !covered.has(c)));
}

/** Validates an entry: closed status, unique known cases, blocked ⇒ blocker. */
export function validateCoverageEntry(entry: CoverageEntry): void {
  if (!ID.test(entry.abilityId)) throw new KernelInvariantError('P19_COVERAGE_INVALID', { abilityId: entry.abilityId });
  if (!['planned', 'active', 'blocked', 'covered'].includes(entry.status)) {
    throw new KernelInvariantError('P19_COVERAGE_INVALID', { status: entry.status });
  }
  const seen = new Set<string>();
  for (const c of entry.coveredCases) {
    if (!(REQUIRED_ABILITY_CASES as readonly string[]).includes(c)) throw new KernelInvariantError('P19_COVERAGE_INVALID', { case: c });
    if (seen.has(c)) throw new KernelInvariantError('P19_COVERAGE_INVALID', { reason: 'duplicate-case', case: c });
    seen.add(c);
  }
  if (entry.status === 'blocked' && entry.blocker === null) throw new KernelInvariantError('P19_COVERAGE_INVALID', { reason: 'blocked-without-blocker' });
}

export interface CoverageReport {
  readonly fullyCovered: boolean;
  readonly entries: readonly CoverageEntry[];
  readonly blockers: readonly string[];
  /** (abilityId, missing case) rows that still block a content-complete claim. */
  readonly gaps: readonly { readonly abilityId: string; readonly missingCases: readonly AbilityCase[] }[];
}

/** Builds a validated inventory and a blocker/gap report. */
export function buildCoverageReport(entries: readonly CoverageEntry[]): CoverageReport {
  const seenIds = new Set<string>();
  for (const entry of entries) {
    validateCoverageEntry(entry);
    if (seenIds.has(entry.abilityId)) throw new KernelInvariantError('P19_COVERAGE_INVALID', { reason: 'duplicate-ability', abilityId: entry.abilityId });
    seenIds.add(entry.abilityId);
  }
  const blockers = entries.filter((e) => e.status === 'blocked').map((e) => e.blocker ?? e.abilityId);
  const gaps = entries
    .map((e) => ({ abilityId: e.abilityId, missingCases: missingCases(e) }))
    .filter((g) => g.missingCases.length > 0);
  const fullyCovered = blockers.length === 0 && gaps.length === 0 && entries.every((e) => e.status === 'covered');
  return Object.freeze({ fullyCovered, entries: Object.freeze(entries), blockers: Object.freeze(blockers), gaps: Object.freeze(gaps) });
}
