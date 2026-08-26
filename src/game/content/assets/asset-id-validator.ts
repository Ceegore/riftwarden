/**
 * Phase 38: Asset ID validator (ASSET_ID_CONTRACT).
 * Validates format, domain/role membership, and cross-references
 * to known content IDs. Unknown domains or empty content IDs are
 * rejected; stale references produce warnings.
 */
import { ContentError } from '../content-error.js';
import { type AssetDomain, type AssetRole, type AssetVariant } from './asset-manifest-types.js';

const DOMAINS: ReadonlySet<string> = new Set([
  'hero', 'troop', 'enemy', 'elite', 'boss',
  'projectile', 'hit', 'heal', 'shield', 'status', 'aoe',
  'ability', 'map', 'mission', 'event', 'item', 'relic', 'banner',
  'icon', 'portrait', 'badge',
  'environment', 'prop', 'decoration', 'background',
  'transition', 'particle', 'post',
]);

const ROLES: ReadonlySet<string> = new Set([
  'idle', 'attack', 'cast', 'hurt', 'defeat',
  'portrait', 'full', 'silhouette',
  'telegraph', 'zone', 'impact',
  'body', 'weapon', 'head', 'chest', 'hands', 'feet',
]);

const VARIANTS: ReadonlySet<string> = new Set([
  'default', 'low', 'reduced', 'prot', 'deut', 'trit',
]);

export function validateAssetId(raw: string): void {
  if (!raw.startsWith('vis.')) {
    throw new ContentError('ASSET_ID_PREFIX', { raw });
  }
  const parts = raw.split('.');
  if (parts.length !== 4) {
    throw new ContentError('ASSET_ID_SEGMENTS', { raw, segments: parts.length });
  }
  const domain = parts[1];
  const contentId = parts[2];
  const role = parts[3];

  if (domain === undefined || contentId === undefined || role === undefined) {
    throw new ContentError('ASSET_ID_EMPTY_SEGMENT', { raw });
  }
  if (!DOMAINS.has(domain)) {
    throw new ContentError('ASSET_ID_UNKNOWN_DOMAIN', { raw, domain });
  }
  if (contentId.length === 0 || !/^[a-z][a-z0-9_-]{0,63}$/.test(contentId)) {
    throw new ContentError('ASSET_ID_INVALID_CONTENT', { raw, contentId });
  }
  if (!ROLES.has(role)) {
    throw new ContentError('ASSET_ID_UNKNOWN_ROLE', { raw, role });
  }
}

export function validateAssetVariant(variant: string): asserts variant is AssetVariant {
  if (!VARIANTS.has(variant)) {
    throw new ContentError('ASSET_UNKNOWN_VARIANT', { variant });
  }
}

export function isAssetDomain(value: string): value is AssetDomain {
  return DOMAINS.has(value);
}

export function isAssetRole(value: string): value is AssetRole {
  return ROLES.has(value);
}

export function isAssetVariant(value: string): value is AssetVariant {
  return VARIANTS.has(value);
}
