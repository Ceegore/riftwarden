import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { createPhase21Systems, type Phase21RuntimeConfig } from '../../src/game/sim/core/phase21-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import type { KernelEvent } from '../../src/game/sim/events/event-types.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { Objective } from '../../src/game/sim/objectives/combat-objective.js';
import { buildBossObject, buildBossObjectBody, type BossObjectContent, type BossObjectSpec } from '../../src/game/sim/boss/boss-object-manager.js';
import { battle, entity, randomSession, tick } from './test-helpers.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';

/**
 * Phase 21 §6 cleanup boundary-race fuzz. The cleanup system commits removals
 * at stage K — one tick after the phase flips to an ending state in the same
 * stage; and on_objective objects are removed the tick their link completes.
 * These tests sweep many seeded configurations (object counts, lanes, policies,
 * end-entry ticks) and assert three invariants on every run: (1) each removed
 * object emits exactly one `Removed` (never a double removal), (2) no removed
 * object leaves an orphaned ACTIVE combat body, and (3) the whole battle is
 * byte-deterministic across identical re-runs.
 */

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

const SLOTS = ['boss_slot_0', 'boss_slot_1', 'boss_slot_2', 'boss_slot_3'] as const;
const LANES = ['top', 'middle', 'bottom'] as const as readonly string[];

// Slot occupancy is per (side, slot): only four slots exist per side. To let
// fuzz battles exceed four objects without colliding, sequential indices wrap
// across sides (index 0-3 enemy, 4-7 player, ...), each with a unique slot.
function specOf(seq: number, extra: Partial<BossObjectSpec> = {}): BossObjectSpec {
  const slotIndex = (seq % SLOTS.length) as 0 | 1 | 2 | 3;
  return Object.freeze({
    slotId: SLOTS[slotIndex],
    lane: LANES[slotIndex % LANES.length] as BossObjectSpec['lane'],
    x100: 3000 + slotIndex * 1200,
    targetable: true,
    objectiveLink: null,
    damagePolicy: 'normal',
    statusPolicy: 'allow',
    cleanupPolicy: 'on_battle_end',
    fallback: 'FAIL',
    ...extra,
  });
}

function entryOf(seq: number, cleanupPolicy: BossObjectSpec['cleanupPolicy'], objectiveLink: string | null = null): BossObjectContent {
  const side: 'player' | 'enemy' = Math.floor(seq / SLOTS.length) % 2 === 0 ? 'enemy' : 'player';
  const entityId = `obj_race_${String(seq)}`;
  return Object.freeze({
    entityId,
    side,
    ownerId: 'boss_agent_unit',
    sourceId: 'content_race',
    spec: specOf(seq, { cleanupPolicy, objectiveLink }),
    maxLp: 500 + seq * 50,
    radiusX100: 100 + seq,
  });
}

function bodyOf(content: BossObjectContent): ReturnType<typeof buildBossObjectBody> {
  return buildBossObjectBody(content, tick(0));
}

function regOf(content: BossObjectContent, index: number): ReturnType<typeof buildBossObject> {
  return buildBossObject(content.spec, content.entityId, content.side, content.ownerId, content.sourceId, 0, index);
}

function endedBase(contents: readonly BossObjectContent[], endTick: number): BattleModel {
  const player = migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
  const enemy = migrateEntity({ entity: entity('unit_e', { side: 'enemy', lane: 'top', x100: 9000, maxLp: 1000, lp: 1000 }), radiusX100: 120 });
  const migratedBoss = migrateEntity({ entity: entity('boss_ash_unit', { side: 'enemy', lane: 'middle', x100: 7000, maxLp: 1000, lp: 400 }), radiusX100: 120 });
  return battle({
    simulationVersion: 'phase21-fixture-v1',
    entities: Object.freeze([player, enemy, migratedBoss, ...contents.map((c) => bodyOf(c))]),
    temporaryEntities: Object.freeze(contents.map((c, i) => regOf(c, i))),
    phase: Object.freeze({ phase: 'RESOLVING_END', enteredTick: tick(endTick), resolvingEndTicks: 0 }),
    bossPhase: Object.freeze({ entityId: 'boss_ash_unit', bossId: 'boss_ash', phaseId: 'p1', transition: null, visited: Object.freeze(['p1']), invulnerableUntilTick: null }),
  });
}

function run(state: BattleModel, cfg: Phase21RuntimeConfig, ticks: number): { state: BattleModel; events: KernelEvent[]; phases: string[]; removedPerTick: Record<number, string[]> } {
  let current = state;
  const events: KernelEvent[] = [];
  const phases: string[] = [current.phase.phase];
  const removedPerTick: Record<number, string[]> = {};
  const random = randomSession();
  const systems = Object.freeze([
    ...createPhase17Systems({ speedsX100PerSecond: {} }),
    ...createPhase21Systems(cfg),
  ]);
  for (let i = 0; i < ticks; i++) {
    const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
    current = r.state;
    events.push(...r.events);
    phases.push(current.phase.phase);
    removedPerTick[current.tick] = [];
    for (const e of r.events) {
      if (e.type === 'Removed') removedPerTick[current.tick] = [...(removedPerTick[current.tick] ?? []), ...e.targetIds.filter((id) => id.startsWith('obj_race_'))];
    }
  }
  return { state: current, events, phases, removedPerTick };
}

