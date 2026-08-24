/**
 * LocalStorage-backed NativeSaveStore: implements the full NativeSaveStore
 * interface using a pluggable Storage-like backend (defaults to globalThis.
 * localStorage). Each SaveFamily gets a top-level key prefix; slots are
 * enumerated as sub-keys. The manifest is stored alongside.
 */
import { canonicalJson, type JsonValue } from './canonical-json.js';
import { payloadHash, validateEnvelope, type SaveEnvelope } from './save-envelope.js';
import { SaveError } from './save-error.js';
import type { CommitRequest, CommitResult, NativeSaveStore, SaveFamily, SaveManifest, Slot } from './native-save-store.js';
import { ALL_SLOTS, nextSlot, SLOT_ORDER } from './native-save-store.js';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const KEY_PREFIX = 'rw.save.';

function slotKey(family: SaveFamily, slot: Slot): string {
  return `${KEY_PREFIX}${family}.${slot}`;
}

function manifestKey(family: SaveFamily): string {
  return `${KEY_PREFIX}${family}.manifest`;
}

function readManifest(storage: StorageLike, family: SaveFamily): SaveManifest | null {
  try {
    const raw = storage.getItem(manifestKey(family));
    if (!raw) return null;
    const value = JSON.parse(raw) as Record<string, unknown>;
    const slot = value['activeSlot'] as Slot;
    if (!(ALL_SLOTS as readonly string[]).includes(slot)) return null;
    for (const key of ['commitId', 'schemaVersion', 'simulationVersion'] as const) {
      if (typeof value[key] !== 'number' || !Number.isSafeInteger(value[key]) || (value[key]) < 0) return null;
    }
    if (typeof value['contentVersion'] !== 'string' || typeof value['payloadSha256'] !== 'string') return null;
    return {
      activeSlot: slot,
      commitId: value['commitId'] as number,
      payloadSha256: value['payloadSha256'],
      schemaVersion: value['schemaVersion'] as number,
      simulationVersion: value['simulationVersion'] as number,
      contentVersion: value['contentVersion'],
    };
  } catch {
    return null;
  }
}

function writeManifest(storage: StorageLike, family: SaveFamily, manifest: SaveManifest): void {
  storage.setItem(manifestKey(family), canonicalJson(manifest));
}

function readSlot(storage: StorageLike, family: SaveFamily, slot: Slot): SaveEnvelope<JsonValue> | null {
  try {
    const raw = storage.getItem(slotKey(family, slot));
    if (!raw) return null;
    const value = JSON.parse(raw) as unknown;
    validateEnvelope(value);
    return value;
  } catch {
    return null;
  }
}

function writeSlot(storage: StorageLike, family: SaveFamily, slot: Slot, envelope: SaveEnvelope<JsonValue>): void {
  storage.setItem(slotKey(family, slot), canonicalJson(envelope));
}

export class LocalStorageSaveStore implements NativeSaveStore {
  private readonly storage: StorageLike;

  constructor(storage?: StorageLike) {
    this.storage = storage ?? globalThis.localStorage;
  }

  capabilities(): Promise<readonly string[]> {
    return Promise.resolve(['atomic_write']);
  }

  async load(family: SaveFamily): Promise<SaveEnvelope<JsonValue>> {
    await Promise.resolve();
    const manifest = readManifest(this.storage, family);
    if (manifest) {
      const active = readSlot(this.storage, family, manifest.activeSlot);
      if (active?.commitId === manifest.commitId) return active;
    }
    let best: { commitId: number; envelope: SaveEnvelope<JsonValue> } | null = null;
    for (const slot of ALL_SLOTS) {
      const candidate = readSlot(this.storage, family, slot);
      if (candidate && (!best || candidate.commitId > best.commitId)) {
        best = { commitId: candidate.commitId, envelope: candidate };
      }
    }
    if (!best) throw new SaveError('NO_VALID_SLOT', { family });
    return best.envelope;
  }

  async commit(request: CommitRequest): Promise<CommitResult> {
    await Promise.resolve();
    validateEnvelope(request.envelope);
    const manifest = readManifest(this.storage, request.family);
    const next = manifest ? nextSlot(manifest.activeSlot) : 'A';
    const hash = payloadHash(request.envelope.payload);

    writeSlot(this.storage, request.family, next, request.envelope);

    const newManifest: SaveManifest = {
      activeSlot: next,
      commitId: request.envelope.commitId,
      payloadSha256: hash,
      schemaVersion: request.envelope.schemaVersion,
      simulationVersion: request.envelope.simulationVersion,
      contentVersion: request.envelope.contentVersion,
    };
    writeManifest(this.storage, request.family, newManifest);

    return { family: request.family, slot: next, commitId: request.envelope.commitId, payloadSha256: hash };
  }

  async inspect(family: SaveFamily): Promise<Readonly<{ activeSlot: Slot; commitId: number; slots: readonly Slot[] }>> {
    await Promise.resolve();
    const manifest = readManifest(this.storage, family);
    const slots: Slot[] = [];
    for (const slot of ALL_SLOTS) {
      if (this.storage.getItem(slotKey(family, slot))) slots.push(slot);
    }
    return {
      activeSlot: manifest?.activeSlot ?? 'C',
      commitId: manifest?.commitId ?? -1,
      slots: slots.sort((a, b) => SLOT_ORDER[a] - SLOT_ORDER[b]),
    };
  }

  async cleanupOrphans(): Promise<readonly string[]> {
    await Promise.resolve();
    return [];
  }
}

