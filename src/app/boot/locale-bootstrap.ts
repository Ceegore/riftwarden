/**
 * Locale bootstrap (LOCALE_BOOTSTRAP_CONTRACT): constructs the app's
 * LocaleController from the generated bootstrap bundle so the app can
 * render localized UI in a browser before the full localization compiler
 * pipeline lands. The switch adapter is a no-op; the registry serves the
 * same bootstrap bundle for every supported locale.
 */
import { LocaleController, type LocaleSwitchAdapter } from '../../locales/locale-state.js';
import { createLocaleRegistry } from '../../locales/registry.js';
import { BOOTSTRAP_BUNDLES } from '../../locales/format/bootstrap-bundle.js';
import type { BuildChannel, CompiledBundle, LocaleId } from '../../locales/format/compiled-types.js';

const noopAdapter: LocaleSwitchAdapter = {
  captureContinuity() {
    return {
      navigationSemanticId: null,
      modalStack: [],
      pendingTransactionId: null,
      recoveryState: null,
      focusedSemanticId: null,
      scrollAnchorSemanticId: null,
      saveGameFingerprint: '',
      simulationFingerprint: '',
    };
  },
  restoreFocusAndScroll() { /* no-op */ },
  persistLocale: () => Promise.resolve(),
};

function channelToBuildChannel(channel: string): BuildChannel {
  if (channel === 'release') return 'release';
  if (channel === 'qa') return 'test';
  return 'development';
}

/** Build the bootstrap controller for the given build channel. */
export function createBootstrapLocaleController(channel: string): LocaleController {
  const buildChannel = channelToBuildChannel(channel);
  const loaders: Partial<Record<LocaleId, () => Promise<CompiledBundle>>> = {
    de: () => Promise.resolve(BOOTSTRAP_BUNDLES.de),
    en: () => Promise.resolve(BOOTSTRAP_BUNDLES.en),
  };
  // Pseudo-locale must never be wired into a release registry (§release contract).
  if (buildChannel !== 'release') {
    loaders['qps-ploc'] = () => Promise.resolve(BOOTSTRAP_BUNDLES['qps-ploc']);
  }
  const registry = createLocaleRegistry(buildChannel, loaders);
  const initial: LocaleId = 'en';
  return new LocaleController(registry, noopAdapter, initial, BOOTSTRAP_BUNDLES[initial]);
}
