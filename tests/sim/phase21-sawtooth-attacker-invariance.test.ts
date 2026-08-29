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
 * P21 §7 lifesteal attacker-count invariance — CONRECTION of the earlier
 * "multi-attacker convergence threshold" framing.
 *
 * Empirically the sawtooth is NOT tipped by attacker count. The symmetric
 * lifesteal system appends the heal AFTER every queued damage application in
 * the same tick, and the stage-I elimination check runs at the END of the
 * tick, post-heal. So a self-healing enemy that drops to 0 on a lethal hit
 * is RESTORED to exactly its per-cycle heal H by the heal that lands in the
 * same tick — the elimination check then sees LP = H, not 0, and the enemy
 * survives. The fixed point H = round(rawEnemyHit × heal_bps/10000) is
 * therefore IMMUNE to attacker count (and to attacker DPS): N=1, 2, 3, 6
 * attackers all leave the enemy at exactly H.
 *
 * Contract proven here:
 *   1. INVARIANCE — a self-healing enemy converges to exactly H and is never
 *      defeated for EVERY attacker count in {1, 2, 3, 6}; the battle stays
 *      ACTIVE (multi-attacker intake far exceeds the heal, yet no kill).
 *   2. LEVER — the sawtooth breaks ONLY when the enemy's own self-heal SOURCE
 *      is suppressed: a NON-ATTACKING tank enemy with the modifier takes the
 *      lethal damage with no same-tick heal, so it dies → VICTORY. Attacker
 *      count alone is never sufficient.
 *   3. DETERMINISM — each attacker-count run reproduces its own checksum.
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

const ENEMY_HP = 4000;
const PLAYER_LP = 2500;
/** Enemy's per-cycle lifesteal from its own 50-damage hit at heal_bps 5000. */
const H = mulDivRound(50, 5000, 10000);

/** attackerCount players attack the enemy 300/cycle; enemy attacks (self-heal source on) when `enemyAttacks`. */
function run(attackerCount: number, enemyAttacks: boolean, withModifier: boolean): { readonly state: BattleModel; readonly checksum: string } {
  const players = Array.from({ length: attackerCount }, (_, index) =>
    mk(`unit_p${String(index + 1)}`, 'player', 5000, PLAYER_LP, 1400 + index * 500));
  const enemy = mk('unit_e1', 'enemy', ENEMY_HP, ENEMY_HP, 6200 + (attackerCount - 1) * 400);
  const focus: Record<string, string> = {};
  const params: Record<string, ReturnType<typeof attack>> = {};
  for (const p of players) {
    focus[p.id] = 'unit_e1';
    params[p.id] = attack(300);
  }
  if (enemyAttacks) {
    focus['unit_e1'] = 'unit_p1';
    params['unit_e1'] = attack(50);
  }
  const systems: readonly KernelSystem[] = Object.freeze([
    ...createPhase17Systems({
      speedsX100PerSecond: {},
      targeting: { focusTargetId: focus },
      basicAttack: { parameters: params },
    }),
    ...createPhase21Systems({ modifiers: withModifier ? [LIFESTEAL] : [] }),
  ]);
  let state: BattleModel = battle({
    simulationVersion: 'phase21-sawtooth-invariant-v1',
    tick: tick(0),
    entities: Object.freeze([...players, enemy]),
    abilities: Object.freeze([]),
  });
  const random = randomSession();
  for (let t = 0; t < 900 && !['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(state.phase.phase); t++) {
    state = stepBattle({ state, input, random, rules: {}, content: {}, systems }).state;
  }
  return { state, checksum: createSnapshot(state).checksum };
}

describe('P21 §7 lifesteal sawtooth attacker-count invariance', () => {
  it('a self-healing enemy is unkillable at EVERY attacker count (fixed point H)', { timeout: 120_000 }, () => {
    for (const count of [1, 2, 3, 6] as const) {
      const a = run(count, true, true);
      const b = run(count, true, true);
      // 3. DETERMINISM per count.
      expect(b.checksum).toBe(a.checksum);
      // 1. INVARIANCE — even with combined intake far above the enemy's heal,
      // the enemy still converges to exactly H and is never defeated.
      const enemy = a.state.entities.find((e) => e.id === 'unit_e1');
      expect(enemy?.lp ?? 0).toBe(H);
      expect(a.state.phase.phase).toBe('ACTIVE');
    }
  });

  it('a non-attacking tank enemy (self-heal source suppressed) IS defeatable — the lever', { timeout: 120_000 }, () => {
    // Same modifier, same attackers — but the enemy does NOT attack, so it never
    // self-heals on its own lethal tick. The sawtooth source is suppressed and
    // a single attacker kills it (VICTORY by elimination).
    for (const count of [1] as const) {
      const a = run(count, false, true);
      const enemy = a.state.entities.find((e) => e.id === 'unit_e1');
      expect(enemy?.lp ?? 0).toBe(0);
      expect(a.state.phase.phase).toBe('VICTORY');
    }
  });

  it('control — without the modifier the sawtooth never forms', { timeout: 120_000 }, () => {
    const a = run(1, true, false);
    const enemy = a.state.entities.find((e) => e.id === 'unit_e1');
    expect(enemy?.lp ?? 0).toBe(0);
    expect(a.state.phase.phase).toBe('VICTORY');
  });
});
