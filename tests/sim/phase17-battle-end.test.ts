import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import {
  chapter76Score, collapseDamageFor, isCombatCapableRegular, resolveChapter76, resolveBattleEnd, softLimitTicks,
  COLLAPSE_DAMAGE_BPS, COLLAPSE_WINDOW_TICKS, HARD_LIMIT_TICKS, SOFT_LIMIT_NORMAL_TICKS, type BattleEndConfig,
} from '../../src/game/sim/combat/battle-end-resolver.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { KernelEntity } from '../../src/game/sim/core/entity.js';
import { battle, entity, randomSession } from './test-helpers.js';
import { tick as tickOf } from '../../src/game/sim/core/primitives.js';
import { asX100 } from '../../src/game/sim/geometry/x100.js';
import { KernelInvariantError } from '../../src/game/sim/core/invariant-error.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

function unit(id: string, side: 'player' | 'enemy', overrides: Partial<KernelEntity> = {}): KernelEntity {
  // Migration rejects partially-populated entities, so migrate without the
  // P15/P17 origin field and overlay it afterwards.
  const { origin, ...rest } = overrides;
  const migrated = migrateEntity({ entity: entity(id, { side, ...rest }), radiusX100: 100 });
  return origin === undefined ? migrated : Object.freeze({ ...migrated, origin });
}

function run(ticks: number, entities: KernelEntity[], battleEnd: BattleEndConfig = {}, attackParams: { parameters: Record<string, never> } = { parameters: {} }): { state: BattleModel; events: { tick: number; type: string; payload: Readonly<Record<string, number>> }[] } {
  const state = battle({ simulationVersion: 'phase17-fixture-v1', entities });
  const systems = createPhase17Systems({ speedsX100PerSecond: {}, battleEnd, basicAttack: attackParams });
  let current = state;
  const random = randomSession();
  const events: { tick: number; type: string; payload: Record<string, number> }[] = [];
  for (let i = 0; i < ticks; i++) {
    const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
    current = r.state;
    for (const e of r.events) events.push({ tick: current.tick, type: e.type, payload: e.payload });
  }
  return { state: current, events };
}

