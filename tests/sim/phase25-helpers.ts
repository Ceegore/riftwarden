import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BattlePresentationFrame, EntityFrame } from '../../src/game/render/types.js';
import { RenderError } from '../../src/game/render/render-error.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Reads a Phase 25 contract or fixture file (JSON). */
export function readJson(name: string): unknown {
  return JSON.parse(readFileSync(path.join(here, '..', '..', 'contracts', 'phase25', name), 'utf8'));
}

/** Deterministic 64-hex gameplay hash for test frames. */
export function hexHash(n: number): string {
  return String(n).padStart(64, '0');
}

export function entity(id: string, overrides: Partial<EntityFrame> = {}): EntityFrame {
  return Object.freeze({
    id,
    lane: 0,
    logicalX100: 100,
    visualState: 'idle',
    clipProgress1000: 0,
    ...overrides,
  });
}

export function frame(tick: number, entities: readonly EntityFrame[], hash?: string): BattlePresentationFrame {
  return Object.freeze({ tick, entities: Object.freeze([...entities]), gameplayHash: hash ?? hexHash(tick) });
}

/** Wraps untrusted/malformed data as a frame for negative-path tests. */
export function rawFrame(partial: Record<string, unknown>): BattlePresentationFrame {
  return partial as unknown as BattlePresentationFrame;
}

/** Returns the RenderError code of a throwing call, or null when it succeeds. */
export function catchRenderCode(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof RenderError ? error.code : null;
  }
}
