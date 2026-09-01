import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase15Systems } from '../../src/game/sim/core/phase15-systems.js';
import { SPAWN_REJECT_DISPLACEMENT_FAILED, SPAWN_REJECT_NO_POSITION, SPAWN_REJECT_POLICY_MISSING, SPAWN_REJECT_SLOT_OCCUPIED, type SpawnRequest } from '../../src/game/sim/spawn/spawn-system.js';
import { asX100, type Lane } from '../../src/game/sim/geometry/x100.js';
import type { Body } from '../../src/game/sim/geometry/distance.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { KernelEvent } from '../../src/game/sim/events/event-types.js';
import { battle, entity, randomSession } from './test-helpers.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

function unit(id: string, side: 'player' | 'enemy', x100: number, lane: Lane, radius = 100) {
  return migrateEntity({ entity: entity(id, { side, x100, lane }), radiusX100: radius });
}

function summon(id: string, targetLane: Lane, overrides: Partial<Extract<SpawnRequest, { kind: 'summon' }>> = {}): SpawnRequest {
  return {
    kind: 'summon', reservedId: id, side: 'player', targetLane, radiusX100: asX100(100), maxLp: 500, startZoneX100: asX100(200),
    ...overrides,
  };
}

function construct(id: string, lane: Lane, x100: number, overrides: Partial<Extract<SpawnRequest, { kind: 'construct' }>> = {}): SpawnRequest {
  return { kind: 'construct', reservedId: id, side: 'player', slotId: `slot_${id}`, lane, x100: asX100(x100), radiusX100: asX100(100), maxLp: 500, replacementPolicy: null, ...overrides };
}

function runOnce(state: BattleModel, requests: SpawnRequest[], arena: Body[] = []): { state: BattleModel; events: readonly KernelEvent[] } {
  const systems = createPhase15Systems({ speedsX100PerSecond: {}, spawnRequests: () => requests, arenaBodies: () => arena });
  const r = stepBattle({ state, input, random: randomSession(), rules: {}, content: {}, systems });
  return { state: r.state, events: r.events };
}

