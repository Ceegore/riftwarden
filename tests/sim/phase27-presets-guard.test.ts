import { describe, expect, it } from 'vitest';
import { assertDisclosureItems } from '../../src/game/formation/disclosure.js';
import { catchFormationCode, entry, formation, unit } from './phase27-helpers.js';
import { createPreset, dedupePresetNames, isPresetKind, restorePreset, validatePresetName } from '../../src/game/formation/presets.js';
import { AtomicStartGuard } from '../../src/game/formation/start-guard.js';

describe('phase27 presets', () => {
  it('accepts exactly the four preset kinds', () => {
    expect(isPresetKind('standard')).toBe(true);
    expect(isPresetKind('defensive')).toBe(true);
    expect(isPresetKind('offensive')).toBe(true);
    expect(isPresetKind('custom')).toBe(true);
    expect(isPresetKind('nuclear')).toBe(false);
    expect(isPresetKind(3)).toBe(false);
  });

  it('custom presets demand a non-empty validated name', () => {
    const f = formation([entry('lane_0:front', unit('c0'))]);
    const preset = createPreset('custom', f, 'My Roster');
    expect(preset.name).toBe('My Roster');
    expect(catchFormationCode(() => createPreset('custom', f, '   '))).toBe('UNKNOWN_PRESET_KIND');
    expect(validatePresetName('x')).toBe(true);
    expect(validatePresetName('')).toBe(false);
    expect(validatePresetName('  ')).toBe(false);
  });

  it('rejects unknown kinds deterministically', () => {
    expect(catchFormationCode(() => createPreset('nuclear' as never, formation([])))).toBe('UNKNOWN_PRESET_KIND');
  });

  it('dedupes duplicate custom names deterministically', () => {
    expect(dedupePresetNames(['A', 'B', 'A', 'A'])).toEqual(['A', 'B', 'A (2)', 'A (3)']);
    expect(dedupePresetNames(['A', 'A (2)', 'A'])).toEqual(['A', 'A (2)', 'A (3)']);
  });

  it('restore skips missing copies and keeps the rest untouched', () => {
    const preset = createPreset(
      'standard',
      formation([
        entry('lane_0:front', unit('i0')),
        entry('lane_0:middle', unit('i1')),
        entry('lane_1:front', unit('i2', 'hero', { contentId: 'hero_h' })),
      ]),
    );
    const report = restorePreset(preset, new Set(['i1']));
    expect(report.missingInstanceIds).toEqual(['i0', 'i2']);
    expect(report.formation.entries.map((e) => e.unit.instanceId)).toEqual(['i1']);
    expect(report.formation.entries[0]?.unit.kind).toBe('regular');
  });
});

describe('phase27 disclosure item guard', () => {
  it('accepts only the closed item set', () => {
    expect(assertDisclosureItems(['enemyFormation', 'roles'])).toEqual(['enemyFormation', 'roles']);
    expect(catchFormationCode(() => assertDisclosureItems(['enemyFormation', 'mapPieces']))).toBe('UNKNOWN_DISCLOSURE_ITEM');
  });
});

describe('phase27 start guard edges', () => {
  it('shares the pending promise across concurrent callers', async () => {
    const guard = new AtomicStartGuard();
    let running = 0;
    let maxRunning = 0;
    let navigations = 0;
    const commit = async (): Promise<void> => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      await Promise.resolve();
      running -= 1;
    };
    const [first, second, third] = await Promise.all([
      guard.start(commit, () => {
        navigations += 1;
      }),
      guard.start(commit, () => {
        navigations += 1;
      }),
      guard.start(commit, () => {
        navigations += 1;
      }),
    ]);
    expect(first).toEqual({ committed: true, navigated: true });
    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(maxRunning).toBe(1);
    expect(navigations).toBe(1);
  });

  it('unlocks and reports failure after a commit error', async () => {
    const guard = new AtomicStartGuard();
    let navigations = 0;
    const outcome = await guard.start(() => {
      throw new Error('boom');
    }, () => {
      navigations += 1;
    });
    expect(outcome).toEqual({ committed: false, navigated: false });
    expect(guard.pending).toBe(false);
    const retry = await guard.start(() => Promise.resolve(), () => {
      navigations += 1;
    });
    expect(retry).toEqual({ committed: true, navigated: true });
    expect(navigations).toBe(1);
  });
});
