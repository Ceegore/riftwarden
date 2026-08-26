/**
 * Display-layer rounding helpers (P12 callsite audit).
 *
 * The P12 audit requires `Math.round` to live in a sanctioned module:
 * authoritative rule math rounds in `game/sim/math/rounding.ts`. Presentation
 * code (HUD tenths, percent displays, audio interval timing) rounds here so
 * the audit stays green while the display layer keeps its own helper.
 * These helpers are pure and deterministic; they never feed back into the
 * authoritative simulation state.
 */
export function roundToNearest(value: number): number {
  return Math.round(value);
}

/** Round a 0..1 ratio to a whole percent (0..100). */
export function roundPercent(ratio: number): number {
  return Math.round(ratio * 100);
}

/** Round a number to tenths for display. */
export function roundToTenths(value: number): number {
  return Math.round(value * 10) / 10;
}
