import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { createSnapshot, verifySnapshot, type BattleSnapshotData } from '../../src/game/sim/snapshot/snapshot.js';
import { restoreStreamsForResume } from '../../src/game/sim/snapshot/random-resume.js';
import { RandomSession } from '../../src/game/sim/random/random-session.js';
import { RollSlotRegistry } from '../../src/game/sim/random/roll-slot-registry.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { KernelEvent } from '../../src/game/sim/events/event-types.js';
import { battle, entity, randomSession } from './test-helpers.js';
import { asX100 } from '../../src/game/sim/geometry/x100.js';
import { tick } from '../../src/game/sim/core/primitives.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

/**
 * Phase-17 battle compositions over the §9.4 global no-progress endcap.
 * - lethal: a seeded-at-2680 battle with a lethal direct basic attack. Damage
 *   resets the endcap (stage I), kills reset it (stage J); the pending enemy
 *   keeps the battle ACTIVE until the soft-limit collapse + Chapter-76 timeout
 *   (the pinned phase17jl trace pattern).
 * - stall: a fresh tick-0 battle with no attacker. No qualifying progress
 *   every resets the counters, so the endcap escalates: RiftCollapseWarning at
 *   noProgressTicks 300, RiftCollapseEndRequest at collapseTicks 300 (600
 *   ticks total), then the stage-L time-limit resolution.
 */
type BasicAttackConfig = NonNullable<Parameters<typeof createPhase17Systems>[0]['basicAttack']>;

function jlSystems(attacker: boolean): readonly KernelSystem[] {
  const basicAttack: BasicAttackConfig = attacker
    ? {
        parameters: {
          unit_player_a: {
            attackIntervalTicks: 10,
            prepareTicks: 1,
            recoveryTicks: 3,
            preferredRangeX100: asX100(9000),
            delivery: { kind: 'direct', rawAmount: 400, damageTypeOrdinal: 0, defense: 0, bossCapBps: null },
          },
        },
      }
    : { parameters: {} };
  return Object.freeze([...createPhase17Systems({ speedsX100PerSecond: {}, basicAttack })]);
}

function unit(id: string, side: 'player' | 'enemy', overrides: Parameters<typeof entity>[1] = {}): BattleModel['entities'][number] {
  return migrateEntity({ entity: entity(id, { side, ...overrides }), radiusX100: 100 });
}

function buildBattle(startTick: number, enemyLp: number): BattleModel {
  return battle({
    simulationVersion: 'phase17jl-fixture-v1',
    tick: tick(startTick),
    entities: Object.freeze([
      unit('unit_player_a', 'player', { lane: 'top', x100: 1800, maxLp: 1000, lp: 1000 }),
      unit('unit_player_b', 'player', { lane: 'middle', x100: 2400, maxLp: 1000, lp: 1000 }),
      unit('unit_enemy_a', 'enemy', { lane: 'middle', x100: 6200, maxLp: 1000, lp: enemyLp }),
      unit('unit_enemy_b', 'enemy', { lane: 'bottom', x100: 7600, maxLp: 1000, lp: enemyLp }),
    ]),
  });
}

interface TickRow {
  readonly tick: number;
  readonly events: readonly KernelEvent[];
  readonly checksum: string;
  readonly noProgress: number;
}

/** Runs up to `ticks` steps from `state`, returning per-tick rows and the final state. */
function runFrom(state: BattleModel, random: RandomSession, attacker: boolean, ticks: number): { rows: TickRow[]; state: BattleModel } {
  const systems = jlSystems(attacker);
  let current = state;
  const rows: TickRow[] = [];
  for (let i = 0; i < ticks; i++) {
    const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
    current = r.state;
    rows.push({ tick: current.tick, events: r.events, checksum: createSnapshot(current).checksum, noProgress: current.globalNoProgressTicks ?? 0 });
    if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(current.phase.phase)) break;
  }
  return { rows, state: current };
}

