import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { createPhase21Systems } from '../../src/game/sim/core/phase21-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import type { Objective } from '../../src/game/sim/objectives/combat-objective.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { BossPhaseSnapshot, PhaseDefinition } from '../../src/game/sim/boss/boss-phase-system.js';
import { DEFAULT_TRANSITION_TICKS } from '../../src/game/sim/boss/boss-phase-system.js';
import { battle, entity, randomSession } from './test-helpers.js';

/**
 * Phase 21 §4/§5 boss-phase–objective status gate (§status-gate).
 *
 * A boss-phase transition COMMIT (stage L, `boss.l1`) and an objective-gated
 * battle end (stage L, `objective.l1`) are both stage-L systems, so they can
 * land in the SAME tick. Contract under test (no state-vs-terminal desync):
 *   1. DETERMINISM — every scenario reaches exactly one terminal, byte-identical
 *      across re-runs (same checksum, terminal phase/reason, phase trace).
 *   2. ONE RESOLVING — RESOLVING_END is entered at most once, never before the
 *      objective gate closed; the survive force fires exactly one terminal.
 *   3. PHASE VISIBILITY — the persisted `bossPhase.phaseId` ALWAYS equals the
 *      last `BossPhaseStarted` the event log recorded, never the pre-transition
 *      phase on a tick the transition committed (the status gate).
 *   4. SAME-TICK RACE — when the survive window elapses exactly the tick the
 *      phase transition commits (DEFAULT_TRANSITION_TICKS), BOTH effects land:
 *      the survive force ends VICTORY and the boss is observed committed to the
 *      target phase with its BossPhaseStarted event on that same tick.
 *   5. COMMIT BOUNDARY — a window that closes before the commit tick never sees
 *      the target phase (committed phasing is never back-dated), and a window
 *      that closes after it consistently observes the committed phase.
 */

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

const HARD_LIMIT = 5400;
const RESOLVING_WINDOW = 3;

const BOSS_ID = 'boss_ash_unit';
const BOSS_MAX_LP = 3000;
// Seeded at 40% HP → 400 permille, inside p2 [251,501): the tick-0 detect
// system plans p1 → p2 and commits at DEFAULT_TRANSITION_TICKS.
const BOSS_LP = 1200;

function phaseDefs(): readonly PhaseDefinition[] {
  return Object.freeze([
    Object.freeze({ id: 'p1', bossId: BOSS_ID, priority: 1, minHpPermille: 501, maxHpPermille: 1001, previewKey: 'preview_p1' }),
    Object.freeze({ id: 'p2', bossId: BOSS_ID, priority: 2, minHpPermille: 251, maxHpPermille: 501, previewKey: 'preview_p2' }),
    Object.freeze({ id: 'p3', bossId: BOSS_ID, priority: 3, minHpPermille: 0, maxHpPermille: 251, previewKey: 'preview_p3' }),
  ]);
}

function bossPhaseSeed(): BossPhaseSnapshot {
  return Object.freeze({ entityId: BOSS_ID, bossId: BOSS_ID, phaseId: 'p1', transition: null, visited: Object.freeze(['p1']), invulnerableUntilTick: null });
}

interface Scenario {
  readonly id: string;
  /** survive_until required ticks. */
  readonly surviveTicks: number;
  /** Seed the boss + phase set (else a plain no-phase objective battle). */
  readonly withPhase: boolean;
  /** Expected final boss phase observed at the terminal. */
  readonly expectedPhase: 'p1' | 'p2' | null;
}

