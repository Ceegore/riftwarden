import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase15Systems } from '../../src/game/sim/core/phase15-systems.js';
import { SPAWN_REJECT_NO_POSITION, SPAWN_REJECT_POLICY_MISSING, SPAWN_REJECT_SLOT_OCCUPIED, type SpawnRequest } from '../../src/game/sim/spawn/spawn-system.js';
import { asX100, type Lane } from '../../src/game/sim/geometry/x100.js';
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

function runOnce(state: BattleModel, requests: SpawnRequest[]): { state: BattleModel; events: readonly KernelEvent[] } {
  const systems = createPhase15Systems({ speedsX100PerSecond: {}, spawnRequests: () => requests });
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
});
