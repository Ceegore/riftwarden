import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { createPhase21Systems } from '../../src/game/sim/core/phase21-systems.js';
import { createSnapshot, verifySnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { restoreStreamsForResume } from '../../src/game/sim/snapshot/random-resume.js';
import { RandomSession } from '../../src/game/sim/random/random-session.js';
import { RollSlotRegistry } from '../../src/game/sim/random/roll-slot-registry.js';
import type { Objective } from '../../src/game/sim/objectives/combat-objective.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import type { Wave } from '../../src/game/sim/world/reinforcement-system.js';
import type { ReinforcementBody } from '../../src/game/sim/core/phase21-systems.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import { battle, entity, randomSession } from './test-helpers.js';
import { asX100 } from '../../src/game/sim/geometry/x100.js';

/**
 * Phase 21 §8 survive_until vs battle-end timing differential fuzz.
 *
 * The contract (§8, "battle may end only when every objective is complete"):
 *   1. NO EARLY END — while the survive_until window is open the battle must
 *      not end by elimination, time limit, or the no-progress endcap. A
 *      terminal before the window is legal ONLY as DEFEAT (the player died).
 *   2. NO LATE END — the tick the window elapses (objective complete), the
 *      battle must terminate VICTORY (survive_complete) inside the resolving
 *      window; it must never continue to a later DEFEAT.
 *   3. TERMINATION — every scenario terminates (the collapse/soft-limit window
 *      is the deadline; the objective gates never stall the battle).
 *
 * A clean-room oracle is folded in: the survive objective's completion tick is
 * required (tick-driven), so the *terminal decision* is checked against the
 * objective timeline — VICTORY ⇔ survive completed at/after the window, and
 * DEFEAT ⇔ the player died before the window. Determinism + snapshot resume
 * close the loop (byte-identical through the survival window).
 */

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

interface Scenario {
  readonly id: string;
  /** survive_until required ticks (the survival window). */
  readonly surviveTicks: number;
  readonly enemies: number;
  readonly playerLp: number;
  /** Damage each enemy deals per basic-attack hit. */
  readonly enemyAttack: number;
  /** Optional reinforcement wave tick (spawns one echo of the base composition). */
  readonly waveAtTick: number | null;
}

const SCENARIOS: readonly Scenario[] = Object.freeze([
  // Strong player, weak enemies: the window must elapse → VICTORY survive_complete.
  Object.freeze({ id: 'strong_short', surviveTicks: 120, enemies: 1, playerLp: 3000, enemyAttack: 40, waveAtTick: null }),
  Object.freeze({ id: 'strong_mid', surviveTicks: 300, enemies: 3, playerLp: 3000, enemyAttack: 40, waveAtTick: null }),
  Object.freeze({ id: 'strong_wave', surviveTicks: 300, enemies: 1, playerLp: 3000, enemyAttack: 40, waveAtTick: 150 }),
  Object.freeze({ id: 'strong_repeated_wave', surviveTicks: 600, enemies: 1, playerLp: 3000, enemyAttack: 40, waveAtTick: 200 }),
  // The full 30-second content window (900 ticks) with waves — the launcher case.
  Object.freeze({ id: 'content_window', surviveTicks: 900, enemies: 1, playerLp: 3000, enemyAttack: 40, waveAtTick: 300 }),
  // Window beyond the soft limit (2700): the gate must hold the battle open
  // through the rift-collapse window and survive wins before the player dies.
  Object.freeze({ id: 'beyond_soft_limit', surviveTicks: 2800, enemies: 1, playerLp: 3000, enemyAttack: 40, waveAtTick: null }),
  // Weak player: dies before the window → DEFEAT (legal early end).
  Object.freeze({ id: 'weak_fast', surviveTicks: 120, enemies: 1, playerLp: 300, enemyAttack: 120, waveAtTick: null }),
  Object.freeze({ id: 'weak_swarm', surviveTicks: 300, enemies: 3, playerLp: 500, enemyAttack: 60, waveAtTick: null }),
  Object.freeze({ id: 'weak_wave', surviveTicks: 300, enemies: 1, playerLp: 400, enemyAttack: 60, waveAtTick: 100 }),
  // Medium: the player clears the field, the wave re-populates pressure, and the
  // window decides the outcome either way.
  Object.freeze({ id: 'medium_wave_long', surviveTicks: 900, enemies: 3, playerLp: 1500, enemyAttack: 60, waveAtTick: 400 }),
]);

interface RunResult {
  readonly terminal: { phase: string; reason: string | null } | null;
  readonly terminalTick: number;
  /** First tick the survive objective was observed complete (null if never). */
  readonly firstSurviveCompleteTick: number | null;
  readonly surviveCompleteAtTerminal: boolean;
  readonly checksum: string;
  readonly ranPastSoftLimit: boolean;
}

function buildSystems(enemies: number, enemyAttack: number, surviveTicks: number, waveAtTick: number | null): readonly KernelSystem[] {
  const attackParams: Record<string, { attackIntervalTicks: number; prepareTicks: number; recoveryTicks: number; preferredRangeX100: ReturnType<typeof asX100>; delivery: { kind: 'direct'; rawAmount: number; damageTypeOrdinal: number; defense: number; bossCapBps: null } }> = {
    unit_p: {
      attackIntervalTicks: 10, prepareTicks: 1, recoveryTicks: 3, preferredRangeX100: asX100(9000),
      delivery: { kind: 'direct', rawAmount: 250, damageTypeOrdinal: 0, defense: 0, bossCapBps: null },
    },
  };
  for (let i = 0; i < enemies; i++) {
    attackParams[`unit_e${String(i)}`] = {
      attackIntervalTicks: 10, prepareTicks: 1, recoveryTicks: 3, preferredRangeX100: asX100(9000),
      delivery: { kind: 'direct', rawAmount: enemyAttack, damageTypeOrdinal: 0, defense: 0, bossCapBps: null },
    };
  }
  const objectives: readonly Objective[] = Object.freeze([
    Object.freeze({ id: 'obj_survive', kind: 'survive_until', targetId: null, required: surviveTicks, progress: 0, complete: false }),
  ]);
  const waves: readonly Wave[] = waveAtTick === null
    ? Object.freeze([])
    : Object.freeze([Object.freeze({ id: 'wave_echo', scheduledTick: waveAtTick, side: 'enemy', entityIds: Object.freeze(['unit_e_reinf']), spawnProfile: 'profile_echo', capPolicy: 'BLOCK' })]);
  const spawnBodies = (wave: Wave): readonly ReinforcementBody[] =>
    wave.entityIds.map((entityId, index) => Object.freeze({ entityId, lane: index === 0 ? 'middle' : 'bottom', x100: 6200, radiusX100: 100, maxLp: 1000 }));
  return Object.freeze([
    ...createPhase17Systems({
      speedsX100PerSecond: {},
      basicAttack: { parameters: attackParams },
    }),
    ...createPhase21Systems({ objectives, waves, spawnBodies }),
  ]);
}

function buildBattle(s: Scenario): BattleModel {
  const player = migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: s.playerLp, lp: s.playerLp }), radiusX100: 100 });
  const enemies = Array.from({ length: s.enemies }, (_, i) =>
    migrateEntity({ entity: entity(`unit_e${String(i)}`, { side: 'enemy', lane: i % 2 === 0 ? 'middle' : 'top', x100: 6200 + i * 400, maxLp: 1000, lp: 1000 }), radiusX100: 100 }));
  return battle({
    simulationVersion: 'phase21-survive-fuzz-v1',
    entities: Object.freeze([player, ...enemies]),
    abilities: Object.freeze([]),
  });
}

