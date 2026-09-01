import { describe, expect, it } from 'vitest';
import { isDisclosureComplete, missingDisclosure } from '../../src/game/formation/disclosure.js';
import { compareCodeUnits, isSlotId, SLOT_IDS, sameFormation } from '../../src/game/formation/model.js';
import { restorePreset } from '../../src/game/formation/presets.js';
import { AtomicStartGuard } from '../../src/game/formation/start-guard.js';
import { DISCLOSURE_ITEMS, PRESET_KINDS } from '../../src/game/formation/types.js';
import { canStart, validateFormation } from '../../src/game/formation/validator.js';
import type { SlotEntry } from '../../src/game/formation/types.js';
import { entry, formation, readJson, unit, validationContext } from './phase27-helpers.js';

interface RuleCase {
  readonly id: string;
  readonly regular: number;
  readonly heroes: number;
  readonly hard: string | null;
}

interface WarningCase {
  readonly id: string;
  readonly expected: readonly string[];
}

describe('phase27 constants contract', () => {
  const constants = readJson('phase27-constants.json') as {
    readonly lanes: readonly string[];
    readonly depths: readonly string[];
    readonly maxRegular: number;
    readonly maxHeroes: number;
    readonly maxSameTroop: number;
    readonly presetCount: number;
    readonly presetKinds: readonly string[];
  };

  it('pins the nine stable slots in canonical order', () => {
    expect(constants.lanes).toEqual(['lane_0', 'lane_1', 'lane_2']);
    expect(constants.depths).toEqual(['front', 'middle', 'back']);
    expect(SLOT_IDS).toEqual([
      'lane_0:front',
      'lane_0:middle',
      'lane_0:back',
      'lane_1:front',
      'lane_1:middle',
      'lane_1:back',
      'lane_2:front',
      'lane_2:middle',
      'lane_2:back',
    ]);
    expect(SLOT_IDS).toHaveLength(9);
  });

  it('pins limits and the four preset kinds', () => {
    expect(constants.maxRegular).toBe(7);
    expect(constants.maxHeroes).toBe(3);
    expect(constants.maxSameTroop).toBe(3);
    expect(constants.presetCount).toBe(4);
    expect(PRESET_KINDS).toEqual(['standard', 'defensive', 'offensive', 'custom']);
  });
});

describe('phase27 formation-rule matrix', () => {
  const cases = (readJson('fixtures/formation-rule-matrix.json') as { readonly cases: readonly RuleCase[] }).cases;

  function build(regular: number, heroes: number) {
    const entries: SlotEntry[] = [];
    for (let i = 0; i < regular; i += 1) {
      const slot = SLOT_IDS[i % 9];
      if (slot !== undefined) entries.push(entry(slot, unit(`r${String(i)}`)));
    }
    for (let i = 0; i < heroes; i += 1) {
      const slot = SLOT_IDS[(regular + i) % 9];
      if (slot !== undefined) entries.push(entry(slot, unit(`h${String(i)}`, 'hero')));
    }
    return formation(entries);
  }

  it('matches every pinned hard-error outcome', () => {
    for (const ruleCase of cases) {
      const ctx = validationContext({
        availableInstances: new Set(Array.from({ length: ruleCase.regular + ruleCase.heroes }, (_, i) => `r${String(i)}`).concat(
          Array.from({ length: ruleCase.heroes }, (_, i) => `h${String(i)}`),
        )),
      });
      const findings = validateFormation(build(ruleCase.regular, ruleCase.heroes), ctx);
      if (ruleCase.hard === null) {
        expect(findings.filter((f) => f.severity === 'hard'), ruleCase.id).toHaveLength(0);
        expect(canStart(findings), ruleCase.id).toBe(true);
      } else {
        const hardCodes = findings.filter((f) => f.severity === 'hard').map((f) => f.code);
        expect(hardCodes, ruleCase.id).toContain(ruleCase.hard);
        expect(canStart(findings), ruleCase.id).toBe(false);
      }
    }
  });
});

describe('phase27 warning matrix', () => {
  const cases = (readJson('fixtures/warning-matrix.json') as { readonly cases: readonly WarningCase[] }).cases;
  const base = validationContext({ availableInstances: new Set(['w0', 'w1', 'w2']) });

  it('emits exactly the pinned warning code per case', () => {
    for (const warningCase of cases) {
      let ctx = base;
      let f = formation([]);
      if (warningCase.id === 'no-healer') {
        ctx = { ...base, rolesByInstance: new Map([['w0', ['melee']]]) };
        f = formation([entry('lane_0:front', unit('w0'))]);
      } else if (warningCase.id === 'no-melee') {
        ctx = { ...base, rolesByInstance: new Map([['w0', ['healer']]]) };
        f = formation([entry('lane_0:front', unit('w0'))]);
      } else if (warningCase.id === 'pressured-empty-lane') {
        ctx = {
          ...base,
          rolesByInstance: new Map([['w0', ['healer', 'melee']]]),
          pressuredLanes: new Set(['lane_1']),
        };
        f = formation([entry('lane_0:front', unit('w0'))]);
      }
      const findings = validateFormation(f, ctx);
      expect(findings.map((finding) => finding.code), warningCase.id).toEqual(warningCase.expected);
    }
  });
});

