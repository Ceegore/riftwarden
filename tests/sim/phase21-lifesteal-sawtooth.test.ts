import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { createPhase21Systems } from '../../src/game/sim/core/phase21-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { mulDivRound } from '../../src/game/sim/math/fixed-math.js';
import { asX100 } from '../../src/game/sim/geometry/x100.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { ModifierDefinition } from '../../src/game/sim/world/modifier-system.js';
import { battle, entity, randomSession, tick } from './test-helpers.js';

/**
 * Phase 21 §7 lifesteal SIDE POLICY — pinned contract.
 *
 * DECISION: `heal_bps` on `on_damage_applied` stays SYMMETRIC — the composite
 * heal scale applies to EVERY damage source, exactly like the symmetric
 * `damage_bps` scale. There is no player-side gate. The consequence is the
 * IMMORTAL SAWTOOTH: an entity that deals damage under the modifier self-heals
 * its own per-cycle lifesteal amount H (raw × heal_bps/10000) on the same tick
 * the hit lands, so once its HP drops to ≤ its damage intake it clamps back to
 * exactly H every cycle and can never reach 0 — a self-healing enemy is
 * unkillable by a single attacker whose hit merely clears EACH swing (it must
 * saturate > H in one burst, or the player must burst the HP down).
 *
 * Contract proven here:
 *   1. SYMMETRY — BOTH sides' damage sources self-heal (player 150 from its own
 *      300-damage hit, enemy 25 from its own 50-damage hit).
 *   2. FIXED POINT — the self-attacking enemy's HP converges to exactly its
 *      per-cycle lifesteal amount H (mulDivRound(50, 5000, 10000) = 25) and
 *      stays there across many cycles: never 0, never a Defeated event.
 *   3. CONTROL (gate) — the SAME battle WITHOUT any heal_bps modifier kills the
 *      same enemy (no self-heal), ending VICTORY by elimination — proving the
 *      sawtooth is CAUSED by the symmetric lifesteal, not an HP bug.
 *   4. DETERMINISM — two identical runs produce the identical checksum + heal
 *      trace.
 */

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

const LIFESTEAL: ModifierDefinition = Object.freeze({
  id: 'mod_fixture_lifesteal',
  previewKey: 'preview_mod_fixture_lifesteal',
  hooks: Object.freeze(['on_damage_applied'] as const),
  incompatibilityTags: Object.freeze([]),
  params: Object.freeze({ heal_bps: 5000 }),
});

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
  readonly targetId: string;
  readonly rawAmount: number;
  readonly delta: number;
}

function run(withModifier: boolean): { readonly state: BattleModel; readonly heals: readonly HealObs[]; readonly checksum: string; readonly hexpected: number } {
  const player = mk('unit_p', 'player', 5000, 2500, 1800);
  const enemy = mk('unit_e1', 'enemy', 10000, 10000, 6200);
  const systems: readonly KernelSystem[] = Object.freeze([
    ...createPhase17Systems({
      speedsX100PerSecond: {},
      targeting: { focusTargetId: { unit_p: 'unit_e1', unit_e1: 'unit_p' } },
      basicAttack: { parameters: { unit_p: attack(300), unit_e1: attack(50) } },
    }),
    ...createPhase21Systems({ modifiers: withModifier ? [LIFESTEAL] : [] }),
  ]);
  let state: BattleModel = battle({
    simulationVersion: 'phase21-lifesteal-sawtooth-v1',
    tick: tick(0),
    entities: Object.freeze([player, enemy]),
    abilities: Object.freeze([]),
  });
  const random = randomSession();
  const heals: HealObs[] = [];
  for (let t = 0; t < 800 && !['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(state.phase.phase); t++) {
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    for (const event of r.events) {
      if (event.type === 'HealApplied' && event.targetIds.length === 1) {
        heals.push(Object.freeze({
          tick: state.tick,
          targetId: event.targetIds[0] as string,
          rawAmount: event.payload['rawAmount'] ?? 0,
          delta: event.payload['finalHpDelta'] ?? 0,
        }));
      }
    }
  }
  const hexpected = mulDivRound(50, 5000, 10000);
  return { state, heals: Object.freeze(heals), checksum: createSnapshot(state).checksum, hexpected };
}

describe('P21 §7 lifesteal side policy (symmetric, pinned)', () => {
  it('both sides self-heal and the self-healing enemy hits the immortal sawtooth fixed point', { timeout: 120_000 }, () => {
    const a = run(true);
    const b = run(true);
    // 4. DETERMINISM.
    expect(b.checksum).toBe(a.checksum);
    expect(b.heals).toEqual(a.heals);

    // 1. SYMMETRY: the player self-heals 300 × 5000/10000 = 150; the ENEMY
    // self-heals 50 × 5000/10000 = 25 from its OWN attacking damage — the
    // effect sources from every damage application on both sides.
    expect(a.heals.some((h) => h.targetId === 'unit_p' && h.rawAmount === 150 && h.delta === 150)).toBe(true);
    expect(a.heals.some((h) => h.targetId === 'unit_e1' && h.rawAmount === 25 && h.delta === 25)).toBe(true);

    // 2. FIXED POINT: the enemy converges to exactly its per-cycle lifesteal
    // amount (25) and is never defeated across the whole run.
    const enemy = a.state.entities.find((e) => e.id === 'unit_e1');
    expect(enemy?.lp ?? 0).toBeGreaterThan(0);
    expect(a.heals.some((h) => h.targetId === 'unit_e1')).toBe(true);
    // During a steady-state window late in the run the enemy sits at exactly 25.
    const lateTicks = a.state.tick - 150;
    const lateEnemyHeals = a.heals.filter((h) => h.targetId === 'unit_e1' && h.tick >= lateTicks);
    expect(lateEnemyHeals.length).toBeGreaterThan(0);
    expect(lateEnemyHeals.every((h) => h.delta === 25)).toBe(true);
    expect(enemy?.lp).toBe(a.hexpected);
    // The player survives at max LP (net sustain), never dies.
    const player = a.state.entities.find((e) => e.id === 'unit_p');
    expect(player?.lp ?? 0).toBeGreaterThan(0);
    // The battle is still ACTIVE (no terminal): the self-healing enemy can't be
    // killed, so the enemy side is never eliminated within the run window.
    expect(a.state.phase.phase).toBe('ACTIVE');
  });

  it('control — without any heal_bps modifier the same enemy is defeatable (gate)', { timeout: 120_000 }, () => {
    const c = run(false);
    // 3. CONTROL: no self-heal at all, so the enemy takes the full 300/cycle and
    // dies → the enemy side is eliminated → VICTORY (before the player's slower
    // drain ends it). Proves the sawtooth above is caused by the symmetric heal.
    expect(c.heals).toEqual([]);
    expect(c.state.phase.phase).toBe('VICTORY');
    const enemy = c.state.entities.find((e) => e.id === 'unit_e1');
    expect(enemy?.lp ?? 0).toBe(0);
  });
});
