import type { CompiledBundle, LocaleId } from '../../src/locales/format/compiled-types';
import { formatMessageToString } from '../../src/locales/format/message-format';
import { createLocaleRegistry, selectOsDefault } from '../../src/locales/registry';
import { LocaleController, type LocaleContinuitySnapshot, type LocaleSwitchAdapter } from '../../src/locales/locale-state';

const bundle:CompiledBundle = {
  schemaVersion:1,
  locale:'de',
  kind:'release_locale_bundle',
  messages:{ 'ui.test.label':{ ast:[{ t:'text', v:'Test' }], parameters:{}, budget:'test', compactKey:null } },
};

const registry = createLocaleRegistry('test', {
  de:async () => { await Promise.resolve(); return bundle; },
  en:async () => { await Promise.resolve(); return ({ ...bundle, locale:'en' }); },
  'qps-ploc':async () => { await Promise.resolve(); return ({ ...bundle, locale:'qps-ploc', kind:'generated_test_only_locale_bundle', sourceLocale:'de' }); },
});

const continuity:LocaleContinuitySnapshot = {
  navigationSemanticId:'title', modalStack:[], pendingTransactionId:null, recoveryState:null,
  focusedSemanticId:null, scrollAnchorSemanticId:null, saveGameFingerprint:'save', simulationFingerprint:'sim',
};

const adapter:LocaleSwitchAdapter = {
  captureContinuity:() => continuity,
  restoreFocusAndScroll:() => undefined,
  persistLocale:async (locale:LocaleId) => { await Promise.resolve(); void locale; return undefined; },
};

new LocaleController(registry, adapter, 'de', bundle);
formatMessageToString(bundle, 'ui.test.label');
selectOsDefault(['de-DE']);
