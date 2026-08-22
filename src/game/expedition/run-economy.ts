/**
 * Run economy and loot security (RUN_ECONOMY_LOOT_CONTRACT, GDD §22/§23):
 * run currency and temporary content stay separate from the permanent
 * profile. Loot carries stable reward ids and is granted exactly once
 * (duplicates replay, never double); relic limits are 6 (NORMAL) / 8
 * (ASCENSION) with replace-or-decline at full cap; retreat/loss settlements
 * are pure computations over the committed state — wallets never go
 * negative. Profile-side applications (selling, polishing, permanent
 * storage) run through the Phase 31 transaction framework, never here.
 */
import type { NodeRunState, OutcomeCommand } from './nodes/types.js';

export const RELIC_LIMIT_NORMAL = 6;
export const RELIC_LIMIT_ASCENSION = 8;
export const RETREAT_LATE_GOLD_KEEP_PERMILLE = 800;
export const DEFEAT_GOLD_KEEP_PERMILLE = 600;
export const DUPLICATE_CONVERSION_PERMILLE = 450;

export function relicLimitForMode(modeId: string): number {
  return modeId.toUpperCase().includes('ASCENSION') ? RELIC_LIMIT_ASCENSION : RELIC_LIMIT_NORMAL;
}

/** True when the reward id is already secured or unsecured (idempotent grant). */
export function hasReward(state: NodeRunState, rewardId: string): boolean {
  return state.securedLoot.includes(rewardId) || state.unsecuredLoot.includes(rewardId);
}

/** Duplicate permanent finds convert at 45% of their merchant base value. */
export function duplicateConversionGold(merchantBaseGold: number): number {
  return Math.floor((merchantBaseGold * DUPLICATE_CONVERSION_PERMILLE) / 1000);
}

/**
 * Anchor securing (GDD §23.3): unsecured loot becomes secured via typed
 * commands — remove from unsecured, add to secured, both idempotent.
 */
export function secureCommands(state: NodeRunState): readonly OutcomeCommand[] {
  return state.unsecuredLoot.flatMap((rewardId) => [
    { kind: 'REMOVE_UNSECURED_LOOT', rewardId },
    { kind: 'GRANT_SECURED_LOOT', rewardId },
  ]);
}

export interface Settlement {
  readonly keptGold: number;
  readonly lostGold: number;
  readonly keptLoot: readonly string[];
  readonly lostLoot: readonly string[];
  readonly lostRelics: readonly string[];
  readonly lostRecruits: readonly string[];
}

/** Voluntary retreat at the anchor (GDD §23.4). */
export function settleRetreat(state: NodeRunState, goldAtAnchor: number): Settlement {
  const anchorGold = Math.min(goldAtAnchor, state.gold);
  const lateGold = state.gold - anchorGold;
  const keptLate = Math.floor((lateGold * RETREAT_LATE_GOLD_KEEP_PERMILLE) / 1000);
  const keptGold = anchorGold + keptLate;
  return {
    keptGold,
    lostGold: state.gold - keptGold,
    keptLoot: [...state.securedLoot],
    lostLoot: [...state.unsecuredLoot],
    lostRelics: [...state.relics],
    lostRecruits: [...state.recruits],
  };
}

/** Defeat (GDD §23.4): secured kept, 60% of run-earned gold kept, capped by holdings. */
export function settleDefeat(state: NodeRunState): Settlement {
  const keptGold = Math.min(Math.floor((state.goldEarned * DEFEAT_GOLD_KEEP_PERMILLE) / 1000), state.gold);
  return {
    keptGold,
    lostGold: state.gold - keptGold,
    keptLoot: [...state.securedLoot],
    lostLoot: [...state.unsecuredLoot],
    lostRelics: [...state.relics],
    lostRecruits: [...state.recruits],
  };
}

/** Mission victory (GDD §23.4): everything permanent is kept; temporaries end. */
export function settleVictory(state: NodeRunState): Settlement {
  return {
    keptGold: state.gold,
    lostGold: 0,
    keptLoot: [...state.securedLoot, ...state.unsecuredLoot],
    lostLoot: [],
    lostRelics: [...state.relics],
    lostRecruits: [...state.recruits],
  };
}

/** Relic grant guard: duplicate relics are rejected, full cap requires replacement. */
export type RelicGrantVerdict = 'OK' | 'DUPLICATE' | 'RELIC_CAP';

export function relicGrantVerdict(state: NodeRunState, relicId: string, modeId: string): RelicGrantVerdict {
  if (state.relics.includes(relicId)) return 'DUPLICATE';
  return state.relics.length >= relicLimitForMode(modeId) ? 'RELIC_CAP' : 'OK';
}
