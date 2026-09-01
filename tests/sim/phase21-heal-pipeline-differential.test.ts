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
 * Phase 21 §8.3 heal-pipeline FULL differential.
 *
 * The amount oracle is extended from the objective fold to the WHOLE heal
 * application: a clean room recomputes, per target and per event, the complete
 * pipeline `rawAmount → collapse factor → clamp to pre-heal room` (including
 * MULTI-TARGET AoE heals with per-target room, content-supplied factors and
 * OVERHEAL discard) and compares EVERY `HealApplied` payload field
 * (rawAmount / finalHpDelta / hpBefore / hpAfter) against the kernel event
 * stream. The oracle tracks each unit's HP independently (damage follows the
 * stream, heals are fully re-derived), so `hpBefore` is itself independently
 * reproduced. Contract:
 *   1. FACTOR FIDELITY — outside the collapse window the content factor holds
 *      (7000 → 350); inside the window healing is halved (5000).
 *   2. PER-TARGET ROOM — an AoE batch clamps each target by ITS OWN pre-heal
 *      room (full, partial, and zero room in the same batch).
 *   3. OVERHEAL DISCARD — a heal at full HP restores 0 but still emits the
 *      event; hpAfter === hpBefore.
 *   4. FULL PAYLOAD EQUALITY — every field of every HealApplied equals the
 *      clean-room recompute at every observed tick.
 *   5. DETERMINISM — two identical runs produce the identical checksum and
 *      per-heal payload trace.
 */

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });
const START = 2500;
const END = 3300;
const MAX_LP: Readonly<Record<string, number>> = Object.freeze({ unit_p: 1000, unit_p2: 1200, unit_p3: 800 });

/** Mission gate: an incomplete heal_sustain keeps the battle ACTIVE past the
 * time-limit window so the post-window heals at 3200 are reachable. */
const GATE: Objective = Object.freeze({ id: 'obj_heal_gate', kind: 'heal_sustain', targetId: null, required: 100000, progress: 0, complete: false });

/** Clean-room window test: halving applies in [since, since + window). */
function inCollapseWindow(tickValue: number, sinceTick: number | undefined): boolean {
  return sinceTick !== undefined && tickValue >= sinceTick && tickValue < sinceTick + COLLAPSE_WINDOW_TICKS;
}

interface ScriptedHeal {
  readonly targetId: string;
  readonly rawAmount: number;
  /** Content-supplied heal factor (10000 = full outside the window). */
  readonly healFactorBps: number;
}
interface ScriptedDamage {
  readonly targetId: string;
  readonly rawAmount: number;
}

/** Per processed tick: what to queue as pendingCombatApplications. */
const SCRIPT: Readonly<Record<number, readonly (ScriptedHeal | ScriptedDamage)[]>> = Object.freeze({
  2600: Object.freeze([
    Object.freeze({ targetId: 'unit_p', rawAmount: 700 }),
    Object.freeze({ targetId: 'unit_p2', rawAmount: 500 }),
    Object.freeze({ targetId: 'unit_p3', rawAmount: 200 }),
  ]),
  // Content-supplied factor 7000, outside the window: 500 → 350.
  2620: Object.freeze([Object.freeze({ targetId: 'unit_p', rawAmount: 500, healFactorBps: 7000 })]),
  // AoE batch (shared attackInstanceId): per-target room 350 / 500 / 0.
  2700: Object.freeze([
    Object.freeze({ targetId: 'unit_p', rawAmount: 500, healFactorBps: 10000 }),
    Object.freeze({ targetId: 'unit_p2', rawAmount: 500, healFactorBps: 10000 }),
    Object.freeze({ targetId: 'unit_p3', rawAmount: 500, healFactorBps: 10000 }),
  ]),
  2740: Object.freeze([
    Object.freeze({ targetId: 'unit_p', rawAmount: 200 }),
    Object.freeze({ targetId: 'unit_p2', rawAmount: 300 }),
  ]),
  // In-window AoE (halved 600 → 300): room 200 / 300 / 0.
  2750: Object.freeze([
    Object.freeze({ targetId: 'unit_p', rawAmount: 600, healFactorBps: 10000 }),
    Object.freeze({ targetId: 'unit_p2', rawAmount: 600, healFactorBps: 10000 }),
    Object.freeze({ targetId: 'unit_p3', rawAmount: 600, healFactorBps: 10000 }),
  ]),
  // Post-window: full factor again, both targets have room.
  3200: Object.freeze([
    Object.freeze({ targetId: 'unit_p', rawAmount: 200, healFactorBps: 10000 }),
    Object.freeze({ targetId: 'unit_p2', rawAmount: 200, healFactorBps: 10000 }),
  ]),
});

