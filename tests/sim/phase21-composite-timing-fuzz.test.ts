import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { createPhase21Systems } from '../../src/game/sim/core/phase21-systems.js';
import { createSnapshot, verifySnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { restoreStreamsForResume } from '../../src/game/sim/snapshot/random-resume.js';
import { RandomSession } from '../../src/game/sim/random/random-session.js';
import { RollSlotRegistry } from '../../src/game/sim/random/roll-slot-registry.js';
import { evaluateComposite, objectiveAllowsBattleEnd, type CompositeCondition, type Objective } from '../../src/game/sim/objectives/combat-objective.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import { battle, entity, randomSession } from './test-helpers.js';
import { asX100 } from '../../src/game/sim/geometry/x100.js';

/**
 * Phase 21 §8 composite survive+kill timing fuzz.
 *
 * A composite mission is `survive_until` + a kill objective (`kill_boss` /
 * `kill_regulars`) with mixed completion orderings. The §8 contract
 * ("battle may end only when every objective is complete"):
 *   1. NO EARLY END — while any part of the composite is open the battle must
 *      not end by elimination, time limit or the no-progress endcap. The only
 *      legal terminal before the composite is complete is DEFEAT (the player
 *      died — the mission failed).
 *   2. NO VICTORY WHILE BLOCKED — the terminal VICTORY may only land once the
 *      composite ('all') is complete; a completed survive window alone must
 *      hold the battle open until the kill lands, and completed kills alone
 *      must hold it open until the window elapses.
 *   3. TERMINATION — every scenario terminates inside the resolving window
 *      (soft limit + collapse window is the deadline; the gates never stall).
 *   4. ORACLE — the clean-room verdict `evaluateComposite('all', objectives)`
 *      equals the runtime gate `objectiveAllowsBattleEnd`, and the terminal
 *      decision obeys it: VICTORY ⇔ all complete, DEFEAT ⇔ player dead.
 *   5. DETERMINISM — resume from a mid-window snapshot is byte-identical.
 */

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

const SOFT_LIMIT_NORMAL = 2700;
const COLLAPSE_WINDOW = 450;
const HARD_LIMIT = 5400;

interface Scenario {
  readonly id: string;
  readonly killKind: 'kill_boss' | 'kill_regulars';
  readonly killTargetId: string;
  /** HP of the kill target (250 damage per 10-tick player hit). */
  readonly killTargetLp: number;
  readonly surviveTicks: number;
  readonly playerLp: number;
  readonly enemyAttack: number;
  readonly enemies: number;
  /** Expected ordering: which part completes first. */
  readonly expectedFirst: 'kill' | 'survive';
  readonly expectedTerminal: 'VICTORY' | 'DEFEAT';
}

const SCENARIOS: readonly Scenario[] = Object.freeze([
  // kill completes first, the window decides: VICTORY survive_complete at the window.
  Object.freeze({ id: 'kill_first_regulars', killKind: 'kill_regulars', killTargetId: 'unit_kill_target', killTargetLp: 1000, surviveTicks: 600, playerLp: 3000, enemyAttack: 40, enemies: 1, expectedFirst: 'kill', expectedTerminal: 'VICTORY' }),
  // survive completes first (window 120), the tanky kill lands later: the gate must
  // hold the battle open past the window until the kill — no early VICTORY at 120.
  Object.freeze({ id: 'survive_first_tanky', killKind: 'kill_regulars', killTargetId: 'unit_kill_target', killTargetLp: 6500, surviveTicks: 120, playerLp: 3000, enemyAttack: 40, enemies: 1, expectedFirst: 'survive', expectedTerminal: 'VICTORY' }),
  // kill_boss variant, kill first.
  Object.freeze({ id: 'boss_kill_first', killKind: 'kill_boss', killTargetId: 'boss_ash_unit', killTargetLp: 2500, surviveTicks: 300, playerLp: 3000, enemyAttack: 40, enemies: 1, expectedFirst: 'kill', expectedTerminal: 'VICTORY' }),
  // kill_boss variant, survive first.
  Object.freeze({ id: 'boss_survive_first', killKind: 'kill_boss', killTargetId: 'boss_ash_unit', killTargetLp: 6000, surviveTicks: 120, playerLp: 3000, enemyAttack: 40, enemies: 1, expectedFirst: 'survive', expectedTerminal: 'VICTORY' }),
  // Survive window beyond the soft limit: kills complete early, the composite only
  // closes at the window (inside the collapse window) — termination by ~soft+window.
  Object.freeze({ id: 'kill_first_past_soft', killKind: 'kill_regulars', killTargetId: 'unit_kill_target', killTargetLp: 1000, surviveTicks: 2800, playerLp: 3000, enemyAttack: 40, enemies: 1, expectedFirst: 'kill', expectedTerminal: 'VICTORY' }),
  // Weak player: dies before anything completes → legal early DEFEAT.
  Object.freeze({ id: 'player_dies_first', killKind: 'kill_regulars', killTargetId: 'unit_kill_target', killTargetLp: 6500, surviveTicks: 600, playerLp: 300, enemyAttack: 120, enemies: 1, expectedFirst: 'survive', expectedTerminal: 'DEFEAT' }),
]);

function buildSystems(s: Scenario): readonly KernelSystem[] {
  const attackParams: Record<string, { attackIntervalTicks: number; prepareTicks: number; recoveryTicks: number; preferredRangeX100: ReturnType<typeof asX100>; delivery: { kind: 'direct'; rawAmount: number; damageTypeOrdinal: number; defense: number; bossCapBps: null } }> = {
    unit_p: {
      attackIntervalTicks: 10, prepareTicks: 1, recoveryTicks: 3, preferredRangeX100: asX100(9000),
      delivery: { kind: 'direct', rawAmount: 250, damageTypeOrdinal: 0, defense: 0, bossCapBps: null },
    },
  };
  // The kill target (and any extra regulars) attack the player with the
  // scenario's enemyAttack — keyed by the ACTUAL entity ids built in buildBattle.
  attackParams[s.killTargetId] = {
    attackIntervalTicks: 10, prepareTicks: 1, recoveryTicks: 3, preferredRangeX100: asX100(9000),
    delivery: { kind: 'direct', rawAmount: s.enemyAttack, damageTypeOrdinal: 0, defense: 0, bossCapBps: null },
  };
  for (let i = 1; i < s.enemies; i++) {
    attackParams[`unit_e${String(i - 1)}`] = {
      attackIntervalTicks: 10, prepareTicks: 1, recoveryTicks: 3, preferredRangeX100: asX100(9000),
      delivery: { kind: 'direct', rawAmount: s.enemyAttack, damageTypeOrdinal: 0, defense: 0, bossCapBps: null },
    };
  }
  const objectives: readonly Objective[] = Object.freeze([
    Object.freeze({ id: 'obj_survive', kind: 'survive_until', targetId: null, required: s.surviveTicks, progress: 0, complete: false }),
    Object.freeze({ id: 'obj_kill', kind: s.killKind, targetId: s.killKind === 'kill_boss' ? s.killTargetId : null, required: s.killKind === 'kill_regulars' ? s.enemies : 1, progress: 0, complete: false }),
  ]);
  return Object.freeze([
    ...createPhase17Systems({
      speedsX100PerSecond: {},
      basicAttack: { parameters: attackParams },
    }),
    ...createPhase21Systems({ objectives }),
  ]);
}

function buildBattle(s: Scenario): BattleModel {
  const player = migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: s.playerLp, lp: s.playerLp }), radiusX100: 100 });
  // The kill target is always the frontmost regular (kill_regulars required =
  // enemies + 1 counts it too); the boss id is a plain boss entity for kill_boss.
  const target = migrateEntity({ entity: entity(s.killTargetId, { side: 'enemy', lane: 'middle', x100: 6200, maxLp: s.killTargetLp, lp: s.killTargetLp }), radiusX100: 100 });
  const extras = Array.from({ length: Math.max(0, s.enemies - 1) }, (_, i) =>
    migrateEntity({ entity: entity(`unit_e${String(i)}`, { side: 'enemy', lane: i % 2 === 0 ? 'top' : 'bottom', x100: 6800 + i * 400, maxLp: 1000, lp: 1000 }), radiusX100: 100 }));
  return battle({
    simulationVersion: 'phase21-composite-fuzz-v1',
    entities: Object.freeze([player, target, ...extras]),
    abilities: Object.freeze([]),
  });
}

