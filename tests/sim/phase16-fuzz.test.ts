import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase16Systems } from '../../src/game/sim/core/phase16-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { overlapDepthX100, type Body } from '../../src/game/sim/geometry/distance.js';
import { asX100, LANES } from '../../src/game/sim/geometry/x100.js';
import type { SpawnRequest } from '../../src/game/sim/spawn/spawn-system.js';
import type { LaneChangeRequest } from '../../src/game/sim/movement/lane-change-system.js';
import type { Role } from '../../src/game/sim/targeting/types.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import { battle, entity, randomSession } from './test-helpers.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });
const ROLES: readonly Role[] = Object.freeze(['fighter', 'marksman', 'mage', 'breaker', 'duelist', 'healer', 'support', 'controller'] as const);
const LANE_ORDINAL_LOOKUP: Readonly<Record<string, number>> = Object.freeze({ top: 0, middle: 1, bottom: 2 });

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

/** Deterministic lane ordinal (never undefined for the fuzz's valid lanes). */
function laneOrdinal(lane: string): number {
  const ordinal = LANE_ORDINAL_LOOKUP[lane];
  if (ordinal === undefined) throw new Error(`unknown lane ${lane}`);
  return ordinal;
}

interface FuzzCase {
  readonly seed: number;
  readonly entities: ReturnType<typeof entity>[];
  readonly arena: Body[];
  readonly ticks: number;
  readonly spawnRequests: SpawnRequest[];
  readonly laneChangeRequests: LaneChangeRequest[];
  readonly speeds: Record<string, number>;
  readonly roles: Record<string, Role>;
  readonly focusTargetId: Record<string, string>;
  readonly antiSummoner: string[];
  readonly preferredRangeX100: Record<string, number>;
}

/** Generates one valid, deterministic Phase 16 fuzz case from a seed. */
function generateCase(seed: number): FuzzCase {
  const rand = mulberry32(seed);
  const count = 3 + Math.floor(rand() * 5); // 3..7 units
  const entities: ReturnType<typeof entity>[] = [];
  const speeds: Record<string, number> = {};
  const roles: Record<string, Role> = {};
  const focusTargetId: Record<string, string> = {};
  const antiSummoner: string[] = [];
  const preferredRangeX100: Record<string, number> = {};
  for (let i = 0; i < count; i++) {
    const id = `unit_${String(i)}`;
    const lane = pick(rand, LANES);
    const side = i % 2 === 0 ? 'player' : 'enemy';
    const x100 = side === 'player' ? 1000 + Math.floor(rand() * 3000) : 6000 + Math.floor(rand() * 2500);
    // Mix origins on the enemy side so role modifiers (summoned/construct) are exercised.
    const origin = side === 'enemy' && rand() < 0.3 ? (rand() < 0.5 ? 'summoned' as const : 'construct' as const) : undefined;
    // Migrate first (all-or-none P15 field contract), then override origin on
    // the migrated entity so role modifiers are exercised legitimately.
    const migrated = migrateEntity({ entity: entity(id, { side, lane, x100 }), radiusX100: 60 + Math.floor(rand() * 90) });
    entities.push(origin === undefined ? migrated : Object.freeze({ ...migrated, origin }));
    speeds[id] = 120 + Math.floor(rand() * 400);
    if (rand() < 0.6) roles[id] = pick(rand, ROLES);
    if (rand() < 0.3) preferredRangeX100[id] = 400 + Math.floor(rand() * 3000);
  }
  // Focus-fire: bind some players to a specific enemy id if one exists.
  const enemyIds = entities.filter((e) => e.side === 'enemy').map((e) => e.id);
  for (const e of entities.filter((x) => x.side === 'player')) {
    if (rand() < 0.4 && enemyIds.length > 0) focusTargetId[e.id] = pick(rand, enemyIds);
  }
  for (const e of entities.filter((x) => x.side === 'player')) {
    if (rand() < 0.25) antiSummoner.push(e.id);
  }

  // 1..3 arena objects on random lanes, never overlapping a starting unit.
  const arena: Body[] = [];
  for (let i = 0; i < 1 + Math.floor(rand() * 3); i++) {
    let body: Body | null = null;
    for (let attempt = 0; attempt < 8 && body === null; attempt++) {
      const candidate: Body = { id: `obstacle_${String(i)}`, x100: asX100(2000 + Math.floor(rand() * 6000)), radiusX100: asX100(30 + Math.floor(rand() * 110)), lane: pick(rand, LANES) };
      const overlapsUnit = entities.some((e) => e.lane === candidate.lane && overlapDepthX100({ id: e.id, x100: asX100(e.x100), radiusX100: asX100(e.radiusX100 ?? 0), lane: e.lane }, candidate) > 0);
      if (!overlapsUnit) body = candidate;
    }
    if (body !== null) arena.push(body);
  }

  // Spawn requests: 0..3 summons/constructs, unique ids.
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

  // Lane-change requests: at most one per player, adjacent only, unique priorities.
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

  return { seed, entities, arena, ticks: 8 + Math.floor(rand() * 12), spawnRequests, laneChangeRequests, speeds, roles, focusTargetId, antiSummoner, preferredRangeX100 };
}