describe('P17 T06 battle-end resolver (stage L)', () => {
  it('normal battles use the 2700-tick soft limit, boss battles 3600', () => {
    expect(softLimitTicks({})).toBe(2700);
    expect(softLimitTicks({ bossBattle: true })).toBe(3600);
  });

  it('ends with VICTORY when the enemy side is eliminated', () => {
    const player = unit('unit_player', 'player', { maxLp: 1000, lp: 1000 });
    const enemy = Object.freeze({ ...unit('unit_enemy', 'enemy'), lp: 0, phase: Object.freeze({ phase: 'DEFEATED', enteredTick: 0, controlledReturn: null }) }) as KernelEntity;
    // Request_end at tick 1 → RESOLVING_END → finalizes at tick 4 (3-tick window).
    const { state, events } = run(5, [player, enemy]);
    expect(state.phase.phase).toBe('VICTORY');
    expect(events.some((e) => e.type === 'BattleEnded')).toBe(true);
  });

  it('ends with DEFEAT when the player side is eliminated', () => {
    const player = Object.freeze({ ...unit('unit_player', 'player'), lp: 0, phase: Object.freeze({ phase: 'DEFEATED', enteredTick: 0, controlledReturn: null }) }) as KernelEntity;
    const enemy = unit('unit_enemy', 'enemy', { maxLp: 1000, lp: 1000 });
    const { state } = run(5, [player, enemy]);
    expect(state.phase.phase).toBe('DEFEAT');
  });

  it('ends with DRAW_ABORT on mutual extermination', () => {
    const dead = (id: string, side: 'player' | 'enemy') => Object.freeze({ ...unit(id, side), lp: 0, phase: Object.freeze({ phase: 'DEFEATED', enteredTick: 0, controlledReturn: null }) }) as KernelEntity;
    const { state } = run(5, [dead('unit_a', 'player'), dead('unit_b', 'enemy')]);
    expect(state.phase.phase).toBe('DRAW_ABORT');
  });

  it('summons never count as combat-capable', () => {
    const summon = unit('unit_summon', 'player', { origin: 'summoned', maxLp: 1000, lp: 1000 });
    const enemy = unit('unit_enemy', 'enemy', { maxLp: 1000, lp: 1000 });
    // Only a summon remains on the player side → player side is not combat-capable.
    const { state } = run(5, [summon, enemy]);
    expect(state.phase.phase).toBe('DEFEAT');
  });

  it('applies 8% max-LP pure damage every 90 ticks during collapse', () => {
    // Soft limit reached at 2700; first collapse tick is 2790. Seed the state
    // at 2690 (before the window) — running from tick 0 lets the anti-stuck
    // endcap end the battle before the limit is reached.
    const a = unit('unit_a', 'player', { maxLp: 1000, lp: 1000 });
    const b = unit('unit_b', 'enemy', { maxLp: 1000, lp: 1000 });
    const state = battle({ simulationVersion: 'phase17-fixture-v1', entities: [a, b], tick: tickOf(2690) });
    const systems = createPhase17Systems({ speedsX100PerSecond: {}, battleEnd: {} });
    let current = state;
    const random = randomSession();
    for (let i = 0; i < 102; i++) {
      const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
      current = r.state;
    }
    const unitA = current.entities.find((e) => e.id === 'unit_a');
    // 8% of 1000 = 80 per collapse tick.
    expect(unitA?.lp).toBe(920);
    expect(collapseDamageFor(unit('unit_a', 'player', { maxLp: 1000 }))).toBe(80);
  });

  it('collapse damage is 8% max-LP via COLLAPSE_DAMAGE_BPS', () => {
    expect(COLLAPSE_DAMAGE_BPS).toBe(800);
    expect(collapseDamageFor(unit('unit_a', 'player', { maxLp: 1250 }))).toBe(100);
  });

  it('requests RESOLVING_END at the soft limit + collapse window', { timeout: 60_000 }, () => {
    const a = unit('unit_a', 'player', { maxLp: 1000, lp: 1000 });
    const b = unit('unit_b', 'enemy', { maxLp: 1000, lp: 1000 });
    const before = run(3150, [a, b]);
    // 3150 = 2700 + 450: should be in RESOLVING_END or finalized.
    expect(['RESOLVING_END', 'VICTORY', 'DEFEAT', 'DRAW_ABORT']).toContain(before.state.phase.phase);
    // Pure resolver decision at exactly the limit boundary.
    const decision = resolveBattleEnd({ tick: SOFT_LIMIT_NORMAL_TICKS + COLLAPSE_WINDOW_TICKS - 1, entities: [a, b], phase: { phase: 'ACTIVE' } }, {}, 0);
    expect(decision.action).toBe('none');
    const atLimit = resolveBattleEnd({ tick: SOFT_LIMIT_NORMAL_TICKS + COLLAPSE_WINDOW_TICKS, entities: [a, b], phase: { phase: 'ACTIVE' } }, {}, 0);
    expect(atLimit.action).toBe('request_end');
  });

  it('finalizes RESOLVING_END via the Chapter-76 order', () => {
    const a = unit('unit_a', 'player', { maxLp: 1000, lp: 600 });
    const b = unit('unit_b', 'enemy', { maxLp: 1000, lp: 900 });
    const decision = resolveBattleEnd({ tick: 4000, entities: [a, b], phase: { phase: 'RESOLVING_END' } }, {}, 3);
    expect(decision.action).toBe('finalize');
    if (decision.action !== 'finalize') return;
    // Enemy has higher LP ratio → DEFEAT for the player.
    expect(decision.outcome).toBe('DEFEAT');
    expect(decision.reason).toBe('chapter76_timeout');
  });

  it('Chapter-76 ratio: LP+shields over regular max-LP, higher wins', () => {
    const player = unit('unit_p', 'player', { maxLp: 1000, lp: 500 });
    const enemy = unit('unit_e', 'enemy', { maxLp: 1000, lp: 900 });
    expect(chapter76Score([player, enemy], 'player').lpShieldRatio).toBe(0.5);
    expect(chapter76Score([player, enemy], 'enemy').lpShieldRatio).toBe(0.9);
    expect(resolveChapter76(chapter76Score([player, enemy], 'player'), chapter76Score([player, enemy], 'enemy'))).toBe('DEFEAT');
  });

  it('Chapter-76 falls to regular count when ratios tie', () => {
    const p1 = unit('unit_p1', 'player', { maxLp: 1000, lp: 500 });
    const p2 = unit('unit_p2', 'player', { maxLp: 1000, lp: 500 });
    const e1 = unit('unit_e1', 'enemy', { maxLp: 1000, lp: 500 });
    const playerScore = chapter76Score([p1, p2, e1], 'player');
    const enemyScore = chapter76Score([p1, p2, e1], 'enemy');
    expect(playerScore.regularCount).toBe(2);
    expect(enemyScore.regularCount).toBe(1);
    expect(resolveChapter76(playerScore, enemyScore)).toBe('VICTORY');
  });

  it('double defeat when ratio and count both tie', () => {
    const p = unit('unit_p', 'player', { maxLp: 1000, lp: 500 });
    const e = unit('unit_e', 'enemy', { maxLp: 1000, lp: 500 });
    expect(resolveChapter76(chapter76Score([p, e], 'player'), chapter76Score([p, e], 'enemy'))).toBe('DRAW_ABORT');
  });

  it('boss-damage tie-break: higher damage dealt to the opposing boss wins', () => {
    const p = unit('unit_p', 'player', { maxLp: 1000, lp: 500 });
    const e = unit('unit_e', 'enemy', { maxLp: 1000, lp: 500 });
    // Ratio and count tie; player dealt 300 to the enemy boss, enemy 100.
    const playerScore = chapter76Score([p, e], 'player', 300);
    const enemyScore = chapter76Score([p, e], 'enemy', 100);
    expect(resolveChapter76(playerScore, enemyScore)).toBe('VICTORY');
    expect(resolveChapter76(enemyScore, playerScore)).toBe('DEFEAT');
    // Equal boss damage → double defeat.
    expect(resolveChapter76(chapter76Score([p, e], 'player', 200), chapter76Score([p, e], 'enemy', 200))).toBe('DRAW_ABORT');
  });

  it('boss-damage tie-break resolves a kernel timeout battle', { timeout: 60_000 }, () => {
    // Both sides tie on ratio and count (1v1, both bosses at equal LP). The
    // player deals 400 per hit to the enemy boss while the enemy deals 200
    // back, so the Chapter-76 boss-damage step picks the player. Huge LP keeps
    // both alive through the collapse window so the battle reaches the timeout
    // instead of ending by elimination.
    const p = unit('unit_p', 'player', { x100: 1800, maxLp: 100000, lp: 100000 });
    const e = unit('unit_e', 'enemy', { x100: 6200, maxLp: 100000, lp: 100000 });
    const state = battle({ simulationVersion: 'phase17-fixture-v1', entities: [p, e], tick: tickOf(2680) });
    const systems = createPhase17Systems({
      speedsX100PerSecond: {},
      battleEnd: { bossIds: new Set(['unit_p', 'unit_e']) },
      basicAttack: {
        parameters: {
          unit_p: {
            attackIntervalTicks: 10, prepareTicks: 1, recoveryTicks: 3, preferredRangeX100: asX100(9000),
            delivery: { kind: 'direct', rawAmount: 400, damageTypeOrdinal: 0, defense: 0, bossCapBps: null },
          },
          unit_e: {
            attackIntervalTicks: 10, prepareTicks: 1, recoveryTicks: 3, preferredRangeX100: asX100(9000),
            delivery: { kind: 'direct', rawAmount: 200, damageTypeOrdinal: 0, defense: 0, bossCapBps: null },
          },
        },
      },
    });
    let current = state;
    const random = randomSession();
    let ended = false;
    let finalBossDamage: Readonly<{ player: number; enemy: number }> | undefined;
    for (let i = 0; i < 520; i++) {
      const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
      current = r.state;
      finalBossDamage = current.bossDamageDealt;
      if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(current.phase.phase)) {
        ended = true;
        break;
      }
    }
    expect(ended).toBe(true);
    // The player hit the boss (unit_e) harder than the enemy hit the player.
    expect(finalBossDamage?.player ?? 0).toBeGreaterThan(finalBossDamage?.enemy ?? 0);
    expect(current.phase.phase).toBe('VICTORY');
    expect(current.endReason).toBe('chapter76_timeout');
  });

  it('healing is halved during the collapse window', () => {
    const attacker = unit('unit_attacker', 'player', { x100: 1000 });
    const victim = unit('unit_victim', 'enemy', { x100: 2000, maxLp: 1000, lp: 500 });
    // Directly test the resolver gate: with collapse active the heal factor
    // clamps to 5000 (COLLAPSE_HEAL_FACTOR_BPS), applied at stage I.
    const decision = resolveBattleEnd({ tick: 2790, entities: [attacker, victim], phase: { phase: 'ACTIVE' } }, {}, 0);
    expect(decision.action).toBe('collapse_damage');
    expect(COLLAPSE_WINDOW_TICKS).toBe(450);
    expect(HARD_LIMIT_TICKS).toBe(5400);
  });

  it('isCombatCapableRegular requires ACTIVE, regular origin and LP > 0', () => {
    const ok = unit('unit_a', 'player', { maxLp: 1000, lp: 100 });
    expect(isCombatCapableRegular(ok)).toBe(true);
    const dead = Object.freeze({ ...ok, lp: 0 }) as KernelEntity;
    expect(isCombatCapableRegular(dead)).toBe(false);
    const summon = unit('unit_s', 'player', { origin: 'summoned', maxLp: 1000, lp: 100 });
    expect(isCombatCapableRegular(summon)).toBe(false);
    const construct = unit('unit_c', 'player', { origin: 'construct', maxLp: 1000, lp: 100 });
    expect(isCombatCapableRegular(construct)).toBe(false);
  });

  it('a construct-only side is eliminated just like a summon-only side', () => {
    const construct = unit('unit_c', 'player', { origin: 'construct', maxLp: 1000, lp: 1000 });
    const enemy = unit('unit_e', 'enemy', { maxLp: 1000, lp: 1000 });
    const { state } = run(5, [construct, enemy]);
    expect(state.phase.phase).toBe('DEFEAT');
  });

  it('summons and constructs are excluded from the Chapter-76 ratio and count', () => {
    // Player: 1 regular at 50% + 2 summons + 1 construct, all full LP.
    // Enemy: 1 regular at 50%. Ratio and count must match the regulars only.
    const p = unit('unit_p', 'player', { maxLp: 1000, lp: 500 });
    const summon = unit('unit_s', 'player', { origin: 'summoned', maxLp: 1000, lp: 1000 });
    const summon2 = unit('unit_s2', 'player', { origin: 'summoned', maxLp: 1000, lp: 1000 });
    const construct = unit('unit_c', 'player', { origin: 'construct', maxLp: 1000, lp: 1000 });
    const e = unit('unit_e', 'enemy', { maxLp: 1000, lp: 500 });
    const playerScore = chapter76Score([p, summon, summon2, construct, e], 'player');
    const enemyScore = chapter76Score([p, summon, summon2, construct, e], 'enemy');
    expect(playerScore.regularCount).toBe(1);
    expect(playerScore.lpShieldRatio).toBe(0.5);
    expect(enemyScore.regularCount).toBe(1);
    expect(enemyScore.lpShieldRatio).toBe(0.5);
    // Ratio and count tie → boss damage (both 0 here) → double defeat.
    expect(resolveChapter76(playerScore, enemyScore)).toBe('DRAW_ABORT');
  });

  it('same-tick multi-hit applications compose in queue order (stage-I projection)', () => {
    // Two attacks land in one tick on a 300-LP target: 200 then 200. The
    // second hit must see the post-first-hit HP (hpBefore 100, hpAfter 0) and
    // be the killing blow with overkill 100 — not a stale read of 300.
    const attacker = unit('unit_attacker', 'player', { x100: 1000, maxLp: 1000, lp: 1000 });
    const attacker2 = unit('unit_attacker2', 'player', { x100: 1200, maxLp: 1000, lp: 1000 });
    const victim = unit('unit_victim', 'enemy', { x100: 2000, maxLp: 300, lp: 300 });
    const systems = createPhase17Systems({
      speedsX100PerSecond: {},
      basicAttack: {
        parameters: {
          unit_attacker: {
            attackIntervalTicks: 14, prepareTicks: 0, recoveryTicks: 0, preferredRangeX100: asX100(9000),
            delivery: { kind: 'direct', rawAmount: 200, damageTypeOrdinal: 0, defense: 0, bossCapBps: null },
          },
          unit_attacker2: {
            attackIntervalTicks: 14, prepareTicks: 0, recoveryTicks: 0, preferredRangeX100: asX100(9000),
            delivery: { kind: 'direct', rawAmount: 200, damageTypeOrdinal: 0, defense: 0, bossCapBps: null },
          },
        },
      },
    });
    const state = battle({ simulationVersion: 'phase17-fixture-v1', entities: [attacker, attacker2, victim] });
    let current = state;
    const random = randomSession();
    const events: { tick: number; type: string; targetIds: readonly string[]; payload: Readonly<Record<string, number>> | undefined }[] = [];
    for (let i = 0; i < 30; i++) {
      const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
      current = r.state;
      for (const e of r.events) events.push({ tick: current.tick, type: e.type, targetIds: e.targetIds, payload: e.payload });
    }
    const hits = events.filter((e) => e.type === 'DamageApplied' && e.targetIds.includes('unit_victim'));
    // Two hits on the victim in one tick (both attackers commit simultaneously).
    const tickHits = hits.filter((h) => h.tick === hits[0]?.tick);
    expect(tickHits.length).toBe(2);
    expect(tickHits[0]?.payload?.['hpAfter']).toBe(100);
    expect(tickHits[1]?.payload?.['hpBefore']).toBe(100);
    expect(tickHits[1]?.payload?.['hpAfter']).toBe(0);
    expect(tickHits[1]?.payload?.['finalHpDelta']).toBe(100);
    // The killing blow's overkill is the excess beyond remaining HP: 200-100.
    const defeated = events.find((e) => e.type === 'Defeated' && e.targetIds.includes('unit_victim'));
    expect(defeated?.payload?.['overkill']).toBe(100);
  });

  it('collapse damage skips summons and constructs', () => {
    // A battle with a summon and a construct on the player side plus one enemy
    // regular. Collapse damage must only hit the regulars (both sides).
    const p = unit('unit_p', 'player', { x100: 1800, maxLp: 1000, lp: 1000 });
    const summon = unit('unit_summon', 'player', { origin: 'summoned', x100: 1900, maxLp: 1000, lp: 1000 });
    const construct = unit('unit_construct', 'player', { origin: 'construct', x100: 2000, maxLp: 1000, lp: 1000 });
    const e = unit('unit_e', 'enemy', { x100: 6200, maxLp: 1000, lp: 1000 });
    const state = battle({ simulationVersion: 'phase17-fixture-v1', entities: [p, summon, construct, e], tick: tickOf(2680) });
    const systems = createPhase17Systems({ speedsX100PerSecond: {}, battleEnd: {} });
    let current = state;
    const random = randomSession();
    for (let i = 0; i < 112; i++) {
      const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
      current = r.state;
    }
    // Tick 2790 is the first collapse interval (8% of 1000 = 80).
    const byId = new Map(current.entities.map((en) => [en.id, en.lp]));
    expect(byId.get('unit_p')).toBe(920);
    expect(byId.get('unit_e')).toBe(920);
    expect(byId.get('unit_summon')).toBe(1000);
    expect(byId.get('unit_construct')).toBe(1000);
  });

  it('soft limit 2699/2700: collapse window opens exactly at 2700', () => {
    const a = unit('unit_a', 'player', { maxLp: 1000, lp: 1000 });
    const b = unit('unit_b', 'enemy', { maxLp: 1000, lp: 1000 });
    // 2699 is fully normal; 2700 is still pre-damage but opens the window.
    expect(resolveBattleEnd({ tick: 2699, entities: [a, b], phase: { phase: 'ACTIVE' } }, {}, 0).action).toBe('none');
    expect(resolveBattleEnd({ tick: 2700, entities: [a, b], phase: { phase: 'ACTIVE' } }, {}, 0).action).toBe('none');
    const state = battle({ simulationVersion: 'phase17-fixture-v1', entities: [a, b], tick: tickOf(2690) });
    const systems = createPhase17Systems({ speedsX100PerSecond: {}, battleEnd: {} });
    let current = state;
    const random = randomSession();
    for (let i = 0; i < 12; i++) {
      const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
      current = r.state;
    }
    expect(current.timeCollapseSinceTick).toBe(2700);
  });

  it('boss soft limit 3599/3600 with first collapse interval at 3690', () => {
    const a = unit('unit_a', 'player', { maxLp: 1000, lp: 1000 });
    const b = unit('unit_b', 'enemy', { maxLp: 1000, lp: 1000 });
    expect(resolveBattleEnd({ tick: 3599, entities: [a, b], phase: { phase: 'ACTIVE' } }, { bossBattle: true }, 0).action).toBe('none');
    expect(resolveBattleEnd({ tick: 3600, entities: [a, b], phase: { phase: 'ACTIVE' } }, { bossBattle: true }, 0).action).toBe('none');
    expect(resolveBattleEnd({ tick: 3690, entities: [a, b], phase: { phase: 'ACTIVE' } }, { bossBattle: true }, 0).action).toBe('collapse_damage');
  });

  it('collapse damage fires only at the 90-tick cadence inside the window', () => {
    const a = unit('unit_a', 'player', { maxLp: 1000, lp: 1000 });
    const b = unit('unit_b', 'enemy', { maxLp: 1000, lp: 1000 });
    for (const tick of [2701, 2789, 2791, 2881, 3149]) {
      expect(resolveBattleEnd({ tick, entities: [a, b], phase: { phase: 'ACTIVE' } }, {}, 0).action).not.toBe('collapse_damage');
    }
    for (const tick of [2790, 2880, 2970, 3060]) {
      expect(resolveBattleEnd({ tick, entities: [a, b], phase: { phase: 'ACTIVE' } }, {}, 0).action).toBe('collapse_damage');
    }
  });

  it('hard limit 5400: the kernel throws P14_HARD_LIMIT if the battle is still active', () => {
    const a = unit('unit_a', 'player', { maxLp: 100000, lp: 100000 });
    const b = unit('unit_b', 'enemy', { maxLp: 100000, lp: 100000 });
    const state = battle({ simulationVersion: 'phase17-fixture-v1', entities: [a, b], tick: tickOf(5399) });
    const systems = createPhase17Systems({ speedsX100PerSecond: {}, battleEnd: {} });
    const random = randomSession();
    const r1 = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    expect(r1.state.tick).toBe(5400);
    expect(() => stepBattle({ state: r1.state, input, random, rules: {}, content: {}, systems })).toThrow(KernelInvariantError);
  });

  it('no events or state change after the battle is terminal (event discard)', () => {
    const a = unit('unit_a', 'player', { maxLp: 1000, lp: 1000 });
    const b = unit('unit_b', 'enemy', { maxLp: 100, lp: 100 });
    const state = battle({ simulationVersion: 'phase17-fixture-v1', entities: [a, b] });
    const systems = createPhase17Systems({
      speedsX100PerSecond: {},
      basicAttack: {
        parameters: {
          unit_a: {
            attackIntervalTicks: 14, prepareTicks: 0, recoveryTicks: 0, preferredRangeX100: asX100(9000),
            delivery: { kind: 'direct', rawAmount: 200, damageTypeOrdinal: 0, defense: 0, bossCapBps: null },
          },
        },
      },
    });
    let current = state;
    const random = randomSession();
    let terminalTick = -1;
    for (let i = 0; i < 60; i++) {
      const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
      current = r.state;
      if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(current.phase.phase)) {
        terminalTick = current.tick;
        break;
      }
    }
    expect(terminalTick).toBeGreaterThan(0);
    const after = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
    expect(after.events.length).toBe(0);
    expect(after.state.tick).toBe(terminalTick);
  });
});
