/**
 * Phase 39: MusicPlayback — bridges the MusicDirector state and the
 * persistent bus settings into the Web Audio adapter. Renders nothing;
 * it exists to keep audio wiring out of screen components.
 */
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useMusicDirector } from './music-director-hooks.js';
import { MusicPlaybackAdapter } from './MusicPlaybackAdapter.js';
import { loadBusSettings, subscribeBusSettings, type BusSettings } from '../../game/content/audio/bus-settings-store.js';

export function MusicPlayback(): JSX.Element {
  const { state } = useMusicDirector();
  const adapterRef = useRef<MusicPlaybackAdapter | null>(null);
  const [busSettings, setBusSettings] = useState<BusSettings>(() => loadBusSettings());

  useEffect(() => {
    adapterRef.current = new MusicPlaybackAdapter();
    return () => {
      adapterRef.current?.dispose();
      adapterRef.current = null;
    };
  }, []);

  useEffect(() => subscribeBusSettings(() => { setBusSettings(loadBusSettings()); }), []);

  useEffect(() => { adapterRef.current?.setBusSettings(busSettings); }, [busSettings]);

  useEffect(() => {
    const crossfadeMs = state.currentContext === 'silence' ? 0 : (state.crossfadeMs > 0 ? state.crossfadeMs : 600);
    adapterRef.current?.applyContext(state.currentContext, crossfadeMs);
  }, [state.currentContext, state.crossfadeMs]);

  useEffect(() => {
    if (state.paused) adapterRef.current?.pause(); else adapterRef.current?.resume();
  }, [state.paused]);

  // Autoplay policies require a user gesture before audio can start.
  useEffect(() => {
    const unlock = (): void => { adapterRef.current?.resume(); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  return <></>;
}
