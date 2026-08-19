import { KernelInvariantError } from '../core/invariant-error.js';
import { asciiCompare } from '../core/primitives.js';

/**
 * Phase 21 §4–§5 boss-phase authority (T01 coverage + T02 transition runtime).
 * Every boss definition carries stable boss/phase ids, a fully covered and
 * non-overlapping HP range, an explicit transition priority, entry/exit effects,
 * a cancel/pause policy, an optional transition lock and a strategic preview key.
 * Transitions are DETECTED in stage D and COMMITTED in stage L; detection is
 * idempotent (a planned transition survives until its commit tick) and a source
 * phase may only ever commit one transition (§5, tracked via `visited`).
 * All numbers are authoritative integers — no floats, wallclock or locale.
 */

export type BossId = string;
export type PhaseId = string;

export const DEFAULT_TRANSITION_TICKS = 45;
export const MAX_INVULNERABLE_TICKS = 45;
export const HP_PERMILLE_END = 1001; // exclusive upper bound of the 0..1000 range

/** Action categories a transition may cancel or pause (§5, closed set). */
export const CANCEL_CATEGORIES = ['charge', 'cast', 'movement', 'projectile'] as const;
export type CancelCategory = (typeof CANCEL_CATEGORIES)[number];

export interface PhaseDefinition {
  readonly id: PhaseId;
  readonly bossId: BossId;
  /** Higher priority wins; ties are broken by phase id code-unit order (§4). */
  readonly priority: number;
  /** Inclusive lower HP bound in permille (0..1000). */
  readonly minHpPermille: number;
  /** Exclusive upper HP bound in permille (1..1001). */
  readonly maxHpPermille: number;
  /** Override for the 45-tick default transition (§5). */
  readonly transitionTicks?: number;
  /** Hard invulnerability granted on entry; max 45 ticks (§4). */
  readonly invulnerableTicks?: number;
  /** Strategic preview reference, mandatory (§4 / §21.5). */
  readonly previewKey: string;
  /** Effect ids committed atomically on phase entry (§4). */
  readonly entryEffects?: readonly string[];
  /** Effect ids committed atomically on phase exit (§4). */
  readonly exitEffects?: readonly string[];
  /** Categories cancelled when this transition commits (§5). */
  readonly cancelCategories?: readonly CancelCategory[];
  /** Categories paused when this transition commits (§5). */
  readonly pauseCategories?: readonly CancelCategory[];
  /** Optional transition lock: no transition may leave this phase (§4). */
  readonly transitionLocked?: boolean;
}

export interface PhaseTransition {
  readonly from: PhaseId;
  readonly to: PhaseId;
  readonly startTick: number;
  readonly commitTick: number;
}

export interface BossPhaseState {
  readonly entityId: string;
  readonly bossId: BossId;
  readonly hpPermille: number;
  readonly phaseId: PhaseId;
  readonly transition: PhaseTransition | null;
  readonly visited: readonly PhaseId[];
}

export interface ValidationIssue {
  readonly code: string;
  readonly detail: string;
}

const ID = /^[a-z][a-z0-9_]*$/;

function assertId(value: string, field: string): void {
  if (!ID.test(value)) throw new KernelInvariantError('P21_PHASE_INVALID', { field, value });
}

function assertInt(value: number, field: string, min = 0): void {
  if (!Number.isSafeInteger(value) || value < min || Object.is(value, -0)) {
    throw new KernelInvariantError('P21_PHASE_INVALID', { field, value });
  }
}

/** Validates a single phase definition against the §4 data contract. */
export function validatePhaseDefinition(def: PhaseDefinition): void {
  assertId(def.id, 'id');
  assertId(def.bossId, 'bossId');
  assertInt(def.priority, 'priority');
  assertInt(def.minHpPermille, 'minHpPermille');
  assertInt(def.maxHpPermille, 'maxHpPermille', 1);
  if (def.minHpPermille >= def.maxHpPermille) {
    throw new KernelInvariantError('P21_PHASE_INVALID', { reason: 'empty-range', id: def.id });
  }
  if (def.minHpPermille > HP_PERMILLE_END - 1 || def.maxHpPermille > HP_PERMILLE_END) {
    throw new KernelInvariantError('P21_PHASE_INVALID', { reason: 'range-out-of-bounds', id: def.id });
  }
  if (def.transitionTicks !== undefined) assertInt(def.transitionTicks, 'transitionTicks', 1);
  if (def.invulnerableTicks !== undefined) assertInt(def.invulnerableTicks, 'invulnerableTicks', 0);
  assertId(def.previewKey, 'previewKey');
  for (const effectId of def.entryEffects ?? []) assertId(effectId, 'entryEffects');
  for (const effectId of def.exitEffects ?? []) assertId(effectId, 'exitEffects');
  for (const category of def.cancelCategories ?? []) {
    if (!(CANCEL_CATEGORIES as readonly string[]).includes(category)) throw new KernelInvariantError('P21_PHASE_INVALID', { field: 'cancelCategories', category });
  }
  for (const category of def.pauseCategories ?? []) {
    if (!(CANCEL_CATEGORIES as readonly string[]).includes(category)) throw new KernelInvariantError('P21_PHASE_INVALID', { field: 'pauseCategories', category });
  }
}

