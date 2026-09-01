import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SaveError } from '../../src/game/save/save-error.js';
import { decodeSettings } from '../../src/game/save/schema/settings-schema.js';
import { decodeProfile } from '../../src/game/save/schema/profile-save.js';
import { decodeRun } from '../../src/game/save/schema/run-save.js';
import {
  migrateSequential,
  assertNoCycle,
  type Migration,
  type Versioned,
} from '../../src/game/save/migrations/migrations.js';
import { SETTINGS_MIGRATIONS, settingsV1toV2, SETTINGS_LATEST } from '../../src/game/save/migrations/settings-migrations.js';
import type { SettingsSave } from '../../src/game/save/schema/types.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (name: string): unknown =>
  JSON.parse(readFileSync(path.join(here, '..', '..', 'contracts', 'phase24', name), 'utf8'));

function codeOf(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof SaveError ? error.code : null;
  }
}

function expectCode(fn: () => void, code: string): void {
  expect(codeOf(fn)).toBe(code);
}

const constants = read('phase24-constants.json') as {
  battleSnapshotIntervalTicks: number;
  settingsDebounceMs: number;
  textScales: readonly number[];
  saveCommitReasons: readonly string[];
  recoveryReasons: readonly string[];
};

function settingsBase(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    contentVersion: 'c1',
    simulationVersion: 's1',
    monotonicCommitId: 1,
    payloadId: 'settings_main',
    language: 'de',
    textScale: 100,
    masterVolume: 50,
    reducedMotion: false,
    ...overrides,
  };
}

describe('P24 constants', () => {
  it('pins the handbook constants', () => {
    expect(constants.battleSnapshotIntervalTicks).toBe(150);
    expect(constants.settingsDebounceMs).toBe(100);
    expect(constants.textScales).toEqual([100, 125, 150, 175, 200]);
    expect(constants.saveCommitReasons).toHaveLength(10);
    expect(constants.recoveryReasons).toHaveLength(7);
  });
});

describe('P24 settings schema', () => {
  it('decodes valid minimal and max settings', () => {
    const minimal = decodeSettings(settingsBase(), 1);
    expect(minimal.textScale).toBe(100);
    expect(minimal.language).toBe('de');
    const max = decodeSettings(settingsBase({ textScale: 200, masterVolume: 100, reducedMotion: true }), 1);
    expect(max.textScale).toBe(200);
    expect(max.masterVolume).toBe(100);
  });

  it('rejects unknown fields, missing fields and future schema', () => {
    expectCode(() => decodeSettings(settingsBase({ extra: true }), 1), 'UNKNOWN_FIELD');
    const missing = settingsBase();
    delete missing['reducedMotion'];
    expectCode(() => decodeSettings(missing, 1), 'MISSING_FIELD');
    expectCode(() => decodeSettings(settingsBase({ schemaVersion: 2 }), 1), 'FUTURE_SCHEMA');
  });

  it('rejects invalid enums, scales and ranges', () => {
    expectCode(() => decodeSettings(settingsBase({ language: 'fr' }), 1), 'INVALID_LANGUAGE');
    expectCode(() => decodeSettings(settingsBase({ textScale: 110 }), 1), 'INVALID_TEXT_SCALE');
    expectCode(() => decodeSettings(settingsBase({ masterVolume: 101 }), 1), 'INVALID_RANGE');
    expectCode(() => decodeSettings(settingsBase({ masterVolume: -1 }), 1), 'INVALID_RANGE');
  });

  it('passes the pinned fixture cases', () => {
    const cases = (read('fixtures/schema-cases.json') as {
      valid: readonly { kind: string; schemaVersion: number; textScale: number }[];
      invalid: readonly { case: string }[];
    });
    for (const valid of cases.valid) {
      expect(decodeSettings(settingsBase({ textScale: valid.textScale }), 1).textScale).toBe(valid.textScale);
    }
    const invalidKinds = cases.invalid.map((entry) => entry.case);
    expect(invalidKinds).toEqual(['unknown-field', 'missing-required', 'future-schema', 'text-scale-110']);
  });

  it('accepts every authorized text scale over 1000 deterministic samples', () => {
    for (let i = 0; i < 1000; i++) {
      const scale = [100, 125, 150, 175, 200][i % 5];
      if (scale) expect(decodeSettings(settingsBase({ textScale: scale }), 1).textScale).toBe(scale);
    }
  });
});

