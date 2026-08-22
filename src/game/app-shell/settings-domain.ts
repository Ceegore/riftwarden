/**
 * Phase 30 settings domain (SETTINGS_DOMAIN_CONTRACT): `persisted`, `draft`,
 * `effective` and `previewBaseline` are distinct concepts. Preview mutates only
 * authorized runtime systems; Cancel restores exactly the last commit. Apply
 * validates, canonicalizes and commits atomically with a monotonic revision.
 * Unknown enum values are never silently accepted — they produce a diagnosis
 * and a safe fallback, and only a commit against the current baseline succeeds.
 */
import { AppShellError } from './app-shell-error.js';
import { LOCALES, TEXT_SCALES, type Locale, type Settings, type TextScale } from './types.js';

export const DEFAULT_SETTINGS: Settings = {
  locale: 'de',
  subtitles: true,
  textScale: 100,
  reduceMotion: false,
  reduceFlash: false,
  haptics: true,
  revision: 0,
};

export type SettingsDiagnosis = 'none' | 'unknown-locale' | 'unknown-textscale' | 'negative-revision' | 'non-integer-revision';

/** Validates and canonicalizes a settings object; unknown values fall back safely. */
export function validateSettings(value: Settings): Settings {
  const locale: Locale = (LOCALES as readonly string[]).includes(value.locale) ? value.locale : DEFAULT_SETTINGS.locale;
  const textScale: TextScale = (TEXT_SCALES as readonly number[]).includes(value.textScale)
    ? value.textScale
    : DEFAULT_SETTINGS.textScale;
  const revision = Number.isInteger(value.revision) && value.revision >= 0 ? value.revision : 0;
  return {
    locale,
    subtitles: typeof value.subtitles === 'boolean' ? value.subtitles : DEFAULT_SETTINGS.subtitles,
    textScale,
    reduceMotion: typeof value.reduceMotion === 'boolean' ? value.reduceMotion : DEFAULT_SETTINGS.reduceMotion,
    reduceFlash: typeof value.reduceFlash === 'boolean' ? value.reduceFlash : DEFAULT_SETTINGS.reduceFlash,
    haptics: typeof value.haptics === 'boolean' ? value.haptics : DEFAULT_SETTINGS.haptics,
    revision,
  };
}

/** Classifies the first diagnosis for a settings value (''none'' when clean). */
export function diagnoseSettings(value: Settings): SettingsDiagnosis {
  if (!(LOCALES as readonly string[]).includes(value.locale)) return 'unknown-locale';
  if (!(TEXT_SCALES as readonly number[]).includes(value.textScale)) return 'unknown-textscale';
  if (!Number.isInteger(value.revision)) return 'non-integer-revision';
  if (value.revision < 0) return 'negative-revision';
  return 'none';
}

/**
 * Preview/cancel/commit session over a settings baseline. `effective` always
 * equals the last committed `persisted`; `draft` is the reversible working
 * copy. Commit is rejected unless the session's baseline revision still matches
 * the caller's expected revision (stale-baseline guard).
 */
export class SettingsSession {
  private persisted: Settings;
  private draft: Settings;
  private expectedRevision: number;

  constructor(value: Settings) {
    const validated = validateSettings(value);
    this.persisted = validated;
    this.draft = { ...validated };
    this.expectedRevision = validated.revision;
  }

  /** Current committed (effective) settings. */
  effective(): Settings {
    return { ...this.persisted };
  }

  /** Current working draft. */
  draftState(): Settings {
    return { ...this.draft };
  }

  /** Applies a partial update to the draft (validated); returns the new draft. */
  preview(partial: Partial<Settings>): Settings {
    const merged: Settings = { ...this.draft, ...partial };
    this.draft = validateSettings(merged);
    return { ...this.draft };
  }

  /** Restores the draft to exactly the last committed settings. */
  cancel(): Settings {
    this.draft = { ...this.persisted };
    return { ...this.persisted };
  }

  /**
   * Atomically commits the draft as the new persisted settings with a
   * monotonic revision. Throws when the baseline revision has moved (stale
   * commit) so double-applies never double-increment.
   */
  commit(): Settings {
    if (this.draft.revision !== this.expectedRevision) {
      throw new AppShellError('STALE_SETTINGS_BASELINE', {
        expected: this.expectedRevision,
        actual: this.draft.revision,
      });
    }
    const committed: Settings = { ...this.draft, revision: this.expectedRevision + 1 };
    this.persisted = committed;
    this.draft = { ...committed };
    this.expectedRevision = committed.revision;
    return { ...committed };
  }

  /** Resets the draft to defaults (not committed until apply). */
  resetToDefaults(): Settings {
    this.draft = { ...DEFAULT_SETTINGS, revision: this.persisted.revision };
    return { ...this.draft };
  }
}
