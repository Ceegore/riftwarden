/**
 * Stable primitives for the expedition layer (kit-pinned semantics): code-unit
 * comparison for canonical ordering, fnv1a for quick string hashing into the
 * deterministic stream, and the nextU32 xorshift for all map-generation
 * randomness. No Math.random, no wallclock — every value derives from the
 * persisted seed.
 */
export function compareCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function nextU32(x: number): number {
  let v = x >>> 0;
  v ^= v << 13;
  v ^= v >>> 17;
  v ^= v << 5;
  return v >>> 0;
}
