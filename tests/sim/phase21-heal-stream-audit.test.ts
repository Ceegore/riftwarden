import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { createPhase21Systems } from '../../src/game/sim/core/phase21-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { buildBossObject, buildBossObjectBody, type BossObjectContent, type DamagePolicy } from '../../src/game/sim/boss/boss-object-manager.js';
import { COLLAPSE_HEAL_FACTOR_BPS, COLLAPSE_WINDOW_TICKS } from '../../src/game/sim/combat/battle-end-resolver.js';
import { mulDivRound } from '../../src/game/sim/math/fixed-math.js';
import { asX100 } from '../../src/game/sim/geometry/x100.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { Objective } from '../../src/game/sim/objectives/combat-objective.js';
import type { ModifierDefinition } from '../../src/game/sim/world/modifier-system.js';
import { battle, entity, randomSession, tick } from './test-helpers.js';

/**
 * Phase 21 §8.3 heal-stream AUDIT — a clean-room recompute of the heal_sustain
 * objective counter from the RAW lifesteal heal stream, exactly as the kernel
 * folds it. Where the heal-pipeline differential showed the WHOLE heal
 * application for injected heals, this drives heals from the REAL lifesteal
 * source (`on_damage_applied` heal_bps) across the §6 gates and the §10 window,
 * and cross-checks the OBJECTIVE counter tick by tick:
 *
 *   1. FACTOR + ROOM + OVERHEAL — the clean room re-derives every applied heal
 *      (`rawAmount × factor → clamp to the target's own pre-heal room`), using
 *      an INDEPENDENT HP ledger (damages follow the stream); the §10 window
 *      halves the factor (5000), and an overheal at full HP is DISCARDED
 *      (delta 0 → contributes NOTHING — sustain counts restored HP, pinned
 *      policy). Every `HealApplied` payload field is asserted.
 *   2. §6 IMMUNE GATE — a healer whose only target is an `immune` boss object
 *      never heals (blocked lifesteal) and contributes nothing to the counter;
 *      a healer on a `shield_only` object does.
 *   3. OBJECTIVE FOLD — after each tick the kernel's heal_sustain `progress`
 *      equals Σ (delta > 0 ? delta : 0) over heals applied at ticks ≤ t-2
 *      (the stage-L previous-tick fold latency) — reproduced with the SAME
 *      delta the oracle just verified.
 *   4. DETERMINISM — two identical runs give the identical checksum + trace.
 *   5. POLICY MATRIX — every cell of {unit, shield_only, immune} TARGET SET ×
 *      {full, halved} × {single 5000, composite 5000×6000→3000} reproduces
 *      the kernel counter: an immune object blocks every heal, a shield_only
 *      object (or plain unit) heals at exactly the folded raw, and blocked
 *      events always name the immune object.
 */

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

/** Build the modifier set for a bps list: composite heal_bps folds multiplicatively. */
const modifiersFor = (bpsList: readonly number[]): readonly ModifierDefinition[] =>
  bpsList.map((bps, i) =>
    Object.freeze({
      id: `mod_fixture_lifesteal_${String(i)}`, previewKey: 'preview_ls', hooks: Object.freeze(['on_damage_applied'] as const), incompatibilityTags: Object.freeze([]), params: Object.freeze({ heal_bps: bps }),
    }));

/** heal_sustain gate: incomplete past the run window keeps the fight active. */
const GATE: Objective = Object.freeze({ id: 'obj_heal_audit', kind: 'heal_sustain', targetId: null, required: 50000, progress: 0, complete: false });

const SHIELD_OBJ = 'obj_shield_audit';
const IMMUNE_OBJ = 'obj_immune_audit';
const MAX_LP = 5000;
const HEAL_RAW = mulDivRound(300, 5000, 10000); // attacker hit 300 @ heal_bps 5000 → 150

/** §7 multiplicative hook fold: 10000 → b0 → b0×b1/10000 → … */
const scaleOf = (bpsList: readonly number[]): number =>
  bpsList.reduce((scale, bps) => mulDivRound(scale, bps, 10000), 10000);

type TargetMode = 'unit' | 'shield_only' | 'immune';

const object = (entityId: string, damagePolicy: 'shield_only' | 'immune', slotId: 'boss_slot_0' | 'boss_slot_1'): BossObjectContent => Object.freeze({
  entityId, side: 'enemy', ownerId: 'owner', sourceId: 'content',
  spec: Object.freeze({ slotId, lane: 'middle', x100: 6200, targetable: true, objectiveLink: null, damagePolicy, statusPolicy: 'allow', cleanupPolicy: 'manual', fallback: 'FAIL' }),
  maxLp: 800, radiusX100: 120,
});
const shieldObject = object(SHIELD_OBJ, 'shield_only', 'boss_slot_0');
const immuneObject = object(IMMUNE_OBJ, 'immune', 'boss_slot_1');

