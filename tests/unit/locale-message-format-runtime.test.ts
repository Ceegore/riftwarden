import { describe, expect, it } from 'vitest';
import { formatMessageToString, formatMessageToParts } from '../../src/locales/format/message-format';
import { LocaleRuntimeError } from '../../src/locales/format/errors';
import type { CompiledBundle, CompiledMessage, CompiledNode } from '../../src/locales/format/compiled-types';

function bundle(locale: 'en' | 'de', message: CompiledMessage): CompiledBundle {
  return { schemaVersion: 1, locale, kind: 'release_locale_bundle', messages: { key: message } };
}

function msg(ast: readonly CompiledNode[], parameters: Record<string, 'string' | 'number' | 'select' | 'plural'>): CompiledMessage {
  return { ast, parameters, budget: '0', compactKey: null };
}

const text = (v: string): CompiledNode => ({ t: 'text', v });
const arg = (n: string): CompiledNode => ({ t: 'arg', n });
const num = (n: string): CompiledNode => ({ t: 'number', n });
const pound = (): CompiledNode => ({ t: 'pound' });
const select = (n: string, b: Record<string, readonly CompiledNode[]>): CompiledNode => ({ t: 'select', n, b });
const plural = (n: string, b: Record<string, readonly CompiledNode[]>): CompiledNode => ({ t: 'plural', n, b });

function runtimeError(fn: () => unknown, code: string): void {
  let caught: unknown = null;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(LocaleRuntimeError);
  expect((caught as LocaleRuntimeError).code).toBe(code);
}

describe('message format runtime — plural', () => {
  const EN = bundle('en', msg([text('You have '), plural('count', { one: [pound(), text(' item')], other: [pound(), text(' items')] }), text('.')], { count: 'plural' }));

  it('selects the one category and renders the pound value', () => {
    expect(formatMessageToString(EN, 'key', { count: 1 })).toBe('You have 1 item.');
  });

  it('falls back to other for plural categories without a branch', () => {
    expect(formatMessageToString(EN, 'key', { count: 2 })).toBe('You have 2 items.');
    expect(formatMessageToString(EN, 'key', { count: 0 })).toBe('You have 0 items.');
  });

  it('treats -1 as the one category (CLDR i=1 and v=0)', () => {
    expect(formatMessageToString(EN, 'key', { count: -1 })).toBe('You have -1 item.');
  });

  it('handles fractional values via the category rules', () => {
    expect(formatMessageToString(EN, 'key', { count: 1.5 })).toBe('You have 1.5 items.');
  });

  it('prefers an exact =N branch over the category branch', () => {
    const exact = bundle('en', msg([plural('count', { '=0': [text('none')], one: [text('one')], other: [text('other')] })], { count: 'plural' }));
    expect(formatMessageToString(exact, 'key', { count: 0 })).toBe('none');
    expect(formatMessageToString(exact, 'key', { count: 1 })).toBe('one');
    expect(formatMessageToString(exact, 'key', { count: 2 })).toBe('other');
  });

  it('matches =0 for -0 because String(-0) is "0"', () => {
    const exact = bundle('en', msg([plural('count', { '=0': [text('none')], other: [text('other')] })], { count: 'plural' }));
    expect(formatMessageToString(exact, 'key', { count: -0 })).toBe('none');
  });

  it('formats the pound with the locale number formatter (German decimal comma)', () => {
    const de = bundle('de', msg([plural('count', { other: [pound(), text(' Punkte')] })], { count: 'plural' }));
    expect(formatMessageToString(de, 'key', { count: 1.5 })).toBe('1,5 Punkte');
  });

  it('propagates the plural value through nested selects', () => {
    const nested = bundle('en', msg([plural('count', { other: [select('who', { other: [pound()] })] })], { count: 'plural', who: 'select' }));
    expect(formatMessageToString(nested, 'key', { count: 7, who: 'x' })).toBe('7');
  });

  it('throws INVALID_BUNDLE when other is missing', () => {
    const bad = bundle('en', msg([plural('count', { one: [text('one')] })], { count: 'plural' }));
    runtimeError(() => formatMessageToString(bad, 'key', { count: 2 }), 'L10N_RUNTIME_INVALID_BUNDLE');
  });
});

describe('message format runtime — pound outside plural', () => {
  it('throws INVALID_BUNDLE for a pound node with no enclosing plural', () => {
    const bad = bundle('en', msg([text('raw '), pound()], {}));
    runtimeError(() => formatMessageToString(bad, 'key', {}), 'L10N_RUNTIME_INVALID_BUNDLE');
  });
});

