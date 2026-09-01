import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase18Systems } from '../../src/game/sim/core/phase18-systems.js';
import { createPhase21Systems } from '../../src/game/sim/core/phase21-systems.js';
import { createSnapshot, verifySnapshot, type BattleSnapshotData } from '../../src/game/sim/snapshot/snapshot.js';
import { restoreStreamsForResume } from '../../src/game/sim/snapshot/random-resume.js';
import { RandomSession } from '../../src/game/sim/random/random-session.js';
import { RollSlotRegistry } from '../../src/game/sim/random/roll-slot-registry.js';
import { buildBossObject, buildBossObjectBody, type BossObjectContent, type BossObjectSpec } from '../../src/game/sim/boss/boss-object-manager.js';
import type { StatusInstance } from '../../src/game/sim/status/status-instance.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { KernelEvent } from '../../src/game/sim/events/event-types.js';
import { battle, entity, randomSession } from './test-helpers.js';
import { asX100 } from '../../src/game/sim/geometry/x100.js';
import { tick } from '../../src/game/sim/core/primitives.js';

/**
 * Phase 21 §6 policy-gate differential resume. A battle with two placed boss
 * objects — a normal/allow object the player chips (damage reaches HP, a burn
 * ticks) and an immune/block object (hits land but deal 0, its burn never
 * fires) — is resumed at every damage/status boundary tick and must reproduce
 * the uninterrupted run byte-for-byte, exactly like the §9.4 endcap resume
 * tests. The policies are static content re-supplied on resume.
 */

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

const spec = (extra: Partial<BossObjectSpec>): BossObjectSpec =>
  Object.freeze({ slotId: 'boss_slot_0', lane: 'middle', x100: 4000, targetable: true, objectiveLink: null, damagePolicy: 'normal', statusPolicy: 'allow', cleanupPolicy: 'manual', fallback: 'FAIL', ...extra });

const content = (entityId: string, extra: Partial<BossObjectSpec>): BossObjectContent =>
  Object.freeze({ entityId, side: 'enemy', ownerId: 'boss_ash_unit', sourceId: 'content_resume', spec: spec(extra), maxLp: 1000, radiusX100: 120 });

const burn = (targetId: string, sequence: number): StatusInstance =>
  Object.freeze({
    statusId: `st_burn_${targetId}`, kind: 'burn', polarity: 'negative', targetId, sourceId: 'unit_p', effectId: 'ef_burn',
    startTick: 0, endTick: 400, strength: 1, stackGroup: 'burn', sequence,
    stackPolicy: 'no_reapply', maxStacks: 1, flags: Object.freeze([]),
    periodic: Object.freeze({ effectKind: 'burn', intervalTicks: 1, nextTick: 1, tickIndex: 0, initialTick: false, dedupKey: 'burn_a' }),
  });

const BOSS_OBJECTS: readonly BossObjectContent[] = Object.freeze([
  content('obj_core', { damagePolicy: 'normal', statusPolicy: 'allow' }),
  content('obj_ward', { slotId: 'boss_slot_1', lane: 'bottom', x100: 4600, damagePolicy: 'immune', statusPolicy: 'block' }),
]);

function systems(): readonly KernelSystem[] {
  return Object.freeze([
    ...createPhase18Systems({
      speedsX100PerSecond: {},
      bossObjectPolicies: new Map([['obj_core', 'normal'] as const, ['obj_ward', 'immune'] as const]),
      status: { blockedStatusTargets: new Set(['obj_ward']), periodic: { burn_a: { effectKind: 'burn', amountPerTick: 10 } } },
      basicAttack: {
        parameters: {
          unit_p: {
            attackIntervalTicks: 10, prepareTicks: 1, recoveryTicks: 3, preferredRangeX100: asX100(9000),
            delivery: { kind: 'direct', rawAmount: 200, damageTypeOrdinal: 0, defense: 0, bossCapBps: null },
          },
        },
      },
    }),
    ...createPhase21Systems({ bossObjects: BOSS_OBJECTS }),
  ]);
}

function buildBattle(): BattleModel {
  const player = migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
  const enemy = migrateEntity({ entity: entity('unit_e', { side: 'enemy', lane: 'top', x100: 9000, maxLp: 1000, lp: 1000 }), radiusX100: 120 });
  const bodies = BOSS_OBJECTS.map((b) => buildBossObjectBody(b, tick(0)));
  const temps = BOSS_OBJECTS.map((b, i) => buildBossObject(b.spec, b.entityId, b.side, b.ownerId, b.sourceId, 0, i));
  return battle({
    simulationVersion: 'phase21-fixture-v1',
    entities: Object.freeze([player, enemy, ...bodies]),
    temporaryEntities: Object.freeze(temps),
    statuses: Object.freeze([burn('obj_core', 0), burn('obj_ward', 1)]),
  });
}

interface TickRow {
  readonly tick: number;
  readonly events: readonly KernelEvent[];
  readonly checksum: string;
}

