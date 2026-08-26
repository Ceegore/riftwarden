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

/**
 * Convert a settlement into profile transaction requests.
 *
 * Transaction ids are content-derived, not positional: the outcome is part of
 * the id (so a victory and a retreat for the same run can never collide and
 * replay each other's gold credit), and each loot grant is keyed by its stable
 * reward id (so list reordering or an added/removed reward can never make one
 * item reuse a previously committed id). Duplicate calls with the same outcome
 * and rewards produce identical ids and replay idempotently.
 */
function settlementToRequests(
  settlement: Settlement,
  baseTxId: string,
): readonly TransactionRequest[] {
  const requests: TransactionRequest[] = [];

  // Credit kept gold (at most one gold transaction per settlement).
  if (settlement.keptGold > 0) {
    const kept = settlement.keptGold;
    requests.push({
      transactionId: `${baseTxId}-gold`,
      kind: 'CREDIT_GOLD',
      costGold: 0,
      mutate(profile: Profile): Profile {
        return { ...profile, wallet: { ...profile.wallet, gold: profile.wallet.gold + kept } };
      },
    });
  }

  // Loot items: each kept reward becomes an owned item, keyed by reward id.
  for (const lootId of settlement.keptLoot) {
    requests.push({
      transactionId: `${baseTxId}-loot-${lootId}`,
      kind: 'GRANT_ITEM',
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
  }

  // Relics and recruits are temporary run content. They expire at settlement;
  // only permanent loot and earned gold become profile transactions.
  return requests;
}

/**
 * Guards the settlement-to-request bridge: every produced transaction id must
 * be unique within the batch, and every kind must be a declared profile
 * transaction kind. A duplicate id would silently drop a reward on replay, so
 * this is a hard structural violation rather than a silent repair.
 */
function assertUniqueTransactionIds(requests: readonly TransactionRequest[]): void {
  const seen = new Set<string>();
  for (const request of requests) {
    if (seen.has(request.transactionId)) {
      throw new Error(`duplicate settlement transaction id: ${request.transactionId}`);
    }
    seen.add(request.transactionId);
  }
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

  const baseTxId = `settle-${state.runId}-${outcome}`;
  const requests = settlementToRequests(settlement, baseTxId);
  assertUniqueTransactionIds(requests);
  return {
    outcome,
    settlement,
    requests,
  };
}
