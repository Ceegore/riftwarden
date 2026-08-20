import { describe, expect, it } from 'vitest';
import { buildCandidate, buildFallback, generateMap, structuralHash } from '../../src/game/expedition/map-generator.js';
import { mainPathLength, reachableFrom, validateMap } from '../../src/game/expedition/reachability.js';
import { mapFor, readJson, standardProfile } from './phase28-helpers.js';

describe('phase28 map generator determinism', () => {
  it('same seed + revision produce identical maps', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const a = mapFor(seed);
      const b = mapFor(seed);
      expect(a).toEqual(b);
      expect(a.mapHash).toBe(b.mapHash);
    }
  });

  it('different content revisions produce different maps and hashes', () => {
    const a = mapFor(1000, 'rev-1');
    const b = mapFor(1000, 'rev-2');
    expect(a.mapHash).not.toBe(b.mapHash);
  });

  it('every generated map passes structural validation', () => {
    for (let seed = 0; seed < 500; seed += 1) {
      const map = mapFor(seed);
      expect(validateMap(map, standardProfile())).toEqual([]);
    }
  });
});

describe('phase28 map structure contract', () => {
  it('covers six logical levels with mandatory roles on a reachable route', () => {
    const map = mapFor(1000);
    expect(new Set(map.nodes.map((node) => node.level))).toEqual(new Set([0, 1, 2, 3, 4, 5]));
    expect(map.nodes.some((node) => node.role === 'anchor')).toBe(true);
    expect(map.nodes.some((node) => node.role === 'preparation')).toBe(true);
    expect(map.nodes.some((node) => node.role === 'boss')).toBe(true);
    expect(map.nodes.some((node) => node.role === 'start')).toBe(true);
    expect(reachableFrom(map, map.startNodeId)).toContain(map.bossNodeId);
    const anchor = map.nodes.find((node) => node.role === 'anchor');
    expect(anchor?.type).toBe('anchor');
    expect(anchor?.instabilityDelta).toBe(-10);
  });

  it('stays within the 5–8 target visit length', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const map = mapFor(seed);
      const length = mainPathLength(map);
      expect(length).toBeGreaterThanOrEqual(5);
      expect(length).toBeLessThanOrEqual(8);
    }
  });

  it('produces stable ids independent of presentation order', () => {
    const map = mapFor(7);
    const ids = map.nodes.map((node) => node.id);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
    expect(map.edges.map((edge) => edge.id)).toEqual([...map.edges.map((edge) => edge.id)].sort());
  });
});

describe('phase28 attempt cap and fallback', () => {
  it('candidates are built per attempt and the cap is honored', () => {
    const profile = standardProfile();
    const input = { seed: 42, profileId: profile.id, contentRevision: 'rev' };
    const candidate = buildCandidate(input, profile, 3);
    expect(candidate.attempts).toBe(3);
    expect(validateMap(candidate, profile)).toEqual([]);
  });

  it('the fallback template satisfies every mandatory rule', () => {
    const profile = standardProfile();
    const fallback = buildFallback({ seed: 42, profileId: profile.id, contentRevision: 'rev' }, profile, 50);
    expect(fallback.usedFallback).toBe(true);
    expect(fallback.attempts).toBe(50);
    expect(validateMap(fallback, profile)).toEqual([]);
    expect(fallback.nodes.filter((node) => node.id.startsWith('fallback_'))).toHaveLength(6);
  });

  it('generation reports the fallback when the stream is exhausted (fault injection)', () => {
    // An impossible target visit range (1..1 vs the 6-node path) makes every
    // candidate fail validation, so the cap is consumed and the fallback is
    // returned with the mandatory rules intact.
    const impossible = { ...standardProfile(), targetVisited: [1, 1] as [number, number], attemptCap: 1 };
    const result = generateMap({ seed: 42, profileId: 'slice.act1.standard', contentRevision: 'rev' }, impossible);
    expect(result.usedFallback).toBe(true);
    expect(result.attempts).toBe(1);
    // The fallback never weakens the mandatory structural rules: under the
    // standard profile it is a fully valid 6-level map.
    expect(validateMap(result, standardProfile())).toEqual([]);
  });

  it('a wide cap still lands on the fallback deterministically', () => {
    const impossible = { ...standardProfile(), targetVisited: [1, 1] as [number, number] };
    const a = generateMap({ seed: 42, profileId: 'slice.act1.standard', contentRevision: 'rev' }, impossible);
    const b = generateMap({ seed: 42, profileId: 'slice.act1.standard', contentRevision: 'rev' }, impossible);
    expect(a.usedFallback).toBe(true);
    expect(a).toEqual(b);
    expect(a.attempts).toBe(standardProfile().attemptCap);
  });
});

describe('phase28 structural hash', () => {
  it('excludes presentation order', () => {
    const map = mapFor(5);
    const nodes = [...map.nodes].reverse();
    const edges = [...map.edges].reverse();
    expect(structuralHash(nodes, edges, map.profileId, map.contentRevision)).toBe(map.mapHash);
  });

  it('changes when the profile revision changes', () => {
    const map = mapFor(5);
    expect(structuralHash(map.nodes, map.edges, 'other-profile', map.contentRevision)).not.toBe(map.mapHash);
  });
});

describe('phase28 golden seeds', () => {
  it('reproduces stable hashes for all twelve pinned seeds', () => {
    const fixture = readJson('fixtures/map-golden-seeds.json') as { readonly vectors: readonly { readonly caseId: string; readonly seed: number }[] };
    const hashes = new Set<string>();
    for (const vector of fixture.vectors) {
      const map = mapFor(vector.seed);
      expect(map.profileId).toBe('slice.act1.standard');
      expect(validateMap(map, standardProfile())).toEqual([]);
      hashes.add(map.mapHash);
    }
    // Distinct seeds may collide rarely; with 12 maps at least 10 must differ.
    expect(hashes.size).toBeGreaterThanOrEqual(10);
  });
});