function runFrom(state: BattleModel, random: RandomSession, ticks: number): { rows: TickRow[]; state: BattleModel } {
  const sys = systems();
  let current = state;
  const rows: TickRow[] = [];
  for (let i = 0; i < ticks; i++) {
    const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems: sys });
    current = r.state;
    rows.push({ tick: current.tick, events: r.events, checksum: createSnapshot(current).checksum });
    if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(current.phase.phase)) break;
  }
  return { rows, state: current };
}

function assertDifferentialResume(maxTicks: number, boundaryTypes: readonly string[], sanity: (state: BattleModel, rows: TickRow[]) => void): void {
  const full = runFrom(buildBattle(), randomSession(), maxTicks);
  sanity(full.state, full.rows);

  const types = new Set(boundaryTypes);
  const boundaryTicks = new Set<number>();
  for (const row of full.rows) {
    if (row.events.some((e) => types.has(e.type))) {
      boundaryTicks.add(row.tick);
      boundaryTicks.add(row.tick - 1);
    }
  }
  boundaryTicks.delete(0);
  expect(boundaryTicks.size).toBeGreaterThan(1);

  for (const resumeTick of [...boundaryTicks].sort((a, b) => a - b)) {
    const prefixSteps = resumeTick;
    if (prefixSteps <= 0 || prefixSteps >= full.rows.length) continue;
    const prefix = runFrom(buildBattle(), randomSession(), prefixSteps);
    expect(prefix.rows[prefix.rows.length - 1]?.tick, `prefix ends at ${String(resumeTick)}`).toBe(resumeTick);
    const snap: BattleSnapshotData = createSnapshot(prefix.state);
    expect(verifySnapshot(snap), `snapshot verify at ${String(resumeTick)}`).toBe(true);
    const restoredStreams = restoreStreamsForResume(snap.authoritativeStreams, [1, 2, 3, 4] as never);
    const resumed = runFrom(snap, new RandomSession(restoredStreams, new RollSlotRegistry([]), false), full.rows.length - prefixSteps);

    expect(resumed.rows.length).toBeGreaterThan(0);
    const offset = prefix.rows.length;
    for (let i = 0; i < resumed.rows.length; i++) {
      expect(resumed.rows[i]?.tick, `tick at resumed row ${String(i)} (resume at ${String(resumeTick)})`).toBe(full.rows[offset + i]?.tick);
      expect(resumed.rows[i]?.checksum, `checksum at tick ${String(resumed.rows[i]?.tick)} (resume at ${String(resumeTick)})`).toBe(full.rows[offset + i]?.checksum);
    }
    const resumedEvents = resumed.rows.flatMap((row) => row.events.map((e) => `${String(row.tick)}:${e.type}:${String(e.sequence)}`));
    const fullEvents = full.rows.slice(offset).flatMap((row) => row.events.map((e) => `${String(row.tick)}:${e.type}:${String(e.sequence)}`));
    expect(resumedEvents, `events at resume ${String(resumeTick)}`).toEqual(fullEvents);
    expect(resumed.state.phase.phase).toBe(full.state.phase.phase);
    expect(resumed.state.endReason).toBe(full.state.endReason);
  }
}

describe('P21 policy-gate differential resume', () => {
  it('resuming at damage/status boundary ticks with policies wired reproduces the run byte-for-byte', { timeout: 120_000 }, () => {
    assertDifferentialResume(80, ['DamageApplied', 'EffectTick'], (state, rows) => {
      const core = state.entities.find((e) => e.id === 'obj_core');
      const ward = state.entities.find((e) => e.id === 'obj_ward');
      // normal/allow: the player's hits reached HP; the burn ticks.
      expect(core?.lp).toBeLessThan(1000);
      expect(rows.some((row) => row.events.some((e) => e.type === 'EffectTick' && e.targetIds.includes('obj_core')))).toBe(true);
      // immune/block: HP untouched; the burn never ticks.
      expect(ward?.lp).toBe(1000);
      expect(rows.some((row) => row.events.some((e) => e.type === 'EffectTick' && e.targetIds.includes('obj_ward')))).toBe(false);
      // The player still landed hits on the immune object (they report 0 HP delta).
      const zeroHits = rows.flatMap((row) => row.events).filter((e) => e.type === 'DamageApplied' && e.targetIds.includes('obj_ward'));
      expect(zeroHits.length).toBeGreaterThan(0);
      // Battle still ACTIVE with both sides combat-capable.
      expect(state.phase.phase).toBe('ACTIVE');
    });
  });

  it('the boundary ticks genuinely exercise both gates (damage reaches one object, not the other)', { timeout: 120_000 }, () => {
    const full = runFrom(buildBattle(), randomSession(), 80);
    const coreHits = full.rows.flatMap((row) => row.events).filter((e) => e.type === 'DamageApplied' && e.targetIds.includes('obj_core'));
    const wardHits = full.rows.flatMap((row) => row.events).filter((e) => e.type === 'DamageApplied' && e.targetIds.includes('obj_ward'));
    expect(coreHits.length).toBeGreaterThan(0);
    expect(wardHits.length).toBeGreaterThan(0);
    expect(coreHits.some((e) => ((e.payload as { finalHpDelta?: number }).finalHpDelta ?? 0) > 0)).toBe(true);
    for (const hit of wardHits) expect((hit.payload as { finalHpDelta?: number }).finalHpDelta ?? 0).toBe(0);
  });
});