describe('Phase 15 spawn system (stage K)', () => {
  it('commits a summon 100 behind the foremost ally and emits Spawned', () => {
    const state = battle({ entities: [unit('unit_front', 'player', 5000, 'middle')], simulationVersion: 'phase15-fixture-v1' });
    const { state: next, events } = runOnce(state, [summon('summon_1', 'middle')]);
    const spawned = next.entities.find((e) => e.id === 'summon_1');
    expect(spawned?.lane).toBe('middle');
    expect(spawned?.x100).toBe(4900);
    expect(spawned?.lp).toBe(500);
    expect(events.filter((e) => e.type === 'Spawned')).toHaveLength(1);
    expect(events[0]?.sourceId).toBe('summon_1');
  });

  it('backs off 50..400 until the enemy overlap and own-side margin clear', () => {
    // Enemy at 5020: base 4900 overlaps, 4850 overlaps, 4800 clears both checks.
    const state = battle({ entities: [unit('unit_front', 'player', 5000, 'middle'), unit('unit_enemy', 'enemy', 5020, 'middle')], simulationVersion: 'phase15-fixture-v1' });
    const { state: next } = runOnce(state, [summon('summon_1', 'middle')]);
    expect(next.entities.find((e) => e.id === 'summon_1')?.x100).toBe(4800);
  });

  it('uses the own start zone when no ally occupies the lane', () => {
    const state = battle({ entities: [unit('unit_elsewhere', 'player', 4000, 'top')], simulationVersion: 'phase15-fixture-v1' });
    const { state: next } = runOnce(state, [summon('summon_1', 'middle', { startZoneX100: asX100(800) })]);
    expect(next.entities.find((e) => e.id === 'summon_1')?.x100).toBe(800);
  });

  it('rejects with SpawnRejected and no phantom entity when every candidate is blocked', () => {
    // Base 0 overlaps the enemy at 150 and every backoff falls off the field.
    const state = battle({ entities: [unit('unit_front', 'player', 100, 'middle'), unit('unit_enemy', 'enemy', 150, 'middle')], simulationVersion: 'phase15-fixture-v1' });
    const { state: next, events } = runOnce(state, [summon('summon_1', 'middle')]);
    expect(next.entities.find((e) => e.id === 'summon_1')).toBeUndefined();
    const rejected = events.filter((e) => e.type === 'SpawnRejected');
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.payload['reasonOrdinal']).toBe(SPAWN_REJECT_NO_POSITION);
  });

  it('places a construct on an empty slot', () => {
    const state = battle({ entities: [unit('unit_front', 'player', 5000, 'middle')], simulationVersion: 'phase15-fixture-v1' });
    const { state: next } = runOnce(state, [construct('turret_1', 'bottom', 7000)]);
    expect(next.entities.find((e) => e.id === 'turret_1')?.x100).toBe(7000);
  });

  it('rejects an occupied construct slot with the policy-appropriate reason', () => {
    const occupant = unit('turret_old', 'player', 7000, 'bottom');
    const missing = battle({ entities: [occupant], simulationVersion: 'phase15-fixture-v1' });
    const r1 = runOnce(missing, [construct('turret_new', 'bottom', 7000, { replacementPolicy: null })]);
    expect(r1.events.find((e) => e.type === 'SpawnRejected')?.payload['reasonOrdinal']).toBe(SPAWN_REJECT_POLICY_MISSING);

    const reject = battle({ entities: [occupant], simulationVersion: 'phase15-fixture-v1' });
    const r2 = runOnce(reject, [construct('turret_new', 'bottom', 7000, { replacementPolicy: 'reject' })]);
    expect(r2.events.find((e) => e.type === 'SpawnRejected')?.payload['reasonOrdinal']).toBe(SPAWN_REJECT_SLOT_OCCUPIED);
    expect(r2.state.entities.find((e) => e.id === 'turret_new')).toBeUndefined();
  });

  it('replaces an occupied construct slot under the replace policy (§7.3)', () => {
    const occupant = unit('turret_old', 'player', 7000, 'bottom');
    const state = battle({ entities: [occupant], simulationVersion: 'phase15-fixture-v1' });
    const { state: next } = runOnce(state, [construct('turret_new', 'bottom', 7000, { replacementPolicy: 'replace' })]);
    const old = next.entities.find((e) => e.id === 'turret_old');
    const fresh = next.entities.find((e) => e.id === 'turret_new');
    expect(old?.phase.phase).toBe('REMOVED');
    expect(old?.lp).toBe(0);
    expect(fresh?.x100).toBe(7000);
    expect(fresh?.phase.phase).toBe('ACTIVE');
  });

  it('displaces overlapped allies in stable id order for a large summon (§7.4)', () => {
    const state = battle({ entities: [unit('unit_a', 'player', 4300, 'middle'), unit('unit_b', 'player', 4350, 'middle')], simulationVersion: 'phase15-fixture-v1' });
    const { state: next, events } = runOnce(state, [summon('large_1', 'middle', { displacementPolicy: 'displace', radiusX100: asX100(100) })]);
    expect(events.filter((e) => e.type === 'SpawnRejected')).toHaveLength(0);
    expect(next.entities.find((e) => e.id === 'large_1')?.x100).toBe(4250);
    expect(next.entities.find((e) => e.id === 'unit_a')?.x100).toBe(4050);
    expect(next.entities.find((e) => e.id === 'unit_b')?.x100).toBe(4050);
  });

  it('aborts the whole large summon atomically when any displacement fails (§7.4)', () => {
    const state = battle({ entities: [unit('unit_x', 'player', 100, 'middle', 0)], simulationVersion: 'phase15-fixture-v1' });
    const { state: next, events } = runOnce(state, [summon('large_1', 'middle', { displacementPolicy: 'displace', radiusX100: asX100(200) })]);
    expect(events.find((e) => e.type === 'SpawnRejected')?.payload['reasonOrdinal']).toBe(SPAWN_REJECT_DISPLACEMENT_FAILED);
    expect(next.entities.find((e) => e.id === 'large_1')).toBeUndefined();
    expect(next.entities.find((e) => e.id === 'unit_x')?.x100).toBe(100); // never partially moved
  });

  it('is permutation-invariant across request order (§8.4)', () => {
    const requests = [summon('summon_a', 'middle'), summon('summon_b', 'top'), summon('summon_c', 'bottom')];
    const base = () => battle({ entities: [unit('unit_front', 'player', 5000, 'middle'), unit('unit_top', 'player', 4500, 'top'), unit('unit_bottom', 'player', 4600, 'bottom')], simulationVersion: 'phase15-fixture-v1' });
    const a = runOnce(base(), requests);
    const b = runOnce(base(), [requests[2], requests[0], requests[1]].filter((r): r is SpawnRequest => r !== undefined));
    const ids = (s: BattleModel) => s.entities.map((e) => e.id).sort();
    const eventSig = (r: { events: readonly KernelEvent[] }) => r.events.map((e) => `${e.type}:${e.sourceId ?? ''}`).sort();
    expect(ids(a.state)).toEqual(ids(b.state));
    expect(eventSig(a)).toEqual(eventSig(b));
    expect(a.state.entities.find((e) => e.id === 'summon_a')?.x100).toBe(b.state.entities.find((e) => e.id === 'summon_a')?.x100);
  });

  it('blocks a duplicate reserved id atomically (fault injection)', () => {
    const state = battle({ entities: [unit('summon_1', 'player', 5000, 'middle')], simulationVersion: 'phase15-fixture-v1' });
    expect(() => runOnce(state, [summon('summon_1', 'middle')])).toThrow(/P14_DUPLICATE_ENTITY/);
  });

  it('rejects a summon whose candidates all overlap an arena object', () => {
    // Base 4900 (100 behind the front at 5000) and every 50..400 backoff fall
    // inside the arena body spanning 4500..5100 — no valid position exists.
    const state = battle({ entities: [unit('unit_front', 'player', 5000, 'middle')], simulationVersion: 'phase15-fixture-v1' });
    const arena: Body[] = [{ id: 'obstacle_1', x100: asX100(4800), radiusX100: asX100(300), lane: 'middle' }];
    const { state: next, events } = runOnce(state, [summon('summon_1', 'middle')], arena);
    expect(next.entities.find((e) => e.id === 'summon_1')).toBeUndefined();
    expect(events.find((e) => e.type === 'SpawnRejected')?.payload['reasonOrdinal']).toBe(SPAWN_REJECT_NO_POSITION);
  });

  it('rejects a construct whose defined slot overlaps an arena object', () => {
    const state = battle({ entities: [unit('unit_front', 'player', 5000, 'middle')], simulationVersion: 'phase15-fixture-v1' });
    const arena: Body[] = [{ id: 'obstacle_1', x100: asX100(7000), radiusX100: asX100(100), lane: 'bottom' }];
    const { state: next, events } = runOnce(state, [construct('turret_1', 'bottom', 7000)], arena);
    expect(next.entities.find((e) => e.id === 'turret_1')).toBeUndefined();
    expect(events.find((e) => e.type === 'SpawnRejected')?.payload['reasonOrdinal']).toBe(SPAWN_REJECT_NO_POSITION);
  });

  it('displaces overlapped allies away from arena objects for a large summon (§7.4)', () => {
    // The summon lands at 4250 (100 behind unit_b at 4350). Both allies' natural
    // displacement would stop at 4050 (200 back, touching the summon), but the
    // arena at 4080 (reach 3950..4210 for 100-radius bodies) blocks 4050/4000,
    // so they are pushed to 3950 — still inside the 50..400 backoff range.
    const state = battle({ entities: [unit('unit_a', 'player', 4300, 'middle'), unit('unit_b', 'player', 4350, 'middle')], simulationVersion: 'phase15-fixture-v1' });
    const arena: Body[] = [{ id: 'obstacle_1', x100: asX100(4080), radiusX100: asX100(30), lane: 'middle' }];
    const { state: next, events } = runOnce(state, [summon('large_1', 'middle', { displacementPolicy: 'displace', radiusX100: asX100(100) })], arena);
    expect(events.filter((e) => e.type === 'SpawnRejected')).toHaveLength(0);
    expect(next.entities.find((e) => e.id === 'large_1')?.x100).toBe(4250);
    expect(next.entities.find((e) => e.id === 'unit_a')?.x100).toBe(3950);
    expect(next.entities.find((e) => e.id === 'unit_b')?.x100).toBe(3950);
  });
});

