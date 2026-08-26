import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { parseRunSeed } from '../../src/game/sim/random/run-seed.js';
import { RngStreamMap } from '../../src/game/sim/random/rng-stream-map.js';
import { RollSlotRegistry } from '../../src/game/sim/random/roll-slot-registry.js';
import { RandomSession } from '../../src/game/sim/random/random-session.js';
import { collapseDamageFor, type BattleEndConfig } from '../../src/game/sim/combat/battle-end-resolver.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { KernelEntity } from '../../src/game/sim/core/entity.js';
import { battle, entity, randomSession } from './test-helpers.js';
import { tick as tickOf } from '../../src/game/sim/core/primitives.js';
import { asX100 } from '../../src/game/sim/geometry/x100.js';

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

  it('a kill resets the global no-progress endcap (§9.4 death signal)', () => {
    // Two 400-HP enemies, one player dealing 400 direct damage every 10 ticks.
    // The §9.4 counter climbs every tick (no spawns); each Defeated event must
    // reset it to 0 in the same tick (stage J overwrites the stage-F
    // increment), so a battle that is advancing toward elimination never
    // times out. Prevention/revive never count — only real kills.
    const p = unit('unit_p', 'player', { maxLp: 1000, lp: 1000 });
    const e1 = unit('unit_e1', 'enemy', { maxLp: 400, lp: 400 });
    const e2 = unit('unit_e2', 'enemy', { maxLp: 400, lp: 400 });
    const state = battle({ simulationVersion: 'phase17-fixture-v1', entities: [p, e1, e2] });
    const systems = createPhase17Systems({
      speedsX100PerSecond: {},
      basicAttack: {
        parameters: {
          unit_p: {
            attackIntervalTicks: 10, prepareTicks: 0, recoveryTicks: 0, preferredRangeX100: asX100(9000),
            delivery: { kind: 'direct', rawAmount: 400, damageTypeOrdinal: 0, defense: 0, bossCapBps: null },
          },
        },
      },
    });
    let current = state;
    const random = randomSession();
    const counterByTick = new Map<number, number>();
    const killedAt: number[] = [];
    for (let i = 0; i < 40; i++) {
      const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
      current = r.state;
      if (current.globalNoProgressTicks !== undefined) counterByTick.set(current.tick, current.globalNoProgressTicks);
      for (const e of r.events) if (e.type === 'Defeated') killedAt.push(current.tick);
      if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(current.phase.phase)) break;
    }
    expect(killedAt.length).toBeGreaterThanOrEqual(2);
    // Before the first kill the counter climbed one per tick from 1.
    const firstKill = killedAt[0];
    if (firstKill === undefined) throw new Error('no kill observed');
    for (let t = 1; t < firstKill; t++) {
      expect(counterByTick.get(t), `counter at tick ${String(t)}`).toBe(t);
    }
    // The kill tick itself is 0: the stage-J reset overwrote the stage-F increment.
    expect(counterByTick.get(firstKill)).toBe(0);
    // It climbs again after the kill, then the second kill resets it once more.
    const secondKill = killedAt[1];
    if (secondKill !== undefined && secondKill > firstKill) {
      expect(counterByTick.get(secondKill)).toBe(0);
      for (let t = firstKill + 1; t < secondKill; t++) {
        expect(counterByTick.get(t), `counter at tick ${String(t)}`).toBe(t - firstKill);
      }
    }
  });

  it('damage that reaches HP resets the global no-progress endcap (§9.4 damage signal)', () => {
    // One player dealing 100 direct damage per attack cycle (clamped to the
    // 14-tick minimum interval), one tanky enemy that never dies inside the
    // window. The §9.4 counter must reset to 0 exactly on damage ticks (stage I
    // overwrites the stage-F increment) and only climb between hits, so a
    // battle that is still dealing damage never times out.
    const p = unit('unit_p', 'player', { maxLp: 1000, lp: 1000 });
    const e = unit('unit_e', 'enemy', { maxLp: 100000, lp: 100000 });
    const state = battle({ simulationVersion: 'phase17-fixture-v1', entities: [p, e] });
    const systems = createPhase17Systems({
      speedsX100PerSecond: {},
      basicAttack: {
        parameters: {
          unit_p: {
            attackIntervalTicks: 14, prepareTicks: 0, recoveryTicks: 0, preferredRangeX100: asX100(9000),
            delivery: { kind: 'direct', rawAmount: 100, damageTypeOrdinal: 0, defense: 0, bossCapBps: null },
          },
        },
      },
    });
    let current = state;
    const random = randomSession();
    const counterByTick = new Map<number, number>();
    const damageTicks: number[] = [];
    for (let i = 0; i < 45; i++) {
      const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
      current = r.state;
      if (current.globalNoProgressTicks !== undefined) counterByTick.set(current.tick, current.globalNoProgressTicks);
      for (const ev of r.events) if (ev.type === 'DamageApplied' && (ev.payload['finalHpDelta'] ?? 0) > 0) damageTicks.push(current.tick);
    }
    expect(damageTicks.length).toBeGreaterThanOrEqual(3);
    // Every damage tick is 0; between hits the counter climbs from 1.
    for (const tick of damageTicks) expect(counterByTick.get(tick), `counter at damage tick ${String(tick)}`).toBe(0);
    for (let t = 1; t <= 45; t++) {
      if (damageTicks.includes(t)) continue;
      const previous = [...damageTicks].filter((d) => d < t).at(-1) ?? 0;
      expect(counterByTick.get(t), `counter at tick ${String(t)}`).toBe(t - previous);
    }
  });

  it('a no-damage long draw still fires the rift-collapse warning and ends (§9.4)', { timeout: 60_000 }, () => {
    // Two immobile 1000-LP units with no attacks: no spawn, no damage, no
    // kill. The endcap must reach the 300-tick warning and then the 300-tick
    // collapse request — the anti-stall backstop that damage resets must not
    // suppress.
    const a = unit('unit_a', 'player', { maxLp: 1000, lp: 1000 });
    const b = unit('unit_b', 'enemy', { maxLp: 1000, lp: 1000 });
    const { events } = run(650, [a, b]);
    const warned = events.filter((e) => e.type === 'RiftCollapseWarning');
    expect(warned.length).toBe(1);
    // The collapse window ends the battle around 600-603 ticks.
    expect(['RESOLVING_END', 'VICTORY', 'DEFEAT', 'DRAW_ABORT']).toContain(run(650, [a, b]).state.phase.phase);
  });

  it('collapse damage is seed-independent and mulDivRound-correct across RNG seeds', { timeout: 60_000 }, () => {
    // Regression for the Math.floor → mulDivRound fix: collapse damage is pure
    // (8% max-LP, §10), so it must be byte-identical no matter which RNG
    // streams back the battle. This locks determinism across replays with
    // different stream seeds — including the small maxLp values where
    // Math.floor would have silently returned 0.
    const maxLps = [1, 7, 13, 99, 100, 999, 1250, 4999, 10000];
    const seeds: readonly (readonly [string, string, string, string])[] = [
      ['00000001', '00000002', '00000003', '00000004'],
      ['deadbeef', 'cafebabe', '12345678', '9abcdef0'],
      ['ffffffff', '00000000', 'aaaaaaaa', '55555555'],
    ];

    function collapseLpAfterFirstInterval(seed: readonly [string, string, string, string]): readonly number[] {
      const entities: KernelEntity[] = maxLps.map((maxLp, i) => unit(`unit_p_${String(i)}`, 'player', { maxLp, lp: maxLp }));
      entities.push(unit('unit_e', 'enemy', { maxLp: 100000, lp: 100000 }));
      const streams = RngStreamMap.fromRunSeed(parseRunSeed([...seed]));
      const random = new RandomSession(streams, new RollSlotRegistry([]), false);
      const state = battle({
        simulationVersion: 'phase17-fixture-v1',
        entities,
        tick: tickOf(2690),
        authoritativeStreams: streams.snapshotAuthoritative(),
      });
      const systems = createPhase17Systems({ speedsX100PerSecond: {}, battleEnd: {} });
      let current = state;
      for (let i = 0; i < 102; i++) {
        const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
        current = r.state;
      }
      return maxLps.map((_, i) => current.entities.find((e) => e.id === `unit_p_${String(i)}`)?.lp ?? -1);
    }

    const expected = maxLps.map((maxLp) => maxLp - collapseDamageFor(unit('x', 'player', { maxLp })));
    const results = seeds.map((seed) => collapseLpAfterFirstInterval(seed));
    for (const result of results) {
      expect(result).toEqual(expected);
    }
    // And every distinct seed produced the exact same LP vector (no RNG leak).
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toEqual(results[0]);
    }
  });
});
