/**
 * Phase 39: Voice runtime model (VOICE_RUNTIME_CONTRACT).
 *
 * Defines the mandatory voice cue inventory. Every required cue
 * must have DE+EN files and matching subtitle keys. The repetition
 * cooldown prevents the same cue from playing within 20 seconds.
 */

export interface VoiceClip {
  readonly clipId: string;
  readonly locale: 'de' | 'en';
  readonly subtitleKey: string;
  readonly durationMs: number;
  readonly variants: readonly string[];
}

export interface VoiceState {
  readonly lastPlayed: Readonly<Record<string, number>>;
  readonly locale: 'de' | 'en';
}

const REPETITION_COOLDOWN_MS = 20_000;

export function createVoiceState(locale: 'de' | 'en'): VoiceState {
  return { lastPlayed: Object.freeze({}), locale };
}

export function canPlayCue(state: VoiceState, cueId: string, nowMs: number): boolean {
  const last = state.lastPlayed[cueId];
  return last === undefined || (nowMs - last) >= REPETITION_COOLDOWN_MS;
}

export function recordCuePlay(state: VoiceState, cueId: string, nowMs: number): VoiceState {
  return {
    ...state,
    lastPlayed: { ...state.lastPlayed, [cueId]: nowMs },
  };
}

export const VOICE_INVENTORY: readonly VoiceClip[] = [
  // Tutorial
  { clipId: 'voice.tutorial.welcome',        locale: 'en', subtitleKey: 'tutorial.welcome',        durationMs: 3000, variants: ['v1', 'v2'] },
  { clipId: 'voice.tutorial.welcome',        locale: 'de', subtitleKey: 'tutorial.welcome',        durationMs: 3200, variants: ['v1', 'v2'] },
  // Hero entry
  { clipId: 'voice.hero.aurel.entry',        locale: 'en', subtitleKey: 'hero.aurel.entry',       durationMs: 2500, variants: ['v1', 'v2'] },
  { clipId: 'voice.hero.aurel.entry',        locale: 'de', subtitleKey: 'hero.aurel.entry',       durationMs: 2700, variants: ['v1', 'v2'] },
  // Hero signature
  { clipId: 'voice.hero.aurel.signature',    locale: 'en', subtitleKey: 'hero.aurel.signature',   durationMs: 2000, variants: ['v1', 'v2'] },
  { clipId: 'voice.hero.aurel.signature',    locale: 'de', subtitleKey: 'hero.aurel.signature',   durationMs: 2100, variants: ['v1', 'v2'] },
  // Hero level 3
  { clipId: 'voice.hero.aurel.level3',        locale: 'en', subtitleKey: 'hero.aurel.level3',     durationMs: 3000, variants: ['v1', 'v2'] },
  { clipId: 'voice.hero.aurel.level3',        locale: 'de', subtitleKey: 'hero.aurel.level3',     durationMs: 3200, variants: ['v1', 'v2'] },
  // Hero low HP
  { clipId: 'voice.hero.aurel.lowHP',         locale: 'en', subtitleKey: 'hero.aurel.lowHP',      durationMs: 1500, variants: ['v1', 'v2'] },
  { clipId: 'voice.hero.aurel.lowHP',         locale: 'de', subtitleKey: 'hero.aurel.lowHP',      durationMs: 1600, variants: ['v1', 'v2'] },
  // Hero victory
  { clipId: 'voice.hero.aurel.victory',       locale: 'en', subtitleKey: 'hero.aurel.victory',    durationMs: 2500, variants: ['v1', 'v2'] },
  { clipId: 'voice.hero.aurel.victory',       locale: 'de', subtitleKey: 'hero.aurel.victory',    durationMs: 2700, variants: ['v1', 'v2'] },
  // Boss intro
  { clipId: 'voice.boss.ashKing.intro',       locale: 'en', subtitleKey: 'boss.ashKing.intro',    durationMs: 3500, variants: ['v1'] },
  { clipId: 'voice.boss.ashKing.intro',       locale: 'de', subtitleKey: 'boss.ashKing.intro',    durationMs: 3700, variants: ['v1'] },
  // Boss phase transition
  { clipId: 'voice.boss.ashKing.phase',       locale: 'en', subtitleKey: 'boss.ashKing.phase',    durationMs: 2000, variants: ['v1'] },
  { clipId: 'voice.boss.ashKing.phase',       locale: 'de', subtitleKey: 'boss.ashKing.phase',    durationMs: 2200, variants: ['v1'] },
  // Boss defeat
  { clipId: 'voice.boss.ashKing.defeat',      locale: 'en', subtitleKey: 'boss.ashKing.defeat',   durationMs: 3000, variants: ['v1'] },
  { clipId: 'voice.boss.ashKing.defeat',      locale: 'de', subtitleKey: 'boss.ashKing.defeat',   durationMs: 3200, variants: ['v1'] },
];

export function validateVoiceParity(inventory: readonly VoiceClip[]): string[] {
  const errors: string[] = [];
  const byClip = new Map<string, Set<string>>();
  for (const clip of inventory) {
    const locales = byClip.get(clip.clipId) ?? new Set();
    locales.add(clip.locale);
    byClip.set(clip.clipId, locales);
  }
  for (const [clipId, locales] of byClip) {
    if (!locales.has('de')) errors.push(`VOICE: ${clipId} missing DE`);
    if (!locales.has('en')) errors.push(`VOICE: ${clipId} missing EN`);
    if (clipId.includes('voice.hero.') && !clipId.includes('entry') && !clipId.includes('signature') && !clipId.includes('level3') && !clipId.includes('lowHP') && !clipId.includes('victory')) {
      errors.push(`VOICE: ${clipId} unrecognized hero cue pattern`);
    }
  }
  return errors;
}
