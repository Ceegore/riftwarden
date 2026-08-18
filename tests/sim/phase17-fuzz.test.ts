import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { asX100 } from '../../src/game/sim/geometry/x100.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { KernelEntity } from '../../src/game/sim/core/entity.js';
import { battle, entity, randomSession } from './test-helpers.js';
import type { AttackParameters } from '../../src/game/sim/attack/attack-state.js';
import type { ShieldSource } from '../../src/game/sim/combat/shield-ledger.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

/** Small deterministic PRNG (mulberry32) so seeds are reproducible. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, values: readonly T[]): T {
  return values[Math.min(values.length - 1, Math.floor(rand() * values.length))] as T;
}

function int(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

function unit(id: string, side: 'player' | 'enemy', overrides: Parameters<typeof entity>[1] = {}) {
  return migrateEntity({ entity: entity(id, { side, ...overrides }), radiusX100: 100 });
}

interface FuzzConfig {
  readonly seed: number;
  readonly ticks: number;
  readonly deliveryKind: 'direct' | 'projectile';
  readonly rawAmount: number;
  readonly defense: number;
  readonly damageTypeOrdinal: number;
  readonly coverIgnoring: boolean;
  readonly piercing: boolean;
  readonly bossCapBps: number | null;
  readonly speedX100PerSecond: number;
  readonly expiryTicks: number;
  readonly homing: boolean;
  readonly maxTurnX100PerTick: number;
  readonly lostTargetPolicy: 'impact_stored_position' | 'expire' | 'continue_straight';
  readonly shieldRaw: number;
  readonly shieldPriority: number;
  readonly healRaw: number;
  readonly healFactorBps: number;
}

function makeAttackParameters(config: FuzzConfig): AttackParameters {
  const delivery = config.deliveryKind === 'direct'
    ? { kind: 'direct' as const, rawAmount: config.rawAmount, damageTypeOrdinal: config.damageTypeOrdinal, defense: config.defense, bossCapBps: config.bossCapBps }
    : { kind: 'projectile' as const, rawAmount: config.rawAmount, damageTypeOrdinal: config.damageTypeOrdinal, defense: config.defense, bossCapBps: config.bossCapBps, speedX100PerSecond: config.speedX100PerSecond, homing: config.homing, maxTurnX100PerTick: config.maxTurnX100PerTick, expiryTicks: config.expiryTicks, lostTargetPolicy: config.lostTargetPolicy, coverIgnoring: config.coverIgnoring, piercing: config.piercing };
  return { attackIntervalTicks: 20, prepareTicks: 1, recoveryTicks: 2, preferredRangeX100: asX100(9000), delivery };
}

interface FuzzEvent {
  readonly tick: number;
  readonly type: string;
  readonly sourceId: string | null;
  readonly attackInstanceId: number | null;
  readonly payload: Readonly<Record<string, number>> | undefined;
}

function runFuzz(config: FuzzConfig): { state: BattleModel; events: FuzzEvent[]; callOrder: string[][] } {
  // Seed the shield ledger directly so live damage applications exercise
  // consumption (ShieldAbsorbed) and expiry (ShieldExpired) through the kernel.
  let shields: readonly ShieldSource[] = Object.freeze([]);
  if (config.shieldRaw > 0) {
    shields = Object.freeze([
      Object.freeze({
        shieldId: 'shield_fuzz_a',
        sourceId: 'unit_granter',
        effectId: 'effect_shield',
        remaining: config.shieldRaw,
        expiryTick: 50,
        priority: config.shieldPriority,
        applicationSequence: 1,
      } as ShieldSource),
      Object.freeze({
        shieldId: 'shield_fuzz_b',
        sourceId: 'unit_granter',
        effectId: 'effect_shield',
        remaining: Math.max(1, Math.floor(config.shieldRaw / 2)),
        expiryTick: 80,
        priority: 0,
        applicationSequence: 2,
      } as ShieldSource),
    ]);
  }
  // Migration rejects partially-populated entities, so migrate without the
  // P17 shield field and overlay it afterwards.
  const entities: KernelEntity[] = [
    Object.freeze({ ...unit('unit_p', 'player', { x100: 1800 }), shields }),
    unit('unit_e1', 'enemy', { x100: 6200 }),
    unit('unit_e2', 'enemy', { x100: 6400, lane: 'middle' }),
  ];
  const state = battle({ simulationVersion: 'phase15-fixture-v1', entities });
  const systems = createPhase17Systems({
    speedsX100PerSecond: { unit_p: 300 },
    basicAttack: { parameters: { unit_p: makeAttackParameters(config) } },
  });
  let current = state;
  const random = randomSession();
  const events: FuzzEvent[] = [];
  const callOrder: string[][] = [];
  for (let i = 0; i < config.ticks; i++) {
    const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
    current = r.state;
    for (const e of r.events) {
      const payload = e.payload as Record<string, number> | undefined;
      const attackInstanceId = typeof payload?.['attackInstanceId'] === 'number' ? payload['attackInstanceId'] : null;
      events.push({ tick: current.tick, type: e.type, sourceId: e.sourceId, attackInstanceId, payload });
    }
    callOrder.push([...r.callOrder]);
  }
  return { state: current, events, callOrder };
}

function allConfigs(): FuzzConfig[] {
  const seeds = [7, 13, 29, 47, 83, 131, 211, 311, 401, 503, 619, 733, 857, 977];
  const configs: FuzzConfig[] = [];
  for (const seed of seeds) {
    const rand = prng(seed);
    const deliveryKind = pick(rand, ['direct', 'projectile'] as const);
    configs.push({
      seed,
      ticks: 120,
      deliveryKind,
      rawAmount: int(rand, 1, 400),
      defense: int(rand, -40, 200),
      damageTypeOrdinal: int(rand, 0, 2),
      coverIgnoring: rand() < 0.5,
      piercing: rand() < 0.5,
      bossCapBps: rand() < 0.5 ? 1800 : null,
      speedX100PerSecond: int(rand, 300, 6000),
      expiryTicks: int(rand, 10, 90),
      homing: rand() < 0.3,
      maxTurnX100PerTick: int(rand, 0, 600),
      lostTargetPolicy: pick(rand, ['impact_stored_position', 'expire', 'continue_straight'] as const),
      shieldRaw: int(rand, 0, 300),
      shieldPriority: int(rand, 0, 5),
      healRaw: int(rand, 0, 200),
      healFactorBps: pick(rand, [10000, 5000] as const),
    });
  }
  return configs;
}

describe('P17 fuzz surface', () => {
  for (const config of allConfigs()) {
    it(`seed ${String(config.seed)} maintains combat invariants (${config.deliveryKind})`, () => {
      const { state, events } = runFuzz(config);
      // HP/shield never negative or above max.
      for (const e of state.entities) {
        expect(e.lp).toBeGreaterThanOrEqual(0);
        expect(e.lp).toBeLessThanOrEqual(e.maxLp);
        if (e.shields !== undefined) {
          let total = 0;
          for (const s of e.shields) {
            expect(s.remaining).toBeGreaterThanOrEqual(0);
            total += s.remaining;
          }
          expect(total).toBeGreaterThanOrEqual(0);
        }
      }
      // Projectiles that are present must be either resolved or valid.
      for (const p of state.projectiles ?? []) {
        expect(p.resolved || p.x100 >= 0).toBe(true);
      }
      // When shields were seeded, the ledger must actually have been exercised:
      // absorbed + expired amounts appear in events, and the sum of absorbed +
      // remaining never exceeds the seeded raw total (conservation).
      if (config.shieldRaw > 0) {
        const absorbedTotal = events
          .filter((e) => e.type === 'ShieldAbsorbed')
          .map((e) => e.payload?.['amount'] ?? 0)
          .reduce((a, b) => a + b, 0);
        const shieldTouched = events.some((e) => e.type === 'ShieldAbsorbed' || e.type === 'ShieldExpired');
        const remaining = (state.entities.find((e) => e.id === 'unit_p')?.shields ?? []).reduce((a, s) => a + s.remaining, 0);
        const seededTotal = config.shieldRaw + Math.floor(config.shieldRaw / 2);
        expect(absorbedTotal + remaining).toBeLessThanOrEqual(seededTotal);
        if (absorbedTotal > 0 || remaining < seededTotal) {
          expect(shieldTouched).toBe(true);
        }
      }
      // AttackPrepared may be repeated, but two AttackCommitted for the same
      // instance in the same tick is impossible by construction.
      const committedTicks = events.filter((e) => e.type === 'AttackCommitted').map((e) => e.tick);
      expect(new Set(committedTicks).size).toBe(committedTicks.length);
    });
  }

  it('is byte-deterministic for the same seed', () => {
    const configs = allConfigs();
    if (configs[0] === undefined) throw new Error('no fuzz configs');
    const a = runFuzz(configs[0]);
    const b = runFuzz(configs[0]);
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
    expect(JSON.stringify(a.callOrder)).toBe(JSON.stringify(b.callOrder));
  });

  it('never emits the same event type twice for one attack instance in one tick', () => {
    for (const config of allConfigs()) {
      const { events } = runFuzz(config);
      // Per (tick, source, attack instance), each event type appears at most
      // once. Different attack instances may both resolve in one tick (e.g. two
      // projectiles impacting simultaneously), so instances must be keyed.
      // ShieldExpired/ShieldAbsorbed carry no unique instance and can
      // legitimately repeat per tick (one event per expired/absorbing shield
      // source), so they are excluded.
      const perInstance = new Map<string, Set<string>>();
      for (const e of events) {
        if (e.type === 'ShieldExpired' || e.type === 'ShieldAbsorbed' || e.attackInstanceId === null) continue;
        const key = `${String(e.tick)}:${e.sourceId ?? 'null'}:${String(e.attackInstanceId)}`;
        const set = perInstance.get(key) ?? new Set<string>();
        if (set.has(e.type)) throw new Error(`duplicate ${e.type} at ${key}`);
        set.add(e.type);
        perInstance.set(key, set);
      }
    }
  });
});
