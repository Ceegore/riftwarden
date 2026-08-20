import { sha256Hex } from '../sim/snapshot/sha256.js';
import { ExpeditionError } from './expedition-error.js';
import { validateMap } from './reachability.js';
import { compareCodeUnit, nextU32 } from './stable.js';
import type { ExpeditionMap, MapEdge, MapNode, MapProfile, NodeId, NodeRole } from './types.js';

/**
 * Deterministic map generator (MAP_GENERATOR_CONTRACT): canonical input
 * (seed, profile id, content revision), stable node/edge ids, six logical
 * levels, mandatory anchor/preparation/boss on a reachable start→boss route,
 * target visit length 5–8, at most 50 attempts with an explicit versioned
 * fallback template. Mandatory rules are never relaxed; a failed attempt
 * consumes a documented deterministic attempt stream; every generated value
 * derives from the persisted seed — a restart never rerolls.
 */
export interface MapGenerationInput {
  readonly seed: number;
  readonly profileId: string;
  readonly contentRevision: string;
}

const LEVELS = 6;
const ROLE_BY_LEVEL: readonly (NodeRole | undefined)[] = ['start', undefined, 'preparation', 'anchor', undefined, 'boss'];

function makeNode(id: string, level: number, role: NodeRole): MapNode {
  const type = role === 'anchor' ? 'anchor' : 'battle';
  return { id, level, type, role, previewKey: `preview.${id}`, instabilityDelta: type === 'anchor' ? -10 : 5 };
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
    let id = `n${String(level)}_${String(r % 997).padStart(3, '0')}`;
    let guard = 0;
    while (mainIds.has(id) && guard < 16) {
      r = nextU32(r);
      id = `n${String(level)}_${String(r % 997).padStart(3, '0')}`;
      guard += 1;
    }
    mainIds.add(id);
    nodes.push(makeNode(id, level, role));
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
        const sideId = `n${String(level)}s${String(side)}_${String(r % 997).padStart(3, '0')}`;
        nodes.push(makeNode(sideId, level, 'normal'));
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
    const id = `fallback_${String(level)}`;
    nodes.push(makeNode(id, level, role));
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