describe('message format runtime — select', () => {
  const M = bundle('en', msg([select('mode', { safe: [text('SAFE')], other: [text('other')] })], { mode: 'select' }));

  it('picks the matching branch', () => {
    expect(formatMessageToString(M, 'key', { mode: 'safe' })).toBe('SAFE');
  });

  it('falls back to other for unknown values and numbers/booleans', () => {
    expect(formatMessageToString(M, 'key', { mode: 'unknown' })).toBe('other');
    expect(formatMessageToString(M, 'key', { mode: 1 })).toBe('other');
    expect(formatMessageToString(M, 'key', { mode: true })).toBe('other');
  });

  it('throws INVALID_BUNDLE when other is missing', () => {
    const bad = bundle('en', msg([select('mode', { safe: [text('SAFE')] })], { mode: 'select' }));
    runtimeError(() => formatMessageToString(bad, 'key', { mode: 'x' }), 'L10N_RUNTIME_INVALID_BUNDLE');
  });
});

describe('message format runtime — number and arg', () => {
  it('formats numbers with grouping and decimals', () => {
    const M = bundle('en', msg([text('Gold: '), num('gold')], { gold: 'number' }));
    expect(formatMessageToString(M, 'key', { gold: 1234.56 })).toBe('Gold: 1,234.56');
  });

  it('renders arg nodes with String coercion', () => {
    const M = bundle('en', msg([arg('name')], { name: 'string' }));
    expect(formatMessageToString(M, 'key', { name: 'Ada' })).toBe('Ada');
    expect(formatMessageToString(M, 'key', { name: 42 })).toBe('42');
    expect(formatMessageToString(M, 'key', { name: false })).toBe('false');
  });

  it('merges adjacent text nodes across a number boundary', () => {
    const M = bundle('en', msg([text('a'), num('n'), text('b')], { n: 'number' }));
    const parts = formatMessageToParts(M, 'key', { n: 1 });
    expect(parts).toEqual([{ type: 'text', value: 'a1b' }]);
  });
});

describe('message format runtime — parameter validation', () => {
  const M = bundle('en', msg([plural('count', { other: [pound()] }), text(' '), num('gold')], { count: 'plural', gold: 'number' }));

  it('rejects missing parameters', () => {
    runtimeError(() => formatMessageToString(M, 'key', { count: 1 }), 'L10N_RUNTIME_MISSING_PARAMETER');
  });

  it('rejects extra parameters', () => {
    runtimeError(() => formatMessageToString(M, 'key', { count: 1, gold: 5, surprise: true }), 'L10N_RUNTIME_EXTRA_PARAMETER');
  });

  it('rejects wrong types for number/plural params', () => {
    runtimeError(() => formatMessageToString(M, 'key', { count: '1', gold: 5 }), 'L10N_RUNTIME_PARAMETER_TYPE');
    runtimeError(() => formatMessageToString(M, 'key', { count: 1, gold: NaN }), 'L10N_RUNTIME_PARAMETER_TYPE');
    runtimeError(() => formatMessageToString(M, 'key', { count: 1, gold: Infinity }), 'L10N_RUNTIME_PARAMETER_TYPE');
    runtimeError(() => formatMessageToString(M, 'key', { count: 1, gold: null as unknown as number }), 'L10N_RUNTIME_PARAMETER_TYPE');
  });

  it('rejects undefined values even when the key exists', () => {
    runtimeError(() => formatMessageToString(M, 'key', { count: 1, gold: undefined as unknown as number }), 'L10N_RUNTIME_MISSING_PARAMETER');
  });

  it('rejects a missing message key', () => {
    runtimeError(() => formatMessageToString(M, 'missing', {}), 'L10N_RUNTIME_MISSING_KEY');
  });
});

describe('message format runtime — nesting depth and rich text', () => {
  it('renders nested plural inside select and keeps outer plural context after', () => {
    const M = bundle('en', msg([plural('count', { other: [pound(), text(' '), select('who', { other: [plural('inner', { other: [text('('), pound(), text(')')] })] })] })], { count: 'plural', who: 'select', inner: 'plural' }));
    expect(formatMessageToString(M, 'key', { count: 3, who: 'x', inner: 9 })).toBe('3 (9)');
  });

  it('rejects self-closing rich text tokens in string formatting', () => {
    const token = { t: 'token' as const, k: 'icon', id: 'sword', mode: 'self' as const };
    const M = bundle('en', msg([text('Get '), token], {}));
    runtimeError(() => formatMessageToString(M, 'key', {}), 'L10N_RUNTIME_RICH_TEXT_REQUIRED');
  });

  it('keeps paired rich text children in parts output', () => {
    const token = { t: 'token' as const, k: 'strong', id: 's', mode: 'paired' as const, c: [text('bold')] as readonly CompiledNode[] };
    const M = bundle('en', msg([text('A '), token], {}));
    const parts = formatMessageToParts(M, 'key', {});
    expect(parts).toEqual([
      { type: 'text', value: 'A ' },
      { type: 'token', kind: 'strong', id: 's', mode: 'paired', children: [{ type: 'text', value: 'bold' }] },
    ]);
  });
});
