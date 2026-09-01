import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase15Systems } from '../../src/game/sim/core/phase15-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import type { TickContext } from '../../src/game/sim/core/tick-context.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { Body } from '../../src/game/sim/geometry/distance.js';
import { asX100 } from '../../src/game/sim/geometry/x100.js';
import { battle, entity, randomSession } from './test-helpers.js';

/**
 * Phase 15 §8 arena-body lifetime audit. Arena bodies are content-supplied
 * static objects resolved through the shared `resolveArenaBodies` hook. The
 * contract under audit:
 * - they are recomputed from the frozen per-stage state, so movement (F2) and
 *   the anti-stuck recompute (F3) see byte-identical body lists, and the spawn
 *   system (K1) sees the post-movement view — never a stale or divergent one;
 * - they are pure local values: no arena body id or field ever enters the
 *   battle state, the event log or the snapshot checksum.
 */

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

const unit = (id: string, overrides: Parameters<typeof entity>[1] = {}) =>
  migrateEntity({ entity: entity(id, overrides), radiusX100: 100 });

/** Records every arena-resolver call: tick + entity-position fingerprint. */
function tracingArena(bodies: readonly Body[]): { resolver: (context: TickContext) => readonly Body[]; calls: { tick: number; fingerprint: string }[] } {
  const calls: { tick: number; fingerprint: string }[] = [];
  const resolver = (context: TickContext): readonly Body[] => {
    const fingerprint = context.state.entities
      .filter((e) => e.phase.phase === 'ACTIVE')
      .map((e) => `${e.id}:${String(e.x100)}`)
      .join('|');
    calls.push({ tick: context.state.tick, fingerprint });
    return bodies;
  };
  return { resolver, calls };
}

function run(ticks: number, arenaBodies: readonly Body[], extra: Parameters<typeof battle>[0] = {}, speeds: Record<string, number> = { unit_p: 3000 }) {
  const traced = tracingArena(arenaBodies);
  const systems = createPhase15Systems({ speedsX100PerSecond: speeds, arenaBodies: traced.resolver });
  let current: BattleModel = battle({ simulationVersion: 'phase15-fixture-v1', ...extra });
  const random = randomSession();
  for (let i = 0; i < ticks; i++) {
    const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
    current = r.state;
  }
  return { state: current, calls: traced.calls };
}

describe('Phase 15 arena-body lifetime audit', () => {
  it('arena bodies never leak into the battle state, events or snapshot', () => {
    const bodyId = 'arena_wall_alpha';
    const state = run(12, [Object.freeze({ id: bodyId, x100: asX100(2400), radiusX100: asX100(100), lane: 'middle' as const })], {
      entities: [unit('unit_p', { x100: 1800 })],
    }).state;
    // The body id and its radius must not appear anywhere in the serialized state.
    expect(JSON.stringify(state)).not.toContain(bodyId);
    expect(JSON.stringify(state)).not.toContain('arena_wall');
    // Entities are untouched by the body; the unit moved 12 * 100 = 1200 to the wall edge.
    expect(state.entities.map((e) => e.id)).toEqual(['unit_p']);
    const moved = state.entities.find((e) => e.id === 'unit_p');
    expect(moved?.x100).toBe(2200); // 2400 - 100 (unit) - 100 (body) = 2200
    // Deterministic checksum: a second identical run hashes the same.
    const again = run(12, [Object.freeze({ id: bodyId, x100: asX100(2400), radiusX100: asX100(100), lane: 'middle' as const })], {
      entities: [unit('unit_p', { x100: 1800 })],
    }).state;
    expect(createSnapshot(state).checksum).toBe(createSnapshot(again).checksum);
  });

  it('movement (F2) and anti-stuck (F3) recompute the arena from the same frozen state', () => {
    const bodies: readonly Body[] = Object.freeze([Object.freeze({ id: 'rock', x100: asX100(2400), radiusX100: asX100(100), lane: 'middle' as const })]);
    const { calls } = run(3, bodies, { entities: [unit('unit_p', { x100: 1800 })] });
    // Each tick produces exactly two stage-F resolver calls (movement + the
    // anti-stuck recompute) that must agree on the exact same frozen state.
    const byTick = new Map<number, string[]>();
    for (const call of calls) {
      const list = byTick.get(call.tick) ?? [];
      list.push(call.fingerprint);
      byTick.set(call.tick, list);
    }
    for (const [tick, fingerprints] of byTick) {
      // Every tick has 3 calls: F2 movement, F3 anti-stuck recompute, K1 spawn.
      // Movement and anti-stuck share the frozen F state (identical
      // fingerprints); the spawn call resolves the arena against the post-F
      // state, which differs while the unit is advancing.
      expect(fingerprints.length).toBe(3);
      expect(fingerprints[0]).toBe(fingerprints[1]);
      expect(fingerprints[2]).not.toBe(fingerprints[0]);
      void tick;
    }
  });

  it('the spawn system sees the post-movement arena view through the shared resolver', () => {
    // A unit moving right and a spawn landing behind it: the K-stage resolver
    // call must reflect the moved position, so spawn overlap checks use the
    // same world the movement stage produced.
    const bodies: readonly Body[] = Object.freeze([Object.freeze({ id: 'rock', x100: asX100(2400), radiusX100: asX100(100), lane: 'middle' as const })]);
    const { calls } = run(2, bodies, { entities: [unit('unit_p', { x100: 1800 })] });
    const tick0 = calls.filter((c) => c.tick === 0);
    const tick1 = calls.filter((c) => c.tick === 1);
    expect(tick0.length).toBe(3); // F2, F3, K1
    expect(tick1.length).toBe(3); // F2, F3, K1
    // 3000 X100/s at 30 TPS = 100 X100/tick: the unit advances 1800 -> 1900 -> 2000.
    expect(tick1[0]?.fingerprint).toContain('unit_p:1900'); // F2 frozen state
    expect(tick1[2]?.fingerprint).toContain('unit_p:2000'); // K1 sees the post-F view
  });
});
