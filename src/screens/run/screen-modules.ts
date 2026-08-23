/**
 * Run screen module map — maps the loaderId from the screen registry
 * to the actual React component. This is resolved at import time so
 * the ScreenModuleResolver can synchronously return components for
 * the expedition screens.
 */
import { DungeonMapScreen } from './DungeonMapScreen.js';
import { NodeScreen } from './NodeScreen.js';

export const runScreenModules: Readonly<Record<string, unknown>> = {
  'screen.dungeonMap': { default: DungeonMapScreen },
  'screen.nodePreview': { default: NodeScreen },
};
