import { canonicalJson, type JsonValue } from './canonical-json.js';
import { payloadHash, validateEnvelope, type SaveEnvelope } from './save-envelope.js';
import {
  ALL_SLOTS,
  nextSlot,
  type CommitRequest,
  type CommitResult,
  type FaultStep,
  type NativeSaveStore,
  type SaveFamily,
  type SaveManifest,
  type Slot,
} from './native-save-store.js';
import { SaveError, type SaveErrorCode } from './save-error.js';

const FAMILY_IDS: readonly SaveFamily[] = ['profile', 'run', 'settings', 'battle'] as const;

function assertFamily(family: string): asserts family is SaveFamily {
  if (!(FAMILY_IDS as readonly string[]).includes(family)) throw new SaveError('INVALID_ARGUMENT', { family });
}

interface SlotRecord {
  readonly envelope: SaveEnvelope<JsonValue>;
  readonly manifest: SaveManifest;
}

/**
 * In-memory QA/development store emulating slots, manifest, fault steps,
 * delay and stable error codes. It must never be selected in the native
 * production channel (P23-T05; asserted by tests and the readiness gate).
 */
export class WebQaStore implements NativeSaveStore {
  private readonly records = new Map<string, SlotRecord>();
  private readonly active = new Map<SaveFamily, Slot>();
  private readonly commitLog: CommitResult[] = [];

  constructor(
    private readonly injectFault: (step: FaultStep) => SaveErrorCode | null = () => null,
    private readonly delayMillis = 0,
  ) {}

  capabilities(): Promise<readonly string[]> {
    return Promise.resolve(['atomic_write', 'durable_flush', 'slot_rotation']);
  }

  load(family: SaveFamily): Promise<SaveEnvelope<JsonValue>> {
    assertFamily(family);
    const slot = this.active.get(family);
    const record = slot ? this.records.get(`${family}/${slot}`) : undefined;
    if (!record) throw new SaveError('NO_VALID_SLOT', { family });
    return Promise.resolve(structuredClone(record.envelope));
  }

  inspect(family: SaveFamily): Promise<Readonly<{ activeSlot: Slot; commitId: number; slots: readonly Slot[] }>> {
    assertFamily(family);
    const active = this.active.get(family) ?? 'C';
    const record = this.records.get(`${family}/${active}`);
    const slots = ALL_SLOTS.filter((slot) => this.records.has(`${family}/${slot}`));
    return Promise.resolve({ activeSlot: active, commitId: record?.manifest.commitId ?? -1, slots });
  }

  async commit(request: CommitRequest): Promise<CommitResult> {
    assertFamily(request.family);
    validateEnvelope(request.envelope);
    await this.delay();
    const family = request.family;
    const current = this.active.get(family) ?? 'C';
    const next = nextSlot(current);

    await this.fault('slot_tmp_write');
    const manifest: SaveManifest = {
      activeSlot: next,
      commitId: request.envelope.commitId,
      payloadSha256: payloadHash(request.envelope.payload),
      schemaVersion: request.envelope.schemaVersion,
      simulationVersion: request.envelope.simulationVersion,
      contentVersion: request.envelope.contentVersion,
    };
    this.records.set(`${family}/${next}`, { envelope: structuredClone(request.envelope), manifest });
    await this.fault('slot_flush');
    await this.fault('slot_reread');
    await this.fault('slot_hash');
    await this.fault('slot_rename');
    await this.fault('slot_dir_flush');
    await this.fault('manifest_new_write');
    await this.fault('manifest_flush');
    await this.fault('manifest_reread');
    await this.fault('manifest_validate');
    await this.fault('manifest_rename');
    this.active.set(family, next);
    await this.fault('manifest_dir_flush');

    const result: CommitResult = {
      family,
      slot: next,
      commitId: request.envelope.commitId,
      payloadSha256: manifest.payloadSha256,
    };
    this.commitLog.push(result);
    return result;
  }

  cleanupOrphans(): Promise<readonly string[]> {
    return Promise.resolve([]);
  }

  /** QA observation surface (not part of the NativeSaveStore port). */
  getCommitLog(): readonly CommitResult[] {
    return this.commitLog;
  }

  /** Canonical byte string of an envelope, for cross-adapter parity checks. */
  static canonicalBytes(envelope: SaveEnvelope<JsonValue>): string {
    return canonicalJson(envelope);
  }

  private fault(step: FaultStep): Promise<void> {
    const code = this.injectFault(step);
    if (code) return Promise.reject(new SaveError(code, { step }));
    return Promise.resolve();
  }

  private async delay(): Promise<void> {
    if (this.delayMillis > 0) await new Promise((resolve) => setTimeout(resolve, this.delayMillis));
  }
}
