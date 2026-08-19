import { describe, expect, it } from 'vitest';
import { KernelInvariantError } from '../../src/game/sim/core/invariant-error.js';
import { TemporaryRegistry } from '../../src/game/sim/summon/temporary-registry.js';
import { commitSummon, commitSummonBatch, sortRequests } from '../../src/game/sim/summon/summon-manager.js';
import { SUMMON_CAP_PER_SIDE, type SpawnRequest } from '../../src/game/sim/summon/temporary-entity.js';

const req = (id: string, side: 'player' | 'enemy' = 'player', overrides: Partial<SpawnRequest> = {}): SpawnRequest =>
  Object.freeze({
    reservedEntityId: id,
    side,
    ownerId: 'owner_0',
    sourceId: 'ability_summon',
    requestedTick: 0,
    sourcePriority: 0,
    sourceEntityId: 'owner_0',
    abilityId: 'ability_summon',
    requestSequence: 0,
    policy: 'BLOCK',
    ...overrides,
  });

describe('P20 §5 summon cap contract', () => {
  it('allows exactly 6 counted summons, blocks the 7th under BLOCK', () => {
    const registry = new TemporaryRegistry();
    for (let i = 0; i < 6; i++) {
      const result = commitSummon(registry, req(`summon_${String(i)}`, 'player', { requestSequence: i, requestedTick: i }));
      expect(result.kind).toBe('SPAWNED');
    }
    expect(registry.summonCount('player')).toBe(SUMMON_CAP_PER_SIDE);
    const blocked = commitSummon(registry, req('summon_6', 'player', { requestSequence: 6, requestedTick: 6 }));
    expect(blocked.kind).toBe('BLOCKED');
    expect(blocked.diagnostic).toBe('SpawnLimitBlocked');
    expect(registry.summonCount('player')).toBe(SUMMON_CAP_PER_SIDE);
  });

  it('REPLACE_OLDEST removes the oldest (tick, sequence, id) and commits', () => {
    const registry = new TemporaryRegistry();
    for (let i = 0; i < 6; i++) commitSummon(registry, req(`summon_${String(i)}`, 'player', { requestSequence: i, requestedTick: i }));
    const replaced = commitSummon(registry, req('summon_6', 'player', { policy: 'REPLACE_OLDEST', requestSequence: 6, requestedTick: 6 }));
    expect(replaced.kind).toBe('REPLACED');
    expect(replaced.removedId).toBe('summon_0');
    expect(replaced.entityId).toBe('summon_6');
    expect(registry.summonCount('player')).toBe(SUMMON_CAP_PER_SIDE);
    expect(registry.has('summon_0')).toBe(false);
    expect(registry.has('summon_6')).toBe(true);
  });

  it('BUFF_OLDEST spawns no entity and targets the oldest valid summon', () => {
    const registry = new TemporaryRegistry();
    for (let i = 0; i < 6; i++) commitSummon(registry, req(`summon_${String(i)}`, 'player', { requestSequence: i, requestedTick: i }));
    const buffed = commitSummon(registry, req('summon_6', 'player', { policy: 'BUFF_OLDEST', requestSequence: 6, requestedTick: 6 }));
    expect(buffed.kind).toBe('BUFFED');
    expect(buffed.entityId).toBe('summon_0');
    expect(registry.summonCount('player')).toBe(SUMMON_CAP_PER_SIDE);
    expect(registry.has('summon_6')).toBe(false);
  });

  it('cap is per side, not global', () => {
    const registry = new TemporaryRegistry();
    for (let i = 0; i < 6; i++) commitSummon(registry, req(`p_${String(i)}`, 'player', { requestSequence: i }));
    for (let i = 0; i < 6; i++) commitSummon(registry, req(`e_${String(i)}`, 'enemy', { requestSequence: i }));
    expect(registry.summonCount('player')).toBe(6);
    expect(registry.summonCount('enemy')).toBe(6);
  });

  it('orders a simultaneous batch canonically by §5.1 keys', () => {
    const requests = [
      req('r_4', 'player', { requestedTick: 1, sourcePriority: 0, sourceEntityId: 'unit_b', abilityId: 'ability_a', requestSequence: 0 }),
      req('r_1', 'player', { requestedTick: 0, sourcePriority: 0, sourceEntityId: 'unit_a', abilityId: 'ability_a', requestSequence: 0 }),
      req('r_3', 'player', { requestedTick: 1, sourcePriority: 0, sourceEntityId: 'unit_a', abilityId: 'ability_a', requestSequence: 0 }),
      req('r_2', 'player', { requestedTick: 0, sourcePriority: 1, sourceEntityId: 'unit_a', abilityId: 'ability_a', requestSequence: 0 }),
    ];
    expect(sortRequests(requests).map((r) => r.reservedEntityId)).toEqual(['r_1', 'r_2', 'r_3', 'r_4']);
  });
});

