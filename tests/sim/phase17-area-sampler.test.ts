import { describe, expect, it } from 'vitest';
import { sampleAreaTargets, validateAoEShape, aoeCoverReductionBps } from '../../src/game/sim/combat/area-sampler.js';
import { stepBattle as stepBattleImport } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity as migrateImport } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems as createPhase17SystemsImport } from '../../src/game/sim/core/phase17-systems.js';
import { battle as battleImport, entity, randomSession as randomSessionImport } from './test-helpers.js';
import type { KernelEntity } from '../../src/game/sim/core/entity.js';
import { asX100 } from '../../src/game/sim/geometry/x100.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';

const inputConst: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

function unit(id: string, x100: number, lane: 'top' | 'middle' | 'bottom', radiusX100 = 100, side: 'player' | 'enemy' = 'enemy'): KernelEntity {
  return Object.freeze({ ...entity(id, { side, lane, x100 }), radiusX100 });
}

describe('P17 T03 AoE hit sampling', () => {
  it('point shape hits targets whose circle touches the boundary inclusive', () => {
    const targets = [
      unit('unit_a', 2200, 'middle'), // edge distance 0 (2200-100-100-2000 = 0)
      unit('unit_b', 2050, 'middle'), // inside the boundary (2050 < 2100)
      unit('unit_c', 2000, 'top'),    // wrong lane
      unit('unit_d', 2400, 'middle'), // beyond (2400-100-100-2000 = 200)
    ];
    const hits = sampleAreaTargets({ kind: 'point', x100: asX100(2000), lane: 'middle', radiusX100: asX100(100) }, targets, 'player');
    expect(hits.map((h) => h.id)).toEqual(['unit_a', 'unit_b']);
  });

  it('radius shape honors the explicit lane mask', () => {
    const targets = [
      unit('unit_a', 2000, 'top'),
      unit('unit_b', 2000, 'middle'),
      unit('unit_c', 2000, 'bottom'),
    ];
    const hits = sampleAreaTargets({ kind: 'radius', x100: asX100(2000), radiusX100: asX100(100), laneMask: ['top', 'bottom'] }, targets, 'player');
    expect(hits.map((h) => h.id)).toEqual(['unit_a', 'unit_c']);
  });

  it('line shape hits targets touching the capsule', () => {
    const targets = [
      unit('unit_a', 1500, 'middle'), // 500 from segment start: 500-100-100 = 300 > 0: miss
      unit('unit_b', 2000, 'middle'), // on the segment: hit
      unit('unit_c', 2700, 'middle'), // 200 past the end: 200-100-100 = 0: boundary hit
      unit('unit_d', 2800, 'middle'), // 300 past: 300-100-100 = 100 > 0: miss
    ];
    const hits = sampleAreaTargets({ kind: 'line', fromX100: asX100(2000), toX100: asX100(2500), lane: 'middle', widthX100: asX100(200) }, targets, 'player');
    expect(hits.map((h) => h.id)).toEqual(['unit_b', 'unit_c']);
  });

  it('line width is inclusive at the boundary', () => {
    const targets = [unit('unit_a', 1800, 'middle'), unit('unit_b', 2800, 'middle')];
    // width 200 → halfWidth 100; center distance 200-100-100 = 0 at x=1800 → hit.
    const hits = sampleAreaTargets({ kind: 'line', fromX100: asX100(2000), toX100: asX100(2500), lane: 'middle', widthX100: asX100(200) }, targets, 'player');
    expect(hits.map((h) => h.id)).toEqual(['unit_a']);
  });

  it('stable-sorts output by entity id', () => {
    const targets = [unit('unit_zeta', 2000, 'middle'), unit('unit_alpha', 2000, 'middle'), unit('unit_mid', 2000, 'middle')];
    const hits = sampleAreaTargets({ kind: 'point', x100: asX100(2000), lane: 'middle', radiusX100: asX100(100) }, targets, 'player');
    expect(hits.map((h) => h.id)).toEqual(['unit_alpha', 'unit_mid', 'unit_zeta']);
  });

  it('excludes the source side and non-ACTIVE entities', () => {
    const ally = unit('unit_friend', 2000, 'middle', 100, 'player');
    const dead = Object.freeze({ ...unit('unit_dead', 2000, 'middle'), phase: Object.freeze({ phase: 'DEFEATED', enteredTick: 0, controlledReturn: null }) }) as KernelEntity;
    const enemy = unit('unit_enemy', 2000, 'middle');
    const hits = sampleAreaTargets({ kind: 'point', x100: asX100(2000), lane: 'middle', radiusX100: asX100(100) }, [ally, dead, enemy], 'player');
    expect(hits.map((h) => h.id)).toEqual(['unit_enemy']);
  });

  it('cover never invalidates a target', () => {
    const targets = [unit('unit_a', 2000, 'middle')];
    const hits = sampleAreaTargets({ kind: 'point', x100: asX100(2000), lane: 'middle', radiusX100: asX100(100) }, targets, 'player');
    expect(hits.map((h) => h.id)).toEqual(['unit_a']);
  });

  it('rejects an empty or duplicate lane mask', () => {
    expect(() => { validateAoEShape({ kind: 'radius', x100: asX100(2000), radiusX100: asX100(100), laneMask: [] }); }).toThrow();
    expect(() => { validateAoEShape({ kind: 'radius', x100: asX100(2000), radiusX100: asX100(100), laneMask: ['top', 'top'] }); }).toThrow();
  });

  it('rejects a degenerate line', () => {
    expect(() => { validateAoEShape({ kind: 'line', fromX100: asX100(2000), toX100: asX100(2000), lane: 'middle', widthX100: asX100(0) }); }).toThrow();
  });

  it('rejects an unknown lane', () => {
    expect(() => { validateAoEShape({ kind: 'point', x100: asX100(2000), lane: 'diagonal' as 'top', radiusX100: asX100(100) }); }).toThrow();
  });

  it('magic-area cover reduction is zero', () => {
    expect(aoeCoverReductionBps()).toBe(0);
  });
});

