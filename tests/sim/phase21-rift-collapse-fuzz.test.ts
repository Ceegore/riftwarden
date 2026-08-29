import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { createPhase21Systems } from '../../src/game/sim/core/phase21-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { objectiveAllowsBattleEnd, type Objective } from '../../src/game/sim/objectives/combat-objective.js';
import { GLOBAL_NO_PROGRESS_RESOLVE_TICKS, GLOBAL_NO_PROGRESS_WARNING_TICKS } from '../../src/game/sim/anti-stuck/anti-stuck.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import { battle, entity, randomSession } from './test-helpers.js';

/**
 * Phase 21 §9.4/§10 rift-collapse race fuzz.
 *
 * The global no-progress endcap (300 warning ticks + 300 collapse ticks) and
 * the objective-gated ends now interact. Contract under test:
 *   1. STALLS MUST COLLAPSE — a battle with no qualifying progress and no open
 *      objective fires exactly one RiftCollapseEndRequest the tick
 *      `collapseTicks === GLOBAL_NO_PROGRESS_RESOLVE_TICKS` (the exact-tick
 *      boundary) and reaches one deterministic terminal.
 *   2. OPEN OBJECTIVE GATES THE ENDCAP — while a survive_until window is still
 *      open the endcap must NOT fire, even deep into a no-progress stall: the
 *      battle holds until the window elapses and the mission force ends it.
 *   3. EXACT-TICK BOUNDARY — the tick the window elapses exactly when
 *      `collapseTicks` reaches the resolve threshold, the objective force wins
 *      (completion same-tick beats the endcap; no RiftCollapseEndRequest).
 *   4. ONE DETERMINISTIC TERMINAL — no double transition (RESOLVING_END is
 *      entered at most once, never back to ACTIVE), identical terminal +
 *      checksum across re-runs, and no RESOLVING_END before the objective
 *      gate closed.
 */

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

const HARD_LIMIT = 5400;
const RESOLVING_WINDOW = 3;

interface Scenario {
  readonly id: string;
  /** survive_until required ticks, or null for a no-objective battle. */
  readonly surviveTicks: number | null;
  /** Include a living enemy (both sides alive for the Chapter-76 finalize). */
  readonly withEnemy: boolean;
  readonly expectCollapse: boolean;
}

const SCENARIOS: readonly Scenario[] = Object.freeze([
  // Stall, no objectives: the endcap must fire at the exact collapse boundary
  // and the battle must reach one terminal through RESOLVING_END.
  Object.freeze({ id: 'stall_no_objectives', surviveTicks: null, withEnemy: true, expectCollapse: true }),
  // Stall with the survive window wide open (2000 ticks): the endcap is gated
  // for the whole stall and the window force ends the battle at 2000. The
  // living enemy keeps the mission real (no early elimination) while the
  // missing attack params keep the stall genuine.
  Object.freeze({ id: 'survive_hold_long', surviveTicks: 2000, withEnemy: true, expectCollapse: false }),
  // Exact-tick boundary: the window elapses the SAME systems-tick the endcap's
  // collapseTicks reaches GLOBAL_NO_PROGRESS_RESOLVE_TICKS (both at tick 599) —
  // completion wins and the gated endcap never fires.
  Object.freeze({ id: 'boundary_same_tick', surviveTicks: GLOBAL_NO_PROGRESS_WARNING_TICKS + GLOBAL_NO_PROGRESS_RESOLVE_TICKS - 1, withEnemy: true, expectCollapse: false }),
  // Completion one tick BEFORE the boundary: the mission force ends the battle
  // before the endcap could ever fire.
  Object.freeze({ id: 'boundary_previous_tick', surviveTicks: GLOBAL_NO_PROGRESS_WARNING_TICKS + GLOBAL_NO_PROGRESS_RESOLVE_TICKS - 2, withEnemy: true, expectCollapse: false }),
  // Completion one tick AFTER the boundary: the stall crossed the endcap
  // threshold while gated, then the window force ends the battle.
  Object.freeze({ id: 'boundary_next_tick', surviveTicks: GLOBAL_NO_PROGRESS_WARNING_TICKS + GLOBAL_NO_PROGRESS_RESOLVE_TICKS, withEnemy: true, expectCollapse: false }),
  // Completion early: the window closes long before the collapse window.
  Object.freeze({ id: 'completion_early', surviveTicks: 10, withEnemy: true, expectCollapse: false }),
]);

