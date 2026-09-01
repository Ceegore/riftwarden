import type { JsonValue } from './canonical-json.js';
import { SaveError } from './save-error.js';

export interface BattleSnapshot {
  readonly tick: number;
  readonly phase: string;
  readonly sequence: number;
  readonly rngStates: readonly string[];
  readonly scheduler: readonly JsonValue[];
  readonly entities: readonly { readonly id: string }[];
  readonly expectedPreResumeHash: string;
}

export const SNAPSHOT_INTERVAL_TICKS = 150;

/**
 * Validates an authoritative battle snapshot: safe non-negative tick and
 * sequence, at least one RNG stream, unique entity ids and a present
 * pre-resume hash. Renderer/audio/DOM/wallclock state is excluded by
 * construction (the snapshot carries only authoritative simulation state).
 */
export function validateSnapshot(snapshot: BattleSnapshot): void {
  if (!Number.isSafeInteger(snapshot.tick) || snapshot.tick < 0) throw new SaveError('INVALID_SNAPSHOT', { field: 'tick' });
  if (!Number.isSafeInteger(snapshot.sequence) || snapshot.sequence < 0) {
    throw new SaveError('INVALID_SNAPSHOT', { field: 'sequence' });
  }
  if (typeof snapshot.phase !== 'string' || snapshot.phase.length === 0) {
    throw new SaveError('INVALID_SNAPSHOT', { field: 'phase' });
  }
  if (snapshot.rngStates.length === 0) throw new SaveError('INVALID_SNAPSHOT', { field: 'rngStates' });
  if (snapshot.expectedPreResumeHash.length !== 64) throw new SaveError('INVALID_SNAPSHOT', { field: 'expectedPreResumeHash' });
  const ids = snapshot.entities.map((entity) => entity.id);
  if (new Set(ids).size !== ids.length) throw new SaveError('INVALID_SNAPSHOT', { field: 'entities', reason: 'duplicate-id' });
  for (const id of ids) {
    if (typeof id !== 'string' || id.length === 0) throw new SaveError('INVALID_SNAPSHOT', { field: 'entities' });
  }
}

/**
 * Resume always starts paused. Order: validate -> rebuild simulation ->
 * verify hash before start -> build renderer/view models -> audio/input
 * ready -> explicit user continue. Auto-resume is forbidden.
 */
export function createResumePlan(snapshot: BattleSnapshot): Readonly<{
  paused: true;
  allowAutoResume: false;
  steps: readonly ('rebuild_sim' | 'verify_hash' | 'build_views' | 'ready_audio_input' | 'await_user_continue')[];
  tick: number;
}> {
  validateSnapshot(snapshot);
  return {
    paused: true,
    allowAutoResume: false,
    steps: ['rebuild_sim', 'verify_hash', 'build_views', 'ready_audio_input', 'await_user_continue'],
    tick: snapshot.tick,
  };
}

/**
 * Golden resume contract: a resumed golden save must produce the same end
 * hash as the uninterrupted run. This helper asserts the pre-resume hash was
 * produced by the same canonical snapshot bytes used to resume.
 */
export function assertGoldenHash(interrupted: string, uninterrupted: string): void {
  if (interrupted !== uninterrupted) throw new SaveError('GOLDEN_HASH_MISMATCH', { interrupted, uninterrupted });
}
