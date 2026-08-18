import { KernelInvariantError } from '../core/invariant-error.js';

const ID = /^[a-z][a-z0-9_]*$/;

/**
 * Authoritative shield source (§P17-T04 §8.2). Shields stay separate sources
 * with their own identity, remaining amount, expiry and priority; a shared UI
 * pool may only be aggregated from this ledger. Values are never negative.
 */
export interface ShieldSource {
  /** Stable per-battle shield identity (unique across the whole battle). */
  readonly shieldId: string;
  /** Source entity/effect that granted the shield. */
  readonly sourceId: string;
  readonly effectId: string;
  readonly remaining: number;
  readonly expiryTick: number;
  /** Higher consumes first; ties break by oldest applicationSequence. */
  readonly priority: number;
  /** Monotonic application ordinal from the battle counter. */
  readonly applicationSequence: number;
}

export interface ShieldConsumption {
  readonly absorbed: number;
  /** Per-touched-source absorption detail (for the §8.2 consumption events). */
  readonly perSource: readonly { readonly shieldId: string; readonly absorbed: number; readonly remainingAfter: number }[];
}

export function validateShieldSource(source: ShieldSource): void {
  if (!ID.test(source.shieldId) || !ID.test(source.sourceId) || !ID.test(source.effectId)) {
    throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'shield-ids', shieldId: source.shieldId });
  }
  for (const [key, value] of Object.entries({ remaining: source.remaining, expiryTick: source.expiryTick, priority: source.priority, applicationSequence: source.applicationSequence })) {
    if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
      throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'shield-field-invalid', key, value });
    }
  }
}

/**
 * Consumption order: highest priority first, then oldest application. Each
 * source absorbs min(remaining, amountLeft); values never go negative.
 */
export function consumeShields(sources: readonly ShieldSource[], amount: number): { readonly sources: readonly ShieldSource[]; readonly consumption: ShieldConsumption } {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'shield-consume-amount', amount });
  const ordered = [...sources].sort((a, b) => b.priority - a.priority || a.applicationSequence - b.applicationSequence);
  const next: ShieldSource[] = [];
  const perSource: { shieldId: string; absorbed: number; remainingAfter: number }[] = [];
  let remainingToAbsorb = amount;
  for (const source of ordered) {
    if (remainingToAbsorb <= 0) {
      next.push(source);
      continue;
    }
    const take = Math.min(source.remaining, remainingToAbsorb);
    if (take > 0) {
      remainingToAbsorb -= take;
      const remainingAfter = source.remaining - take;
      perSource.push({ shieldId: source.shieldId, absorbed: take, remainingAfter });
      if (remainingAfter > 0) {
        next.push(Object.freeze({ ...source, remaining: remainingAfter }));
      }
    } else {
      next.push(source);
    }
  }
  return { sources: Object.freeze(next), consumption: Object.freeze({ absorbed: amount - remainingToAbsorb, perSource: Object.freeze(perSource) }) };
}

/** Removes sources whose expiryTick has passed; emits one aggregate expiry row per shield. */
export function expireShields(sources: readonly ShieldSource[], atTick: number): { readonly sources: readonly ShieldSource[]; readonly expired: readonly ShieldSource[] } {
  const kept: ShieldSource[] = [];
  const expired: ShieldSource[] = [];
  for (const source of sources) {
    if (source.expiryTick > 0 && atTick >= source.expiryTick) expired.push(source);
    else kept.push(source);
  }
  return { sources: Object.freeze(kept), expired: Object.freeze(expired) };
}

/** Aggregate remaining shield amount for a UI pool / payload (§8.2). */
export function aggregateShields(sources: readonly ShieldSource[]): number {
  return sources.reduce((sum, source) => sum + source.remaining, 0);
}
