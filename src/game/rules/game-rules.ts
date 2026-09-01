import { deepFreeze } from './deep-freeze.js';
import { SAVE_RULES } from './save-rules.js';
import { TECHNICAL_RULES } from './technical-rules.js';
import { UI_RULES } from './ui-rules.js';
const TPS = TECHNICAL_RULES.simulationTicksPerSecond;
export const GAME_RULES = deepFreeze({
  simulationTicksPerSecond: TPS,
  formationLanes: 3,
  formationDepths: 3,
  maxRegularUnitsPerSide: 7,
  maxHeroesPerPlayerGroup: 3,
  maxCopiesPerTroopType: 3,
  maxActiveSummonsPerSide: 6,
  baseActiveRelics: 6,
  deepEndlessActiveRelics: 8,
  absoluteMaxActiveRelics: 8,
  heroLevelMin: 1,
  heroLevelMax: 3,
  permanentEquipmentSlotsPerHero: 2,
  formationPresetCount: 4,
  normalRiftCollapseStartTicks: 90 * TPS,
  eliteRiftCollapseStartTicks: 90 * TPS,
  bossRiftCollapseStartTicks: 120 * TPS,
  riftCollapseDurationTicks: 15 * TPS,
  absoluteBattleAbortTicks: 180 * TPS,
  autosaveRotationSlots: SAVE_RULES.autosaveRotationSlots,
  supportedLocales: UI_RULES.supportedLocales,
} as const);
export type GameRules = typeof GAME_RULES;
