import { WebPlugin } from '@capacitor/core';
import type {
  BridgeInfo,
  GameAudioSessionPlugin,
  NativeSaveReadOptions,
  NativeSaveStorePlugin,
  NativeSaveWriteOptions,
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

// eslint-disable-next-line @typescript-eslint/require-await
async function skeletonReject(plugin: string, phase: string): Promise<never> {
  await Promise.resolve();
  throw new Error(`${plugin} is implemented in Phase ${phase}.`);
}

export class NativeSaveStoreWeb extends WebPlugin implements NativeSaveStorePlugin {
  // eslint-disable-next-line @typescript-eslint/require-await
  async getBridgeInfo(): Promise<BridgeInfo> {
    return info('NativeSaveStore', ['atomic_write', 'durable_flush', 'slot_rotation']);
  }
  async read(options: NativeSaveReadOptions): Promise<never> {
    void options;
    return skeletonReject('NativeSaveStore', '23');
  }
  async writeAtomic(options: NativeSaveWriteOptions): Promise<never> {
    void options;
    return skeletonReject('NativeSaveStore', '23');
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
