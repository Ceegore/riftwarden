import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { createPhase21Systems } from '../../src/game/sim/core/phase21-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { COLLAPSE_HEAL_FACTOR_BPS, COLLAPSE_WINDOW_TICKS, SOFT_LIMIT_NORMAL_TICKS } from '../../src/game/sim/combat/battle-end-resolver.js';
import { mulDivRound } from '../../src/game/sim/math/fixed-math.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { Objective } from '../../src/game/sim/objectives/combat-objective.js';
import { battle, entity, randomSession, tick } from './test-helpers.js';

/**
 * Phase 21 §8 amount-fold heal oracle differential.
 *
 * `heal_sustain` folds the AMOUNT actually restored by each `HealApplied`
 * record (the post-factor `finalHpDelta`), so the collapse window's halving
 * (factor 5000) is applied at heal time and the fold just accumulates. A
 * clean-room oracle replays the raw event stream independently — re-deriving
 * the window factor from each heal's tick, recomputing the expected delta from
 * `rawAmount × factor` (clamped to the pre-heal room) — and the differential
 * compares the oracle's progress against the kernel's persisted objective
 * state TICK BY TICK. Contract:
 *   1. FACTOR FIDELITY — pre-window heals count full, in-window heals are
 *      halved (5000), post-window heals count full again.
 *   2. RECORD PERSISTENCE — every `HealApplied` record the kernel persists
 *      carries the exact post-factor amount the pipeline applied.
 *   3. ORACLE == KERNEL — the independently replayed progress equals the
 *      persisted objective progress at every observed tick (one-tick lag for
 *      the stage-L record fold).
 *   4. DETERMINISM — two identical runs produce identical checksums and
 *      per-heal deltas.
 */

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });
const SOFT = SOFT_LIMIT_NORMAL_TICKS; // 2700
const WINDOW_END = SOFT + COLLAPSE_WINDOW_TICKS; // 3150 — asserted below, not stepped past
const START = 2500;
const END = 3260;

const HEAL_OBJECTIVE: Objective = Object.freeze({ id: 'obj_heal', kind: 'heal_sustain', targetId: null, required: 3000, progress: 0, complete: false });

/** Clean-room window test: the collapse halving applies in [since, since + window). */
function inCollapseWindow(tickValue: number, sinceTick: number | undefined): boolean {
  return sinceTick !== undefined && tickValue >= sinceTick && tickValue < sinceTick + COLLAPSE_WINDOW_TICKS;
}

/** Clean-room delta: raw × factor (round-half-away-from-zero), clamped to the pre-heal room. */
function expectedDelta(rawAmount: number, hpBefore: number, maxLp: number, tickValue: number, sinceTick: number | undefined): number {
  const factor = inCollapseWindow(tickValue, sinceTick) ? COLLAPSE_HEAL_FACTOR_BPS : 10000;
  const scaled = mulDivRound(rawAmount, factor, 10000);
  return Math.min(scaled, Math.max(0, maxLp - hpBefore));
}

const SCRIPT: readonly (readonly [number, 'damage' | 'heal', number])[] = Object.freeze([
  [2500, 'damage', 900],
  [2600, 'heal', 600],
  [2740, 'damage', 300],
  [2750, 'heal', 600],
  [3100, 'damage', 200],
  [3200, 'heal', 600],
]);

interface TickObservation {
  readonly tick: number;
  readonly kernelProgress: number;
  readonly oracleProgress: number;
}

interface RunResult {
  readonly healDeltas: readonly number[];
  readonly oracleDeltas: readonly number[];
  readonly observations: readonly TickObservation[];
  readonly recordsMatchPayload: boolean;
  readonly checksum: string;
}

