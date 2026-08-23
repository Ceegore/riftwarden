import { canonicalJson, type JsonValue } from './canonical-json.js';
import { payloadHash, validateEnvelope, type SaveEnvelope } from './save-envelope.js';
import { SaveError, type SaveErrorCode } from './save-error.js';

export type SaveFamily = 'profile' | 'run' | 'settings' | 'battle' | 'expedition';
export type Slot = 'A' | 'B' | 'C';

/** Fault-injectable points of the slot+manifest commit protocol (P23-T02). */
export type FaultStep =
  | 'slot_tmp_write'
  | 'slot_flush'
  | 'slot_reread'
  | 'slot_hash'
  | 'slot_rename'
  | 'slot_dir_flush'
  | 'manifest_new_write'
  | 'manifest_flush'
  | 'manifest_reread'
  | 'manifest_validate'
  | 'manifest_rename'
  | 'manifest_dir_flush';

export interface CommitRequest {
  readonly family: SaveFamily;
  readonly envelope: SaveEnvelope<JsonValue>;
  readonly reason: string;
  readonly battleTick?: number;
}

export interface CommitResult {
  readonly family: SaveFamily;
  readonly slot: Slot;
  readonly commitId: number;
  readonly payloadSha256: string;
}

export interface SaveManifest {
  readonly activeSlot: Slot;
  readonly commitId: number;
  readonly payloadSha256: string;
  readonly schemaVersion: number;
  readonly simulationVersion: number;
  readonly contentVersion: string;
}

