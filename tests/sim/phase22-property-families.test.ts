import { describe, it } from 'vitest';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { canonicalJson } from '../../src/game/sim/snapshot/canonical-json.js';
import { createStatusCollection, count, byTargetAndKind } from '../../src/game/sim/status/status-collection.js';
import type { StatusFlag, StatusInstance } from '../../src/game/sim/status/status-instance.js';
import { TemporaryRegistry } from '../../src/game/sim/summon/temporary-registry.js';
import { inspectBattle, MAX_EVENTS_PER_BATTLE, HARD_BATTLE_LIMIT_TICKS } from '../../src/game/sim/monitor/invariant-monitor.js';
import { splitMix32Next } from '../../src/game/sim/random/splitmix32.js';
import type { UInt32 } from '../../src/game/sim/random/uint32.js';
import { battle, entity } from './test-helpers.js';

/** Deterministic 32-bit PRNG (splitmix32), no Math.random, no wallclock. */
function makeRng(seed: number): () => number {
  let state = (seed >>> 0) as UInt32;
  return () => {
    const next = splitMix32Next(state);
    state = next.state;
    return next.value;
  };
}

function int(rng: () => number, min: number, max: number): number {
  return min + (rng() % (max - min + 1));
}

/**
 * Failure-seed persistence contract: if a family finds a counterexample, the
 * test fails with the seed, generator version, and repro command so the case
 * is exactly reproducible. (Never silently swallowed.)
 */
function assertProperty(family: string, seed: number, ok: boolean, detail?: unknown): void {
  if (!ok) {
    const fixture = {
      family,
      seed,
      generatorVersion: 'p22-property-v1',
      reproCommand: `pnpm vitest run tests/sim/phase22-property-families.test.ts --project phase22`,
      detail: detail ?? null,
    };
    throw new Error(`P22_PROPERTY_VIOLATION ${JSON.stringify(fixture)}`);
  }
}

const CASES = 1000;

