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
import { AchievementsScreen } from './AchievementsScreen.js';
import { ArchiveHubScreen } from './ArchiveHubScreen.js';
import { CodexListScreen } from './CodexListScreen.js';
import { CodexDetailsScreen } from './CodexDetailsScreen.js';
import { MasteryScreen } from './MasteryScreen.js';
import { RecordsStatisticsScreen } from './RecordsStatisticsScreen.js';
import { StoryArchiveScreen } from './StoryArchiveScreen.js';
import { AscensionRanksScreen } from './AscensionRanksScreen.js';
import { ConstellationScreen } from './ConstellationScreen.js';
import { CyclePreparationScreen } from './CyclePreparationScreen.js';
import { BeyondSetupScreen } from './BeyondSetupScreen.js';
import { EndlessSetupScreen } from './EndlessSetupScreen.js';
import { RiftChamberScreen } from './RiftChamberScreen.js';
import { EquipmentScreen } from './EquipmentScreen.js';
import { KitAssemblyScreen } from './KitAssemblyScreen.js';
import { BannerSetupScreen } from './BannerSetupScreen.js';
import { FormationScreen } from './FormationScreen.js';
// Phase 39-41: Settings screens
import { AudioSettingsScreen } from './AudioSettingsScreen.js';
import { AccessibilitySettingsScreen } from './AccessibilitySettingsScreen.js';
import { ControlsSettingsScreen } from './ControlsSettingsScreen.js';
import { GraphicsSettingsScreen } from './GraphicsSettingsScreen.js';

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
  // Phase 35
  'screen.achievements': { default: AchievementsScreen },
  'screen.archiveHub': { default: ArchiveHubScreen },
  'screen.codexList': { default: CodexListScreen },
  'screen.codexDetails': { default: CodexDetailsScreen },
  'screen.mastery': { default: MasteryScreen },
  'screen.recordsStatistics': { default: RecordsStatisticsScreen },
  'screen.storyArchive': { default: StoryArchiveScreen },
  // Phase 36
  'screen.ascensionRanks': { default: AscensionRanksScreen },
  'screen.constellation': { default: ConstellationScreen },
  'screen.cyclePreparation': { default: CyclePreparationScreen },
  'screen.beyondSetup': { default: BeyondSetupScreen },
  'screen.endlessSetup': { default: EndlessSetupScreen },
  'screen.riftChamber': { default: RiftChamberScreen },
  // Phase 37
  'screen.equipmentPicker': { default: EquipmentScreen },
  'screen.kitPicker': { default: KitAssemblyScreen },
  'screen.bannerPicker': { default: BannerSetupScreen },
  'screen.formationPreview': { default: FormationScreen },
  // Phase 39-41: Settings
  'screen.accessibilitySettings': { default: AccessibilitySettingsScreen },
  'screen.audioSettings': { default: AudioSettingsScreen },
  'screen.controlsSettings': { default: ControlsSettingsScreen },
  'screen.graphicsSettings': { default: GraphicsSettingsScreen },
};
