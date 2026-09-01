import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TECHNICAL_RULES } from '../../src/game/rules/technical-rules';
import { DEFENSE_MIN, DEFENSE_MAX, DEFAULT_BOSS_TRUE_DAMAGE_CAP_BPS } from '../../src/game/sim/math/combat-formulas';
import { minimumAttackIntervalTicks, clampMovementX100PerSecond, controlDurationTicks } from '../../src/game/sim/math/time-and-speed';
import { tick, basisPoints } from '../../src/game/rules/units';

const here = path.dirname(fileURLToPath(import.meta.url));
interface FormulaSnapshot {
  simulationTicksPerSecond: number;
  basisPointsScale: number;
  milliValueScale: number;
  defenseMin: number;
  defenseMax: number;
  trueDamageBossHitCapBps: number;
  minimumSuccessfulDamage: number;
  attackIntervalMinSeconds: string;
  attackIntervalMinTicks: number;
  movementMinX100PerSecond: number;
  movementMaxX100PerSecond: number;
  bossHardControlCapSeconds: string;
  bossHardControlCapTicks: number;
  secondsWarningThreshold: string;
}
const snapshot = JSON.parse(
  readFileSync(path.join(here, '..', '..', 'contracts', 'math', 'formula-constants.snapshot.json'), 'utf8'),
) as FormulaSnapshot;

describe('formula constants match the snapshot contract', () => {
  it('ticks per second and scales come from the rule source', () => {
    expect(TECHNICAL_RULES.simulationTicksPerSecond).toBe(snapshot.simulationTicksPerSecond);
    expect(TECHNICAL_RULES.basisPointsScale).toBe(snapshot.basisPointsScale);
    expect(TECHNICAL_RULES.milliValueScale).toBe(snapshot.milliValueScale);
  });
  it('defense clamp bounds', () => {
    expect(DEFENSE_MIN).toBe(snapshot.defenseMin);
    expect(DEFENSE_MAX).toBe(snapshot.defenseMax);
  });
  it('true damage boss cap', () => {
    expect(DEFAULT_BOSS_TRUE_DAMAGE_CAP_BPS).toBe(snapshot.trueDamageBossHitCapBps);
  });
  it('attack interval minimum', () => {
    expect(minimumAttackIntervalTicks()).toBe(snapshot.attackIntervalMinTicks);
  });
  it('movement bounds', () => {
    expect(clampMovementX100PerSecond(0)).toBe(snapshot.movementMinX100PerSecond);
    expect(clampMovementX100PerSecond(9999)).toBe(snapshot.movementMaxX100PerSecond);
  });
  it('boss hard control cap', () => {
    expect(controlDurationTicks(tick(999), basisPoints(0), true)).toBe(snapshot.bossHardControlCapTicks);
  });
});
