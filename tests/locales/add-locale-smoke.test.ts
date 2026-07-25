import { describe, expect, it } from 'vitest';
import { createLocaleRegistry } from '../../src/locales/registry';
import type { CompiledBundle } from '../../src/locales/format/compiled-types';

const bundle = (locale:'de'|'en'|'qps-ploc'):CompiledBundle => ({
  schemaVersion:1,
  locale,
  kind:locale === 'qps-ploc' ? 'generated_test_only_locale_bundle' : 'release_locale_bundle',
  ...(locale === 'qps-ploc' ? { sourceLocale:'de' as const } : {}),
  messages:{},
});

describe('registry extensibility smoke', () => {
  it('adds the test locale through registry data without screen-logic changes', async () => {
    const registry = createLocaleRegistry('test', {
      de:async () => { await Promise.resolve(); return bundle('de'); }, en:async () => { await Promise.resolve(); return bundle('en'); }, 'qps-ploc':async () => { await Promise.resolve(); return bundle('qps-ploc'); },
    });
    expect(registry.supportedLocales).toContain('qps-ploc');
    expect(registry.pickerLocales).not.toContain('qps-ploc');
    expect((await registry.load('qps-ploc')).locale).toBe('qps-ploc');
  });
});
