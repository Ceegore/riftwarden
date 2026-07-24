export const BRIDGE_VERSION = 1 as const;

export type NativePlatform = 'web' | 'android' | 'ios';
export type Availability = 'available' | 'unavailable';
export type ImplementationState = 'skeleton' | 'production';
export type NativeErrorCode =
  | 'UNAVAILABLE'
  | 'NOT_IMPLEMENTED'
  | 'INVALID_ARGUMENT'
  | 'NATIVE_FAILURE';

export interface BridgeInfo {
  readonly plugin: 'NativeSaveStore' | 'SaveTransfer' | 'GameAudioSession';
  readonly bridgeVersion: typeof BRIDGE_VERSION;
  readonly platform: NativePlatform;
  readonly availability: Availability;
  readonly implementation: ImplementationState;
  readonly capabilities: readonly string[];
}

export interface NativeSaveReadOptions {
  readonly relativePath: string;
}

export interface NativeSaveReadResult {
  readonly utf8: string;
}

export interface NativeSaveWriteOptions {
  readonly relativePath: string;
  readonly utf8: string;
  readonly expectedSha256: string;
}

export interface NativeSaveWriteResult {
  readonly committed: true;
  readonly sha256: string;
}

export interface NativeSaveStorePlugin {
  getBridgeInfo(): Promise<BridgeInfo>;
  read(options: NativeSaveReadOptions): Promise<NativeSaveReadResult>;
  writeAtomic(options: NativeSaveWriteOptions): Promise<NativeSaveWriteResult>;
}

export interface SaveTransferPickResult {
  readonly status: 'selected' | 'cancelled';
  readonly stagingToken?: string;
}

export interface SaveTransferPlugin {
  getBridgeInfo(): Promise<BridgeInfo>;
  pickImport(): Promise<SaveTransferPickResult>;
  exportDocument(options: { readonly stagingToken: string; readonly suggestedName: string }): Promise<{ readonly status: 'exported' | 'cancelled' }>;
}

export interface GameAudioSessionPlugin {
  getBridgeInfo(): Promise<BridgeInfo>;
  configure(options: { readonly mode: 'ambient'; readonly respectSilentMode: true }): Promise<void>;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
}
