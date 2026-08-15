import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const registry = JSON.parse(readFileSync(path.join(here, 'fixtures', 'golden-seeds', 'registry.json'), 'utf8')) as {
  entries: readonly { id: string; activationStatus: string; expectedCheckpoints: readonly unknown[] }[];
};
const expected = ['golden_basic_001', 'golden_lane_002', 'golden_status_003', 'golden_summon_004', 'golden_revive_005', 'golden_projectile_006', 'golden_boss_ash_101', 'golden_boss_thorn_102', 'golden_boss_smith_103', 'golden_boss_heart_104', 'golden_timeout_201', 'golden_save_301'];

describe('golden seed registry', () => {
  it('all twelve golden ids exact', () => {
    expect(registry.entries.map((x) => x.id)).toEqual(expected);
  });
  it('no premature pass or checkpoints', () => {
    for (const e of registry.entries) {
      expect(e.activationStatus).toBe('PENDING_OWNER_PHASE');
      expect(e.expectedCheckpoints).toEqual([]);
    }
  });
  it('ids unique', () => {
    expect(new Set(registry.entries.map((x) => x.id)).size).toBe(12);
  });
});
