import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase18Systems } from '../../src/game/sim/core/phase18-systems.js';
import { createSnapshot, verifySnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { KernelInvariantError } from '../../src/game/sim/core/invariant-error.js';
import { createStatusCollection } from '../../src/game/sim/status/status-collection.js';
import type { KernelCommand } from '../../src/game/sim/core/command-types.js';
import type { KernelSystem, TickContext } from '../../src/game/sim/core/tick-context.js';
import type { StatusInstance } from '../../src/game/sim/status/status-instance.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { KernelEvent } from '../../src/game/sim/events/event-types.js';
import { battle, entity, randomSession } from './test-helpers.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

function unit(id: string, side: 'player' | 'enemy', overrides: Parameters<typeof entity>[1] = {}) {
  return migrateEntity({ entity: entity(id, { side, ...overrides }), radiusX100: 100 });
}

const COEFFICIENTS = Object.freeze({
  burn_01: { effectKind: 'burn', amountPerTick: 50 },
  burn_02: { effectKind: 'burn', amountPerTick: 30 },
  poison_01: { effectKind: 'poison', amountPerTick: 40 },
  regen_01: { effectKind: 'regeneration', amountPerTick: 25 },
} as const);

const SYSTEMS = createPhase18Systems({ speedsX100PerSecond: {}, status: { periodic: COEFFICIENTS } });

function st(overrides: Partial<StatusInstance>): StatusInstance {
  return Object.freeze({
    statusId: 'st_x',
    kind: 'burn',
    polarity: 'negative',
    targetId: 'unit_p1',
    sourceId: 'unit_e1',
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

/** The §13.2 dense scenario: 14 instances over 4 targets, 6 sources, 7 kinds. */
function denseStatuses(): readonly StatusInstance[] {
  return Object.freeze([
    st({ statusId: 'st_burn_p1a', targetId: 'unit_p1', sourceId: 'unit_e1', sequence: 1, endTick: 90, periodic: Object.freeze({ effectKind: 'burn', intervalTicks: 10, nextTick: 10, tickIndex: 0, initialTick: false, dedupKey: 'burn_01' }) }),
    st({ statusId: 'st_burn_p1b', targetId: 'unit_p1', sourceId: 'unit_e2', sequence: 2, endTick: 70, periodic: Object.freeze({ effectKind: 'burn', intervalTicks: 15, nextTick: 15, tickIndex: 0, initialTick: false, dedupKey: 'burn_02' }) }),
    st({ statusId: 'st_poison_e1', kind: 'poison', targetId: 'unit_e1', sourceId: 'unit_p1', effectId: 'ef_p', stackGroup: 'poison', sequence: 3, endTick: 55, periodic: Object.freeze({ effectKind: 'poison', intervalTicks: 15, nextTick: 15, tickIndex: 0, initialTick: false, dedupKey: 'poison_01' }) }),
    st({ statusId: 'st_regen_p1', kind: 'regeneration', polarity: 'positive', targetId: 'unit_p1', sourceId: 'unit_p2', effectId: 'ef_r', stackGroup: 'regen', sequence: 4, endTick: 100, periodic: Object.freeze({ effectKind: 'regeneration', intervalTicks: 20, nextTick: 20, tickIndex: 0, initialTick: false, dedupKey: 'regen_01' }) }),
    st({ statusId: 'st_regen_p2', kind: 'regeneration', polarity: 'positive', targetId: 'unit_p2', sourceId: 'unit_p1', effectId: 'ef_r', stackGroup: 'regen', sequence: 5, endTick: 80, periodic: Object.freeze({ effectKind: 'regeneration', intervalTicks: 25, nextTick: 25, tickIndex: 0, initialTick: false, dedupKey: 'regen_01' }) }),
    st({ statusId: 'st_slow_e1', kind: 'slow', targetId: 'unit_e1', sourceId: 'unit_p1', effectId: 'ef_s', stackGroup: 'slow', sequence: 6, endTick: 60 }),
    st({ statusId: 'st_slow_e2', kind: 'slow', targetId: 'unit_e2', sourceId: 'unit_p1', effectId: 'ef_s', stackGroup: 'slow', sequence: 7, endTick: 45 }),
    st({ statusId: 'st_stun_e2', kind: 'stun', targetId: 'unit_e2', sourceId: 'unit_p2', effectId: 'ef_c', stackGroup: 'stun', sequence: 8, endTick: 35 }),
    st({ statusId: 'st_weaken_p2', kind: 'weaken', targetId: 'unit_p2', sourceId: 'unit_e1', effectId: 'ef_w', stackGroup: 'weaken', sequence: 9, endTick: 75 }),
    st({ statusId: 'st_mark_p3', kind: 'mark', polarity: 'positive', targetId: 'unit_p3', sourceId: 'unit_p1', effectId: 'ef_m', stackGroup: 'mark', sequence: 10, endTick: 100 }),
    st({ statusId: 'st_silence_e3', kind: 'silence', targetId: 'unit_e3', sourceId: 'unit_p2', effectId: 'ef_c', stackGroup: 'silence', sequence: 11, endTick: 40 }),
    st({ statusId: 'st_confusion_e3', kind: 'confusion', targetId: 'unit_e3', sourceId: 'unit_p1', effectId: 'ef_c', stackGroup: 'confusion', sequence: 12, endTick: 30 }),
    st({ statusId: 'st_burn_p3a', targetId: 'unit_p3', sourceId: 'unit_e2', sequence: 13, endTick: 65, periodic: Object.freeze({ effectKind: 'burn', intervalTicks: 10, nextTick: 10, tickIndex: 0, initialTick: false, dedupKey: 'burn_01' }) }),
    st({ statusId: 'st_burn_p3b', targetId: 'unit_p3', sourceId: 'unit_e3', sequence: 14, endTick: 50, periodic: Object.freeze({ effectKind: 'burn', intervalTicks: 10, nextTick: 10, tickIndex: 0, initialTick: false, dedupKey: 'burn_01' }) }),
  ]);
}

function denseBattle(seed: readonly StatusInstance[] = denseStatuses()): BattleModel {
  return battle({
    simulationVersion: 'phase15-fixture-v1',
    entities: Object.freeze([
      unit('unit_p1', 'player', { x100: 1800 }),
      unit('unit_p2', 'player', { x100: 2400 }),
      unit('unit_p3', 'player', { x100: 2900 }),
      unit('unit_e1', 'enemy', { x100: 6200 }),
      unit('unit_e2', 'enemy', { x100: 6900 }),
      unit('unit_e3', 'enemy', { x100: 7500 }),
    ]),
    statuses: seed,
  });
}

function run(state: BattleModel, ticks: number, systems: readonly KernelSystem[] = SYSTEMS): { state: BattleModel; events: KernelEvent[] } {
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
  return Object.freeze([Object.freeze({ id: 'test.i1.push', stage: 'I' as const, run: (context: TickContext): void => { context.commands.push(command); } })]);
}

describe('Phase 18 §13.2 dense scenario', () => {
  it('maintains canonical ordering and applies periodic/expiry deterministically over 120 ticks', () => {
    const { state: final, events } = run(denseBattle(), 120);
    // Canonical collection: no duplicates, sorted per the §11 comparator.
    const canonical = createStatusCollection(final.statuses ?? []);
    expect(final.statuses?.map((s) => s.statusId)).toEqual(canonical.map((s) => s.statusId));
    // All 14 instances reached their endTick (max endTick 100) — collection empty.
    expect(final.statuses).toHaveLength(0);
    // Periodic accounting (§7.3, endTick exclusive): burn_01 fires at 10..80 on p1 (8), 10..60 on p3a (6), 10..40 on p3b (4);
    // burn_02 at 15,30,45,60 (4); poison at 15,30,45 (3); regen_01 on p1 at 20,40,60,80 (4); regen_01 on p2 at 25,50,75 (3).
    const ticks = events.filter((e) => e.type === 'EffectTick');
    expect(ticks).toHaveLength(32);
    // Every removal lands exactly on its endTick with the expired ordinal.
    const removed = events.filter((e) => e.type === 'EffectRemoved');
    const byTick = new Map<number, number>();
    for (const e of removed) byTick.set(e.tick, (byTick.get(e.tick) ?? 0) + 1);
    expect(byTick.get(30)).toBe(1); // confusion
    expect(byTick.get(35)).toBe(1); // stun
    expect(byTick.get(40)).toBe(1); // silence
    expect(byTick.get(45)).toBe(1); // slow_e2
    expect(byTick.get(50)).toBe(1); // burn_p3b
    expect(byTick.get(55)).toBe(1); // poison
    expect(byTick.get(60)).toBe(1); // slow_e1
    expect(byTick.get(65)).toBe(1); // burn_p3a
    expect(byTick.get(70)).toBe(1); // burn_p1b
    expect(byTick.get(75)).toBe(1); // weaken
    expect(byTick.get(80)).toBe(1); // regen_p2
    expect(byTick.get(90)).toBe(1); // burn_p1a
    expect(removed.every((e) => e.payload['reasonOrdinal'] === 0)).toBe(true); // all expired
    // LP accounting on unit_p1: burn_01 8×50 + burn_02 4×30 = 520 damage; regen 4×25 = 100 heal.
    const p1 = final.entities.find((e) => e.id === 'unit_p1');
    expect(p1?.lp).toBe(580);
  });

  it('permutation: reversed insertion order converges to the identical canonical state', () => {
    const forward = run(denseBattle(), 60);
    const reversed = run(denseBattle([...denseStatuses()].reverse()), 60);
    expect(forward.state.statuses?.map((s) => s.statusId)).toEqual(reversed.state.statuses?.map((s) => s.statusId));
    expect(createSnapshot(forward.state).checksum).toBe(createSnapshot(reversed.state).checksum);
    // The very first tick must already canonicalize both orders.
    const oneF = run(denseBattle(), 1);
    const oneR = run(denseBattle([...denseStatuses()].reverse()), 1);
    expect(createSnapshot(oneF.state).checksum).toBe(createSnapshot(oneR.state).checksum);
  });

  it('mirror: two same-seed runs are byte-identical', () => {
    const a = run(denseBattle(), 120);
    const b = run(denseBattle(), 120);
    expect(createSnapshot(a.state).checksum).toBe(createSnapshot(b.state).checksum);
    expect(a.events.map((e) => `${String(e.tick)}:${e.type}:${String(e.sequence)}`)).toEqual(b.events.map((e) => `${String(e.tick)}:${e.type}:${String(e.sequence)}`));
  });
});

describe('Phase 18 §13.2 canonical snapshot projection', () => {
  it('hashes unsorted seeds identically from tick 0 and verifies symmetrically', () => {
    const seed = denseStatuses();
    const a = createSnapshot(denseBattle(seed));
    const b = createSnapshot(denseBattle([...seed].reverse()));
    // The snapshot always projects the canonical collection, so a multiset
    // has one hash regardless of seed order — even before the first tick.
    expect(a.checksum).toBe(b.checksum);
    expect(verifySnapshot(a)).toBe(true);
    expect(verifySnapshot(b)).toBe(true);
  });
});

describe('Phase 18 §13.2 snapshot resume', () => {
  it('resume after 45 ticks continues identically to an uninterrupted 60-tick run (no drift, no double-fire)', () => {
    const uninterrupted = run(denseBattle(), 60);
    // Run 45, snapshot, resume for the remaining 15.
    const part = run(denseBattle(), 45);
    const snap = createSnapshot(part.state);
    expect(verifySnapshot(snap)).toBe(true);
    let resumed: BattleModel = snap;
    const events: KernelEvent[] = [];
    const random = randomSession();
    for (let i = 0; i < 15; i++) {
      const r = stepBattle({ state: resumed, input, random, rules: {}, content: {}, systems: SYSTEMS });
      resumed = r.state;
      events.push(...r.events);
    }
    expect(createSnapshot(resumed).checksum).toBe(createSnapshot(uninterrupted.state).checksum);
    const resumedEvents = events.map((e) => `${String(e.tick)}:${e.type}:${String(e.sequence)}`);
    // The resumed run fires tick-45 events in its first step, so compare from tick >= 45.
    const directEvents = uninterrupted.events.filter((e) => e.tick >= 45).map((e) => `${String(e.tick)}:${e.type}:${String(e.sequence)}`);
    expect(resumedEvents).toEqual(directEvents);
  });
});

describe('Phase 18 §13.2 fault injection', () => {
  it('rejects duplicate sequence in a status collection', () => {
    const state = battle({ simulationVersion: 'phase15-fixture-v1', entities: [unit('unit_p1', 'player')] });
    const a = st({ statusId: 'st_a', sequence: 7 });
    const b = st({ statusId: 'st_b', sequence: 7 });
    expectInvariant(() => run(state, 1, pushOnly({ kind: 'set_statuses', statuses: [a, b] })), 'status-duplicate-sequence');
  });

  it('rejects endTick at or before startTick', () => {
    const state = battle({ simulationVersion: 'phase15-fixture-v1', entities: [unit('unit_p1', 'player')] });
    expectInvariant(() => run(state, 1, pushOnly({ kind: 'set_statuses', statuses: [st({ endTick: 0 })] })), 'status-end-before-start');
  });

  it('rejects non-safe-integer endTick (overflow)', () => {
    const state = battle({ simulationVersion: 'phase15-fixture-v1', entities: [unit('unit_p1', 'player')] });
    expectInvariant(() => run(state, 1, pushOnly({ kind: 'set_statuses', statuses: [st({ endTick: Number.MAX_SAFE_INTEGER + 1 })] })), 'status-integer-invalid');
  });

  it('rejects negative, zero and unknown periodic content coefficients at system creation', () => {
    expectInvariant(() => createPhase18Systems({ speedsX100PerSecond: {}, status: { periodic: { burn_01: { effectKind: 'burn', amountPerTick: -5 } } } }), 'status-periodic-amount-invalid');
    expectInvariant(() => createPhase18Systems({ speedsX100PerSecond: {}, status: { periodic: { burn_01: { effectKind: 'burn', amountPerTick: 0 } } } }), 'status-periodic-amount-invalid');
    expectInvariant(() => createPhase18Systems({ speedsX100PerSecond: {}, status: { periodic: { x: { effectKind: 'nonsense' as never, amountPerTick: 5 } } } }), 'status-periodic-kind-unknown');
  });

  it('verifySnapshot detects a tampered status in the snapshot', () => {
    const snap = createSnapshot(run(denseBattle(), 60).state);
    const tampered = Object.freeze({ ...snap, statuses: Object.freeze([st({ statusId: 'st_evil', sequence: 999 })]) });
    expect(verifySnapshot(tampered)).toBe(false);
  });
});