const mk = (id: string, side: 'player' | 'enemy', maxLp: number, lp: number, lane: 'middle' | 'top', x100: number) =>
  migrateEntity({ entity: entity(id, { side, lane, x100, maxLp, lp }), radiusX100: 100 });

const attack = (rawAmount: number) => Object.freeze({
  attackIntervalTicks: 10, prepareTicks: 1, recoveryTicks: 3, preferredRangeX100: asX100(9000),
  delivery: Object.freeze({ kind: 'direct', rawAmount, damageTypeOrdinal: 0, defense: 0, bossCapBps: null }),
});

const inCollapseWindow = (tickValue: number, sinceTick: number | undefined): boolean =>
  sinceTick !== undefined && tickValue >= sinceTick && tickValue < sinceTick + COLLAPSE_WINDOW_TICKS;

type Mode = 'full' | 'halved';
interface RunResult {
  readonly state: BattleModel;
  readonly applied: readonly number[];
  readonly objectiveTotal: number;
  readonly shieldProcs: number;
  readonly immuneBlocked: number;
  readonly blockedTargets: readonly string[];
  readonly checksum: string;
}

interface CellOptions {
  readonly mode: Mode;
  readonly healBpsList: readonly number[];
  /** Boss objects present in the cell; an empty list means the units fight the enemy unit only. */
  readonly bossObjects: readonly BossObjectContent[];
  readonly focusTargetId: Record<string, string>;
}

/** Default cell for the two focused tests: shield_only vs immune healers, single 5000 modifier. */
const run = (mode: Mode): RunResult => runCell({
  mode, healBpsList: [5000],
  bossObjects: [shieldObject, immuneObject],
  focusTargetId: { unit_p: SHIELD_OBJ, unit_p2: IMMUNE_OBJ, unit_e1: 'unit_p' },
});

