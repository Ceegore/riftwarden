import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { createPhase21Systems } from '../../src/game/sim/core/phase21-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { COLLAPSE_WINDOW_TICKS, SOFT_LIMIT_NORMAL_TICKS } from '../../src/game/sim/combat/battle-end-resolver.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import { battle, entity, randomSession } from './test-helpers.js';

/**
 * Phase 21 §9.4/§10 heal × rift-collapse window fuzz.
 *
 * Inside the 450-tick rift-collapse window (after the normal soft limit)
 * healing is HALVED (factor 5000) and every 90 ticks each regular takes 8%
 * max-LP pure damage. Meanwhile §9.4 makes a heal that actually restores HP
 * qualifying progress — it resets the global no-progress endcap. Contract:
 *   1. HALVING — a 600 rawAmount heal restores exactly 600 before the window
 *      and exactly 300 inside it (same target, same room).
 *   2. HEALS RESET THE ENDCAP — qualifying heals (and the scripted damage)
 *      keep the no-progress counters below the collapse threshold, so the
 *      rift-collapse endcap NEVER fires even in a stall that out-lasts 600.
 *   3. SUSTAIN THROUGH COLLAPSE — the 8% pure damage chips the player every 90
 *      ticks; the heals out-pace it, so both sides stay alive to the end.
 *   4. TERMINATION — the battle ends deterministically at the time-limit
 *      request (soft limit + window) via Chapter-76, never via the endcap.
 */
const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });
const HARD_LIMIT = 5400;
const WINDOW_END = SOFT_LIMIT_NORMAL_TICKS + COLLAPSE_WINDOW_TICKS; // 3150

interface RunResult {
  readonly terminal: { phase: string; reason: string | null } | null;
  readonly terminalTick: number;
  readonly collapseRequests: number;
  readonly healDeltas: readonly number[];
  readonly playerAliveAtTerminal: boolean;
  readonly checksum: string;
}

function run(): RunResult {
  const player = migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
  const enemy = migrateEntity({ entity: entity('unit_e0', { side: 'enemy', lane: 'middle', x100: 6200, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
  const systems: readonly KernelSystem[] = Object.freeze([
    ...createPhase17Systems({ speedsX100PerSecond: {} }),
    // No objectives: a pure stall whose only "progress" is the scripted
    // damage/heal loop, so the endcap interacts with healing alone.
    ...createPhase21Systems({}),
  ]);
  let state = battle({
    simulationVersion: 'phase21-collapse-heal-fuzz-v1',
    entities: Object.freeze([player, enemy]),
    abilities: Object.freeze([]),
  });
  const random = randomSession();
  const healDeltas: number[] = [];
  let collapseRequests = 0;
  let terminal: RunResult['terminal'] = null;
  let terminalTick = -1;
  const damageApp = (amount: number, instance: number) => Object.freeze({ kind: 'damage', sourceId: 'unit_e0', targetId: 'unit_p', effectId: 'ef_hit', attackInstanceId: instance, effectIndex: 0, rawAmount: amount, damageTypeOrdinal: 0, defense: 0, coverReductionBps: 0, bossCapBps: null });
  const healApp = (amount: number, instance: number) => Object.freeze({ kind: 'heal', sourceId: 'unit_p', targetId: 'unit_p', effectId: 'ef_regen', attackInstanceId: instance, effectIndex: 0, rawAmount: amount, healFactorBps: 10000 });
  for (let t = 0; t < HARD_LIMIT; t++) {
    // Sustain loop: every 100 ticks queue a 200-damage + 200-heal pair — both
    // actually move HP (qualifying progress) so the no-progress endcap never
    // reaches its threshold even though the battle is a pure stall.
    if (t > 0 && t % 100 === 0 && t < WINDOW_END) {
      state = Object.freeze({ ...state, pendingCombatApplications: Object.freeze([damageApp(200, t * 2), healApp(200, t * 2 + 1)]) });
    }
    // Observations: damage the player to 400 pre-window (t150) and just before
    // the window (t2699); heal 600 at t180 (full factor, delta 600) and at
    // t2750 (inside the window, halved to 300).
    if (t === 150 || t === 2699) {
      state = Object.freeze({ ...state, pendingCombatApplications: Object.freeze([damageApp(600, t * 2)]) });
    }
    if (t === 180 || t === 2750) {
      state = Object.freeze({ ...state, pendingCombatApplications: Object.freeze([healApp(600, t * 2)]) });
    }
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    for (const event of r.events) {
      if (event.type === 'HealApplied') healDeltas.push(event.payload['finalHpDelta'] ?? 0);
      if (event.type === 'RiftCollapseEndRequest') collapseRequests += 1;
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
    playerAliveAtTerminal: (playerFinal?.lp ?? 0) > 0,
    checksum: createSnapshot(state).checksum,
  };
}

describe('P21 §9.4/§10 heal × rift-collapse window', () => {
  it('healing is halved inside the window, resets the endcap, and sustains the battle to the time limit', { timeout: 120_000 }, () => {
    const a = run();
    const b = run();
    // Determinism: identical terminal, checksum and heal trace.
    expect(b.checksum).toBe(a.checksum);
    expect(b.terminal).toEqual(a.terminal);
    expect(b.healDeltas).toEqual(a.healDeltas);
    // 1. HALVING: the same 600 rawAmount heals for 600 pre-window and 300 in-window.
    expect(a.healDeltas).toContain(600);
    expect(a.healDeltas).toContain(300);
    // 2. HEALS RESET THE ENDCAP: no RiftCollapseEndRequest even though the
    // stall out-lasts the 300+300 no-progress window.
    expect(a.collapseRequests).toBe(0);
    // 3. SUSTAIN: the player out-lives four 8% collapse hits (each 80) on top
    // of the scripted damage — the heals kept it above 0.
    expect(a.playerAliveAtTerminal).toBe(true);
    // 4. TERMINATION: one deterministic terminal at the time-limit boundary
    // (soft limit + window) through the Chapter-76 finalize, not the endcap.
    expect(a.terminal).not.toBeNull();
    if (a.terminal === null) throw new Error('stalled');
    expect(a.terminal.reason).toBe('chapter76_timeout');
    expect(a.terminalTick).toBeGreaterThanOrEqual(WINDOW_END);
    expect(a.terminalTick).toBeLessThanOrEqual(WINDOW_END + 5);
  });
});
