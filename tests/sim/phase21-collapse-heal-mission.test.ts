import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { createPhase21Systems } from '../../src/game/sim/core/phase21-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { createObjectiveCollection } from '../../src/game/sim/objectives/combat-objective.js';
import { numberSecondsToTicks } from '../../src/game/sim/math/time-and-speed.js';
import { COLLAPSE_WINDOW_TICKS, SOFT_LIMIT_NORMAL_TICKS } from '../../src/game/sim/combat/battle-end-resolver.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { Objective } from '../../src/game/sim/objectives/combat-objective.js';
import { battle, entity, randomSession } from './test-helpers.js';

/**
 * Phase 21 §8/§9.4/§10 collapse-heal GATED MISSION fuzz.
 *
 * A real mission (objectives present) must close inside the 450-tick
 * rift-collapse window: the heal_sustain requirement accumulates the HALVED
 * in-window heal amounts and completes while the window is still running, and
 * the survive mandate then drives the terminal. Unlike the pure no-objective
 * stall (previous round), the in-progress objectives suppress the no-progress
 * endcap for the whole battle. Contract under test:
 *   1. GATED — objectives are seeded (survive_until + heal_sustain), so this
 *      is a mission, not a stall; the endcap must never fire while any
 *      objective is open.
 *   2. HALVING COUNTS — the heal_sustain progress folds the actual restored
 *      HP: pre-window heals contribute 100, in-window heals contribute 50
 *      (the §8.3 halving lands in the objective, not around it).
 *   3. CLOSES IN-WINDOW — the heal_sustain objective completes on a tick
 *      inside (softLimit, softLimit + window): the mission closes despite the
 *      halving, purely from in-window heals crossing the required amount.
 *   4. NO ENDCAP — zero RiftCollapseEndRequest even though the battle
 *      out-lasts the 300+300 no-progress window.
 *   5. MISSION TERMINAL — once both objectives are complete the survive teeth
 *      force VICTORY `survive_complete` (the survive window drives it), never
 *      a chapter-76 time limit.
 *   6. DETERMINISM — two identical runs produce identical checksums/traces.
 */
const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });
const WINDOW_END = SOFT_LIMIT_NORMAL_TICKS + COLLAPSE_WINDOW_TICKS; // 3150

function objectives(): readonly Objective[] {
  return createObjectiveCollection([
    Object.freeze({
      id: 'obj_sustain_heal',
      kind: 'heal_sustain' as const,
      targetId: null,
      required: 1200,
      progress: 0,
      complete: false,
    }),
    Object.freeze({
      id: 'obj_sustain_survive',
      kind: 'survive_until' as const,
      targetId: null,
      // 135s → 4050 ticks: the survive window runs 900 ticks past the
      // collapse-window end, so the heal objective must close in-window.
      required: numberSecondsToTicks(135).ticks,
      progress: 0,
      complete: false,
    }),
  ]);
}

interface MissionResult {
  readonly terminal: { phase: string; reason: string | null } | null;
  readonly terminalTick: number;
  readonly collapseRequests: number;
  readonly healDeltas: readonly number[];
  readonly healCompleteTick: number;
  readonly playerAliveAtTerminal: boolean;
  readonly checksum: string;
}

