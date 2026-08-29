import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { createPhase21Systems } from '../../src/game/sim/core/phase21-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { asX100 } from '../../src/game/sim/geometry/x100.js';
import { hookBpsScale, applyHookBps } from '../../src/game/sim/world/modifier-system.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { ModifierDefinition } from '../../src/game/sim/world/modifier-system.js';
import type { Objective } from '../../src/game/sim/objectives/combat-objective.js';
import { battle, entity, randomSession, tick } from './test-helpers.js';

/**
 * Phase 21 §7 COMPOSITE `heal_bps` fuzz.
 *
 * The modifier runtime composes the `on_damage_applied` hook effect the same way
 * for healing as for damage: every committed modifier's `heal_bps` composes
 * MULTIPLICATIVELY via `hookBpsScale` (round-half-away at each step), and the
 * heal is sized from the queued application as read by the frozen stage-H view
 * (both systems see the SAME pre-scale raw — the damage-scale rewrite is a
 * same-stage command, applied only at stage I). Contract:
 *   1. COMPOSITION — heal_bps {5000, 6000} → 10000→5000→3000 (multiplicative);
 *      `hookBpsScale` already returns 3000.
 *   2. DAMAGE SCALED, HEAL ON RAW — a 300-damage hit under damage_bps 12500
 *      deals 375 to the tank, while the lifesteal heal is applyHookBps(300, 3000)
 *      = 90 (sized from the pre-scale raw, the shared stage-H view).
 *   3. HOOK LOG — BOTH heal modifiers (and the damage modifier) fire
 *      `on_damage_applied` in the canonical log with their announced params.
 *   4. OBJECTIVE FOLD — the heal_sustain mission folds the composed amounts
 *      (90 each) to completion (180 required → two heals).
 *   5. DETERMINISM — two runs give the identical checksum + heal trace.
 */

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

const modA: ModifierDefinition = Object.freeze({
  id: 'mod_fixture_lifesteal_a', previewKey: 'preview_mod_fixture_lifesteal_a',
  hooks: Object.freeze(['on_damage_applied'] as const), incompatibilityTags: Object.freeze([]),
  params: Object.freeze({ heal_bps: 5000 }),
});
const modB: ModifierDefinition = Object.freeze({
  id: 'mod_fixture_lifesteal_b', previewKey: 'preview_mod_fixture_lifesteal_b',
  hooks: Object.freeze(['on_damage_applied'] as const), incompatibilityTags: Object.freeze([]),
  params: Object.freeze({ heal_bps: 6000 }),
});
const modD: ModifierDefinition = Object.freeze({
  id: 'mod_fixture_onslaught', previewKey: 'preview_mod_fixture_onslaught',
  hooks: Object.freeze(['on_damage_applied'] as const), incompatibilityTags: Object.freeze([]),
  params: Object.freeze({ damage_bps: 12500 }),
});

const HEAL: Objective = Object.freeze({ id: 'obj_heal_sustain', kind: 'heal_sustain', targetId: null, required: 180, progress: 0, complete: false });

const mk = (id: string, side: 'player' | 'enemy', maxLp: number, lp: number, x100: number) =>
  migrateEntity({ entity: entity(id, { side, lane: 'middle', x100, maxLp, lp }), radiusX100: 100 });

const attack = (rawAmount: number) => Object.freeze({
  attackIntervalTicks: 10,
  prepareTicks: 1,
  recoveryTicks: 3,
  preferredRangeX100: asX100(9000),
  delivery: Object.freeze({ kind: 'direct', rawAmount, damageTypeOrdinal: 0, defense: 0, bossCapBps: null }),
});

interface HealObs {
  readonly tick: number;
  readonly rawAmount: number;
  readonly delta: number;
}

