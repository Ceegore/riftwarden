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
import { HqOverviewScreen } from './HqOverviewScreen.js';
import { HeroHallScreen } from './HeroHallScreen.js';
import { HeroDetailsScreen } from './HeroDetailsScreen.js';
import { BarracksScreen } from './BarracksScreen.js';
import { TroopDetailsScreen } from './TroopDetailsScreen.js';
import { WorkshopScreen } from './WorkshopScreen.js';
import { ItemDetailsScreen } from './ItemDetailsScreen.js';

export const hqScreenModules: Readonly<Record<string, ScreenModule>> = {
  'screen.newGame': { default: NewGameScreen },
  'screen.globalHelp': { default: GlobalHelpScreen },
  'screen.missionBoard': { default: MissionBoardScreen },
  'screen.missionDetails': { default: MissionDetailsScreen },
  'screen.hqOverview': { default: HqOverviewScreen },
  'screen.heroHall': { default: HeroHallScreen },
  'screen.heroDetails': { default: HeroDetailsScreen },
  'screen.barracks': { default: BarracksScreen },
  'screen.troopDetails': { default: TroopDetailsScreen },
  'screen.workshop': { default: WorkshopScreen },
  'screen.itemDetails': { default: ItemDetailsScreen },
};