interface RunResult {
  readonly terminal: { phase: string; reason: string | null } | null;
  readonly terminalTick: number;
  readonly firstKillCompleteTick: number | null;
  readonly firstSurviveCompleteTick: number | null;
  readonly firstAllCompleteTick: number | null;
  readonly allCompleteAtTerminal: boolean;
  readonly playerDeadAtTerminal: boolean;
  readonly checksum: string;
}

function runOnce(s: Scenario): RunResult {
  const systems = buildSystems(s);
  let state = buildBattle(s);
  const random = randomSession();
  let firstKill: number | null = null;
  let firstSurvive: number | null = null;
  let firstAll: number | null = null;
  let terminal: RunResult['terminal'] = null;
  let terminalTick = -1;
  for (let t = 0; t < HARD_LIMIT; t++) {
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    const objectives = state.objectives ?? [];
    const kill = objectives.find((o) => o.id === 'obj_kill');
    const survive = objectives.find((o) => o.id === 'obj_survive');
    if (kill?.complete === true && firstKill === null) firstKill = state.tick;
    if (survive?.complete === true && firstSurvive === null) firstSurvive = state.tick;
    if (objectiveAllowsBattleEnd(objectives) && firstAll === null) firstAll = state.tick;
    if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(state.phase.phase)) {
      terminal = { phase: state.phase.phase, reason: state.endReason };
      terminalTick = state.tick;
      break;
    }
  }
  const terminalObjectives = state.objectives ?? [];
  return {
    terminal,
    terminalTick,
    firstKillCompleteTick: firstKill,
    firstSurviveCompleteTick: firstSurvive,
    firstAllCompleteTick: firstAll,
    allCompleteAtTerminal: objectiveAllowsBattleEnd(terminalObjectives),
    playerDeadAtTerminal: !state.entities.some((e) => e.side === 'player' && e.lp > 0 && (e.origin ?? 'regular') === 'regular'),
    checksum: createSnapshot(state).checksum,
  };
}

