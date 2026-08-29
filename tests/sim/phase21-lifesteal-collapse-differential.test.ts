import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { createPhase21Systems } from '../../src/game/sim/core/phase21-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { mulDivRound } from '../../src/game/sim/math/fixed-math.js';
import { asX100 } from '../../src/game/sim/geometry/x100.js';
import { SOFT_LIMIT_NORMAL_TICKS, COLLAPSE_HEAL_FACTOR_BPS, COLLAPSE_WINDOW_TICKS } from '../../src/game/sim/combat/battle-end-resolver.js';
import { collapsePresentationOf } from '../../src/features/battle/outbound/phase21-outbound-presenter.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { ModifierDefinition } from '../../src/game/sim/world/modifier-system.js';
import { battle, entity, randomSession, tick } from './test-helpers.js';

/**
 * Phase 21 §10 collapse-window × lifesteal DIFFERENTIAL.
 *
 * The live panel derives its collapse readout (`collapsePresentationOf`) from
 * the kernel's own constants (COLLAPSE_WINDOW_TICKS, COLLAPSE_HEAL_FACTOR_BPS);
 * this test proves the readout tracks the SAME window the kernel applies — and
 * that the lifesteal heals really are halved inside it. Contract:
 *   1. HALVING — a lifesteal heal (raw 150 from 300 damage @ heal_bps 5000) is
 *      150 before the window and 75 inside it, with the transition aligned to
 *      the kernel's stage-I window (the resolver opens the window in stage L,
 *      so the FIRST collapse tick's heals still apply the full factor —
 *      verified at the exact boundary).
 *   2. CLEAN-ROOM — EVERY HealApplied delta equals `min(raw × factor/10000,
 *      max-LP room)` where `factor ∈ {10000, 5000}` is derived from the window
 *      and the room from an independent oracle HP ledger (collapse damage is
 *      consumed from the stream, so it is never miscounted as a heal).
 *   3. READOUT MATCH — at every observed tick the panel's presentation is
 *      active exactly when the kernel window is, with the same remaining ticks
 *      and the same heal factor.
 *   4. DETERMINISM — two runs give the identical checksum and heal trace.
 */

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

const LIFESTEAL: ModifierDefinition = Object.freeze({
  id: 'mod_fixture_lifesteal',
  previewKey: 'preview_mod_fixture_lifesteal',
  hooks: Object.freeze(['on_damage_applied'] as const),
  incompatibilityTags: Object.freeze([]),
  params: Object.freeze({ heal_bps: 5000 }),
});

const PLAYER_MAX_LP = 5000;
const START = SOFT_LIMIT_NORMAL_TICKS - 20; // a few ticks before the collapse window opens.

const mk = (id: string, side: 'player' | 'enemy', maxLp: number, lp: number, x100: number) =>
  migrateEntity({ entity: entity(id, { side, lane: 'middle', x100, maxLp, lp }), radiusX100: 100 });

const attack = (rawAmount: number) => Object.freeze({
  attackIntervalTicks: 10,
  prepareTicks: 1,
  recoveryTicks: 3,
  preferredRangeX100: asX100(9000),
  delivery: Object.freeze({ kind: 'direct', rawAmount, damageTypeOrdinal: 0, defense: 0, bossCapBps: null }),
});

interface HealObs {
  readonly tick: number;
  readonly rawAmount: number;
  readonly factor: number;
  readonly room: number;
  readonly delta: number;
}

/** Clean-room window oracle: heals halve in [since, since + 450) — exactly the
 * value the stage-I pipeline observed that tick (`state.timeCollapseSinceTick`
 * read BEFORE the step, because the resolver opens the window in stage L). */
function inCollapseWindow(tickValue: number, sinceTick: number | undefined): boolean {
  return sinceTick !== undefined && tickValue >= sinceTick && tickValue < sinceTick + COLLAPSE_WINDOW_TICKS;
}

