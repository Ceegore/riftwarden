import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppShellError } from '../../src/game/app-shell/app-shell-error.js';
import type { HqArea } from '../../src/game/app-shell/hq-capabilities.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Reads a Phase 30 contract or fixture file (JSON). */
export function readJson(name: string): unknown {
  return JSON.parse(readFileSync(path.join(here, '..', '..', 'contracts', 'phase30', name), 'utf8'));
}

/** Returns the AppShellError code of a throwing call, or null when it succeeds. */
export function catchShellCode(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof AppShellError ? error.code : null;
  }
}

/** Builds an HqArea with the given id/state and sensible defaults. */
export function hqArea(id: string, state: 'available' | 'locked', overrides: Partial<HqArea> = {}): HqArea {
  return {
    id,
    routeId: `route:${id}`,
    state,
    labelKey: `hq.label.${id}`,
    ...(state === 'locked' ? { reasonKey: 'hq.locked.phase31' } : {}),
    ...overrides,
  };
}