describe('P21 §8 composite survive+kill timing fuzz', () => {
  it('the terminal decision honors the composite gate across mixed completion orderings', { timeout: 300_000 }, () => {
    let sawSurviveFirst = 0;
    let sawKillFirst = 0;
    let sawDefeat = 0;
    let sawPastSoftLimit = 0;
    for (const s of SCENARIOS) {
      const a = runOnce(s);
      const b = runOnce(s);
      // Determinism: identical terminal + checksum per scenario.
      expect(b.terminal).toEqual(a.terminal);
      expect(b.checksum).toBe(a.checksum);
      expect(a.terminal, s.id).not.toBeNull();
      if (a.terminal === null) throw new Error(`${s.id} stalled past the hard limit`);
      if (s.expectedTerminal === 'VICTORY') {
        // NO EARLY END: nothing terminal while the composite is open — the
        // terminal tick must be ≥ the first tick every part was complete.
        expect(a.firstAllCompleteTick, `${s.id} composite closed before terminal`).not.toBeNull();
        if (a.firstAllCompleteTick === null) throw new Error(`${s.id} never completed`);
        expect(a.terminalTick, `${s.id} terminal after composite close`).toBeGreaterThanOrEqual(a.firstAllCompleteTick);
        expect(a.terminalTick - a.firstAllCompleteTick, `${s.id} resolving window`).toBeLessThanOrEqual(5);
        // NO VICTORY WHILE BLOCKED: the completed survive window alone never
        // ended the battle — the kill part was still open after it.
        if (s.expectedFirst === 'survive') {
          expect(a.firstKillCompleteTick, `${s.id} kill completes after survive`).not.toBeNull();
          if (a.firstKillCompleteTick === null) throw new Error(`${s.id} kill never landed`);
          expect(a.firstKillCompleteTick, `${s.id} kill after window`).toBeGreaterThan(a.firstSurviveCompleteTick ?? -1);
          expect(a.terminalTick, `${s.id} held open past window`).toBeGreaterThanOrEqual(a.firstKillCompleteTick);
          sawSurviveFirst += 1;
        } else {
          expect(a.firstSurviveCompleteTick, `${s.id} window elapses after kill`).not.toBeNull();
          if (a.firstSurviveCompleteTick === null) throw new Error(`${s.id} window never elapsed`);
          expect(a.firstSurviveCompleteTick).toBeGreaterThan(a.firstKillCompleteTick ?? -1);
          expect(a.terminalTick, `${s.id} held open until window`).toBeGreaterThanOrEqual(a.firstSurviveCompleteTick);
          sawKillFirst += 1;
        }
        // VICTORY ⇒ the clean-room composite ('all') was complete at the terminal.
        expect(a.allCompleteAtTerminal, `${s.id} all complete at victory`).toBe(true);
        expect(a.terminal.reason, `${s.id} victory reason`).toBe('survive_complete');
        expect(a.terminalTick, `${s.id} victory tick >= window`).toBeGreaterThanOrEqual(s.surviveTicks);
        // TERMINATION: never beyond the soft limit + collapse window (the
        // gates hold the battle open but never stall it).
        expect(a.terminalTick, `${s.id} within hard limit`).toBeLessThan(HARD_LIMIT);
        if (a.terminalTick > SOFT_LIMIT_NORMAL) sawPastSoftLimit += 1;
        expect(a.terminalTick, `${s.id} within collapse deadline`).toBeLessThanOrEqual(SOFT_LIMIT_NORMAL + COLLAPSE_WINDOW + 5);
      } else {
        // Legal early end: the player died before the composite closed.
        expect(a.playerDeadAtTerminal, `${s.id} player dead at defeat`).toBe(true);
        expect(a.terminal.phase, `${s.id} defeat`).toBe('DEFEAT');
        expect(a.terminal.reason, `${s.id} defeat reason`).toBe('side_eliminated');
        expect(a.allCompleteAtTerminal, `${s.id} no completion at defeat`).toBe(false);
        expect(a.firstSurviveCompleteTick, `${s.id} no survive before defeat`).toBeNull();
        sawDefeat += 1;
      }
    }
    // The sweep genuinely exercises both orderings and both terminals.
    expect(sawSurviveFirst).toBeGreaterThanOrEqual(2);
    expect(sawKillFirst).toBeGreaterThanOrEqual(2);
    expect(sawDefeat).toBeGreaterThanOrEqual(1);
    expect(sawPastSoftLimit).toBeGreaterThanOrEqual(1);
  });

  it('clean-room oracle: evaluateComposite("all") equals objectiveAllowsBattleEnd and drives the gate', { timeout: 60_000 }, () => {
    const composite: CompositeCondition = Object.freeze({ id: 'composite_mission', mode: 'all', objectiveIds: Object.freeze(['obj_survive', 'obj_kill']) });
    let sawOpen = 0;
    let sawClosed = 0;
    for (let i = 0; i < 20_000; i++) {
      const survive = i % 3 === 0;
      const kill = i % 5 === 0;
      const objectives: readonly Objective[] = createObjectives(survive, kill);
      const oracle = survive && kill;
      expect(evaluateComposite(composite, objectives), `case ${String(i)}`).toBe(oracle);
      expect(objectiveAllowsBattleEnd(objectives), `case ${String(i)} runtime gate`).toBe(oracle);
      if (oracle) sawClosed += 1;
      else sawOpen += 1;
    }
    // Both open and closed states are exercised non-trivially (closed = both
    // parts complete, i%15===0 across the 20k sweep).
    expect(sawOpen).toBeGreaterThan(5000);
    expect(sawClosed).toBeGreaterThan(1000);
    // An unknown objective id in the composite is a content error.
    expect(() => evaluateComposite({ ...composite, objectiveIds: Object.freeze(['obj_missing']) }, createObjectives(true, true))).toThrow(/P21_OBJECTIVE_INVALID/);
  });

  it('the composite hold survives snapshot resume byte-for-byte (mid-window resume)', { timeout: 120_000 }, () => {
    // kill-first scenario: kills close at ~tick 60, the survive window (600)
    // is the long pole. Resume at tick 300 — deep inside the hold between the
    // closed kill part and the still-open survive window.
    const s: Scenario = Object.freeze({ id: 'resume', killKind: 'kill_regulars', killTargetId: 'unit_kill_target', killTargetLp: 1000, surviveTicks: 600, playerLp: 3000, enemyAttack: 40, enemies: 1, expectedFirst: 'kill', expectedTerminal: 'VICTORY' });
    const systems = buildSystems(s);

    // Uninterrupted reference through the window + terminal.
    const reference = new Map<number, { checksum: string; allComplete: boolean }>();
    let full: RunResult | null = null;
    {
      let state = buildBattle(s);
      const random = randomSession();
      let firstAll: number | null = null;
      for (let t = 0; t < HARD_LIMIT; t++) {
        const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
        state = r.state;
        const objectives = state.objectives ?? [];
        if (objectiveAllowsBattleEnd(objectives) && firstAll === null) firstAll = state.tick;
        reference.set(state.tick, { checksum: createSnapshot(state).checksum, allComplete: objectiveAllowsBattleEnd(objectives) });
        if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(state.phase.phase)) {
          full = { terminal: { phase: state.phase.phase, reason: state.endReason }, terminalTick: state.tick, firstKillCompleteTick: null, firstSurviveCompleteTick: null, firstAllCompleteTick: firstAll, allCompleteAtTerminal: objectiveAllowsBattleEnd(objectives), playerDeadAtTerminal: false, checksum: createSnapshot(state).checksum };
          break;
        }
      }
      expect(full?.terminal?.phase).toBe('VICTORY');
      expect(full?.terminal?.reason).toBe('survive_complete');
      expect(reference.size).toBeGreaterThan(600);
    }

    // Resume at tick 300 — the kill part is closed, the survive window open.
    const resumeAt = 300;
    let current = buildBattle(s);
    const prefixRandom = randomSession();
    for (let t = 0; t < HARD_LIMIT && current.tick < resumeAt; t++) {
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
    for (let t = resumeAt; t < HARD_LIMIT; t++) {
      const r = stepBattle({ state: resumed, input, random: resumedRandom, rules: {}, content: {}, systems });
      resumed = r.state;
      const expected = reference.get(resumed.tick);
      expect(expected, `tick ${String(resumed.tick)}`).toBeDefined();
      if (expected === undefined) throw new Error(`reference missing tick ${String(resumed.tick)}`);
      expect(createSnapshot(resumed).checksum, `checksum at tick ${String(resumed.tick)}`).toBe(expected.checksum);
      const objectives = resumed.objectives ?? [];
      expect(objectiveAllowsBattleEnd(objectives), `all-complete at tick ${String(resumed.tick)}`).toBe(expected.allComplete);
      ticksCompared += 1;
      if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(resumed.phase.phase)) break;
    }
    // The resumed run crossed the window and the terminal from inside the hold.
    expect(ticksCompared).toBeGreaterThan(300);
    expect(resumed.endReason).toBe('survive_complete');
  });
});

/** Deterministic pair factory: both parts complete in every combination. */
function createObjectives(survive: boolean, kill: boolean): readonly Objective[] {
  return Object.freeze([
    Object.freeze({ id: 'obj_survive', kind: 'survive_until', targetId: null, required: 600, progress: survive ? 600 : 300, complete: survive }),
    Object.freeze({ id: 'obj_kill', kind: 'kill_regulars', targetId: null, required: 2, progress: kill ? 2 : 1, complete: kill }),
  ]);
}
