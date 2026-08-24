/**
 * Phase 38 content: region map profiles (REGION_PROFILE_REGISTRY).
 *
 * Six canonical regions, each with a distinct MapProfile and a
 * region-tuned node-type weight table. The profile id is the stable
 * content key; the generator uses it to select the structural layout
 * and the weighted node pool. All weights sum to 100.
 */
import type { MapProfile, NodeRole, NodeType } from '../../expedition/types.js';

export interface RegionProfile {
  readonly profile: MapProfile;
  /** Node-type weights for normal slots (sum 100). */
  readonly typeWeights: readonly (readonly [NodeType, number])[];
}

const MANDATORY: readonly NodeRole[] = ['anchor', 'preparation', 'boss'];

function profile(id: string, targetVisited: readonly [number, number], fallbackTemplateId: string): MapProfile {
  return {
    id,
    logicalLevels: 6,
    targetVisited,
    mandatoryRoles: MANDATORY,
    attemptCap: 50,
    fallbackTemplateId,
  };
}

/**
 * Canonical region profiles. Each maps to a `mapProfileId` referenced
 * by a MissionDefinition. The structural parameters are identical;
 * the differentiation comes from the type-weight distribution, which
 * makes each region feel distinct through its node pool.
 */
export const REGION_PROFILES: Readonly<Record<string, RegionProfile>> = Object.freeze({
  // Act 1: balanced, slightly battle-heavy for new players.
  'expedition.tutorial.v1': Object.freeze({
    profile: profile('expedition.tutorial.v1', [5, 7], 'fallback.tutorial'),
    typeWeights: [
      ['battle', 45],
      ['event', 15],
      ['merchant', 12],
      ['treasure', 10],
      ['recruitment', 8],
      ['scout', 5],
      ['anchor', 3],
      ['workshop', 2],
    ] as readonly (readonly [NodeType, number])[],
  }),
  'expedition.act1.standard': Object.freeze({
    profile: profile('expedition.act1.standard', [5, 8], 'fallback.act1'),
    typeWeights: [
      ['battle', 35],
      ['elite', 12],
      ['event', 15],
      ['merchant', 8],
      ['treasure', 8],
      ['recruitment', 7],
      ['workshop', 5],
      ['altar', 4],
      ['scout', 6],
    ] as readonly (readonly [NodeType, number])[],
  }),
  'expedition.act1.hard': Object.freeze({
    profile: profile('expedition.act1.hard', [6, 9], 'fallback.act1hard'),
    typeWeights: [
      ['battle', 30],
      ['elite', 18],
      ['event', 12],
      ['merchant', 6],
      ['treasure', 6],
      ['recruitment', 5],
      ['workshop', 5],
      ['altar', 6],
      ['scout', 12],
    ] as readonly (readonly [NodeType, number])[],
  }),
  'expedition.act1.ascension': Object.freeze({
    profile: profile('expedition.act1.ascension', [6, 10], 'fallback.ascension'),
    typeWeights: [
      ['battle', 25],
      ['elite', 22],
      ['event', 10],
      ['merchant', 5],
      ['treasure', 5],
      ['recruitment', 5],
      ['workshop', 5],
      ['altar', 8],
      ['scout', 15],
    ] as readonly (readonly [NodeType, number])[],
  }),

  // Act 2: forest — more events and scouts, fewer elites.
  'expedition.act2.forest': Object.freeze({
    profile: profile('expedition.act2.forest', [5, 8], 'fallback.forest'),
    typeWeights: [
      ['battle', 30],
      ['elite', 8],
      ['event', 22],
      ['merchant', 10],
      ['treasure', 10],
      ['recruitment', 7],
      ['scout', 13],
    ] as readonly (readonly [NodeType, number])[],
  }),
  // Act 2: caverns — treasure and merchant heavy, high elite risk.
  'expedition.act2.caverns': Object.freeze({
    profile: profile('expedition.act2.caverns', [6, 9], 'fallback.caverns'),
    typeWeights: [
      ['battle', 25],
      ['elite', 15],
      ['event', 12],
      ['merchant', 18],
      ['treasure', 15],
      ['recruitment', 5],
      ['workshop', 5],
      ['scout', 5],
    ] as readonly (readonly [NodeType, number])[],
  }),

  // Act 3: mountains — battle-heavy, recruitment scarce.
  'expedition.act3.mountains': Object.freeze({
    profile: profile('expedition.act3.mountains', [6, 10], 'fallback.mountains'),
    typeWeights: [
      ['battle', 40],
      ['elite', 16],
      ['event', 8],
      ['merchant', 8],
      ['treasure', 8],
      ['recruitment', 4],
      ['workshop', 8],
      ['altar', 8],
    ] as readonly (readonly [NodeType, number])[],
  }),
  // Act 3: ruins — altar-heavy, high instability risk.
  'expedition.act3.ruins': Object.freeze({
    profile: profile('expedition.act3.ruins', [6, 9], 'fallback.ruins'),
    typeWeights: [
      ['battle', 20],
      ['elite', 15],
      ['event', 15],
      ['merchant', 6],
      ['treasure', 12],
      ['recruitment', 5],
      ['workshop', 7],
      ['altar', 20],
    ] as readonly (readonly [NodeType, number])[],
  }),
});