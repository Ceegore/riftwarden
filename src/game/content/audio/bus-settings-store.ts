/**
 * Phase 39: persistent bus settings store (BUS_SETTINGS_PERSISTENCE).
 *
 * A localStorage-backed store shared by the audio settings screen and the
 * Web Audio playback adapter, so volume/mute changes made in the settings
 * screen are reflected in live playback and survive a reload. Follows the
 * same defensive decode-and-recover pattern as a11y-settings.
 */
import {
  createBusSettings, setBusVolume, toggleBusMute, setMasterMute,
  setPolyphonyProfile, effectiveVolume, busDisplayName,
} from './bus-mixer.js';
import type { BusSettings, PolyphonyProfile } from './bus-mixer.js';
import type { AudioBus } from './audio-manifest-types.js';

const STORE_KEY = 'rw.audio-bus.v1';

export type { BusSettings, PolyphonyProfile, AudioBus };

type Listener = () => void;

const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeBusSettings(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function readRaw(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as unknown;
    return parsed !== null && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function isProfile(value: unknown): value is PolyphonyProfile {
  return value === 'high' || value === 'medium' || value === 'low';
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function loadBusSettings(): BusSettings {
  const defaults = createBusSettings();
  const parsed = readRaw();
  if (parsed === null) return defaults;

  const vol = parsed['volume'] as Record<string, unknown> | undefined;
  const muted = parsed['muted'] as Record<string, unknown> | undefined;
  const volume = {
    master: numberOr(vol?.['master'], defaults.volume.master),
    music: numberOr(vol?.['music'], defaults.volume.music),
    sfx: numberOr(vol?.['sfx'], defaults.volume.sfx),
    voice: numberOr(vol?.['voice'], defaults.volume.voice),
    ui: numberOr(vol?.['ui'], defaults.volume.ui),
    ambient: numberOr(vol?.['ambient'], defaults.volume.ambient),
  };
  const mutedState = {
    master: booleanOr(muted?.['master'], defaults.muted.master),
    music: booleanOr(muted?.['music'], defaults.muted.music),
    sfx: booleanOr(muted?.['sfx'], defaults.muted.sfx),
    voice: booleanOr(muted?.['voice'], defaults.muted.voice),
    ui: booleanOr(muted?.['ui'], defaults.muted.ui),
    ambient: booleanOr(muted?.['ambient'], defaults.muted.ambient),
  };

  return {
    volume,
    muted: mutedState,
    profile: isProfile(parsed['profile']) ? parsed['profile'] : defaults.profile,
    masterMuted: booleanOr(parsed['masterMuted'], defaults.masterMuted),
  };
}

export function saveBusSettings(settings: BusSettings): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(settings));
  } catch {
    // Storage may be unavailable (private mode); playback still works in-memory.
  }
  notify();
}

export {
  createBusSettings, setBusVolume, toggleBusMute, setMasterMute,
  setPolyphonyProfile, effectiveVolume, busDisplayName,
};
