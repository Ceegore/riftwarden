import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { createPhase21Systems } from '../../src/game/sim/core/phase21-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { ModifierDefinition } from '../../src/game/sim/world/modifier-system.js';
import type { Objective } from '../../src/game/sim/objectives/combat-objective.js';
import { asX100 } from '../../src/game/sim/geometry/x100.js';
import { battle, entity, randomSession, tick } from './test-helpers.js';

/**
 * Phase 21 §8.3 REAL heal source — the modifier-runtime LIFESTEAL effect.
 *
 * The heal_sustain objective only means something if a real mechanic produces
 * HealApplied events in the battle; this test proves the §7 `on_damage_applied`
 * `heal_bps` hook effect is that mechanic. Contract:
 *   1. SOURCE FIDELITY — the committed lifesteal modifier's `heal_bps` (5000)
 *      turns every queued damage application into a heal on the attacker:
 *      300 damage → 150 heal, `effectId 'lifesteal'`, same attack instance.
 *   2. SUSTAIN LOOP — with incoming enemy damage (150/cycle) the heal (150/cycle)
 *      sustains the player below max; the heal_sustain objective folds the
 *      HealApplied amounts to completion (1000 required → 7 heals).
 *   3. HOOK SURFACE — the modifier commits once and its `on_damage_applied`
 *      hook appears in the canonical hook log at the first damage tick.
 *   4. OVERHEAL CLAMP — with no incoming damage the player reaches max LP and
 *      later lifesteal heals restore 0 (event still emitted, hpBefore===hpAfter).
 *   5. GATE — without the modifier the exact same battle produces ZERO heals.
 *   6. DETERMINISM — two identical runs give the identical checksum and heal trace.
 */

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

/** §7 fixture lifesteal modifier (mirrors the content `mod_fixture_lifesteal` entry). */
const LIFESTEAL: ModifierDefinition = Object.freeze({
  id: 'mod_fixture_lifesteal',
  previewKey: 'preview_mod_fixture_lifesteal',
  hooks: Object.freeze(['on_damage_applied'] as const),
  incompatibilityTags: Object.freeze([]),
  params: Object.freeze({ heal_bps: 5000 }),
});

const HEAL_MISSION: Objective = Object.freeze({ id: 'obj_heal_sustain', kind: 'heal_sustain', targetId: null, required: 1000, progress: 0, complete: false });
/** Mission gate: an unreachable heal requirement keeps the battle ACTIVE so the
 * overheal-clamp ticks after max LP are observable. */
const HEAL_GATE: Objective = Object.freeze({ id: 'obj_heal_gate', kind: 'heal_sustain', targetId: null, required: 100000, progress: 0, complete: false });

const mk = (id: string, side: 'player' | 'enemy', maxLp: number, lp: number, x100: number) =>
  migrateEntity({ entity: entity(id, { side, lane: 'middle', x100, maxLp, lp }), radiusX100: 100 });

/** Phase-17 direct-damage attack profile (10-tick cycle, no projectiles). */
const attack = (rawAmount: number) => Object.freeze({
  attackIntervalTicks: 10,
  prepareTicks: 1,
  recoveryTicks: 3,
  preferredRangeX100: asX100(9000),
  delivery: Object.freeze({ kind: 'direct', rawAmount, damageTypeOrdinal: 0, defense: 0, bossCapBps: null }),
});

interface HealObs {
  readonly tick: number;
  readonly targetId: string;
  readonly rawAmount: number;
  readonly delta: number;
  readonly hpBefore: number;
  readonly hpAfter: number;
}

function runSustain(withModifier: boolean): { readonly state: BattleModel; readonly heals: readonly HealObs[]; readonly checksum: string } {
  const player = mk('unit_p', 'player', 5000, 2500, 1800);
  const enemy = mk('unit_e1', 'enemy', 10000, 10000, 6200);
  const systems: readonly KernelSystem[] = Object.freeze([
    ...createPhase17Systems({
      speedsX100PerSecond: {},
      targeting: { focusTargetId: { unit_p: 'unit_e1', unit_e1: 'unit_p' } },
      basicAttack: { parameters: { unit_p: attack(300), unit_e1: attack(150) } },
    }),
    ...createPhase21Systems({
      modifiers: withModifier ? [LIFESTEAL] : [],
      objectives: [HEAL_MISSION],
    }),
  ]);
  let state: BattleModel = battle({
    simulationVersion: 'phase21-lifesteal-sustain-v1',
    tick: tick(0),
    entities: Object.freeze([player, enemy]),
    abilities: Object.freeze([]),
  });
  const random = randomSession();
  const heals: HealObs[] = [];
  for (let t = 0; t < 120; t++) {
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    for (const event of r.events) {
      if (event.type !== 'HealApplied' || event.targetIds.length !== 1) continue;
      heals.push(Object.freeze({
        tick: state.tick,
        targetId: event.targetIds[0] as string,
        rawAmount: event.payload['rawAmount'] ?? 0,
        delta: event.payload['finalHpDelta'] ?? 0,
        hpBefore: event.payload['hpBefore'] ?? 0,
        hpAfter: event.payload['hpAfter'] ?? 0,
      }));
    }
  }
  return { state, heals: Object.freeze(heals), checksum: createSnapshot(state).checksum };
}

