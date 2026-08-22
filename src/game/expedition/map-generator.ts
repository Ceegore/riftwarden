import { sha256Hex } from '../sim/snapshot/sha256.js';
import { ExpeditionError } from './expedition-error.js';
import { definitionOf } from './node-registry.js';
import { validateMap } from './reachability.js';
import { compareCodeUnit, nextU32 } from './stable.js';
import type { ExpeditionMap, MapEdge, MapNode, MapProfile, NodeId, NodeRole, NodeType } from './types.js';

/**
 * Deterministic map generator (MAP_GENERATOR_CONTRACT): canonical input
 * (seed, profile id, content revision), stable node/edge ids, six logical
 * levels, mandatory anchor/preparation/boss on a reachable start→boss route,
 * target visit length 5–8, at most 50 attempts with an explicit versioned
 * fallback template. Mandatory rules are never relaxed; a failed attempt
 * consumes a documented deterministic attempt stream; every generated value
 * derives from the persisted seed — a restart never rerolls.
 *
 * Node-type assignment is content-versioned (FULL_GENERATOR_QA_CONTRACT):
 * content revisions with the Phase 32 marker ("32") distribute normal slots
 * by the GDD §19.2 regional weights so all closed-registry node families are
 * reachable; legacy revisions keep the Phase 28 minimum (battle/anchor only)
 * byte-identical — a restart or an older save never reinterprets content.
 */
export interface MapGenerationInput {
  readonly seed: number;
  readonly profileId: string;
  readonly contentRevision: string;
}

const LEVELS = 6;
const ROLE_BY_LEVEL: readonly (NodeRole | undefined)[] = ['start', undefined, 'preparation', 'anchor', undefined, 'boss'];

/** GDD §19.2 regional weights for normal slots (sum 100). */
const NORMAL_TYPE_WEIGHTS: readonly (readonly [NodeType, number])[] = [
  ['battle', 35],
  ['elite', 12],
  ['event', 15],
  ['merchant', 8],
  ['treasure', 8],
  ['recruitment', 7],
  ['workshop', 5],
  ['altar', 4],
  ['scout', 6],
];

function isFullContent(contentRevision: string): boolean {
  return contentRevision.startsWith('32');
}

function pickNormalType(r: number): NodeType {
  const roll = r % 100;
  let cursor = 0;
  for (const [type, weight] of NORMAL_TYPE_WEIGHTS) {
    cursor += weight;
    if (roll < cursor) return type;
  }
  return 'battle';
}

/** Role slots keep fixed types; only normal slots are regionally weighted. */
function typeForRole(role: NodeRole, fullContent: boolean): NodeType {
  if (role === 'anchor') return 'anchor';
  if (role === 'boss') return fullContent ? 'boss' : 'battle';
  return 'battle';
}

function makeNode(id: string, level: number, role: NodeRole, type: NodeType): MapNode {
  return { id, level, type, role, previewKey: `preview.${id}`, instabilityDelta: definitionOf(type).defaultInstabilityDelta };
}

function canonicalNodes(nodes: readonly MapNode[]): readonly MapNode[] {
  return [...nodes].sort((a, b) => compareCodeUnit(a.id, b.id));
}

function canonicalEdges(edges: readonly MapEdge[]): readonly MapEdge[] {
  return [...edges].sort((a, b) => compareCodeUnit(a.id, b.id));
}

export function structuralHash(nodes: readonly MapNode[], edges: readonly MapEdge[], profileId: string, contentRevision: string): string {
  const canonical = JSON.stringify({ profileId, contentRevision, nodes: canonicalNodes(nodes), edges: canonicalEdges(edges) });
  return sha256Hex(new TextEncoder().encode(canonical));
}

