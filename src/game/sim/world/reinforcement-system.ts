import { KernelInvariantError } from '../core/invariant-error.js';
import { asciiCompare } from '../core/primitives.js';

/**
 * Phase 21 §8 reinforcement waves (T05). Each wave has a stable wave id, a
 * scheduled tick, a fixed spawn order, a side, a spawn profile and a
 * cap/failure policy. Invalid waves are content errors that block content —
 * the runtime never improvises a replacement wave (§8).
 */

export const WAVE_CAP_POLICIES = ['BLOCK', 'FAIL'] as const;
export type WaveCapPolicy = (typeof WAVE_CAP_POLICIES)[number];

export interface Wave {
  readonly id: string;
  readonly scheduledTick: number;
  readonly side: 'player' | 'enemy';
  /** Fixed spawn order: entity ids are committed in this exact order (§8). */
  readonly entityIds: readonly string[];
  /** Content spawn-profile id (stats/placement are a content port, not invented here). */
  readonly spawnProfile: string;
  /** BLOCK = skip/spill the overflow deterministically; FAIL = content error. */
  readonly capPolicy: WaveCapPolicy;
}

const ID = /^[a-z][a-z0-9_]*$/;

function assertId(value: string, field: string): void {
  if (!ID.test(value)) throw new KernelInvariantError('P21_WAVE_INVALID', { field, value });
}

function assertInt(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new KernelInvariantError('P21_WAVE_INVALID', { field, value });
  }
}

/** Validates a reinforcement wave (§8). Invalid waves block content. */
export function validateWave(wave: Wave): void {
  assertId(wave.id, 'id');
  assertInt(wave.scheduledTick, 'scheduledTick');
  if (!(['player', 'enemy'] as readonly string[]).includes(wave.side)) throw new KernelInvariantError('P21_WAVE_INVALID', { field: 'side', value: wave.side });
  if (wave.entityIds.length === 0) throw new KernelInvariantError('P21_WAVE_INVALID', { reason: 'empty-spawn-order', id: wave.id });
  for (const entityId of wave.entityIds) assertId(entityId, 'entityIds');
  if (new Set(wave.entityIds).size !== wave.entityIds.length) throw new KernelInvariantError('P21_WAVE_INVALID', { reason: 'duplicate-spawn-order', id: wave.id });
  assertId(wave.spawnProfile, 'spawnProfile');
  if (!(WAVE_CAP_POLICIES as readonly string[]).includes(wave.capPolicy)) throw new KernelInvariantError('P21_WAVE_INVALID', { field: 'capPolicy', value: wave.capPolicy });
}

/**
 * §8 due waves: scheduled, not yet spawned, ordered by (scheduledTick, id).
 * `spawned` holds the set of wave ids already committed this battle.
 */
export function dueWaves(waves: readonly Wave[], tick: number, spawned: ReadonlySet<string>): readonly Wave[] {
  return Object.freeze(
    waves
      .filter((w) => w.scheduledTick <= tick && !spawned.has(w.id))
      .sort((a, b) => a.scheduledTick - b.scheduledTick || asciiCompare(a.id, b.id)),
  );
}

/** Canonical wave ordering helper (scheduledTick, id), exported for reuse. */
export function compareWaves(a: Wave, b: Wave): number {
  return a.scheduledTick - b.scheduledTick || asciiCompare(a.id, b.id);
}
