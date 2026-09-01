/**
 * Reward pools (GDD §22/§23.3): deterministic weighted picks with no empty or
 * invalid entries, rarity weights 70/27/3 (gewöhnlich/selten/legendär),
 * three distinct options whenever the pool holds at least three, and full
 * cap / duplicate rules delegated to run-economy. An unknown pool or empty
 * pool is a content build error, never a silent empty reward.
 */
import { ExpeditionError } from './expedition-error.js';
import { nextU32 } from './stable.js';

export type Rarity = 'COMMON' | 'RARE' | 'LEGENDARY';

export interface PoolEntry {
  readonly rewardId: string;
  readonly rarity: Rarity;
  readonly weight: number;
  readonly kind: 'ITEM' | 'RELIC' | 'BANNER';
  readonly merchantBaseGold: number;
}

export interface RewardPool {
  readonly id: string;
  readonly entries: readonly PoolEntry[];
}

export const RARITIES: readonly Rarity[] = ['COMMON', 'RARE', 'LEGENDARY'];
export const RARITY_WEIGHTS: Readonly<Record<Rarity, number>> = { COMMON: 70, RARE: 27, LEGENDARY: 3 };
export const REWARD_CHOICE_COUNT = 3;

export function isRarity(value: unknown): value is Rarity {
  return typeof value === 'string' && RARITIES.includes(value as Rarity);
}

/** Content build validation: pools are never empty and entries are unique. */
export function validatePool(pool: RewardPool): void {
  if (pool.id === '') throw new ExpeditionError('CONTENT_BUILD_ERROR', { reason: 'pool id empty' });
  if (pool.entries.length === 0) {
    throw new ExpeditionError('CONTENT_BUILD_ERROR', { poolId: pool.id, reason: 'empty pool' });
  }
  const ids = new Set<string>();
  for (const entry of pool.entries) {
    if (entry.rewardId === '' || !isRarity(entry.rarity)) {
      throw new ExpeditionError('CONTENT_BUILD_ERROR', { poolId: pool.id, entry: entry.rewardId, reason: 'invalid entry' });
    }
    if (!Number.isSafeInteger(entry.weight) || entry.weight <= 0 || !Number.isSafeInteger(entry.merchantBaseGold) || entry.merchantBaseGold < 0) {
      throw new ExpeditionError('CONTENT_BUILD_ERROR', { poolId: pool.id, entry: entry.rewardId, reason: 'invalid weight or value' });
    }
    if (ids.has(entry.rewardId)) {
      throw new ExpeditionError('CONTENT_BUILD_ERROR', { poolId: pool.id, entry: entry.rewardId, reason: 'duplicate reward id' });
    }
    ids.add(entry.rewardId);
  }
}

function pickOne(entries: readonly PoolEntry[], r: number): PoolEntry {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = r % total;
  for (const entry of entries) {
    if (roll < entry.weight) return entry;
    roll -= entry.weight;
  }
  const last = entries[entries.length - 1];
  if (last === undefined) throw new ExpeditionError('CONTENT_BUILD_ERROR', { reason: 'empty pool' });
  return last;
}

/**
 * Deterministic weighted sampling without replacement. Rolls are consumed in
 * a fixed order, so parallel workers merging per-seed results are stable.
 */
export function pickFromPool(pool: RewardPool, seed: number, count: number): readonly PoolEntry[] {
  validatePool(pool);
  const remaining = [...pool.entries];
  const picked: PoolEntry[] = [];
  let cursor = seed >>> 0;
  while (picked.length < count && remaining.length > 0) {
    cursor = nextU32(cursor);
    const index = remaining.indexOf(pickOne(remaining, cursor));
    if (index === -1) {
      throw new ExpeditionError('CONTENT_BUILD_ERROR', { poolId: pool.id, reason: 'pick failed' });
    }
    const [chosen] = remaining.splice(index, 1);
    if (chosen !== undefined) picked.push(chosen);
  }
  return picked;
}

/** A reward choice: three distinct options whenever the pool allows it. */
export function rewardChoice(pool: RewardPool, seed: number): readonly PoolEntry[] {
  const count = pool.entries.length >= REWARD_CHOICE_COUNT ? REWARD_CHOICE_COUNT : pool.entries.length;
  return pickFromPool(pool, seed, count);
}

/** Rarity of one entry by its declared rarity; weights stay with the entry. */
export function rarityWeight(rarity: Rarity): number {
  return RARITY_WEIGHTS[rarity];
}
