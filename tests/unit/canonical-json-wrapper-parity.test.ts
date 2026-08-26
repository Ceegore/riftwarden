import { describe, expect, it } from 'vitest';
import { canonicalJson as saveJson, canonicalUtf8 as saveUtf8 } from '../../src/game/save/canonical-json.js';
import { canonicalJson as replayJson, canonicalUtf8 as replayUtf8 } from '../../src/game/replay/canonical-json.js';
import { canonicalJson as snapshotJson, canonicalUtf8 as snapshotUtf8 } from '../../src/game/sim/snapshot/canonical-json.js';

/**
 * Cross-policy parity: all three canonical-JSON wrappers (save, snapshot,
 * replay) delegate to the single shared encoder. For any value valid under the
 * strict integer policy the three outputs must be byte-identical; the save
 * wrapper's `finite-allowed` policy must accept finite floats the strict
 * wrappers reject; every wrapper's UTF-8 form must equal the UTF-8 of its
 * string form. This pins the parity contract so a future wrapper that drifts
 * (different key order, different number policy, separate encoder) fails here.
 */
describe('canonical-JSON wrapper parity (save / snapshot / replay)', () => {
  const strictValues: unknown[] = [
    null,
    true,
    false,
    'string',
    '',
    'ünicode 🔥',
    0,
    1,
    -1,
    Number.MAX_SAFE_INTEGER,
    Number.MIN_SAFE_INTEGER,
    [1, 'two', null, [3, 4], { a: 1 }],
    { z: 1, a: { y: 2, x: 3 }, m: [4, 5] },
    { b: [true, false, null], a: 'sorted', c: { n: Number.MAX_SAFE_INTEGER } },
  ];

  it('produces byte-identical output across all three wrappers for strict-valid values', () => {
    for (const value of strictValues) {
      const snapshot = snapshotJson(value);
      const replay = replayJson(value as never);
      const save = saveJson(value);
      expect(snapshot).toBe(replay);
      expect(snapshot).toBe(save);
    }
  });

  it('produces canonical (sorted-key) output for nested structures', () => {
    expect(snapshotJson({ z: 1, a: { y: 2, x: 3 } })).toBe('{"a":{"x":3,"y":2},"z":1}');
  });

  it('UTF-8 forms equal the encoded string bytes for every wrapper', () => {
    for (const value of strictValues) {
      const expected = new TextEncoder().encode(snapshotJson(value));
      expect(saveUtf8(value), 'save').toEqual(expected);
      expect(replayUtf8(value as never), 'replay').toEqual(expected);
      expect(snapshotUtf8(value), 'snapshot').toEqual(expected);
    }
  });

  it('save accepts finite floats; strict wrappers reject them', () => {
    const floaty = { ratio: 1.5, negative: -0.25, tiny: 1e-7 };
    // Save accepts any finite number, but the output is still canonical:
    // sorted keys and JSON.stringify number formatting.
    expect(saveJson(floaty)).toBe('{"negative":-0.25,"ratio":1.5,"tiny":1e-7}');
    expect(() => snapshotJson(floaty)).toThrow(/P14_SNAPSHOT_INVALID/);
    expect(() => replayJson(floaty as never)).toThrow(/P13_CANONICAL_JSON/);
  });

  it('all wrappers reject -0, NaN and Infinity; save accepts any finite number (incl. unsafe ints)', () => {
    for (const bad of [-0, NaN, Infinity, -Infinity]) {
      expect(() => snapshotJson(bad), `snapshot ${String(bad)}`).toThrow(/P14_SNAPSHOT_INVALID/);
      expect(() => replayJson(bad as never), `replay ${String(bad)}`).toThrow(/P13_CANONICAL_JSON/);
      expect(() => saveJson(bad), `save ${String(bad)}`).toThrow(/P_CANONICAL_JSON_NUMBER/);
    }
    // finite-allowed: an unsafe-but-finite integer is accepted by save,
    // whereas the strict wrappers reject it.
    expect(saveJson(2 ** 53)).toBe(String(2 ** 53));
    expect(() => snapshotJson(2 ** 53)).toThrow(/P14_SNAPSHOT_INVALID/);
    expect(() => replayJson(2 ** 53 as never)).toThrow(/P13_CANONICAL_JSON/);
  });

  it('all wrappers reject cycles, prototypes and non-JSON types', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;
    expect(() => snapshotJson(cyclic)).toThrow(/P14_SNAPSHOT_INVALID/);
    expect(() => replayJson(cyclic as never)).toThrow(/P13_CANONICAL_JSON/);
    expect(() => saveJson(cyclic)).toThrow(/P_CANONICAL_JSON_CYCLE/);

    const boxed = Object.create({ marker: 1 }) as object; // non-plain prototype
    expect(() => snapshotJson(boxed)).toThrow(/P14_SNAPSHOT_INVALID/);
    expect(() => replayJson(boxed as never)).toThrow(/P13_CANONICAL_JSON/);
    expect(() => saveJson(boxed)).toThrow(/P_CANONICAL_JSON_PROTOTYPE/);

    expect(() => snapshotJson(undefined)).toThrow(/P14_SNAPSHOT_INVALID/);
    expect(() => replayJson(undefined as never)).toThrow(/P13_CANONICAL_JSON/);
    expect(() => saveJson(undefined)).toThrow(/P_CANONICAL_JSON_TYPE/);
  });

  it('reproduces exact canonical bytes for a realistic save envelope', () => {
    const envelope = {
      schemaVersion: 1,
      family: 'expedition',
      slot: 'slot_a',
      payload: { gold: 42, flags: ['a', 'b'], nested: { deep: true, values: [1, 2, 3] } },
    };
    const canonical = snapshotJson(envelope);
    // Canonical form: sorted keys, no whitespace, integers as String().
    expect(canonical).toBe('{"family":"expedition","payload":{"flags":["a","b"],"gold":42,"nested":{"deep":true,"values":[1,2,3]}},"schemaVersion":1,"slot":"slot_a"}');
    // All wrappers agree.
    expect(replayJson(envelope as never)).toBe(canonical);
    expect(saveJson(envelope)).toBe(canonical);
  });
});
