/**
 * Phase 39: Bus mixer (BUS_MIXER_CONTRACT).
 *
 * Six buses with persistent volume 0–100, mute flags,
 * and polyphony profiles (High 24, Medium 16, Low 10).
 * Voice stealing is deterministic by priority, start sequence,
 * and cue ID. Audio never holds gameplay authority.
 */

import { BUS_DEFAULTS, BUS_LABELS, type AudioBus } from './audio-manifest-types.js';

export type PolyphonyProfile = 'high' | 'medium' | 'low';

export const POLYPHONY_LIMITS: Readonly<Record<PolyphonyProfile, number>> = Object.freeze({
  high: 24,
  medium: 16,
  low: 10,
});

export interface BusSettings {
  readonly volume: Readonly<Record<AudioBus, number>>;
  readonly muted: Readonly<Record<AudioBus, boolean>>;
  readonly profile: PolyphonyProfile;
  readonly masterMuted: boolean;
}

export function createBusSettings(profile: PolyphonyProfile = 'high'): BusSettings {
  return {
    volume: BUS_DEFAULTS,
    muted: Object.freeze({ master: false, music: false, sfx: false, voice: false, ui: false, ambient: false }),
    profile,
    masterMuted: false,
  };
}

export function setBusVolume(state: BusSettings, bus: AudioBus, value: number): BusSettings {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return {
    ...state,
    volume: { ...state.volume, [bus]: clamped },
  };
}

export function toggleBusMute(state: BusSettings, bus: AudioBus): BusSettings {
  return {
    ...state,
    muted: { ...state.muted, [bus]: !state.muted[bus] },
  };
}

export function setMasterMute(state: BusSettings, muted: boolean): BusSettings {
  return { ...state, masterMuted: muted };
}

export function setPolyphonyProfile(state: BusSettings, profile: PolyphonyProfile): BusSettings {
  return { ...state, profile };
}

export function effectiveVolume(state: BusSettings, bus: AudioBus): number {
  if (state.masterMuted || state.muted[bus]) return 0;
  return state.volume[bus];
}

export function busDisplayName(bus: AudioBus): string {
  return BUS_LABELS[bus];
}