describe('P24 profile and run schemas', () => {
  const profileBase = (): Record<string, unknown> => ({
    schemaVersion: 1,
    contentVersion: 'c1',
    simulationVersion: 's1',
    monotonicCommitId: 1,
    payloadId: 'profile_main',
    permanentProgress: { level: 3, experience: 120 },
    inventory: { potion_heal: 2 },
    renown: 500,
    unlocks: ['unlock_alpha'],
    achievements: ['ach_01'],
    statistics: { battles_won: 4 },
    settingsRef: 'settings_main',
  });

  it('decodes a valid profile', () => {
    const profile = decodeProfile(profileBase());
    expect(profile.permanentProgress.level).toBe(3);
    expect(profile.renown).toBe(500);
    expect(profile.settingsRef).toBe('settings_main');
  });

  it('rejects invalid profile fields', () => {
    expectCode(() => decodeProfile({ ...profileBase(), extra: true }), 'UNKNOWN_FIELD');
    expectCode(() => decodeProfile({ ...profileBase(), renown: -1 }), 'INVALID_FIELD');
    expectCode(() => decodeProfile({ ...profileBase(), settingsRef: '' }), 'INVALID_REFERENCE');
    expectCode(() => decodeProfile({ ...profileBase(), permanentProgress: { level: 3 } }), 'MISSING_FIELD');
  });

  const runBase = (): Record<string, unknown> => ({
    schemaVersion: 1,
    contentVersion: 'c1',
    simulationVersion: 's1',
    monotonicCommitId: 1,
    payloadId: 'run_main',
    runMode: 'standard',
    runStatus: 'active',
    mapState: { node_1: 1 },
    loadout: ['unit_alpha'],
    loot: ['loot_x'],
    decisions: [{ nodeId: 'node_1', choiceId: 'choice_a' }],
    seedRef: '00000001-00000002-00000003-00000004',
  });

  it('decodes a valid run with and without a battle snapshot', () => {
    const run = decodeRun(runBase());
    expect(run.runStatus).toBe('active');
    expect(run.battleSnapshot).toBeUndefined();
    const withSnapshot = decodeRun({ ...runBase(), battleSnapshot: { tick: 150, snapshotRef: 'snap_150' } });
    expect(withSnapshot.battleSnapshot).toBeDefined();
    expect(withSnapshot.battleSnapshot?.tick).toBe(150);
  });

  it('rejects invalid run fields', () => {
    expectCode(() => decodeRun({ ...runBase(), runMode: 'nightmare' }), 'INVALID_ENUM');
    expectCode(() => decodeRun({ ...runBase(), runStatus: 'paused' }), 'INVALID_ENUM');
    expectCode(() => decodeRun({ ...runBase(), seedRef: '' }), 'INVALID_REFERENCE');
    expectCode(() => decodeRun({ ...runBase(), decisions: [{ nodeId: 'node_1' }] }), 'MISSING_FIELD');
  });
});

describe('P24 migrations', () => {
  it('migrates settings v1 -> v2 through the registry', () => {
    const input = decodeSettings(settingsBase(), 1);
    const result = migrateSequential(input, SETTINGS_LATEST, SETTINGS_MIGRATIONS);
    expect(result.value.schemaVersion).toBe(2);
    expect(result.value.subtitleBackdrop).toBe(false);
    expect(result.report.steps).toEqual(['1->2']);
    // Original unchanged.
    expect(input.schemaVersion).toBe(1);
  });

  it('leaves current data untouched (idempotent)', () => {
    const migrated = migrateSequential(decodeSettings(settingsBase(), 1), SETTINGS_LATEST, SETTINGS_MIGRATIONS).value;
    const again = migrateSequential(migrated, SETTINGS_LATEST, SETTINGS_MIGRATIONS);
    expect(again.value).toEqual(migrated);
    expect(again.report.steps).toEqual([]);
  });

  it('rejects future schema and registry gaps', () => {
    expectCode(() => migrateSequential({ schemaVersion: 99 } as unknown as SettingsSave, 2, SETTINGS_MIGRATIONS), 'FUTURE_SCHEMA');
    const gapRegistry = new Map<number, Migration<SettingsSave>>([[1, settingsV1toV2]]);
    expectCode(() => migrateSequential(decodeSettings(settingsBase(), 1), 3, gapRegistry), 'MIGRATION_GAP');
  });

  it('rejects a wrong edge that does not advance by one', () => {
    const bad: Migration<SettingsSave> = (input) => ({ ...input, schemaVersion: 3 });
    const registry = new Map<number, Migration<SettingsSave>>([[1, bad]]);
    expectCode(() => migrateSequential(decodeSettings(settingsBase(), 1), 2, registry), 'INVALID_MIGRATION_EDGE');
  });

  it('passes the pinned migration cases', () => {
    // The fixture exercises registry mechanics (chain, current, future, gap)
    // on bare versioned objects, so a shape-preserving test registry is used.
    const bump: Migration<Versioned> = (input) => ({ ...input, schemaVersion: input.schemaVersion + 1 });
    // Only edge 1 exists: migrating 1->3 must hit the missing edge 2 (GAP).
    const mechanics: ReadonlyMap<number, Migration<Versioned>> = new Map([[1, bump]]);
    const cases = (read('fixtures/migration-cases.json') as {
      cases: readonly { from: number; to: number; missingEdge?: number; expect: string }[];
    });
    for (const entry of cases.cases) {
      if (entry.expect === 'FUTURE_SCHEMA') {
        expectCode(() => migrateSequential({ schemaVersion: entry.from }, entry.to, mechanics), 'FUTURE_SCHEMA');
      } else if (entry.expect === 'MIGRATION_GAP') {
        expectCode(() => migrateSequential({ schemaVersion: entry.from }, entry.to, mechanics), 'MIGRATION_GAP');
      } else if (entry.expect === 'current') {
        const result = migrateSequential({ schemaVersion: entry.from }, entry.to, mechanics);
        expect(result.value.schemaVersion).toBe(entry.to);
        expect(result.report.steps).toEqual([]);
      } else {
        const result = migrateSequential({ schemaVersion: entry.from }, entry.to, mechanics);
        expect(result.value.schemaVersion).toBe(entry.to);
      }
    }
  });

  it('asserts the registry has no gaps or cycles', () => {
    expect(() => {
      assertNoCycle(SETTINGS_MIGRATIONS, SETTINGS_LATEST);
    }).not.toThrow();
  });
});