const SCENARIOS: readonly Scenario[] = Object.freeze([
  // Window closes BEFORE the commit tick: the transition was planned but never
  // committed — the gate must not back-date it.
  Object.freeze({ id: 'window_before_commit', surviveTicks: 30, withPhase: true, expectedPhase: 'p1' }),
  // SAME-TICK RACE: window elapses exactly when the transition commits — both
  // effects land, no state-vs-terminal desync.
  Object.freeze({ id: 'window_same_tick_commit', surviveTicks: DEFAULT_TRANSITION_TICKS, withPhase: true, expectedPhase: 'p2' }),
  // Window closes AFTER the commit: the committed phase is consistently observed.
  Object.freeze({ id: 'window_after_commit', surviveTicks: 60, withPhase: true, expectedPhase: 'p2' }),
  // No-phase baseline: the objective gate still resolves cleanly.
  Object.freeze({ id: 'baseline_no_phase', surviveTicks: 20, withPhase: false, expectedPhase: null }),
]);

function buildSystems(s: Scenario): readonly KernelSystem[] {
  const objectives: readonly Objective[] = Object.freeze([
    Object.freeze({ id: 'obj_survive', kind: 'survive_until', targetId: null, required: s.surviveTicks, progress: 0, complete: false }),
  ]);
  const phaseConfig = s.withPhase ? { bossPhaseDefinitions: phaseDefs() } : {};
  return Object.freeze([
    ...createPhase17Systems({ speedsX100PerSecond: {} }),
    ...createPhase21Systems({ objectives, ...phaseConfig }),
  ]);
}

