import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity, migrateBattleModel, SIM_VERSION_PHASE14 } from '../../src/game/sim/core/migrate.js';
import { createPhase18Systems } from '../../src/game/sim/core/phase18-systems.js';
import { createSnapshot, verifySnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { KernelInvariantError } from '../../src/game/sim/core/invariant-error.js';
import type { KernelCommand } from '../../src/game/sim/core/command-types.js';
import type { KernelSystem, TickContext } from '../../src/game/sim/core/tick-context.js';
import type { StatusInstance } from '../../src/game/sim/status/status-instance.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { KernelEvent } from '../../src/game/sim/events/event-types.js';
import { battle, entity, randomSession } from './test-helpers.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

function unit(id: string, overrides: Parameters<typeof entity>[1] = {}) {
  return migrateEntity({ entity: entity(id, overrides), radiusX100: 100 });
}

function status(overrides: Partial<StatusInstance> = {}): StatusInstance {
  return Object.freeze({
    statusId: 'st_burn_a',
    kind: 'burn',
    polarity: 'negative',
    targetId: 'unit_p',
    sourceId: 'unit_e',
    effectId: 'ef_burn',
    startTick: 0,
    endTick: 100,
    strength: 1,
    stackGroup: 'burn',
    sequence: 1,
    stackPolicy: 'extend_duration_capped',
    maxStacks: 5,
    flags: Object.freeze([]),
    ...overrides,
  });
}

function run(state: BattleModel, ticks: number, systems: readonly KernelSystem[]): { state: BattleModel; events: KernelEvent[] } {
  let current = state;
  const events: KernelEvent[] = [];
  const random = randomSession();
  for (let i = 0; i < ticks; i++) {
    const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
    current = r.state;
    events.push(...r.events);
  }
  return { state: current, events };
}

/** A single stage-I system that pushes exactly one command — for reducer validation. */
function pushOnly(command: KernelCommand): readonly KernelSystem[] {
  return Object.freeze([
    Object.freeze({
      id: 'test.i1.push',
      stage: 'I' as const,
      run: (context: TickContext): void => {
        context.commands.push(command);
      },
    }),
  ]);
}

function expectInvariant(fn: () => unknown, reason: string): void {
  try {
    fn();
    expect.unreachable(`expected ${reason}`);
  } catch (error) {
    expect(error).toBeInstanceOf(KernelInvariantError);
    if (error instanceof KernelInvariantError) {
      expect(error.code).toBe('P14_SNAPSHOT_INVALID');
      expect(error.details['reason']).toBe(reason);
    }
  }
}

describe('Phase 18 kernel: set_statuses reducer', () => {
  it('rejects an invalid instance', () => {
    const state = battle({ simulationVersion: 'phase15-fixture-v1', entities: [unit('unit_p')] });
    const bad = status({ kind: 'made_up' as never });
    expectInvariant(() => run(state, 1, pushOnly({ kind: 'set_statuses', statuses: [bad] })), 'status-kind-unknown');
  });

  it('rejects duplicate statusId', () => {
    const state = battle({ simulationVersion: 'phase15-fixture-v1', entities: [unit('unit_p')] });
    const a = status({ sequence: 1 });
    const b = status({ sequence: 2 });
    expectInvariant(() => run(state, 1, pushOnly({ kind: 'set_statuses', statuses: [a, b] })), 'status-duplicate-id');
  });

  it('rejects a non-array payload', () => {
    const state = battle({ simulationVersion: 'phase15-fixture-v1', entities: [unit('unit_p')] });
    expectInvariant(
      () => run(state, 1, pushOnly({ kind: 'set_statuses', statuses: 'burn' as unknown as StatusInstance[] })),
      'statuses-not-array',
    );
  });

  it('accepts and canonically sorts a valid collection', () => {
    const state = battle({ simulationVersion: 'phase15-fixture-v1', entities: [unit('unit_p')] });
    const a = status({ statusId: 'st_burn_b', sequence: 2 });
    const b = status({ statusId: 'st_burn_a', sequence: 1 });
    const { state: next } = run(state, 1, pushOnly({ kind: 'set_statuses', statuses: [a, b] }));
    expect(next.statuses?.map((s) => s.statusId)).toEqual(['st_burn_a', 'st_burn_b']);
  });
});

describe('Phase 18 kernel: periodic/expiry through the pipeline', () => {
  const systems = createPhase18Systems({
    speedsX100PerSecond: {},
    status: { periodic: { burn_01: { effectKind: 'burn', amountPerTick: 50 } } },
  });

  it('fires burn every interval through apply_lp_delta and emits EffectTick', () => {
    const state = battle({
      simulationVersion: 'phase15-fixture-v1',
      entities: [unit('unit_p'), unit('unit_e', { side: 'enemy', x100: 6000 })],
      statuses: Object.freeze([
        status({
          statusId: 'st_burn_a',
          endTick: 100,
          periodic: Object.freeze({ effectKind: 'burn', intervalTicks: 10, nextTick: 10, tickIndex: 0, initialTick: false, dedupKey: 'burn_01' }),
        }),
      ]),
    });
    const { state: next, events } = run(state, 35, systems);
    expect(next.entities.find((e) => e.id === 'unit_p')?.lp).toBe(850); // 1000 - 3 * 50
    const ticks = events.filter((e) => e.type === 'EffectTick');
    expect(ticks.map((e) => e.tick)).toEqual([10, 20, 30]);
    expect(ticks.map((e) => e.payload['tickIndex'])).toEqual([0, 1, 2]);
    expect(ticks[0]?.payload['kindOrdinal']).toBe(5); // burn ordinal
    expect(next.statuses?.length).toBe(1); // still active
  });

  it('applies regeneration as a positive LP delta', () => {
    const systemsHeal = createPhase18Systems({
      speedsX100PerSecond: {},
      status: { periodic: { regen_01: { effectKind: 'regeneration', amountPerTick: 30 } } },
    });
    const state = battle({
      simulationVersion: 'phase15-fixture-v1',
      entities: [unit('unit_p', { lp: 500 }), unit('unit_e', { side: 'enemy', x100: 6000 })],
      statuses: Object.freeze([
        status({
          statusId: 'st_regen_a',
          kind: 'regeneration',
          polarity: 'positive',
          effectId: 'ef_regen',
          stackGroup: 'regen',
          endTick: 100,
          periodic: Object.freeze({ effectKind: 'regeneration', intervalTicks: 10, nextTick: 10, tickIndex: 0, initialTick: false, dedupKey: 'regen_01' }),
        }),
      ]),
    });
    const { state: next } = run(state, 25, systemsHeal);
    expect(next.entities.find((e) => e.id === 'unit_p')?.lp).toBe(560); // 500 + 2 * 30
  });

  it('§7.3: nextTick == endTick never fires — expiry wins', () => {
    const state = battle({
      simulationVersion: 'phase15-fixture-v1',
      entities: [unit('unit_p'), unit('unit_e', { side: 'enemy', x100: 6000 })],
      statuses: Object.freeze([
        status({
          statusId: 'st_burn_edge',
          endTick: 20,
          periodic: Object.freeze({ effectKind: 'burn', intervalTicks: 10, nextTick: 20, tickIndex: 0, initialTick: false, dedupKey: 'burn_01' }),
        }),
      ]),
    });
    const { state: next, events } = run(state, 25, systems);
    expect(next.entities.find((e) => e.id === 'unit_p')?.lp).toBe(1000); // no tick ever fired
    expect(events.filter((e) => e.type === 'EffectTick')).toHaveLength(0);
    const removed = events.filter((e) => e.type === 'EffectRemoved');
    expect(removed.some((e) => e.tick === 20 && e.payload['reasonOrdinal'] === 0)).toBe(true); // expired
    expect(next.statuses).toHaveLength(0);
  });

  it('removes an expired status and emits EffectRemoved', () => {
    const state = battle({
      simulationVersion: 'phase15-fixture-v1',
      entities: [unit('unit_p'), unit('unit_e', { side: 'enemy', x100: 6000 })],
      statuses: Object.freeze([
        status({
          statusId: 'st_burn_short',
          endTick: 15,
          periodic: Object.freeze({ effectKind: 'burn', intervalTicks: 10, nextTick: 10, tickIndex: 0, initialTick: false, dedupKey: 'burn_01' }),
        }),
      ]),
    });
    const { state: next, events } = run(state, 20, systems);
    // tick 10 fires, tick 15 expiry: LP 1000 -> 950
    expect(next.entities.find((e) => e.id === 'unit_p')?.lp).toBe(950);
    expect(next.statuses).toHaveLength(0);
    const removed = events.filter((e) => e.type === 'EffectRemoved');
    expect(removed.some((e) => e.tick === 15 && e.payload['reasonOrdinal'] === 0)).toBe(true);
  });

  it('drops an instance whose target no longer exists with target_defeated', () => {
    const state = battle({
      simulationVersion: 'phase15-fixture-v1',
      entities: [unit('unit_p')],
      statuses: Object.freeze([status({ targetId: 'unit_ghost', periodic: Object.freeze({ effectKind: 'burn', intervalTicks: 10, nextTick: 10, tickIndex: 0, initialTick: false, dedupKey: 'burn_01' }) })]),
    });
    const { state: next, events } = run(state, 2, systems);
    expect(next.statuses).toHaveLength(0);
    const removed = events.filter((e) => e.type === 'EffectRemoved');
    expect(removed.some((e) => e.payload['reasonOrdinal'] === 5)).toBe(true); // target_defeated
  });

  it('is deterministic: same seed produces the same final snapshot', () => {
    const state = battle({
      simulationVersion: 'phase15-fixture-v1',
      entities: [unit('unit_p'), unit('unit_e', { side: 'enemy', x100: 6000 })],
      statuses: Object.freeze([
        status({
          statusId: 'st_burn_a',
          endTick: 100,
          periodic: Object.freeze({ effectKind: 'burn', intervalTicks: 10, nextTick: 10, tickIndex: 0, initialTick: false, dedupKey: 'burn_01' }),
        }),
      ]),
    });
    const a = run(state, 45, systems);
    const b = run(state, 45, systems);
    expect(createSnapshot(a.state).checksum).toBe(createSnapshot(b.state).checksum);
    expect(a.events.map((e) => `${String(e.tick)}:${e.type}`)).toEqual(b.events.map((e) => `${String(e.tick)}:${e.type}`));
  });
});

describe('Phase 18 kernel: snapshot and migration', () => {
  it('projects statuses into the snapshot and verifies the checksum', () => {
    const state = battle({
      simulationVersion: 'phase15-fixture-v1',
      entities: [unit('unit_p'), unit('unit_e', { side: 'enemy', x100: 6000 })],
      statuses: Object.freeze([
        status({
          statusId: 'st_burn_a',
          endTick: 100,
          periodic: Object.freeze({ effectKind: 'burn', intervalTicks: 10, nextTick: 10, tickIndex: 0, initialTick: false, dedupKey: 'burn_01' }),
        }),
      ]),
    });
    const snapshot = createSnapshot(state);
    expect(snapshot.statuses).toHaveLength(1);
    expect(verifySnapshot(snapshot)).toBe(true);
    expect(createSnapshot(state).checksum).toBe(snapshot.checksum); // stable
  });

  it('migrates a Phase-14 battle to an empty status collection', () => {
    const entities = [migrateEntity({ entity: entity('unit_p'), radiusX100: 100 })];
    const state = battle({ entities, simulationVersion: SIM_VERSION_PHASE14 });
    const migrated = migrateBattleModel({ state, radiiX100: { unit_p: 100 } });
    expect(migrated.statuses).toEqual([]);
    // Idempotent: re-running returns the same state unchanged.
    expect(migrateBattleModel({ state: migrated, radiiX100: { unit_p: 100 } })).toBe(migrated);
  });
});
