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

export class NativeSaveStoreWeb extends WebPlugin implements NativeSaveStorePlugin {
  async getBridgeInfo(): Promise<BridgeInfo> {
    return info('NativeSaveStore', ['atomic_write', 'durable_flush', 'slot_rotation']);
  }
  async read(_options: NativeSaveReadOptions): Promise<never> {
    throw this.unimplemented('NativeSaveStore is implemented in Phase 23.');
  }
  async writeAtomic(_options: NativeSaveWriteOptions): Promise<never> {
    throw this.unimplemented('NativeSaveStore is implemented in Phase 23.');
  }
}

export class SaveTransferWeb extends WebPlugin implements SaveTransferPlugin {
  async getBridgeInfo(): Promise<BridgeInfo> {
    return info('SaveTransfer', ['pick_import', 'export_document']);
  }
  async pickImport(): Promise<never> {
    throw this.unimplemented('SaveTransfer is implemented in Phase 24.');
  }
  async exportDocument(_options: { readonly stagingToken: string; readonly suggestedName: string }): Promise<never> {
    throw this.unimplemented('SaveTransfer is implemented in Phase 24.');
  }
}

export class GameAudioSessionWeb extends WebPlugin implements GameAudioSessionPlugin {
  async getBridgeInfo(): Promise<BridgeInfo> {
    return info('GameAudioSession', ['audio_focus', 'interruption_events', 'silent_mode_policy']);
  }
  async configure(_options: { readonly mode: 'ambient'; readonly respectSilentMode: true }): Promise<never> {
    throw this.unimplemented('GameAudioSession is implemented in Phase 39.');
  }
  async activate(): Promise<never> {
    throw this.unimplemented('GameAudioSession is implemented in Phase 39.');
  }
  async deactivate(): Promise<never> {
    throw this.unimplemented('GameAudioSession is implemented in Phase 39.');
  }
}
