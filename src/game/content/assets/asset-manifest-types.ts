/**
 * Phase 38: Asset manifest type system (ASSET_MANIFEST_CONTRACT).
 *
 * Every release asset gets an immutable assetId following
 * `vis.<domain>.<contentId>.<role>.<variant>`. Paths are derived,
 * never identity. The source registry captures provenance;
 * the canonical manifest records every asset's production chain.
 */

export type AssetDomain =
  | 'hero' | 'troop' | 'enemy' | 'elite' | 'boss'
  | 'projectile' | 'hit' | 'heal' | 'shield' | 'status' | 'aoe'
  | 'ability' | 'map' | 'mission' | 'event' | 'item' | 'relic' | 'banner'
  | 'icon' | 'portrait' | 'badge'
  | 'environment' | 'prop' | 'decoration' | 'background'
  | 'transition' | 'particle' | 'post';

export type AssetRole =
  | 'idle' | 'attack' | 'cast' | 'hurt' | 'defeat'
  | 'portrait' | 'full' | 'silhouette'
  | 'telegraph' | 'zone' | 'impact'
  | 'body' | 'weapon' | 'head' | 'chest' | 'hands' | 'feet';

export type AssetVariant = 'default' | 'low' | 'reduced' | 'prot' | 'deut' | 'trit';

export interface AssetIdParts {
  readonly domain: AssetDomain;
  readonly contentId: string;
  readonly role: AssetRole;
  readonly variant: AssetVariant;
}

export function parseAssetId(id: string): AssetIdParts | null {
  const parts = id.split('.');
  if (parts.length !== 4 || parts[0] !== 'vis') return null;
  const domain = parts[1] as AssetDomain;
  const contentId = parts[2];
  const role = parts[3] as AssetRole;
  const variant = 'default' as AssetVariant;
  if (contentId === undefined || contentId.length === 0) return null;
  return { domain, contentId, role, variant };
}

export function buildAssetId(parts: AssetIdParts): string {
  return `vis.${parts.domain}.${parts.contentId}.${parts.role}.${parts.variant}`;
}

export interface SourceEntry {
  readonly sourceId: string;
  readonly tool: string;
  readonly toolVersion: string;
  readonly author: string;
  readonly licenseId: string;
  readonly licenseUrl: string;
  readonly sha256: string;
}

export interface TransformNode {
  readonly step: string;
  readonly version: string;
  readonly parameters: Readonly<Record<string, string>>;
  readonly inputSha256: string;
  readonly outputSha256: string;
}

export interface AssetManifestEntry {
  readonly assetId: string;
  readonly type: 'sprite' | 'spritesheet' | 'atlasEntry' | 'effect' | 'ui';
  readonly contentIds: readonly string[];
  readonly sources: readonly SourceEntry[];
  readonly transforms: readonly TransformNode[];
  readonly bytes: number;
  readonly dimensions?: { readonly w: number; readonly h: number };
  readonly reviewStatus: 'draft' | 'reviewed' | 'approved';
}