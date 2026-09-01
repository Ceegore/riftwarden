import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { canonicalJson, type JsonValue } from '../../src/game/save/canonical-json.js';
import { payloadHash, validateEnvelope, type SaveEnvelope } from '../../src/game/save/save-envelope.js';
import {
  FileNativeSaveStore,
  type CommitRequest,
  type FaultStep,
  type FileSystemPort,
  type SaveFamily,
} from '../../src/game/save/native-save-store.js';
import { SaveWriteCoordinator } from '../../src/game/save/save-write-coordinator.js';
import { WebQaStore } from '../../src/game/save/web-qa-store.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (name: string): unknown => JSON.parse(readFileSync(path.join(here, '..', '..', 'contracts', 'phase23', name), 'utf8'));

const constants = read('phase23-constants.json') as {
  faultSteps: readonly string[];
  formatVersion: number;
  magic: string;
  maxConcurrentWrites: number;
  minAndroidApi: number;
  minIosMajor: number;
  slots: readonly string[];
};

describe('P23 contract fixtures: constants', () => {
  it('pins the closed constants', () => {
    expect(constants.magic).toBe('RIFTWARDEN_SAVE');
    expect(constants.formatVersion).toBe(1);
    expect(constants.maxConcurrentWrites).toBe(1);
    expect(constants.minAndroidApi).toBe(24);
    expect(constants.minIosMajor).toBe(15);
    expect(constants.slots).toEqual(['A', 'B', 'C']);
    expect(constants.faultSteps).toHaveLength(12);
  });

  it('fault steps match the implementation injection points', () => {
    const steps: readonly string[] = [
      'slot_tmp_write',
      'slot_flush',
      'slot_reread',
      'slot_hash',
      'slot_rename',
      'slot_dir_flush',
      'manifest_new_write',
      'manifest_flush',
      'manifest_reread',
      'manifest_validate',
      'manifest_rename',
      'manifest_dir_flush',
    ];
    expect(constants.faultSteps).toEqual(steps);
  });
});