function runOnce(s: Scenario): RunResult {
  const systems = buildSystems(s.enemies, s.enemyAttack, s.surviveTicks, s.waveAtTick);
  let state = buildBattle(s);
  const random = randomSession();
  let firstSurviveCompleteTick: number | null = null;
  let terminal: RunResult['terminal'] = null;
  let terminalTick = -1;
  // soft limit (normal 2700) + collapse window (450) + margin.
  const deadline = 2700 + 450 + 200;
  for (let t = 0; t < deadline; t++) {
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    const survive = (state.objectives ?? []).find((o) => o.kind === 'survive_until');
    if (survive?.complete === true && firstSurviveCompleteTick === null) firstSurviveCompleteTick = state.tick;
    if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(state.phase.phase)) {
      terminal = { phase: state.phase.phase, reason: state.endReason };
      terminalTick = state.tick;
      break;
    }
  }
  const surviveAtTerminal = (state.objectives ?? []).find((o) => o.kind === 'survive_until');
  return {
    terminal,
    terminalTick,
    firstSurviveCompleteTick,
    surviveCompleteAtTerminal: surviveAtTerminal?.complete === true,
    checksum: createSnapshot(state).checksum,
    ranPastSoftLimit: terminalTick > 2700,
  };
}

describe('P21 §8 survive_until vs battle-end timing fuzz', () => {
  it('the terminal decision honors the survival window across the scenario sweep (no early/late end)', { timeout: 300_000 }, () => {
    let sawSurviveComplete = 0;
    let sawDefeat = 0;
    let sawPastSoftLimit = 0;
    for (const s of SCENARIOS) {
      const a = runOnce(s);
      const b = runOnce(s);
      // Determinism: identical terminal + checksum for the same scenario.
      expect(b.terminal).toEqual(a.terminal);
      expect(b.checksum).toBe(a.checksum);
      expect(a.terminal, s.id).not.toBeNull();
      if (a.terminal === null) throw new Error(`${s.id} stalled past the deadline`);
      if (a.terminal.phase === 'VICTORY') {
        // No empty/early victory: survive_complete, window elapsed, objective done.
        expect(a.terminal.reason, `${s.id} victory reason`).toBe('survive_complete');
        expect(a.surviveCompleteAtTerminal, `${s.id} survive complete at victory`).toBe(true);
        expect(a.terminalTick, `${s.id} victory tick`).toBeGreaterThanOrEqual(s.surviveTicks);
        sawSurviveComplete += 1;
      } else if (a.terminal.phase === 'DEFEAT') {
        // Legal early end: the player died before the window elapsed.
        expect(a.surviveCompleteAtTerminal, `${s.id} defeat with incomplete survive`).toBe(false);
        expect(a.firstSurviveCompleteTick, `${s.id} no survive completion before defeat`).toBeNull();
        sawDefeat += 1;
      } else if (a.terminal.phase === 'DRAW_ABORT') {
        // Mutual extermination (both sides wiped same tick): also before the window.
        expect(a.surviveCompleteAtTerminal, `${s.id} draw with incomplete survive`).toBe(false);
        expect(a.firstSurviveCompleteTick, `${s.id} no survive completion before draw`).toBeNull();
        sawDefeat += 1;
      }
      // No late end: once the window elapsed the battle ended inside the
      // resolving window — never a continued fight and a later loss.
      if (a.firstSurviveCompleteTick !== null) {
        expect(a.terminal.phase, `${s.id} terminal after survive`).toBe('VICTORY');
        expect(a.terminal.reason, `${s.id} reason after survive`).toBe('survive_complete');
        expect(a.terminalTick - a.firstSurviveCompleteTick, `${s.id} resolving window`).toBeLessThanOrEqual(5);
      }
      if (a.ranPastSoftLimit) sawPastSoftLimit += 1;
    }
    // The sweep genuinely exercises both branches and the soft-limit gate.
    expect(sawSurviveComplete).toBeGreaterThanOrEqual(5);
    expect(sawDefeat).toBeGreaterThanOrEqual(2);
    expect(sawPastSoftLimit).toBeGreaterThanOrEqual(1);
  });

  it('the survival window survives snapshot resume byte-for-byte (mid-window snapshot + restore)', { timeout: 120_000 }, () => {
    const s = Object.freeze({ id: 'resume', surviveTicks: 600, enemies: 2, playerLp: 2000, enemyAttack: 40, waveAtTick: 250 }) as Scenario;
    const systems = buildSystems(s.enemies, s.enemyAttack, s.surviveTicks, s.waveAtTick);

    // Uninterrupted reference through the window + terminal.
    const reference = new Map<number, { checksum: string; surviveComplete: boolean }>();
    let full: RunResult | null = null;
    {
      let state = buildBattle(s);
      const random = randomSession();
      let firstComplete: number | null = null;
      for (let t = 0; t < 1200; t++) {
        const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
        state = r.state;
        const survive = (state.objectives ?? []).find((o) => o.kind === 'survive_until');
        if (survive?.complete === true && firstComplete === null) firstComplete = state.tick;
        reference.set(state.tick, { checksum: createSnapshot(state).checksum, surviveComplete: survive?.complete === true });
        if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(state.phase.phase)) {
          full = { terminal: { phase: state.phase.phase, reason: state.endReason }, terminalTick: state.tick, firstSurviveCompleteTick: firstComplete, surviveCompleteAtTerminal: survive?.complete === true, checksum: createSnapshot(state).checksum, ranPastSoftLimit: state.tick > 2700 };
          break;
        }
      }
      // The window must actually elapse in this scenario (it proves the resume path).
      expect(full?.terminal?.phase).toBe('VICTORY');
      expect(full?.terminal?.reason).toBe('survive_complete');
      expect(reference.size).toBeGreaterThan(300);
    }

    // Resume mid-window (tick 200, before the wave at 250): every remaining tick
    // must be byte-identical to the uninterrupted run through the terminal.
    const resumeAt = 200;
    let current = buildBattle(s);
    const prefixRandom = randomSession();
    for (let t = 0; t < 1200 && current.tick < resumeAt; t++) {
      const r = stepBattle({ state: current, input, random: prefixRandom, rules: {}, content: {}, systems });
      current = r.state;
    }
    expect(current.tick).toBe(resumeAt);
    const snap = createSnapshot(current);
    expect(verifySnapshot(snap)).toBe(true);
    const restoredStreams = restoreStreamsForResume(snap.authoritativeStreams, [1, 2, 3, 4] as never);
    let resumed: BattleModel = snap;
    const resumedRandom = new RandomSession(restoredStreams, new RollSlotRegistry([]), false);
    let ticksCompared = 0;
    for (let t = resumeAt; t < 1200; t++) {
      const r = stepBattle({ state: resumed, input, random: resumedRandom, rules: {}, content: {}, systems });
      resumed = r.state;
      const expected = reference.get(resumed.tick);
      expect(expected, `tick ${String(resumed.tick)}`).toBeDefined();
      if (expected === undefined) throw new Error(`reference missing tick ${String(resumed.tick)}`);
      expect(createSnapshot(resumed).checksum, `checksum at tick ${String(resumed.tick)}`).toBe(expected.checksum);
      const survive = (resumed.objectives ?? []).find((o) => o.kind === 'survive_until');
      expect(survive?.complete === true, `survive at tick ${String(resumed.tick)}`).toBe(expected.surviveComplete);
      ticksCompared += 1;
      if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(resumed.phase.phase)) break;
    }
    // The resumed run crossed the window, the wave and the terminal.
    expect(ticksCompared).toBeGreaterThan(300);
    expect(resumed.endReason).toBe('survive_complete');
  });
});
