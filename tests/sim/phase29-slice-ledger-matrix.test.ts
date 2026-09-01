import { describe, expect, it } from 'vitest';
import { commitCounts, commitOnce, emptyLedger, hasCommitted, kindOf } from '../../src/game/slice/commit-ledger.js';
import { expectedSampleCount, isQuality, SPEED_MULTIPLIERS_X10, validateHashMatrix } from '../../src/game/slice/hash-matrix.js';
import { SLICE_VIOLATION_CODES, validateSlice } from '../../src/game/slice/slice-validator.js';
import { catchSliceCode, sliceEntry, validManifest } from './phase29-helpers.js';

describe('phase29 slice manifest validation', () => {
  it('accepts the canonical 4-hero / 6-troop / boss roster', () => {
    const result = validateSlice(validManifest());
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('reports HERO_COUNT and TROOP_COUNT violations', () => {
    const manifest = validManifest();
    expect(validateSlice({ ...manifest, heroes: manifest.heroes.slice(0, 3) }).violations.map((v) => v.code)).toContain('HERO_COUNT');
    expect(validateSlice({ ...manifest, troops: manifest.troops.slice(0, 5) }).violations.map((v) => v.code)).toContain('TROOP_COUNT');
  });

  it('reports DUPLICATE_ID and MISSING_REVISION per entry', () => {
    const manifest = validManifest();
    const firstHero = manifest.heroes[0];
    if (firstHero === undefined) throw new Error('manifest helper invariant');
    const heroes = [...manifest.heroes, { ...firstHero, revision: '' }];
    const result = validateSlice({ ...manifest, heroes });
    const codes = result.violations.map((v) => v.code);
    expect(codes).toContain('DUPLICATE_ID');
    expect(codes).toContain('MISSING_REVISION');
    const duplicate = result.violations.find((v) => v.code === 'DUPLICATE_ID');
    expect(duplicate?.id).toBe(manifest.heroes[0]?.id);
  });

  it('reports BOSS_MISSING without a boss entry', () => {
    const manifest = validManifest();
    expect(validateSlice({ ...manifest, others: [] }).violations.map((v) => v.code)).toContain('BOSS_MISSING');
  });

  it('reports UNRESOLVED_CONTENT_REVISION on the placeholder revision', () => {
    const manifest = { ...validManifest(), contentRevision: 'UNRESOLVED' };
    expect(validateSlice(manifest).violations.map((v) => v.code)).toContain('UNRESOLVED_CONTENT_REVISION');
  });

  it('dedupes findings and sorts by code', () => {
    const manifest = validManifest();
    const firstHero = manifest.heroes[0];
    if (firstHero === undefined) throw new Error('manifest helper invariant');
    const heroes = [...manifest.heroes, firstHero, firstHero];
    const result = validateSlice({ ...manifest, heroes });
    const duplicates = result.violations.filter((v) => v.code === 'DUPLICATE_ID');
    expect(duplicates).toHaveLength(1);
    const codes = result.violations.map((v) => v.code);
    expect([...codes].sort()).toEqual(codes);
  });

  it('closed violation codes cover every emitted code', () => {
    const manifest = validManifest();
    const adversarial = {
      ...manifest,
      heroes: [],
      troops: [],
      others: [sliceEntry('x', 'BOSS', { revision: '' })],
      contentRevision: '',
    };
    for (const item of validateSlice(adversarial).violations) {
      expect(SLICE_VIOLATION_CODES, item.code).toContain(item.code);
    }
  });
});

describe('phase29 commit ledger exactly-once', () => {
  it('records a commit once and returns the prior receipt on repeat', () => {
    const ledger = emptyLedger();
    const once = commitOnce(ledger, 'run-1', 'BATTLE_START');
    expect(once.committed['run-1']).toBe('BATTLE_START');
    expect(commitOnce(once, 'run-1', 'BATTLE_START')).toBe(once);
    expect(hasCommitted(once, 'run-1')).toBe(true);
    expect(kindOf(once, 'run-1')).toBe('BATTLE_START');
    expect(kindOf(once, 'run-2')).toBeNull();
  });

  it('rejects a different commit kind under the same id', () => {
    const ledger = commitOnce(emptyLedger(), 'run-1', 'RESULT');
    expect(catchSliceCode(() => commitOnce(ledger, 'run-1', 'REWARD'))).toBe('COMMIT_KIND_CONFLICT');
  });

  it('counts exactly one reward across a full run', () => {
    let ledger = emptyLedger();
    ledger = commitOnce(ledger, 'run-9:start', 'BATTLE_START');
    ledger = commitOnce(ledger, 'run-9:result', 'RESULT');
    ledger = commitOnce(ledger, 'run-9:reward', 'REWARD');
    // Double-tap on the same reward transaction is idempotent.
    ledger = commitOnce(ledger, 'run-9:reward', 'REWARD');
    const counts = commitCounts(ledger);
    expect(counts.BATTLE_START).toBe(1);
    expect(counts.RESULT).toBe(1);
    expect(counts.REWARD).toBe(1);
  });
});

describe('phase29 hash matrix invariance', () => {
  const endHash = (n: number): string => `hash-${String(n).padStart(6, '0')}`;

  it('accepts identical end hashes across speeds and qualities', () => {
    const samples = SPEED_MULTIPLIERS_X10.flatMap((speedX10) =>
      (['LOW', 'REDUCED', 'STANDARD', 'HIGH'] as const).map((quality) => ({ seed: 'ASHKING_GOLDEN_01', speedX10, quality, endHash: endHash(1) })),
    );
    expect(validateHashMatrix(samples)).toEqual([]);
    expect(samples).toHaveLength(expectedSampleCount(1));
  });

  it('reports HASH_MISMATCH divergences with speed and quality', () => {
    const samples = [
      { seed: 'ASHKING_GOLDEN_01', speedX10: 5, quality: 'LOW' as const, endHash: endHash(1) },
      { seed: 'ASHKING_GOLDEN_01', speedX10: 10, quality: 'HIGH' as const, endHash: endHash(2) },
    ];
    const divergences = validateHashMatrix(samples);
    expect(divergences).toHaveLength(1);
    expect(divergences[0]).toMatchObject({ seed: 'ASHKING_GOLDEN_01', speedX10: 10, quality: 'HIGH', expected: endHash(1), actual: endHash(2) });
  });

  it('accepts only the closed quality set', () => {
    expect(isQuality('LOW')).toBe(true);
    expect(isQuality('ULTRA')).toBe(false);
    expect(expectedSampleCount(3)).toBe(48);
  });
});