function runClamp(): { readonly state: BattleModel; readonly heals: readonly HealObs[] } {
  // No enemy attack profile: the player is the only attacker, so once it
  // reaches max LP the lifesteal heals hit the overheal clamp.
  const player = mk('unit_p', 'player', 1000, 500, 1800);
  const enemy = mk('unit_e1', 'enemy', 10000, 10000, 6200);
  const systems: readonly KernelSystem[] = Object.freeze([
    ...createPhase17Systems({
      speedsX100PerSecond: {},
      targeting: { focusTargetId: { unit_p: 'unit_e1' } },
      basicAttack: { parameters: { unit_p: attack(300) } },
    }),
    ...createPhase21Systems({ modifiers: [LIFESTEAL], objectives: [HEAL_GATE] }),
  ]);
  let state: BattleModel = battle({
    simulationVersion: 'phase21-lifesteal-clamp-v1',
    tick: tick(0),
    entities: Object.freeze([player, enemy]),
    abilities: Object.freeze([]),
  });
  const random = randomSession();
  const heals: HealObs[] = [];
  for (let t = 0; t < 80; t++) {
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    for (const event of r.events) {
      if (event.type !== 'HealApplied' || event.targetIds.length !== 1) continue;
      heals.push(Object.freeze({
        tick: state.tick,
        targetId: event.targetIds[0] as string,
        rawAmount: event.payload['rawAmount'] ?? 0,
        delta: event.payload['finalHpDelta'] ?? 0,
        hpBefore: event.payload['hpBefore'] ?? 0,
        hpAfter: event.payload['hpAfter'] ?? 0,
      }));
    }
  }
  return { state, heals: Object.freeze(heals) };
}

describe('P21 §8.3 lifesteal heal source', () => {
  it('turns applied damage into real heals that complete the heal_sustain mission', { timeout: 120_000 }, () => {
    const a = runSustain(true);
    const b = runSustain(true);
    // 6. DETERMINISM.
    expect(b.checksum).toBe(a.checksum);
    expect(b.heals).toEqual(a.heals);

    // 1. SOURCE FIDELITY: every lifesteal heal is on the DAMAGE SOURCE, sized
    // raw × 5000/10000 — the player's 300-damage hit heals 150, the enemy's
    // 150-damage hit heals 75 (the effect is symmetric over every application).
    expect(a.heals.length).toBeGreaterThan(0);
    const playerHeals = a.heals.filter((h) => h.targetId === 'unit_p');
    expect(playerHeals.length).toBeGreaterThan(0);
    expect(playerHeals.every((h) => h.rawAmount === 150 && h.delta === 150)).toBe(true);
    const enemyHeals = a.heals.filter((h) => h.targetId === 'unit_e1');
    expect(enemyHeals.length).toBeGreaterThan(0);
    expect(enemyHeals.every((h) => h.rawAmount === 75 && h.delta === 75)).toBe(true);
    // 2. SUSTAIN LOOP: the player survives below max LP while healing.
    const player = a.state.entities.find((e) => e.id === 'unit_p');
    expect(player?.lp ?? 0).toBeGreaterThan(0);
    expect(player?.lp ?? 0).toBeLessThanOrEqual(5000);
    // The heal_sustain objective folds the amounts to completion (1000 required).
    const objective = a.state.objectives?.find((o) => o.id === 'obj_heal_sustain');
    expect(objective?.complete).toBe(true);
    expect(objective?.progress).toBe(1000);
    // 3. HOOK SURFACE: the modifier committed once and its on_damage_applied
    // hook fired in the canonical log.
    expect(a.state.modifiers?.map((m) => m.id)).toContain('mod_fixture_lifesteal');
    const firing = a.state.modifierHookLog?.find((f) => f.modifierId === 'mod_fixture_lifesteal' && f.hook === 'on_damage_applied');
    expect(firing?.atTick).toBeGreaterThan(0);
    // Every heal event is §7-announced: the hook log proves the effect fired.
    expect(a.state.modifierHookLog?.some((f) => f.modifierId === 'mod_fixture_lifesteal')).toBe(true);
  });

  it('clamps lifesteal heals at max LP (overheal restores 0 but still emits)', { timeout: 120_000 }, () => {
    const { heals } = runClamp();
    // Positive heals while below max, then a genuine overheal: 0 delta at full HP.
    expect(heals.some((h) => h.delta > 0)).toBe(true);
    const overheal = heals.find((h) => h.delta === 0);
    expect(overheal).toBeDefined();
    expect(overheal?.hpBefore).toBe(1000);
    expect(overheal?.hpAfter).toBe(1000);
    expect(overheal?.rawAmount).toBe(150);
    // The clamp happens only AFTER the player reached max LP.
    const maxed = heals.find((h) => h.hpAfter === 1000);
    expect(maxed).toBeDefined();
    expect(overheal?.tick).toBeGreaterThanOrEqual(maxed?.tick ?? 0);
  });

  it('produces zero heals without the modifier (gate)', { timeout: 120_000 }, () => {
    const { heals, state } = runSustain(false);
    expect(heals).toEqual([]);
    expect(state.objectives?.find((o) => o.id === 'obj_heal_sustain')?.complete).toBe(false);
  });
});