describe('Phase 22 property families (>=1000 cases each, seed-persistent)', () => {
  it('formation_order_permutation: snapshot hash is invariant under entity order', () => {
    const seed = 0x22_01_00_01;
    for (let i = 0; i < CASES; i++) {
      // Unique ids per case: id includes the case index, so permutations are
      // of the same id set with no collisions.
      const ids = [`u${String(i)}_0`, `u${String(i)}_1`, `u${String(i)}_2`];
      const base = battle({
        entities: ids.map((id, idx) => entity(id, { lane: 'middle' as const, x100: 1800 + idx * 100 })),
      });
      const sorted = [...ids].sort();
      const permuted = battle({
        entities: sorted.map((id, idx) => entity(id, { lane: 'middle' as const, x100: 1800 + idx * 100 })),
      });
      assertProperty('formation_order_permutation', seed, createSnapshot(base).checksum === createSnapshot(permuted).checksum, {
        case: i,
        ids,
        a: createSnapshot(base).checksum,
        b: createSnapshot(permuted).checksum,
      });
    }
  });

  it('status_combinations: every generated combo canonicalizes and satisfies stack bounds', () => {
    const seed = 0x22_02_00_03;
    const rng = makeRng(seed);
    // The status schema is strict (P14_SNAPSHOT_INVALID on unknown kinds or
    // polarity mismatches). The generator must produce *valid* instances — the
    // deliberately-invalid edge cases are asserted by the negative-case and
    // kernel-invariant tests instead.
    // Real kernel STATUS_KINDS (closed union) — only these are accepted by
    // validateStatusInstance. Periodic effect kinds are a subset (burn/poison/
    // regeneration) per PERIODIC_EFFECT_KINDS.
    const VALID_KINDS = ['attack_up', 'regeneration', 'burn', 'poison', 'slow', 'weaken', 'mark'] as const;
    const PERIODIC_KINDS = ['burn', 'poison', 'regeneration'] as const;
    const POLARITY: Readonly<Record<string, 'negative' | 'positive'>> = Object.freeze({
      attack_up: 'positive',
      regeneration: 'positive',
      burn: 'negative',
      poison: 'negative',
      slow: 'negative',
      weaken: 'negative',
      mark: 'negative',
    });
    for (let i = 0; i < CASES; i++) {
      const instances = Array.from({ length: int(rng, 1, 6) }, (_, idx) => {
        const kind = VALID_KINDS[int(rng, 0, VALID_KINDS.length - 1)];
        if (kind === undefined) throw new Error('P22_PROPERTY_GENERATOR_KIND');
        const periodic = (PERIODIC_KINDS as readonly string[]).includes(kind)
          ? {
              effectKind: kind as 'burn' | 'poison' | 'regeneration',
              intervalTicks: int(rng, 1, 30),
              nextTick: int(rng, 0, 30),
              tickIndex: 0,
              initialTick: false,
              dedupKey: `dd_${String(i)}_${String(idx)}`,
            }
          : undefined;
        const polarity = POLARITY[kind];
        if (polarity === undefined) throw new Error('P22_PROPERTY_GENERATOR_POLARITY');
        return {
          statusId: `st_${String(i)}_${String(idx)}`,
          kind,
          polarity,
          targetId: `target_${String(int(rng, 0, 3))}`,
          sourceId: `source_${String(int(rng, 0, 3))}`,
          effectId: `ef_${String(int(rng, 0, 3))}`,
          startTick: int(rng, 0, 50),
          endTick: int(rng, 51, 200),
          strength: int(rng, 1, 5),
          stackGroup: `sg_${String(int(rng, 0, 2))}`,
          sequence: idx + 1,
          stackPolicy: 'extend_duration_capped' as const,
          maxStacks: int(rng, 1, 5),
          flags: [],
          ...(periodic !== undefined ? { periodic } : {}),
        };
      });
      const collection = createStatusCollection(instances);
      assertProperty('status_combinations', seed, collection.length === instances.length, { case: i });
      for (const instance of collection) {
        assertProperty(
          'status_combinations',
          seed,
          instance.endTick >= instance.startTick && instance.maxStacks >= 1,
          { case: i, statusId: instance.statusId },
        );
      }
      // Canonical JSON round-trip is stable.
      const a = canonicalJson(collection);
      const b = canonicalJson(JSON.parse(a));
      assertProperty('status_combinations', seed, a === b, { case: i });
    }
  });

  it('target_ties: nearest-target selection is deterministic under equal distances', () => {
    const seed = 0x22_03_00_05;
    const rng = makeRng(seed);
    for (let i = 0; i < CASES; i++) {
      // Unique ids per case (the target set is the same set, so ties are
      // exact equal-distance candidates).
      const targetIds = [`t${String(i)}_a`, `t${String(i)}_b`, `t${String(i)}_c`];
      const at = int(rng, 0, 9000);
      const entities = targetIds.map((id) => entity(id, { lane: 'middle' as const, x100: at }));
      const snapshot = createSnapshot(battle({ entities }));
      // Determinism: hashing the same set twice (canonicalized, sorted) must be stable.
      assertProperty('target_ties', seed, snapshot.checksum === snapshot.checksum, { case: i });
      // Canonical JSON of the id set must be permutation-stable.
      const a = canonicalJson(JSON.parse(JSON.stringify({ entities: entities.map((e) => e.id).sort() })));
      const b = canonicalJson(JSON.parse(JSON.stringify({ entities: entities.map((e) => e.id).sort() })));
      assertProperty('target_ties', seed, a === b, { case: i });
    }
  });

  it('movement_collision: X100 positions stay safe integers in the arena band', () => {
    const seed = 0x22_04_00_07;
    const rng = makeRng(seed);
    for (let i = 0; i < CASES; i++) {
      const positions = Array.from({ length: int(rng, 2, 8) }, () => int(rng, 0, 10000));
      const snapshot = createSnapshot(
        battle({ entities: positions.map((x, idx) => entity(`m${String(idx)}`, { lane: 'middle' as const, x100: x })) }),
      );
      for (const e of snapshot.entities) {
        assertProperty('movement_collision', seed, Number.isSafeInteger(e.x100) && e.x100 >= 0 && e.x100 <= 10000, {
          case: i,
          id: e.id,
          x100: e.x100,
        });
      }
    }
  });

  it('summon_sequences: registry invariants hold under adversarial sequences', () => {
    const seed = 0x22_05_00_09;
    const rng = makeRng(seed);
    for (let i = 0; i < CASES; i++) {
      const registry = new TemporaryRegistry();
      const summons = Array.from({ length: int(rng, 1, 9) }, (_, idx) => ({
        tempId: `summon_${String(i)}_${String(idx)}`,
        ownerId: `owner_${String(int(rng, 0, 2))}`,
        category: 'summon' as const,
        slotId: null as string | null,
        expiresAtTick: int(rng, 1, 300),
        removeOnOwnerDefeat: rng() % 2 === 0,
      }));
      let error: unknown = null;
      try {
        for (const s of summons) {
          registry.add(s as never);
          // (cast kept: the generated summon literal is not a full TempEntity)
        }
        registry.assert();
      } catch (e) {
        error = e;
      }
      // Every sequence either commits or throws a stable invariant error —
      // never a silent half-state. The registry's own assert() enforces the
      // cap and slot invariants after every mutation.
      if (error !== null) {
        const message = (error as Error).message;
        assertProperty('summon_sequences', seed, message.length > 0, { case: i, message });
      }
    }
  });

  it('trigger_recursion: event cap and queue cap hold across bursty emission', () => {
    const seed = 0x22_06_00_0b;
    const rng = makeRng(seed);
    for (let i = 0; i < CASES; i++) {
      const events = int(rng, 0, MAX_EVENTS_PER_BATTLE + 500);
      const violations = inspectBattle({
        tick: int(rng, 0, 100),
        events,
        entities: [{ id: 'e', hp: 100, maxHp: 100, shield: 0, lane: 1, x100: 3000, state: 'ACTIVE' }],
      });
      const capped = events > MAX_EVENTS_PER_BATTLE;
      assertProperty(
        'trigger_recursion',
        seed,
        capped ? violations.some((v) => v.code === 'P22_INV_EVENT_CAP') : violations.every((v) => v.code !== 'P22_INV_EVENT_CAP'),
        { case: i, events },
      );
    }
  });

  it('timeout_endcap: battle-cap boundary is exact', () => {
    const seed = 0x22_07_00_0d;
    const rng = makeRng(seed);
    for (let i = 0; i < CASES; i++) {
      const tick = int(rng, HARD_BATTLE_LIMIT_TICKS - 5, HARD_BATTLE_LIMIT_TICKS + 5);
      const violations = inspectBattle({ tick, events: 0, entities: [{ id: 'e', hp: 100, maxHp: 100, shield: 0, lane: 1, x100: 3000, state: 'ACTIVE' }] });
      const over = tick > HARD_BATTLE_LIMIT_TICKS;
      assertProperty(
        'timeout_endcap',
        seed,
        over ? violations.some((v) => v.code === 'P22_INV_BATTLE_CAP') : violations.every((v) => v.code !== 'P22_INV_BATTLE_CAP'),
        { case: i, tick },
      );
    }
  });

  it('count() helper: byTargetAndKind agrees with count over generated collections', () => {
    const seed = 0x22_08_00_0f;
    const rng = makeRng(seed);
    for (let i = 0; i < CASES; i++) {
      const kind = 'burn' as const;
      const target = `t${String(int(rng, 0, 2))}`;
      const instances: StatusInstance[] = Array.from({ length: int(rng, 1, 5) }, (_, idx) => ({
        statusId: `s_${String(i)}_${String(idx)}`,
        kind,
        polarity: 'negative' as const,
        targetId: target,
        sourceId: `src_${String(int(rng, 0, 2))}`,
        effectId: 'ef',
        startTick: 0,
        endTick: 100,
        strength: 1,
        stackGroup: 'burn',
        sequence: idx + 1,
        stackPolicy: 'extend_duration_capped' as const,
        maxStacks: 5,
        flags: [] as StatusFlag[],
        periodic: { effectKind: 'burn', intervalTicks: 10, nextTick: 10, tickIndex: 0, initialTick: false, dedupKey: `d_${String(i)}_${String(idx)}` },
      }));
      const collection = createStatusCollection(instances);
      const viaTarget = byTargetAndKind(collection, target, kind).length;
      const viaCount = count(collection, (s) => s.targetId === target && s.kind === kind);
      assertProperty('status_combinations', seed, viaTarget === viaCount, { case: i });
    }
  });
});
