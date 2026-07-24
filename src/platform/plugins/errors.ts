import type { NativeErrorCode } from './contracts';

export class NativeBridgeError extends Error {
  public readonly code: NativeErrorCode;
  public readonly plugin: string;

  public constructor(plugin: string, code: NativeErrorCode, message: string) {
    super(message);
    this.name = 'NativeBridgeError';
    this.plugin = plugin;
    this.code = code;
  }
}

export function normalizeNativeBridgeError(plugin: string, error: unknown): NativeBridgeError {
  if (error instanceof NativeBridgeError) return error;
  if (typeof error === 'object' && error !== null) {
    const candidate = error as { code?: unknown; message?: unknown };
    const code = typeof candidate.code === 'string' ? candidate.code : 'NATIVE_FAILURE';
    const allowed = ['UNAVAILABLE', 'NOT_IMPLEMENTED', 'INVALID_ARGUMENT', 'NATIVE_FAILURE'];
    return new NativeBridgeError(
      plugin,
      (allowed.includes(code) ? code : 'NATIVE_FAILURE') as NativeErrorCode,
      typeof candidate.message === 'string' ? candidate.message : `${plugin} failed`,
    );
  }
  return new NativeBridgeError(plugin, 'NATIVE_FAILURE', `${plugin} failed`);
}
