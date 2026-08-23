/**
 * Run screen module map — maps every loaderId from the run screen registry
 * to its React component. The ScreenModuleResolver reads this map at
 * navigation time. Node-type screens (S42–S49) all use the generic
 * NodeScreen which dispatches per-type via the expedition hook.
 */
import type { ScreenModule } from '../../app/navigation/screen-registration.js';
import { DefeatRecoveryScreen } from './DefeatRecoveryScreen.js';
import { DungeonMapScreen } from './DungeonMapScreen.js';
import { ExpeditionEndScreen } from './ExpeditionEndScreen.js';
import { NodeScreen } from './NodeScreen.js';
import { RewardChoiceScreen } from './RewardChoiceScreen.js';

export const runScreenModules: Readonly<Record<string, ScreenModule>> = {
  'screen.dungeonMap': { default: DungeonMapScreen },
  'screen.nodePreview': { default: NodeScreen },
  // Node-type screens — all dispatched generically by NodeScreen.
  'screen.event': { default: NodeScreen },
  'screen.merchant': { default: NodeScreen },
  'screen.recruitment': { default: NodeScreen },
  'screen.treasure': { default: NodeScreen },
  'screen.dungeonWorkshop': { default: NodeScreen },
  'screen.riftAltar': { default: NodeScreen },
  'screen.scoutPost': { default: NodeScreen },
  'screen.anchorPoint': { default: NodeScreen },
  'screen.preBattle': { default: NodeScreen },
  // Distinct screens.
  'screen.rewardChoice': { default: RewardChoiceScreen },
  'screen.expeditionEnd': { default: ExpeditionEndScreen },
  'screen.defeatRecovery': { default: DefeatRecoveryScreen },
  // Battle screens (Phase 25/26) — not yet implemented; placeholder.
  'screen.battle': { default: NodeScreen },
  'screen.battleInspector': { default: NodeScreen },
  'screen.battleResult': { default: NodeScreen },
};
