import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { createSnapshot, verifySnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import { battle, randomSession } from './test-helpers.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

interface Run60 { state: BattleModel; checkpoints: [number, string][] }

function run60(): Run60 {
  let state = battle();
  const random = randomSession();
  const checkpoints: [number, string][] = [];
  for (let i = 0; i < 60; i++) {
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems: [] });
    state = r.state;
    if (r.checkpoint) checkpoints.push([state.tick, r.checkpoint.checksum]);
  }
  return { state, checkpoints };
}

describe('checkpoint run', () => {
  it('checkpoint ticks are 30 and 60 for a 60-tick run', () => {
    expect(run60().checkpoints.map((x) => x[0])).toEqual([30, 60]);
  });

  it('two 60-tick runs are byte-identical', () => {
    expect(run60()).toEqual(run60());
  });

  it('snapshot resume continues with identical next checkpoint', () => {
    const a = run60();
    const snap = createSnapshot(a.state);
    expect(verifySnapshot(snap)).toBe(true);
    const random = randomSession();
    const resumed = stepBattle({ state: snap, input, random, rules: {}, content: {}, systems: [] });
    const direct = stepBattle({ state: a.state, input, random: randomSession(), rules: {}, content: {}, systems: [] });
    expect(resumed.state.tick).toBe(direct.state.tick);
    expect(createSnapshot(resumed.state).checksum).toBe(createSnapshot(direct.state).checksum);
  });
});