function run(): RunResult {
  const player = migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
  const enemy = migrateEntity({ entity: entity('unit_e0', { side: 'enemy', lane: 'middle', x100: 6200, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
  const systems: readonly KernelSystem[] = Object.freeze([
    ...createPhase17Systems({ speedsX100PerSecond: {} }),
    ...createPhase21Systems({ objectives: [HEAL_OBJECTIVE] }),
  ]);
  let state: BattleModel = battle({
    simulationVersion: 'phase21-heal-oracle-differential-v1',
    tick: tick(START),
    entities: Object.freeze([player, enemy]),
    abilities: Object.freeze([]),
  });
  const random = randomSession();
  const healDeltas: number[] = [];
  const oracleDeltas: number[] = [];
  const healByTick: { readonly tick: number; readonly delta: number }[] = [];
  const observations: TickObservation[] = [];
  let recordsMatchPayload = true;
  const appFor = (atTick: number): readonly (readonly [number, 'damage' | 'heal', number])[] => SCRIPT.filter(([t]) => t === atTick);

  const healApp = (amount: number, instance: number) => Object.freeze({ kind: 'heal', sourceId: 'unit_p', targetId: 'unit_p', effectId: 'ef_regen', attackInstanceId: instance, effectIndex: 0, rawAmount: amount, healFactorBps: 10000 });
  const damageApp = (amount: number, instance: number) => Object.freeze({ kind: 'damage', sourceId: 'unit_e0', targetId: 'unit_p', effectId: 'ef_hit', attackInstanceId: instance, effectIndex: 0, rawAmount: amount, damageTypeOrdinal: 0, defense: 0, coverReductionBps: 0, bossCapBps: null });

  for (let t = START; t < END; t++) {
    const due = appFor(t);
    if (due.length > 0) {
      let instance = t * 2;
      const applications = due.map(([, kind, amount]) => (kind === 'heal' ? healApp(amount, ++instance) : damageApp(amount, ++instance)));
      state = Object.freeze({ ...state, pendingCombatApplications: Object.freeze(applications) });
    }
    const since = state.timeCollapseSinceTick;
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    // Oracle replay of the heals applied AT this input tick, re-deriving the
    // factor and the clamped delta independently from the raw stream.
    const maxLp = 1000;
    for (const event of r.events) {
      if (event.type !== 'HealApplied' || event.targetIds.length !== 1) continue;
      const raw = event.payload['rawAmount'] ?? 0;
      const hpBefore = event.payload['hpBefore'] ?? 0;
      const observed = event.payload['finalHpDelta'] ?? 0;
      const expected = expectedDelta(raw, hpBefore, maxLp, t, since);
      healDeltas.push(observed);
      oracleDeltas.push(expected);
      healByTick.push(Object.freeze({ tick: t, delta: expected }));
      expect(expected, `oracle delta at tick ${t}`).toBe(observed);
      // Record persistence: the previous-tick record must carry the exact
      // post-factor amount the pipeline applied.
      const record = (state.previousTickEvents ?? []).find((rec) => rec.type === 'HealApplied');
      if (record !== undefined && record.amount !== observed) recordsMatchPayload = false;
    }
    // The stage-L fold consumes the PREVIOUS step's records: at output tick
    // T the persisted progress equals Σ deltas for heals applied at ticks ≤ T-2.
    const kernelProgress = (state.objectives ?? []).find((o) => o.kind === 'heal_sustain')?.progress ?? 0;
    const oracleUpTo = healByTick.filter((h) => h.tick <= state.tick - 2).reduce((sum, h) => sum + (h.delta > 0 ? h.delta : 0), 0);
    observations.push(Object.freeze({ tick: state.tick, kernelProgress, oracleProgress: oracleUpTo }));
    expect(kernelProgress, `kernel vs oracle at tick ${state.tick}`).toBe(oracleUpTo);
  }
  return {
    healDeltas: Object.freeze(healDeltas),
    oracleDeltas: Object.freeze(oracleDeltas),
    observations: Object.freeze(observations),
    recordsMatchPayload,
    checksum: createSnapshot(state).checksum,
  };
}

describe('P21 §8 amount-fold heal oracle differential', () => {
  it('replays the heal stream independently and matches the kernel objective state tick by tick', { timeout: 120_000 }, () => {
    const a = run();
    const b = run();
    // 4. Determinism.
    expect(b.checksum).toBe(a.checksum);
    expect(b.healDeltas).toEqual(a.healDeltas);
    // 1. FACTOR FIDELITY: pre 600 full, in-window 600→300 (halved), post full.
    expect(a.healDeltas).toContain(600);
    expect(a.healDeltas).toContain(300);
    expect(a.oracleDeltas).toEqual(a.healDeltas);
    // 2. RECORD PERSISTENCE: every persisted record amount matched its payload.
    expect(a.recordsMatchPayload).toBe(true);
    // 3. ORACLE == KERNEL at every observed tick (the differential holds).
    expect(a.observations.length).toBeGreaterThan(0);
    for (const obs of a.observations) {
      expect(obs.kernelProgress).toBe(obs.oracleProgress);
    }
    // The observations genuinely span the collapse window: pre-window, inside
    // it and post-window heals were all observed and folded.
    expect(a.observations.some((o) => o.tick < SOFT)).toBe(true);
    expect(a.observations.some((o) => o.tick > WINDOW_END)).toBe(true);
    const total = a.oracleDeltas.reduce((sum, delta) => sum + (delta > 0 ? delta : 0), 0);
    expect(total).toBe(1500); // 600 + 300 + 600
    const last = a.observations[a.observations.length - 1];
    expect(last?.kernelProgress).toBe(1500);
    expect(a.checksum.length).toBe(64);
  });
});
