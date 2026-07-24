import { registerPlugin } from '@capacitor/core';
import type { GameAudioSessionPlugin, NativeSaveStorePlugin, SaveTransferPlugin } from './contracts';

export const NativeSaveStore = registerPlugin<NativeSaveStorePlugin>('NativeSaveStore', {
  web: async () => new (await import('./web-mocks')).NativeSaveStoreWeb(),
});

export const SaveTransfer = registerPlugin<SaveTransferPlugin>('SaveTransfer', {
  web: async () => new (await import('./web-mocks')).SaveTransferWeb(),
});

export const GameAudioSession = registerPlugin<GameAudioSessionPlugin>('GameAudioSession', {
  web: async () => new (await import('./web-mocks')).GameAudioSessionWeb(),
});
