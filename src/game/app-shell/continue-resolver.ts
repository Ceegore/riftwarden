/**
 * Phase 30 continue resolver (CONTINUE_RECOVERY_CONTRACT): continue decides
 * exclusively from validated save/recovery state. Priority: valid battle
 * snapshot > valid run > valid profile/HQ > recovery > no save. The resolver is
 * pure — it never inspects a store, it consumes presence flags produced by
 * validated decoders, so a corrupt payload can only surface as the recovery
 * class. Primary labels are the pinned continue-save-matrix values.
 */
import { AppShellError } from './app-shell-error.js';

export type SaveClass = 'none' | 'profile' | 'run' | 'battle' | 'corrupt';

export type ContinuePrimary = 'new-game' | 'continue-hq' | 'continue-run' | 'resume-battle' | 'recovery';

export interface SavePresence {
  readonly battleSnapshot: boolean;
  readonly run: boolean;
  readonly profile: boolean;
  readonly corrupt: boolean;
}

export interface ContinueDecision {
  readonly primary: ContinuePrimary;
  readonly class: SaveClass;
}

/** Maps a validated save class to its pinned primary action. */
export function primaryForClass(saveClass: SaveClass): ContinuePrimary {
  switch (saveClass) {
    case 'none':
      return 'new-game';
    case 'profile':
      return 'continue-hq';
    case 'run':
      return 'continue-run';
    case 'battle':
      return 'resume-battle';
    case 'corrupt':
      return 'recovery';
  }
}

/** Priority-ordered decision from presence flags (battle > run > profile > recovery > none). */
export function resolveContinue(presence: SavePresence): ContinueDecision {
  if (presence.corrupt) return { primary: 'recovery', class: 'corrupt' };
  if (presence.battleSnapshot) return { primary: 'resume-battle', class: 'battle' };
  if (presence.run) return { primary: 'continue-run', class: 'run' };
  if (presence.profile) return { primary: 'continue-hq', class: 'profile' };
  return { primary: 'new-game', class: 'none' };
}

/** Parses a SaveClass label from the pinned continue-save matrix. */
export function saveClassOf(matrixId: string): SaveClass {
  if (matrixId === 'none') return 'none';
  if (matrixId === 'profile') return 'profile';
  if (matrixId === 'run') return 'run';
  if (matrixId === 'battle') return 'battle';
  if (matrixId === 'corrupt') return 'corrupt';
  throw new AppShellError('CONTINUE_UNKNOWN_SAVE_CLASS', { id: matrixId });
}
