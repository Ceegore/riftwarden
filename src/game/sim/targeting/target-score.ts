import { SUMMONED_DEFAULT_TARGET_WEIGHT } from '../../rules/mechanic-rules.js';
import type { Candidate, Modifier, QueryContext, ScoreBreakdown } from './types.js';

const LANE_INDEX: Readonly<Record<string, number>> = Object.freeze({ top: 0, middle: 1, bottom: 2 });

function laneAdjacent(a: string, b: string): boolean {
  return Math.abs((LANE_INDEX[a] ?? -1) - (LANE_INDEX[b] ?? -1)) === 1;
}

/**
 * Canonical Phase 16 score breakdown (kit, provenance GDD_V5_7). Base rewards
 * proximity; modifiers reward same-lane pressure, threats, regular targets,
 * role-specific hunt profiles, focus fire and the current-target binding.
 */
export function scoreCandidate(c: Candidate, x: QueryContext): ScoreBreakdown {
  const m: Modifier[] = [];
  const add = (modifierId: string, value: number): void => {
    if (value !== 0) m.push({ modifierId, value, provenance: 'GDD_V5_7' });
  };
  const base = 100 - c.distance * 2;
  if (c.lane === x.sourceLane) add('same_lane', 45);
  else if (laneAdjacent(c.lane, x.sourceLane) && !x.ownLaneHasTarget) add('adjacent_no_own_target', 15);
  if (c.threatensSource) add('threatens_source', 12);
  if (c.regular) add('regular_target', 8);
  if (c.summoned && !x.antiSummoner) add('summoned_default', SUMMONED_DEFAULT_TARGET_WEIGHT);
  if (x.role === 'duelist' && c.hp * 100 < c.maxHp * 30) add('duelist_low_hp', 10);
  if (x.role === 'breaker' && (c.shielded || c.construct)) add('breaker_shield_construct', 30);
  if ((x.role === 'duelist' || x.role === 'fighter') && c.backline) add('hunter_backline', 28);
  if (x.role === 'support' && c.buffed) add('banisher_buffed', 30);
  if (x.focusTargetId === c.id) add('focus_target', 25);
  if (x.laneChangeRequired(c)) add('lane_change_required', -18);
  if (c.covered && x.role === 'marksman') add('cover', -22);
  if (x.currentTargetId === c.id) add('current_target_binding', 18);
  return { candidateId: c.id, base, modifiers: Object.freeze(m), total: base + m.reduce((s, v) => s + v.value, 0), distance: c.distance, hp: c.hp };
}

/** Best-first order: total desc, distance asc, hp asc, candidate id asc. */
export function compareBreakdown(a: ScoreBreakdown, b: ScoreBreakdown): number {
  return b.total - a.total || a.distance - b.distance || a.hp - b.hp || (a.candidateId < b.candidateId ? -1 : a.candidateId > b.candidateId ? 1 : 0);
}

/**
 * Hysteresis (§5.2): the current target keeps its binding (+18 in the score)
 * and is only replaced when a strictly better candidate beats it by 20.
 */
export function chooseTarget(items: readonly ScoreBreakdown[], current?: ScoreBreakdown): ScoreBreakdown|undefined {
  const sorted = [...items].sort(compareBreakdown);
  const best = sorted[0];
  if (best === undefined) return undefined;
  if (current === undefined) return best;
  if (best.candidateId === current.candidateId) return current;
  return best.total >= current.total + 20 ? best : current;
}
