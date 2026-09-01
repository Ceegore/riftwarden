import { describe, expect, it } from 'vitest';
import { KernelInvariantError } from '../../src/game/sim/core/invariant-error.js';
import { createSnapshot, verifySnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { migrateBattleModel, SIM_VERSION_PHASE15 } from '../../src/game/sim/core/migrate.js';
import { createModifierCollection } from '../../src/game/sim/world/modifier-system.js';
import { createHazardCollection } from '../../src/game/sim/world/hazard-system.js';
import { createObjectiveCollection } from '../../src/game/sim/objectives/combat-objective.js';
import type { BossPhaseSnapshot } from '../../src/game/sim/boss/boss-phase-system.js';
import type { ModifierDefinition } from '../../src/game/sim/world/modifier-system.js';
import type { Hazard } from '../../src/game/sim/world/hazard-system.js';
import type { Objective } from '../../src/game/sim/objectives/combat-objective.js';
import { battle, entity } from './test-helpers.js';

const modifier = (id: string): ModifierDefinition => Object.freeze({
  id, previewKey: `preview_${id}`, hooks: Object.freeze(['on_battle_start'] as const), incompatibilityTags: Object.freeze([]), params: Object.freeze({}),
});

const hazard = (id: string): Hazard => Object.freeze({
  id, scheduledTick: 10, telegraphTicks: 30, resolveTick: 40, expired: false, form: 'circle', edgePattern: 'edge_dashed', shapeSymbol: 'symbol_skull',
});

const objective = (id: string, kind: Objective['kind'] = 'kill_regulars'): Objective => Object.freeze({
  id, kind, targetId: null, required: 3, progress: 0, complete: false,
});

const bossPhase = (overrides: Partial<BossPhaseSnapshot> = {}): BossPhaseSnapshot => Object.freeze({
  entityId: 'boss_ash_unit',
  bossId: 'boss_ash',
  phaseId: 'p1',
  transition: null,
  visited: Object.freeze(['p1']),
  invulnerableUntilTick: null,
  ...overrides,
});

describe('P21 §7/§8 canonical collections', () => {
  it('sorts modifiers canonically by id (permutation-stable)', () => {
    expect(createModifierCollection([modifier('mod_b'), modifier('mod_a')]).map((m) => m.id)).toEqual(['mod_a', 'mod_b']);
  });

  it('rejects duplicate modifier ids', () => {
    expect(() => createModifierCollection([modifier('mod_a'), modifier('mod_a')])).toThrow(KernelInvariantError);
  });

  it('sorts hazards canonically by id', () => {
    expect(createHazardCollection([hazard('hazard_b'), hazard('hazard_a')]).map((h) => h.id)).toEqual(['hazard_a', 'hazard_b']);
  });

  it('rejects duplicate hazard ids', () => {
    expect(() => createHazardCollection([hazard('hazard_a'), hazard('hazard_a')])).toThrow(KernelInvariantError);
  });

  it('sorts objectives canonically by id', () => {
    expect(createObjectiveCollection([objective('obj_b'), objective('obj_a')]).map((o) => o.id)).toEqual(['obj_a', 'obj_b']);
  });

  it('rejects duplicate objective ids', () => {
    expect(() => createObjectiveCollection([objective('obj_a'), objective('obj_a')])).toThrow(KernelInvariantError);
  });
});

describe('P21 snapshot projection', () => {
  it('hashes bossPhase permutation-stably (visited sorted) and verifies symmetrically', () => {
    const a = bossPhase({ visited: Object.freeze(['p2', 'p1', 'p3']) });
    const b = bossPhase({ visited: Object.freeze(['p3', 'p1', 'p2']) });
    const s1 = createSnapshot(battle({ bossPhase: a }));
    const s2 = createSnapshot(battle({ bossPhase: b }));
    expect(s1.checksum).toBe(s2.checksum);
    expect(verifySnapshot(s1)).toBe(true);
  });

  it('hashes modifier/hazard/objective/spawnedWaves permutation-stably', () => {
    const s1 = createSnapshot(battle({
      modifiers: Object.freeze([modifier('mod_b'), modifier('mod_a')]),
      hazards: Object.freeze([hazard('hazard_b'), hazard('hazard_a')]),
      objectives: Object.freeze([objective('obj_b'), objective('obj_a')]),
      spawnedWaves: Object.freeze(['wave_b', 'wave_a']),
    }));
    const s2 = createSnapshot(battle({
      modifiers: Object.freeze([modifier('mod_a'), modifier('mod_b')]),
      hazards: Object.freeze([hazard('hazard_a'), hazard('hazard_b')]),
      objectives: Object.freeze([objective('obj_a'), objective('obj_b')]),
      spawnedWaves: Object.freeze(['wave_a', 'wave_b']),
    }));
    expect(s1.checksum).toBe(s2.checksum);
    expect(verifySnapshot(s2)).toBe(true);
  });

  it('hashes different objective progress differently', () => {
    const s1 = createSnapshot(battle({ objectives: Object.freeze([objective('obj_a')]) }));
    const s2 = createSnapshot(battle({ objectives: Object.freeze([{ ...objective('obj_a'), progress: 1 }]) }));
    expect(s1.checksum).not.toBe(s2.checksum);
  });
});

describe('P21 migration', () => {
  it('leaves Phase 21 fields undefined on migrated Phase 14/15 saves', () => {
    const state = battle({ entities: Object.freeze([entity('entity_alpha')]) });
    const migrated = migrateBattleModel({ state, radiiX100: { entity_alpha: 100 } });
    expect(migrated.simulationVersion).toBe(SIM_VERSION_PHASE15);
    expect(migrated.bossPhase).toBeUndefined();
    expect(migrated.modifiers).toBeUndefined();
    expect(migrated.hazards).toBeUndefined();
    expect(migrated.objectives).toBeUndefined();
    expect(migrated.spawnedWaves).toBeUndefined();
  });
});
