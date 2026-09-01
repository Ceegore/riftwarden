import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase15Systems } from '../../src/game/sim/core/phase15-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import type { LaneChangeRequest } from '../../src/game/sim/movement/lane-change-system.js';
import type { Body } from '../../src/game/sim/geometry/distance.js';
import { overlapDepthX100 } from '../../src/game/sim/geometry/distance.js';
import { asX100, type Lane } from '../../src/game/sim/geometry/x100.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { KernelEvent } from '../../src/game/sim/events/event-types.js';
import { battle, entity, randomSession } from './test-helpers.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });
const LANES: readonly Lane[] = Object.freeze(['top', 'middle', 'bottom']);
const LANE_ORDINAL: Readonly<Record<Lane, number>> = Object.freeze({ top: 0, middle: 1, bottom: 2 });

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

interface FuzzCase {
  readonly seed: number;
  readonly entities: ReturnType<typeof entity>[];
  readonly arena: Body[];
  readonly speeds: Record<string, number>;
  readonly laneChangeRequests: LaneChangeRequest[];
  readonly ticks: number;
}

/**
 * Generates a valid, deterministic case. Every lane gets 1–2 player and 1–2
 * enemy units placed with guaranteed non-overlapping positions (gaps ≥ radii +
 * 100 X100) and a wide no-man's-land between the fronts, so any overlap that
 * appears later must have been CREATED by movement — never present at start.
 */
function generateCase(seed: number): FuzzCase {
  const rand = mulberry32(seed);
  const entities: ReturnType<typeof entity>[] = [];
  const speeds: Record<string, number> = {};
  for (const lane of LANES) {
    const playerCount = 1 + Math.floor(rand() * 2);
    const enemyCount = 1 + Math.floor(rand() * 2);
    // Player units advance toward higher x; place them from the left edge up.
    let pCursor = 500;
    for (let i = 0; i < playerCount; i++) {
      const radius = 60 + Math.floor(rand() * 80);
      const id = `unit_p_${lane}_${String(i)}`;
      entities.push(migrateEntity({ entity: entity(id, { side: 'player', lane, x100: pCursor }), radiusX100: radius }));
      speeds[id] = 150 + Math.floor(rand() * 350);
      pCursor += 2 * radius + 100;
    }
    // Enemy units advance toward lower x; place them from the right edge down.
    let eCursor = 9500;
    for (let i = 0; i < enemyCount; i++) {
      const radius = 60 + Math.floor(rand() * 80);
      const id = `unit_e_${lane}_${String(i)}`;
      entities.push(migrateEntity({ entity: entity(id, { side: 'enemy', lane, x100: eCursor }), radiusX100: radius }));
      speeds[id] = 150 + Math.floor(rand() * 350);
      eCursor -= 2 * radius + 100;
    }
  }

  // 0..2 arena objects; never overlapping a starting unit (retry until clear).
  const arena: Body[] = [];
  for (let i = 0; i < Math.floor(rand() * 3); i++) {
    let body: Body | null = null;
    for (let attempt = 0; attempt < 10 && body === null; attempt++) {
      const candidate: Body = { id: `obstacle_${String(i)}`, x100: asX100(2000 + Math.floor(rand() * 6000)), radiusX100: asX100(30 + Math.floor(rand() * 100)), lane: LANES[Math.floor(rand() * LANES.length)] ?? 'middle' };
      const overlapsUnit = entities.some((e) => e.lane === candidate.lane && overlapDepthX100({ id: e.id, x100: asX100(e.x100), radiusX100: asX100(e.radiusX100 ?? 0), lane: e.lane }, candidate) > 0);
      if (!overlapsUnit) body = candidate;
    }
    if (body !== null) arena.push(body);
  }

  // Optional adjacent lane changes for player units (one per entity, unique
  // priorities by construction). The 90-tick cooldown starts at 0 so the first
  // change is legal on the battle's first tick.
  const laneChangeRequests: LaneChangeRequest[] = [];
  for (const e of entities) {
    if (e.side !== 'player' || rand() < 0.6) continue;
    const current = LANE_ORDINAL[e.lane];
    const target = current + (rand() < 0.5 ? -1 : 1);
    const targetLane = LANES[target];
    if (targetLane === undefined) continue;
    laneChangeRequests.push({ entityId: e.id, to: targetLane, reason: 'normal', sourceId: e.id, priority: 1000 + Math.floor(rand() * 1000) });
  }

  return { seed, entities, arena, speeds, laneChangeRequests, ticks: 10 + Math.floor(rand() * 20) };
}

