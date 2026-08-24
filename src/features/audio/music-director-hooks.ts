/**
 * Phase 39: Music Director context + hook (separate from the provider
 * component so react-refresh stays happy).
 */
import { createContext, useContext } from 'react';
import type { DirectorState, MusicContext } from '../../game/content/audio/music-director.js';

export interface MusicDirectorApi {
  readonly state: DirectorState;
  readonly request: (context: MusicContext) => void;
  readonly pause: () => void;
  readonly resume: () => void;
  /** Advance the boss stem layer (0–3). Idempotent at boundaries. */
  readonly setStem: (layer: number) => void;
}

export const MusicDirectorContext = createContext<MusicDirectorApi | null>(null);

export function useMusicDirector(): MusicDirectorApi {
  const api = useContext(MusicDirectorContext);
  if (api === null) {
    throw new Error('MUSIC_DIRECTOR_PROVIDER_MISSING');
  }
  return api;
}