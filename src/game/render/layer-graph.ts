import type { Lane, LayerId } from './types.js';

/**
 * Fixed presentation layer graph (LAYER_GRAPH_SORT_CONTRACT). Layer order is
 * immutable authority; readability (6) always draws above effects (5), and
 * debug (7) is excluded from release bundles.
 */
export const LAYER_ORDER: readonly { readonly id: LayerId; readonly name: string }[] = Object.freeze([
  { id: 0, name: 'background' },
  { id: 1, name: 'ground' },
  { id: 2, name: 'back_units' },
  { id: 3, name: 'main_units' },
  { id: 4, name: 'projectiles' },
  { id: 5, name: 'effects' },
  { id: 6, name: 'readability' },
  { id: 7, name: 'debug' },
]);

export const READABILITY_LAYER_ID: LayerId = 6;
export const DEBUG_LAYER_ID: LayerId = 7;

export function layerIdByName(name: string): LayerId | null {
  for (const layer of LAYER_ORDER) {
    if (layer.name === name) return layer.id;
  }
  return null;
}

export function layerNameById(id: number): string | null {
  for (const layer of LAYER_ORDER) {
    if (layer.id === id) return layer.name;
  }
  return null;
}

/**
 * Layer ids that participate in a bundle. Debug is development-only and must
 * be excluded from release (compile flag + bundle scan).
 */
export function releaseLayerIds(includeDebug: boolean): readonly LayerId[] {
  const ids = LAYER_ORDER.map((layer) => layer.id);
  return includeDebug ? ids : ids.filter((id) => id !== DEBUG_LAYER_ID);
}

/**
 * Presentation-layer assignment for entity frames. Lane 0 (top) renders as
 * back units; lanes 1 and 2 render as main units. This is a presentation
 * mapping only — gameplay authority never flows through it.
 */
export function entityLayerId(lane: Lane): LayerId {
  return lane === 0 ? 2 : 3;
}