function buildSystems(s: Scenario): readonly KernelSystem[] {
  const objectives: readonly Objective[] = s.surviveTicks === null
    ? Object.freeze([])
    : Object.freeze([
        Object.freeze({ id: 'obj_survive', kind: 'survive_until', targetId: null, required: s.surviveTicks, progress: 0, complete: false }),
      ]);
  return Object.freeze([
    ...createPhase17Systems({ speedsX100PerSecond: {} }),
    ...createPhase21Systems({ objectives }),
  ]);
}

function buildBattle(s: Scenario): BattleModel {
  // No attack params and no movement: a pure no-progress stall (no qualifying
  // damage/kill/spawn events, so the global counters accumulate from tick 0).
  const player = migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
  const entities = [player];
  if (s.withEnemy) {
    entities.push(migrateEntity({ entity: entity('unit_e0', { side: 'enemy', lane: 'middle', x100: 6200, maxLp: 1000, lp: 1000 }), radiusX100: 100 }));
  }
  return battle({
    simulationVersion: 'phase21-collapse-fuzz-v1',
    entities: Object.freeze(entities),
    abilities: Object.freeze([]),
  });
}

interface RunResult {
  readonly terminal: { phase: string; reason: string | null } | null;
  readonly terminalTick: number;
  readonly collapseRequests: number;
  readonly firstResolvingEndTick: number | null;
  readonly firstAllCompleteTick: number | null;
  readonly riftCollapseEndTick: number | null;
  readonly checksum: string;
}

function runOnce(s: Scenario): RunResult {
  const systems = buildSystems(s);
  let state = buildBattle(s);
  const random = randomSession();
  let collapseRequests = 0;
  let riftCollapseEndTick: number | null = null;
  let firstResolvingEndTick: number | null = null;
  let firstAllCompleteTick: number | null = null;
  let terminal: RunResult['terminal'] = null;
  let terminalTick = -1;
  for (let t = 0; t < HARD_LIMIT; t++) {
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    for (const event of r.events) {
      if (event.type === 'RiftCollapseEndRequest') {
        collapseRequests += 1;
        if (riftCollapseEndTick === null) riftCollapseEndTick = state.tick;
      }
    }
    if (state.phase.phase === 'RESOLVING_END' && firstResolvingEndTick === null) firstResolvingEndTick = state.tick;
    if (objectiveAllowsBattleEnd(state.objectives ?? []) && firstAllCompleteTick === null) firstAllCompleteTick = state.tick;
    if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(state.phase.phase)) {
      terminal = { phase: state.phase.phase, reason: state.endReason };
      terminalTick = state.tick;
      break;
    }
  }
  return {
    terminal,
    terminalTick,
    collapseRequests,
    firstResolvingEndTick,
    firstAllCompleteTick,
    riftCollapseEndTick,
    checksum: createSnapshot(state).checksum,
  };
}

