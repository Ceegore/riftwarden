import { describe, expect, it } from 'vitest';
import { advanceTo, allowedTails, isRoute, nextRoute, ROUTE_ORDER } from '../../src/game/slice/route-machine.js';
import { ROUTES } from '../../src/game/slice/types.js';
import { catchSliceCode, readJson } from './phase29-helpers.js';

describe('phase29 constants contract', () => {
  const constants = readJson('phase29-constants.json') as {
    readonly phase: number;
    readonly heroes: number;
    readonly troops: number;
    readonly battleSnapshotIntervalTicks: number;
    readonly speedMultipliersX10: readonly number[];
    readonly criticalRepeatCount: number;
    readonly maxMaintainedFileLines: number;
    readonly warningFileLines: number;
  };

  it('pins the vertical slice constants', () => {
    expect(constants.phase).toBe(29);
    expect(constants.heroes).toBe(4);
    expect(constants.troops).toBe(6);
    expect(constants.battleSnapshotIntervalTicks).toBe(150);
    expect(constants.speedMultipliersX10).toEqual([5, 10, 20, 30]);
    expect(constants.criticalRepeatCount).toBe(10);
    expect(constants.maxMaintainedFileLines).toBe(500);
    expect(constants.warningFileLines).toBe(300);
  });
});

describe('phase29 e2e route matrix', () => {
  const matrix = readJson('fixtures/e2e-route-matrix.json') as { readonly routes: readonly string[]; readonly cases: readonly string[] };

  it('pins the twelve closed routes in order', () => {
    expect(matrix.routes).toEqual(ROUTES);
    expect(ROUTE_ORDER).toEqual(ROUTES);
    expect(isRoute('BATTLE')).toBe(true);
    expect(isRoute('STORE')).toBe(false);
  });

  it('pins the eight E2E cases', () => {
    expect(matrix.cases).toEqual(['FRESH', 'WIN', 'LOSS', 'RETRY', 'RETREAT', 'RESUME_NODE', 'RESUME_BATTLE', 'PROCESS_KILL']);
  });

  it('advances only one step at a time through the closed order', () => {
    expect(nextRoute('TITLE')).toBe('HQ');
    expect(nextRoute('FORMATION')).toBe('DUNGEON_MAP');
    expect(nextRoute('MISSION_END')).toBe('MISSION_END');
    expect(advanceTo('DUNGEON_MAP', 'NODE_PREVIEW')).toBe('NODE_PREVIEW');
    expect(catchSliceCode(() => advanceTo('DUNGEON_MAP', 'PREBATTLE'))).toBe('INVALID_ROUTE_TRANSITION');
    expect(catchSliceCode(() => nextRoute('STORE' as never))).toBe('INVALID_ROUTE_TRANSITION');
  });

  it('exposes allowed tails without mutating the order', () => {
    expect(allowedTails('GROUP')).toEqual(['FORMATION', 'DUNGEON_MAP', 'NODE_PREVIEW', 'PREBATTLE', 'BATTLE', 'RESULT', 'REWARD_OR_ANCHOR', 'MISSION_END']);
    expect(allowedTails('MISSION_END')).toEqual([]);
  });
});

describe('phase29 golden seeds fixture', () => {
  const fixture = readJson('fixtures/golden-seeds.json') as { readonly seeds: readonly string[]; readonly speedsX10: readonly number[]; readonly qualities: readonly string[] };

  it('pins three seeds across four speeds and four qualities', () => {
    expect(fixture.seeds).toEqual(['ASHKING_GOLDEN_01', 'ASHKING_GOLDEN_02', 'ASHKING_GOLDEN_03']);
    expect(fixture.speedsX10).toEqual([5, 10, 20, 30]);
    expect(fixture.qualities).toEqual(['LOW', 'REDUCED', 'STANDARD', 'HIGH']);
  });
});

describe('phase29 kill-point matrix', () => {
  const fixture = readJson('fixtures/kill-point-matrix.json') as { readonly points: readonly string[]; readonly repetitions: number };

  it('pins the eight kill boundaries and ten repetitions', () => {
    expect(fixture.points).toEqual([
      'CAST_START',
      'CAST_RESOLVE',
      'PROJECTILE_SPAWN',
      'PROJECTILE_IMPACT',
      'BOSS_PHASE_CHANGE',
      'SUMMON_SPAWN',
      'RESULT_CREATED',
      'REWARD_COMMIT',
    ]);
    expect(fixture.repetitions).toBe(10);
  });
});

describe('phase29 device and accessibility matrices', () => {
  it('pins the device evidence tiers', () => {
    const device = readJson('fixtures/device-matrix.json') as { readonly android: readonly string[]; readonly ios: readonly string[]; readonly runs: readonly string[] };
    expect(device.android).toEqual(['MINIMUM_DEVICE', 'TARGET_DEVICE']);
    expect(device.runs).toEqual(['COLD_LOAD', 'WARM_LOAD', 'THIRTY_MINUTE_REPEAT']);
  });

  it('pins the accessibility requirements', () => {
    const a11y = readJson('fixtures/accessibility-matrix.json') as {
      readonly inputs: readonly string[];
      readonly textScalePercent: readonly number[];
      readonly requirements: readonly string[];
    };
    expect(a11y.inputs).toEqual(['TOUCH', 'KEYBOARD', 'GAMEPAD', 'TALKBACK', 'VOICEOVER']);
    expect(a11y.textScalePercent).toEqual([100, 200]);
    expect(a11y.requirements).toEqual(['NO_COLOR_ONLY', 'NO_AUDIO_ONLY', 'NO_CANVAS_ONLY', 'FOCUS_ORDER']);
  });
});
