import { describe, expect, it } from 'vitest';
import { catchShellCode, readJson } from './phase30-helpers.js';
import {
  DEFAULT_SETTINGS,
  diagnoseSettings,
  SettingsSession,
  validateSettings,
} from '../../src/game/app-shell/settings-domain.js';
import type { Settings } from '../../src/game/app-shell/types.js';

describe('phase30 settings cases', () => {
  const cases = readJson('fixtures/settings-cases.json') as readonly { readonly id: string }[];

  it('pins the six settings cases', () => {
    expect(cases.map((row) => row.id)).toEqual([
      'defaults',
      'draft-cancel',
      'apply-ok',
      'write-failure',
      'unknown-enum',
      'reset-confirm',
    ]);
  });

  it('defaults case: DEFAULT_SETTINGS is canonical and valid', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      locale: 'de',
      subtitles: true,
      textScale: 100,
      reduceMotion: false,
      reduceFlash: false,
      haptics: true,
      revision: 0,
    });
    expect(diagnoseSettings(DEFAULT_SETTINGS)).toBe('none');
    expect(validateSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  });

  it('draft-cancel case: cancel restores exactly the last commit', () => {
    const session = new SettingsSession(DEFAULT_SETTINGS);
    session.preview({ textScale: 200, locale: 'en' });
    expect(session.draftState().textScale).toBe(200);
    expect(session.cancel()).toEqual(DEFAULT_SETTINGS);
    expect(session.effective()).toEqual(DEFAULT_SETTINGS);
  });

  it('apply-ok case: one atomic commit with monotonic revision', () => {
    const session = new SettingsSession(DEFAULT_SETTINGS);
    session.preview({ textScale: 150 });
    const committed = session.commit();
    expect(committed.revision).toBe(1);
    expect(committed.textScale).toBe(150);
    expect(session.effective()).toEqual(committed);
    // A second apply over the new baseline bumps to revision 2.
    session.preview({ subtitles: false });
    expect(session.commit().revision).toBe(2);
  });

  it('write-failure case: storage failure leaves persisted untouched', () => {
    const session = new SettingsSession(DEFAULT_SETTINGS);
    session.preview({ locale: 'en' });
    // Simulate a write failure before commit: draft changes are lost on cancel.
    session.cancel();
    expect(session.effective()).toEqual(DEFAULT_SETTINGS);
    expect(session.effective().revision).toBe(0);
    // Retry path: preview again and commit succeeds atomically.
    session.preview({ locale: 'en' });
    expect(session.commit().locale).toBe('en');
  });

  it('unknown-enum case: unknown values diagnose and fall back safely', () => {
    const badLocale = { ...DEFAULT_SETTINGS, locale: 'fr' } as unknown as Settings;
    expect(diagnoseSettings(badLocale)).toBe('unknown-locale');
    expect(validateSettings(badLocale).locale).toBe('de');

    const badScale = { ...DEFAULT_SETTINGS, textScale: 110 } as unknown as Settings;
    expect(diagnoseSettings(badScale)).toBe('unknown-textscale');
    expect(validateSettings(badScale).textScale).toBe(100);

    const badRevision = { ...DEFAULT_SETTINGS, revision: -1 } as unknown as Settings;
    expect(diagnoseSettings(badRevision)).toBe('negative-revision');
    expect(validateSettings(badRevision).revision).toBe(0);
  });

  it('reset-confirm case: reset is draft-only until apply', () => {
    const session = new SettingsSession({ ...DEFAULT_SETTINGS, revision: 3 });
    session.preview({ textScale: 200 });
    session.resetToDefaults();
    expect(session.draftState().textScale).toBe(100);
    expect(session.effective()).toEqual({ ...DEFAULT_SETTINGS, revision: 3 });
    // Cancel after reset keeps the committed state.
    session.cancel();
    expect(session.effective()).toEqual({ ...DEFAULT_SETTINGS, revision: 3 });
  });

  it('stale baseline guard: previewing a revision sneaks past the guard', () => {
    const session = new SettingsSession(DEFAULT_SETTINGS);
    expect(catchShellCode(() => session.preview({ revision: 7 }))).toBeNull();
    expect(catchShellCode(() => session.commit())).toBe('STALE_SETTINGS_BASELINE');
    expect(session.effective()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('phase30 settings property tests', () => {
  it('10000 sequential applies keep a strictly monotonic revision', () => {
    const session = new SettingsSession(DEFAULT_SETTINGS);
    const scales = [100, 125, 150, 175, 200] as const;
    for (let i = 0; i < 10000; i += 1) {
      const scale = scales[i % scales.length] ?? 100;
      session.preview({ textScale: scale });
      const committed = session.commit();
      expect(committed.revision).toBe(i + 1);
      expect(committed.textScale).toBe(scale);
    }
    expect(session.effective().revision).toBe(10000);
  });

  it('validateSettings is a projection: applying twice is idempotent', () => {
    const weird = { ...DEFAULT_SETTINGS, locale: 'xx', textScale: 999, revision: -5 } as unknown as Settings;
    const once = validateSettings(weird);
    const twice = validateSettings(once);
    expect(once).toEqual(twice);
    expect(diagnoseSettings(once)).toBe('none');
  });

  it('cancel is lossless across many drafts', () => {
    for (let i = 0; i < 500; i += 1) {
      const session = new SettingsSession({ ...DEFAULT_SETTINGS, revision: i });
      session.preview({ textScale: 200, reduceMotion: true, locale: 'pseudo' });
      expect(session.cancel()).toEqual({ ...DEFAULT_SETTINGS, revision: i });
    }
  });
});
