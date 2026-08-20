/**
 * Phase 29 slice types (SLICE_MANIFEST_CONTRACT + E2E_FLOW_CONTRACT):
 * the Ash King vertical slice is a closed roster of exactly four heroes and
 * six troops plus authorized others; every entry is revision-bound and
 * referentially closed. Routes form a closed ordered flow with stable ids;
 * battle/result/reward commits are exactly-once ledger entries.
 */
export type SliceKind = 'HERO' | 'TROOP' | 'ENEMY' | 'BOSS' | 'ITEM' | 'RELIC' | 'EVENT' | 'MODIFIER';

export interface SliceEntry {
  readonly id: string;
  readonly kind: SliceKind;
  readonly revision: string;
  readonly assetsReady: boolean;
  readonly localesReady: boolean;
  readonly testsReady: boolean;
}

export interface SliceManifest {
  readonly schemaVersion: number;
  readonly contentRevision: string;
  readonly heroes: readonly SliceEntry[];
  readonly troops: readonly SliceEntry[];
  readonly others: readonly SliceEntry[];
}

export type CommitKind = 'BATTLE_START' | 'RESULT' | 'REWARD';

export interface CommitLedger {
  readonly committed: Readonly<Record<string, CommitKind>>;
}

export const ROUTES = [
  'TITLE',
  'HQ',
  'MISSION',
  'GROUP',
  'FORMATION',
  'DUNGEON_MAP',
  'NODE_PREVIEW',
  'PREBATTLE',
  'BATTLE',
  'RESULT',
  'REWARD_OR_ANCHOR',
  'MISSION_END',
] as const;
export type Route = (typeof ROUTES)[number];

export type Quality = 'LOW' | 'REDUCED' | 'STANDARD' | 'HIGH';

export interface HashSample {
  readonly seed: string;
  readonly speedX10: number;
  readonly quality: Quality;
  readonly endHash: string;
}