function runCell({ mode, healBpsList, bossObjects, focusTargetId }: CellOptions): RunResult {
  const a = mk('unit_p', 'player', MAX_LP, 1000, 'middle', 1800);
  const b = mk('unit_p2', 'player', MAX_LP, 3000, 'top', 2400);
  const enemy = mk('unit_e1', 'enemy', 1000, 1000, 'middle', 6200);
  const bodies = bossObjects.map((o, i) => buildBossObjectBody(o, tick(i)));
  const temps = bossObjects.map((o, i) => buildBossObject(o.spec, o.entityId, o.side, o.ownerId, o.sourceId, 0, i));
  const systems: readonly KernelSystem[] = Object.freeze([
    ...createPhase17Systems({
      speedsX100PerSecond: {},
      bossObjectPolicies: new Map(bossObjects.map((o) => [o.entityId, o.spec.damagePolicy] as [string, DamagePolicy])),
      targeting: { focusTargetId },
      basicAttack: { parameters: { unit_p: attack(300), unit_p2: attack(300), unit_e1: attack(60) } },
    }),
    ...createPhase21Systems({ bossObjects, modifiers: modifiersFor(healBpsList), objectives: [GATE] }),
  ]);
  // §10: the 'halved' mode seeds the collapse window OPEN at tick 0 so every
  // heal factor is the 5000 halving; the 'full' mode starts fresh (heals at
  // factor 10000 — the window never opens because heals are qualifying progress).
  let state: BattleModel = battle({
    simulationVersion: 'phase21-heal-stream-audit-v1',
    tick: tick(0),
    entities: Object.freeze([a, b, enemy, ...bodies]),
    temporaryEntities: Object.freeze(temps),
    abilities: Object.freeze([]),
    ...(mode === 'halved' ? { timeCollapseSinceTick: 0 } : {}),
  });
  const random = randomSession();
  const expectedRaw = mulDivRound(300, scaleOf(healBpsList), 10000);

  // Independent clean-room HP ledger (damage follows the stream; heals are
  // fully re-derived from rawAmount × factor clamped to the target's room).
  // Lifesteal is SYMMETRIC, so the attacking enemy self-heals too — track it.
  const maxByTarget: Record<string, number> = { unit_p: MAX_LP, unit_p2: MAX_LP, unit_e1: 1000 };
  const oracleHp: Record<string, number> = { unit_p: 1000, unit_p2: 3000, unit_e1: 1000 };
  // Sum of restored HP per heal tick (overheal 0 contributes nothing) —
  // matched to the fold latency ≤ t-2.
  const healByTick: { readonly tick: number; readonly delta: number }[] = [];
  const applied: number[] = [];
  const immuneBlocked: string[] = [];

  for (let t = 0; t < 200; t++) {
    const since = state.timeCollapseSinceTick;
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    for (const event of r.events) {
      const targetId = event.targetIds[0];
      if (targetId === undefined) continue;
      if (event.type === 'DamageApplied') {
        // Damage to a healer lowers the oracle ledger (authoritative input).
        oracleHp[targetId] = event.payload['hpAfter'] ?? oracleHp[targetId] ?? 0;
        continue;
      }
      if (event.type === 'LifestealBlocked') {
        immuneBlocked.push(targetId);
        continue;
      }
      if (event.type !== 'HealApplied') continue;
      // 1. FACTOR + ROOM + OVERHEAL (clean-room recompute, independent ledger).
      const factor = inCollapseWindow(t, since) ? COLLAPSE_HEAL_FACTOR_BPS : 10000;
      const scaled = mulDivRound(event.payload['rawAmount'] ?? 0, factor, 10000);
      const maxLp = maxByTarget[targetId] ?? MAX_LP;
      const room = Math.max(0, maxLp - (oracleHp[targetId] ?? 0));
      const delta = Math.min(scaled, room);
      const hpBefore = event.payload['hpBefore'] ?? 0;
      const observed = event.payload['finalHpDelta'] ?? 0;
      const hpAfter = event.payload['hpAfter'] ?? 0;
      expect(hpBefore, `hpBefore at tick ${String(t)} for ${targetId}`).toBe(oracleHp[targetId] ?? 0);
      expect(observed, `finalHpDelta at tick ${String(t)} for ${targetId}`).toBe(delta);
      expect(hpAfter, `hpAfter at tick ${String(t)} for ${targetId}`).toBe(hpBefore + delta);
      oracleHp[targetId] = hpBefore + delta;
      applied.push(delta);
      healByTick.push(Object.freeze({ tick: t, delta }));
    }
    // 3. OBJECTIVE FOLD: the stage-L resolver consumed the records of tick t-2,
    // so the kernel progress equals Σ restored HP (overheal contributes 0)
    // over heals with tick ≤ t-2.
    const kernelProgress = (state.objectives ?? []).find((o) => o.kind === 'heal_sustain')?.progress ?? 0;
    const oracleUpTo = healByTick.filter((h) => h.tick <= state.tick - 2).reduce((sum, h) => sum + (h.delta > 0 ? h.delta : 0), 0);
    expect(kernelProgress, `objective fold at tick ${String(state.tick)}`).toBe(oracleUpTo);
  }

  return {
    state,
    applied: Object.freeze(applied),
    objectiveTotal: healByTick.reduce((sum, h) => sum + (h.delta > 0 ? h.delta : 0), 0),
    shieldProcs: healByTick.filter((h) => h.delta === (mode === 'halved' ? mulDivRound(expectedRaw, COLLAPSE_HEAL_FACTOR_BPS, 10000) : expectedRaw)).length,
    immuneBlocked: immuneBlocked.length,
    blockedTargets: Object.freeze(immuneBlocked),
    checksum: createSnapshot(state).checksum,
  };
}