function issue(code: string, detail: string): ValidationIssue {
  return Object.freeze({ code, detail });
}

/**
 * §4 coverage validator. Blocks gaps, overlaps, ambiguous same-priority
 * candidates, unreachable phases, missing previews and invulnerability over
 * 45 ticks. Coverage must span [0, 1001) without holes or overlaps.
 */
export function validateBossPhases(phases: readonly PhaseDefinition[]): readonly ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const sorted = [...phases].sort((a, b) => a.minHpPermille - b.minHpPermille || asciiCompare(a.id, b.id));
  if (sorted.length === 0) {
    out.push(issue('P21_PHASE_GAP', 'no phases'));
    return Object.freeze(out);
  }
  // Unreachable: a phase with a degenerate range or with no downward entry path.
  // The entry phase is the one covering full HP (maxHpPermille === 1001).
  const entryIds = new Set(sorted.filter((p) => p.maxHpPermille === HP_PERMILLE_END).map((p) => p.id));
  if (entryIds.size === 0) out.push(issue('P21_PHASE_GAP', 'no entry phase at full HP'));
  const reachable = new Set<string>(entryIds);
  // Descend from the entry phase (full HP): each lower phase is reachable only
  // when the phase above it is reachable and their HP boundaries touch.
  let above: PhaseDefinition | undefined = sorted[sorted.length - 1];
  for (let i = sorted.length - 2; i >= 0; i--) {
    const below = sorted[i];
    if (above !== undefined && below !== undefined && reachable.has(above.id) && below.maxHpPermille === above.minHpPermille) {
      reachable.add(below.id);
    }
    above = below;
  }
  let cursor = 0;
  for (const p of sorted) {
    if (!p.previewKey) out.push(issue('P21_PREVIEW_MISSING', p.id));
    if (p.minHpPermille > cursor) out.push(issue('P21_PHASE_GAP', p.id));
    if (p.minHpPermille < cursor) out.push(issue('P21_PHASE_OVERLAP', p.id));
    if ((p.invulnerableTicks ?? 0) > MAX_INVULNERABLE_TICKS) out.push(issue('P21_INVULNERABLE_TOO_LONG', p.id));
    if (!reachable.has(p.id)) out.push(issue('P21_PHASE_GAP', `unreachable:${p.id}`));
    cursor = Math.max(cursor, p.maxHpPermille);
  }
  if (cursor < HP_PERMILLE_END) out.push(issue('P21_PHASE_GAP', 'upper range'));
  // Ambiguity: two phases with the same priority and overlapping HP coverage can
  // both match in one tick; the comparator could not break the tie deterministically.
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    if (a === undefined) continue;
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      if (b === undefined) continue;
      if (a.bossId !== b.bossId) continue;
      const overlaps = a.minHpPermille < b.maxHpPermille && b.minHpPermille < a.maxHpPermille;
      if (overlaps && a.priority === b.priority) out.push(issue('P21_TRANSITION_AMBIGUOUS', `${a.id}/${b.id}`));
    }
  }
  return Object.freeze(out);
}

/** §5 detection (stage D): highest-priority, id-tie-broken eligible transition. */
export function detectTransition(state: BossPhaseState, defs: readonly PhaseDefinition[], tick: number): PhaseTransition | null {
  if (state.transition !== null) return state.transition;
  const currentDef = defs.find((p) => p.id === state.phaseId);
  if (currentDef?.transitionLocked === true) return null;
  const candidates = defs.filter((p) =>
    p.bossId === state.bossId &&
    p.id !== state.phaseId &&
    state.hpPermille >= p.minHpPermille &&
    state.hpPermille < p.maxHpPermille &&
    !state.visited.includes(p.id),
  );
  candidates.sort((a, b) => b.priority - a.priority || asciiCompare(a.id, b.id));
  const next = candidates[0];
  if (next === undefined) return null;
  const duration = next.transitionTicks ?? DEFAULT_TRANSITION_TICKS;
  return Object.freeze({ from: state.phaseId, to: next.id, startTick: tick, commitTick: tick + duration });
}

/** §5 commit (stage L): atomic, at the inclusive commit tick, exactly once. */
export function commitTransition(state: BossPhaseState, tick: number): BossPhaseState {
  const tr = state.transition;
  if (tr === null || tick < tr.commitTick) return state;
  return Object.freeze({
    entityId: state.entityId,
    bossId: state.bossId,
    hpPermille: state.hpPermille,
    phaseId: tr.to,
    transition: null,
    visited: Object.freeze([...state.visited, tr.to]),
  });
}

/** §5: invulnerability ticks granted on entering a phase (0 when absent). */
export function phaseInvulnerableTicks(defs: readonly PhaseDefinition[], phaseId: PhaseId): number {
  const def = defs.find((p) => p.id === phaseId);
  return def?.invulnerableTicks ?? 0;
}
