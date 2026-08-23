/**
 * Run screen module map — maps the loaderId from the screen registry
 * to the actual React component. The ScreenModuleResolver reads this
 * map to resolve screens at navigation time.
 */
import type { ScreenModule } from '../../app/navigation/screen-registration.js';
import { DungeonMapScreen } from './DungeonMapScreen.js';
import { NodeScreen } from './NodeScreen.js';

export const runScreenModules: Readonly<Record<string, ScreenModule>> = {
  'screen.dungeonMap': { default: DungeonMapScreen },
  'screen.nodePreview': { default: NodeScreen },
};
