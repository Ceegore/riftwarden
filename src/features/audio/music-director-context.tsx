/**
 * Phase 39: Music Director React provider.
 *
 * Wraps the pure DirectorState machine in a context provider. There is
 * no audio playback yet — this is the semantic layer that later audio
 * adapters subscribe to. Screen code requests a semantic MusicContext;
 * the director resolves transitions idempotently.
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  createDirector, requestMusic, pauseDirector, resumeDirector, applyTransition,
  setBossStem,
  type DirectorState, type MusicContext,
} from '../../game/content/audio/music-director.js';
import { MusicDirectorContext, type MusicDirectorApi } from './music-director-hooks.js';

export function MusicDirectorProvider({ children }: { readonly children: ReactNode }) {
  const [state, setState] = useState<DirectorState>(() => createDirector());

  const request = useCallback((context: MusicContext) => {
    setState((prev) => applyTransition(requestMusic(prev, context)));
  }, []);

  const pause = useCallback(() => { setState((prev) => pauseDirector(prev)); }, []);
  const resume = useCallback(() => { setState((prev) => resumeDirector(prev)); }, []);
  const setStem = useCallback((layer: number) => { setState((prev) => setBossStem(prev, layer)); }, []);

  const api = useMemo<MusicDirectorApi>(
    () => ({ state, request, pause, resume, setStem }),
    [state, request, pause, resume, setStem],
  );

  return (
    <MusicDirectorContext.Provider value={api}>
      {children}
    </MusicDirectorContext.Provider>
  );
}