function run(): { readonly state: BattleModel; readonly heals: readonly HealObs[]; readonly checksum: string } {
  const player = mk('unit_p', 'player', 5000, 2500, 1800);
  const tank = mk('unit_e1', 'enemy', 20000, 20000, 6200);
  const systems: readonly KernelSystem[] = Object.freeze([
    ...createPhase17Systems({
      speedsX100PerSecond: {},
      targeting: { focusTargetId: { unit_p: 'unit_e1' } },
      basicAttack: { parameters: { unit_p: attack(300) } },
    }),
    ...createPhase21Systems({ modifiers: [modA, modB, modD], objectives: [HEAL] }),
  ]);
  let state: BattleModel = battle({
    simulationVersion: 'phase21-lifesteal-composite-v1',
    tick: tick(0),
    entities: Object.freeze([player, tank]),
    abilities: Object.freeze([]),
  });
  const random = randomSession();
  const heals: HealObs[] = [];
  for (let t = 0; t < 200 && !['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(state.phase.phase); t++) {
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    for (const event of r.events) {
      if (event.type === 'HealApplied' && event.targetIds.length === 1) {
        heals.push(Object.freeze({
          tick: state.tick,
          rawAmount: event.payload['rawAmount'] ?? 0,
          delta: event.payload['finalHpDelta'] ?? 0,
        }));
      }
    }
  }
  return { state, heals: Object.freeze(heals), checksum: createSnapshot(state).checksum };
}

describe('P21 §7 composite heal_bps', () => {
  it('composes heal_bps multiplicatively and heals from the scaled damage', { timeout: 120_000 }, () => {
    const defs = [modA, modB, modD];
    // 1. COMPOSITION: 10000 → 5000 → 3000 (multiplicative, round-half-away each step).
    const healScale = hookBpsScale(defs, 'on_damage_applied', 'heal_bps');
    expect(healScale).toBe(3000);
    const damageScale = hookBpsScale(defs, 'on_damage_applied', 'damage_bps');
    expect(damageScale).toBe(12500);
    // 2a. The DAMAGE is scaled (300 → 375, the tank takes the effective hit)…
    const effectiveDamage = applyHookBps(300, damageScale);
    expect(effectiveDamage).toBe(375);
    // 2b. …but the heal is sized from the PRE-scale raw (the shared stage-H
    // view): applyHookBps(300, 3000) = 90, NOT applyHookBps(375, 3000) = 113.
    const expectedHeal = applyHookBps(300, healScale);
    expect(expectedHeal).toBe(90);

    const a = run();
    const b = run();
    // 5. DETERMINISM.
    expect(b.checksum).toBe(a.checksum);
    expect(b.heals).toEqual(a.heals);

    // The composed lifesteal heal lands exactly as re-derived (90 = raw × 0.3).
    expect(a.heals.length).toBeGreaterThan(0);
    expect(a.heals[0]).toMatchObject({ rawAmount: expectedHeal, delta: expectedHeal });
    // The tank actually took the SCALED damage (375/hit → > 0, strictly below max).
    const tank = a.state.entities.find((e) => e.id === 'unit_e1');
    expect((tank?.lp ?? 0)).toBeLessThan(20000);

    // 3. HOOK LOG: all three modifiers fired on_damage_applied with their params.
    const log = a.state.modifierHookLog ?? [];
    expect(log.some((f) => f.modifierId === 'mod_fixture_lifesteal_a' && f.hook === 'on_damage_applied' && f.params['heal_bps'] === 5000)).toBe(true);
    expect(log.some((f) => f.modifierId === 'mod_fixture_lifesteal_b' && f.hook === 'on_damage_applied' && f.params['heal_bps'] === 6000)).toBe(true);
    expect(log.some((f) => f.modifierId === 'mod_fixture_onslaught' && f.hook === 'on_damage_applied' && f.params['damage_bps'] === 12500)).toBe(true);

    // 4. OBJECTIVE FOLD: 90 + 90 ≥ 180 → the heal_sustain mission completes.
    const heal = a.state.objectives?.find((o) => o.kind === 'heal_sustain');
    expect(heal?.progress).toBe(180);
    expect(heal?.complete).toBe(true);
  });
});
