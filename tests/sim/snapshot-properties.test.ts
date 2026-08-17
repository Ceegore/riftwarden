import { describe, expect, it } from 'vitest';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import type { KernelEntity } from '../../src/game/sim/core/entity.js';
import { battle, entity } from './test-helpers.js';

function shuffle(a: KernelEntity[], seed: number): KernelEntity[] {
  const x = [...a];
  let s = seed >>> 0;
  for (let i = x.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    const j = s % (i + 1);
    const atI = x[i];
    const atJ = x[j];
    if (atI === undefined || atJ === undefined) continue;
    x[i] = atJ;
    x[j] = atI;
  }
  return x;
}

describe('snapshot properties', () => {
  it('1000 entity insertion permutations preserve checkpoint hash', () => {
    const entities = Array.from({ length: 12 }, (_, i) => entity(`entity_${String(i).padStart(2, '0')}`, { x100: 100 + i }));
    const expected = createSnapshot(battle({ entities })).checksum;
    for (let i = 0; i < 1000; i++) expect(createSnapshot(battle({ entities: shuffle(entities, i) })).checksum).toBe(expected);
  });

  it('each authoritative entity field changes hash', () => {
    const base = battle();
    const hash = createSnapshot(base).checksum;
    const e = base.entities[0];
    if (!e) return;
    for (const patch of [{ lp: 999 }, { shield: 1 }, { x100: 1801 }, { lane: 'top' as const }, { targetId: 'entity_beta' }, { timers: { cooldown: 1 } }]) {
      expect(createSnapshot({ ...base, entities: [{ ...e, ...patch }] }).checksum).not.toBe(hash);
    }
  });
});
