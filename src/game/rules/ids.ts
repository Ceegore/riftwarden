declare const idBrand: unique symbol;
export type ContentId = string & { readonly [idBrand]: 'ContentId' };
export type EntityId = string & { readonly [idBrand]: 'EntityId' };
export type ScreenId = string & { readonly [idBrand]: 'ScreenId' };
export type LocalizationKey = string & { readonly [idBrand]: 'LocalizationKey' };
export const CONTENT_ID_PREFIXES = Object.freeze([
  'hero_',
  'troop_',
  'summon_',
  'enemy_',
  'boss_',
  'ability_',
  'attack_',
  'status_',
  'trait_',
  'synergy_',
  'item_',
  'talisman_',
  'kit_',
  'banner_',
  'relic_',
  'mission_',
  'encounter_',
  'event_',
  'modifier_',
  'achievement_',
  'mastery_',
  'screen_',
  'audio_',
  'visual_'
] as const);
export const SCREEN_IDS = Object.freeze([
  'nativeSplash',
  'bootstrapRecovery',
  'firstRun',
  'title',
  'newGame',
  'continueCard',
  'settingsHub',
  'legalAbout',
  'globalHelp',
  'fatalError',
  'hqOverview',
  'missionBoard',
  'missionDetails',
  'groupSelection',
  'formationPreview',
  'heroHall',
  'heroDetails',
  'equipmentPicker',
  'mastery',
  'barracks',
  'troopDetails',
  'kitPicker',
  'workshop',
  'itemDetails',
  'bannerPicker',
  'archiveHub',
  'codexList',
  'codexDetails',
  'achievements',
  'recordsStatistics',
  'storyArchive',
  'riftChamber',
  'ascensionRanks',
  'constellation',
  'cyclePreparation',
  'endlessSetup',
  'beyondSetup',
  'dungeonMap',
  'nodePreview',
  'event',
  'merchant',
  'recruitment',
  'treasure',
  'dungeonWorkshop',
  'riftAltar',
  'scoutPost',
  'anchorPoint',
  'preBattle',
  'battle',
  'battleInspector',
  'battleResult',
  'rewardChoice',
  'expeditionEnd',
  'defeatRecovery',
  'endlessCheckpoint',
  'audioSettings',
  'graphicsSettings',
  'accessibilitySettings',
  'controlsSettings',
  'saveManagement',
  'languageSettings',
  'confirmation',
  'tooltipGlossary',
  'comparison',
  'unlock',
  'toast',
  'loading',
  'unsavedChanges'
] as const);
const contentPattern = /^[a-z][a-z0-9]*_(?:[a-z0-9]+_)*[a-z0-9]+$/;
const entityPattern = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
export class IdParseError extends Error { constructor(readonly code:string, readonly value:unknown) { super(code); } }
export function contentTypeOf(value:string):string|null {
  for (const prefix of CONTENT_ID_PREFIXES) if (value.startsWith(prefix)) return prefix.slice(0,-1);
  return null;
}
export function parseContentId(value:unknown):ContentId {
  if (typeof value !== 'string' || !contentPattern.test(value)) throw new IdParseError('P11_ID_SYNTAX',value);
  if (contentTypeOf(value) === null) throw new IdParseError('P11_ID_PREFIX',value);
  return value as ContentId;
}
export function parseScreenId(value:unknown):ScreenId {
  if (typeof value !== 'string' || !(SCREEN_IDS as readonly string[]).includes(value)) throw new IdParseError('P11_ID_PREFIX',value);
  return value as ScreenId;
}
export function parseKnownEntityId(value:unknown, known:ReadonlySet<string>):EntityId {
  if (typeof value !== 'string' || !entityPattern.test(value) || contentTypeOf(value)!==null || !known.has(value)) throw new IdParseError('P11_ID_SYNTAX',value);
  return value as EntityId;
}
export const formatId = (value:ContentId|EntityId|ScreenId):string => value;
export function compareStableIds(a:string,b:string):number { return a < b ? -1 : a > b ? 1 : 0; }
export function contentLocalizationKey(id:ContentId, field:string):LocalizationKey {
  if (!/^[a-z][a-z0-9_]*$/.test(field)) throw new IdParseError('P11_ID_SYNTAX',field);
  const type=contentTypeOf(id); if (type===null) throw new IdParseError('P11_ID_PREFIX',id);
  return `content.${type}.${id}.${field}` as LocalizationKey;
}
export function uiLocalizationKey(screen:ScreenId, element:string):LocalizationKey {
  if (!/^[a-z][a-z0-9_]*$/.test(element)) throw new IdParseError('P11_ID_SYNTAX',element);
  return `ui.${screen}.${element}` as LocalizationKey;
}
export function assertGlobalIdUniqueness(ids:readonly string[]):void {
  const seen=new Set<string>(); for (const id of ids) { if (seen.has(id)) throw new IdParseError('P11_ID_COLLISION',id); seen.add(id); }
}
