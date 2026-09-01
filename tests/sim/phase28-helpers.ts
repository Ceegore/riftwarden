import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ExpeditionError } from '../../src/game/expedition/expedition-error.js';
import { generateMap } from '../../src/game/expedition/map-generator.js';
import { createRunState } from '../../src/game/expedition/run-state.js';
import type { ExpeditionMap, MapProfile, RunState } from '../../src/game/expedition/types.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Reads a Phase 28 contract or fixture file (JSON). */
export function readJson(name: string): unknown {
  return JSON.parse(readFileSync(path.join(here, '..', '..', 'contracts', 'phase28', name), 'utf8'));
}

/** Returns the ExpeditionError code of a throwing call, or null when it succeeds. */
export function catchExpeditionCode(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof ExpeditionError ? error.code : null;
  }
}

/** The pinned map profile from the kit fixture. */
export function standardProfile(): MapProfile {
  const fixture = readJson('fixtures/map-profiles.json') as {
    readonly profiles: readonly {
      readonly id: string;
      readonly logicalLevels: number;
      readonly targetVisited: readonly [number, number];
      readonly mandatoryRoles: readonly string[];
      readonly attemptCap: number;
      readonly fallbackTemplateId: string;
    }[];
  };
  const profile = fixture.profiles[0];
  if (profile === undefined) throw new Error('profile fixture empty');
  return {
    id: profile.id,
    logicalLevels: profile.logicalLevels,
    targetVisited: profile.targetVisited,
    mandatoryRoles: [...profile.mandatoryRoles] as MapProfile['mandatoryRoles'],
    attemptCap: profile.attemptCap,
    fallbackTemplateId: profile.fallbackTemplateId,
  };
}

export function mapFor(seed: number, contentRevision = 'test-revision'): ExpeditionMap {
  return generateMap({ seed, profileId: 'slice.act1.standard', contentRevision }, standardProfile());
}

export function runFor(seed: number, overrides: Partial<RunState> = {}): RunState {
  const map = mapFor(seed);
  const base = createRunState({
    runId: `run-${String(seed)}`,
    modeId: 'mode.expedition',
    missionId: 'mission.act1',
    map,
    startResources: { gold: 10 },
  });
  return { ...base, ...overrides };
}