function buildBattle(s: Scenario): BattleModel {
  const player = migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
  // No attack params and no movement → a pure stall; both sides alive so the
  // survive force (not an elimination) resolves the battle.
  const enemy = migrateEntity({ entity: entity('unit_e0', { side: 'enemy', lane: 'middle', x100: 6200, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
  const boss = migrateEntity({ entity: entity(BOSS_ID, { side: 'enemy', lane: 'middle', x100: 7000, maxLp: BOSS_MAX_LP, lp: BOSS_LP }), radiusX100: 100 });
  return battle({
    simulationVersion: 'phase21-boss-phase-objective-fuzz-v1',
    entities: Object.freeze([player, enemy, boss]),
    abilities: Object.freeze([]),
    ...(s.withPhase ? { bossPhase: bossPhaseSeed() } : {}),
  });
}

interface RunResult {
  readonly terminal: { phase: string; reason: string | null } | null;
  readonly terminalTick: number;
  readonly firstResolvingEndTick: number | null;
  readonly finalBossPhaseId: string | null;
  /** ticks each BossPhaseStarted for p2 fired, in order. */
  readonly p2StartedTicks: readonly number[];
  /** true if any PhaseTransitionPlanned event was observed. */
  readonly sawTransitionPlanned: boolean;
  readonly checksum: string;
}

function runOnce(s: Scenario): RunResult {
  const systems = buildSystems(s);
  let state = buildBattle(s);
  const random = randomSession();
  let firstResolvingEndTick: number | null = null;
  const p2StartedTicks: number[] = [];
  let sawTransitionPlanned = false;
  let terminal: RunResult['terminal'] = null;
  let terminalTick = -1;
  for (let t = 0; t < HARD_LIMIT; t++) {
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    for (const event of r.events) {
      if (event.type === 'BossPhaseStarted' && event.contentIds.includes('p2')) p2StartedTicks.push(state.tick);
      if (event.type === 'PhaseTransitionPlanned') sawTransitionPlanned = true;
    }
    if (state.phase.phase === 'RESOLVING_END' && firstResolvingEndTick === null) firstResolvingEndTick = state.tick;
    if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(state.phase.phase)) {
      terminal = { phase: state.phase.phase, reason: state.endReason };
      terminalTick = state.tick;
      break;
    }
  }
  return {
    terminal,
    terminalTick,
    firstResolvingEndTick,
    finalBossPhaseId: state.bossPhase?.phaseId ?? null,
    p2StartedTicks: Object.freeze(p2StartedTicks),
    sawTransitionPlanned,
    checksum: createSnapshot(state).checksum,
  };
}

describe('P21 §4/§5 boss-phase–objective status gate', () => {
  it('the persisted boss phase and the objective-gated terminal never desync, including on the same-tick race', { timeout: 300_000 }, () => {
    const frame = DEFAULT_TRANSITION_TICKS; // the only commit boundary in these defs
    for (const s of SCENARIOS) {
      const a = runOnce(s);
      const b = runOnce(s);
      // 1. Determinism: one terminal, identical across re-runs.
      expect(b.terminal).toEqual(a.terminal);
      expect(b.checksum).toBe(a.checksum);
      expect(b.finalBossPhaseId).toBe(a.finalBossPhaseId);
      expect(b.p2StartedTicks).toEqual(a.p2StartedTicks);
      expect(a.terminal, s.id).not.toBeNull();
      if (a.terminal === null) throw new Error(`${s.id} stalled past the hard limit`);
      expect(a.terminalTick, `${s.id} within hard limit`).toBeLessThan(HARD_LIMIT);
      // 2. One resolving entry, and the objective gate closes before it.
      expect(a.firstResolvingEndTick, `${s.id} resolving entered`).not.toBeNull();
      if (a.firstResolvingEndTick === null) throw new Error(`${s.id} never resolved`);
      expect(a.firstResolvingEndTick, `${s.id} window closed before resolving`).toBeGreaterThanOrEqual(s.surviveTicks);
      // Single deterministic terminal through the objective force.
      expect(a.terminal.phase, `${s.id} victory`).toBe('VICTORY');
      expect(a.terminal.reason, `${s.id} survive force`).toBe('survive_complete');
      expect(a.terminalTick - a.firstResolvingEndTick, `${s.id} resolving window`).toBeLessThanOrEqual(RESOLVING_WINDOW + 2);

      if (!s.withPhase || s.expectedPhase === null) {
        // No-phase baseline: nothing phasic changes.
        expect(a.finalBossPhaseId).toBeNull();
        expect(a.p2StartedTicks).toEqual([]);
        expect(a.sawTransitionPlanned).toBe(false);
        continue;
      }

      // 3. STATUS GATE: the transition WAS planned (the boss sat in p2's bracket)
      // and the observed final phase matches the expected post-commit phase.
      expect(a.sawTransitionPlanned, `${s.id} transition planned`).toBe(true);
      const commitBoundary = frame + 1; // commit fires in step frame+1 (systems-tick frame)
      if (s.expectedPhase === 'p2') {
        // p2 must be the committed phase with its BossPhaseStarted in the log.
        expect(a.finalBossPhaseId, `${s.id} committed to p2`).toBe('p2');
        expect(a.p2StartedTicks.length, `${s.id} p2 started`).toBe(1);
        // 4. SAME-TICK RACE: the p2 start lands on the commit step.
        expect(a.p2StartedTicks[0], `${s.id} p2 committed tick`).toBe(commitBoundary);
        if (s.id === 'window_same_tick_commit') {
          // The survive force and the phase commit share the exact commit step,
          // and BOTH surfaces agree at the terminal.
          expect(a.terminalTick, `${s.id} terminal tick`).toBeGreaterThanOrEqual(commitBoundary);
          expect(a.finalBossPhaseId, `${s.id} phase visible at terminal`).toBe('p2');
          expect(a.p2StartedTicks[0]).toBe(a.firstResolvingEndTick ?? -1);
        } else {
          // window_after_commit: commit already landed, terminal later.
          expect(a.p2StartedTicks[0]).toBeLessThanOrEqual(a.firstResolvingEndTick ?? -1);
        }
        // 5. p3 was never entered (single descent only in this bracket).
        expect(a.finalBossPhaseId).not.toBe('p3');
      } else {
        // window_before_commit: the planned transition never committed.
        expect(a.finalBossPhaseId, `${s.id} still p1`).toBe('p1');
        expect(a.p2StartedTicks).toEqual([]);
        expect(a.finalBossPhaseId).not.toBe('p2');
      }
    }
  });
});