function runCase(c: FuzzCase, shuffle: boolean, extraTicks = 0): BattleModel {
  let state: BattleModel = battle({ entities: Object.freeze(c.entities), simulationVersion: 'phase16-fixture-v1' });
  const systems = createPhase16Systems({
    speedsX100PerSecond: c.speeds,
    spawnRequests: (ctx) => (ctx.state.tick === 0 ? (shuffle ? [...c.spawnRequests].reverse() : c.spawnRequests) : []),
    laneChangeRequests: (ctx) => (ctx.state.tick === 0 ? (shuffle ? [...c.laneChangeRequests].reverse() : c.laneChangeRequests) : []),
    arenaBodies: () => c.arena,
    roles: c.roles,
    targeting: {
      roles: c.roles,
      focusTargetId: c.focusTargetId,
      antiSummoner: c.antiSummoner,
    },
    attackPrep: { preferredRangeX100: Object.fromEntries(Object.entries(c.preferredRangeX100).map(([k, v]) => [k, asX100(v)])) },
  });
  const random = randomSession();
  for (let i = 0; i < c.ticks + extraTicks; i++) {
    state = stepBattle({ state, input, random, rules: {}, content: {}, systems }).state;
  }
  return state;
}

function assertInvariants(c: FuzzCase, state: BattleModel): void {
  const actives = state.entities.filter((e) => e.phase.phase === 'ACTIVE');
  const byId = new Map(actives.map((e) => [e.id, e]));
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
  // Arena rule: spawned entities must never overlap an arena object.
  for (const a of actives.filter((e) => e.id.startsWith('spawn_'))) {
    for (const object of c.arena) {
      if (a.lane !== object.lane) continue;
      const depth = overlapDepthX100({ id: a.id, x100: asX100(a.x100), radiusX100: asX100(a.radiusX100 ?? 0), lane: a.lane }, object);
      expect(depth, `arena overlap ${a.id}/${object.id} depth ${String(depth)} (seed ${String(c.seed)})`).toBe(0);
    }
  }
  // Targeting consistency: a committed target must exist on the opposite side.
  // A target that became invalid (dead/removed/unreachable) may only persist
  // while a lane change is in flight (re-evaluation suppressed by design) or
  // for the one tick after a lane change completes — stage E of the very next
  // tick must resolve it (§P16-T03 / §5.3 retarget at the earliest next tick).
  const pending: string[] = [];
  for (const a of actives) {
    const targetId = a.targetId;
    if (targetId === null) continue;
    const target = byId.get(targetId);
    expect(target, `target ${targetId} missing for ${a.id} (seed ${String(c.seed)})`).toBeDefined();
    if (target === undefined) continue;
    expect(target.side, `target ${targetId} of ${a.id} is not on the opposite side (seed ${String(c.seed)})`).not.toBe(a.side);
    const laneChanging = a.laneChange != null;
    if (laneChanging) continue; // re-evaluation suppressed by design
    const targetActive = target.phase.phase === 'ACTIVE';
    const delta = Math.abs(laneOrdinal(target.lane) - laneOrdinal(a.lane));
    const reachable = delta <= 1;
    if (targetActive && reachable) continue;
    pending.push(a.id);
  }
  // Every stale committed target must be resolved by the next tick's E stage.
  if (pending.length > 0) {
    const resolved = runCase(c, false, 1);
    for (const id of pending) {
      const after = resolved.entities.find((e) => e.id === id);
      if (after?.phase.phase !== 'ACTIVE') continue; // removed/defeated
      const targetId = after.targetId;
      if (targetId === null) continue; // released — correct
      const target = resolved.entities.find((e) => e.id === targetId);
      if (target == null) continue; // released or removed — correct
      expect(target.side, `target ${targetId} of ${id} not opposite after +1 tick (seed ${String(c.seed)})`).not.toBe(after.side);
      const delta = Math.abs(laneOrdinal(target.lane) - laneOrdinal(after.lane));
      expect(delta, `target ${targetId} of ${id} still unreachable after +1 tick (seed ${String(c.seed)})`).toBeLessThanOrEqual(1);
    }
  }
  // Attack-prep consistency: the in-range marker may only be set while a
  // target is committed; it is cleared when the target is released or dies.
  for (const a of actives) {
    if (a.inRangeSinceTick != null) {
      expect(a.targetId, `stale inRangeSinceTick on ${a.id} with no target (seed ${String(c.seed)})`).not.toBeNull();
    }
  }
}

describe('Phase 16 targeting/attack-prep fuzz surface', () => {
  it('never violates pass-through, arena, targeting, or marker invariants across seeds', { timeout: 90_000 }, () => {
    for (let seed = 1; seed <= 60; seed++) {
      const c = generateCase(seed);
      const state = runCase(c, false);
      assertInvariants(c, state);
    }
  });

  it('is byte-deterministic: same seed, same final snapshot', { timeout: 90_000 }, () => {
    for (let seed = 1; seed <= 40; seed++) {
      const c = generateCase(seed);
      const a = createSnapshot(runCase(c, false)).checksum;
      const b = createSnapshot(runCase(c, false)).checksum;
      expect(a, `seed ${String(seed)}`).toBe(b);
    }
  });

  it('is permutation-invariant: request order never changes the outcome', { timeout: 90_000 }, () => {
    for (let seed = 1; seed <= 40; seed++) {
      const c = generateCase(seed);
      const a = createSnapshot(runCase(c, false)).checksum;
      const b = createSnapshot(runCase(c, true)).checksum;
      expect(a, `seed ${String(seed)}`).toBe(b);
    }
  });
});
