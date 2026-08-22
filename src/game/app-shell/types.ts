/**
 * Phase 30 app-shell types (APP_SHELL_ROUTE_CONTRACT + SETTINGS_DOMAIN_CONTRACT):
 * routes are versioned serializable data (never an implicit component history),
 * and settings keep persisted/draft/effective/previewBaseline as distinct
 * concepts. Locale and text-scale enums come from the pinned Phase-30 constants.
 */
export type Locale = 'de' | 'en' | 'pseudo';

export type TextScale = 100 | 125 | 150 | 175 | 200;

export type RouteId =
  | 'first-run'
  | 'title'
  | 'new-game'
  | 'continue'
  | 'recovery'
  | 'hq'
  | 'settings-hub'
  | 'settings-page'
  | 'legal-about'
  | 'help';

export interface RouteState {
  readonly version: 1;
  readonly id: RouteId;
  readonly returnTo?: RouteId;
  readonly focusId?: string;
}

/**
 * Settings domain per GDD/Phase-30 constants. `revision` is monotonic and
 * increases exactly once per atomic apply.
 */
export interface Settings {
  readonly locale: Locale;
  readonly subtitles: boolean;
  readonly textScale: TextScale;
  readonly reduceMotion: boolean;
  readonly reduceFlash: boolean;
  readonly haptics: boolean;
  readonly revision: number;
}

export const LOCALES: readonly Locale[] = ['de', 'en', 'pseudo'];

export const TEXT_SCALES: readonly TextScale[] = [100, 125, 150, 175, 200];

export const ROUTE_IDS: readonly RouteId[] = [
  'first-run',
  'title',
  'new-game',
  'continue',
  'recovery',
  'hq',
  'settings-hub',
  'settings-page',
  'legal-about',
  'help',
];
