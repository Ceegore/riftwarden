import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { createPhase21Systems } from '../../src/game/sim/core/phase21-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { evaluateComposite, objectiveAllowsBattleEnd, type CompositeCondition, type Objective } from '../../src/game/sim/objectives/combat-objective.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import { battle, entity, randomSession } from './test-helpers.js';
import { asX100 } from '../../src/game/sim/geometry/x100.js';

/**
 * Phase 21 §8 composite heal-sustain fuzz.
 *
 * The §8 gate is "battle may end only when every objective is complete". This
 * suite extends the clean-room composite oracle with a FOURTH, heal-driven
 * part — a survival mandate that is only satisfiable while healing keeps the
 * player alive:
 *   1. ORACLE — the clean-room verdict is now the 4-way conjunction
 *      `survive ∧ kill ∧ waves ∧ heal`, and the runtime gate
 *      `objectiveAllowsBattleEnd` agrees on every state (a heal-sustain
 *      objective still holds the gate open until its requirement is met).
 *   2. SUSTAIN — a survive window that an unassisted player could never out-last
 *      is reached because periodic heal applications keep the player alive
 *      (HealApplied events genuinely restore LP and reset the §9.4
 *      no-progress endcap — healing is qualifying progress).
 *   3. GATE — the terminal VICTORY may land only once the whole 4-way composite
 *      is complete; the healing sustains the window, it does not short-circuit
 *      the kill/waves/heal parts.
 *   4. DETERMINISM — identical terminal + checksum across re-runs.
 */

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });
const HARD_LIMIT = 2700;
const RESOLVING_WINDOW = 3;

/** Deterministic pair factory: every part completes in every combination. */
function objectives(survive: boolean, kill: boolean, waves: boolean, heal: boolean): readonly Objective[] {
  return Object.freeze([
    Object.freeze({ id: 'obj_survive', kind: 'survive_until', targetId: null, required: 600, progress: survive ? 600 : 300, complete: survive }),
    Object.freeze({ id: 'obj_kill', kind: 'kill_regulars', targetId: null, required: 2, progress: kill ? 2 : 1, complete: kill }),
    Object.freeze({ id: 'obj_waves', kind: 'complete_waves', targetId: null, required: 2, progress: waves ? 2 : 1, complete: waves }),
    // The sustain part: its requirement is closure of the heal mandate. A heal
    // objective is campaign-critical (the mission cannot end while the heal
    // bar is un-met); it flips only with sufficient accumulated healed HP.
    Object.freeze({ id: 'obj_heal', kind: 'heal_sustain', targetId: null, required: 3, progress: heal ? 3 : 1, complete: heal }),
  ]);
}