function runCase(c: FuzzCase): { states: readonly BattleModel[]; events: readonly (readonly KernelEvent[])[] } {
  let state: BattleModel = battle({ entities: Object.freeze(c.entities), simulationVersion: 'phase15-fixture-v1' });
  const systems = createPhase15Systems({
    speedsX100PerSecond: c.speeds,
    laneChangeRequests: (ctx) => (ctx.state.tick === 0 ? c.laneChangeRequests : []),
    arenaBodies: () => c.arena,
  });
  const random = randomSession();
  const states: BattleModel[] = [];
  const events: (readonly KernelEvent[])[] = [];
  for (let i = 0; i < c.ticks; i++) {
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    states.push(state);
    events.push(r.events);
  }
  return { states, events };
}

function bodyOf(e: { readonly id: string; readonly x100: number; readonly lane: Lane; readonly radiusX100?: number }): Body {
  return { id: e.id, x100: asX100(e.x100), radiusX100: asX100(e.radiusX100 ?? 0), lane: e.lane };
}

function assertTickInvariants(c: FuzzCase, state: BattleModel, tickEvents: readonly KernelEvent[]): void {
  const actives = state.entities.filter((e) => e.phase.phase === 'ACTIVE');
  const flagged = tickEvents.some((e) => e.type === 'SafetyCapTriggered');
  for (const a of actives) {
    expect(a.x100, `bounds high ${a.id} (seed ${String(c.seed)})`).toBeLessThanOrEqual(10000);
    expect(a.x100, `bounds low ${a.id} (seed ${String(c.seed)})`).toBeGreaterThanOrEqual(0);
  }
  for (let i = 0; i < actives.length; i++) {
    const a = actives[i];
    if (a === undefined) continue;
    for (let j = i + 1; j < actives.length; j++) {
      const b = actives[j];
      if (a.lane !== b?.lane) continue;
      const depth = overlapDepthX100(bodyOf(a), bodyOf(b));
      if (a.side === b.side) {
        // §8.2 separation is budget-capped (25 X100/entity/tick), so a same-side
        // residual overlap is legal — but it MUST be flagged that tick by the
        // safety cap, never silent.
        if (depth > 0) {
          expect(flagged, `unflagged same-side overlap ${a.id}/${b.id} (seed ${String(c.seed)})`).toBe(true);
        }
      } else {
        // §8.1 hard rule: opposing sides never overlap after the stop-gap and
        // edge-touch clamps.
        expect(depth, `opposing overlap ${a.id}/${b.id} depth ${String(depth)} (seed ${String(c.seed)})`).toBe(0);
      }
    }
    // Movement clamps at arena edges (§8.1-style): no ACTIVE entity may overlap
    // an arena object in its lane.
    for (const object of c.arena) {
      if (a.lane !== object.lane) continue;
      const depth = overlapDepthX100(bodyOf(a), object);
      expect(depth, `arena overlap ${a.id}/${object.id} depth ${String(depth)} (seed ${String(c.seed)})`).toBe(0);
    }
  }
}

describe('Phase 15 movement overlap fuzz surface', () => {
  it('never develops opposing overlap, out-of-bounds positions or arena overlap across seeds and ticks', { timeout: 90_000 }, () => {
    for (let seed = 1; seed <= 80; seed++) {
      const c = generateCase(seed);
      const { states, events } = runCase(c);
      expect(states.length).toBe(c.ticks);
      for (let t = 0; t < states.length; t++) {
        const state = states[t];
        if (state === undefined) continue;
        assertTickInvariants(c, state, events[t] ?? []);
      }
    }
  });

  it('is byte-deterministic: same seed, same final snapshot', { timeout: 60_000 }, () => {
    for (let seed = 1; seed <= 40; seed++) {
      const c = generateCase(seed);
      const a = createSnapshot(runCase(c).states.at(-1) ?? battle()).checksum;
      const b = createSnapshot(runCase(c).states.at(-1) ?? battle()).checksum;
      expect(a, `seed ${String(seed)}`).toBe(b);
    }
  });
});
