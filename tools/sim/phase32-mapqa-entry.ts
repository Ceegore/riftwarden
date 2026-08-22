/**
 * Full-generator QA kernel entry (bundled through Vite SSR): exposes the
 * real map generator, reachability and registry surface that the 100,000-map
 * harness pins. Not part of the game runtime — exists only for the
 * deterministic QA evidence harness.
 */
export { generateMap, buildCandidate, buildFallback, structuralHash } from '../../src/game/expedition/map-generator.js';
export { validateMap, reachableFrom, mainPathLength, MAP_VIOLATION_CODES } from '../../src/game/expedition/reachability.js';
export { createRunState, currentNode } from '../../src/game/expedition/run-state.js';
export { NODE_TYPES } from '../../src/game/expedition/types.js';
export { NODE_REGISTRY } from '../../src/game/expedition/node-registry.js';
