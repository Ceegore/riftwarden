import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase15Systems } from '../../src/game/sim/core/phase15-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import type { SpawnRequest } from '../../src/game/sim/spawn/spawn-system.js';
import type { LaneChangeRequest } from '../../src/game/sim/movement/lane-change-system.js';
import type { Body } from '../../src/game/sim/geometry/distance.js';
import { overlapDepthX100 } from '../../src/game/sim/geometry/distance.js';
import { asX100, type Lane } from '../../src/game/sim/geometry/x100.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import { battle, entity, randomSession } from './test-helpers.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });
const LANES: readonly Lane[] = Object.freeze(['top', 'middle', 'bottom']);

/** Deterministic 32-bit PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, values: readonly T[]): T {
  const value = values[Math.floor(rand() * values.length)];
  if (value === undefined) throw new Error('pick from empty list');
  return value;
}

interface FuzzCase {
  readonly seed: number;
  readonly entities: ReturnType<typeof entity>[];
  readonly arena: Body[];
  readonly ticks: number;
  readonly spawnRequests: SpawnRequest[];
  readonly laneChangeRequests: LaneChangeRequest[];
  readonly speeds: Record<string, number>;
}

/** Generates one valid, deterministic fuzz case from a seed. */
function generateCase(seed: number): FuzzCase {
  const rand = mulberry32(seed);
  const count = 2 + Math.floor(rand() * 5); // 2..6 units
  const entities: ReturnType<typeof entity>[] = [];
  const speeds: Record<string, number> = {};
  for (let i = 0; i < count; i++) {
    const id = `unit_${String(i)}`;
    const lane = pick(rand, LANES);
    const side = i % 2 === 0 ? 'player' : 'enemy';
    // Spread positions so the fronts have room to close without degenerate state.
    const x100 = side === 'player' ? 1000 + Math.floor(rand() * 2500) : 6500 + Math.floor(rand() * 2500);
    entities.push(migrateEntity({ entity: entity(id, { side, lane, x100 }), radiusX100: 60 + Math.floor(rand() * 80) }));
    speeds[id] = 150 + Math.floor(rand() * 450);
  }

  // 1..3 arena objects on random lanes. A valid battle never starts units
  // inside an obstacle, so positions overlapping a starting unit are retried.
  const arena: Body[] = [];
  for (let i = 0; i < 1 + Math.floor(rand() * 3); i++) {
    let body: Body | null = null;
    for (let attempt = 0; attempt < 8 && body === null; attempt++) {
      const candidate: Body = { id: `obstacle_${String(i)}`, x100: asX100(2000 + Math.floor(rand() * 6000)), radiusX100: asX100(30 + Math.floor(rand() * 120)), lane: pick(rand, LANES) };
      const overlapsUnit = entities.some((e) => e.lane === candidate.lane && overlapDepthX100({ id: e.id, x100: asX100(e.x100), radiusX100: asX100(e.radiusX100 ?? 0), lane: e.lane }, candidate) > 0);
      if (!overlapsUnit) body = candidate;
    }
    if (body !== null) arena.push(body);
  }

  // Spawn requests: 0..3 summons/constructs, all on the player side with
  // reserved ids guaranteed unique against the starting units.
  const spawnRequests: SpawnRequest[] = [];
  const used = new Set(entities.map((e) => e.id));
  for (let i = 0; i < Math.floor(rand() * 4); i++) {
    const id = `spawn_${String(i)}`;
    if (used.has(id)) continue;
    used.add(id);
    if (rand() < 0.65) {
      spawnRequests.push({
        kind: 'summon', reservedId: id, side: 'player', targetLane: pick(rand, LANES),
        radiusX100: asX100(50 + Math.floor(rand() * 100)), maxLp: 300 + Math.floor(rand() * 700),
        startZoneX100: asX100(150 + Math.floor(rand() * 400)),
        ...(rand() < 0.4 ? { displacementPolicy: 'displace' as const } : {}),
      });
    } else {
      spawnRequests.push({
        kind: 'construct', reservedId: id, side: 'player', slotId: `slot_${id}`, lane: pick(rand, LANES),
        x100: asX100(1000 + Math.floor(rand() * 8000)), radiusX100: asX100(50 + Math.floor(rand() * 80)),
        maxLp: 300 + Math.floor(rand() * 500), replacementPolicy: pick(rand, [null, 'reject', 'replace'] as const),
      });
    }
  }

  // Lane-change requests: at most one per entity, only adjacent targets, only
  // when the entity is ACTIVE and not already in flight (fresh battle: cooldown
  // 0, laneChange null). Priorities are unique per entity by construction.
  const laneChangeRequests: LaneChangeRequest[] = [];
  const laneOrdinalOf: Record<string, number> = { top: 0, middle: 1, bottom: 2 };
  for (const e of entities) {
    if (e.side !== 'player' || rand() < 0.5) continue;
    const current = laneOrdinalOf[e.lane] ?? 1;
    const delta = pick(rand, [-1, 1]);
    const target = current + delta;
    if (target < 0 || target > 2) continue;
    const targetLane = LANES[target];
    if (targetLane === undefined) throw new Error('invalid target lane');
    laneChangeRequests.push({ entityId: e.id, to: targetLane, reason: 'normal', sourceId: e.id, priority: Math.floor(rand() * 100) });
  }

  return { seed, entities, arena, ticks: 8 + Math.floor(rand() * 10), spawnRequests, laneChangeRequests, speeds };
}

