import { describe, expect, it } from 'vitest';
import { catchProfileCode, readJson } from './phase31-helpers.js';
import { deriveStat } from '../../src/game/profile/derived-stats.js';
import { COPY_LIMIT_PER_TROOP_TYPE, HERO_LEVEL_MAX, HERO_LEVEL_MIN, CONTRACT_LEVEL_MAX, CONTRACT_LEVEL_MIN } from '../../src/game/profile/profile-validator.js';
import { KILL_POINT_ORDER, KILL_RECORDS } from '../../src/game/profile/transaction-flow.js';
import { PROFILE_REVISION, TRANSACTION_KINDS } from '../../src/game/profile/types.js';

describe('phase31 constants contract', () => {
  const constants = readJson('phase31-constants.json') as {
    readonly heroCount: number;
    readonly troopTypeCount: number;
    readonly itemCount: number;
    readonly bannerCount: number;
    readonly heroLevelMin: number;
    readonly heroLevelMax: number;
    readonly contractLevelMin: number;
    readonly contractLevelMax: number;
    readonly copyLimitPerTroopType: number;
    readonly activeBannerLimit: number;
    readonly currencyMin: number;
    readonly masteryDetailPhase: number;
  };

  it('pins the release-count and limit constants', () => {
    expect(constants.heroCount).toBe(10);
    expect(constants.troopTypeCount).toBe(18);
    expect(constants.itemCount).toBe(42);
    expect(constants.bannerCount).toBe(6);
    expect(constants.heroLevelMin).toBe(1);
    expect(constants.heroLevelMax).toBe(3);
    expect(constants.contractLevelMin).toBe(1);
    expect(constants.contractLevelMax).toBe(3);
    expect(constants.copyLimitPerTroopType).toBe(3);
    expect(constants.activeBannerLimit).toBe(1);
    expect(constants.currencyMin).toBe(0);
    expect(constants.masteryDetailPhase).toBe(35);
  });

  it('aligns validator limits with the constants', () => {
    expect(HERO_LEVEL_MIN).toBe(constants.heroLevelMin);
    expect(HERO_LEVEL_MAX).toBe(constants.heroLevelMax);
    expect(CONTRACT_LEVEL_MIN).toBe(constants.contractLevelMin);
    expect(CONTRACT_LEVEL_MAX).toBe(constants.contractLevelMax);
    expect(COPY_LIMIT_PER_TROOP_TYPE).toBe(constants.copyLimitPerTroopType);
  });

  it('pins the profile revision and nine transaction kinds', () => {
    expect(PROFILE_REVISION).toBe(31);
    expect(TRANSACTION_KINDS).toEqual(['BUY_COPY', 'BUY_CONTRACT', 'EQUIP', 'REMOVE', 'POLISH', 'SET_BANNER', 'SET_KIT', 'CREDIT_GOLD', 'GRANT_ITEM']);
  });
});

describe('phase31 screen matrix', () => {
  const screens = readJson('fixtures/screen-matrix.json') as Record<string, string>;

  it('pins the ten S15–S24 screens', () => {
    expect(screens['S15']).toBe('Hero Hall');
    expect(screens['S16']).toBe('Hero Detail');
    expect(screens['S17']).toBe('Equipment Picker');
    expect(screens['S18']).toBe('Mastery safe handoff');
    expect(screens['S19']).toBe('Barracks');
    expect(screens['S20']).toBe('Troop Detail');
    expect(screens['S21']).toBe('Kit Picker');
    expect(screens['S22']).toBe('Workshop');
    expect(screens['S23']).toBe('Item Detail');
    expect(screens['S24']).toBe('Banner Picker');
    expect(Object.keys(screens)).toHaveLength(10);
  });
});

describe('phase31 kill-point matrix', () => {
  const matrix = readJson('fixtures/kill-point-matrix.json') as readonly {
    readonly point: string;
    readonly mutation: string;
  }[];

  it('pins the five kill points with mutation semantics', () => {
    expect(matrix.map((row) => row.point)).toEqual(KILL_POINT_ORDER);
    expect(matrix[0]).toEqual({ point: 'before-preview', mutation: false });
    expect(matrix[2]).toEqual({ point: 'during-save-temp-write', mutation: 'old_or_new_never_partial' });
    expect(matrix[3]).toEqual({ point: 'after-commit-before-feedback', mutation: 'committed_once' });
    expect(matrix[4]).toEqual({ point: 'duplicate-callback', mutation: 'committed_once' });
    expect(KILL_RECORDS).toHaveLength(5);
  });

  it('maps every pinned point to its mutation record', () => {
    for (const row of matrix) {
      const record = KILL_RECORDS.find((entry) => entry.point === row.point);
      expect(record).toBeDefined();
      if (record !== undefined) {
        expect(['none', 'old_or_new_never_partial', 'committed_once']).toContain(record.mutation);
      }
    }
  });
});

describe('phase31 derived-stat cases', () => {
  const cases = readJson('fixtures/derived-stat-cases.json') as readonly {
    readonly base: number;
    readonly levelPermille: number;
    readonly equipmentFlat: number;
    readonly otherPermille: number;
    readonly expected: number;
  }[];

  it('reproduces the pinned derivations exactly', () => {
    expect(cases).toHaveLength(2);
    for (const row of cases) {
      const got = deriveStat({
        base: row.base,
        levelPermille: row.levelPermille,
        equipmentFlat: row.equipmentFlat,
        otherPermille: row.otherPermille,
      });
      expect(got).toBe(row.expected);
    }
  });

  it('derivation order is level then equipment then other', () => {
    // base 100, level 120% = 120, equipment +15 = 135, other 110% floor = 148
    expect(deriveStat({ base: 100, levelPermille: 1200, equipmentFlat: 15, otherPermille: 1100 })).toBe(148);
    // single rounding at each stage: floor(1*1000/1000)=1, +0, floor(1*1000/1000)=1
    expect(deriveStat({ base: 1, levelPermille: 1000, equipmentFlat: 0, otherPermille: 1000 })).toBe(1);
  });

  it('rejects negative or fractional inputs', () => {
    expect(catchProfileCode(() => deriveStat({ base: -1, levelPermille: 1000, equipmentFlat: 0, otherPermille: 1000 }))).toBeNull();
    expect(() => deriveStat({ base: -1, levelPermille: 1000, equipmentFlat: 0, otherPermille: 1000 })).toThrow(/non-negative/);
    expect(() => deriveStat({ base: 10, levelPermille: 1000, equipmentFlat: 1.5, otherPermille: 1000 })).toThrow(/non-negative/);
  });
});