describe('P21 §9.4/§10 rift-collapse race fuzz', () => {
  it('the endcap fires at the exact collapse boundary and the objective gate holds it off', { timeout: 120_000 }, () => {
    for (const s of SCENARIOS) {
      const a = runOnce(s);
      const b = runOnce(s);
      // Determinism: one terminal, identical across re-runs.
      expect(b.terminal).toEqual(a.terminal);
      expect(b.checksum).toBe(a.checksum);
      expect(a.terminal, s.id).not.toBeNull();
      if (a.terminal === null) throw new Error(`${s.id} stalled past the hard limit`);
      expect(a.terminalTick, `${s.id} within hard limit`).toBeLessThan(HARD_LIMIT);
      // No double transition: RESOLVING_END is entered at most once (the ACTIVE
      // guards on the endcap and the objective force guarantee it).
      expect(a.firstResolvingEndTick === null || a.firstResolvingEndTick >= 0, s.id).toBe(true);
      expect(a.collapseRequests, `${s.id} at most one collapse request`).toBeLessThanOrEqual(1);

      if (s.expectCollapse) {
        // Stall without objectives: exactly one collapse request at the exact
        // tick collapseTicks reaches GLOBAL_NO_PROGRESS_RESOLVE_TICKS.
        expect(a.collapseRequests, `${s.id} collapse fired`).toBe(1);
        expect(a.riftCollapseEndTick, `${s.id} exact boundary tick`).toBe(GLOBAL_NO_PROGRESS_WARNING_TICKS + GLOBAL_NO_PROGRESS_RESOLVE_TICKS);
        expect(a.firstResolvingEndTick, `${s.id} resolving entered at boundary`).toBe(a.riftCollapseEndTick);
        // One deterministic terminal through the 3-tick resolving window.
        expect(a.terminalTick, `${s.id} terminal after resolving window`).toBeGreaterThanOrEqual((a.riftCollapseEndTick ?? 0) + RESOLVING_WINDOW);
        expect(a.terminalTick, `${s.id} terminal within resolving window`).toBeLessThanOrEqual((a.riftCollapseEndTick ?? 0) + RESOLVING_WINDOW + 2);
        // Both sides alive → the Chapter-76 finalize, not an elimination.
        expect(a.terminal.phase, `${s.id} chapter76 terminal`).toBe('DRAW_ABORT');
        expect(a.terminal.reason, `${s.id} chapter76 reason`).toBe('chapter76_timeout');
      } else {
        // The objective gate: no collapse request, no RESOLVING_END before the
        // mission closed — the battle holds until the window force ends it.
        expect(a.collapseRequests, `${s.id} no collapse while window open`).toBe(0);
        expect(a.firstAllCompleteTick, `${s.id} window elapsed`).not.toBeNull();
        if (a.firstAllCompleteTick === null) throw new Error(`${s.id} never completed`);
        if (a.firstResolvingEndTick !== null) {
          expect(a.firstResolvingEndTick, `${s.id} no resolving before the gate closed`).toBeGreaterThanOrEqual(a.firstAllCompleteTick);
        }
        expect(a.terminal.phase, `${s.id} victory`).toBe('VICTORY');
        expect(a.terminal.reason, `${s.id} survive force`).toBe('survive_complete');
        expect(a.terminalTick, `${s.id} window decides`).toBeGreaterThanOrEqual(a.firstAllCompleteTick);
        expect(a.terminalTick - a.firstAllCompleteTick, `${s.id} resolving window`).toBeLessThanOrEqual(RESOLVING_WINDOW + 2);
      }
    }
  });

  it('the exact-tick boundary (window elapse == collapse threshold) picks one deterministic winner', { timeout: 60_000 }, () => {
    // survive window == 599: the window elapses the same systems-tick the
    // collapse counter reaches GLOBAL_NO_PROGRESS_RESOLVE_TICKS (the endcap's
    // exact threshold). The endcap reads the pre-stage objectives (still
    // incomplete) so it is gated, and the objective force (priority 150) wins:
    // terminal survive_complete with NO RiftCollapseEndRequest — never a double
    // transition and never a rift-collapse terminal. The observed post-step
    // tick is 600 (systems-tick 599 + the step's tick increment).
    const s: Scenario = Object.freeze({ id: 'exact_boundary', surviveTicks: GLOBAL_NO_PROGRESS_WARNING_TICKS + GLOBAL_NO_PROGRESS_RESOLVE_TICKS - 1, withEnemy: true, expectCollapse: false });
    const a = runOnce(s);
    const b = runOnce(s);
    expect(b.terminal).toEqual(a.terminal);
    expect(b.checksum).toBe(a.checksum);
    expect(a.collapseRequests).toBe(0);
    expect(a.terminal?.phase).toBe('VICTORY');
    expect(a.terminal?.reason).toBe('survive_complete');
    expect(a.terminalTick).toBeGreaterThanOrEqual(GLOBAL_NO_PROGRESS_WARNING_TICKS + GLOBAL_NO_PROGRESS_RESOLVE_TICKS);
    expect(a.terminalTick).toBeLessThanOrEqual(GLOBAL_NO_PROGRESS_WARNING_TICKS + GLOBAL_NO_PROGRESS_RESOLVE_TICKS + RESOLVING_WINDOW + 2);
    // The single RESOLVING_END entry came from the objective force at the boundary.
    expect(a.firstResolvingEndTick).toBe(GLOBAL_NO_PROGRESS_WARNING_TICKS + GLOBAL_NO_PROGRESS_RESOLVE_TICKS);
    expect(a.firstAllCompleteTick).toBe(a.firstResolvingEndTick);
  });

  it('a completed mission never drifts into a rift-collapse terminal, even under stall', { timeout: 60_000 }, () => {
    // The window closes at tick 10 (completion_early): the mission force must
    // end the battle immediately — the no-progress stall that follows the
    // completion can never reach the collapse request.
    const s: Scenario = Object.freeze({ id: 'completion_early', surviveTicks: 10, withEnemy: true, expectCollapse: false });
    const a = runOnce(s);
    expect(a.collapseRequests).toBe(0);
    expect(a.terminal?.phase).toBe('VICTORY');
    expect(a.terminal?.reason).toBe('survive_complete');
    expect(a.terminalTick).toBeLessThanOrEqual(10 + RESOLVING_WINDOW + 2);
    expect(a.terminalTick).toBeGreaterThanOrEqual(10);
  });
});
