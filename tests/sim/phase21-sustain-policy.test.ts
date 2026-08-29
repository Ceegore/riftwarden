/**
 * Phase 21 §8.3 sustain POLICY — the heal-stream audit MATRIX mirrored into a
 * build-time contract check (`validateSustainPolicy`). The matrix pinned three
 * structural facts about the lifesteal loop; this test proves the validator
 * enforces them WITHOUT a sim run:
 *
 *   1. TARGET SET — an `immune` boss object blocks every lifesteal, so a
 *      sustain mission whose only damageable body is immune (or absent) is
 *      structurally unwinnable → P21_SUSTAIN_NO_DAMAGE_SOURCE. A regular
 *      enemy slot or a shield_only object keeps it winnable.
 *   2. COMPOSITE MODIFIERS — a heal_bps set that folds to 0 (or an encounter
 *      with NO heal source at all) never produces a heal → the zero-scale /
 *      no-source issues.
 *   3. REQUIREMENT — a non-positive healSustainCount is a content error.
 *   4. BANKABILITY CEILING — the counter is capped at `required` (the runtime
 *      fold clamps progress, so nothing above the need banks), and a
 *      requirement above SUSTAIN_BANKABILITY_CEILING is structurally
 *      unwinnable → P21_SUSTAIN_REQUIREMENT_OVER_CEILING.
 *
 * The §10 window halves the factor but never changes these facts, so the
 * checks are phase-independent. Bankability (requirement vs the pre-window
 * grind) is proven empirically by the launcher teeth, not here.
 */
import { describe, expect, it } from 'vitest';
import { validateSustainPolicy, SUSTAIN_BANKABILITY_CEILING } from '../../src/game/sim/world/modifier-system.js';
import type { ModifierDefinition } from '../../src/game/sim/world/modifier-system.js';
import { applyProgress } from '../../src/game/sim/objectives/combat-objective.js';

const LIFESTEAL: ModifierDefinition = Object.freeze({
  id: 'mod_policy_lifesteal', previewKey: 'preview_policy_ls', hooks: Object.freeze(['on_damage_applied'] as const), incompatibilityTags: Object.freeze([]), params: Object.freeze({ heal_bps: 5000 }),
});

const bossObject = (entityId: string, damagePolicy: string, targetable = true) => Object.freeze({
  entityId, spec: Object.freeze({ damagePolicy, targetable }),
});

describe('P21 §8.3 sustain policy (matrix mirrored at build time)', () => {
  it('passes a unit-only target set with a heal source', () => {
    expect(validateSustainPolicy({ healSustainCount: 1000, modifiers: [LIFESTEAL], enemySlots: Object.freeze([Object.freeze({})]), bossObjects: Object.freeze([]) })).toEqual([]);
  });

  it('passes a shield_only target set (shield_only damage still heals)', () => {
    expect(validateSustainPolicy({ healSustainCount: 1000, modifiers: [LIFESTEAL], enemySlots: Object.freeze([]), bossObjects: Object.freeze([bossObject('obj_shield', 'shield_only')]) })).toEqual([]);
  });

  it('rejects an immune-only target set (lifesteal can never fire)', () => {
    const issues = validateSustainPolicy({ healSustainCount: 1000, modifiers: [LIFESTEAL], enemySlots: Object.freeze([]), bossObjects: Object.freeze([bossObject('obj_immune', 'immune')]) });
    expect(issues.map((i) => i.code)).toContain('P21_SUSTAIN_NO_DAMAGE_SOURCE');
  });

  it('rejects an absent target set (no enemy bodies at all)', () => {
    const issues = validateSustainPolicy({ healSustainCount: 1000, modifiers: [LIFESTEAL], enemySlots: Object.freeze([]), bossObjects: Object.freeze([]) });
    expect(issues.map((i) => i.code)).toContain('P21_SUSTAIN_NO_DAMAGE_SOURCE');
  });

  it('rejects a composite heal_bps set that folds to zero', () => {
    const zero: ModifierDefinition = Object.freeze({ ...LIFESTEAL, id: 'mod_policy_zero', params: Object.freeze({ heal_bps: 0 }) });
    const issues = validateSustainPolicy({ healSustainCount: 1000, modifiers: Object.freeze([zero]), enemySlots: Object.freeze([Object.freeze({})]), bossObjects: Object.freeze([]) });
    expect(issues.map((i) => i.code)).toEqual(['P21_SUSTAIN_ZERO_HEAL_SCALE']);
  });

  it('rejects a sustain mission with no heal source modifier', () => {
    const issues = validateSustainPolicy({ healSustainCount: 1000, modifiers: Object.freeze([]), enemySlots: Object.freeze([Object.freeze({})]), bossObjects: Object.freeze([]) });
    expect(issues.map((i) => i.code)).toEqual(['P21_SUSTAIN_NO_HEAL_SOURCE']);
  });

  it('rejects a non-positive requirement', () => {
    const issues = validateSustainPolicy({ healSustainCount: 0, modifiers: [LIFESTEAL], enemySlots: Object.freeze([Object.freeze({})]), bossObjects: Object.freeze([]) });
    expect(issues.map((i) => i.code)).toEqual(['P21_SUSTAIN_REQUIREMENT_EMPTY']);
  });

  it('rejects a requirement above the bankability ceiling (unwinnable by construction)', () => {
    const issues = validateSustainPolicy({ healSustainCount: SUSTAIN_BANKABILITY_CEILING + 1, modifiers: [LIFESTEAL], enemySlots: Object.freeze([Object.freeze({})]), bossObjects: Object.freeze([]) });
    expect(issues.map((i) => i.code)).toEqual(['P21_SUSTAIN_REQUIREMENT_OVER_CEILING']);
  });

  it('accepts the ceiling boundary exactly', () => {
    expect(validateSustainPolicy({ healSustainCount: SUSTAIN_BANKABILITY_CEILING, modifiers: [LIFESTEAL], enemySlots: Object.freeze([Object.freeze({})]), bossObjects: Object.freeze([]) })).toEqual([]);
  });

  it('the runtime bankability ceiling clamps the counter at required (nothing above the need banks)', () => {
    const base = Object.freeze({ id: 'obj_x_heal', kind: 'heal_sustain' as const, targetId: null, required: 100, progress: 99, complete: false });
    // A heal worth 50 HP lands with 1 HP of need left: the counter banks 1, not 50.
    expect(applyProgress(base, 50)).toEqual(Object.freeze({ id: 'obj_x_heal', kind: 'heal_sustain', targetId: null, required: 100, progress: 100, complete: true }));
    // Once complete, nothing more banks.
    const done = applyProgress(base, 50);
    expect(applyProgress(done, 50)).toBe(done);
  });

  it('is a no-op for non-sustain encounters', () => {
    expect(validateSustainPolicy({ healSustainCount: null, modifiers: Object.freeze([]), enemySlots: Object.freeze([]), bossObjects: Object.freeze([]) })).toEqual([]);
  });
});
