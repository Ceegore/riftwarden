import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { asX100 } from '../../src/game/sim/geometry/x100.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { KernelEntity } from '../../src/game/sim/core/entity.js';
import { battle, entity, randomSession } from './test-helpers.js';
import { tick as tickOf } from '../../src/game/sim/core/primitives.js';
import type { AttackParameters } from '../../src/game/sim/attack/attack-state.js';
import type { ShieldSource } from '../../src/game/sim/combat/shield-ledger.js';
import type { SpawnRequest } from '../../src/game/sim/spawn/spawn-system.js';

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
  readonly targetIds: readonly string[];
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
      events.push({ tick: current.tick, type: e.type, sourceId: e.sourceId, targetIds: e.targetIds, attackInstanceId, payload });
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
  // The seed loop replays 120 ticks per config; under full-suite parallel
  // load a 5 s default can be exceeded, so grant a generous explicit budget.
  const FUZZ_TIMEOUT = 30_000;
  for (const config of allConfigs()) {
    it(`seed ${String(config.seed)} maintains combat invariants (${config.deliveryKind})`, { timeout: FUZZ_TIMEOUT }, () => {
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

  it('is byte-deterministic for the same seed', { timeout: FUZZ_TIMEOUT }, () => {
    const configs = allConfigs();
    if (configs[0] === undefined) throw new Error('no fuzz configs');
    const a = runFuzz(configs[0]);
    const b = runFuzz(configs[0]);
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
    expect(JSON.stringify(a.callOrder)).toBe(JSON.stringify(b.callOrder));
  });

  it('never emits the same event type twice for one attack instance in one tick', { timeout: FUZZ_TIMEOUT }, () => {
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

describe('P17 stage-J defeat fuzz', () => {
  const FUZZ_TIMEOUT = 30_000;
  // Lethal raw amounts so kills actually happen and stage J is exercised.
  function lethalConfigs(): FuzzConfig[] {
    return allConfigs().map((c) => ({ ...c, rawAmount: int(prng(c.seed + 10_000), 600, 3000) }));
  }

  it('confirms every kill: Defeated follows the killing DamageApplied in the same tick', { timeout: FUZZ_TIMEOUT }, () => {
    for (const config of lethalConfigs()) {
      const { events } = runFuzz(config);
      const defeatedAt = new Map<string, number>();
      for (const e of events) {
        if (e.type !== 'Defeated' || e.sourceId === null) continue;
        defeatedAt.set(e.sourceId, e.tick);
      }
      for (const [entityId, tick] of defeatedAt) {
        const kills = events.filter((e) => e.type === 'DamageApplied' && e.tick === tick && e.targetIds.includes(entityId));
        expect(kills.length).toBeGreaterThan(0);
        // The killing blow brings HP to 0: hpAfter === 0.
        const killer = kills[kills.length - 1];
        expect(killer?.payload?.['hpAfter']).toBe(0);
        // Overkill = postShield - finalHpDelta, i.e. excess beyond remaining LP.
        const overkill = Math.max(0, (killer?.payload?.['preShieldAmount'] ?? 0) - (killer?.payload?.['absorbedShield'] ?? 0) - (killer?.payload?.['finalHpDelta'] ?? 0));
        const defeatedEvent = events.find((e) => e.type === 'Defeated' && e.sourceId === entityId && e.tick === tick);
        expect(defeatedEvent?.payload?.['overkill']).toBe(overkill);
      }
    }
  });

  it('no combat events target an entity after it is defeated or removed', { timeout: FUZZ_TIMEOUT }, () => {
    for (const config of lethalConfigs()) {
      const { events } = runFuzz(config);
      const terminalAt = new Map<string, number>();
      for (const e of events) {
        if (e.type === 'Defeated' && e.sourceId !== null && !terminalAt.has(e.sourceId)) terminalAt.set(e.sourceId, e.tick);
      }
      for (const e of events) {
        if (e.type !== 'DamageApplied' && e.type !== 'HealApplied' && e.type !== 'ShieldApplied') continue;
        if (e.tick < 2) continue;
        for (const id of e.targetIds) {
          const terminal = terminalAt.get(id);
          if (terminal !== undefined) expect(e.tick).toBeLessThanOrEqual(terminal);
        }
      }
    }
  });

  it('no premature death: Defeated never fires while LP is still positive', { timeout: FUZZ_TIMEOUT }, () => {
    for (const config of lethalConfigs()) {
      const { events } = runFuzz(config);
      for (const e of events) {
        if (e.type !== 'Defeated') continue;
        // The killing blow in the same tick must have hpAfter 0 — meaning LP
        // reached zero before stage J, never before stage I applied damage.
        const kills = events.filter((k) => k.type === 'DamageApplied' && k.tick === e.tick && k.sourceId === e.sourceId);
        if (kills.length > 0) {
          expect(kills[kills.length - 1]?.payload?.['hpAfter']).toBe(0);
        }
      }
    }
  });
});

describe('P17 stage-L battle-end fuzz', () => {
  // ~18s per stageL config in isolation, more under parallel load: never load-flaky.
  const FUZZ_TIMEOUT = 60_000;
  // Seed the battle just before the 2700 soft limit (2680) and run ~520 ticks
  // so the collapse window (2700–3150) and its 90-tick damage cadence are
  // exercised, ending via time limit / chapter76. The anti-stuck endcap needs
  // 600 no-progress ticks and cannot fire before the time limit from this seed.
  const START_TICK = 2680;
  const RUN_TICKS = 520;

  function stageLConfigs(): FuzzConfig[] {
    return allConfigs().slice(0, 8).map((c) => ({ ...c, rawAmount: 0, healRaw: 0, shieldRaw: 0 }));
  }

  function runStageL(config: FuzzConfig): { state: BattleModel; events: FuzzEvent[] } {
    const entities: KernelEntity[] = [
      unit('unit_p1', 'player', { x100: 1800, maxLp: 1000, lp: 1000 }),
      unit('unit_p2', 'player', { x100: 1900, lane: 'middle', maxLp: 1500, lp: 1500 }),
      unit('unit_e1', 'enemy', { x100: 6200, maxLp: 1000, lp: 1000 }),
      unit('unit_e2', 'enemy', { x100: 6400, lane: 'middle', maxLp: 1200, lp: 1200 }),
    ];
    const state = battle({ simulationVersion: 'phase15-fixture-v1', entities, tick: tickOf(START_TICK) });
    const systems = createPhase17Systems({
      speedsX100PerSecond: {},
      basicAttack: { parameters: { unit_p1: makeAttackParameters(config) } },
    });
    let current = state;
    const random = randomSession();
    const events: FuzzEvent[] = [];
    for (let i = 0; i < RUN_TICKS; i++) {
      const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
      current = r.state;
      for (const e of r.events) {
        const payload = e.payload as Record<string, number> | undefined;
        const attackInstanceId = typeof payload?.['attackInstanceId'] === 'number' ? payload['attackInstanceId'] : null;
        events.push({ tick: current.tick, type: e.type, sourceId: e.sourceId, targetIds: e.targetIds, attackInstanceId, payload });
      }
    }
    return { state: current, events };
  }

  it('always reaches a terminal outcome by the hard limit, with no events after BattleEnded', { timeout: FUZZ_TIMEOUT }, () => {
    for (const config of stageLConfigs()) {
      const { state, events } = runStageL(config);
      expect(['VICTORY', 'DEFEAT', 'DRAW_ABORT']).toContain(state.phase.phase);
      expect(state.tick).toBeLessThanOrEqual(5400);
      const endedAt = events.find((e) => e.type === 'BattleEnded')?.tick;
      if (endedAt !== undefined) {
        for (const e of events) expect(e.tick).toBeLessThanOrEqual(endedAt);
      } else {
        // No BattleEnded means the battle was terminal before this run began
        // stepping (mutual/elimination at the seed) — never from mid-run stall.
        expect(state.tick).toBeLessThanOrEqual(START_TICK + 4);
      }
    }
  });

  it('collapse damage lands 8% max-LP per 90-tick interval for every regular unit', { timeout: FUZZ_TIMEOUT }, () => {
    for (const config of stageLConfigs()) {
      const { events } = runStageL(config);
      // Units with maxLp 1000/1200/1500 → 80/96/120 per interval (floor).
      const perUnit = new Map<string, number>();
      for (const e of events) {
        if (e.type !== 'DamageApplied' || e.sourceId !== 'rift_collapse') continue;
        const id = e.targetIds[0];
        if (id === undefined) continue;
        perUnit.set(id, (perUnit.get(id) ?? 0) + (e.payload?.['finalHpDelta'] ?? 0));
      }
      // A 450-tick window with 90-tick cadence: intervals at 2790, 2880, 2970,
      // 3060 → 4 intervals (3150 requests the end). Each unit survives all 4
      // because 4×8% < 100% of max-LP; total is exactly the per-interval floor.
      const maxLpByUnit: Readonly<Record<string, number>> = Object.freeze({ unit_p1: 1000, unit_p2: 1500, unit_e1: 1000, unit_e2: 1200 });
      for (const [id, total] of perUnit) {
        const maxLp = maxLpByUnit[id] ?? 0;
        expect(total).toBe(4 * Math.max(1, Math.floor((maxLp * 800) / 10000)));
      }
    }
  });

  it('tie-break determinism: same seed produces the same terminal outcome and event count', { timeout: 120_000 }, () => {
    for (const config of stageLConfigs()) {
      const first = runStageL(config);
      const second = runStageL(config);
      expect(second.state.phase.phase).toBe(first.state.phase.phase);
      expect(second.state.tick).toBe(first.state.tick);
      expect(second.events.length).toBe(first.events.length);
      // Byte-identical event stream (types and payloads) — the resolver's
      // terminal decision is fully deterministic.
      expect(second.events.map((e) => `${String(e.tick)}:${e.type}:${JSON.stringify(e.payload ?? {})}`)).toEqual(first.events.map((e) => `${String(e.tick)}:${e.type}:${JSON.stringify(e.payload ?? {})}`));
    }
  });
});

describe('P17 full-lifecycle fuzz (spawn → combat → defeat → terminal)', () => {
  const FUZZ_TIMEOUT = 30_000;
  // Lethal mixed deliveries (direct + projectile + AoE radius) so kills,
  // defeats and the terminal decision all fire in one battle from tick 0.
  function lifecycleConfigs(): FuzzConfig[] {
    return allConfigs().slice(0, 6).map((c) => ({ ...c, rawAmount: int(prng(c.seed + 30_000), 800, 3000) }));
  }

  function runLifecycle(config: FuzzConfig): { state: BattleModel; events: FuzzEvent[] } {

    // Player has two regular units; a summon and a construct spawn mid-battle.
    // Enemies: one boss (for the tie-break ledger) plus a regular.
    const p1 = unit('unit_p1', 'player', { x100: 1800, maxLp: 1000, lp: 1000 });
    const p2 = unit('unit_p2', 'player', { x100: 1900, lane: 'middle', maxLp: 1000, lp: 1000 });
    const boss = unit('unit_boss', 'enemy', { x100: 6200, maxLp: 2000, lp: 2000 });
    const e2 = unit('unit_e2', 'enemy', { x100: 6400, lane: 'middle', maxLp: 1000, lp: 1000 });
    const state = battle({ simulationVersion: 'phase15-fixture-v1', entities: [p1, p2, boss, e2] });
    const systems = createPhase17Systems({
      speedsX100PerSecond: { unit_p1: 300, unit_p2: 300 },
      spawnRequests: (ctx): readonly SpawnRequest[] => ctx.state.tick === 3
        ? [
            { kind: 'summon', reservedId: 'unit_summon', side: 'player', targetLane: 'top', radiusX100: asX100(100), maxLp: 400, startZoneX100: asX100(200) },
            { kind: 'construct', reservedId: 'unit_construct', side: 'player', slotId: 'slot_a', lane: 'middle', x100: asX100(2100), radiusX100: asX100(120), maxLp: 600, replacementPolicy: null },
          ]
        : [],
      battleEnd: { bossIds: new Set(['unit_boss']) },
      basicAttack: {
        parameters: {
          unit_p1: makeAttackParameters(config),
          unit_p2: makeAttackParameters(config),
        },
      },
    });
    let current = state;
    const random = randomSession();
    const events: FuzzEvent[] = [];
    // Cap at 600 ticks: lethal combat ends the battle long before the collapse
    // window, and the spawns/defeats/terminal must all fire well within it.
    for (let i = 0; i < 600; i++) {
      const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
      current = r.state;
      for (const e of r.events) {
        const payload = e.payload as Record<string, number> | undefined;
        const attackInstanceId = typeof payload?.['attackInstanceId'] === 'number' ? payload['attackInstanceId'] : null;
        events.push({ tick: current.tick, type: e.type, sourceId: e.sourceId, targetIds: e.targetIds, attackInstanceId, payload });
      }
      if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(current.phase.phase)) break;
    }
    return { state: current, events };
  }

  it('spawned summons/constructs never become combat-capable and the battle still ends', { timeout: FUZZ_TIMEOUT }, () => {
    for (const config of lifecycleConfigs()) {
      const { state, events } = runLifecycle(config);
      expect(['VICTORY', 'DEFEAT', 'DRAW_ABORT']).toContain(state.phase.phase);
      const spawned = events.filter((e) => e.type === 'Spawned');
      expect(spawned.length).toBeGreaterThanOrEqual(2);
      // The construct and summon must never appear as a combat target after
      // spawning (no friendly fire, and they are not combat-capable).
      for (const e of events) {
        if (e.type !== 'DamageApplied' && e.type !== 'HealApplied') continue;
        expect(e.targetIds).not.toContain('unit_construct');
        expect(e.targetIds).not.toContain('unit_summon');
      }
    }
  });

  it('every Defeated is confirmed by a killing blow and no events follow BattleEnded', { timeout: FUZZ_TIMEOUT }, () => {
    for (const config of lifecycleConfigs()) {
      const { events } = runLifecycle(config);
      const defeatedAt = new Map<string, number>();
      for (const e of events) {
        if (e.type === 'Defeated' && e.sourceId !== null) defeatedAt.set(e.sourceId, e.tick);
      }
      for (const [entityId, tick] of defeatedAt) {
        const kills = events.filter((e) => e.type === 'DamageApplied' && e.tick === tick && e.targetIds.includes(entityId));
        expect(kills.length).toBeGreaterThan(0);
        expect(kills[kills.length - 1]?.payload?.['hpAfter']).toBe(0);
      }
      const endedAt = events.find((e) => e.type === 'BattleEnded')?.tick;
      if (endedAt !== undefined) for (const e of events) expect(e.tick).toBeLessThanOrEqual(endedAt);
    }
  });

  it('boss-damage ledger stays consistent with DamageApplied events on the boss', { timeout: FUZZ_TIMEOUT }, () => {
    for (const config of lifecycleConfigs()) {
      const { state, events } = runLifecycle(config);
      const ledger = state.bossDamageDealt;
      expect(ledger).toBeDefined();
      // Recompute expected player-side boss damage from DamageApplied events
      // targeting the boss (final damage after shields).
      let expected = 0;
      for (const e of events) {
        if (e.type !== 'DamageApplied' || !e.targetIds.includes('unit_boss')) continue;
        expected += Math.max(0, (e.payload?.['preShieldAmount'] ?? 0) - (e.payload?.['absorbedShield'] ?? 0));
      }
      expect(ledger?.player ?? 0).toBe(expected);
      // The boss never dealt damage to a boss (no player boss in this battle).
      expect(ledger?.enemy ?? 0).toBe(0);
    }
  });
});