function run(): MissionResult {
  const player = migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
  const enemy = migrateEntity({ entity: entity('unit_e0', { side: 'enemy', lane: 'middle', x100: 6200, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
  const systems: readonly KernelSystem[] = Object.freeze([
    ...createPhase17Systems({ speedsX100PerSecond: {} }),
    // §8 gated mission: objectives present, so the endcap and the time-limit
    // request stay suppressed until every objective completes.
    ...createPhase21Systems({ objectives: objectives() }),
  ]);
  let state = battle({
    simulationVersion: 'phase21-collapse-heal-mission-v1',
    entities: Object.freeze([player, enemy]),
    abilities: Object.freeze([]),
  });
  const random = randomSession();
  const healDeltas: number[] = [];
  let collapseRequests = 0;
  let terminal: MissionResult['terminal'] = null;
  let terminalTick = -1;
  let healCompleteTick = -1;
  const damageApp = (amount: number, instance: number) => Object.freeze({ kind: 'damage', sourceId: 'unit_e0', targetId: 'unit_p', effectId: 'ef_chip', attackInstanceId: instance, effectIndex: 0, rawAmount: amount, damageTypeOrdinal: 0, defense: 0, coverReductionBps: 0, bossCapBps: null });
  const healApp = (amount: number, instance: number) => Object.freeze({ kind: 'heal', sourceId: 'unit_p', targetId: 'unit_p', effectId: 'ef_regen', attackInstanceId: instance, effectIndex: 0, rawAmount: amount, healFactorBps: 10000 });
  for (let t = 0; t < 4600; t++) {
    // Sustain loop: damage 100 then heal 100 in the same tick — the damage
    // opens exactly 100 HP of room, so the heal's finalHpDelta equals its raw
    // amount (100 pre-window, halved to 50 in-window). Pre-window the cadence
    // is sparse (every 300 ticks → 900 progress); inside the collapse window
    // it tightens to every 50 ticks so the halved in-window heals (50 each)
    // cross the 1200 requirement on tick ~2950 — strictly in-window.
    const inWindow = t >= SOFT_LIMIT_NORMAL_TICKS && t < WINDOW_END;
    const cadence = inWindow ? t % 50 === 0 : t > 0 && t % 300 === 0;
    if (cadence) {
      state = Object.freeze({ ...state, pendingCombatApplications: Object.freeze([damageApp(100, t * 2), healApp(100, t * 2 + 1)]) });
    }
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    for (const event of r.events) {
      if (event.type === 'HealApplied') healDeltas.push(event.payload['finalHpDelta'] ?? 0);
      if (event.type === 'RiftCollapseEndRequest') collapseRequests += 1;
    }
    if (healCompleteTick < 0) {
      const heal = state.objectives?.find((o) => o.kind === 'heal_sustain');
      if (heal?.complete === true) healCompleteTick = state.tick;
    }
    if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(state.phase.phase)) {
      terminal = { phase: state.phase.phase, reason: state.endReason };
      terminalTick = state.tick;
      break;
    }
  }
  const playerFinal = state.entities.find((e) => e.id === 'unit_p');
  return {
    terminal,
    terminalTick,
    collapseRequests,
    healDeltas: Object.freeze(healDeltas),
    healCompleteTick,
    playerAliveAtTerminal: (playerFinal?.lp ?? 0) > 0,
    checksum: createSnapshot(state).checksum,
  };
}

describe('P21 §8/§9.4/§10 collapse-heal gated mission', () => {
  it('closes the heal_sustain mission inside the collapse window with halved counts, then survives to the mandate', { timeout: 120_000 }, () => {
    const a = run();
    const b = run();
    // 6. Determinism.
    expect(b.checksum).toBe(a.checksum);
    expect(b.terminal).toEqual(a.terminal);
    expect(b.healDeltas).toEqual(a.healDeltas);
    expect(b.healCompleteTick).toBe(a.healCompleteTick);
    // 1. GATED: the seeded objectives are a real mission.
    expect(a.healCompleteTick).toBeGreaterThan(0);
    // 2. HALVING COUNTS: full-factor pre-window heals and halved in-window heals
    // both land in the objective's progress (the deltas it folds).
    expect(a.healDeltas).toContain(100);
    expect(a.healDeltas).toContain(50);
    // 3. CLOSES IN-WINDOW: the heal requirement completes on a tick strictly
    // inside (softLimit, softLimit + window).
    expect(a.healCompleteTick).toBeGreaterThan(SOFT_LIMIT_NORMAL_TICKS);
    expect(a.healCompleteTick).toBeLessThanOrEqual(WINDOW_END + 1);
    // 4. NO ENDCAP: the in-progress objectives suppress the no-progress endcap.
    expect(a.collapseRequests).toBe(0);
    // 5. MISSION TERMINAL: VICTORY survive_complete, driven by the survive
    // teeth once both objectives are complete — not a chapter-76 time limit
    // (which would land at the 3150 window end).
    expect(a.terminal).not.toBeNull();
    if (a.terminal === null) throw new Error('stalled');
    expect(a.terminal.phase).toBe('VICTORY');
    expect(a.terminal.reason).toBe('survive_complete');
    expect(a.terminalTick).toBeGreaterThan(WINDOW_END + COLLAPSE_WINDOW_TICKS);
    // The collapse chips + scripted damage never killed the player.
    expect(a.playerAliveAtTerminal).toBe(true);
  });
});
