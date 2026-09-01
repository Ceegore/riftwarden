import type { JsonValue } from '../../src/game/save/canonical-json.js';
import { payloadHash, type SaveEnvelope } from '../../src/game/save/save-envelope.js';
import { SaveError } from '../../src/game/save/save-error.js';
import type { CommitRequest, SaveFamily } from '../../src/game/save/native-save-store.js';
import {
  FileNativeSaveStore,
  type FaultStep,
  type FileSystemPort,
  type Slot,
} from '../../src/game/save/native-save-store.js';

export function envelope(commitId: number, payload: JsonValue): SaveEnvelope<JsonValue> {
  return Object.freeze({
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
  });
}

export function makeRequest(family: SaveFamily = 'profile', commitId = 1, payload: JsonValue = { v: 1 }): CommitRequest {
  return { family, reason: family === 'battle' ? 'battle_snapshot' : family, envelope: envelope(commitId, payload) };
}

export function catchCode(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof SaveError ? error.code : null;
  }
}

export async function catchAsync(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (error) {
    return error instanceof SaveError ? error.code : null;
  }
}

export class MemoryFileSystem implements FileSystemPort {
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

export function makeStore(stepFault?: FaultStep | null): { store: FileNativeSaveStore; fs: MemoryFileSystem } {
  const fs = new MemoryFileSystem();
  const store = new FileNativeSaveStore(fs, '/data', stepFault ? (step) => (step === stepFault ? 'IO_WRITE_FAILED' : null) : () => null);
  return { store, fs };
}