/** Builds one deterministic candidate for (seed, profile, attempt). */
export function buildCandidate(input: MapGenerationInput, profile: MapProfile, attempt: number): ExpeditionMap {
  let r = input.seed >>> 0;
  for (let i = 0; i < input.contentRevision.length; i += 1) {
    r = nextU32(r ^ input.contentRevision.charCodeAt(i));
  }
  r = nextU32(r ^ attempt);
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const path: NodeId[] = [];
  const mainIds = new Set<string>();
  for (let level = 0; level < LEVELS; level += 1) {
    r = nextU32(r);
    const role = ROLE_BY_LEVEL[level] ?? 'normal';
    const fullContent = isFullContent(input.contentRevision);
    const type = role === 'normal' && fullContent ? pickNormalType(nextU32(r)) : typeForRole(role, fullContent);
    let id = `n${String(level)}_${String(r % 997).padStart(3, '0')}`;
    let guard = 0;
    while (mainIds.has(id) && guard < 16) {
      r = nextU32(r);
      id = `n${String(level)}_${String(r % 997).padStart(3, '0')}`;
      guard += 1;
    }
    mainIds.add(id);
    nodes.push(makeNode(id, level, role, type));
    path.push(id);
    if (level > 0) {
      const from = path[level - 1];
      if (from === undefined) throw new ExpeditionError('INVALID_MAP', { reason: 'path-invariant' });
      edges.push({ id: `e_${from}_${id}`, from, to: id });
    }
    // Side branches on levels 1..4 (0..2 extra nodes) keep the map branching.
    if (level >= 1 && level <= 4) {
      r = nextU32(r);
      const sideCount = r % 3;
      for (let side = 0; side < sideCount; side += 1) {
        r = nextU32(r);
        const sideType = isFullContent(input.contentRevision) ? pickNormalType(nextU32(r)) : 'battle';
        const sideId = `n${String(level)}s${String(side)}_${String(r % 997).padStart(3, '0')}`;
        nodes.push(makeNode(sideId, level, 'normal', sideType));
        const from = path[level - 1];
        if (from === undefined) throw new ExpeditionError('INVALID_MAP', { reason: 'path-invariant' });
        edges.push({ id: `e_${from}_${sideId}`, from, to: sideId });
        edges.push({ id: `e_${sideId}_${id}`, from: sideId, to: id });
      }
    }
  }
  const startNodeId = path[0];
  const bossNodeId = path[5];
  if (startNodeId === undefined || bossNodeId === undefined) throw new ExpeditionError('INVALID_MAP', { reason: 'path-invariant' });
  return {
    profileId: profile.id,
    seed: input.seed,
    contentRevision: input.contentRevision,
    nodes: canonicalNodes(nodes),
    edges: canonicalEdges(edges),
    startNodeId,
    bossNodeId,
    usedFallback: false,
    attempts: attempt,
    mapHash: structuralHash(nodes, edges, profile.id, input.contentRevision),
  };
}

/** The explicit versioned fallback template: never weakens mandatory rules. */
export function buildFallback(input: MapGenerationInput, profile: MapProfile, cap: number): ExpeditionMap {
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const path: NodeId[] = [];
  for (let level = 0; level < LEVELS; level += 1) {
    const role = ROLE_BY_LEVEL[level] ?? 'normal';
    const type = typeForRole(role, isFullContent(input.contentRevision));
    const id = `fallback_${String(level)}`;
    nodes.push(makeNode(id, level, role, type));
    path.push(id);
    if (level > 0) {
      const from = path[level - 1];
      if (from === undefined) throw new ExpeditionError('INVALID_MAP', { reason: 'fallback-invariant' });
      edges.push({ id: `fallback_e_${String(level)}`, from, to: id });
    }
  }
  const startNodeId = path[0];
  const bossNodeId = path[5];
  if (startNodeId === undefined || bossNodeId === undefined) throw new ExpeditionError('INVALID_MAP', { reason: 'fallback-invariant' });
  return {
    profileId: profile.id,
    seed: input.seed,
    contentRevision: input.contentRevision,
    nodes: canonicalNodes(nodes),
    edges: canonicalEdges(edges),
    startNodeId,
    bossNodeId,
    usedFallback: true,
    attempts: cap,
    mapHash: structuralHash(nodes, edges, profile.id, input.contentRevision),
  };
}

export function generateMap(input: MapGenerationInput, profile: MapProfile): ExpeditionMap {
  for (let attempt = 1; attempt <= profile.attemptCap; attempt += 1) {
    const candidate = buildCandidate(input, profile, attempt);
    if (validateMap(candidate, profile).length === 0) return candidate;
  }
  return buildFallback(input, profile, profile.attemptCap);
}