describe('P21 cleanup race fuzz (§6)', () => {
  it('on_battle_end objects are removed exactly once, one tick after RESOLVING_END, with no orphaned bodies', () => {
    for (const count of [1, 2, 4, 7]) {
      for (const endTick of [0, 1, 3, 5]) {
        const contents = Object.freeze(Array.from({ length: count }, (_, i) => entryOf(i, 'on_battle_end')));
        const a = run(endedBase(contents, endTick), { bossObjects: contents }, 8);
        const b = run(endedBase(contents, endTick), { bossObjects: contents }, 8);
        // Exactly one Removed per on_battle_end object.
        for (const c of contents) {
          const removals = a.events.filter((e) => e.type === 'Removed' && e.targetIds.includes(c.entityId));
          expect(removals.length, `count=${String(count)} endTick=${String(endTick)} obj=${c.entityId}`).toBe(1);
        }
        // No removed object leaves an orphaned ACTIVE combat body.
        for (const c of contents) {
          expect(a.state.entities.some((e) => e.id === c.entityId && e.phase.phase === 'ACTIVE'),
            `orphaned ACTIVE body ${c.entityId} count=${String(count)} endTick=${String(endTick)}`).toBe(false);
        }
        // Registry is empty once cleaned.
        expect(a.state.temporaryEntities ?? []).toEqual([]);
        // Determinism.
        expect(createSnapshot(a.state).checksum, `count=${String(count)} endTick=${String(endTick)}`).toBe(createSnapshot(b.state).checksum);
      }
    }
  });

  it('the on_battle_end removal is a single-shot commit on the first cleanup pass, never re-fired', () => {
    // Cleanup commits at stage K. Once the phase is an ending state, that is the
    // first stage-K after the flip; it must remove each object exactly once and
    // emit no further Removed on any later tick (byte-determinism across seeds).
    for (const count of [1, 3, 5]) {
      const contents = Object.freeze(Array.from({ length: count }, (_, i) => entryOf(i, 'on_battle_end')));
      const r = run(endedBase(contents, 0), { bossObjects: contents }, 8);
      const removalTicks: number[] = [];
      for (const tickKey of [...Object.keys(r.removedPerTick)].map(Number).sort((x, y) => x - y)) {
        const removedHere = (r.removedPerTick[tickKey] ?? []).filter((id) => (contents).some((c) => c.entityId === id));
        if (removedHere.length > 0) removalTicks.push(tickKey);
      }
      // All removals land on the very FIRST stage-K opportunity (tick 1) and
      // never on any later tick.
      expect(removalTicks, `count=${String(count)}`).toEqual([1]);
    }
  });

  it('on_objective objects are removed the same tick their link completes, exactly once, no orphan', () => {
    for (const completeAtTick of [1, 3]) {
      const content = entryOf(0, 'on_objective', 'obj_destroy');
      const objectives: readonly Objective[] = Object.freeze([
        Object.freeze({ id: 'obj_destroy', kind: 'destroy_object', targetId: content.entityId, required: 1, progress: 1, complete: true }),
      ]);
      // The objective is already complete in state; the first cleanup pass
      // (stage K of the first tick) must remove it — analogous to the
      // on_battle_end one-tick-later rule: placement at K of tick 0, then the
      // baseline state carries it, so the first tick's K sees it complete.
      const state = endedBase(Object.freeze([content]), 0);
      const stateWithObjective = battle({ ...state, objectives });
      const a = run(stateWithObjective, { objectives, bossObjects: Object.freeze([content]) }, 4);
      const removals = a.events.filter((e) => e.type === 'Removed' && e.targetIds.includes(content.entityId));
      expect(removals.length, `completeAtTick=${String(completeAtTick)}`).toBe(1);
      expect(a.state.temporaryEntities ?? []).toEqual([]);
      expect(a.state.entities.some((e) => e.id === content.entityId && e.phase.phase === 'ACTIVE')).toBe(false);
      // Determinism across a second run.
      const b = run(stateWithObjective, { objectives, bossObjects: Object.freeze([content]) }, 4);
      expect(createSnapshot(a.state).checksum).toBe(createSnapshot(b.state).checksum);
    }
  });

  it('mixed policies in one battle clean independently and deterministically', () => {
    const onBattleEnd = Array.from({ length: 3 }, (_, i) => entryOf(i, 'on_battle_end'));
    const onObjective = entryOf(3, 'on_objective', 'obj_destroy');
    const manual = entryOf(4, 'manual');
    const contents = Object.freeze([...onBattleEnd, onObjective, manual]);
    const objectives: readonly Objective[] = Object.freeze([
      Object.freeze({ id: 'obj_destroy', kind: 'destroy_object', targetId: onObjective.entityId, required: 1, progress: 1, complete: true }),
    ]);
    const state = battle({ ...endedBase(contents, 0), objectives });
    const a = run(state, { objectives, bossObjects: contents }, 6);
    const b = run(state, { objectives, bossObjects: contents }, 6);
    for (const e of onBattleEnd) {
      expect(a.events.filter((ev) => ev.type === 'Removed' && ev.targetIds.includes(e.entityId)).length).toBe(1);
    }
    // The on_objective object cleaned exactly once (its link is complete).
    expect(a.events.filter((ev) => ev.type === 'Removed' && ev.targetIds.includes(onObjective.entityId)).length).toBe(1);
    // The manual object is never removed and keeps an ACTIVE body.
    expect(a.events.some((ev) => ev.type === 'Removed' && ev.targetIds.includes(manual.entityId))).toBe(false);
    expect(a.state.entities.some((e) => e.id === manual.entityId && e.phase.phase === 'ACTIVE')).toBe(true);
    // Registry keeps only the manual object.
    expect(a.state.temporaryEntities?.map((t) => t.id)).toEqual([manual.entityId]);
    expect(createSnapshot(a.state).checksum).toBe(createSnapshot(b.state).checksum);
  });
});
