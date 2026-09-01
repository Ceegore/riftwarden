/**
 * Phase 41: Memory profiler (MEMORY_BUDGET_CONTRACT).
 *
 * Tracks expedition save size and texture memory estimates.
 * Warns at 50KB save size, hard limit at 250KB.
 */

export interface MemorySnapshot {
  readonly saveBytes: number;
  readonly estimatedTextureBytes: number;
  readonly timestamp: number;
}

const SAVE_WARN_BYTES = 50_000;
const SAVE_LIMIT_BYTES = 250_000;

export function checkSaveSize(bytes: number): { readonly ok: boolean; readonly warning: boolean; readonly reason?: string } {
  if (bytes > SAVE_LIMIT_BYTES) return { ok: false, warning: true, reason: `Save ${String(bytes)} exceeds ${String(SAVE_LIMIT_BYTES)} limit` };
  if (bytes > SAVE_WARN_BYTES) return { ok: true, warning: true, reason: `Save ${String(bytes)} near ${String(SAVE_LIMIT_BYTES)} limit` };
  return { ok: true, warning: false };
}

export interface MemoryLeakCheck {
  readonly before: MemorySnapshot;
  readonly after: MemorySnapshot;
}

export function detectLeak(check: MemoryLeakCheck, thresholdBytes: number): boolean {
  const delta = check.after.saveBytes - check.before.saveBytes;
  return delta > thresholdBytes;
}

export function createSnapshot(saveBytes: number, estimatedTextureBytes: number): MemorySnapshot {
  return { saveBytes, estimatedTextureBytes, timestamp: Date.now() };
}

export function textureMemoryEstimate(
  atlasCount: number,
  averageAtlasSize: number,
  bytesPerPixel: number,
): number {
  return atlasCount * averageAtlasSize * averageAtlasSize * bytesPerPixel;
}
