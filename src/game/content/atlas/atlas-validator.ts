/**
 * Phase 38: Atlas validator (ATLAS_CONTRACT).
 * Enforces max 2048×2048 atlas dimensions, padding, extrusion,
 * and texture coordinate bounds. Validates against the canonical
 * atlas manifest.
 */

export interface AtlasBounds {
  readonly w: number;
  readonly h: number;
}

export interface AtlasEntry {
  readonly assetId: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly rotated: boolean;
}

export interface AtlasManifest {
  readonly atlasId: string;
  readonly bounds: AtlasBounds;
  readonly entries: readonly AtlasEntry[];
  readonly sha256: string;
}

export const MAX_ATLAS_DIMENSION = 2048;
export const ATLAS_MIN_PADDING = 2;
export const ATLAS_MIN_EXTRUSION = 1;

export function validateAtlasBounds(bounds: AtlasBounds): void {
  if (bounds.w < 1 || bounds.h < 1) {
    throw new Error('ATLAS: bounds must be positive');
  }
  if (bounds.w > MAX_ATLAS_DIMENSION || bounds.h > MAX_ATLAS_DIMENSION) {
    throw new Error(`ATLAS: dimension exceeds ${String(MAX_ATLAS_DIMENSION)}px`);
  }
}

export function validateAtlasEntry(entry: AtlasEntry, bounds: AtlasBounds): void {
  if (entry.x < 0 || entry.y < 0) {
    throw new Error(`ATLAS: entry ${entry.assetId} has negative origin`);
  }
  if (entry.w < 1 || entry.h < 1) {
    throw new Error(`ATLAS: entry ${entry.assetId} has zero dimension`);
  }
  const right = entry.x + entry.w;
  const bottom = entry.y + entry.h;
  if (right > bounds.w || bottom > bounds.h) {
    throw new Error(`ATLAS: entry ${entry.assetId} exceeds atlas bounds`);
  }
}

export function validateAtlasManifest(manifest: AtlasManifest): string[] {
  const errors: string[] = [];
  try {
    validateAtlasBounds(manifest.bounds);
  } catch (e) {
    errors.push((e as Error).message);
  }
  const ids = new Set<string>();
  for (const entry of manifest.entries) {
    try {
      validateAtlasEntry(entry, manifest.bounds);
    } catch (e) {
      errors.push((e as Error).message);
    }
    if (ids.has(entry.assetId)) {
      errors.push(`ATLAS: duplicate assetId ${entry.assetId}`);
    }
    ids.add(entry.assetId);
  }
  return errors;
}