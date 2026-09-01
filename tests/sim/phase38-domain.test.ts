/**
 * Phase 38 domain tests: asset ID validation, atlas bounds, manifest checks.
 */
import { describe, expect, it } from 'vitest';
import { validateAssetId, validateAssetVariant } from '../../src/game/content/assets/asset-id-validator.js';
import { parseAssetId, buildAssetId } from '../../src/game/content/assets/asset-manifest-types.js';
import { validateAtlasBounds, validateAtlasEntry, validateAtlasManifest } from '../../src/game/content/atlas/atlas-validator.js';
import type { AtlasEntry, AtlasManifest } from '../../src/game/content/atlas/atlas-validator.js';

describe('asset ID parser', () => {
  it('parses a valid asset ID', () => {
    const parts = parseAssetId('vis.hero.aurel.portrait');
    expect(parts).not.toBeNull();
    expect(parts?.domain).toBe('hero');
    expect(parts?.contentId).toBe('aurel');
    expect(parts?.role).toBe('portrait');
  });

  it('rejects IDs without vis prefix', () => {
    expect(parseAssetId('hero.aurel.portrait.default')).toBeNull();
  });

  it('rejects IDs with wrong segment count', () => {
    expect(parseAssetId('vis.hero.aurel')).toBeNull();
  });

  it('round-trips through build+parse', () => {
    const parts = parseAssetId('vis.boss.ash_king.body');
    expect(parts).not.toBeNull();
    if (parts) {
      const rebuilt = buildAssetId({ ...parts, variant: 'default' });
      expect(rebuilt).toBe('vis.boss.ash_king.body.default');
    }
  });
});

describe('asset ID validator', () => {
  it('accepts valid IDs across all domains', () => {
    expect(() => { validateAssetId('vis.hero.aurel.portrait'); }).not.toThrow();
    expect(() => { validateAssetId('vis.boss.ash_king.idle'); }).not.toThrow();
    expect(() => { validateAssetId('vis.item.sword_01.portrait'); }).not.toThrow();
    expect(() => { validateAssetId('vis.environment.forest.idle'); }).not.toThrow();
    expect(() => { validateAssetId('vis.banner.vanguard.portrait'); }).not.toThrow();
  });

  it('rejects missing vis prefix', () => {
    expect(() => { validateAssetId('hero.aurel.portrait.default'); }).toThrow();
  });

  it('rejects unknown domain', () => {
    expect(() => { validateAssetId('vis.unknown.aurel.portrait'); }).toThrow();
  });

  it('rejects unknown role', () => {
    expect(() => { validateAssetId('vis.hero.aurel.flying'); }).toThrow();
  });

  it('rejects empty contentId', () => {
    expect(() => { validateAssetId('vis.hero..portrait'); }).toThrow();
  });

  it('rejects contentId with invalid characters', () => {
    expect(() => { validateAssetId('vis.hero.Aurel.portrait'); }).toThrow();
  });
});

describe('asset variant validator', () => {
  it('accepts valid variants', () => {
    expect(() => { validateAssetVariant('default'); }).not.toThrow();
    expect(() => { validateAssetVariant('low'); }).not.toThrow();
    expect(() => { validateAssetVariant('reduced'); }).not.toThrow();
    expect(() => { validateAssetVariant('prot'); }).not.toThrow();
    expect(() => { validateAssetVariant('deut'); }).not.toThrow();
    expect(() => { validateAssetVariant('trit'); }).not.toThrow();
  });

  it('rejects unknown variants', () => {
    expect(() => { validateAssetVariant('ultra'); }).toThrow();
  });
});

describe('atlas bounds validator', () => {
  it('accepts valid atlas dimensions', () => {
    expect(() => { validateAtlasBounds({ w: 1024, h: 1024 }); }).not.toThrow();
    expect(() => { validateAtlasBounds({ w: 2048, h: 2048 }); }).not.toThrow();
  });

  it('rejects zero dimensions', () => {
    expect(() => { validateAtlasBounds({ w: 0, h: 1024 }); }).toThrow();
  });

  it('rejects dimensions exceeding max', () => {
    expect(() => { validateAtlasBounds({ w: 4096, h: 1024 }); }).toThrow();
  });
});

describe('atlas entry validator', () => {
  const bounds = { w: 1024, h: 1024 };

  it('accepts a valid entry', () => {
    const entry: AtlasEntry = { assetId: 'vis.hero.aurel.idle', x: 0, y: 0, w: 64, h: 64, rotated: false };
    expect(() => { validateAtlasEntry(entry, bounds); }).not.toThrow();
  });

  it('rejects negative origin', () => {
    const entry: AtlasEntry = { assetId: 'vis.hero.aurel.idle', x: -1, y: 0, w: 64, h: 64, rotated: false };
    expect(() => { validateAtlasEntry(entry, bounds); }).toThrow();
  });

  it('rejects entry exceeding bounds', () => {
    const entry: AtlasEntry = { assetId: 'vis.hero.aurel.idle', x: 1000, y: 0, w: 64, h: 64, rotated: false };
    expect(() => { validateAtlasEntry(entry, bounds); }).toThrow();
  });

  it('rejects zero-width entry', () => {
    const entry: AtlasEntry = { assetId: 'vis.hero.aurel.idle', x: 0, y: 0, w: 0, h: 64, rotated: false };
    expect(() => { validateAtlasEntry(entry, bounds); }).toThrow();
  });
});

describe('atlas manifest validator', () => {
  it('accepts a valid manifest', () => {
    const manifest: AtlasManifest = {
      atlasId: 'test-atlas',
      bounds: { w: 1024, h: 1024 },
      entries: [
        { assetId: 'vis.hero.aurel.idle', x: 0, y: 0, w: 64, h: 64, rotated: false },
        { assetId: 'vis.hero.aurel.attack', x: 64, y: 0, w: 64, h: 64, rotated: false },
      ],
      sha256: 'abc123',
    };
    const errors = validateAtlasManifest(manifest);
    expect(errors).toHaveLength(0);
  });

  it('reports duplicate asset IDs', () => {
    const manifest: AtlasManifest = {
      atlasId: 'test-atlas',
      bounds: { w: 1024, h: 1024 },
      entries: [
        { assetId: 'vis.hero.aurel.idle', x: 0, y: 0, w: 64, h: 64, rotated: false },
        { assetId: 'vis.hero.aurel.idle', x: 64, y: 0, w: 64, h: 64, rotated: false },
      ],
      sha256: 'abc123',
    };
    const errors = validateAtlasManifest(manifest);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('duplicate'))).toBe(true);
  });

  it('reports oversized atlas', () => {
    const manifest: AtlasManifest = {
      atlasId: 'test-atlas',
      bounds: { w: 4096, h: 1024 },
      entries: [],
      sha256: 'abc123',
    };
    const errors = validateAtlasManifest(manifest);
    expect(errors.length).toBeGreaterThan(0);
  });
});
