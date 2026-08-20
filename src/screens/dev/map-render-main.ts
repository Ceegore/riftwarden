import { generateMap } from '../../game/expedition/map-generator.js';
import { fnv1a } from '../../game/expedition/stable.js';
import type { ExpeditionMap, MapProfile } from '../../game/expedition/types.js';

/**
 * Dev-only visual harness (data-rw-dev-only marker; never part of the app
 * build): renders the twelve golden-seed S40 dungeon maps as deterministic
 * SVG geometry — nodes positioned by level (x) and a stable per-id hash (y),
 * edges as straight lines, colors by role. No text: the goldens pin the map
 * *structure* (what S40 shows), identity stays in the golden registry.
 * Results are exposed on window.__mapRenderHarness.
 */
declare global {
  interface Window {
    __mapRenderHarness?: unknown;
  }
}

export interface MapRenderResult {
  readonly rendered: readonly string[];
  readonly mapHashes: Readonly<Record<string, string>>;
  readonly error?: string;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const WIDTH = 600;
const HEIGHT = 400;
const LEVEL_X = [60, 156, 252, 348, 444, 540];
const ROLE_COLOR: Readonly<Record<string, string>> = {
  start: '#2ea043',
  normal: '#8b949e',
  preparation: '#bc8cff',
  anchor: '#58a6ff',
  boss: '#f85149',
};

const GOLDEN_SEEDS: readonly { readonly caseId: string; readonly seed: number }[] = [
  { caseId: 'golden-00', seed: 1000 },
  { caseId: 'golden-01', seed: 1001 },
  { caseId: 'golden-02', seed: 1002 },
  { caseId: 'golden-03', seed: 1003 },
  { caseId: 'golden-04', seed: 1004 },
  { caseId: 'golden-05', seed: 1005 },
  { caseId: 'golden-06', seed: 1006 },
  { caseId: 'golden-07', seed: 1007 },
  { caseId: 'golden-08', seed: 1008 },
  { caseId: 'golden-09', seed: 1009 },
  { caseId: 'golden-10', seed: 1010 },
  { caseId: 'golden-11', seed: 1011 },
];

const PROFILE: MapProfile = {
  id: 'slice.act1.standard',
  logicalLevels: 6,
  targetVisited: [5, 8],
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'slice.act1.safe',
};

function element(name: string, attributes: Readonly<Record<string, string>>): SVGElement {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    node.setAttribute(key, value);
  }
  return node;
}

function renderMap(map: ExpeditionMap, container: HTMLElement): void {
  const svg = element('svg', {
    width: String(WIDTH),
    height: String(HEIGHT),
    viewBox: `0 0 ${String(WIDTH)} ${String(HEIGHT)}`,
  });
  const byId = new Map(map.nodes.map((node) => [node.id, node]));
  const yOf = (id: string): number => 60 + (parseInt(fnv1a(id).slice(0, 4), 16) % 281);
  // Main path nodes carry a role; side branches are plain 'normal' nodes.
  const isMain = (id: string): boolean => (byId.get(id)?.role ?? 'normal') !== 'normal';
  for (const edge of map.edges) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (from === undefined || to === undefined) continue;
    const line = element('line', {
      x1: String(LEVEL_X[from.level] ?? 0),
      y1: String(yOf(from.id)),
      x2: String(LEVEL_X[to.level] ?? 0),
      y2: String(yOf(to.id)),
      stroke: '#30363d',
      'stroke-width': isMain(edge.from) && isMain(edge.to) ? '2' : '1',
    });
    svg.appendChild(line);
  }
  for (const node of map.nodes) {
    const color = ROLE_COLOR[node.role] ?? '#8b949e';
    const circle = element('circle', {
      cx: String(LEVEL_X[node.level] ?? 0),
      cy: String(yOf(node.id)),
      r: node.role === 'boss' ? '11' : node.role === 'start' ? '9' : '7',
      fill: color,
      stroke: '#0d1117',
      'stroke-width': '2',
    });
    svg.appendChild(circle);
  }
  container.appendChild(svg);
}

function main(): MapRenderResult {
  const maps = document.getElementById('maps');
  if (maps === null) throw new Error('maps container missing');
  const mapHashes: Record<string, string> = {};
  const rendered: string[] = [];
  for (const { caseId, seed } of GOLDEN_SEEDS) {
    const map = generateMap({ seed, profileId: PROFILE.id, contentRevision: 'test-content-revision' }, PROFILE);
    const card = document.createElement('div');
    card.className = 'map-card';
    card.id = `map-${caseId}`;
    renderMap(map, card);
    maps.appendChild(card);
    mapHashes[caseId] = map.mapHash;
    rendered.push(caseId);
  }
  return { rendered, mapHashes };
}

try {
  window.__mapRenderHarness = main();
} catch (error: unknown) {
  window.__mapRenderHarness = { rendered: [], mapHashes: {}, error: error instanceof Error ? error.message : String(error) };
}
