import { describe, expect, it } from 'vitest';
import { canonicalJsonWith, canonicalUtf8With, type NumberPolicy } from '../../src/game/sim/canonical-json-shared.js';

/** Deterministic 32-bit PRNG (mulberry32) for value generation. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const err = (reason: string): Error => new Error(reason);

/** Edge finite numbers that every policy must round-trip losslessly. */
const EDGE_FINITE_NUMBERS: readonly number[] = [
  0, 1, -1, 2, -2, 0.5, -0.5, 1.5, -1.5, 3.141592653589793, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER,
  Number.MAX_SAFE_INTEGER + 1, Number.MIN_SAFE_INTEGER - 1, 1e21, -1e21, 1e-21, 5e-324, 2.2250738585072014e-308,
  0.1 + 0.2, 1 / 3, Number('123456789.123456789'), -(Number.MAX_SAFE_INTEGER + 1),
];

const SAFE_INTEGERS: readonly number[] = [
  0, 1, -1, 2, -2, 42, -42, 65535, -65535, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, 10 ** 9, -(10 ** 9),
];

const KEY_EDGES: readonly string[] = ['', 'a', 'z', 'A', 'Z', '0', '9', '_', 'foo', 'Foo', 'foo_bar', 'ümlaut', '中', '"quoted"', 'a\\b', 'line\nbreak', '\u0000null'];

interface GenConfig {
  readonly rand: () => number;
  readonly depth: number;
  readonly numbers: readonly number[];
}

function genValue(cfg: GenConfig): unknown {
  const roll = cfg.rand();
  if (cfg.depth <= 0 || roll < 0.45) {
    // Leaf: number / string / boolean / null.
    const leaf = cfg.rand();
    if (leaf < 0.4) return cfg.numbers[Math.floor(cfg.rand() * cfg.numbers.length)] ?? 0;
    if (leaf < 0.6) return KEY_EDGES[Math.floor(cfg.rand() * KEY_EDGES.length)] ?? '';
    if (leaf < 0.8) return cfg.rand() < 0.5;
    return null;
  }
  if (roll < 0.7) {
    // Object with a stable key set but randomized value assignment, so the
    // canonical ordering property is exercised across insertions.
    const keys = [...KEY_EDGES].sort(() => cfg.rand() - 0.5).slice(0, 1 + Math.floor(cfg.rand() * 4));
    const out: Record<string, unknown> = {};
    for (const key of keys) out[key] = genValue({ ...cfg, depth: cfg.depth - 1 });
    return out;
  }
  // Array.
  const length = Math.floor(cfg.rand() * 4);
  return Array.from({ length }, () => genValue({ ...cfg, depth: cfg.depth - 1 }));
}

function roundTrip(value: unknown, policy: NumberPolicy): unknown {
  const encoded = canonicalJsonWith(value, err, policy);
  return JSON.parse(encoded);
}

/** True when JSON.stringify renders this number back to the same double. */
function stringifyExact(n: number): boolean {
  return JSON.parse(JSON.stringify(n)) === n;
}

/** True when every number leaf in the value survives JSON stringify exactly. */
function allNumbersStringifyExact(value: unknown): boolean {
  if (typeof value === 'number') return stringifyExact(value);
  if (Array.isArray(value)) return value.every(allNumbersStringifyExact);
  if (value !== null && typeof value === 'object') return Object.values(value as Record<string, unknown>).every(allNumbersStringifyExact);
  return true;
}

/** Deep equality for JSON round-trip checks (numbers by Object.is; object key
 * order ignored — the canonical form deliberately sorts keys). */
function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return Object.is(a, b);
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => jsonEqual(v, b[i]));
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const ar = a as Record<string, unknown>;
    const br = b as Record<string, unknown>;
    const ak = Object.keys(ar);
    const bk = Object.keys(br);
    if (ak.length !== bk.length) return false;
    for (const key of ak) {
      if (!Object.hasOwn(br, key) || !jsonEqual(ar[key], br[key])) return false;
    }
    return true;
  }
  return false;
}