function run(): { readonly state: BattleModel; readonly observations: readonly HealObs[]; readonly checksum: string } {
  const player = mk('unit_p', 'player', PLAYER_MAX_LP, 2500, 1800);
  const tank = mk('unit_e1', 'enemy', 10000, 10000, 6200);
  const systems: readonly KernelSystem[] = Object.freeze([
    ...createPhase17Systems({
      speedsX100PerSecond: {},
      targeting: { focusTargetId: { unit_p: 'unit_e1' } },
      basicAttack: { parameters: { unit_p: attack(300) } },
    }),
    ...createPhase21Systems({ modifiers: [LIFESTEAL] }),
  ]);
  let state: BattleModel = battle({
    simulationVersion: 'phase21-lifesteal-collapse-v1',
    tick: tick(START),
    entities: Object.freeze([player, tank]),
    abilities: Object.freeze([]),
  });
  const random = randomSession();
  const observations: HealObs[] = [];
  // Independent oracle HP: heals are re-derived, collapse damage follows the
  // stream (never double-counted as a heal).
  let oraclePlayerHp = 2500;
  for (let t = START; t < START + 800 && !['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(state.phase.phase); t++) {
    // The window state the stage-I pipeline will see THIS tick.
    const sinceBefore = state.timeCollapseSinceTick;
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    for (const event of r.events) {
      const targetId = event.targetIds[0];
      if (targetId !== 'unit_p') continue;
      if (event.type === 'DamageApplied') {
        // Collapse / tank-implied damage is authoritative input to the oracle.
        oraclePlayerHp = event.payload['hpAfter'] ?? oraclePlayerHp;
        continue;
      }
      if (event.type !== 'HealApplied') continue;
      const raw = event.payload['rawAmount'] ?? 0;
      const delta = event.payload['finalHpDelta'] ?? 0;
      const factor = inCollapseWindow(t, sinceBefore) ? COLLAPSE_HEAL_FACTOR_BPS : 10000;
      const room = Math.max(0, PLAYER_MAX_LP - oraclePlayerHp);
      const expected = Math.min(mulDivRound(raw, factor, 10000), room);
      // 2. CLEAN-ROOM per-event equality.
      expect(delta, `heal delta at tick ${String(t)}`).toBe(expected);
      // 3. READOUT MATCH at the SAME tick: the panel's window is active exactly
      // when the kernel halved the heal.
      const presentation = collapsePresentationOf({
        tick: t,
        ...(sinceBefore === undefined ? {} : { timeCollapseSinceTick: sinceBefore }),
      });
      expect(presentation.active, `readout active at tick ${String(t)}`).toBe(factor === COLLAPSE_HEAL_FACTOR_BPS);
      if (presentation.active) {
        expect(presentation.remainingTicks, `remaining at tick ${String(t)}`).toBe(sinceBefore! + COLLAPSE_WINDOW_TICKS - t);
        expect(presentation.sinceTick, `since at tick ${String(t)}`).toBe(SOFT_LIMIT_NORMAL_TICKS);
        expect(presentation.healFactorBps).toBe(COLLAPSE_HEAL_FACTOR_BPS);
      }
      observations.push(Object.freeze({ tick: t, rawAmount: raw, factor, room, delta }));
      oraclePlayerHp = event.payload['hpAfter'] ?? oraclePlayerHp;
    }
  }
  return { state, observations: Object.freeze(observations), checksum: createSnapshot(state).checksum };
}

describe('P21 §10 collapse-window × lifesteal differential', () => {
  it('halves lifesteal heals inside the window and the panel readout tracks the kernel tick-for-tick', { timeout: 120_000 }, () => {
    const a = run();
    const b = run();
    // 4. DETERMINISM.
    expect(b.checksum).toBe(a.checksum);
    expect(b.observations).toEqual(a.observations);

    // 1. HALVING: a pre-window heal restores the full 150; in-window heals are
    // halved to 75 (300 damage @ heal_bps 5000 → raw 150, then ×5000/10000).
    expect(a.observations.some((o) => o.factor === 10000 && o.delta === 150)).toBe(true);
    expect(a.observations.some((o) => o.factor === COLLAPSE_HEAL_FACTOR_BPS && o.delta === 75)).toBe(true);
    // The exact boundary: the first collapse tick's heals still apply the full
    // factor (stage I runs before the resolver opens the window in stage L) —
    // observed whenever a heal lands ON the soft limit.
    const boundary = a.observations.find((o) => o.tick === SOFT_LIMIT_NORMAL_TICKS);
    if (boundary !== undefined) {
      expect(boundary.factor).toBe(10000);
    }
    // The first IN-window heal (the tick after the boundary turns active) is halved.
    const firstHalved = a.observations.find((o) => o.factor === COLLAPSE_HEAL_FACTOR_BPS);
    expect(firstHalved).toBeDefined();
    expect(a.observations.some((o) => o.tick < SOFT_LIMIT_NORMAL_TICKS && o.factor === 10000)).toBe(true);
    expect(a.observations.some((o) => o.tick > SOFT_LIMIT_NORMAL_TICKS && o.factor === COLLAPSE_HEAL_FACTOR_BPS)).toBe(true);
    // 2. involved 3 held per event (asserted inline); room is never negative and
    // the observations span both sides of the boundary.
    expect(a.observations.every((o) => o.room >= 0)).toBe(true);
    expect(a.observations.some((o) => o.tick < SOFT_LIMIT_NORMAL_TICKS)).toBe(true);
    expect(a.observations.some((o) => o.tick >= SOFT_LIMIT_NORMAL_TICKS)).toBe(true);
    expect(a.observations.length).toBeGreaterThan(0);
  });
});
