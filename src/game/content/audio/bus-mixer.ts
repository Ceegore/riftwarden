/**
 * Phase 39: Bus mixer (BUS_MIXER_CONTRACT).
 *
 * Six buses with persistent volume 0–100, mute flags,
 * and polyphony profiles (High 24, Medium 16, Low 10).
 * Voice stealing is deterministic by priority, start sequence,
 * and cue ID. Audio never holds gameplay authority.
 */

import { BUS_DEFAULTS, BUS_LABELS } from './audio-manifest-types.js';
import type { AudioBus } from './audio-manifest-types.js';
export type { AudioBus } from './audio-manifest-types.js';

export type PolyphonyProfile = 'high' | 'medium' | 'low';

export const POLYPHONY_LIMITS: Readonly<Record<PolyphonyProfile, number>> = Object.freeze({
  high: 24,
  medium: 16,
  low: 10,
});

export interface BusVolume {
  readonly master: number;
  readonly music: number;
  readonly sfx: number;
  readonly voice: number;
  readonly ui: number;
  readonly ambient: number;
}

export interface BusMute {
  readonly master: boolean;
  readonly music: boolean;
  readonly sfx: boolean;
  readonly voice: boolean;
  readonly ui: boolean;
  readonly ambient: boolean;
}

export interface BusSettings {
  readonly volume: BusVolume;
  readonly muted: BusMute;
  readonly profile: PolyphonyProfile;
  readonly masterMuted: boolean;
}

const DEFAULT_MUTES: BusMute = Object.freeze({ master: false, music: false, sfx: false, voice: false, ui: false, ambient: false });

export function createBusSettings(profile: PolyphonyProfile = 'high'): BusSettings {
  return {
    volume: { master: BUS_DEFAULTS.master, music: BUS_DEFAULTS.music, sfx: BUS_DEFAULTS.sfx, voice: BUS_DEFAULTS.voice, ui: BUS_DEFAULTS.ui, ambient: BUS_DEFAULTS.ambient },
    muted: DEFAULT_MUTES,
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
  const current = state.muted[bus];
  return {
    ...state,
    muted: { ...state.muted, [bus]: !current },
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