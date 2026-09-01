import { deepFreeze } from './deep-freeze.js';
export const UI_RULES = deepFreeze({
  supportedLocales: ['de', 'en'] as const,
  battleSpeedRatios: [
    { numerator: 1, denominator: 2 },
    { numerator: 1, denominator: 1 },
    { numerator: 2, denominator: 1 },
    { numerator: 3, denominator: 1 },
  ] as const,
  battleSpeedAffectsAuthoritativeOutcome: false,
  localizedNamesAreAuthoritativeSortKeys: false,
} as const);
export type SupportedLocale = (typeof UI_RULES.supportedLocales)[number];
