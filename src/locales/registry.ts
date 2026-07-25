import type { BuildChannel, CompiledBundle, LocaleId, ReleaseLocale } from './format/compiled-types';
import { LocaleRuntimeError } from './format/errors';

export type LocaleLoader = () => Promise<CompiledBundle>;
export type LocaleLoaders = Readonly<Partial<Record<LocaleId, LocaleLoader>>>;

export interface LocaleRegistry {
  readonly channel:BuildChannel;
  readonly supportedLocales:readonly LocaleId[];
  readonly pickerLocales:readonly ReleaseLocale[];
  resolveInitialLocale(stored:string | null | undefined, osLanguages:readonly string[]):LocaleId;
  load(locale:LocaleId):Promise<CompiledBundle>;
}

const RELEASE_LOCALES:readonly ReleaseLocale[] = ['de','en'];

function normalizePrimaryTag(value:string):string {
  return value.trim().replace('_', '-').split('-')[0]?.toLowerCase() ?? '';
}

export function isLocaleAllowed(locale:string, channel:BuildChannel):locale is LocaleId {
  if (locale === 'de' || locale === 'en') return true;
  return locale === 'qps-ploc' && channel !== 'release';
}

export function selectOsDefault(osLanguages:readonly string[]):ReleaseLocale {
  return osLanguages.some(language => normalizePrimaryTag(language) === 'de') ? 'de' : 'en';
}

export function createLocaleRegistry(channel:BuildChannel, loaders:LocaleLoaders):LocaleRegistry {
  const supportedLocales:readonly LocaleId[] = channel === 'release' ? RELEASE_LOCALES : [...RELEASE_LOCALES, 'qps-ploc'];
  for (const locale of supportedLocales) {
    if (!loaders[locale]) throw new LocaleRuntimeError('L10N_RUNTIME_INVALID_LOCALE', `Missing bundle loader for allowed locale ${locale}`);
  }
  if (channel === 'release' && loaders['qps-ploc']) {
    throw new LocaleRuntimeError('L10N_RUNTIME_INVALID_LOCALE', 'Pseudo loader must not be wired into a release registry');
  }

  return {
    channel,
    supportedLocales,
    pickerLocales:RELEASE_LOCALES,
    resolveInitialLocale(stored, osLanguages) {
      if (stored && isLocaleAllowed(stored, channel)) return stored;
      return selectOsDefault(osLanguages);
    },
    async load(locale) {
      const requestedLocale = locale;
      if (!isLocaleAllowed(locale, channel)) throw new LocaleRuntimeError('L10N_RUNTIME_INVALID_LOCALE', `Locale ${requestedLocale} is unavailable in ${channel}`);
      const loader = loaders[locale];
      if (!loader) throw new LocaleRuntimeError('L10N_RUNTIME_INVALID_LOCALE', `No loader for ${locale}`);
      const bundle = await loader();
      validateBundle(bundle, locale, channel);
      return bundle;
    },
  };
}

function validateBundle(bundle:CompiledBundle, expected:LocaleId, channel:BuildChannel):void {
  if (bundle.locale !== expected) {
    throw new LocaleRuntimeError('L10N_RUNTIME_INVALID_BUNDLE', `Invalid bundle for ${expected}`);
  }
  if (channel === 'release' && bundle.kind !== 'release_locale_bundle') {
    throw new LocaleRuntimeError('L10N_RUNTIME_INVALID_BUNDLE', 'Test-only bundle supplied to release registry');
  }
}
