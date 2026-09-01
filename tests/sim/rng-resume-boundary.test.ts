import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { composeResumeStreamSnapshot, restoreStreamsForResume } from '../../src/game/sim/snapshot/random-resume.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { XoshiroState } from '../../src/game/sim/random/xoshiro128ss.js';
import { battle, randomSession } from './test-helpers.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

describe('rng resume boundary', () => {
  it('kernel rejects a random session that does not match authoritative snapshot state', () => {
    const mismatched = randomSession();
    mismatched.streams.require('map').nextUint32();
    let thrown: unknown;
    try {
      stepBattle({ state: battle(), input, random: mismatched, rules: {}, content: {}, systems: [] });
    } catch (error) {
      thrown = error;
    }
    const err = thrown as { code?: string; details?: { reason?: string } };
    expect(err.code).toBe('P14_SNAPSHOT_INVALID');
    expect(err.details?.reason).toBe('rng-state-mismatch');
  });

  it('resume adapter restores authoritative streams and accepts injected cosmetic state', () => {
    const original = randomSession();
    original.streams.require('encounter').nextUint32();
    original.streams.require('rewards').nextUint32();
    const authoritative = original.streams.snapshotAuthoritative();
    const cosmetic = [1, 2, 3, 4] as unknown as XoshiroState;
    const full = composeResumeStreamSnapshot(authoritative, cosmetic);
    expect(full.combatCosmetic).toEqual(cosmetic);
    const restored = restoreStreamsForResume(authoritative, cosmetic);
    expect(restored.snapshotAuthoritative()).toEqual(authoritative);
    expect(restored.require('combatCosmetic').snapshot()).toEqual(cosmetic);
  });

  it('cosmetic-only draw does not invalidate an authoritative battle snapshot', () => {
    const random = randomSession();
    random.streams.require('combatCosmetic').nextUint32();
    const result = stepBattle({ state: battle(), input, random, rules: {}, content: {}, systems: [] });
    expect(result.state.tick).toBe(1);
  });
});
