import type { AppRoute } from '../app/navigation/route-types';

export interface ScreenViewState {
  readonly filter?: string;
  readonly sort?: string;
  readonly scrollAnchor?: string;
  readonly focusAnchor?: string;
  readonly lastSelectedSlot?: string;
}

export interface RestoreStore {
  readonly byProfile: Readonly<Record<string, Readonly<Record<string, ScreenViewState>>>>;
  readonly formationDraft: unknown;
  readonly pendingRunOffers: readonly string[];
}

export interface SaveResumeDescriptor {
  readonly valid: boolean;
  readonly profileExists: boolean;
  readonly runId?: string;
  readonly committedNode?: boolean;
  readonly battleSnapshot?: boolean;
  readonly restoreToken?: string;
}

export function deriveResumeRoute(save: SaveResumeDescriptor): AppRoute {
  if (!save.valid) return { screenKey: 'bootstrapRecovery', params: {} };
  if (save.battleSnapshot) {
    return {
      screenKey: 'battle',
      params: { resume: true, runId: save.runId ?? 'missing' },
      restoreToken: save.restoreToken,
    } as AppRoute;
  }
  if (save.committedNode) {
    return {
      screenKey: 'dungeonMap',
      params: { runId: save.runId ?? 'missing', source: 'resume' },
      restoreToken: save.restoreToken,
    } as AppRoute;
  }
  if (save.profileExists) return { screenKey: 'hqOverview', params: {} };
  return { screenKey: 'title', params: {} };
}
