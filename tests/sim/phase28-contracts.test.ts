import { describe, expect, it } from 'vitest';
import { NODE_STAGES, isNodeStage, transition } from '../../src/game/expedition/node-flow.js';
import { isNodeType } from '../../src/game/expedition/node-registry.js';
import { NODE_TYPES } from '../../src/game/expedition/types.js';
import { catchExpeditionCode, readJson } from './phase28-helpers.js';

interface TransitionCase {
  readonly from: string;
  readonly command: string;
  readonly to?: string;
  readonly error?: string;
}

describe('phase28 constants contract', () => {
  const constants = readJson('phase28-constants.json') as {
    readonly phase: number;
    readonly logicalLevels: number;
    readonly targetVisitedMin: number;
    readonly targetVisitedMax: number;
    readonly generatorAttemptCap: number;
    readonly mandatoryNodeRoles: readonly string[];
    readonly minimumNodeTypes: readonly string[];
    readonly transactionStages: readonly string[];
    readonly gateSampleMaps: number;
    readonly rcSampleMaps: number;
  };

  it('pins the expedition constants', () => {
    expect(constants.phase).toBe(28);
    expect(constants.logicalLevels).toBe(6);
    expect(constants.targetVisitedMin).toBe(5);
    expect(constants.targetVisitedMax).toBe(8);
    expect(constants.generatorAttemptCap).toBe(50);
    expect(constants.mandatoryNodeRoles).toEqual(['anchor', 'preparation', 'boss']);
    expect(constants.minimumNodeTypes).toEqual(['battle', 'anchor']);
    expect(constants.transactionStages).toEqual(NODE_STAGES);
    expect(constants.gateSampleMaps).toBe(10000);
    expect(constants.rcSampleMaps).toBe(100000);
  });

  it('exposes exactly the closed node types (Phase 32 supersession: 12 types)', () => {
    expect(NODE_TYPES).toEqual([
      'battle',
      'elite',
      'boss',
      'event',
      'merchant',
      'recruitment',
      'treasure',
      'workshop',
      'altar',
      'scout',
      'anchor',
      'story',
    ]);
    expect(isNodeType('battle')).toBe(true);
    expect(isNodeType('anchor')).toBe(true);
    expect(isNodeType('merchant')).toBe(true);
  });
});

describe('phase28 map profiles fixture', () => {
  const fixture = readJson('fixtures/map-profiles.json') as {
    readonly profiles: readonly { readonly id: string; readonly logicalLevels: number; readonly targetVisited: readonly number[]; readonly mandatoryRoles: readonly string[]; readonly attemptCap: number; readonly fallbackTemplateId: string }[];
  };

  it('pins the standard act-1 slice profile', () => {
    const profile = fixture.profiles[0];
    expect(profile?.id).toBe('slice.act1.standard');
    expect(profile?.logicalLevels).toBe(6);
    expect(profile?.targetVisited).toEqual([5, 8]);
    expect(profile?.mandatoryRoles).toEqual(['anchor', 'preparation', 'boss']);
    expect(profile?.attemptCap).toBe(50);
    expect(profile?.fallbackTemplateId).toBe('slice.act1.safe');
  });
});

describe('phase28 golden seeds fixture', () => {
  const fixture = readJson('fixtures/map-golden-seeds.json') as { readonly vectors: readonly { readonly caseId: string; readonly seed: number; readonly profileId: string }[] };

  it('pins twelve golden seeds against the standard profile', () => {
    expect(fixture.vectors).toHaveLength(12);
    for (const vector of fixture.vectors) {
      expect(vector.profileId).toBe('slice.act1.standard');
      expect(vector.seed).toBeGreaterThanOrEqual(1000);
    }
    expect(fixture.vectors[0]?.caseId).toBe('golden-00');
    expect(fixture.vectors[0]?.seed).toBe(1000);
  });
});

describe('phase28 node transition matrix', () => {
  const cases = (readJson('fixtures/node-transition-matrix.json') as { readonly cases: readonly TransitionCase[] }).cases;

  it('matches every pinned command outcome', () => {
    for (const transitionCase of cases) {
      if (transitionCase.to !== undefined) {
        expect(transition(transitionCase.from as never, transitionCase.to as never), transitionCase.command).toBe(transitionCase.to);
      } else {
        expect(catchExpeditionCode(() => transition(transitionCase.from as never, transitionCase.to as never)), transitionCase.command).not.toBeNull();
      }
    }
  });

  it('rejects unknown stages', () => {
    expect(isNodeStage('previewed')).toBe(true);
    expect(isNodeStage('teleporting')).toBe(false);
  });
});

describe('phase28 matrix fixtures', () => {
  it('pins the route-preview cases', () => {
    const fixture = readJson('fixtures/route-preview-matrix.json') as { readonly cases: readonly string[] };
    expect(fixture.cases).toEqual([
      'reachable_touch',
      'unreachable_touch',
      'keyboard_confirm',
      'gamepad_confirm',
      'restart_same_preview',
      'locale_same_domain',
      'text_scale_200',
      'pseudo_locale',
    ]);
  });

  it('pins the anchor cases', () => {
    const fixture = readJson('fixtures/anchor-matrix.json') as { readonly cases: readonly string[] };
    expect(fixture.cases).toContain('secure_success');
    expect(fixture.cases).toContain('secure_duplicate');
    expect(fixture.cases).toContain('storage_failure');
    expect(fixture.cases).toContain('resume_after_commit');
  });

  it('pins the kill-point boundaries', () => {
    const fixture = readJson('fixtures/kill-point-matrix.json') as { readonly boundaries: readonly string[] };
    expect(fixture.boundaries).toEqual([
      'before_enter_commit',
      'after_enter_commit',
      'before_decision_commit',
      'after_decision_commit',
      'before_reward_commit',
      'after_reward_commit',
      'before_exit_commit',
      'after_exit_commit',
    ]);
  });

  it('pins the invalid-map corpus', () => {
    const fixture = readJson('fixtures/invalid-map-corpus.json') as { readonly cases: readonly string[] };
    expect(fixture.cases).toEqual([
      'unreachable_boss',
      'missing_anchor',
      'missing_preparation',
      'duplicate_node_id',
      'edge_to_missing_node',
      'visit_length_below_min',
      'visit_length_above_max',
      'attempt_cap_exceeded',
    ]);
  });
});
