import { WebPlugin } from '@capacitor/core';
import { canonicalJson, type JsonValue } from '../../game/save/canonical-json.js';
import { payloadHash, validateEnvelope, type SaveEnvelope } from '../../game/save/save-envelope.js';
import { familyDirectory } from '../../game/save/native-save-store.js';
import { SaveError } from '../../game/save/save-error.js';
import { WebQaStore } from '../../game/save/web-qa-store.js';
import type {
  BridgeInfo,
  GameAudioSessionPlugin,
  NativeSaveEnvelopePayload,
  NativeSaveInspectResult,
  NativeSaveLoadResult,
  NativeSaveReadOptions,
  NativeSaveReadResult,
  NativeSaveStorePlugin,
  NativeSaveWriteOptions,
  NativeSaveWriteResult,
  SaveTransferPlugin,
} from './contracts';

function info(plugin: BridgeInfo['plugin'], capabilities: readonly string[]): BridgeInfo {
  return {
    plugin,
    bridgeVersion: 1,
    platform: 'web',
    availability: 'unavailable',
    implementation: 'skeleton',
    capabilities,
  };
}

async function skeletonReject(plugin: string, phase: string): Promise<never> {
  await Promise.resolve();
  throw new Error(`${plugin} is implemented in Phase ${phase}.`);
}

const FAMILY_IDS = ['profile', 'run', 'settings', 'battle'] as const;

function parseEnvelope(utf8: string): SaveEnvelope<JsonValue> {
  const value = JSON.parse(utf8) as unknown;
  validateEnvelope(value);
  return value;
}

function familyFromPath(relativePath: string): 'profile' | 'run' | 'settings' | 'battle' {
  // Closed path derivation only: saves/<family>/<slot>.json (or manifest.json).
  const segments = relativePath.split('/');
  if (segments.length !== 3 || segments[0] !== 'saves') throw new SaveError('INVALID_PATH', { path: relativePath });
  const family = segments[1] as (typeof FAMILY_IDS)[number];
  if (!(FAMILY_IDS as readonly string[]).includes(family)) throw new SaveError('INVALID_PATH', { path: relativePath });
  if (segments[2] !== 'manifest.json' && !/^[ABC]\.json$/.test(segments[2] ?? '')) {
    throw new SaveError('INVALID_PATH', { path: relativePath });
  }
  if (familyDirectory(family) !== `saves/${family}`) throw new SaveError('INVALID_PATH', { path: relativePath });
  return family;
}

export class NativeSaveStoreWeb extends WebPlugin implements NativeSaveStorePlugin {
  private readonly store = new WebQaStore();

  // eslint-disable-next-line @typescript-eslint/require-await
  async getBridgeInfo(): Promise<BridgeInfo> {
    return info('NativeSaveStore', ['atomic_write', 'durable_flush', 'slot_rotation']);
  }

  /** Web channel reads only closed save paths derived from the port. */
  async read(options: NativeSaveReadOptions): Promise<NativeSaveReadResult> {
    const family = familyFromPath(options.relativePath);
    const envelope = await this.store.load(family);
    return { utf8: canonicalJson(envelope) };
  }

  async writeAtomic(options: NativeSaveWriteOptions): Promise<NativeSaveWriteResult> {
    const family = familyFromPath(options.relativePath);
    const envelope = parseEnvelope(options.utf8);
    const expected = payloadHash(envelope.payload);
    if (expected !== options.expectedSha256) throw new Error('HASH_MISMATCH');
    await this.store.commit({
      family,
      reason: family === 'battle' ? 'battle_snapshot' : family,
      envelope,
    });
    return { committed: true, sha256: expected };
  }

  async commit(options: NativeSaveEnvelopePayload): Promise<{ readonly slot: 'A' | 'B' | 'C' }> {
    const envelope = parseEnvelope(options.envelopeJson);
    const expected = payloadHash(envelope.payload);
    if (expected !== options.expectedSha256) throw new Error('HASH_MISMATCH');
    const result = await this.store.commit({
      family: options.family,
      reason: options.family === 'battle' ? 'battle_snapshot' : options.family,
      envelope,
    });
    return { slot: result.slot };
  }

  async load(options: { readonly family: 'profile' | 'run' | 'settings' | 'battle' }): Promise<NativeSaveLoadResult> {
    const envelope = await this.store.load(options.family);
    return { envelopeJson: canonicalJson(envelope) };
  }

  async inspect(options: { readonly family: 'profile' | 'run' | 'settings' | 'battle' }): Promise<NativeSaveInspectResult> {
    return this.store.inspect(options.family);
  }

  async cleanupOrphans(): Promise<{ readonly removed: readonly string[] }> {
    return { removed: await this.store.cleanupOrphans() };
  }
}

export class SaveTransferWeb extends WebPlugin implements SaveTransferPlugin {
  // eslint-disable-next-line @typescript-eslint/require-await
  async getBridgeInfo(): Promise<BridgeInfo> {
    return info('SaveTransfer', ['pick_import', 'export_document']);
  }
  async pickImport(): Promise<never> {
    return skeletonReject('SaveTransfer', '24');
  }
  async exportDocument(options: { readonly stagingToken: string; readonly suggestedName: string }): Promise<never> {
    void options;
    return skeletonReject('SaveTransfer', '24');
  }
}

export class GameAudioSessionWeb extends WebPlugin implements GameAudioSessionPlugin {
  // eslint-disable-next-line @typescript-eslint/require-await
  async getBridgeInfo(): Promise<BridgeInfo> {
    return info('GameAudioSession', ['audio_focus', 'interruption_events', 'silent_mode_policy']);
  }
  async configure(options: { readonly mode: 'ambient'; readonly respectSilentMode: true }): Promise<never> {
    void options;
    return skeletonReject('GameAudioSession', '39');
  }
  async activate(): Promise<never> {
    return skeletonReject('GameAudioSession', '39');
  }
  async deactivate(): Promise<never> {
    return skeletonReject('GameAudioSession', '39');
  }
}