/** Platform abstraction for the storage kernel; adapters implement this. */
export interface FileSystemPort {
  writeFileExclusive(path: string, bytes: Uint8Array): Promise<void>;
  flushFile(path: string): Promise<void>;
  readFile(path: string): Promise<Uint8Array>;
  atomicReplace(from: string, to: string): Promise<void>;
  flushDirectory(directory: string): Promise<void>;
  listDirectory(directory: string): Promise<string[]>;
  removeFile(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

/** Closed NativeSaveStore port (NATIVE_SAVE_STORE_PORT). */
export interface NativeSaveStore {
  capabilities(): Promise<readonly string[]>;
  load(family: SaveFamily): Promise<SaveEnvelope<JsonValue>>;
  commit(request: CommitRequest): Promise<CommitResult>;
  inspect(family: SaveFamily): Promise<Readonly<{ activeSlot: Slot; commitId: number; slots: readonly Slot[] }>>;
  cleanupOrphans(): Promise<readonly string[]>;
}

export type FaultInjector = (step: FaultStep) => SaveErrorCode | null;

export function nextSlot(slot: Slot): Slot {
  return slot === 'A' ? 'B' : slot === 'B' ? 'C' : 'A';
}

export const ALL_SLOTS: readonly Slot[] = ['A', 'B', 'C'] as const;
export const SLOT_ORDER: Readonly<Record<Slot, number>> = { A: 0, B: 1, C: 2 };

const FAMILY_IDS: readonly SaveFamily[] = ['profile', 'run', 'settings', 'battle', 'expedition'] as const;

function assertFamily(family: string): asserts family is SaveFamily {
  if (!(FAMILY_IDS as readonly string[]).includes(family)) throw new SaveError('INVALID_ARGUMENT', { family });
}

/** Closed path derivation: SaveFamily -> stable relative path segments. */
export function familyDirectory(family: SaveFamily): string {
  return `saves/${family}`;
}

export function slotFileName(slot: Slot): string {
  return `${slot}.json`;
}

export function slotTmpFileName(slot: Slot): string {
  return `${slot}.json.tmp`;
}

export function manifestFileName(): string {
  return 'manifest.json';
}

export function manifestNewFileName(): string {
  return 'manifest.json.new';
}

export function serializeManifest(manifest: SaveManifest): Uint8Array {
  return new TextEncoder().encode(canonicalJson(manifest));
}

export function parseManifest(bytes: Uint8Array): SaveManifest {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new SaveError('INVALID_ENVELOPE');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SaveError('INVALID_ENVELOPE');
  const record = value as Record<string, unknown>;
  const slot = record['activeSlot'] as Slot;
  if (!(ALL_SLOTS as readonly string[]).includes(slot)) throw new SaveError('INVALID_ENVELOPE');
  for (const key of ['commitId', 'schemaVersion', 'simulationVersion'] as const) {
    if (typeof record[key] !== 'number' || !Number.isSafeInteger(record[key]) || record[key] < 0) {
      throw new SaveError('INVALID_ENVELOPE');
    }
  }
  if (typeof record['payloadSha256'] !== 'string' || typeof record['contentVersion'] !== 'string') {
    throw new SaveError('INVALID_ENVELOPE');
  }
  return {
    activeSlot: slot,
    commitId: record['commitId'] as number,
    payloadSha256: record['payloadSha256'],
    schemaVersion: record['schemaVersion'] as number,
    simulationVersion: record['simulationVersion'] as number,
    contentVersion: record['contentVersion'],
  };
}

/**
 * File-backed NativeSaveStore implementing the twelve-step atomic commit
 * protocol. Each step is fault-injectable; any injected error before the
 * manifest rename leaves the previous valid manifest and its active slot
 * loadable. The manifest never points at an incomplete slot.
 */
export class FileNativeSaveStore implements NativeSaveStore {
  private readonly root: string;

  constructor(
    private readonly fs: FileSystemPort,
    root: string,
    private readonly injectFault: FaultInjector = () => null,
  ) {
    this.root = root.replace(/\/+$/, '');
  }

  capabilities(): Promise<readonly string[]> {
    return Promise.resolve(['atomic_write', 'durable_flush', 'slot_rotation']);
  }

  private async readManifest(family: SaveFamily): Promise<SaveManifest | null> {
    const path = `${this.root}/${familyDirectory(family)}/${manifestFileName()}`;
    if (!(await this.fs.exists(path))) return null;
    try {
      return parseManifest(await this.fs.readFile(path));
    } catch {
      return null;
    }
  }

  private async readSlotValidated(family: SaveFamily, slot: Slot, manifest: SaveManifest): Promise<SaveEnvelope<JsonValue> | null> {
    const path = `${this.root}/${familyDirectory(family)}/${slotFileName(slot)}`;
    if (!(await this.fs.exists(path))) return null;
    let bytes: Uint8Array;
    try {
      bytes = await this.fs.readFile(path);
    } catch {
      return null;
    }
    let value: unknown;
    try {
      value = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return null;
    }
    try {
      validateEnvelope(value);
    } catch {
      return null;
    }
    const envelope = value;
    if (envelope.commitId !== manifest.commitId || envelope.payloadSha256 !== manifest.payloadSha256) return null;
    return envelope;
  }

  /**
   * Loads the active envelope. Manifest is authoritative; on invalid manifest
   * or active slot the loader falls back to the highest valid commitId across
   * slots (explicit commitId-based fallback, never timestamp).
   */
  async load(family: SaveFamily): Promise<SaveEnvelope<JsonValue>> {
    assertFamily(family);
    const manifest = await this.readManifest(family);
    if (manifest) {
      const active = await this.readSlotValidated(family, manifest.activeSlot, manifest);
      if (active) return active;
    }
    const directory = `${this.root}/${familyDirectory(family)}`;
    if (!(await this.fs.exists(directory))) throw new SaveError('NO_VALID_SLOT', { family });
    let entries: string[];
    try {
      entries = await this.fs.listDirectory(directory);
    } catch {
      throw new SaveError('IO_READ_FAILED', { family });
    }
    let best: { commitId: number; envelope: SaveEnvelope<JsonValue> } | null = null;
    for (const entry of entries) {
      const slot = entry.slice(0, 1) as Slot;
      if (!(ALL_SLOTS as readonly string[]).includes(slot) || !entry.endsWith('.json') || entry.endsWith('.tmp')) continue;
      const candidate = await this.readSlotRaw(family, slot);
      if (!candidate) continue;
      if (!best || candidate.commitId > best.commitId) best = { commitId: candidate.commitId, envelope: candidate };
    }
    if (!best) throw new SaveError('NO_VALID_SLOT', { family });
    return best.envelope;
  }

  private async readSlotRaw(family: SaveFamily, slot: Slot): Promise<SaveEnvelope<JsonValue> | null> {
    const path = `${this.root}/${familyDirectory(family)}/${slotFileName(slot)}`;
    if (!(await this.fs.exists(path))) return null;
    let value: unknown;
    try {
      value = JSON.parse(new TextDecoder().decode(await this.fs.readFile(path)));
    } catch {
      return null;
    }
    try {
      validateEnvelope(value);
    } catch {
      return null;
    }
    return value;
  }

  async inspect(family: SaveFamily): Promise<Readonly<{ activeSlot: Slot; commitId: number; slots: readonly Slot[] }>> {
    assertFamily(family);
    const manifest = await this.readManifest(family);
    const directory = `${this.root}/${familyDirectory(family)}`;
    const slots: Slot[] = [];
    if (await this.fs.exists(directory)) {
      for (const entry of await this.fs.listDirectory(directory)) {
        const slot = entry.slice(0, 1) as Slot;
        if ((ALL_SLOTS as readonly string[]).includes(slot) && entry.endsWith('.json') && !entry.endsWith('.tmp')) {
          if (!slots.includes(slot)) slots.push(slot);
        }
      }
    }
    return {
      activeSlot: manifest?.activeSlot ?? 'C',
      commitId: manifest?.commitId ?? -1,
      slots: slots.sort((a, b) => SLOT_ORDER[a] - SLOT_ORDER[b]),
    };
  }

  /**
   * Twelve-step atomic commit. Steps 1-6 write and verify the slot file,
   * steps 7-12 commit the manifest. Resolution is reported to the caller only
   * after the manifest rename (step 11) and directory flush (step 12).
   */
  async commit(request: CommitRequest): Promise<CommitResult> {
    assertFamily(request.family);
    validateEnvelope(request.envelope);
    const family = request.family;
    const directory = `${this.root}/${familyDirectory(family)}`;

    // Step 1: determine next slot cyclically from the current active slot.
    const current = await this.readManifest(family);
    const next = current ? nextSlot(current.activeSlot) : 'A';
    const tmpPath = `${directory}/${slotTmpFileName(next)}`;
    const finalPath = `${directory}/${slotFileName(next)}`;

    const canonicalBytes = new TextEncoder().encode(canonicalJson(request.envelope));
    const hash = payloadHash(request.envelope.payload);

    // Step 2: write the slot exclusively to <slot>.tmp. A stale tmp left by
    // a previously faulted/crashed commit is safe to discard first (orphans
    // are never authoritative and must not block later commits).
    await this.fault('slot_tmp_write');
    if (await this.fs.exists(tmpPath)) {
      try {
        await this.fs.removeFile(tmpPath);
      } catch {
        // Best effort; the exclusive write below still validates the result.
      }
    }
    try {
      await this.fs.writeFileExclusive(tmpPath, canonicalBytes);
    } catch {
      throw new SaveError('IO_WRITE_FAILED', { family, slot: next });
    }
    // Step 3: flush/fsync the file.
    await this.fault('slot_flush');
    try {
      await this.fs.flushFile(tmpPath);
    } catch {
      throw new SaveError('IO_FLUSH_FAILED', { family, slot: next });
    }
    // Step 4: reread the tmp fully.
    await this.fault('slot_reread');
    let reread: Uint8Array;
    try {
      reread = await this.fs.readFile(tmpPath);
    } catch {
      throw new SaveError('IO_READ_FAILED', { family, slot: next });
    }
    // Step 5: validate canonical bytes, envelope and payload hash.
    await this.fault('slot_hash');
    try {
      validateEnvelope(JSON.parse(new TextDecoder().decode(reread)));
    } catch {
      throw new SaveError('HASH_MISMATCH', { family, slot: next });
    }
    if (new TextDecoder().decode(reread) !== new TextDecoder().decode(canonicalBytes)) {
      throw new SaveError('HASH_MISMATCH', { family, slot: next });
    }
    // Step 6: atomically rename tmp onto the final slot.
    await this.fault('slot_rename');
    try {
      await this.fs.atomicReplace(tmpPath, finalPath);
    } catch {
      throw new SaveError('ATOMIC_RENAME_FAILED', { family, slot: next });
    }
    // Step 7: flush directory metadata where the platform supports it.
    await this.fault('slot_dir_flush');
    try {
      await this.fs.flushDirectory(directory);
    } catch {
      // Best effort only for the slot phase.
    }

    const manifest: SaveManifest = {
      activeSlot: next,
      commitId: request.envelope.commitId,
      payloadSha256: hash,
      schemaVersion: request.envelope.schemaVersion,
      simulationVersion: request.envelope.simulationVersion,
      contentVersion: request.envelope.contentVersion,
    };
    const manifestPath = `${directory}/${manifestFileName()}`;
    const manifestNewPath = `${directory}/${manifestNewFileName()}`;

    // Step 8: write manifest.new and flush. A stale manifest.new from a
    // faulted commit is safe to discard first.
    await this.fault('manifest_new_write');
    if (await this.fs.exists(manifestNewPath)) {
      try {
        await this.fs.removeFile(manifestNewPath);
      } catch {
        // Best effort.
      }
    }
    try {
      await this.fs.writeFileExclusive(manifestNewPath, serializeManifest(manifest));
    } catch {
      throw new SaveError('IO_WRITE_FAILED', { family, step: 'manifest_new' });
    }
    await this.fault('manifest_flush');
    try {
      await this.fs.flushFile(manifestNewPath);
    } catch {
      throw new SaveError('IO_FLUSH_FAILED', { family, step: 'manifest_new' });
    }
    // Step 9: reread and validate the manifest.
    await this.fault('manifest_reread');
    let manifestBytes: Uint8Array;
    try {
      manifestBytes = await this.fs.readFile(manifestNewPath);
    } catch {
      throw new SaveError('IO_READ_FAILED', { family, step: 'manifest_new' });
    }
    await this.fault('manifest_validate');
    const parsed = parseManifest(manifestBytes);
    if (parsed.activeSlot !== next || parsed.commitId !== manifest.commitId || parsed.payloadSha256 !== hash) {
      throw new SaveError('MANIFEST_COMMIT_FAILED', { family });
    }
    // Step 10: atomically commit manifest.new to manifest.json.
    await this.fault('manifest_rename');
    try {
      await this.fs.atomicReplace(manifestNewPath, manifestPath);
    } catch {
      throw new SaveError('MANIFEST_COMMIT_FAILED', { family });
    }
    // Step 11: directory flush (best effort where unsupported).
    await this.fault('manifest_dir_flush');
    try {
      await this.fs.flushDirectory(directory);
    } catch {
      // Best effort.
    }

    return { family, slot: next, commitId: request.envelope.commitId, payloadSha256: hash };
  }

  async cleanupOrphans(): Promise<readonly string[]> {
    const removed: string[] = [];
    for (const family of FAMILY_IDS) {
      const directory = `${this.root}/${familyDirectory(family)}`;
      if (!(await this.fs.exists(directory))) continue;
      let entries: string[];
      try {
        entries = await this.fs.listDirectory(directory);
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (entry.endsWith('.tmp') || entry.endsWith('.new')) {
          const path = `${directory}/${entry}`;
          try {
            await this.fs.removeFile(path);
            removed.push(path);
          } catch {
            // Orphan cleanup is best effort.
          }
        }
      }
    }
    return removed;
  }

  private fault(step: FaultStep): Promise<void> {
    const code = this.injectFault(step);
    if (code) return Promise.reject(new SaveError(code, { step }));
    return Promise.resolve();
  }
}
