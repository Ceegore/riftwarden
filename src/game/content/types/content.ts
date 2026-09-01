import type { BasisPoints, ContentId, LocalizationKey, MilliValue, Tick } from "./brands";

export type UnitCategory = "hero" | "troop" | "summon" | "enemy" | "boss" | "boss_object";
export type Depth = "front" | "middle" | "back";
export type Lane = "top" | "middle" | "bottom";
export type RunMode = "campaign" | "campaign_replay" | "ascension" | "beyond" | "endless";

export interface UnitStats {
  maxHp: MilliValue;
  armor: MilliValue;
  resistance: MilliValue;
  attackPower: MilliValue;
  attackIntervalTicks: Tick;
  preparationTicks: Tick;
  rangeX100: number;
  movementX100PerSecond: number;
  controlResistanceBps: BasisPoints;
}

export interface UnitDefinition {
  id: ContentId;
  category: UnitCategory;
  displayNameKey: LocalizationKey;
  roleTags: string[];
  traitIds: ContentId[];
  baseStats: UnitStats;
  collisionRadiusX100: number;
  preferredDepths: Depth[];
  basicAttackId: ContentId;
  passiveAbilityIds: ContentId[];
  activeAbilityIds: ContentId[];
  targetProfileId: ContentId;
  visualId: ContentId;
  audioId: ContentId;
  codexId: ContentId;
}

export interface ContentManifest {
  schemaVersion: number;
  contentVersion: string;
  simulationVersion: number;
  localeVersions: Record<"de" | "en", string>;
  counts: Record<string, number>;
  files: { path: string; sha256: string; byteLength: number; entityType: string }[];
}
