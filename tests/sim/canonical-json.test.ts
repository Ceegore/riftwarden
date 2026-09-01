import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../../src/game/sim/snapshot/canonical-json.js';

describe('kernel canonical JSON', () => {
  it('orders object keys lexically', () => {
    expect(canonicalJson({ z: 1, a: 2, m: 3 })).toBe('{"a":2,"m":3,"z":1}');
  });

  const blocked: [string, unknown][] = [
    ['float', 1.25],
    ['negative zero', -0],
    ['unsafe integer', Number.MAX_SAFE_INTEGER + 1],
    ['date', new Date(0)],
    ['undefined', undefined],
  ];
  for (const [name, value] of blocked) {
    it(`blocks ${name}`, () => {
      expect(() => canonicalJson(value)).toThrow(/P14_SNAPSHOT_INVALID/);
    });
  }

  it('blocks cycles', () => {
    const x: Record<string, unknown> = {};
    x['self'] = x;
    expect(() => canonicalJson(x)).toThrow(/P14_SNAPSHOT_INVALID/);
  });
});