describe('P21 §8.3 lifesteal × heal_sustain objective heal-stream audit', () => {
  it('a clean-room recompute of the lifesteal heal stream matches the kernel objective counter tick by tick (full factor)', { timeout: 120_000 }, () => {
    const a = run('full');
    const b = run('full');
    // 4. DETERMINISM.
    expect(b.state === a.state).toBe(false);
    expect(b.checksum).toBe(a.checksum);
    expect(b.applied).toEqual(a.applied);

    // The healer A (shield_only target) actually healed at the full factor.
    expect(a.applied.length).toBeGreaterThan(0);
    expect(a.applied).toContain(HEAL_RAW);
    // 2. §6 IMMUNE GATE exercised: blocked events were emitted ONLY for the
    //    immune object's target, and every applied heal came off the shield_only
    //    path (unit_p2, whose target is immune, never produces a HealApplied so
    //    it contributes nothing).
    expect(a.blockedTargets).toContain(IMMUNE_OBJ);
    expect(a.blockedTargets).not.toContain(SHIELD_OBJ);
    // The final kernel objective equals the oracle's Σ.
    const kernel = (a.state.objectives ?? []).find((o) => o.kind === 'heal_sustain');
    expect(kernel?.progress).toBe(a.objectiveTotal);
    expect(kernel?.progress).toBeGreaterThan(0);
    expect(kernel?.complete).toBe(false);
    expect(a.checksum.length).toBe(64);
  });

  it('during the §10 collapse window the halved heals still reproduce the kernel counter exactly', { timeout: 120_000 }, () => {
    const a = run('halved');
    expect(a.applied.length).toBeGreaterThan(0);
    // Everything here is halved (5000): a shield-only full heal is HALF of the
    // full-factor one, and the objective follows it tick for tick.
    const halved = mulDivRound(HEAL_RAW, COLLAPSE_HEAL_FACTOR_BPS, 10000);
    expect(a.applied.every((d) => d <= halved)).toBe(true);
    expect(a.shieldProcs).toBeGreaterThan(0);
    const kernel = (a.state.objectives ?? []).find((o) => o.kind === 'heal_sustain');
    expect(kernel?.progress).toBe(a.objectiveTotal);
    expect(kernel?.progress).toBeGreaterThan(0);
    // The halved run is deterministic too.
    expect(run('halved').checksum).toBe(a.checksum);
  });

  it('the target-set × phase × composite-heal matrix reproduces the kernel counter in every cell', { timeout: 120_000 }, () => {
    // {unit, shield_only, immune} as the damage-target SET (both healers share
    // it — boss objects take targeting priority over units, so per-healer
    // mixing is not expressible), both §10 phases, and {single 5000, composite
    // 5000×6000→3000} heal_bps.
    const cellFor = (targetMode: TargetMode, mode: Mode, bps: readonly number[]): CellOptions => {
      if (targetMode === 'unit') return { mode, healBpsList: bps, bossObjects: [], focusTargetId: { unit_p: 'unit_e1', unit_p2: 'unit_e1', unit_e1: 'unit_p' } };
      if (targetMode === 'shield_only') return { mode, healBpsList: bps, bossObjects: [shieldObject], focusTargetId: { unit_p: SHIELD_OBJ, unit_p2: SHIELD_OBJ, unit_e1: 'unit_p' } };
      return { mode, healBpsList: bps, bossObjects: [immuneObject], focusTargetId: { unit_p: IMMUNE_OBJ, unit_p2: IMMUNE_OBJ, unit_e1: 'unit_p' } };
    };
    const targetModes: readonly TargetMode[] = ['unit', 'shield_only', 'immune'];
    const bpsSets: readonly (readonly number[])[] = [[5000], [5000, 6000]];
    const modes: readonly Mode[] = ['full', 'halved'];
    for (const targetMode of targetModes) {
      for (const mode of modes) {
        for (const bps of bpsSets) {
          const cell = runCell(cellFor(targetMode, mode, bps));
          const expectedRaw = mulDivRound(300, scaleOf(bps), 10000);
          const kernel = (cell.state.objectives ?? []).find((o) => o.kind === 'heal_sustain');
          // The objective counter reproduces the clean-room Σ in every cell.
          expect(kernel?.progress).toBe(cell.objectiveTotal);
          // An immune object blocks EVERY heal; a unit or shield_only object
          // heals at exactly the (composite) folded raw, scaled by the §10
          // window factor for the halved phase.
          if (targetMode === 'immune') {
            // Nothing is ever RESTORED: every heal is either blocked or an
            // overheal, so the counter stays at zero for the whole run.
            expect(cell.objectiveTotal).toBe(0);
            expect(cell.applied.every((d) => d === 0)).toBe(true);
            expect(cell.blockedTargets.length).toBeGreaterThan(0);
            expect(cell.blockedTargets.every((t) => t === IMMUNE_OBJ)).toBe(true);
          } else {
            expect(cell.blockedTargets).toEqual([]);
            const cellRaw = mode === 'halved' ? mulDivRound(expectedRaw, COLLAPSE_HEAL_FACTOR_BPS, 10000) : expectedRaw;
            expect(cell.applied.length).toBeGreaterThan(0);
            expect(cell.applied, `cell ${targetMode} ${mode} ${bps.join('x')} total=${String(cell.objectiveTotal)} applied=${JSON.stringify(cell.applied.slice(0, 12))}`).toContain(cellRaw);
          }
          // The expected raw scales with the composite fold (5000 → 150, 3000 → 90).
          expect(expectedRaw).toBe(bps.length === 1 ? 150 : 90);
        }
      }
    }
  });
});
