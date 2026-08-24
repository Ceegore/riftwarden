/**
 * Phase 39 audio domain tests: music director, voice runtime, bus mixer.
 */
import { describe, expect, it } from 'vitest';
import {
  createDirector, requestMusic, applyTransition, pauseDirector,
  resumeDirector, setBossStem, isTransitioning,
} from '../../src/game/content/audio/music-director.js';
import {
  createVoiceState, canPlayCue, recordCuePlay, validateVoiceParity, VOICE_INVENTORY,
} from '../../src/game/content/audio/voice-runtime.js';
import {
  createBusSettings, setBusVolume, toggleBusMute, effectiveVolume,
  setPolyphonyProfile, POLYPHONY_LIMITS,
} from '../../src/game/content/audio/bus-mixer.js';
import { contextForScreen } from '../../src/features/audio/music-context-map.js';

describe('music director', () => {
  it('starts in silence', () => {
    const s = createDirector();
    expect(s.currentContext).toBe('silence');
    expect(s.paused).toBe(false);
  });

  it('transitions to a new context', () => {
    let s = createDirector();
    s = requestMusic(s, 'hq');
    expect(isTransitioning(s)).toBe(true);
    expect(s.nextContext).toBe('hq');

    s = applyTransition(s);
    expect(s.currentContext).toBe('hq');
    expect(isTransitioning(s)).toBe(false);
  });

  it('ignores request to the current context', () => {
    let s = createDirector();
    s = requestMusic(s, 'hq');
    s = applyTransition(s);
    const before = s;
    s = requestMusic(s, 'hq');
    expect(s).toBe(before);
  });

  it('crossfades through region, battle, and boss contexts', () => {
    let s = createDirector();
    s = requestMusic(s, { kind: 'region', regionId: 'woodlands' });
    s = applyTransition(s);
    expect(typeof s.currentContext === 'object' && 'kind' in s.currentContext && s.currentContext.kind === 'region').toBe(true);

    s = requestMusic(s, { kind: 'battle', intensity: 'normal' });
    s = applyTransition(s);
    expect(typeof s.currentContext === 'object' && 'kind' in s.currentContext && s.currentContext.kind === 'battle').toBe(true);

    s = requestMusic(s, { kind: 'bossPhase', phase: 2 });
    s = applyTransition(s);
    expect(typeof s.currentContext === 'object' && 'kind' in s.currentContext && s.currentContext.kind === 'bossPhase').toBe(true);
  });

  it('pauses and resumes without changing context', () => {
    let s = createDirector();
    s = requestMusic(s, 'title');
    s = applyTransition(s);
    s = pauseDirector(s);
    expect(s.paused).toBe(true);
    s = resumeDirector(s);
    expect(s.paused).toBe(false);
    expect(s.currentContext).toBe('title');
  });

  it('double-pause is idempotent', () => {
    let s = createDirector();
    s = pauseDirector(s);
    const before = s;
    s = pauseDirector(s);
    expect(s).toBe(before);
  });

  it('re-request during pause resumes and transitions', () => {
    let s = createDirector();
    s = requestMusic(s, 'hq');
    s = applyTransition(s);
    s = pauseDirector(s);
    s = requestMusic(s, 'title');
    expect(s.paused).toBe(false);
    expect(s.nextContext).toBe('title');
  });

  it('boss stem layer stays within 0-3', () => {
    let s = createDirector();
    s = setBossStem(s, 2);
    expect(s.bossStemLayer).toBe(2);
    s = setBossStem(s, 5);
    expect(s.bossStemLayer).toBe(2);
    s = setBossStem(s, -1);
    expect(s.bossStemLayer).toBe(2);
  });
});

describe('voice runtime', () => {
  it('allows playing when no history', () => {
    const state = createVoiceState('en');
    expect(canPlayCue(state, 'voice.hero.aurel.entry', 0)).toBe(true);
  });

  it('blocks within cooldown', () => {
    let state = createVoiceState('en');
    state = recordCuePlay(state, 'voice.hero.aurel.entry', 0);
    expect(canPlayCue(state, 'voice.hero.aurel.entry', 10_000)).toBe(false);
  });

  it('allows after cooldown', () => {
    let state = createVoiceState('en');
    state = recordCuePlay(state, 'voice.hero.aurel.entry', 0);
    expect(canPlayCue(state, 'voice.hero.aurel.entry', 25_000)).toBe(true);
  });

  it('different cues have independent cooldowns', () => {
    let state = createVoiceState('en');
    state = recordCuePlay(state, 'voice.hero.aurel.entry', 0);
    expect(canPlayCue(state, 'voice.boss.ashKing.intro', 5_000)).toBe(true);
  });

  it('validate parses locale', () => {
    const state = createVoiceState('de');
    expect(state.locale).toBe('de');
  });
});

