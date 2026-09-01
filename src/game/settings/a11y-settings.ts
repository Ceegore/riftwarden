/**
 * Phase 40: Accessibility settings (ACCESSIBILITY_SETTINGS_PERSISTENCE_CONTRACT).
 *
 * Persistent a11y settings: text scale, reduced motion, high contrast,
 * screen reader mode, color blind filter, touch target size, sticky keys,
 * and input repeat delay. Stored in localStorage with profile integration.
 */

export type ColorBlindFilter = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';

export type TextScale = 100 | 125 | 150 | 175 | 200;

export type TouchTargetSize = 'normal' | 'large';

export interface A11ySettings {
  readonly textScale: TextScale;
  readonly reducedMotion: boolean;
  readonly highContrast: boolean;
  readonly screenReaderMode: boolean;
  readonly colorBlindFilter: ColorBlindFilter;
  readonly touchTargetSize: TouchTargetSize;
  readonly stickyKeys: boolean;
  readonly inputRepeatDelay: number;
}

const STORE_KEY = 'rw.a11y.v1';

const DEFAULTS: A11ySettings = Object.freeze({
  textScale: 100,
  reducedMotion: false,
  highContrast: false,
  screenReaderMode: false,
  colorBlindFilter: 'none',
  touchTargetSize: 'normal',
  stickyKeys: false,
  inputRepeatDelay: 300,
});

const VALID_SCALES: ReadonlySet<number> = new Set([100, 125, 150, 175, 200]);
const VALID_FILTERS: ReadonlySet<string> = new Set(['none', 'protanopia', 'deuteranopia', 'tritanopia']);
const VALID_TARGETS: ReadonlySet<string> = new Set(['normal', 'large']);

function isTextScale(value: number): value is TextScale {
  return VALID_SCALES.has(value);
}

function isColorBlindFilter(value: string): value is ColorBlindFilter {
  return VALID_FILTERS.has(value);
}

function isTouchTargetSize(value: string): value is TouchTargetSize {
  return VALID_TARGETS.has(value);
}

export function loadA11ySettings(): A11ySettings {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw === null) return DEFAULTS;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const textScale = typeof parsed['textScale'] === 'number' && isTextScale(parsed['textScale']) ? parsed['textScale'] : DEFAULTS.textScale;
    return {
      textScale,
      reducedMotion: typeof parsed['reducedMotion'] === 'boolean' ? parsed['reducedMotion'] : DEFAULTS.reducedMotion,
      highContrast: typeof parsed['highContrast'] === 'boolean' ? parsed['highContrast'] : DEFAULTS.highContrast,
      screenReaderMode: typeof parsed['screenReaderMode'] === 'boolean' ? parsed['screenReaderMode'] : DEFAULTS.screenReaderMode,
      colorBlindFilter: typeof parsed['colorBlindFilter'] === 'string' && isColorBlindFilter(parsed['colorBlindFilter']) ? parsed['colorBlindFilter'] : DEFAULTS.colorBlindFilter,
      touchTargetSize: typeof parsed['touchTargetSize'] === 'string' && isTouchTargetSize(parsed['touchTargetSize']) ? parsed['touchTargetSize'] : DEFAULTS.touchTargetSize,
      stickyKeys: typeof parsed['stickyKeys'] === 'boolean' ? parsed['stickyKeys'] : DEFAULTS.stickyKeys,
      inputRepeatDelay: typeof parsed['inputRepeatDelay'] === 'number' && Number.isInteger(parsed['inputRepeatDelay']) && parsed['inputRepeatDelay'] >= 100 ? parsed['inputRepeatDelay'] : DEFAULTS.inputRepeatDelay,
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveA11ySettings(settings: A11ySettings): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(settings));
}

export function updateA11ySettings(
  current: A11ySettings,
  patch: Partial<A11ySettings>,
): A11ySettings {
  const textScale = patch.textScale !== undefined && isTextScale(patch.textScale) ? patch.textScale : current.textScale;
  const colorBlindFilter = patch.colorBlindFilter !== undefined && isColorBlindFilter(patch.colorBlindFilter) ? patch.colorBlindFilter : current.colorBlindFilter;
  const touchTargetSize = patch.touchTargetSize !== undefined && isTouchTargetSize(patch.touchTargetSize) ? patch.touchTargetSize : current.touchTargetSize;
  return {
    textScale,
    reducedMotion: patch.reducedMotion ?? current.reducedMotion,
    highContrast: patch.highContrast ?? current.highContrast,
    screenReaderMode: patch.screenReaderMode ?? current.screenReaderMode,
    colorBlindFilter,
    touchTargetSize,
    stickyKeys: patch.stickyKeys ?? current.stickyKeys,
    inputRepeatDelay: patch.inputRepeatDelay !== undefined && Number.isInteger(patch.inputRepeatDelay) && patch.inputRepeatDelay >= 100 ? patch.inputRepeatDelay : current.inputRepeatDelay,
  };
}

export function colorBlindCssFilter(filter: ColorBlindFilter): string {
  switch (filter) {
    case 'none': return 'none';
    case 'protanopia': return 'url(#protanopia-filter)';
    case 'deuteranopia': return 'url(#deuteranopia-filter)';
    case 'tritanopia': return 'url(#tritanopia-filter)';
  }
}
