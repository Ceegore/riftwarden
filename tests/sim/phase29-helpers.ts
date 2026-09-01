import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SliceError } from '../../src/game/slice/slice-error.js';
import type { SliceEntry, SliceKind, SliceManifest } from '../../src/game/slice/types.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Reads a Phase 29 contract or fixture file (JSON). */
export function readJson(name: string): unknown {
  return JSON.parse(readFileSync(path.join(here, '..', '..', 'contracts', 'phase29', name), 'utf8'));
}

/** Returns the SliceError code of a throwing call, or null when it succeeds. */
export function catchSliceCode(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof SliceError ? error.code : null;
  }
}

export function sliceEntry(id: string, kind: SliceKind, overrides: Partial<SliceEntry> = {}): SliceEntry {
  return { id, kind, revision: 'rev-1', assetsReady: true, localesReady: true, testsReady: true, ...overrides };
}

export function validManifest(): SliceManifest {
  const heroes: SliceEntry[] = [];
  for (let i = 1; i <= 4; i += 1) heroes.push(sliceEntry(`hero_${String(i)}`, 'HERO'));
  const troops: SliceEntry[] = [];
  for (let i = 1; i <= 6; i += 1) troops.push(sliceEntry(`troop_${String(i)}`, 'TROOP'));
  return {
    schemaVersion: 1,
    contentRevision: 'act1-ashking-v1',
    heroes,
    troops,
    others: [sliceEntry('boss_ashking', 'BOSS')],
  };
}