describe('voice parity validator', () => {
  it('validates the built-in inventory has no parity errors', () => {
    const errors = validateVoiceParity(VOICE_INVENTORY);
    expect(errors).toHaveLength(0);
  });

  it('detects missing DE locale', () => {
    const clips = [
      { clipId: 'voice.hero.test.entry', locale: 'en' as const, subtitleKey: 'test.entry', durationMs: 1000, variants: ['v1'] },
    ];
    const errors = validateVoiceParity(clips);
    expect(errors.some((e) => e.includes('missing DE'))).toBe(true);
  });

  it('detects missing EN locale', () => {
    const clips = [
      { clipId: 'voice.hero.test.entry', locale: 'de' as const, subtitleKey: 'test.entry', durationMs: 1000, variants: ['v1'] },
    ];
    const errors = validateVoiceParity(clips);
    expect(errors.some((e) => e.includes('missing EN'))).toBe(true);
  });
});

describe('music context map', () => {
  it('maps menu-family screens to title', () => {
    expect(contextForScreen('menu')).toBe('title');
    expect(contextForScreen('settings')).toBe('title');
    expect(contextForScreen('defeat')).toBe('title');
  });

  it('maps hq-family screens to hq', () => {
    expect(contextForScreen('hq')).toBe('hq');
    expect(contextForScreen('heroHall')).toBe('hq');
    expect(contextForScreen('workshop')).toBe('hq');
    expect(contextForScreen('ascension')).toBe('hq');
  });

  it('maps map to a region context', () => {
    const ctx = contextForScreen('map', { regionId: 'woodlands' });
    expect(ctx).toEqual({ kind: 'region', regionId: 'woodlands' });
  });

  it('maps node boss to bossPhase and combat to battle', () => {
    expect(contextForScreen('node', { intensity: 'boss' })).toEqual({ kind: 'bossPhase', phase: 1 });
    expect(contextForScreen('node', { intensity: 'elite' })).toEqual({ kind: 'battle', intensity: 'elite' });
    expect(contextForScreen('node')).toEqual({ kind: 'battle', intensity: 'normal' });
  });

  it('falls back to silence for unknown screens', () => {
    expect(contextForScreen('unknownScreen')).toBe('silence');
  });

  it('covers every PostBootScreen nav state without falling to silence', () => {
    const navStates = [
      'menu', 'newGame', 'help', 'missions', 'missionDetail', 'map', 'node',
      'battleResult', 'reward', 'end', 'defeat', 'hq', 'heroHall', 'heroDetail',
      'barracks', 'troopDetail', 'workshop', 'itemDetail', 'archive', 'codexList',
      'codexDetail', 'mastery', 'achievements', 'records', 'storyArchive',
      'ascension', 'constellation', 'cyclePreparation', 'beyondSetup', 'endlessSetup',
      'riftChamber', 'equipment', 'kits', 'banners', 'formation', 'settings',
      'audioSettings', 'accessibilitySettings', 'controlsSettings', 'graphicsSettings',
    ];
    for (const state of navStates) {
      expect(contextForScreen(state), state).not.toBe('silence');
    }
  });
});

describe('bus mixer', () => {
  it('defaults match spec', () => {
    const s = createBusSettings();
    expect(s.volume.music).toBe(65);
    expect(s.volume.sfx).toBe(80);
    expect(s.volume.ambient).toBe(55);
    expect(s.masterMuted).toBe(false);
  });

  it('sets and clamps bus volume', () => {
    let s = createBusSettings();
    s = setBusVolume(s, 'music', 42);
    expect(s.volume.music).toBe(42);
    s = setBusVolume(s, 'music', 150);
    expect(s.volume.music).toBe(100);
    s = setBusVolume(s, 'music', -10);
    expect(s.volume.music).toBe(0);
  });

  it('toggles bus mute', () => {
    let s = createBusSettings();
    expect(s.muted.voice).toBe(false);
    s = toggleBusMute(s, 'voice');
    expect(s.muted.voice).toBe(true);
    s = toggleBusMute(s, 'voice');
    expect(s.muted.voice).toBe(false);
  });

  it('effective volume is zero when master muted', () => {
    let s = createBusSettings();
    s = setBusVolume(s, 'music', 80);
    s = { ...s, masterMuted: true };
    expect(effectiveVolume(s, 'music')).toBe(0);
  });

  it('effective volume is zero when bus muted', () => {
    let s = createBusSettings();
    s = setBusVolume(s, 'sfx', 80);
    s = toggleBusMute(s, 'sfx');
    expect(effectiveVolume(s, 'sfx')).toBe(0);
  });

  it('polyphony profiles have correct limits', () => {
    expect(POLYPHONY_LIMITS.high).toBe(24);
    expect(POLYPHONY_LIMITS.medium).toBe(16);
    expect(POLYPHONY_LIMITS.low).toBe(10);
  });

  it('setPolyphonyProfile changes profile', () => {
    let s = createBusSettings('high');
    expect(s.profile).toBe('high');
    s = setPolyphonyProfile(s, 'low');
    expect(s.profile).toBe('low');
  });
});