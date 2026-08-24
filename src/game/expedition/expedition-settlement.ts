/**
 * Expedition settlement bridge (EXPEDITION_SETTLEMENT_CONTRACT): maps the
 * expedition's deterministic settlement computation to the Profile's Phase 31
 * transaction framework. Every settlement type (victory, defeat, retreat)
 * produces a list of profile transaction requests that the profile layer
 * executes atomically through commitTransaction.
 *
 * Gold is credited to the profile wallet. Loot ids become owned items
 * (if not already owned). Relics and recruits are run-temporary and are
 * reported by settlement screens but are not persisted to the profile.
 */
import type { NodeRunState } from './nodes/types.js';
import type { Profile, TransactionRequest } from '../profile/types.js';
import { settleDefeat, settleRetreat, settleVictory, type Settlement } from './run-economy.js';

/** Outcome of an expedition from the profile's perspective. */
export type ExpeditionOutcome = 'victory' | 'defeat' | 'retreat';

export interface SettlementRequests {
  readonly outcome: ExpeditionOutcome;
  readonly settlement: Settlement;
  readonly requests: readonly TransactionRequest[];
}

/** Convert a settlement into profile transaction requests. */
function settlementToRequests(
  settlement: Settlement,
  baseTxId: string,
): readonly TransactionRequest[] {
  const requests: TransactionRequest[] = [];
  let seq = 0;

  // Credit kept gold.
  if (settlement.keptGold > 0) {
    const kept = settlement.keptGold;
    requests.push({
      transactionId: `${baseTxId}-gold-${String(seq)}`,
      kind: 'BUY_COPY', // closest generic mutation; gold credit is a wallet delta.
      costGold: 0,
      mutate(profile: Profile): Profile {
        return { ...profile, wallet: { ...profile.wallet, gold: profile.wallet.gold + kept } };
      },
    });
    seq++;
  }

  // Loot items: each kept reward becomes an owned item.
  for (const lootId of settlement.keptLoot) {
    requests.push({
      transactionId: `${baseTxId}-loot-${String(seq)}`,
      kind: 'BUY_COPY',
      costGold: 0,
      mutate(profile: Profile): Profile {
        const existing = profile.items[lootId];
        if (existing?.owned) return profile; // already owned, no-op.
        return {
          ...profile,
          items: {
            ...profile.items,
            [lootId]: { id: lootId, owned: true, polished: false, isBanner: false },
          },
        };
      },
    });
    seq++;
  }

  // Relics and recruits are temporary run content. They expire at settlement;
  // only permanent loot and earned gold become profile transactions.
  return requests;
}

/**
 * Build profile transaction requests for the given expedition outcome.
 * The caller applies each request through commitTransaction in order.
 * Duplicate loot/relic/recruit grants replay idempotently.
 */
export function buildSettlementRequests(
  state: NodeRunState,
  outcome: ExpeditionOutcome,
  goldAtAnchor = 0,
): SettlementRequests {
  let settlement: Settlement;
  switch (outcome) {
    case 'victory':
      settlement = settleVictory(state);
      break;
    case 'defeat':
      settlement = settleDefeat(state);
      break;
    case 'retreat':
      settlement = settleRetreat(state, goldAtAnchor);
      break;
  }

  const baseTxId = `settle-${state.runId}`;
  return {
    outcome,
    settlement,
    requests: settlementToRequests(settlement, baseTxId),
  };
}
