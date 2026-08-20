import { describe, expect, it } from 'vitest';
import { buildSceneGraph, EMPTY_SCENE_GRAPH_INPUT, emptySceneGraph, type SceneGraphInput } from '../../src/game/render/scene-graph.js';
import { createSnapshotPresenter } from '../../src/game/render/snapshot-presenter.js';
import type { InterpolatedFrameView } from '../../src/game/render/snapshot-presenter.js';
import { baselineQuality, degradeQuality, isFullyDegraded } from '../../src/game/render/quality.js';
import { COSMETIC_KINDS } from '../../src/game/render/pool-policy.js';
import type { EntityFrame } from '../../src/game/render/types.js';
import { entity, frame, hexHash } from './phase25-helpers.js';

function viewFor(tick: number, entityOverrides: readonly Partial<EntityFrame>[]): InterpolatedFrameView {
  const presenter = createSnapshotPresenter();
  presenter.submitConfirmed(frame(tick, entityOverrides.map((overrides, index) => entity(`e${String(index)}`, overrides)), hexHash(tick)));
  return presenter.present(1000);
}

function sceneGraphInput(overrides: Partial<SceneGraphInput> = {}): SceneGraphInput {
  return {
    projectiles: [{ id: 'p1', fromX100: 100, toX100: 800, progress1000: 500 }],
    effects: COSMETIC_KINDS.map((kind, index) => ({ id: `fx${String(index)}`, kind, x100: 300 + index * 40, progress1000: 250, lane: 1 })),
    telegraphs: [{ id: 't1', x100: 700, lane: 2, severity: 2 }],
    ...overrides,
  };
}

describe('scene-graph descriptor', () => {
  it('maps units to their presentation layers and never drops them', () => {
    const view = viewFor(0, [{ lane: 0, logicalX100: 100 }, { lane: 1, logicalX100: 200 }, { lane: 2, logicalX100: 300 }]);
    let quality = baselineQuality('high');
    while (!isFullyDegraded(quality)) quality = degradeQuality(quality);
    const graph = buildSceneGraph(view, EMPTY_SCENE_GRAPH_INPUT, quality);
    const units = graph.nodes.filter((node) => node.kind === 'unit');
    expect(units.map((node) => node.layerId)).toEqual([2, 3, 3]);
    expect(units.map((node) => node.x100)).toEqual([100, 200, 300]);
    expect(units.map((node) => node.cosmetic)).toEqual([null, null, null]);
  });

  it('drops cosmetic effects per the quality profile and keeps criticals', () => {
    const view = viewFor(0, [{}]);
    const high = buildSceneGraph(view, sceneGraphInput(), baselineQuality('high'));
    expect(high.nodes.filter((node) => node.kind === 'effect')).toHaveLength(COSMETIC_KINDS.length);
    let reduced = baselineQuality('high');
    while (!isFullyDegraded(reduced)) reduced = degradeQuality(reduced);
    const lowGraph = buildSceneGraph(view, sceneGraphInput(), reduced);
    expect(lowGraph.nodes.filter((node) => node.kind === 'effect')).toHaveLength(0);
    // Projectiles and telegraphs survive any pressure.
    expect(lowGraph.nodes.filter((node) => node.kind === 'projectile')).toHaveLength(1);
    expect(lowGraph.nodes.filter((node) => node.kind === 'telegraph')).toHaveLength(1);
  });

  it('keeps readability telegraphs above effects in layer order', () => {
    const view = viewFor(0, [{}]);
    const graph = buildSceneGraph(view, sceneGraphInput(), baselineQuality('high'));
    const layers = graph.nodes.map((node) => node.layerId);
    expect(layers).toEqual([...layers].sort((a, b) => a - b));
    const telegraph = graph.nodes.find((node) => node.kind === 'telegraph');
    expect(telegraph?.layerId).toBe(6);
  });

  it('produces identical graphs for permuted input (determinism)', () => {
    const view = viewFor(0, [{ lane: 1, logicalX100: 100 }, { lane: 0, logicalX100: 50 }]);
    const input = sceneGraphInput();
    const a = buildSceneGraph(view, input, baselineQuality('high'));
    const b = buildSceneGraph(view, { ...input, effects: [...input.effects].reverse(), telegraphs: [...input.telegraphs].reverse() }, baselineQuality('high'));
    expect(a).toEqual(b);
  });

  it('orders units canonically by lane, x, stable id', () => {
    const view = viewFor(0, [{ lane: 1, logicalX100: 100 }, { lane: 0, logicalX100: 50 }, { lane: 0, logicalX100: 50 }]);
    const graph = buildSceneGraph(view, EMPTY_SCENE_GRAPH_INPUT, baselineQuality('high'));
    const unitIds = graph.nodes.filter((node) => node.kind === 'unit').map((node) => node.id);
    expect(unitIds).toEqual(['e1', 'e2', 'e0']);
  });

  it('carries projectile flight start/end and progress', () => {
    const view = viewFor(0, [{}]);
    const graph = buildSceneGraph(view, sceneGraphInput(), baselineQuality('high'));
    const projectile = graph.nodes.find((node) => node.kind === 'projectile');
    expect(projectile?.fromX100).toBe(100);
    expect(projectile?.toX100).toBe(800);
    expect(projectile?.progress1000).toBe(500);
    expect(projectile?.layerId).toBe(4);
  });

  it('exposes an empty scene graph for teardown', () => {
    expect(emptySceneGraph()).toEqual({ tick: 0, gameplayHash: '', nodes: [] });
  });
});
