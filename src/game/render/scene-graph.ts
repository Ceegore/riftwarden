import type { CosmeticKind } from './pool-policy.js';
import type { InterpolatedEntityView } from './snapshot-presenter.js';
import type { QualityProfile } from './quality.js';
import type { Lane, LayerId, VisualState } from './types.js';
import { compareCodeUnits } from './stable-sort.js';

/**
 * Pure scene-graph descriptor: maps an interpolated presentation view plus
 * projectile/effect/telegraph inputs into a flat, deterministically ordered
 * node list consumed by renderer backends (Pixi binding, dev silhouettes,
 * future release art). Draw order is layerId ascending; units keep the
 * canonical (lane, x, stable id) order. Quality pressure drops cosmetic
 * effect nodes only — units, projectiles and telegraphs are never dropped.
 */
export type SceneNodeKind = 'unit' | 'projectile' | 'telegraph' | 'effect';

export interface SceneNode {
  readonly id: string;
  readonly kind: SceneNodeKind;
  readonly layerId: LayerId;
  readonly x100: number;
  readonly progress1000: number;
  readonly lane: Lane;
  readonly visualState: VisualState;
  /** Cosmetic pool the node belongs to; null when never droppable. */
  readonly cosmetic: CosmeticKind | null;
  /** Projectile flight start (logical X * 100). */
  readonly fromX100?: number;
  /** Projectile flight end (logical X * 100). */
  readonly toX100?: number;
}

export interface ProjectileView {
  readonly id: string;
  readonly fromX100: number;
  readonly toX100: number;
  readonly progress1000: number;
}

export interface EffectView {
  readonly id: string;
  readonly kind: CosmeticKind;
  readonly x100: number;
  readonly progress1000: number;
  readonly lane: Lane;
}

export interface TelegraphView {
  readonly id: string;
  readonly x100: number;
  readonly lane: Lane;
  readonly severity: number;
}

export interface SceneGraphInput {
  readonly projectiles: readonly ProjectileView[];
  readonly effects: readonly EffectView[];
  readonly telegraphs: readonly TelegraphView[];
}

export interface SceneGraph {
  readonly tick: number;
  readonly gameplayHash: string;
  readonly nodes: readonly SceneNode[];
}

export const EMPTY_SCENE_GRAPH_INPUT: SceneGraphInput = Object.freeze({ projectiles: [], effects: [], telegraphs: [] });

export function emptySceneGraph(): SceneGraph {
  return { tick: 0, gameplayHash: '', nodes: [] };
}

function compareNodes(a: SceneNode, b: SceneNode): number {
  if (a.layerId !== b.layerId) return a.layerId - b.layerId;
  if (a.kind === 'unit' && b.kind === 'unit') {
    return a.lane - b.lane || a.x100 - b.x100 || compareCodeUnits(a.id, b.id);
  }
  return a.x100 - b.x100 || compareCodeUnits(a.id, b.id);
}

export function buildSceneGraph(view: InterpolatedEntityViewProvider, input: SceneGraphInput, quality: QualityProfile): SceneGraph {
  const nodes: SceneNode[] = [];
  for (const entity of view.entities) {
    nodes.push({
      id: entity.id,
      kind: 'unit',
      layerId: entity.layerId,
      x100: entity.logicalX100,
      progress1000: entity.clipProgress1000,
      lane: entity.lane,
      visualState: entity.visualState,
      cosmetic: null,
    });
  }
  for (const projectile of input.projectiles) {
    nodes.push({
      id: projectile.id,
      kind: 'projectile',
      layerId: 4,
      x100: projectile.toX100,
      progress1000: projectile.progress1000,
      lane: 1,
      visualState: 'idle',
      cosmetic: null,
      fromX100: projectile.fromX100,
      toX100: projectile.toX100,
    });
  }
  for (const telegraph of input.telegraphs) {
    nodes.push({
      id: telegraph.id,
      kind: 'telegraph',
      layerId: 6,
      x100: telegraph.x100,
      progress1000: 0,
      lane: telegraph.lane,
      visualState: 'idle',
      cosmetic: null,
    });
  }
  for (const effect of input.effects) {
    if (quality.droppedCosmetics.includes(effect.kind)) continue;
    nodes.push({
      id: effect.id,
      kind: 'effect',
      layerId: 5,
      x100: effect.x100,
      progress1000: effect.progress1000,
      lane: effect.lane,
      visualState: 'idle',
      cosmetic: effect.kind,
    });
  }
  return { tick: view.tick, gameplayHash: view.gameplayHash, nodes: [...nodes].sort(compareNodes) };
}

export interface InterpolatedEntityViewProvider {
  readonly tick: number;
  readonly gameplayHash: string;
  readonly entities: readonly InterpolatedEntityView[];
}
