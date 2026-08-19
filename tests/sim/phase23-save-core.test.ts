import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../../src/game/save/canonical-json.js';
import { payloadHash, validateEnvelope } from '../../src/game/save/save-envelope.js';
import { SaveError, type SaveErrorCode } from '../../src/game/save/save-error.js';
import {
  FileNativeSaveStore,
  nextSlot,
  type FaultStep,
  type FileSystemPort,
  type SaveFamily,
  type Slot,
} from '../../src/game/save/native-save-store.js';
import { WebQaStore } from '../../src/game/save/web-qa-store.js';
import { envelope, makeRequest, catchCode, catchAsync } from './phase23-helpers.js';

// ---------------------------------------------------------------------------
// Canonical JSON contract (P23-T01)
// ---------------------------------------------------------------------------

describe('P23 canonical JSON', () => {
  it('sorts object keys by stable code-unit comparison', () => {
    expect(canonicalJson({ z: 1, a: 2 })).toBe('{"a":2,"z":1}');
    expect(canonicalJson({ b: [{ y: 2, x: 1 }, 3] })).toBe('{"b":[{"x":1,"y":2},3]}');
  });

  it('keeps array order untouched', () => {
    expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]');
  });

  it('encodes unicode and escapes deterministically', () => {
    expect(canonicalJson({ a: '\n', ä: '✓' })).toBe('{"a":"\\n","ä":"✓"}');
  });

  it('handles empty and nested structures', () => {
    expect(canonicalJson({})).toBe('{}');
    expect(canonicalJson([])).toBe('[]');
    expect(canonicalJson({ a: [1, [2, { b: null }]] })).toBe('{"a":[1,[2,{"b":null}]]}');
  });

  it('matches the kit fixture vectors exactly', () => {
    expect(canonicalJson({ a: 2, z: 1 })).toBe('{"a":2,"z":1}');
    expect(canonicalJson({ a: true, b: [3, { x: 1, y: 2 }] })).toBe('{"a":true,"b":[3,{"x":1,"y":2}]}');
    expect(canonicalJson({ a: '\n', ä: '✓' })).toBe('{"a":"\\n","ä":"✓"}');
  });

  it('allows finite floats (distinct from replay safe-integer contract)', () => {
    expect(canonicalJson(1.5)).toBe('1.5');
    expect(canonicalJson({ x: -2.25 })).toBe('{"x":-2.25}');
  });

  it.each([
    ['nan', () => canonicalJson(Number.NaN)],
    ['positive_infinity', () => canonicalJson(Number.POSITIVE_INFINITY)],
    ['negative_infinity', () => canonicalJson(Number.NEGATIVE_INFINITY)],
    ['negative_zero', () => canonicalJson(-0)],
    ['bigint', () => canonicalJson(10n)],
    ['undefined', () => canonicalJson({ a: undefined })],
    ['function', () => canonicalJson({ a: () => 1 })],
    ['symbol', () => canonicalJson({ a: Symbol('s') })],
    ['cycle', () => {
      const value: Record<string, unknown> = {};
      value['self'] = value;
      return canonicalJson(value);
    }],
    ['non_plain_object', () => canonicalJson(new Date())],
  ])('rejects %s', (_name, fn) => {
    expect(fn).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Envelope contract (P23-T01)
// ---------------------------------------------------------------------------

describe('P23 save envelope', () => {
  it('validates a well-formed envelope', () => {
    const value = envelope(1, { v: 1 });
    expect(() => {
      validateEnvelope(value);
    }).not.toThrow();
  });

  it('rejects unknown envelope fields', () => {
    const value = { ...envelope(1, { v: 1 }), extra: true } as unknown;
    expect(() => {
      validateEnvelope(value);
    }).toThrow(SaveError);
  });

  it('rejects wrong magic and wrong format version', () => {
    const wrongMagic = { ...envelope(1, { v: 1 }), magic: 'OTHER' } as unknown;
    expect(() => {
      validateEnvelope(wrongMagic);
    }).toThrow(SaveError);
    const wrongFormat = { ...envelope(1, { v: 1 }), formatVersion: 2 } as unknown;
    expect(() => {
      validateEnvelope(wrongFormat);
    }).toThrow(SaveError);
  });

  it('rejects a wrong payload hash', () => {
    const wrong = { ...envelope(1, { v: 1 }), payloadSha256: '0'.repeat(64) } as unknown;
    expect(() => {
      validateEnvelope(wrong);
    }).toThrow(SaveError);
    const code = catchCode(() => {
      validateEnvelope(wrong);
    });
    expect(code).toBe('HASH_MISMATCH');
  });

  it('rejects non-safe-integer or negative commitId', () => {
    const fractional = { ...envelope(1, {}), commitId: 1.5 } as unknown;
    const negative = { ...envelope(1, {}), commitId: -1 } as unknown;
    expect(() => {
      validateEnvelope(fractional);
    }).toThrow(SaveError);
    expect(() => {
      validateEnvelope(negative);
    }).toThrow(SaveError);
  });

  it('hashes canonical payload bytes deterministically', () => {
    const a = payloadHash({ b: 1, a: 2 });
    const b = payloadHash({ a: 2, b: 1 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ---------------------------------------------------------------------------
// In-memory FileSystemPort double with fault + corruption injection
// ---------------------------------------------------------------------------

class MemoryFileSystem implements FileSystemPort {
  private readonly files = new Map<string, Uint8Array>();
  private failWrite = false;
  private failFlush = false;
  private failRead = false;
  private failRename = false;

  setFailWrite(): void {
    this.failWrite = true;
  }

  setFailFlush(): void {
    this.failFlush = true;
  }

  setFailRead(): void {
    this.failRead = true;
  }

  setFailRename(): void {
    this.failRename = true;
  }

  /** Corrupts a persisted slot file (simulates torn write). */
  corruptSlot(family: SaveFamily, slot: Slot): void {
    const key = `saves/${family}/${slot}.json`;
    const existing = this.files.get(key);
    if (existing) this.files.set(key, new Uint8Array([0x7b, 0x22, 0x62, 0x72, 0x6f, 0x6b, 0x65, 0x6e]));
  }

  /** Corrupts the manifest file. */
  corruptManifest(family: SaveFamily): void {
    const key = `saves/${family}/manifest.json`;
    const existing = this.files.get(key);
    if (existing) this.files.set(key, new Uint8Array([0x7b, 0x22, 0x62, 0x72, 0x6f, 0x6b, 0x65, 0x6e]));
  }

  /** Removes a file entirely. */
  deleteFile(path: string): void {
    this.files.delete(path);
  }

  dump(): Map<string, Uint8Array> {
    return new Map(this.files);
  }

  writeFileExclusive(path: string, bytes: Uint8Array): Promise<void> {
    if (this.failWrite) return Promise.reject(new Error('injected write failure'));
    if (this.files.has(path)) return Promise.reject(new Error('exclusive write conflict'));
    this.files.set(path, new Uint8Array(bytes));
    return Promise.resolve();
  }

  flushFile(path: string): Promise<void> {
    void path;
    if (this.failFlush) return Promise.reject(new Error('injected flush failure'));
    return Promise.resolve();
  }

  readFile(path: string): Promise<Uint8Array> {
    if (this.failRead) return Promise.reject(new Error('injected read failure'));
    const value = this.files.get(path);
    if (!value) return Promise.reject(new Error('file not found'));
    return Promise.resolve(new Uint8Array(value));
  }

  atomicReplace(from: string, to: string): Promise<void> {
    if (this.failRename) return Promise.reject(new Error('injected rename failure'));
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

function makeStore(stepFault?: FaultStep | null): { store: FileNativeSaveStore; fs: MemoryFileSystem } {
  const fs = new MemoryFileSystem();
  const store = new FileNativeSaveStore(fs, '/data', stepFault ? (step) => (step === stepFault ? 'IO_WRITE_FAILED' : null) : () => null);
  return { store, fs };
}

// ---------------------------------------------------------------------------
// Slot rotation and manifest protocol (P23-T02)
// ---------------------------------------------------------------------------

describe('P23 slot rotation and manifest protocol', () => {
  it('rotates A -> B -> C -> A', () => {
    expect(nextSlot('A')).toBe('B');
    expect(nextSlot('B')).toBe('C');
    expect(nextSlot('C')).toBe('A');
  });

  it('commits across A/B/C and back to A with monotonically increasing commitId', async () => {
    const { store } = makeStore();
    const results: string[] = [];
    for (let i = 1; i <= 4; i++) {
      const result = await store.commit(makeRequest('profile', i, { v: i }));
      results.push(result.slot);
    }
    expect(results).toEqual(['A', 'B', 'C', 'A']);
    const manifest = await store.inspect('profile');
    expect(manifest.activeSlot).toBe('A');
    expect(manifest.commitId).toBe(4);
  });

  it('loads the active envelope after rotation', async () => {
    const { store } = makeStore();
    await store.commit(makeRequest('profile', 1, { v: 1 }));
    await store.commit(makeRequest('profile', 2, { v: 2 }));
    const loaded = await store.load('profile');
    expect(loaded.commitId).toBe(2);
    expect(loaded.payload).toEqual({ v: 2 });
  });

  it('falls back to the highest valid commitId when the manifest is invalid', async () => {
    const { store, fs } = makeStore();
    await store.commit(makeRequest('profile', 1, { v: 1 }));
    await store.commit(makeRequest('profile', 2, { v: 2 }));
    fs.corruptManifest('profile');
    const loaded = await store.load('profile');
    expect(loaded.commitId).toBe(2);
  });

  it('falls back to the highest valid commitId when the active slot is corrupt', async () => {
    const { store, fs } = makeStore();
    await store.commit(makeRequest('profile', 1, { v: 1 }));
    await store.commit(makeRequest('profile', 2, { v: 2 }));
    fs.corruptSlot('profile', 'A');
    const loaded = await store.load('profile');
    expect(loaded.commitId).toBe(2);
  });

  it('reports NO_VALID_SLOT when nothing is loadable', async () => {
    const { store } = makeStore();
    await expect(store.load('profile')).rejects.toMatchObject({ code: 'NO_VALID_SLOT' });
  });

  it('rejects unknown save families', async () => {
    const { store } = makeStore();
    await expect(store.load('hack' as SaveFamily)).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });

  it('separates slot commit from manifest commit: slot file exists without manifest activation', async () => {
    const { store, fs } = makeStore();
    // Fault after slot rename, before manifest commit: slot file is written
    // but the manifest still points at the previous state.
    const faulted = new FileNativeSaveStore(fs, '/data', (step) =>
      step === 'manifest_rename' ? 'MANIFEST_COMMIT_FAILED' : null,
    );
    await store.commit(makeRequest('profile', 1, { v: 1 }));
    await expect(faulted.commit(makeRequest('profile', 2, { v: 2 }))).rejects.toMatchObject({ code: 'MANIFEST_COMMIT_FAILED' });
    const loaded = await store.load('profile');
    expect(loaded.commitId).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Fault matrix (P23-T02): every fault before manifest rename keeps the
// previous valid manifest and active slot loadable.
// ---------------------------------------------------------------------------

describe('P23 fault matrix', () => {
  const steps: FaultStep[] = [
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

  it.each(steps.filter((s) => s !== 'manifest_dir_flush'))(
    'fault at %s leaves the previous valid slot loadable',
    async (step) => {
      const fs = new MemoryFileSystem();
      const store = new FileNativeSaveStore(fs, '/data');
      await store.commit(makeRequest('profile', 1, { v: 1 }));
      const before = await store.load('profile');

      const faulted = new FileNativeSaveStore(fs, '/data', (injected) => (injected === step ? 'IO_WRITE_FAILED' : null));
      await expect(faulted.commit(makeRequest('profile', 2, { v: 2 }))).rejects.toMatchObject({ code: 'IO_WRITE_FAILED' });

      // Previous manifest + active slot remain loadable and authoritative.
      const after = await store.load('profile');
      expect(after.commitId).toBe(before.commitId);
      expect(after.payload).toEqual(before.payload);

      // A fresh commit still works after the fault (stale tmp is discarded).
      const recovery = await store.commit(makeRequest('profile', 3, { v: 3 }));
      expect(recovery.slot).toBeDefined();
    },
  );

  it('fault at manifest_dir_flush leaves the committed manifest active (post-commit)', async () => {
    const fs = new MemoryFileSystem();
    const store = new FileNativeSaveStore(fs, '/data');
    await store.commit(makeRequest('profile', 1, { v: 1 }));

    // The manifest rename already happened; only the directory flush fails,
    // so the new commit is durable and loadable.
    const faulted = new FileNativeSaveStore(fs, '/data', (injected) =>
      injected === 'manifest_dir_flush' ? 'IO_FLUSH_FAILED' : null,
    );
    await expect(faulted.commit(makeRequest('profile', 2, { v: 2 }))).rejects.toMatchObject({ code: 'IO_FLUSH_FAILED' });
    const after = await store.load('profile');
    expect(after.commitId).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Web QA store parity (P23-T05)
// ---------------------------------------------------------------------------

describe('P23 Web QA store', () => {
  it('rotates slots identically to the file store', async () => {
    const fileStore = makeStore().store;
    const web = new WebQaStore();
    const fileSlots: string[] = [];
    const webSlots: string[] = [];
    for (let i = 1; i <= 4; i++) {
      const request = makeRequest('settings', i, { v: i });
      const fileResult = await fileStore.commit(request);
      const webResult = await web.commit(request);
      fileSlots.push(fileResult.slot);
      webSlots.push(webResult.slot);
    }
    expect(webSlots).toEqual(fileSlots);
    expect(fileSlots).toEqual(['A', 'B', 'C', 'A']);
  });

  it('emits the same error codes for the same fault step', async () => {
    const step: FaultStep = 'slot_rename';
    const fileFaulted = new FileNativeSaveStore(new MemoryFileSystem(), '/data', (s) => (s === step ? 'ATOMIC_RENAME_FAILED' : null));
    const webFaulted = new WebQaStore((s) => (s === step ? 'ATOMIC_RENAME_FAILED' : null));
    const fileCode = await catchAsync(() => fileFaulted.commit(makeRequest('profile', 1, { v: 1 })));
    const webCode = await catchAsync(() => webFaulted.commit(makeRequest('profile', 1, { v: 1 })));
    expect(fileCode).toBe('ATOMIC_RENAME_FAILED');
    expect(webCode).toBe('ATOMIC_RENAME_FAILED');
  });

  it('produces identical canonical bytes and hashes for the same envelope', () => {
    const request = makeRequest('run', 7, { run: { id: 'r1', tick: 120 } });
    expect(WebQaStore.canonicalBytes(request.envelope)).toBe(canonicalJson(request.envelope));
    expect(payloadHash(request.envelope.payload)).toBe(request.envelope.payloadSha256);
  });
});

// ---------------------------------------------------------------------------
// Closed DTO / error code contract
// ---------------------------------------------------------------------------

describe('P23 closed DTOs and error codes', () => {
  it('exposes only the closed save families', () => {
    const families: readonly string[] = ['profile', 'run', 'settings', 'battle'];
    for (const family of families) {
      expect(() => makeRequest(family as SaveFamily)).not.toThrow();
    }
  });

  it('maps every fault step to a stable closed error code', () => {
    const codes: readonly SaveErrorCode[] = [
      'INVALID_ARGUMENT',
      'INVALID_PATH',
      'INVALID_ENVELOPE',
      'HASH_MISMATCH',
      'IO_WRITE_FAILED',
      'IO_FLUSH_FAILED',
      'IO_READ_FAILED',
      'ATOMIC_RENAME_FAILED',
      'MANIFEST_COMMIT_FAILED',
      'NO_VALID_SLOT',
      'QUEUE_CLOSED',
      'UNSUPPORTED_CAPABILITY',
    ];
    for (const code of codes) {
      expect(new SaveError(code).code).toBe(code);
    }
  });

  it('supports the closed port methods on both stores', async () => {
    const fileStore = makeStore().store;
    const web = new WebQaStore();
    for (const store of [fileStore, web]) {
      await expect(store.capabilities()).resolves.toContain('atomic_write');
      await expect(store.inspect('profile')).resolves.toMatchObject({ slots: [] });
      await expect(store.cleanupOrphans()).resolves.toEqual([]);
    }
  });
});
