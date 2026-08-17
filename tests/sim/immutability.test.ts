import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import { battle, randomSession } from './test-helpers.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

describe('kernel immutability', () => {
  it('systems cannot mutate frozen prior state', () => {
    const system: KernelSystem = {
      id: 'mutator', stage: 'A',
      run(c) {
        const mutable = c.state as unknown as { entities: [{ lp: number }] };
        mutable.entities[0].lp = 1;
      },
    };
    expect(() => stepBattle({ state: battle(), input, random: randomSession(), rules: {}, content: {}, systems: [system] })).toThrow(/read only|not extensible|Cannot assign/);
  });
});