function runCase(c: FuzzCase, shuffle: boolean): BattleModel {
  let state: BattleModel = battle({ entities: Object.freeze(c.entities), simulationVersion: 'phase15-fixture-v1' });
  const systems = createPhase15Systems({
    speedsX100PerSecond: c.speeds,
    // Requests are one-shot: they only apply on the battle's first tick.
    spawnRequests: (ctx) => (ctx.state.tick === 0 ? (shuffle ? [...c.spawnRequests].reverse() : c.spawnRequests) : []),
    laneChangeRequests: (ctx) => (ctx.state.tick === 0 ? (shuffle ? [...c.laneChangeRequests].reverse() : c.laneChangeRequests) : []),
    arenaBodies: () => c.arena,
  });
  const random = randomSession();
  for (let i = 0; i < c.ticks; i++) {
    state = stepBattle({ state, input, random, rules: {}, content: {}, systems }).state;
  }
  return state;
}

function assertInvariants(c: FuzzCase, state: BattleModel): void {
  const actives = state.entities.filter((e) => e.phase.phase === 'ACTIVE');
  const ids = new Set<string>();
  for (const e of actives) {
    expect(ids.has(e.id), `duplicate id ${e.id} (seed ${String(c.seed)})`).toBe(false);
    ids.add(e.id);
  }
  // §8.1: no ACTIVE entity may overlap an enemy body on the same lane.
  for (const a of actives) {
    for (const b of actives) {
      if (a.side === b.side || a.lane !== b.lane) continue;
      const depth = overlapDepthX100({ id: a.id, x100: asX100(a.x100), radiusX100: asX100(a.radiusX100 ?? 0), lane: a.lane }, { id: b.id, x100: asX100(b.x100), radiusX100: asX100(b.radiusX100 ?? 0), lane: b.lane });
      expect(depth, `enemy overlap ${a.id}/${b.id} depth ${String(depth)} (seed ${String(c.seed)})`).toBe(0);
    }
  }
  // Arena rule (§7.4/GDD): spawn placement must never overlap an arena object.
  // The fuzz's own spawned entities must stay clear; movement pathfinding
  // around obstacles is a Phase 16 concern and is deliberately not asserted.
  for (const a of actives.filter((e) => e.id.startsWith('spawn_'))) {
    for (const object of c.arena) {
      if (a.lane !== object.lane) continue;
      const depth = overlapDepthX100({ id: a.id, x100: asX100(a.x100), radiusX100: asX100(a.radiusX100 ?? 0), lane: a.lane }, object);
      expect(depth, `arena overlap ${a.id}/${object.id} depth ${String(depth)} (seed ${String(c.seed)})`).toBe(0);
    }
  }
}

describe('Phase 15 spawn/lane-change fuzz surface', () => {
  it('never violates pass-through, arena, or id invariants across seeds', { timeout: 60_000 }, () => {
    for (let seed = 1; seed <= 60; seed++) {
      const c = generateCase(seed);
      const state = runCase(c, false);
      assertInvariants(c, state);
    }
  });

  it('is byte-deterministic: same seed, same final snapshot', { timeout: 60_000 }, () => {
    for (let seed = 1; seed <= 40; seed++) {
      const c = generateCase(seed);
      const a = createSnapshot(runCase(c, false)).checksum;
      const b = createSnapshot(runCase(c, false)).checksum;
      expect(a, `seed ${String(seed)}`).toBe(b);
    }
  });

  it('is permutation-invariant: request order never changes the outcome', { timeout: 60_000 }, () => {
    for (let seed = 1; seed <= 40; seed++) {
      const c = generateCase(seed);
      const a = createSnapshot(runCase(c, false)).checksum;
      const b = createSnapshot(runCase(c, true)).checksum;
      expect(a, `seed ${String(seed)}`).toBe(b);
    }
  });
});