describe('P20 §5.2 id-before-commit', () => {
  it('a blocked request still consumes its reserved id (never reused)', () => {
    const registry = new TemporaryRegistry();
    for (let i = 0; i < 6; i++) commitSummon(registry, req(`summon_${String(i)}`, 'player', { requestSequence: i }));
    const blocked = commitSummon(registry, req('summon_6', 'player', { requestSequence: 6 }));
    expect(blocked.kind).toBe('BLOCKED');
    expect(blocked.entityId).toBe('summon_6');
    // The reserved id is consumed: it never lands in the registry (so the
    // allocator must not re-offer it), but the event/replay sequence keeps it.
    expect(registry.has('summon_6')).toBe(false);
  });
});

describe('P20 §8 registry contract', () => {
  it('enforces duplicate entity ids', () => {
    const registry = new TemporaryRegistry();
    commitSummon(registry, req('summon_0', 'player'));
    expect(() => commitSummon(registry, req('summon_0', 'player', { requestSequence: 1 }))).toThrow(KernelInvariantError);
  });

  it('enforces slot uniqueness per side', () => {
    const registry = new TemporaryRegistry();
    commitSummon(registry, req('summon_0', 'player'));
    expect(() => { registry.add(Object.freeze({
      id: 'summon_1', side: 'player', kind: 'CONSTRUCT', counted: false, ownerId: 'owner_0', sourceId: 'ability_construct', createdTick: 1, createdSequence: 1, slotId: 'slot_a',
    })); }).not.toThrow();
    expect(() => { registry.add(Object.freeze({
      id: 'summon_2', side: 'player', kind: 'CONSTRUCT', counted: false, ownerId: 'owner_0', sourceId: 'ability_construct', createdTick: 2, createdSequence: 2, slotId: 'slot_a',
    })); }).toThrow(KernelInvariantError);
  });

  it('restore rebuilds indices and matches the snapshot', () => {
    const registry = new TemporaryRegistry();
    for (let i = 0; i < 4; i++) commitSummon(registry, req(`summon_${String(i)}`, 'player', { requestSequence: i }));
    const restored = TemporaryRegistry.restore(registry.snapshot());
    expect(restored.snapshot()).toEqual(registry.snapshot());
    expect(restored.summonCount('player')).toBe(4);
  });

  it('restore rejects a snapshot with more than six summons', () => {
    const snapshot = Array.from({ length: 7 }, (_, i) => Object.freeze({
      id: `summon_${String(i)}`, side: 'player', kind: 'SUMMON', counted: true, ownerId: 'owner_0', sourceId: 'ability_summon', createdTick: i, createdSequence: i,
    }));
    expect(() => TemporaryRegistry.restore(snapshot)).toThrow(KernelInvariantError);
  });

  it('restore rejects a missing owner reference', () => {
    const registry = new TemporaryRegistry();
    commitSummon(registry, req('summon_0', 'player'));
    expect(() => TemporaryRegistry.restore(registry.snapshot(), new Set(['owner_missing']))).toThrow(KernelInvariantError);
  });
});

describe('P20 §11 property: 1000 random sequences', () => {
  it('never exceeds 6 counted summons per side and restore always matches', { timeout: 30_000 }, () => {
    const policies = ['BLOCK', 'REPLACE_OLDEST', 'BUFF_OLDEST'] as const;
    let checks = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const registry = new TemporaryRegistry();
      for (let i = 0; i < 100; i++) {
        const side = i % 2 === 0 ? 'player' : 'enemy';
        const policy = policies[(seed + i) % 3] ?? 'BLOCK';
        commitSummon(registry, req(`s${String(seed)}_${String(i)}`, side, { policy, requestSequence: i, requestedTick: i }));
        expect(registry.summonCount('player')).toBeLessThanOrEqual(SUMMON_CAP_PER_SIDE);
        expect(registry.summonCount('enemy')).toBeLessThanOrEqual(SUMMON_CAP_PER_SIDE);
        checks += 2;
      }
      const restored = TemporaryRegistry.restore(registry.snapshot());
      expect(restored.snapshot()).toEqual(registry.snapshot());
      checks += 1;
    }
    expect(checks).toBeGreaterThan(2000);
  });
});

describe('P20 §5.4 batch commit', () => {
  it('commits a sorted batch atomically per request', () => {
    const registry = new TemporaryRegistry();
    const results = commitSummonBatch(registry, [
      req('summon_1', 'player', { requestSequence: 1 }),
      req('summon_0', 'player', { requestSequence: 0 }),
    ]);
    expect(results.map((r) => r.entityId)).toEqual(['summon_0', 'summon_1']);
    expect(registry.summonCount('player')).toBe(2);
  });
});
