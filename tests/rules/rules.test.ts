import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_RULES } from '../../src/game/rules/game-rules';
import { TECHNICAL_RULES } from '../../src/game/rules/technical-rules';
import { UI_RULES } from '../../src/game/rules/ui-rules';
import { SAVE_RULES } from '../../src/game/rules/save-rules';

const here = path.dirname(fileURLToPath(import.meta.url));
const j = (p: string): Snapshot => JSON.parse(readFileSync(path.join(here, '..', '..', 'contracts', 'rules', p), 'utf8')) as Snapshot;
const strip = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
type Snapshot = Record<string, unknown> & { schemaVersion?: number };

describe('rule snapshots', () => {
  it('technical snapshot exact', () => {
    const expected = j('technical-rules.snapshot.json');
    delete expected.schemaVersion;
    expect(strip(TECHNICAL_RULES)).toEqual(expected);
  });

  it('ui snapshot exact', () => {
    const expected = j('ui-rules.snapshot.json');
    delete expected.schemaVersion;
    expect(strip(UI_RULES)).toEqual(expected);
  });

  it('save snapshot exact', () => {
    const expected = j('save-rules.snapshot.json');
    delete expected.schemaVersion;
    expect(strip(SAVE_RULES)).toEqual(expected);
  });

  it('game snapshot exact', () => {
    const expected = j('game-rules.snapshot.json');
    delete expected.schemaVersion;
    const actual: Record<string, unknown> = { ...strip(GAME_RULES) };
    delete actual['simulationTicksPerSecond'];
    delete actual['autosaveRotationSlots'];
    delete actual['supportedLocales'];
    expect(actual).toEqual(expected);
  });
});

describe('rule objects are deep frozen', () => {
  for (const [name, obj] of Object.entries({ GAME_RULES, TECHNICAL_RULES, UI_RULES, SAVE_RULES })) {
    it(`${name} is frozen`, () => {
      expect(Object.isFrozen(obj)).toBe(true);
      for (const value of Object.values(obj)) {
        if (value && typeof value === 'object') expect(Object.isFrozen(value)).toBe(true);
      }
    });
  }
});

describe('composed values reference canonical owners', () => {
  it('game rules compose from owners', () => {
    expect(GAME_RULES.simulationTicksPerSecond).toBe(TECHNICAL_RULES.simulationTicksPerSecond);
    expect(GAME_RULES.autosaveRotationSlots).toBe(SAVE_RULES.autosaveRotationSlots);
    expect(GAME_RULES.supportedLocales).toBe(UI_RULES.supportedLocales);
  });
});

describe('runtime mutation throws', () => {
  it('mutating a frozen rule object throws', () => {
    expect(() => {
      (GAME_RULES as { maxRegularUnitsPerSide: number }).maxRegularUnitsPerSide = 99;
    }).toThrow();
  });
});
