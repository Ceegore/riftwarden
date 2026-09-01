/**
 * Phase 39: voice-cue-id validator (VOICE_CUE_VALIDATOR).
 * Cross-references every voice cue against the hero/content registries
 * to catch dangling references before they ship. Part of the audio
 * pipeline code that CAN ship without production recordings.
 */
import type { VoiceClip } from './voice-runtime.js';

export interface VoiceValidationError {
  readonly clipId: string;
  readonly message: string;
}

/** Known hero IDs that voice cues may reference. */
const KNOWN_HERO_PREFIXES = new Set([
  'hero.aurel', 'hero.mira', 'hero.kade', 'hero.vesper',
  'hero.lyra', 'hero.thanos', 'hero.selene', 'hero.ryker',
  'hero.eira', 'hero.orion',
]);

/** Known boss IDs that voice cues may reference. */
const KNOWN_BOSS_PREFIXES = new Set([
  'boss.ashKing', 'boss.riftShade', 'boss.voidSerpent',
  'boss.ironSovereign', 'boss.spectralArchon', 'boss.ancientWarden',
]);

/** Known content prefixes for voice clips. */
const KNOWN_PREFIXES: readonly string[] = [
  'voice.system.',
  'voice.hero.',
  'voice.boss.',
  'voice.enemy.',
  'voice.event.',
  'voice.announcer.',
];

export function validateVoiceCueReferences(clips: readonly VoiceClip[]): readonly VoiceValidationError[] {
  const errors: VoiceValidationError[] = [];
  for (const clip of clips) {
    // Must match at least one known prefix.
    const matchesPrefix = KNOWN_PREFIXES.some((prefix) => clip.clipId.startsWith(prefix));
    if (!matchesPrefix) {
      errors.push({ clipId: clip.clipId, message: `voice cue prefix is not in the known registry: ${clip.clipId}` });
    }

    // Hero references must name a known hero.
    if (clip.clipId.startsWith('voice.hero.')) {
      const heroPart = clip.clipId.split('.').slice(0, 2).join('.');
      if (!KNOWN_HERO_PREFIXES.has(heroPart)) {
        errors.push({ clipId: clip.clipId, message: `hero voice cue references unknown hero ${heroPart}` });
      }
    }

    // Boss references must name a known boss.
    if (clip.clipId.startsWith('voice.boss.')) {
      const bossPart = clip.clipId.split('.').slice(0, 2).join('.');
      if (!KNOWN_BOSS_PREFIXES.has(bossPart)) {
        errors.push({ clipId: clip.clipId, message: `boss voice cue references unknown boss ${bossPart}` });
      }
    }

    // Locale parity is checked by the existing validateVoiceParity.
  }
  return errors;
}
