import { describe, expect, it } from 'vitest';
import { KernelInvariantError } from '../../src/game/sim/core/invariant-error.js';
import {
  SYNERGY_IDS,
  buildSynergyPreview,
  countSynergies,
  isSynergyId,
  synergyTiers,
  tierForCount,
  type SynergyUnitInput,
} from '../../src/game/sim/synergy/synergy-counter.js';
import { buildSynergyActivations, synergyCommandId, validateSynergyActivation, type SynergyActivation } from '../../src/game/sim/synergy/synergy-runtime.js';

const unit = (id: string, traits: readonly string[], overrides: Partial<SynergyUnitInput> = {}): SynergyUnitInput =>
  Object.freeze({ id, side: 'player', deployed: true, regular: true, traits: Object.freeze([...traits]), ...overrides });

describe('P20 §3.1/§4 synergy counter contract', () => {
  it('maps counts to exact tiers 0/2/3 (thresholds 1/2/3/4)', () => {
    expect(tierForCount(0)).toBe(0);
    expect(tierForCount(1)).toBe(0);
    expect(tierForCount(2)).toBe(2);
    expect(tierForCount(3)).toBe(3);
    expect(tierForCount(4)).toBe(3);
  });

  it('counts unique regular deployed unit ids per trait', () => {
    const units = [
      unit('unit_b', ['kingdom', 'faith']),
      unit('unit_a', ['kingdom']),
      unit('unit_s', ['kingdom'], { regular: false }), // summon excluded
      unit('unit_u', ['kingdom'], { deployed: false }), // undeployed excluded
    ];
    expect(countSynergies(units)).toEqual({ faith: 1, kingdom: 2 });
    expect(synergyTiers(units)).toEqual({ faith: 0, kingdom: 2 });
  });

  it('deduplicates repeated unit references (counts once)', () => {
    const a = unit('unit_a', ['kingdom']);
    expect(countSynergies([a, a, unit('unit_b', ['kingdom'])])).toEqual({ kingdom: 2 });
  });

  it('deduplicates repeated traits on a single unit', () => {
    expect(countSynergies([unit('unit_a', ['kingdom', 'kingdom', 'faith'])])).toEqual({ faith: 1, kingdom: 1 });
  });

  it('enforces the closed eight-synergy id set', () => {
    expect(SYNERGY_IDS).toEqual(['kingdom', 'wild', 'arcane', 'faith', 'underworld', 'construction', 'mercenary', 'summoner']);
    for (const id of SYNERGY_IDS) expect(isSynergyId(id)).toBe(true);
    expect(isSynergyId('dragon')).toBe(false);
  });

  it('blocks unknown trait ids (content validation)', () => {
    expect(() => countSynergies([unit('unit_a', ['dragon'])])).toThrow(KernelInvariantError);
  });

  it('blocks more than two traits on one unit', () => {
    expect(() => countSynergies([unit('unit_a', ['kingdom', 'wild', 'arcane'])])).toThrow(KernelInvariantError);
  });

  it('does not use localeCompare (code-unit canonical order)', () => {
    const tiers = synergyTiers([unit('unit_z', ['faith']), unit('unit_a', ['kingdom'])]);
    expect(Object.keys(tiers)).toEqual(['faith', 'kingdom']);
  });

  it('preview equals runtime tier map by construction', () => {
    const units = [unit('unit_a', ['kingdom']), unit('unit_b', ['kingdom'])];
    expect(buildSynergyPreview(units)).toEqual(synergyTiers(units));
  });
});

describe('P20 §3.2 synergy runtime', () => {
  it('builds canonical activations only for active tiers', () => {
    const tiers = synergyTiers([unit('unit_a', ['kingdom']), unit('unit_b', ['kingdom']), unit('unit_c', ['kingdom']), unit('unit_d', ['faith'])]);
    const activations = buildSynergyActivations(tiers, 'player');
    expect(activations.map((a) => [a.synergyId, a.tier])).toEqual([['kingdom', 3]]);
    const first = activations[0];
    expect(first).toBeDefined();
    if (first === undefined) throw new Error('unreachable: expected one activation');
    expect(first.sourceKind).toBe('synergy');
    expect(first.sourceId).toBe('kingdom');
    expect(first.commandId).toBe('synergy_kingdom_player');
  });

  it('emits stable command ids per (synergy, side)', () => {
    expect(synergyCommandId('kingdom', 'player')).toBe('synergy_kingdom_player');
    expect(synergyCommandId('kingdom', 'enemy')).toBe('synergy_kingdom_enemy');
  });

  it('validates activations and rejects unknown synergy ids', () => {
    const activation = buildSynergyActivations({ kingdom: 3 }, 'player')[0];
    expect(activation).toBeDefined();
    if (activation === undefined) throw new Error('unreachable: expected one activation');
    expect(() => { validateSynergyActivation(activation); }).not.toThrow();
    const bad = { ...activation, synergyId: 'dragon', sourceId: 'dragon' } as unknown as SynergyActivation;
    expect(() => { validateSynergyActivation(bad); }).toThrow(KernelInvariantError);
  });
});

describe('P20 §4 property: permutation invariance', () => {
  it('shuffled equivalent deployments yield identical tiers', () => {
    const units = [
      unit('unit_0', ['kingdom', 'faith']),
      unit('unit_1', ['kingdom']),
      unit('unit_2', ['wild']),
      unit('unit_3', ['kingdom']),
      unit('unit_4', ['faith', 'arcane']),
    ];
    const base = synergyTiers(units);
    expect(synergyTiers([...units].reverse())).toEqual(base);
    expect(synergyTiers([...units.slice(2), ...units.slice(0, 2)])).toEqual(base);
    expect(synergyTiers([...units.slice(4), ...units.slice(0, 4)])).toEqual(base);
  });
});
