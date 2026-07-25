import { describe, expect, it, vi } from 'vitest';
import type { CompiledBundle, LocaleId } from '../../src/locales/format/compiled-types';
import { createLocaleRegistry } from '../../src/locales/registry';
import { LocaleController, type LocaleContinuitySnapshot } from '../../src/locales/locale-state';

const makeBundle = (locale:LocaleId):CompiledBundle => ({
  schemaVersion:1,
  locale,
  kind:locale === 'qps-ploc' ? 'generated_test_only_locale_bundle' : 'release_locale_bundle',
  ...(locale === 'qps-ploc' ? { sourceLocale:'de' as const } : {}),
  messages:{ 'ui.test.title':{ ast:[{ t:'text', v:locale }], parameters:{}, budget:'system_title', compactKey:null } },
});

const continuity:LocaleContinuitySnapshot = {
  navigationSemanticId:'recovery', modalStack:['diagnostics'], pendingTransactionId:'tx_1', recoveryState:{ code:'E_TEST' },
  focusedSemanticId:'retry', scrollAnchorSemanticId:'error-code', saveGameFingerprint:'save-hash', simulationFingerprint:'sim-hash',
};

describe('locale switch continuity contract', () => {
  it('loads before commit and preserves app/save continuity', async () => {
    const persistLocale = vi.fn(async () => { await Promise.resolve(); return undefined; });
    const restoreFocusAndScroll = vi.fn();
    const registry = createLocaleRegistry('test', {
      de:async () => { await Promise.resolve(); return makeBundle('de'); }, en:async () => { await Promise.resolve(); return makeBundle('en'); }, 'qps-ploc':async () => { await Promise.resolve(); return makeBundle('qps-ploc'); },
    });
    const controller = new LocaleController(registry, { captureContinuity:() => structuredClone(continuity), persistLocale, restoreFocusAndScroll }, 'de', makeBundle('de'));
    await controller.switchLocale('en');
    expect(controller.getSnapshot().activeLocale).toBe('en');
    expect(controller.getSnapshot().uiRevision).toBe(1);
    expect(persistLocale).toHaveBeenCalledWith('en');
  });

  it('rolls back locale when bundle loading fails', async () => {
    const registry = createLocaleRegistry('test', {
      de:async () => { await Promise.resolve(); return makeBundle('de'); }, en:async () => { await Promise.resolve(); throw new Error('fixture load failure'); }, 'qps-ploc':async () => { await Promise.resolve(); return makeBundle('qps-ploc'); },
    });
    const controller = new LocaleController(registry, { captureContinuity:() => continuity, persistLocale:async () => { await Promise.resolve(); return undefined; }, restoreFocusAndScroll:() => undefined }, 'de', makeBundle('de'));
    await expect(controller.switchLocale('en')).rejects.toThrow('fixture load failure');
    expect(controller.getSnapshot().activeLocale).toBe('de');
  });
});
