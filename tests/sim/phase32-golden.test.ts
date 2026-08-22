/**
 * Phase 32 golden test: verifies the node-snapshot golden registry is
 * structurally valid and the harness check passes against the pinned source.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..', '..');
const REGISTRY_PATH = resolve(ROOT, 'contracts', 'phase32', 'golden-registry.json');
const HARNESS_PATH = resolve(ROOT, 'tools', 'sim', 'phase32-golden-harness.mjs');

interface GoldenRegistry {
  readonly schemaVersion: number;
  readonly phase: number;
  readonly kind: string;
  readonly sourceSha256: string;
  readonly pinnedOffers: readonly unknown[];
  readonly pinnedEvents: readonly unknown[];
  readonly sweep: { readonly count: number; readonly failures: number };
}

function loadRegistry(): GoldenRegistry {
  const raw: unknown = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
  return raw as GoldenRegistry;
}

describe('phase32 golden registry', () => {
  it('exists and is structurally valid', () => {
    expect(existsSync(REGISTRY_PATH), 'golden-registry.json missing').toBe(true);
    const registry = loadRegistry();
    expect(registry.phase).toBe(32);
    expect(registry.kind).toBe('node-snapshot-golden');
    expect(registry.sourceSha256).toBeTypeOf('string');
    expect(registry.sweep.count).toBeGreaterThanOrEqual(10000);
    expect(registry.sweep.failures).toBe(0);
    expect(registry.pinnedOffers.length).toBeGreaterThanOrEqual(12);
    expect(registry.pinnedEvents.length).toBeGreaterThanOrEqual(8);
  });

  it('harness --check passes against the pinned source', () => {
    const result = execFileSync(process.execPath, [HARNESS_PATH, '--check'], {
      cwd: ROOT,
      stdio: 'pipe',
      timeout: 60_000,
    });
    expect(result.toString()).toContain('PASS');
  });
});
