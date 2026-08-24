/**
 * Phase 39: Audio manifest type system (AUDIO_MANIFEST_CONTRACT).
 *
 * Every audio cue gets a stable `audio_*` ID with bus, variants,
 * cooldown, priority, loop markers, subtitle references,
 * and locale parity for voice. Unknown licenses block the build.
 */

export type AudioBus = 'master' | 'music' | 'sfx' | 'voice' | 'ui' | 'ambient';

export type AudioLocale = 'de' | 'en';

export interface AudioCue {
  readonly cueId: string;
  readonly bus: AudioBus;
  readonly label: string;
  readonly variants: readonly AudioCueVariant[];
  readonly cooldownMs: number;
  readonly priority: number;
  readonly loop: boolean;
  readonly loopStartMs?: number;
  readonly loopEndMs?: number;
  readonly subtitleKey?: string;
  readonly voiceLocale?: AudioLocale;
  readonly licenseId: string;
}

export interface AudioCueVariant {
  readonly variantId: string;
  readonly bytes: number;
  readonly durationMs: number;
  readonly sha256: string;
}

export interface AudioManifest {
  readonly manifestId: string;
  readonly cues: readonly AudioCue[];
  readonly sha256: string;
}

export const BUS_DEFAULTS: Readonly<Record<AudioBus, number>> = Object.freeze({
  master: 80,
  music: 65,
  sfx: 80,
  voice: 80,
  ui: 70,
  ambient: 55,
});

export const BUS_LABELS: Readonly<Record<AudioBus, string>> = Object.freeze({
  master: 'Master',
  music: 'Music',
  sfx: 'Sfx',
  voice: 'Voice',
  ui: 'Ui',
  ambient: 'Ambient',
});

export function isAudioBus(value: string): value is AudioBus {
  return value === 'master' || value === 'music' || value === 'sfx' || value === 'voice' || value === 'ui' || value === 'ambient';
}