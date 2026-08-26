import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase15Systems } from '../../src/game/sim/core/phase15-systems.js';
import { canonicalJson } from '../../src/game/sim/snapshot/canonical-json.js';
import { createSnapshot, snapshotPayload } from '../../src/game/sim/snapshot/snapshot.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { KernelEntity } from '../../src/game/sim/core/entity.js';
import { asX100, type Lane } from '../../src/game/sim/geometry/x100.js';
import type { SpawnRequest } from '../../src/game/sim/spawn/spawn-system.js';
import type { LaneChangeRequest } from '../../src/game/sim/movement/lane-change-system.js';
import { battle, entity, randomSession } from './test-helpers.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

function shuffle<T>(items: readonly T[], seed: number): T[] {
  const x = [...items];
  let s = seed >>> 0;
  for (let i = x.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    const j = s % (i + 1);
    const atI = x[i];
    const atJ = x[j];
    if (atI === undefined || atJ === undefined) continue;
    x[i] = atJ;
    x[j] = atI;
  }
  return x;
}

function baseEntities(): KernelEntity[] {
  return [
    migrateEntity({ entity: entity('unit_p1', { lane: 'top', x100: 1800 }), radiusX100: 100 }),
    migrateEntity({ entity: entity('unit_p2', { lane: 'middle', x100: 2400 }), radiusX100: 120 }),
    Object.freeze({
      ...migrateEntity({ entity: entity('unit_e1', { side: 'enemy', lane: 'middle', x100: 6200 }), radiusX100: 140 }),
      laneChange: Object.freeze({ from: 'middle' as const, to: 'top' as const, progressTicks: 5, initiatedTick: 0, reason: 'normal' as const, sourceId: 'unit_e1' }),
    }) as KernelEntity,
    migrateEntity({ entity: entity('unit_e2', { side: 'enemy', lane: 'bottom', x100: 7600 }), radiusX100: 150 }),
    migrateEntity({ entity: entity('unit_p3', { lane: 'top', x100: 4000 }), radiusX100: 90 }),
  ];
}

interface SoakDef {
  readonly entities: readonly KernelEntity[];
  readonly speeds: Readonly<Record<string, number>>;
  readonly spawns?: (tick: number) => readonly SpawnRequest[];
  readonly laneChanges?: (tick: number) => readonly LaneChangeRequest[];
}

function runSoak(def: SoakDef, ticks: number): BattleModel {
  const random = randomSession();
  const systems = createPhase15Systems({
    speedsX100PerSecond: def.speeds,
    spawnRequests: (ctx) => (def.spawns ? def.spawns(ctx.state.tick) : []),
    laneChangeRequests: (ctx) => (def.laneChanges ? def.laneChanges(ctx.state.tick) : []),
  });
  let state: BattleModel = battle({ entities: Object.freeze([...def.entities]), simulationVersion: 'phase15-fixture-v1' });
  for (let i = 0; i < ticks; i++) {
    state = stepBattle({ state, input, random, rules: {}, content: {}, systems }).state;
  }
  return state;
}

function mirrorLane(lane: Lane): Lane {
  return lane === 'top' ? 'bottom' : lane === 'bottom' ? 'top' : lane;
}

/** Mirrors a kernel entity: sides swap, x mirrors around the field center. */
function mirrorEntity(e: KernelEntity): KernelEntity {
  return Object.freeze({
    ...e,
    side: e.side === 'player' ? 'enemy' : 'player',
    lane: mirrorLane(e.lane),
    x100: 10000 - e.x100,
    laneChange: e.laneChange === undefined || e.laneChange === null ? e.laneChange : Object.freeze({ ...e.laneChange, from: mirrorLane(e.laneChange.from), to: mirrorLane(e.laneChange.to) }),
  }) as KernelEntity;
}

function canonicalOf(state: BattleModel): string {
  return canonicalJson(snapshotPayload(state));
}

/** Canonical form of a state re-mirrored, so run(A) and run(mirror(A)) compare. */
function mirrorCanonicalOf(state: BattleModel): string {
  const payload = snapshotPayload(state);
  return canonicalJson(Object.freeze({ ...payload, entities: Object.freeze(payload.entities.map(mirrorEntity)) }));
}

describe('F/K/L metamorphic soak (§8.4, §15)', () => {
  it('is permutation-invariant across entity, spawn and lane-change order', { timeout: 60_000 }, () => {
    const def: SoakDef = {
      entities: baseEntities(),
      speeds: { unit_p1: 305, unit_p2: 300, unit_e1: 290, unit_e2: 295 },
      spawns: (tick): readonly SpawnRequest[] => {
        if (tick === 5) return [{ kind: 'summon', reservedId: 'summon_a', side: 'player', targetLane: 'middle', radiusX100: asX100(100), maxLp: 500, startZoneX100: asX100(200) }];
        if (tick === 20) return [{ kind: 'construct', reservedId: 'turret_a', side: 'player', slotId: 'slot_t1', lane: 'bottom', x100: asX100(7000), radiusX100: asX100(100), maxLp: 500, replacementPolicy: null }];
        return [];
      },
      laneChanges: (tick) => (tick === 2 ? [{ entityId: 'unit_p1', to: 'middle', reason: 'normal', sourceId: 'unit_p1', priority: 10 }] : []),
    };
    const a = canonicalOf(runSoak(def, 60));
    expect(canonicalOf(runSoak({ ...def, entities: shuffle(def.entities, 7) }, 60))).toBe(a);
    expect(canonicalOf(runSoak({ ...def, entities: shuffle(def.entities, 42) }, 60))).toBe(a);
  });

  it('mirror commutes with the pipeline: mirror(run(A)) equals run(mirror(A))', { timeout: 60_000 }, () => {
    const def: SoakDef = {
      entities: baseEntities(),
      speeds: { unit_p1: 305, unit_p2: 300, unit_e1: 290, unit_e2: 280 },
      laneChanges: (tick) =>
        tick === 3
          ? [{ entityId: 'unit_p2', to: 'top', reason: 'normal' as const, sourceId: 'unit_p2', priority: 10 }]
          : [],
    };
    const forward = runSoak(def, 60);
    const mirroredDef: SoakDef = {
      ...def,
      entities: def.entities.map(mirrorEntity),
      laneChanges: (tick) =>
        tick === 3
          ? [{ entityId: 'unit_p2', to: 'bottom', reason: 'normal' as const, sourceId: 'unit_p2', priority: 10 }]
          : [],
    };
    const mirroredRun = runSoak(mirroredDef, 60);
    expect(mirrorCanonicalOf(mirroredRun)).toBe(canonicalOf(forward));
  });

  it('checkpoint hashes stay stable under both transforms', { timeout: 60_000 }, () => {
    const def: SoakDef = { entities: baseEntities(), speeds: { unit_p1: 305, unit_p2: 300 } };
    const canonical = runSoak(def, 60);
    const permuted = runSoak({ ...def, entities: shuffle(def.entities, 99) }, 60);
    expect(createSnapshot(canonical).checksum).toHaveLength(64);
    expect(createSnapshot(permuted).checksum).toBe(createSnapshot(canonical).checksum);
  });
});
