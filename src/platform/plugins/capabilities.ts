import type { BridgeInfo } from './contracts';
import { GameAudioSession, NativeSaveStore, SaveTransfer } from './registry';
import { normalizeNativeBridgeError } from './errors';

export interface NativeCapabilitySnapshot {
  readonly nativeSaveStore: BridgeInfo | null;
  readonly saveTransfer: BridgeInfo | null;
  readonly gameAudioSession: BridgeInfo | null;
}

async function safelyRead(pluginName: string, read: () => Promise<BridgeInfo>): Promise<BridgeInfo | null> {
  try {
    return await read();
  } catch (error: unknown) {
    const normalized = normalizeNativeBridgeError(pluginName, error);
    if (normalized.code === 'UNAVAILABLE' || normalized.code === 'NOT_IMPLEMENTED') return null;
    throw normalized;
  }
}

export async function readNativeCapabilitySnapshot(): Promise<NativeCapabilitySnapshot> {
  const [nativeSaveStore, saveTransfer, gameAudioSession] = await Promise.all([
    safelyRead('NativeSaveStore', () => NativeSaveStore.getBridgeInfo()),
    safelyRead('SaveTransfer', () => SaveTransfer.getBridgeInfo()),
    safelyRead('GameAudioSession', () => GameAudioSession.getBridgeInfo()),
  ]);
  return { nativeSaveStore, saveTransfer, gameAudioSession };
}
