/**
 * HQ screen module map — maps every loaderId from the HQ screen registry
 * to its React component. Added to the ScreenModuleResolver alongside
 * run screen modules.
 */
import type { ScreenModule } from '../../app/navigation/screen-registration.js';
import { NewGameScreen } from './NewGameScreen.js';
import { GlobalHelpScreen } from './GlobalHelpScreen.js';
import { MissionBoardScreen } from './MissionBoardScreen.js';
import { MissionDetailsScreen } from './MissionDetailsScreen.js';

export const hqScreenModules: Readonly<Record<string, ScreenModule>> = {
  'screen.newGame': { default: NewGameScreen },
  'screen.globalHelp': { default: GlobalHelpScreen },
  'screen.missionBoard': { default: MissionBoardScreen },
  'screen.missionDetails': { default: MissionDetailsScreen },
};
