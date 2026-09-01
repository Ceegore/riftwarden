import { describe, expect, it } from 'vitest';
import { SLOT_IDS } from '../../src/game/formation/model.js';
import { HARD_FINDING_CODES, validateFormation, WARNING_FINDING_CODES } from '../../src/game/formation/validator.js';
import { codesOf, entry, formation, unit, validationContext } from './phase27-helpers.js';

function fullContext(available: readonly string[] = ['a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9']) {
  return validationContext({ availableInstances: new Set(available) });
}

describe('phase27 validator fault coverage', () => {
  it('reports EMPTY_GROUP on an empty formation', () => {
    const findings = validateFormation(formation([]), fullContext());
    expect(codesOf(findings)).toContain('EMPTY_GROUP');
  });

  it('reports DUPLICATE_INSTANCE when one copy occupies two slots', () => {
    const f = formation([entry('lane_0:front', unit('a0')), entry('lane_0:middle', unit('a0'))]);
    expect(codesOf(validateFormation(f, fullContext()))).toContain('DUPLICATE_INSTANCE');
  });

  it('reports DUPLICATE_HERO for the same hero content twice', () => {
    const hero = unit('h1', 'hero', { contentId: 'hero_ariana' });
    const f = formation([entry('lane_0:front', hero), entry('lane_0:middle', { ...hero, instanceId: 'h2' })]);
    const findings = validateFormation(f, fullContext(['h1', 'h2']));
    expect(codesOf(findings)).toContain('DUPLICATE_HERO');
  });

  it('reports LOCKED_SLOT from profile authority only', () => {
    const unlocked = new Set<string>(SLOT_IDS.filter((slot) => slot !== 'lane_1:front'));
    const f = formation([entry('lane_1:front', unit('a0'))]);
    const findings = validateFormation(f, { ...fullContext(), unlockedSlots: unlocked });
    expect(codesOf(findings)).toContain('LOCKED_SLOT');
  });

  it('reports INCOMPATIBLE_LOADOUT via the compatibility predicate', () => {
    const f = formation([entry('lane_0:front', unit('a0'))]);
    const ctx = { ...fullContext(), compatible: (id: string) => id !== 'a0' };
    expect(codesOf(validateFormation(f, ctx))).toContain('INCOMPATIBLE_LOADOUT');
  });

  it('reports MISSING_INSTANCE when a copy is not in the collection', () => {
    const f = formation([entry('lane_0:front', unit('ghost'))]);
    expect(codesOf(validateFormation(f, fullContext()))).toContain('MISSING_INSTANCE');
  });

  it('reports INVALID_CONTRACT_COPY for an invalid copy/contract level', () => {
    const f = formation([entry('lane_0:front', unit('a0'))]);
    const ctx = { ...fullContext(), instanceValid: (id: string) => id !== 'a0' };
    expect(codesOf(validateFormation(f, ctx))).toContain('INVALID_CONTRACT_COPY');
  });

  it('reports SAME_TROOP_LIMIT beyond three copies of one troop kind', () => {
    const f = formation([
      entry('lane_0:front', unit('a0', 'regular', { troopTypeId: 't_archer' })),
      entry('lane_0:middle', unit('a1', 'regular', { troopTypeId: 't_archer' })),
      entry('lane_0:back', unit('a2', 'regular', { troopTypeId: 't_archer' })),
      entry('lane_1:front', unit('a3', 'regular', { troopTypeId: 't_archer' })),
    ]);
    expect(codesOf(validateFormation(f, fullContext()))).toContain('SAME_TROOP_LIMIT');
  });

  it('sorts findings hard-first then by code units', () => {
    const f = formation([
      entry('lane_1:front', unit('ghost1')),
      entry('lane_1:middle', unit('ghost2', 'regular', { troopTypeId: 't_archer' })),
    ]);
    const ctx = {
      ...fullContext(),
      rolesByInstance: new Map([['a0', ['ranged']]]),
    };
    const findings = validateFormation(f, ctx);
    const severities = findings.map((finding) => finding.severity);
    const firstWarning = severities.indexOf('warning');
    const hardPart = firstWarning === -1 ? severities : severities.slice(0, firstWarning);
    expect(hardPart.every((severity) => severity === 'hard')).toBe(true);
    const codes = findings.map((finding) => finding.code);
    expect([...codes].sort()).toEqual(codes);
  });

  it('never repairs or substitutes (findings only, formation untouched)', () => {
    const f = formation([entry('lane_0:front', unit('ghost'))]);
    const before = JSON.stringify(f);
    validateFormation(f, fullContext());
    expect(JSON.stringify(f)).toBe(before);
  });

  it('closed code unions cover every emitted code', () => {
    const ctx = {
      ...fullContext(['g0', 'g1', 'g2', 'g3', 'g4']),
      rolesByInstance: new Map([['g0', ['healer', 'melee']]]),
      pressuredLanes: new Set(['lane_0']),
      unlockedSlots: new Set<string>(),
      compatible: () => false,
      instanceValid: () => false,
    };
    const adversarial = formation([
      entry('lane_0:front', unit('g0')),
      entry('lane_0:middle', unit('g0')),
      entry('lane_0:back', unit('h0', 'hero', { contentId: 'hero_x' })),
      entry('lane_1:front', unit('h1', 'hero', { contentId: 'hero_x' })),
      entry('lane_1:middle', unit('g1', 'regular', { troopTypeId: 't_same' })),
      entry('lane_1:back', unit('g2', 'regular', { troopTypeId: 't_same' })),
      entry('lane_2:front', unit('g3', 'regular', { troopTypeId: 't_same' })),
      entry('lane_2:middle', unit('g4', 'regular', { troopTypeId: 't_same' })),
    ]);
    const findings = validateFormation(adversarial, ctx);
    const all = [...HARD_FINDING_CODES, ...WARNING_FINDING_CODES];
    for (const finding of findings) {
      expect(all, finding.code).toContain(finding.code);
    }
    expect(findings.length).toBeGreaterThanOrEqual(10);
  });
});