describe('P21 §8 heal-sustain composite oracle', () => {
  it('clean-room oracle: a 4-way all-gate (survive ∧ kill ∧ waves ∧ heal) equals objectiveAllowsBattleEnd', { timeout: 60_000 }, () => {
    const synthetic: CompositeCondition = Object.freeze({ id: 'composite_mission', mode: 'all', objectiveIds: Object.freeze(['obj_survive', 'obj_kill', 'obj_waves', 'obj_heal']) });
    let sawOpen = 0;
    let sawClosed = 0;
    for (let i = 0; i < 20_000; i++) {
      const survive = i % 3 === 0;
      const kill = i % 5 === 0;
      const waves = i % 4 === 0;
      const heal = i % 7 === 0;
      const set = objectives(survive, kill, waves, heal);
      const oracle = survive && kill && waves && heal;
      expect(evaluateComposite(synthetic, set), `case ${String(i)}`).toBe(oracle);
      expect(objectiveAllowsBattleEnd(set), `case ${String(i)} runtime gate`).toBe(oracle);
      if (oracle) sawClosed += 1;
      else sawOpen += 1;
    }
    expect(sawOpen).toBeGreaterThan(5000);
    // The 4-way gate closes only on lcm(3,5,4,7)=420 (≈48 of 20k) — still
    // exercised non-trivially.
    expect(sawClosed).toBeGreaterThan(40);
  });

  it('healing sustains a survive window the player could not out-last alone (VICTORY survive_complete)', { timeout: 120_000 }, () => {
    const run = (): { terminal: { phase: string; reason: string | null } | null; terminalTick: number; healApplied: number; healsResetProgress: number; checksum: string } => {
      const player = migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
      const enemy = migrateEntity({ entity: entity('unit_e0', { side: 'enemy', lane: 'middle', x100: 6200, maxLp: 2000, lp: 2000 }), radiusX100: 100 });
      const objectivesList: readonly Objective[] = Object.freeze([
        Object.freeze({ id: 'obj_survive', kind: 'survive_until', targetId: null, required: 300, progress: 0, complete: false }),
      ]);
      const systems: readonly KernelSystem[] = Object.freeze([
        ...createPhase17Systems({
          speedsX100PerSecond: {},
          basicAttack: {
            parameters: {
              unit_e0: {
                attackIntervalTicks: 10, prepareTicks: 1, recoveryTicks: 3, preferredRangeX100: asX100(9000),
                delivery: { kind: 'direct', rawAmount: 120, damageTypeOrdinal: 0, defense: 0, bossCapBps: null },
              },
            },
          },
        }),
        // A pure survive window (no kill/waves mandate) demonstrates the
        // sustain: the enemy threatens the window, healing keeps it open, and
        // the survive teeth ends it VICTORY the tick the window elapses.
        ...createPhase21Systems({ objectives: objectivesList }),
      ]);
      // The sustain objective is folded at the oracle level (Task 4): the
      // battle runs the survive window, healing sustains the player.
      const state = battle({
        simulationVersion: 'phase21-heal-oracle-fuzz-v1',
        entities: Object.freeze([player, enemy]),
        abilities: Object.freeze([]),
        objectives: objectivesList,
      });
      const random = randomSession();
      let current = state;
      let healApplied = 0;
      let healsResetProgress = 0;
      let terminal: { phase: string; reason: string | null } | null = null;
      let terminalTick = -1;
      for (let t = 0; t < HARD_LIMIT && terminal === null; t++) {
        // Inject a periodic full-LP heal (rawAmount 600, full factor) every 20
        // ticks — the player would otherwise die by ~tick 83, far short of 300.
        if (t > 0 && t % 20 === 0) {
          current = Object.freeze({
            ...current,
            pendingCombatApplications: Object.freeze([
              Object.freeze({ kind: 'heal', sourceId: 'unit_p', targetId: 'unit_p', effectId: 'ef_regen', attackInstanceId: t, effectIndex: 0, rawAmount: 600, healFactorBps: 10000 }),
            ]),
          });
        }
        const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
        current = r.state;
        for (const event of r.events) {
          if (event.type === 'HealApplied') {
            healApplied += 1;
            if ((event.payload['finalHpDelta'] ?? 0) > 0) healsResetProgress += 1;
          }
        }
        if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(current.phase.phase)) {
          terminal = { phase: current.phase.phase, reason: current.endReason };
          terminalTick = current.tick;
        }
      }
      return {
        terminal,
        terminalTick,
        healApplied,
        healsResetProgress,
        checksum: createSnapshot(current).checksum,
      };
    };

    const a = run();
    const b = run();
    // Determinism.
    expect(b.checksum).toBe(a.checksum);
    expect(b.terminal).toEqual(a.terminal);
    // The sustain genuinely restores LP repeatedly.
    expect(a.healApplied, 'heals landed').toBeGreaterThanOrEqual(8);
    expect(a.healsResetProgress, 'heals restored HP (qualifying progress)').toBeGreaterThanOrEqual(8);
    // Without healing the player (1000 LP, 120 damage/10 ticks) dies by ~83 —
    // reaching the 300 window proves healing sustained it. The gate decides: a
    // single deterministic VICTORY via the window force.
    expect(a.terminal?.phase).toBe('VICTORY');
    expect(a.terminal?.reason).toBe('survive_complete');
    expect(a.terminalTick).toBeGreaterThanOrEqual(300);
    expect(a.terminalTick).toBeLessThanOrEqual(300 + RESOLVING_WINDOW + 2);
  });

  it('a real heal_sustain objective gates the survive terminal until the required HP is healed', { timeout: 120_000 }, () => {
    const run = (): { terminalTick: number; healSustainCompleteTick: number | null; healApplied: number; allCompleteAtTerminal: boolean; checksum: string } => {
      const player = migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
      const enemy = migrateEntity({ entity: entity('unit_e0', { side: 'enemy', lane: 'middle', x100: 6200, maxLp: 2000, lp: 2000 }), radiusX100: 100 });
      // A mission needs BOTH the survive window (300) AND 500 accumulated healed
      // HP to close — the heal_sustain objective is a real §8 gate whose
      // progress is the sum of HealApplied amounts (amount-driven, §8).
      const objectivesList: readonly Objective[] = Object.freeze([
        Object.freeze({ id: 'obj_survive', kind: 'survive_until', targetId: null, required: 300, progress: 0, complete: false }),
        Object.freeze({ id: 'obj_heal', kind: 'heal_sustain', targetId: null, required: 500, progress: 0, complete: false }),
      ]);
      const systems: readonly KernelSystem[] = Object.freeze([
        ...createPhase17Systems({
          speedsX100PerSecond: {},
          basicAttack: {
            parameters: {
              unit_e0: {
                attackIntervalTicks: 10, prepareTicks: 1, recoveryTicks: 3, preferredRangeX100: asX100(9000),
                delivery: { kind: 'direct', rawAmount: 120, damageTypeOrdinal: 0, defense: 0, bossCapBps: null },
              },
            },
          },
        }),
        ...createPhase21Systems({ objectives: objectivesList }),
      ]);
      let current = battle({
        simulationVersion: 'phase21-heal-sustain-objective-fuzz-v2',
        entities: Object.freeze([player, enemy]),
        abilities: Object.freeze([]),
        objectives: objectivesList,
      });
      const random = randomSession();
      let healApplied = 0;
      let healSustainCompleteTick: number | null = null;
      let terminalTick = -1;
      let allCompleteAtTerminal = false;
      for (let t = 0; t < HARD_LIMIT; t++) {
        if (t > 0 && t % 20 === 0) {
          current = Object.freeze({
            ...current,
            pendingCombatApplications: Object.freeze([
              Object.freeze({ kind: 'heal', sourceId: 'unit_p', targetId: 'unit_p', effectId: 'ef_regen', attackInstanceId: t, effectIndex: 0, rawAmount: 600, healFactorBps: 10000 }),
            ]),
          });
        }
        const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
        current = r.state;
        for (const event of r.events) {
          if (event.type === 'HealApplied') healApplied += 1;
        }
        const healGoal = (current.objectives ?? []).find((o) => o.id === 'obj_heal');
        if (healGoal?.complete === true && healSustainCompleteTick === null) healSustainCompleteTick = current.tick;
        if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(current.phase.phase)) {
          terminalTick = current.tick;
          allCompleteAtTerminal = objectiveAllowsBattleEnd(current.objectives ?? []);
          break;
        }
      }
      return { terminalTick, healSustainCompleteTick, healApplied, allCompleteAtTerminal, checksum: createSnapshot(current).checksum };
    };

    const a = run();
    const b = run();
    expect(b.checksum).toBe(a.checksum);
    expect(b.healSustainCompleteTick).toBe(a.healSustainCompleteTick);
    // The sustain gate closed on accumulated HP: enough heals landed to reach
    // the 500-HP requirement well inside the 300 window.
    expect(a.healApplied).toBeGreaterThanOrEqual(3);
    expect(a.healSustainCompleteTick).not.toBeNull();
    if (a.healSustainCompleteTick === null) throw new Error('heal_sustain never completed');
    // Heals every 20 ticks (each restoring the damage since the last heal, ~240)
    // accumulate past 500 by roughly tick 60 — well inside the 300 window; the
    // terminal comes only when ALL objectives are complete and the survive
    // teeth fires.
    expect(a.healSustainCompleteTick).toBeLessThanOrEqual(115);
    expect(a.terminalTick).toBeGreaterThanOrEqual(300);
    expect(a.allCompleteAtTerminal).toBe(true);
  });
});
