import { RenderError } from './render-error.js';

/**
 * Pool and quality contract: pool pressure may degrade cosmetics only.
 * Telegraphs, warnings and accessibility signals are untouchable.
 */
export type CosmeticKind = 'decorative_particle' | 'damage_number' | 'trail' | 'screen_effect';
export type CriticalKind = 'telegraph' | 'warning' | 'accessibility_signal';
export type PoolKind = CosmeticKind | CriticalKind;

export const COSMETIC_KINDS: readonly CosmeticKind[] = Object.freeze([
  'decorative_particle',
  'damage_number',
  'trail',
  'screen_effect',
]);

export const CRITICAL_KINDS: readonly CriticalKind[] = Object.freeze(['telegraph', 'warning', 'accessibility_signal']);

export function isCosmeticKind(kind: PoolKind): boolean {
  return (COSMETIC_KINDS as readonly PoolKind[]).includes(kind);
}

export function mayDropOnPressure(kind: PoolKind): boolean {
  return isCosmeticKind(kind);
}

/**
 * Pure allocation ledger. Pools must fully release on scene teardown:
 * reset() returns every counter to zero.
 */
export interface PoolLedger {
  readonly counts: Readonly<Record<PoolKind, number>>;
  readonly total: number;
  alloc(kind: PoolKind): void;
  release(kind: PoolKind): void;
  reset(): void;
}

export function createPoolLedger(): PoolLedger {
  let counts: Record<PoolKind, number> = { decorative_particle: 0, damage_number: 0, trail: 0, screen_effect: 0, telegraph: 0, warning: 0, accessibility_signal: 0 };
  let total = 0;

  function snapshot(): Readonly<Record<PoolKind, number>> {
    return Object.freeze({ ...counts });
  }

  return {
    get counts() {
      return snapshot();
    },
    get total() {
      return total;
    },
    alloc(kind) {
      counts = { ...counts, [kind]: counts[kind] + 1 };
      total += 1;
    },
    release(kind) {
      const current = counts[kind];
      if (current <= 0) throw new RenderError('POOL_UNDERFLOW', { kind });
      counts = { ...counts, [kind]: current - 1 };
      total -= 1;
    },
    reset() {
      counts = { decorative_particle: 0, damage_number: 0, trail: 0, screen_effect: 0, telegraph: 0, warning: 0, accessibility_signal: 0 };
      total = 0;
    },
  };
}
