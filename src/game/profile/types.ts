/**
 * Phase 31 profile domain types (PROFILE_PROGRESSION_CONTRACT): owned/unlocked/
 * discovered are separate states; heroes use stable content ids, troop copies
 * add stable instance ids; currency, fame, level, contract level, copies and
 * stats are non-negative safe integers — no floats in saved state. Every
 * reference to equipment, kit or banner is validated, never silently repaired.
 */
export type CurrencyId = 'gold' | 'riftEssence';

export type TransactionKind = 'BUY_COPY' | 'BUY_CONTRACT' | 'EQUIP' | 'REMOVE' | 'POLISH' | 'SET_BANNER' | 'SET_KIT' | 'CREDIT_GOLD' | 'GRANT_ITEM';

export interface Wallet {
  readonly gold: number;
  readonly riftEssence: number;
}

export interface HeroState {
  readonly id: string;
  readonly unlocked: boolean;
  readonly level: 1 | 2 | 3;
  readonly fame: number;
  readonly equipmentId?: string;
}

export interface TroopCopy {
  readonly instanceId: string;
  readonly typeId: string;
  readonly kitId?: string;
}

export interface TroopTypeState {
  readonly typeId: string;
  readonly contractLevel: 1 | 2 | 3;
  readonly copies: readonly TroopCopy[];
}

export interface ItemState {
  readonly id: string;
  readonly owned: boolean;
  readonly polished: boolean;
  readonly ownerId?: string;
  readonly isBanner: boolean;
}

export interface Profile {
  readonly revision: 31;
  readonly wallet: Wallet;
  readonly heroes: Readonly<Record<string, HeroState>>;
  readonly troops: Readonly<Record<string, TroopTypeState>>;
  readonly items: Readonly<Record<string, ItemState>>;
  readonly activeBannerId?: string;
  readonly transactionLedger: Readonly<Record<string, TransactionResult>>;
}

export interface TransactionRequest {
  readonly transactionId: string;
  readonly kind: TransactionKind;
  readonly costGold: number;
  readonly mutate: (profile: Profile) => Profile;
}

export interface TransactionResult {
  readonly transactionId: string;
  readonly status: 'COMMITTED' | 'REJECTED';
  readonly reason?: 'INSUFFICIENT_FUNDS' | 'INVALID_REQUEST';
}

export const PROFILE_REVISION = 31 as const;

export const TRANSACTION_KINDS: readonly TransactionKind[] = [
  'BUY_COPY',
  'BUY_CONTRACT',
  'EQUIP',
  'REMOVE',
  'POLISH',
  'SET_BANNER',
  'SET_KIT',
  'CREDIT_GOLD',
  'GRANT_ITEM',
];
