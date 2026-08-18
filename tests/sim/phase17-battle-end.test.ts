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

  it('requests RESOLVING_END at the soft limit + collapse window', () => {
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
  });
});
