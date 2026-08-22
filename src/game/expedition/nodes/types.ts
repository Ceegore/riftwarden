/**
 * Phase 32 node domain types (NODE_REGISTRY_CONTRACT, OFFER_SNAPSHOT_CONTRACT,
 * NODE_TRANSACTION_CONTRACT, SAVE_RECOVERY_CONTRACT): the persisted run
 * container, node visit states, materialized offer snapshots, user action
 * requests, transaction records and the closed outcome command union. All
 * references are stable ids plus version references — never UI text.
 */
import type { NodeType } from '../types.js';

/** Closed visit machine (SAVE_RECOVERY_CONTRACT). */
export type VisitStatus = 'OPEN' | 'COMMITTING' | 'COMMITTED' | 'RESOLVED';

/** One persisted node visit: survives reload and resumes at the commit point. */
export interface NodeVisitState {
  readonly nodeId: string;
  readonly status: VisitStatus;
  readonly transactionId?: string;
  readonly previewRevision: number;
}

/** A materialized offer: stable ids and prices, granted exactly once. */
export interface Offer {
  readonly offerId: string;
  readonly priceGold: number;
  readonly stock: number;
  readonly rewardId?: string;
  readonly troopTypeId?: string;
  readonly labelKey: string;
}

/** One event option as shown at open: available or greyed with a reason. */
export interface EventOptionState {
  readonly optionId: string;
  readonly available: boolean;
  readonly blockedReasonKey?: string;
}

/**
 * OfferSnapshot (OFFER_SNAPSHOT_CONTRACT): materialized exactly once from
 * runId + nodeId + contentRevision + seed, then only read. `rerollsUsed`
 * counts authorized rerolls; a reroll stores a new snapshot, never re-rolls
 * in place.
 */
export interface OfferSnapshot {
  readonly kind: 'OFFERS';
  readonly snapshotId: string;
  readonly nodeId: string;
  readonly seed: number;
  readonly offers: readonly Offer[];
  readonly rollSlots: Readonly<Record<string, number>>;
  readonly rerollsUsed: number;
}

/** Event snapshot: options and roll slots resolved once at first open. */
export interface EventSnapshot {
  readonly kind: 'EVENT';
  readonly snapshotId: string;
  readonly nodeId: string;
  readonly seed: number;
  readonly eventId: string;
  readonly options: readonly EventOptionState[];
  readonly rollSlots: Readonly<Record<string, number>>;
}

/** Combat reward snapshot: the claim options, resolved once at open. */
export interface RewardSnapshot {
  readonly kind: 'REWARD';
  readonly snapshotId: string;
  readonly nodeId: string;
  readonly seed: number;
  readonly rewardIds: readonly string[];
  readonly rollSlots: Readonly<Record<string, number>>;
}

/** Persisted snapshot map: one snapshot per node, never re-materialized. */
export type NodeSnapshot = OfferSnapshot | EventSnapshot | RewardSnapshot;

/** Ledger entry for one node action: replay returns it with zero mutation. */
export interface TransactionRecord {
  readonly transactionId: string;
  readonly nodeId: string;
  readonly action: string;
  readonly status: 'COMMITTED' | 'REJECTED' | 'FAILED';
  readonly reason?: string;
  readonly outcomeIds: readonly string[];
}

/** User intent; the UI never rolls RNG or mutates wallets itself. */
export interface NodeActionRequest {
  readonly transactionId: string;
  readonly nodeId: string;
  readonly action: string;
  readonly optionId?: string;
}

/** Content-side node instance: what the map and content revision say. */
export interface NodeDefinition {
  readonly nodeId: string;
  readonly type: NodeType;
  readonly contentRevision: string;
  readonly payloadKey: string;
}

/** What the UI is allowed to show before a commit (no hidden consequences). */
export interface NodePreviewData {
  readonly nodeId: string;
  readonly type: NodeType;
  readonly instabilityDelta: number;
  readonly rewardCategoryKey: string;
  readonly actions: readonly string[];
  readonly consequences: readonly string[];
}

/**
 * NodeRunState: the persisted Phase 32 run container. Run currency and
 * temporary content stay separate from the permanent profile; every mutation
 * flows through the ledger so a kill or reload resumes at the last commit.
 */
export interface NodeRunState {
  readonly revision: number;
  readonly runId: string;
  readonly modeId: string;
  readonly contentRevision: string;
  readonly seed: number;
  readonly mapHash: string;
  readonly gold: number;
  readonly instability: number;
  readonly goldEarned: number;
  readonly securedLoot: readonly string[];
  readonly unsecuredLoot: readonly string[];
  readonly relics: readonly string[];
  readonly recruits: readonly string[];
  readonly knowledge: readonly string[];
  readonly troopCopies: Readonly<Record<string, number>>;
  readonly visits: Readonly<Record<string, NodeVisitState>>;
  readonly snapshots: Readonly<Record<string, NodeSnapshot>>;
  readonly ledger: Readonly<Record<string, TransactionRecord>>;
}

/**
 * Closed outcome command union (handbook §5/§15): deterministic effects only.
 * Unknown command kinds are rejected before anything is applied — never
 * partially applied.
 */
export type OutcomeCommand =
  | { readonly kind: 'GOLD_DELTA'; readonly amount: number }
  | { readonly kind: 'INSTABILITY_DELTA'; readonly amount: number }
  | { readonly kind: 'GRANT_SECURED_LOOT'; readonly rewardId: string }
  | { readonly kind: 'GRANT_UNSECURED_LOOT'; readonly rewardId: string }
  | { readonly kind: 'REMOVE_UNSECURED_LOOT'; readonly rewardId: string }
  | { readonly kind: 'GRANT_RELIC'; readonly relicId: string }
  | { readonly kind: 'GRANT_KNOWLEDGE'; readonly knowledgeId: string }
  | { readonly kind: 'RECRUIT_TROOP'; readonly troopTypeId: string }
  | { readonly kind: 'POLISH_ITEM'; readonly itemId: string }
  | { readonly kind: 'REPAIR_ITEM'; readonly itemId: string };

/** Result of applying one outcome command batch (exactly-once per batch). */
export interface CommandBatchResult {
  readonly state: NodeRunState;
  readonly outcomeIds: readonly string[];
  readonly replayedCount: number;
}