describe('shared canonical JSON — finite-allowed round-trip fuzz', () => {
  it('is canonical-idempotent for every generated value and lossless when JSON stringify is exact (10k cases)', { timeout: 60_000 }, () => {
    const rand = mulberry32(0xca_10_01);
    let exactCases = 0;
    for (let i = 0; i < 10_000; i++) {
      const value = genValue({ rand, depth: 1 + Math.floor(rand() * 4), numbers: EDGE_FINITE_NUMBERS });
      const encoded = canonicalJsonWith(value, err, 'finite-allowed');
      // The encoder's contract: parsing the canonical form and re-encoding is
      // byte-identical (encode∘parse∘encode = encode).
      expect(canonicalJsonWith(JSON.parse(encoded), err, 'finite-allowed'), `idempotence case ${String(i)}`).toBe(encoded);
      // And when every number leaf survives JSON stringify exactly, the parse
      // round-trip reproduces the original value bit-for-bit.
      if (allNumbersStringifyExact(value)) {
        exactCases += 1;
        const decoded = roundTrip(value, 'finite-allowed');
        expect(jsonEqual(decoded, value), `lossless case ${String(i)}: ${encoded}`).toBe(true);
      }
    }
    // The exact-lossless branch must actually be exercised by the generator.
    expect(exactCases).toBeGreaterThan(0);
  });

  it('rejects only NaN, Infinity and -0 among numbers', () => {
    const accepted = [1.5, 1e21, 5e-324, Number.MAX_SAFE_INTEGER + 1, -Number.MIN_SAFE_INTEGER - 1];
    for (const n of accepted) {
      expect(() => canonicalJsonWith({ n }, err, 'finite-allowed')).not.toThrow();
    }
    for (const n of [NaN, Infinity, -Infinity, -0]) {
      expect(() => canonicalJsonWith({ n }, err, 'finite-allowed')).toThrow();
    }
  });
});

describe('shared canonical JSON — safe-integers-only round-trip fuzz', () => {
  it('round-trips integer-only values losslessly and rejects non-integers (10k cases)', { timeout: 60_000 }, () => {
    const rand = mulberry32(0x5a_fe_02);
    for (let i = 0; i < 10_000; i++) {
      const value = genValue({ rand, depth: 1 + Math.floor(rand() * 4), numbers: SAFE_INTEGERS });
      // String(int) is exact, so the parse round-trip must be bit-for-bit.
      const decoded = roundTrip(value, 'safe-integers-only');
      expect(jsonEqual(decoded, value), `case ${String(i)}: ${JSON.stringify(value)}`).toBe(true);
    }
    // Non-integer finite numbers are rejected in this policy.
    for (const n of [1.5, -0.5, 1e21, 5e-324, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => canonicalJsonWith({ n }, err, 'safe-integers-only')).toThrow();
    }
  });
});

describe('shared canonical JSON — canonical ordering and determinism', () => {
  it('sorts object keys by code-unit comparison regardless of insertion order', () => {
    const a = canonicalJsonWith({ b: 1, A: 2, a: 3, '': 4, '中': 5 }, err, 'safe-integers-only');
    const b = canonicalJsonWith({ '中': 5, a: 3, A: 2, b: 1, '': 4 }, err, 'safe-integers-only');
    expect(a).toBe(b);
    // Code-unit order: '' < 'A' < 'a' < 'b' < '中'.
    expect(a).toBe('{"":4,"A":2,"a":3,"b":1,"中":5}');
  });

  it('encodes identically across 200 randomized insertions (permutation stability)', () => {
    const rand = mulberry32(0xdefaced3);
    const keys = KEY_EDGES.filter((k) => k.length > 0);
    const baseline: Record<string, number> = {};
    for (let i = 0; i < keys.length; i++) baseline[keys[i] ?? `k${String(i)}`] = i;
    const first = canonicalJsonWith(baseline, err, 'finite-allowed');
    for (let i = 0; i < 200; i++) {
      const shuffled: Record<string, number> = {};
      const order = [...keys].sort(() => rand() - 0.5);
      for (const key of order) shuffled[key] = keys.indexOf(key);
      expect(canonicalJsonWith(shuffled, err, 'finite-allowed')).toBe(first);
    }
  });
});

describe('shared canonical JSON — structural validation', () => {
  it('rejects cycles, non-plain prototypes and undefined leaves in both policies', () => {
    for (const policy of ['safe-integers-only', 'finite-allowed'] as const) {
      const x: Record<string, unknown> = {};
      x['self'] = x;
      expect(() => canonicalJsonWith(x, err, policy)).toThrow();
      expect(() => canonicalJsonWith(new Date(0), err, policy)).toThrow();
      expect(() => canonicalJsonWith({ u: undefined }, err, policy)).toThrow();
      expect(() => canonicalJsonWith(undefined, err, policy)).toThrow();
    }
  });

  it('produces identical UTF-8 bytes for the same input across policies', () => {
    const value = { '中': [1, 2], z: 'ümlaut', a: { b: true } };
    const utf8 = canonicalUtf8With(value, err, 'safe-integers-only');
    expect(utf8).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(utf8)).toBe(canonicalJsonWith(value, err, 'safe-integers-only'));
  });
});
