import { describe, expect, it } from 'vitest';
import { LocalStorageSaveStore, type StorageLike } from '../../src/game/save/local-storage-save-store.js';

/** In-memory storage for tests (Node has no localStorage). */
function testStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem(key: string): string | null { return map.get(key) ?? null; },
    setItem(key: string, value: string): void { map.set(key, value); },
    removeItem(key: string): void { map.delete(key); },
  };
}
import { SaveService } from '../../src/game/save/save-service.js';
import { createExpedition } from '../../src/game/expedition/expedition-runner.js';
import { encodeExpeditionSave, restoreExpeditionSave } from '../../src/game/expedition/expedition-save.js';
import { generateMap } from '../../src/game/expedition/map-generator.js';
import type { ExpeditionMap, MapProfile } from '../../src/game/expedition/types.js';
import type { JsonValue } from '../../src/game/save/canonical-json.js';

const PROFILE: MapProfile = {
  id: 'save-int.v1',
  logicalLevels: 6,
  targetVisited: [5, 8] as const,
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'fallback.v1',
};

function mapFor(seed: number): ExpeditionMap {
  return generateMap({ seed, profileId: PROFILE.id, contentRevision: '32.0' }, PROFILE);
}

describe('phase32 save integration', () => {
  it('LocalStorageSaveStore round-trips an expedition through SaveService', async () => {
    const store = new LocalStorageSaveStore(testStorage());
    const service = new SaveService(store);

    // Create and encode the expedition.
    const map = mapFor(800);
    let runner = createExpedition(map, { startGold: 100 });
    runner = runner.enter('svc-enter').resolve();
    const serialized = encodeExpeditionSave(runner);

    // Commit through SaveService.
    const payload: JsonValue = { kind: 'expedition.save', version: 1, seed: map.seed, mapHash: map.mapHash, data: serialized };
    const result = await service.commit({ family: 'expedition', reason: 'decision_committed', idempotencyKey: 'test-1', payload });

    expect(result.family).toBe('expedition');
    expect(result.slot).toBe('A'); // First commit → slot A.
    expect(result.commitId).toBe(1);

    // Load back through the store.
    const envelope = await store.load('expedition');
    const loadedPayload = envelope.payload as { data: string; seed: number; mapHash: string };
    expect(loadedPayload.seed).toBe(map.seed);
    expect(loadedPayload.mapHash).toBe(map.mapHash);

    // Restore through the save codec.
    const restored = restoreExpeditionSave(loadedPayload.data, map);
    expect(restored.state.gold).toBe(runner.state.gold);
    expect(restored.currentNodeId).toBe(runner.currentNodeId);
  });

  it('LocalStorageSaveStore inspects slots correctly', async () => {
    const store = new LocalStorageSaveStore(testStorage());
    const inspection = await store.inspect('expedition');
    expect(inspection.activeSlot).toBe('C'); // Default before any commit.
    expect(inspection.commitId).toBe(-1);
  });

  it('SaveService rejects duplicate idempotency keys', async () => {
    const store = new LocalStorageSaveStore(testStorage());
    const service = new SaveService(store);
    const payload: JsonValue = { kind: 'test', version: 1 };

    await service.commit({ family: 'expedition', reason: 'decision_committed', idempotencyKey: 'dup-1', payload });
    await expect(
      service.commit({ family: 'expedition', reason: 'decision_committed', idempotencyKey: 'dup-1', payload }),
    ).rejects.toThrow('DUPLICATE_COMMIT');
  });

  it('LocalStorageSaveStore returns NO_VALID_SLOT for empty family', async () => {
    const store = new LocalStorageSaveStore(testStorage());
    await expect(store.load('expedition')).rejects.toThrow('NO_VALID_SLOT');
  });
});
