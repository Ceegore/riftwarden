import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from '../../src/game/rules/enums/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const core = JSON.parse(readFileSync(path.join(here, '..', '..', 'contracts', 'rules', 'core-enums.json'), 'utf8')) as {
  enums: Record<string, readonly string[]>;
};
const snap = core.enums;

function enumName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function valuesOf(name: string): readonly string[] {
  const values = (E as unknown as Record<string, readonly string[]>)[`${enumName(name)}Values`];
  if (!values) throw new Error(`missing Values export for ${name}`);
  return values;
}

function parserOf(name: string): (value: unknown) => string {
  const parser = (E as unknown as Record<string, (value: unknown) => string>)[`parse${enumName(name)}`];
  if (!parser) throw new Error(`missing parser export for ${name}`);
  return parser;
}

for (const [name, values] of Object.entries(snap)) {
  describe(`enum ${name}`, () => {
    it('stable order', () => {
      expect(valuesOf(name)).toEqual(values);
    });
    it('runtime frozen', () => {
      expect(Object.isFrozen(valuesOf(name))).toBe(true);
    });
    it('parses every value', () => {
      const parser = parserOf(name);
      for (const value of values) expect(parser(value)).toBe(value);
    });
    it('rejects unknown', () => {
      expect(() => parserOf(name)('__unknown__')).toThrow();
    });
  });
}

describe('assertNever throws', () => {
  it('throws on unexpected value', () => {
    expect(() => {
      const unexpected = 'unexpected' as never;
      E.assertNever(unexpected);
    }).toThrow();
  });
});
