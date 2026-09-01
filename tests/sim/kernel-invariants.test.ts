import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import { battle, entity, randomSession, tick } from './test-helpers.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

describe('kernel invariants', () => {
  it('duplicate stable entity IDs block snapshot', () => {
    expect(() => createSnapshot(battle({ entities: [entity('same'), entity('same')] }))).toThrow(/P14_DUPLICATE_ENTITY|P14_SNAPSHOT_INVALID/);
  });

  it('hard battle limit blocks unresolved tick 5400', () => {
    expect(() => stepBattle({ state: battle({ tick: tick(5400) }), input, random: randomSession(), rules: {}, content: {}, systems: [] })).toThrow(/P14_HARD_LIMIT/);
  });

  it('resolving end advances once per tick and blocks fourth', () => {
    let state = battle({ phase: Object.freeze({ phase: 'RESOLVING_END', enteredTick: tick(0), resolvingEndTicks: 0 }) });
    for (let i = 1; i <= 3; i++) {
      state = stepBattle({ state, input, random: randomSession(), rules: {}, content: {}, systems: [] }).state;
      expect(state.phase.resolvingEndTicks).toBe(i);
    }
    expect(() => stepBattle({ state, input, random: randomSession(), rules: {}, content: {}, systems: [] })).toThrow(/P14_RESOLVING_END_LIMIT/);
  });

  it('cosmetic draw cannot affect authoritative checkpoint', () => {
    const a = randomSession();
    const b = randomSession();
    b.streams.require('combatCosmetic').nextUint32();
    const state = battle({ tick: tick(29) });
    const one = stepBattle({ state, input, random: a, rules: {}, content: {}, systems: [] });
    const two = stepBattle({ state, input, random: b, rules: {}, content: {}, systems: [] });
    expect(one.checkpoint?.checksum).toBe(two.checkpoint?.checksum);
  });
});