const healApp = (heal: ScriptedHeal, instance: number, effectIndex: number) => Object.freeze({
  kind: 'heal', sourceId: 'unit_p', targetId: heal.targetId, effectId: 'ef_aoe',
  attackInstanceId: instance, effectIndex, rawAmount: heal.rawAmount, healFactorBps: heal.healFactorBps,
});
const damageApp = (damage: ScriptedDamage, instance: number) => Object.freeze({
  kind: 'damage', sourceId: 'unit_e0', targetId: damage.targetId, effectId: 'ef_hit',
  attackInstanceId: instance, effectIndex: 0, rawAmount: damage.rawAmount, damageTypeOrdinal: 0, defense: 0, coverReductionBps: 0, bossCapBps: null,
});

interface HealObservation {
  readonly tick: number;
  readonly targetId: string;
  readonly rawAmount: number;
  readonly factorBps: number;
  readonly scaled: number;
  readonly room: number;
  readonly delta: number;
  readonly payload: readonly [number, number, number, number];
}

interface RunResult {
  readonly observations: readonly HealObservation[];
  readonly deltas: readonly number[];
  readonly checksum: string;
}

function run(): RunResult {
  const player = migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
  const player2 = migrateEntity({ entity: entity('unit_p2', { side: 'player', lane: 'top', x100: 1800, maxLp: 1200, lp: 1200 }), radiusX100: 100 });
  const player3 = migrateEntity({ entity: entity('unit_p3', { side: 'player', lane: 'bottom', x100: 1800, maxLp: 800, lp: 800 }), radiusX100: 100 });
  const enemy = migrateEntity({ entity: entity('unit_e0', { side: 'enemy', lane: 'middle', x100: 6200, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
  const systems: readonly KernelSystem[] = Object.freeze([
    ...createPhase17Systems({ speedsX100PerSecond: {} }),
    ...createPhase21Systems({ objectives: [GATE] }),
  ]);
  let state: BattleModel = battle({
    simulationVersion: 'phase21-heal-pipeline-differential-v1',
    tick: tick(START),
    entities: Object.freeze([player, player2, player3, enemy]),
    abilities: Object.freeze([]),
  });
  const random = randomSession();
  // Independent clean-room HP ledger (damage follows the stream, heals are
  // fully re-derived from rawAmount × factor clamped to the per-target room).
  const oracleHp: Record<string, number> = { unit_p: 1000, unit_p2: 1200, unit_p3: 800 };
  const observations: HealObservation[] = [];

  for (let t = START; t < END; t++) {
    const due = SCRIPT[t];
    if (due !== undefined) {
      // One shared attackInstanceId per batch: the AoE identity. Per-target
      // effectIndex keeps the batch entries distinct.
      const instance = t * 10;
      let effectIndex = 0;
      const applications = due.map((action) => {
        if ('healFactorBps' in action) return healApp(action, instance, effectIndex++);
        return damageApp(action, instance);
      });
      state = Object.freeze({ ...state, pendingCombatApplications: Object.freeze(applications) });
    }
    // Window state as the kernel sees it THIS tick (stage L opens it at the
    // soft limit; stage-I heals in the same tick still use the prior value).
    const since = state.timeCollapseSinceTick;
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    for (const event of r.events) {
      const targetId = event.targetIds[0];
      if (targetId === undefined) continue;
      if (event.type === 'DamageApplied') {
        // Damage is authoritative input to the heal oracle.
        oracleHp[targetId] = event.payload['hpAfter'] ?? oracleHp[targetId] ?? 0;
        continue;
      }
      if (event.type !== 'HealApplied') continue;
      const raw = event.payload['rawAmount'] ?? 0;
      const observed = event.payload['finalHpDelta'] ?? 0;
      const hpBefore = event.payload['hpBefore'] ?? 0;
      const hpAfter = event.payload['hpAfter'] ?? 0;
      const maxLp = MAX_LP[targetId];
      if (maxLp === undefined) throw new Error(`untracked heal target ${targetId}`);
      const scripted = SCRIPT[state.tick - 1]?.find((a) => 'healFactorBps' in a && a.targetId === targetId);
      if (scripted === undefined || !('healFactorBps' in scripted)) throw new Error(`heal at ${String(state.tick)} has no script entry`);
      // Clean-room recompute of the WHOLE application:
      const factor = inCollapseWindow(t, since) ? Math.min(scripted.healFactorBps, COLLAPSE_HEAL_FACTOR_BPS) : scripted.healFactorBps;
      const scaled = mulDivRound(raw, factor, 10000);
      const room = Math.max(0, maxLp - (oracleHp[targetId] ?? 0));
      const delta = Math.min(scaled, room);
      // 4. FULL PAYLOAD EQUALITY.
      expect(raw, `rawAmount at tick ${String(t)} for ${targetId}`).toBe(scripted.rawAmount);
      expect(hpBefore, `hpBefore at tick ${String(t)} for ${targetId}`).toBe(oracleHp[targetId] ?? 0);
      expect(observed, `finalHpDelta at tick ${String(t)} for ${targetId}`).toBe(delta);
      expect(hpAfter, `hpAfter at tick ${String(t)} for ${targetId}`).toBe(hpBefore + delta);
      observations.push(Object.freeze({
        tick: t, targetId, rawAmount: raw, factorBps: factor, scaled, room, delta,
        payload: Object.freeze([raw, observed, hpBefore, hpAfter] as const),
      }));
      oracleHp[targetId] = hpAfter;
    }
  }
  return {
    observations: Object.freeze(observations),
    deltas: Object.freeze(observations.map((o) => o.delta)),
    checksum: createSnapshot(state).checksum,
  };
}

describe('P21 §8.3 heal-pipeline full differential', () => {
  it('recomputes the whole heal application per target (AoE room + overheal + factors) and matches every payload field', { timeout: 120_000 }, () => {
    const a = run();
    const b = run();
    // 5. DETERMINISM.
    expect(b.checksum).toBe(a.checksum);
    expect(b.observations).toEqual(a.observations);

    // 1. FACTOR FIDELITY: 500 @ 7000 → 350 outside the window; 600 → 300
    // (halved) inside it; 200 full after the window.
    expect(a.deltas).toContain(350);
    expect(a.deltas).toContain(300);
    expect(a.deltas).toContain(200);
    const inWindow = a.observations.filter((o) => o.factorBps === COLLAPSE_HEAL_FACTOR_BPS);
    expect(inWindow.length).toBeGreaterThan(0);
    // 2. PER-TARGET ROOM in the 2700 AoE batch: 350 (room 350), 500 (room 500),
    // 200 (room 200) — every target clamps by ITS OWN pre-heal room.
    expect(a.observations).toContainEqual(expect.objectContaining({ tick: 2700, targetId: 'unit_p', room: 350, delta: 350 }));
    expect(a.observations).toContainEqual(expect.objectContaining({ tick: 2700, targetId: 'unit_p2', room: 500, delta: 500 }));
    expect(a.observations).toContainEqual(expect.objectContaining({ tick: 2700, targetId: 'unit_p3', room: 200, delta: 200 }));
    // 3. OVERHEAL DISCARD: unit_p3 at full HP restores 0 (event still emitted).
    expect(a.observations).toContainEqual(expect.objectContaining({ tick: 2750, targetId: 'unit_p3', room: 0, delta: 0 }));
    // In-window clamping: halved 300 then clamped to the per-target room.
    expect(a.observations).toContainEqual(expect.objectContaining({ tick: 2750, targetId: 'unit_p', scaled: 300, room: 200, delta: 200 }));
    expect(a.observations).toContainEqual(expect.objectContaining({ tick: 2750, targetId: 'unit_p2', scaled: 300, room: 300, delta: 300 }));
    // Post-window full factor.
    expect(a.observations).toContainEqual(expect.objectContaining({ tick: 3200, targetId: 'unit_p', factorBps: 10000, delta: 200 }));
    // The observation set spans pre-window, in-window and post-window ticks.
    expect(a.observations.some((o) => o.tick < SOFT_LIMIT_NORMAL_TICKS)).toBe(true);
    expect(a.observations.some((o) => o.tick >= SOFT_LIMIT_NORMAL_TICKS && o.tick < SOFT_LIMIT_NORMAL_TICKS + COLLAPSE_WINDOW_TICKS)).toBe(true);
    expect(a.observations.some((o) => o.tick > SOFT_LIMIT_NORMAL_TICKS + COLLAPSE_WINDOW_TICKS)).toBe(true);
    // 4. FULL PAYLOAD EQUALITY held for every event (asserted inline in run()).
    expect(a.observations.length).toBe(9);
    expect(a.checksum.length).toBe(64);
  });
});