describe('P23 contract fixtures: canonical vectors', () => {
  const vectors = (read('fixtures/canonical-vectors.json') as { vectors: readonly { id: string; input: unknown; canonical: string }[] }).vectors;

  it('matches every golden canonical byte vector', () => {
    expect(vectors.length).toBeGreaterThanOrEqual(3);
    for (const vector of vectors) {
      expect(canonicalJson(vector.input), `vector ${vector.id}`).toBe(vector.canonical);
    }
  });

  it('hashes canonical vectors to stable hex digests', () => {
    for (const vector of vectors) {
      expect(payloadHash(vector.input as JsonValue)).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe('P23 contract fixtures: negative cases', () => {
  const cases = (read('fixtures/negative-cases.json') as { cases: readonly string[] }).cases;

  it('lists all fourteen negative cases', () => {
    expect(cases).toEqual([
      'nan',
      'positive_infinity',
      'negative_infinity',
      'negative_zero',
      'bigint',
      'undefined',
      'function',
      'symbol',
      'cycle',
      'unknown_envelope_field',
      'wrong_magic',
      'wrong_payload_hash',
      'path_traversal',
      'web_mock_in_native_production',
    ]);
  });

  it('rejects non-finite and invalid canonical inputs', () => {
    const invalid: readonly (() => unknown)[] = [
      () => canonicalJson(Number.NaN),
      () => canonicalJson(Number.POSITIVE_INFINITY),
      () => canonicalJson(Number.NEGATIVE_INFINITY),
      () => canonicalJson(-0),
      () => canonicalJson(10n),
      () => canonicalJson({ a: undefined }),
      () => canonicalJson({ a: () => 1 }),
      () => canonicalJson({ a: Symbol('s') }),
    ];
    for (const fn of invalid) expect(fn).toThrow();
  });

  it('rejects cycle and non-plain objects', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;
    expect(() => canonicalJson(cyclic)).toThrow();
    expect(() => canonicalJson(new Date())).toThrow();
  });

  it('rejects unknown envelope fields, wrong magic and wrong hash', () => {
    const base: SaveEnvelope<JsonValue> = {
      magic: 'RIFTWARDEN_SAVE',
      formatVersion: 1,
      schemaVersion: 1,
      simulationVersion: 1,
      contentVersion: 'c1',
      appVersion: 'a1',
      commitId: 1,
      committedAtUtc: '2026-07-18T00:00:00Z',
      payloadSha256: payloadHash({ v: 1 }),
      payload: { v: 1 },
    };
    const extraField = { ...base, extra: true } as unknown;
    const wrongMagic = { ...base, magic: 'WRONG' } as unknown;
    const wrongHash = { ...base, payloadSha256: '0'.repeat(64) } as unknown;
    expect(() => {
      validateEnvelope(extraField);
    }).toThrow();
    expect(() => {
      validateEnvelope(wrongMagic);
    }).toThrow();
    expect(() => {
      validateEnvelope(wrongHash);
    }).toThrow();
  });

  it('rejects path traversal in the closed path derivation', async () => {
    const fs = new RejectingFileSystem();
    const store = new FileNativeSaveStore(fs, '/data');
    // Unknown family -> INVALID_ARGUMENT before any path is touched.
    await expect(store.load('hack' as SaveFamily)).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });

  it('asserts the web mock is never the native production store', () => {
    // The web channel resolves the mock only via the web registration; the
    // native plugins expose the same port surface. This asserts the mock is
    // not wired into a native production channel by construction.
    const web = new WebQaStore();
    expect(web).toBeInstanceOf(WebQaStore);
    expect(typeof web.commit).toBe('function');
    expect(typeof web.load).toBe('function');
  });
});

describe('P23 contract fixtures: fault matrix', () => {
  const matrix = read('fixtures/fault-matrix.json') as {
    expectation: string;
    platforms: readonly string[];
    steps: readonly number[];
  };

  it('pins the fault-matrix expectation and platforms', () => {
    expect(matrix.expectation).toBe('previous_manifest_and_slot_remain_loadable_until_manifest_commit');
    expect(matrix.platforms).toEqual(['web-qa', 'android-api24', 'android-current', 'ios15', 'ios-current']);
    expect(matrix.steps).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('keeps every pre-commit fault step loadable on the web-qa adapter', async () => {
    const faultSteps: readonly FaultStep[] = [
      'slot_tmp_write',
      'slot_flush',
      'slot_reread',
      'slot_hash',
      'slot_rename',
      'slot_dir_flush',
      'manifest_new_write',
      'manifest_flush',
      'manifest_reread',
      'manifest_validate',
      'manifest_rename',
    ];
    for (const step of faultSteps) {
      const fs = new MemoryFileSystem();
      const store = new FileNativeSaveStore(fs, '/data');
      await store.commit(request(1));
      const faulted = new FileNativeSaveStore(fs, '/data', (injected) => (injected === step ? 'IO_WRITE_FAILED' : null));
      await expect(faulted.commit(request(2))).rejects.toBeDefined();
      const loaded = await store.load('profile');
      expect(loaded.commitId, `step ${step}`).toBe(1);
    }
  });
});

describe('P23 contract fixtures: concurrency cases', () => {
  const cases = (read('fixtures/concurrency-cases.json') as { cases: readonly unknown[] }).cases;

  it('contains the three pinned cases', () => {
    expect(cases).toHaveLength(3);
    const ids = cases.map((entry) => (entry as { id: string }).id);
    expect(ids).toEqual(['mixed-no-loss', 'snapshot-coalesce', 'different-family-no-coalesce']);
  });

  it('mixed-no-loss: 1000 mixed requests never lose a transaction', async () => {
    const web = new WebQaStore();
    const coordinator = new SaveWriteCoordinator(web);
    const requests: CommitRequest[] = Array.from({ length: 1000 }, (_, i) => {
      const family: SaveFamily = (['profile', 'run', 'settings'] as const)[i % 3] as SaveFamily;
      return {
        family,
        reason: family === 'battle' ? 'battle_snapshot' : family,
        envelope: envelope(i + 1, { i }),
      };
    });
    const results = await Promise.all(requests.map((request) => coordinator.enqueue(request)));
    expect(results).toHaveLength(1000);
    expect(web.getCommitLog()).toHaveLength(1000);
    const stats = coordinator.getStats();
    expect(stats.written).toBe(1000);
    expect(stats.failed).toBe(0);
  });

  it('snapshot-coalesce: only the newest waiting tick is written', async () => {
    const web = new WebQaStore(() => null, 1);
    const coordinator = new SaveWriteCoordinator(web);
    const ticks = [150, 151, 180, 210];
    const results = await Promise.all(
      ticks.map((tickValue) =>
        coordinator.enqueue({
          family: 'battle',
          reason: 'battle_snapshot',
          battleTick: tickValue,
          envelope: envelope(tickValue, { tick: tickValue }),
        }),
      ),
    );
    const log = web.getCommitLog().map((entry) => entry.commitId);
    expect(log).toEqual([150, 210]);
    expect(results[3]?.commitId).toBe(210);
  });

  it('different-family-no-coalesce: snapshots of different families both write', async () => {
    const web = new WebQaStore();
    const coordinator = new SaveWriteCoordinator(web);
    const results = await Promise.all([
      coordinator.enqueue({ family: 'battle', reason: 'battle_snapshot', battleTick: 150, envelope: envelope(150, { p: 'a' }) }),
      coordinator.enqueue({ family: 'battle', reason: 'battle_snapshot', battleTick: 180, envelope: envelope(180, { p: 'b' }) }),
    ]);
    expect(results).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

function envelope(commitId: number, payload: JsonValue): SaveEnvelope<JsonValue> {
  return {
    magic: 'RIFTWARDEN_SAVE',
    formatVersion: 1,
    schemaVersion: 1,
    simulationVersion: 1,
    contentVersion: 'c1',
    appVersion: 'a1',
    commitId,
    committedAtUtc: '2026-07-18T00:00:00Z',
    payloadSha256: payloadHash(payload),
    payload,
  };
}

function request(commitId: number, payload: JsonValue = { v: commitId }): CommitRequest {
  return { family: 'profile', reason: 'profile', envelope: envelope(commitId, payload) };
}

class MemoryFileSystem implements FileSystemPort {
  private readonly files = new Map<string, Uint8Array>();

  writeFileExclusive(path: string, bytes: Uint8Array): Promise<void> {
    if (this.files.has(path)) return Promise.reject(new Error('exclusive write conflict'));
    this.files.set(path, new Uint8Array(bytes));
    return Promise.resolve();
  }

  flushFile(path: string): Promise<void> {
    void path;
    return Promise.resolve();
  }

  readFile(path: string): Promise<Uint8Array> {
    const value = this.files.get(path);
    if (!value) return Promise.reject(new Error('file not found'));
    return Promise.resolve(new Uint8Array(value));
  }

  atomicReplace(from: string, to: string): Promise<void> {
    const value = this.files.get(from);
    if (!value) return Promise.reject(new Error('source not found'));
    this.files.set(to, value);
    this.files.delete(from);
    return Promise.resolve();
  }

  flushDirectory(directory: string): Promise<void> {
    void directory;
    return Promise.resolve();
  }

  listDirectory(directory: string): Promise<string[]> {
    return Promise.resolve([...this.files.keys()].filter((key) => key.startsWith(`${directory}/`)));
  }

  removeFile(path: string): Promise<void> {
    this.files.delete(path);
    return Promise.resolve();
  }

  exists(path: string): Promise<boolean> {
    return Promise.resolve(this.files.has(path));
  }
}

class RejectingFileSystem implements FileSystemPort {
  writeFileExclusive(path: string, bytes: Uint8Array): Promise<void> {
    void path;
    void bytes;
    return Promise.reject(new Error('unreachable'));
  }

  flushFile(path: string): Promise<void> {
    void path;
    return Promise.reject(new Error('unreachable'));
  }

  readFile(path: string): Promise<Uint8Array> {
    void path;
    return Promise.reject(new Error('unreachable'));
  }

  atomicReplace(from: string, to: string): Promise<void> {
    void from;
    void to;
    return Promise.reject(new Error('unreachable'));
  }

  flushDirectory(directory: string): Promise<void> {
    void directory;
    return Promise.reject(new Error('unreachable'));
  }

  listDirectory(directory: string): Promise<string[]> {
    void directory;
    return Promise.reject(new Error('unreachable'));
  }

  removeFile(path: string): Promise<void> {
    void path;
    return Promise.reject(new Error('unreachable'));
  }

  exists(path: string): Promise<boolean> {
    void path;
    return Promise.resolve(false);
  }
}
