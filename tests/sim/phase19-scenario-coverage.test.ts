import { describe, expect, it } from 'vitest';
import { KernelInvariantError } from '../../src/game/sim/core/invariant-error.js';
import { scenario, type ScenarioEntitySpec } from '../../src/game/sim/ability/battle-scenario.js';
import { buildCoverageReport, REQUIRED_ABILITY_CASES, type CoverageEntry } from '../../src/game/sim/ability/ability-coverage.js';
import type { StatusInstance } from '../../src/game/sim/status/status-instance.js';

const entitySpec = (id: string, overrides: Partial<ScenarioEntitySpec> = {}): ScenarioEntitySpec => ({
  id,
  side: 'enemy',
  lane: 'middle',
  x100: 2000,
  maxLp: 1000,
  lp: 800,
  shield: 0,
  origin: 'regular',
  ...overrides,
});

const status: StatusInstance = Object.freeze({
  statusId: 'status_1',
  kind: 'burn',
  polarity: 'negative',
  targetId: 'enemy_1',
  sourceId: 'source',
  effectId: 'effect_1',
  startTick: 0,
  endTick: 10,
  strength: 5,
  stackGroup: 'burn_stack',
  sequence: 0,
  stackPolicy: 'refresh_duration',
  maxStacks: 1,
  flags: Object.freeze([]),
});

describe('P19-T06 scenario builder — no hidden defaults', () => {
  it('builds a complete scenario when all fields are explicit', () => {
    const built = scenario()
      .forAbility('ability_fireball')
      .atTick(10)
      .withEntities([entitySpec('enemy_1')])
      .withStatuses([status])
      .withNoAbilityInstances()
      .expectEvents(['AbilityCastStarted'])
      .expectCommandKinds(['apply_lp_delta'])
      .build();
    expect(built.abilityId).toBe('ability_fireball');
    expect(built.tick).toBe(10);
    expect(built.entities).toHaveLength(1);
  });

  it('rejects an incomplete build, naming the missing fields', () => {
    expect(() => {
      scenario().forAbility('ability_fireball').build();
    }).toThrow(KernelInvariantError);
  });

  it('validates entity specs (bad lane, lp-over-max, bad origin)', () => {
    expect(() => {
      scenario().withEntities([entitySpec('e1', { lane: 'sideways' as never })]);
    }).toThrow(KernelInvariantError);
    expect(() => {
      scenario().withEntities([entitySpec('e1', { lp: 1200 })]);
    }).toThrow(KernelInvariantError);
    expect(() => {
      scenario().withEntities([entitySpec('e1', { origin: 'ghost' as never })]);
    }).toThrow(KernelInvariantError);
  });
});

describe('P19-T06 coverage inventory', () => {
  const covered = Object.freeze([...REQUIRED_ABILITY_CASES]);

  it('reports fully covered only when every case is present and no blocker', () => {
    const entry: CoverageEntry = { abilityId: 'ability_fireball', status: 'covered', coveredCases: covered, blocker: null };
    expect(buildCoverageReport([entry]).fullyCovered).toBe(true);
  });

  it('reports gaps for missing cases', () => {
    const entry: CoverageEntry = { abilityId: 'ability_ice', status: 'active', coveredCases: ['positive_trigger'], blocker: null };
    const report = buildCoverageReport([entry]);
    expect(report.fullyCovered).toBe(false);
    expect(report.gaps[0]?.missingCases.length).toBe(REQUIRED_ABILITY_CASES.length - 1);
  });

  it('reports blockers', () => {
    const entry: CoverageEntry = { abilityId: 'ability_taunt', status: 'blocked', coveredCases: [], blocker: 'no_authorized_port' };
    const report = buildCoverageReport([entry]);
    expect(report.fullyCovered).toBe(false);
    expect(report.blockers).toContain('no_authorized_port');
  });

  it('rejects duplicate ability ids, unknown cases, blocked-without-blocker', () => {
    expect(() => {
      buildCoverageReport([
        { abilityId: 'ability_a', status: 'covered', coveredCases: covered, blocker: null },
        { abilityId: 'ability_a', status: 'planned', coveredCases: [], blocker: null },
      ]);
    }).toThrow(KernelInvariantError);
    expect(() => {
      buildCoverageReport([{ abilityId: 'ability_a', status: 'planned', coveredCases: ['nope' as never], blocker: null }]);
    }).toThrow(KernelInvariantError);
    expect(() => {
      buildCoverageReport([{ abilityId: 'ability_a', status: 'blocked', coveredCases: [], blocker: null }]);
    }).toThrow(KernelInvariantError);
  });
});
