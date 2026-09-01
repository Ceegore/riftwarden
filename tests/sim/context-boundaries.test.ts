import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import { battle, randomSession } from './test-helpers.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([{ sequence: 1, kind: 'speed', value: '2x' }]), contentVersion: 'content_fixture' });

describe('context boundaries', () => {
  const mutations: [string, (c: Parameters<KernelSystem['run']>[0]) => void][] = [
    ['input', (c) => { (c.input as unknown as { decisions: [{ value: string }] }).decisions[0].value = '3x'; }],
    ['rules', (c) => { (c.rules as unknown as { limit: number }).limit = 9; }],
    ['content', (c) => { (c.content as unknown as { hero: unknown }).hero = {}; }],
  ];

  for (const [name, mutate] of mutations) {
    it(`${name} reference is frozen for systems`, () => {
      const system: KernelSystem = { id: `mutate.${name}`, stage: 'A', run: mutate };
      expect(() => stepBattle({ state: battle(), input, random: randomSession(), rules: { limit: 1 }, content: { hero: 'x' }, systems: [system] })).toThrow(/read only|not extensible|Cannot assign/);
    });
  }

  it('authorized random draw is deterministic and only consumed when system runs', () => {
    const a = randomSession(true);
    const b = randomSession(true);
    const system: KernelSystem = { id: 'draw', stage: 'D', run(c) { c.random.streams.require('encounter').nextUint32(); } };
    stepBattle({ state: battle(), input, random: a, rules: {}, content: {}, systems: [system] });
    stepBattle({ state: battle(), input: { ...input, paused: true }, random: b, rules: {}, content: {}, systems: [system] });
    expect(a.streams.snapshotAuthoritative().encounter).not.toEqual(b.streams.snapshotAuthoritative().encounter);
  });
});