describe('Phase 15 spawn resets the §9.4 endcap', () => {
  function runTicks(state: BattleModel, systems: ReturnType<typeof createPhase15Systems>, ticks: number): { state: BattleModel; events: readonly KernelEvent[] } {
    const random = randomSession();
    let current = state;
    const events: KernelEvent[] = [];
    for (let i = 0; i < ticks; i++) {
      const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
      current = r.state;
      events.push(...r.events);
    }
    return { state: current, events };
  }

  it('delays the rift-collapse warning by the spawn tick it resets (§9.4)', { timeout: 25_000 }, () => {
    const state = battle({ entities: [unit('unit_front', 'player', 5000, 'middle')], simulationVersion: 'phase15-fixture-v1' });
    const systems = createPhase15Systems({ speedsX100PerSecond: {}, spawnRequests: (ctx) => (ctx.state.tick === 0 ? [summon('summon_1', 'middle')] : []) });
    const at300 = runTicks(state, systems, 300);
    expect(at300.events.filter((e) => e.type === 'RiftCollapseWarning')).toHaveLength(0);
    expect(at300.state.globalNoProgressTicks).toBe(299);
    const at301 = runTicks(at300.state, systems, 1);
    expect(at301.events.filter((e) => e.type === 'RiftCollapseWarning')).toHaveLength(1);
  });

  it('keeps the no-progress counter pinned at 0 when spawns keep coming', { timeout: 25_000 }, () => {
    const state = battle({ entities: [unit('unit_front', 'player', 5000, 'middle')], simulationVersion: 'phase15-fixture-v1' });
    const systems = createPhase15Systems({
      speedsX100PerSecond: {},
      spawnRequests: (ctx) => (ctx.state.tick % 25 === 0 ? [summon(`summon_${String(ctx.state.tick)}`, 'middle')] : []),
    });
    const result = runTicks(state, systems, 300);
    expect(result.events.filter((e) => e.type === 'RiftCollapseWarning')).toHaveLength(0);
    expect(result.state.globalNoProgressTicks).toBeLessThan(26);
    expect(result.state.entities.some((e) => e.id === 'summon_275')).toBe(true);
  });

  it('never resolves the battle end while spawns keep qualifying', { timeout: 25_000 }, () => {
    const state = battle({ entities: [unit('unit_front', 'player', 5000, 'middle')], simulationVersion: 'phase15-fixture-v1' });
    const systems = createPhase15Systems({
      speedsX100PerSecond: {},
      spawnRequests: (ctx) => (ctx.state.tick % 25 === 0 ? [summon(`summon_${String(ctx.state.tick)}`, 'middle')] : []),
    });
    const result = runTicks(state, systems, 601);
    expect(result.state.phase.phase).toBe('ACTIVE');
  });
});
