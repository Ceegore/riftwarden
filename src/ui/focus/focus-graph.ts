/**
 * Phase 40: Focus graph (FOCUS_GRAPH_CONTRACT).
 *
 * Declarative focus order management. Each screen defines a focus
 * graph; the runtime traps focus within the active screen/overlay,
 * respects the tab order, and supports keyboard + gamepad inputs.
 */

export type FocusDirection = 'forward' | 'backward' | 'up' | 'down' | 'left' | 'right';

export interface FocusNode {
  readonly id: string;
  readonly nextId?: string;
  readonly prevId?: string;
  readonly upId?: string;
  readonly downId?: string;
  readonly leftId?: string;
  readonly rightId?: string;
  readonly trapGroup?: string;
}

export interface FocusGraph {
  readonly nodes: readonly FocusNode[];
  readonly defaultFocusId: string;
}

export function buildFocusGraph(nodes: readonly FocusNode[], defaultFocusId: string): FocusGraph {
  const ids = new Set(nodes.map((n) => n.id));
  if (!ids.has(defaultFocusId)) {
    throw new Error(`FOCUS: defaultFocusId ${defaultFocusId} not in graph`);
  }
  return { nodes, defaultFocusId };
}

export function resolveNextFocus(
  graph: FocusGraph,
  currentId: string,
  direction: FocusDirection,
): string | null {
  const node = graph.nodes.find((n) => n.id === currentId);
  if (node === undefined) return null;

  const targetId = ((): string | undefined => {
    switch (direction) {
      case 'forward': return node.nextId;
      case 'backward': return node.prevId;
      case 'up': return node.upId;
      case 'down': return node.downId;
      case 'left': return node.leftId;
      case 'right': return node.rightId;
    }
  })();

  if (targetId !== undefined && graph.nodes.some((n) => n.id === targetId)) {
    return targetId;
  }
  return null;
}

export function isInTrapGroup(
  graph: FocusGraph,
  nodeId: string,
  trapGroup: string,
): boolean {
  const node = graph.nodes.find((n) => n.id === nodeId);
  return node?.trapGroup === trapGroup;
}

export function trapGroupNodes(
  graph: FocusGraph,
  trapGroup: string,
): readonly string[] {
  return graph.nodes
    .filter((n) => n.trapGroup === trapGroup)
    .map((n) => n.id);
}