function assertDifferentialResume(
  attacker: boolean,
  startTick: number,
  enemyLp: number,
  maxTicks: number,
  boundaryTypes: readonly string[],
  sanity: (rows: TickRow[], state: BattleModel) => void,
): void {
  const full = runFrom(buildBattle(startTick, enemyLp), randomSession(), attacker, maxTicks);
  sanity(full.rows, full.state);

  // Boundary ticks: post-step tick values containing the event type, plus one
  // tick before each so the transition tick itself is exercised by a resume.
  const types = new Set(boundaryTypes);
  const boundaryTicks = new Set<number>();
  for (const row of full.rows) {
    if (row.events.some((e) => types.has(e.type))) {
      boundaryTicks.add(row.tick);
      boundaryTicks.add(row.tick - 1);
    }
  }
  boundaryTicks.delete(startTick);
  expect(boundaryTicks.size).toBeGreaterThan(1);

  for (const resumeTick of [...boundaryTicks].sort((a, b) => a - b)) {
    const prefixSteps = resumeTick - startTick;
    if (prefixSteps <= 0) continue;
    const prefix = runFrom(buildBattle(startTick, enemyLp), randomSession(), attacker, prefixSteps);
    expect(prefix.rows[prefix.rows.length - 1]?.tick, `prefix ends at ${String(resumeTick)}`).toBe(resumeTick);
    const snap: BattleSnapshotData = createSnapshot(prefix.state);
    expect(verifySnapshot(snap), `snapshot verify at ${String(resumeTick)}`).toBe(true);
    const restoredStreams = restoreStreamsForResume(snap.authoritativeStreams, [1, 2, 3, 4] as never);
    const resumed = runFrom(snap, new RandomSession(restoredStreams, new RollSlotRegistry([]), false), attacker, maxTicks);

    expect(resumed.rows.length).toBeGreaterThan(0);
    // post-step rows[i].tick + checksum of the resumed run must equal the
    // full run's rows at the same post-step tick.
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

describe('Phase 17-JL endcap-boundary differential resume', () => {
  it('lethal trace: resuming at damage/kill boundary ticks reproduces the uninterrupted run byte-for-byte', { timeout: 120_000 }, () => {
    assertDifferentialResume(true, 2680, 500, 520, ['DamageApplied', 'Defeated'], (_rows, state) => {
      expect(state.phase.phase).toBe('VICTORY');
      expect(state.endReason).toBe('chapter76_timeout');
    });
  });

  it('stall trace: the endcap escalation (warning + end request) resumes byte-for-byte at every boundar y', { timeout: 120_000 }, () => {
    assertDifferentialResume(false, 0, 1000, 650, ['RiftCollapseWarning', 'RiftCollapseEndRequest'], (rows, state) => {
      const warning = rows.find((row) => row.events.some((e) => e.type === 'RiftCollapseWarning'));
      const end = rows.find((row) => row.events.some((e) => e.type === 'RiftCollapseEndRequest'));
      expect(warning).toBeDefined();
      expect(warning?.noProgress).toBeGreaterThanOrEqual(300);
      expect(end).toBeDefined();
      // Fresh battle: the end request fires once the collapse timer reaches 600
      // ticks (300 no-progress + 300 collapse), well before the 2700 soft limit.
      expect(state.phase.phase).toBe('DRAW_ABORT');
      expect(state.endReason).not.toBeNull();
    });
  });

  it('boundary ticks genuinely reset the endcap (damage and kills), the run is not trivial', { timeout: 120_000 }, () => {
    const full = runFrom(buildBattle(2680, 500), randomSession(), true, 200);
    const damageRows = full.rows.filter((row) => row.events.some((e) => e.type === 'DamageApplied'));
    const killRows = full.rows.filter((row) => row.events.some((e) => e.type === 'Defeated'));
    expect(damageRows.length).toBeGreaterThan(0);
    expect(killRows.length).toBeGreaterThan(0);
    expect(damageRows[0]?.noProgress).toBe(0);
    expect(killRows[0]?.noProgress).toBeLessThan(5);
  });
});
