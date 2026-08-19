import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createPoolLedger, COSMETIC_KINDS, CRITICAL_KINDS, mayDropOnPressure } from '../../src/game/render/pool-policy.js';
import { baselineQuality, degradeQuality, isFullyDegraded, COSMETIC_DROP_ORDER } from '../../src/game/render/quality.js';
import { catchRenderCode, readJson } from './phase25-helpers.js';

const qualityPressure = readJson('fixtures/quality-pressure-matrix.json') as {
  droppable: readonly string[];
  protected: readonly string[];
};

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(here, '..', '..');

function collectTsFiles(dir: string): string[] {
  const output: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) output.push(...collectTsFiles(full));
    else if (full.endsWith('.ts')) output.push(full);
  }
  return output;
}

describe('Pool ledger', () => {
  it('tracks allocation and release per kind', () => {
    const pool = createPoolLedger();
    pool.alloc('decorative_particle');
    pool.alloc('decorative_particle');
    pool.alloc('telegraph');
    expect(pool.total).toBe(3);
    expect(pool.counts.decorative_particle).toBe(2);
    expect(pool.counts.telegraph).toBe(1);
    pool.release('decorative_particle');
    expect(pool.counts.decorative_particle).toBe(1);
    expect(pool.total).toBe(2);
  });

  it('rejects release underflow', () => {
    const pool = createPoolLedger();
    expect(catchRenderCode(() => {
      pool.release('trail');
    })).toBe('POOL_UNDERFLOW');
  });

  it('fully releases every pool on scene teardown', () => {
    const pool = createPoolLedger();
    for (const kind of COSMETIC_KINDS) pool.alloc(kind);
    for (const kind of CRITICAL_KINDS) pool.alloc(kind);
    expect(pool.total).toBe(7);
    pool.reset();
    expect(pool.total).toBe(0);
    for (const kind of [...COSMETIC_KINDS, ...CRITICAL_KINDS]) expect(pool.counts[kind]).toBe(0);
  });

  it('degrades only cosmetics on exhaustion, never criticals', () => {
    const pool = createPoolLedger();
    for (const kind of COSMETIC_KINDS) {
      for (let i = 0; i < 3; i += 1) pool.alloc(kind);
    }
    for (const kind of CRITICAL_KINDS) pool.alloc(kind);
    let profile = baselineQuality('high');
    while (!isFullyDegraded(profile)) profile = degradeQuality(profile);
    // Critical kinds remain allocatable and untouched by pressure.
    for (const kind of CRITICAL_KINDS) {
      expect(profile.droppedCosmetics).not.toContain(kind);
      expect(mayDropOnPressure(kind)).toBe(false);
      pool.alloc(kind);
    }
    expect(pool.counts.telegraph).toBe(2);
  });
});

describe('Quality degradation (quality-pressure-matrix.json)', () => {
  it('matches the pinned droppable/protected split', () => {
    expect(COSMETIC_KINDS).toEqual(qualityPressure.droppable);
    expect(COSMETIC_DROP_ORDER).toEqual(qualityPressure.droppable);
  });

  it('follows the fixed drop order exactly', () => {
    let profile = baselineQuality('high');
    const droppedSequence: string[] = [];
    while (!isFullyDegraded(profile)) {
      profile = degradeQuality(profile);
      const last = profile.droppedCosmetics.at(-1) ?? '';
      if (droppedSequence.at(-1) !== last) droppedSequence.push(last);
    }
    expect(droppedSequence).toEqual(COSMETIC_DROP_ORDER);
  });

  it('reduces render resolution only after all cosmetics are dropped', () => {
    let profile = baselineQuality('high');
    for (const kind of COSMETIC_KINDS) {
      profile = degradeQuality(profile);
      expect(profile.droppedCosmetics).toContain(kind);
      expect(profile.resolutionScale1000).toBe(1000);
    }
    profile = degradeQuality(profile);
    expect(profile.resolutionScale1000).toBe(500);
    expect(isFullyDegraded(profile)).toBe(true);
  });

  it('never degrades protected kinds or entity readability', () => {
    let profile = baselineQuality('low');
    while (!isFullyDegraded(profile)) profile = degradeQuality(profile);
    for (const kind of qualityPressure.protected) {
      expect(profile.droppedCosmetics).not.toContain(kind);
    }
  });

  it('provides stable per-tier baselines', () => {
    expect(baselineQuality('high').droppedCosmetics).toEqual([]);
    expect(baselineQuality('medium').droppedCosmetics).toEqual(['decorative_particle']);
    expect(baselineQuality('low').droppedCosmetics).toEqual(['decorative_particle', 'damage_number']);
    expect(baselineQuality('reduced').droppedCosmetics).toEqual(COSMETIC_KINDS);
    expect(baselineQuality('reduced').resolutionScale1000).toBe(500);
  });
});

describe('Release source policy (RELEASE_SOURCE_POLICY_CONTRACT)', () => {
  const FORBIDDEN_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
    { name: 'canvas-renderer', pattern: /CanvasRenderer/ },
    { name: 'webgpu', pattern: /preference\s*[:=]\s*['"]webgpu/i },
    { name: 'math-random', pattern: /\bMath\.random\s*\(/ },
    { name: 'wallclock', pattern: /\bDate\.now\s*\(/ },
    { name: 'network-fetch', pattern: /\bfetch\s*\(/ },
    { name: 'locale-sort', pattern: /\blocaleCompare\s*\(/ },
    { name: 'pixi-import', pattern: /from\s+['"]pixi\.js/ },
  ];

  it('keeps the render contract layer free of forbidden tokens', () => {
    const renderFiles = collectTsFiles(path.join(projectRoot, 'src', 'game', 'render'));
    expect(renderFiles.length).toBeGreaterThan(5);
    const findings: string[] = [];
    for (const file of renderFiles) {
      const text = readFileSync(file, 'utf8');
      for (const { name, pattern } of FORBIDDEN_PATTERNS) {
        if (pattern.test(text)) findings.push(`${path.relative(projectRoot, file)}:${name}`);
      }
    }
    expect(findings).toEqual([]);
  });

  it('never imports the simulation into the render contract layer', () => {
    const renderFiles = collectTsFiles(path.join(projectRoot, 'src', 'game', 'render'));
    for (const file of renderFiles) {
      const text = readFileSync(file, 'utf8');
      expect(text).not.toMatch(/from\s+['"]\.\.\/sim\//);
      expect(text).not.toMatch(/from\s+['"]@game\/sim/);
    }
  });
});
