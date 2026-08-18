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

function st(overrides: Partial<StatusInstance>): StatusInstance {
  return Object.freeze({
    statusId: 'st_x',
    kind: 'burn',
    polarity: 'negative',
    targetId: 'unit_p',
    sourceId: 'unit_e',
    effectId: 'ef_x',
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

function stateWith(statuses: readonly StatusInstance[]): BattleModel {
  return battle({
    simulationVersion: 'phase15-fixture-v1',
    entities: Object.freeze([unit('unit_p'), unit('unit_e', { side: 'enemy', x100: 6000 })]),
    statuses,
  });
}

interface RunResult { state: BattleModel; events: KernelEvent[] }

function runWith(state: BattleModel, systems: readonly KernelSystem[], ticks = 1): RunResult {
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

function expectInvariant(fn: () => unknown, reason: string): void {
  try {
    fn();
    expect.unreachable(`expected ${reason}`);
  } catch (error) {
    expect(error).toBeInstanceOf(KernelInvariantError);
    if (error instanceof KernelInvariantError) expect(error.details['reason']).toBe(reason);
  }
}

function pushOnly(command: KernelCommand): readonly KernelSystem[] {
  return Object.freeze([Object.freeze({ id: 'test.h1.push', stage: 'H' as const, run: (context: TickContext): void => { context.commands.push(command); } })]);
}

const REMOVED_ORDINALS: Readonly<Record<string, number>> = Object.freeze({ expired: 0, cleansed: 1, dispelled: 2 });

describe('Phase 18 T05 kernel: reducer validation', () => {
  it('rejects an invalid targetId and an unknown request kind', () => {
    const state = stateWith([]);
    expectInvariant(() => runWith(state, pushOnly({ kind: 'queue_cleanse_dispel', targetId: 'Bad-Id', request: 'cleanse' })), 'cleanse-request-invalid');
    expectInvariant(() => runWith(state, pushOnly({ kind: 'queue_cleanse_dispel', targetId: 'unit_p', request: 'nonsense' as never })), 'cleanse-request-invalid');
  });

  it('clears pending requests after a step', () => {
    const systems = createPhase18Systems({
      speedsX100PerSecond: {},
      cleanseDispel: { cleanses: () => Object.freeze([{ targetId: 'unit_p' }]) },
    });
    const { state } = runWith(stateWith([st({ statusId: 'st_stun', kind: 'stun', stackGroup: 'stun', sequence: 1 })]), systems);
    expect(state.pendingCleanses).toEqual([]);
  });
});

describe('Phase 18 T05 kernel: cleanse at stage K', () => {
  const systems = createPhase18Systems({
    speedsX100PerSecond: {},
    cleanseDispel: { cleanses: () => Object.freeze([{ targetId: 'unit_p' }]) },
  });

  it('removes hard control first per §9.1 and emits EffectRemoved cleansed', () => {
    const { state, events } = runWith(
      stateWith([
        st({ statusId: 'st_mark', kind: 'mark', polarity: 'positive', stackGroup: 'mark', sequence: 1 }),
        st({ statusId: 'st_stun', kind: 'stun', stackGroup: 'stun', sequence: 2 }),
        st({ statusId: 'st_burn', kind: 'burn', stackGroup: 'burn', sequence: 3 }),
      ]),
      systems,
    );
    expect(state.statuses?.map((s) => s.statusId).sort()).toEqual(['st_burn', 'st_mark']);
    const removed = events.filter((e) => e.type === 'EffectRemoved');
    expect(removed).toHaveLength(1);
    expect(removed[0]?.contentIds[0]).toBe('st_stun');
    expect(removed[0]?.payload['reasonOrdinal']).toBe(REMOVED_ORDINALS['cleansed']);
  });

  it('skips unremovable instances and cleanses the next candidate', () => {
    const { state } = runWith(
      stateWith([
        st({ statusId: 'st_stun', kind: 'stun', stackGroup: 'stun', sequence: 1, flags: Object.freeze(['unremovable']) }),
        st({ statusId: 'st_burn', kind: 'burn', stackGroup: 'burn', sequence: 2 }),
      ]),
      systems,
    );
    expect(state.statuses?.map((s) => s.statusId)).toEqual(['st_stun']);
  });

  it('is a no-op when the target has no cleansable statuses (mark is a §9.1 category)', () => {
    const { state, events } = runWith(
      stateWith([st({ statusId: 'st_regen', kind: 'regeneration', polarity: 'positive', stackGroup: 'regen', sequence: 1 })]),
      systems,
    );
    expect(state.statuses).toHaveLength(1);
    expect(events.filter((e) => e.type === 'EffectRemoved')).toHaveLength(0);
  });
});

describe('Phase 18 T05 kernel: dispel at stage K', () => {
  const systems = createPhase18Systems({
    speedsX100PerSecond: {},
    cleanseDispel: { dispels: () => Object.freeze([{ targetId: 'unit_p' }]) },
  });

  it('removes the strongest positive status per §9.2 and emits EffectRemoved dispelled', () => {
    const { state, events } = runWith(
      stateWith([
        st({ statusId: 'st_regen_weak', kind: 'regeneration', polarity: 'positive', stackGroup: 'regen', sequence: 1, strength: 1 }),
        st({ statusId: 'st_regen_strong', kind: 'regeneration', polarity: 'positive', stackGroup: 'regen', sequence: 2, strength: 3 }),
        st({ statusId: 'st_burn', kind: 'burn', stackGroup: 'burn', sequence: 3 }),
      ]),
      systems,
    );
    expect(state.statuses?.map((s) => s.statusId).sort()).toEqual(['st_burn', 'st_regen_weak']);
    const removed = events.filter((e) => e.type === 'EffectRemoved');
    expect(removed[0]?.contentIds[0]).toBe('st_regen_strong');
    expect(removed[0]?.payload['reasonOrdinal']).toBe(REMOVED_ORDINALS['dispelled']);
  });

  it('never removes negative/control instances', () => {
    const { state, events } = runWith(
      stateWith([
        st({ statusId: 'st_slow', kind: 'slow', stackGroup: 'slow', sequence: 1 }),
        st({ statusId: 'st_stun', kind: 'stun', stackGroup: 'stun', sequence: 2 }),
      ]),
      systems,
    );
    expect(state.statuses).toHaveLength(2);
    expect(events.filter((e) => e.type === 'EffectRemoved')).toHaveLength(0);
  });
});

describe('Phase 18 T05 kernel: determinism and snapshot', () => {
  const systems = createPhase18Systems({
    speedsX100PerSecond: {},
    cleanseDispel: {
      cleanses: (context) => (context.state.tick % 15 === 0 ? Object.freeze([{ targetId: 'unit_p' }]) : Object.freeze([])),
    },
  });

  it('two same-config runs are byte-identical over 45 ticks', () => {
    const seed = stateWith([
      st({ statusId: 'st_stun', kind: 'stun', stackGroup: 'stun', sequence: 1 }),
      st({ statusId: 'st_burn', kind: 'burn', stackGroup: 'burn', sequence: 2 }),
      st({ statusId: 'st_regen', kind: 'regeneration', polarity: 'positive', stackGroup: 'regen', sequence: 3 }),
    ]);
    const a = runWith(seed, systems, 45);
    const b = runWith(seed, systems, 45);
    expect(createSnapshot(a.state).checksum).toBe(createSnapshot(b.state).checksum);
    expect(a.events.map((e) => `${String(e.tick)}:${e.type}:${String(e.sequence)}`)).toEqual(b.events.map((e) => `${String(e.tick)}:${e.type}:${String(e.sequence)}`));
  });

  it('projects pendingCleanses into the snapshot and verifies symmetrically', () => {
    const state = stateWith([]);
    const withPending = battle({ ...state, pendingCleanses: Object.freeze([{ targetId: 'unit_p', kind: 'cleanse' }]) });
    const snap = createSnapshot(withPending);
    expect(snap.pendingCleanses).toEqual([{ targetId: 'unit_p', kind: 'cleanse' }]);
    expect(verifySnapshot(snap)).toBe(true);
  });

  it('migration seeds an empty pending queue', () => {
    const migrated = migrateBattleModel({ state: battle({ entities: [unit('unit_p')], simulationVersion: SIM_VERSION_PHASE14 }), radiiX100: { unit_p: 100 } });
    expect(migrated.pendingCleanses).toEqual([]);
  });
});
