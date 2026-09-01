import { describe, expect, it } from 'vitest';
import {
  allModifiersPreviewed,
  validateEncounter,
  validateModifier,
  EXPECTED_MODIFIER_COUNT,
  type ModifierDefinition,
} from '../../src/game/sim/world/modifier-system.js';
import { hazardStage, validateHazard, hazardWarningInfo, type Hazard } from '../../src/game/sim/world/hazard-system.js';

const modifier = (extra: Partial<ModifierDefinition> = {}): ModifierDefinition => Object.freeze({
  id: 'mod_alpha',
  previewKey: 'preview_mod_alpha',
  hooks: Object.freeze(['on_phase_entry'] as const),
  incompatibilityTags: Object.freeze(['tag_core'] as const),
  params: Object.freeze({ strength: 10 }),
  ...extra,
});

function eighteenModifiers(): readonly ModifierDefinition[] {
  return Object.freeze(Array.from({ length: EXPECTED_MODIFIER_COUNT }, (_, i) => modifier({
    id: `mod_${String(i)}`,
    previewKey: `preview_mod_${String(i)}`,
    incompatibilityTags: Object.freeze([`tag_${String(i)}`]),
  })));
}

describe('Phase 21 T04: modifiers', () => {
  it('validates a well-formed modifier', () => {
    expect(() => { validateModifier(modifier()); }).not.toThrow();
  });

  it('rejects an unknown hook', () => {
    expect(() => { validateModifier(modifier({ hooks: Object.freeze(['on_turn_end' as never]) })); }).toThrow(/P21_MODIFIER_INVALID/);
  });

  it('rejects a malformed incompatibility tag', () => {
    expect(() => { validateModifier(modifier({ incompatibilityTags: Object.freeze(['Bad Tag']) })); }).toThrow(/P21_MODIFIER_INVALID/);
  });

  it('rejects a non-integer deterministic param', () => {
    expect(() => { validateModifier(modifier({ params: Object.freeze({ strength: 1.5 }) })); }).toThrow(/P21_MODIFIER_INVALID/);
  });

  it('requires all 18 release modifiers to carry previews', () => {
    expect(allModifiersPreviewed(eighteenModifiers())).toBe(true);
    expect(allModifiersPreviewed(eighteenModifiers().slice(0, 17))).toBe(false);
    expect(allModifiersPreviewed(eighteenModifiers().slice(0, 18).map((m, i) => (i === 0 ? Object.freeze({ ...m, previewKey: '' }) : m)))).toBe(false);
  });

  it('rejects a modifier that neutralizes a boss core mechanic', () => {
    const issues = validateEncounter([modifier({ incompatibilityTags: Object.freeze(['core_phase']) })], {
      coreMechanicTags: Object.freeze(['core_phase']),
      announcedCounterTags: Object.freeze(['dispel']),
    });
    expect(issues.some((i) => i.code === 'P21_MODIFIER_INCOMPATIBLE' && i.detail.includes('neutralizes'))).toBe(true);
  });

  it('rejects a modifier that makes the announced counter impossible', () => {
    const issues = validateEncounter([modifier({ incompatibilityTags: Object.freeze(['dispel']) })], {
      coreMechanicTags: Object.freeze(['core_phase']),
      announcedCounterTags: Object.freeze(['dispel']),
    });
    expect(issues.some((i) => i.code === 'P21_MODIFIER_INCOMPATIBLE' && i.detail.includes('blocks-counter'))).toBe(true);
  });

  it('rejects two modifiers sharing an incompatibility tag', () => {
    const a = modifier({ id: 'mod_a', incompatibilityTags: Object.freeze(['shared']) });
    const b = modifier({ id: 'mod_b', incompatibilityTags: Object.freeze(['shared']) });
    const issues = validateEncounter([a, b], { coreMechanicTags: Object.freeze([]), announcedCounterTags: Object.freeze([]) });
    expect(issues.some((i) => i.code === 'P21_MODIFIER_INCOMPATIBLE' && i.detail.includes('mod_a/mod_b'))).toBe(true);
  });

  it('accepts a clean encounter', () => {
    const issues = validateEncounter([modifier({ incompatibilityTags: Object.freeze(['other']) })], {
      coreMechanicTags: Object.freeze(['core_phase']),
      announcedCounterTags: Object.freeze(['dispel']),
    });
    expect(issues).toEqual([]);
  });
});

const hazard = (extra: Partial<Hazard> = {}): Hazard => Object.freeze({
  id: 'hazard_alpha',
  scheduledTick: 100,
  telegraphTicks: 30,
  resolveTick: 130,
  expired: false,
  form: 'circle',
  edgePattern: 'edge_dashed',
  shapeSymbol: 'symbol_skull',
  ...extra,
});

describe('Phase 21 T04: hazards', () => {
  it('validates a well-formed hazard', () => {
    expect(() => { validateHazard(hazard()); }).not.toThrow();
  });

  it('rejects an inconsistent telegraph boundary', () => {
    expect(() => { validateHazard(hazard({ resolveTick: 140 })); }).toThrow(/P21_HAZARD_INVALID/);
  });

  it('rejects an unknown form', () => {
    expect(() => { validateHazard(hazard({ form: 'spiral' } as unknown as Partial<Hazard>)); }).toThrow(/P21_HAZARD_INVALID/);
  });

  it('follows scheduled → telegraph → resolve boundaries inclusively', () => {
    const h = hazard();
    expect(hazardStage(h, 99)).toBe('scheduled');
    expect(hazardStage(h, 100)).toBe('telegraph');
    expect(hazardStage(h, 129)).toBe('telegraph');
    expect(hazardStage(h, 130)).toBe('resolve');
  });

  it('reports expired first', () => {
    expect(hazardStage(hazard({ expired: true }), 50)).toBe('expired');
  });

  it('keeps warning info content-stable regardless of tick', () => {
    const h = hazard();
    expect(hazardWarningInfo(h)).toEqual({ form: 'circle', edgePattern: 'edge_dashed', shapeSymbol: 'symbol_skull' });
    expect(hazardWarningInfo(h)).toEqual(hazardWarningInfo(h));
  });
});
