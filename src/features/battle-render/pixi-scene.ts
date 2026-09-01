import { Container, Graphics } from 'pixi.js';
import type { Application } from 'pixi.js';
import type { SceneGraph, SceneNode, SceneNodeKind } from '../../game/render/scene-graph.js';
import type { LayerId, Lane } from '../../game/render/types.js';

/**
 * Thin Pixi 8 binding over the pure scene-graph descriptor. One container per
 * layer (zIndex = layerId, readability above effects, debug excluded in
 * release). Nodes are dev silhouettes (Graphics rectangles) keyed by stable
 * node id: sync() creates/updates/removes exactly the nodes present in the
 * graph; teardown() deterministically destroys every container and node —
 * pool teardown leaves nothing behind. All gameplay authority stays in the
 * snapshot layer; this binding only presents.
 */
const NODE_COLORS: Readonly<Record<SceneNodeKind, number>> = Object.freeze({
  unit: 0x2e7d32,
  projectile: 0xffb300,
  telegraph: 0xff5252,
  effect: 0x8e24aa,
});

const LANE_Y: Readonly<Record<Lane, number>> = Object.freeze({ 0: 0.3, 1: 0.5, 2: 0.7 });

export interface PixiScene {
  readonly nodeCount: number;
  sync(graph: SceneGraph): void;
  teardown(): void;
}

export function createPixiScene(app: Application, layers: readonly LayerId[]): PixiScene {
  const containers = new Map<LayerId, Container>();
  for (const layerId of layers) {
    const container = new Container();
    container.zIndex = layerId;
    app.stage.addChild(container);
    containers.set(layerId, container);
  }
  app.stage.sortableChildren = true;

  const nodes = new Map<string, { node: SceneNode; gfx: Graphics }>();
  let nodeCount = 0;

  function scaleX(): number {
    return app.screen.width / 1920;
  }

  function makeGraphics(node: SceneNode): Graphics {
    const gfx = new Graphics();
    const x = (node.x100 / 100) * scaleX();
    const y = LANE_Y[node.lane] * app.screen.height;
    const width = 48 * scaleX();
    const height = 96 * scaleX();
    gfx.rect(x - width / 2, y - height / 2, width, height);
    gfx.fill(NODE_COLORS[node.kind]);
    gfx.alpha = node.kind === 'effect' || node.kind === 'projectile' ? 0.5 + 0.5 * (node.progress1000 / 1000) : 1;
    return gfx;
  }

  function create(node: SceneNode): void {
    const container = containers.get(node.layerId);
    if (container === undefined) return;
    const gfx = makeGraphics(node);
    container.addChild(gfx);
    nodes.set(node.id, { node, gfx });
  }

  function update(entry: { node: SceneNode; gfx: Graphics }, node: SceneNode): void {
    const gfx = entry.gfx;
    const x = (node.x100 / 100) * scaleX();
    const y = LANE_Y[node.lane] * app.screen.height;
    const width = 48 * scaleX();
    const height = 96 * scaleX();
    gfx.clear();
    gfx.rect(x - width / 2, y - height / 2, width, height);
    gfx.fill(NODE_COLORS[node.kind]);
    gfx.alpha = node.kind === 'effect' || node.kind === 'projectile' ? 0.5 + 0.5 * (node.progress1000 / 1000) : 1;
    entry.node = node;
  }

  return {
    get nodeCount() {
      return nodeCount;
    },
    sync(graph) {
      const seen = new Set<string>();
      for (const node of graph.nodes) {
        seen.add(node.id);
        const existing = nodes.get(node.id);
        if (existing === undefined) create(node);
        else update(existing, node);
      }
      for (const [id, entry] of nodes) {
        if (!seen.has(id)) {
          entry.gfx.destroy();
          nodes.delete(id);
        }
      }
      nodeCount = nodes.size;
    },
    teardown() {
      for (const entry of nodes.values()) entry.gfx.destroy();
      nodes.clear();
      for (const container of containers.values()) container.destroy({ children: true });
      containers.clear();
      nodeCount = 0;
    },
  };
}