describe('P17 T03 AoE integration (stage G direct hit with a shape)', () => {
  it('a shaped direct hit damages every boundary target exactly once', () => {
    const attacker = migrateImport({ entity: entity('unit_attacker', { side: 'player', x100: 1000 }), radiusX100: 100 });
    const victims = [
      migrateImport({ entity: entity('unit_v1', { side: 'enemy', x100: 2000 }), radiusX100: 100 }),
      migrateImport({ entity: entity('unit_v2', { side: 'enemy', x100: 2050 }), radiusX100: 100 }),
      migrateImport({ entity: entity('unit_far', { side: 'enemy', x100: 2600 }), radiusX100: 100 }),
      migrateImport({ entity: entity('unit_ally', { side: 'player', x100: 2000 }), radiusX100: 100 }),
    ];
    const systems = createPhase17SystemsImport({
      speedsX100PerSecond: {},
      basicAttack: {
        parameters: {
          unit_attacker: {
            attackIntervalTicks: 40,
            prepareTicks: 0,
            recoveryTicks: 1,
            preferredRangeX100: asX100(9000),
            delivery: {
              kind: 'direct',
              rawAmount: 50,
              damageTypeOrdinal: 0,
              defense: 0,
              aoeShape: { kind: 'point', x100: asX100(2000), lane: 'middle', radiusX100: asX100(100) },
            },
          },
        },
      },
    });
    let state = battleImport({ simulationVersion: 'phase17-fixture-v1', entities: [attacker, ...victims] });
    const random = randomSessionImport();
    const damageTargets = new Map<string, number>();
    for (let i = 0; i < 3; i++) {
      const r = stepBattleImport({ state, input: inputConst, random, rules: {}, content: {}, systems });
      state = r.state;
      for (const e of r.events) {
        if (e.type !== 'DamageApplied') continue;
        for (const id of e.targetIds) damageTargets.set(id, (damageTargets.get(id) ?? 0) + 1);
      }
    }
    // unit_v1 and unit_v2 touched the boundary; unit_far and the ally did not.
    expect(damageTargets.get('unit_v1')).toBe(1);
    expect(damageTargets.get('unit_v2')).toBe(1);
    expect(damageTargets.has('unit_far')).toBe(false);
    expect(damageTargets.has('unit_ally')).toBe(false);
  });
});