describe('phase27 preset roundtrip contract', () => {
  const presetFixture = readJson('fixtures/preset-roundtrip.json') as {
    readonly presets: readonly string[];
    readonly missingPolicy: string;
    readonly substitution: boolean;
  };

  it('exposes exactly the four kinds and the skip-and-report policy', () => {
    expect(presetFixture.presets).toEqual(PRESET_KINDS);
    expect(presetFixture.missingPolicy).toBe('skip_and_report');
    expect(presetFixture.substitution).toBe(false);
  });

  it('restores without substitution and reports missing ids in stable order', () => {
    const preset = {
      kind: 'custom' as const,
      name: 'test',
      formation: formation([entry('lane_0:front', unit('i0')), entry('lane_0:middle', unit('i1')), entry('lane_1:front', unit('i2'))]),
    };
    const available = new Set(['i2']);
    const report = restorePreset(preset, available);
    expect(report.missingInstanceIds).toEqual(['i0', 'i1']);
    expect(report.formation.entries.map((e) => e.unit.instanceId)).toEqual(['i2']);
    expect(sameFormation(report.formation, formation([entry('lane_1:front', unit('i2'))]))).toBe(true);
  });
});

describe('phase27 disclosure contract', () => {
  const disclosureFixture = readJson('fixtures/prebattle-disclosure-matrix.json') as {
    readonly required: readonly string[];
    readonly missingBlocksStart: boolean;
  };

  it('pins the required items and missing-blocks-start', () => {
    expect(disclosureFixture.required).toEqual(DISCLOSURE_ITEMS);
    expect(disclosureFixture.missingBlocksStart).toBe(true);
  });

  it('missing disclosure is reported deterministically and blocks completion', () => {
    const missing = missingDisclosure({});
    expect(missing).toEqual(DISCLOSURE_ITEMS);
    expect(isDisclosureComplete({})).toBe(false);
    const partial = { enemyFormation: 'x', roles: ['melee'], objective: 'y' };
    expect(missingDisclosure(partial)).toEqual(['modifiers', 'bossPhasesOrBullets', 'hazards', 'reinforcements', 'lootPreviewPolicy']);
    expect(isDisclosureComplete(partial)).toBe(false);
    const full = Object.fromEntries(DISCLOSURE_ITEMS.map((item) => [item, true]));
    expect(isDisclosureComplete(full)).toBe(true);
  });
});

describe('phase27 atomic-start matrix', () => {
  const matrix = readJson('fixtures/atomic-start-matrix.json') as {
    readonly cases: readonly { readonly id: string; readonly invocations: number; readonly expectedCommits: number; readonly expectedBattles?: number; readonly stayOnScreen?: boolean }[];
  };

  it('pins double-start to one commit and one battle', () => {
    const doubleStart = matrix.cases.find((c) => c.id === 'double-start');
    expect(doubleStart?.invocations).toBe(2);
    expect(doubleStart?.expectedCommits).toBe(1);
    expect(doubleStart?.expectedBattles).toBe(1);
    const failure = matrix.cases.find((c) => c.id === 'save-failure');
    expect(failure?.invocations).toBe(1);
    expect(failure?.expectedCommits).toBe(0);
    expect(failure?.stayOnScreen).toBe(true);
  });

  it('double-start commits and navigates exactly once', async () => {
    const guard = new AtomicStartGuard();
    let commits = 0;
    let navigations = 0;
    const commit = (): Promise<void> => {
      commits += 1;
      return Promise.resolve();
    };
    const results = await Promise.all([
      guard.start(commit, () => {
        navigations += 1;
      }),
      guard.start(commit, () => {
        navigations += 1;
      }),
    ]);
    expect(commits).toBe(1);
    expect(navigations).toBe(1);
    expect(results).toEqual([
      { committed: true, navigated: true },
      { committed: true, navigated: true },
    ]);
  });

  it('save failure stays on screen with zero commits and unlocks', async () => {
    const guard = new AtomicStartGuard();
    let navigations = 0;
    const outcome = await guard.start(() => {
      throw new Error('save failed');
    }, () => {
      navigations += 1;
    });
    expect(outcome).toEqual({ committed: false, navigated: false });
    expect(navigations).toBe(0);
    expect(guard.pending).toBe(false);
  });
});

describe('phase27 model stable ordering', () => {
  it('orders slot ids canonically by code units', () => {
    expect(compareCodeUnits('lane_0:front', 'lane_1:front')).toBeLessThan(0);
    expect(compareCodeUnits('lane_1:front', 'lane_0:front')).toBeGreaterThan(0);
    expect(compareCodeUnits('lane_0:front', 'lane_0:front')).toBe(0);
    expect(isSlotId('lane_2:back')).toBe(true);
    expect(isSlotId('lane_9:back')).toBe(false);
    expect(isSlotId(42)).toBe(false);
  });
});
