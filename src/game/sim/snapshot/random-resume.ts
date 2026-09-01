import type { AuthoritativeStreamSnapshot, StreamSnapshot } from '../random/rng-stream-map.js';
import { RngStreamMap } from '../random/rng-stream-map.js';
import type { XoshiroState } from '../random/xoshiro128ss.js';

/**
 * Rebuilds the complete Phase-13 stream map for a Phase-14 resume.
 * Authoritative streams come from the verified battle snapshot. The cosmetic
 * state is deliberately injected by the caller because it is excluded from
 * authoritative snapshot hashes and must never influence gameplay.
 */
export function composeResumeStreamSnapshot(
  authoritative: AuthoritativeStreamSnapshot,
  combatCosmetic: XoshiroState,
): StreamSnapshot {
  return Object.freeze({
    map: authoritative.map,
    encounter: authoritative.encounter,
    rewards: authoritative.rewards,
    eventChoices: authoritative.eventChoices,
    combatCosmetic,
  });
}

export function restoreStreamsForResume(
  authoritative: AuthoritativeStreamSnapshot,
  combatCosmetic: XoshiroState,
): RngStreamMap {
  return RngStreamMap.restore(composeResumeStreamSnapshot(authoritative, combatCosmetic));
}
