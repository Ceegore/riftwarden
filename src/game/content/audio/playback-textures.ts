/**
 * Phase 39: procedural playback textures (PLAYBACK_TEXTURE_CONTRACT).
 *
 * Real audio assets are BLOCKED by Phase 38/39 (no art or recorded audio
 * yet). Until they land, the playback adapter synthesizes a distinct,
 * deterministic texture per music context so the director's state changes
 * are audible. Every descriptor is pure data — no AudioContext here — so it
 * is fully testable in Node.
 *
 * Boss stem layering (GDD §22.5): bossPhase has 4 stem layers (0–3).
 * Layer 0 is the intro texture, 1–2 are escalation textures, and 3 is the
 * climax. Higher layers push the osc shape toward square, raise the root
 * by an octave, and accelerate the tempo.
 */
import type { MusicContext } from './music-director.js';

export type OscillatorShape = 'sine' | 'triangle' | 'sawtooth' | 'square';

export interface PlaybackTexture {
  readonly rootHz: number;
  readonly shape: OscillatorShape;
  /** Melodic contour as semitone offsets above the root, cycled over time. */
  readonly stepSemitones: readonly number[];
  /** Steps per second. */
  readonly tempoHz: number;
  /** Linear base gain (0..1) before bus mixing. */
  readonly gain: number;
  /** Slight detune (cents) for a second voice when the texture wants width. */
  readonly detuneCents: number;
}

function midiHz(semitone: number): number {
  return 440 * 2 ** ((semitone - 69) / 12);
}

const TEXTURES: Readonly<Record<string, PlaybackTexture>> = Object.freeze({
  title: Object.freeze({
    rootHz: midiHz(57), // A3
    shape: 'triangle',
    stepSemitones: [0, 3, 5, 3, 7, 5, 3, 2],
    tempoHz: 1.5,
    gain: 0.16,
    detuneCents: 6,
  }),
  hq: Object.freeze({
    rootHz: midiHz(52), // E3
    shape: 'sine',
    stepSemitones: [0, 4, 7, 4, 9, 7, 4, 0],
    tempoHz: 1.0,
    gain: 0.14,
    detuneCents: 0,
  }),
  region: Object.freeze({
    rootHz: midiHz(48), // C3
    shape: 'sine',
    stepSemitones: [0, 2, 4, 7, 5, 4, 2, 0],
    tempoHz: 0.8,
    gain: 0.12,
    detuneCents: 0,
  }),
  battle: Object.freeze({
    rootHz: midiHz(45), // A2
    shape: 'sawtooth',
    stepSemitones: [0, 0, 3, 0, 5, 3, 0, -2],
    tempoHz: 3.0,
    gain: 0.11,
    detuneCents: 12,
  }),
  endgame: Object.freeze({
    rootHz: midiHz(60), // C4
    shape: 'triangle',
    stepSemitones: [0, 7, 12, 7, 0, 4, 7, 12],
    tempoHz: 1.8,
    gain: 0.15,
    detuneCents: 0,
  }),
  silence: Object.freeze({
    rootHz: midiHz(57),
    shape: 'sine',
    stepSemitones: [0],
    tempoHz: 0,
    gain: 0,
    detuneCents: 0,
  }),
});

/**
 * Boss stem textures: layer 0 (intro) through 3 (climax).
 * Each layer escalates the aggression.
 */
const BOSS_STEMS: readonly PlaybackTexture[] = Object.freeze([
  // Layer 0 — intro: low square wave, sparse contour.
  Object.freeze({
    rootHz: midiHz(40), // E2
    shape: 'square' as const,
    stepSemitones: [0, 1, 0, -2, 0, 1, 3, 0],
    tempoHz: 2.0,
    gain: 0.12,
    detuneCents: 14,
  }),
  // Layer 1 — escalation: higher root, faster contour.
  Object.freeze({
    rootHz: midiHz(45), // A2
    shape: 'square' as const,
    stepSemitones: [0, 3, 1, -1, 0, 4, 2, 0],
    tempoHz: 2.8,
    gain: 0.14,
    detuneCents: 16,
  }),
  // Layer 2 — peak tension: sawtooth, wider melodic jumps.
  Object.freeze({
    rootHz: midiHz(47), // B2
    shape: 'sawtooth' as const,
    stepSemitones: [0, 5, 2, -2, 0, 7, 4, 0],
    tempoHz: 3.5,
    gain: 0.15,
    detuneCents: 18,
  }),
  // Layer 3 — climax: highest root, fastest contour, strong detune.
  Object.freeze({
    rootHz: midiHz(52), // E3
    shape: 'sawtooth' as const,
    stepSemitones: [0, 7, 3, -4, 0, 12, 5, 0],
    tempoHz: 4.2,
    gain: 0.16,
    detuneCents: 22,
  }),
]);

function contextKey(ctx: MusicContext): string {
  if (typeof ctx === 'string') return ctx;
  if (ctx.kind === 'region') return 'region';
  if (ctx.kind === 'battle') return 'battle';
  return 'bossPhase';
}

export function textureForContext(ctx: MusicContext): PlaybackTexture {
  const key = contextKey(ctx);
  const tex = TEXTURES[key];
  if (tex !== undefined) return tex;
  // All known context keys are in TEXTURES; only dynamic region
  // keys go through 'region'. This fallback is unreachable at
  // type level but satisfies the linter.
  const fallback = TEXTURES['silence'] ?? TEXTURES['title'];
  if (fallback !== undefined) return fallback;
  throw new Error('MUSIC_TEXTURE_MISSING');
}

/**
 * Returns the boss stem texture for the given layer (0–3). Layer out of
 * range is clamped. Non-bossPhase contexts fall through to
 * `textureForContext`.
 */
export function textureForContextWithStem(ctx: MusicContext, stemLayer: number): PlaybackTexture {
  if (typeof ctx === 'object' && ctx.kind === 'bossPhase') {
    const idx = Math.max(0, Math.min(3, stemLayer));
    const tex = BOSS_STEMS[idx];
    if (tex !== undefined) return tex;
  }
  return textureForContext(ctx);
}

export { BOSS_STEMS };
