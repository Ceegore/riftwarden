class EnumParseError extends Error { constructor(readonly enumName:string, readonly value:unknown) { super('P11_ENUM_UNKNOWN'); } }

export const DifficultyValues = Object.freeze(['explorer', 'normal', 'veteran'] as const);
export type Difficulty = (typeof DifficultyValues)[number];
export function parseDifficulty(value:unknown):Difficulty {
  if (typeof value === 'string' && (DifficultyValues as readonly string[]).includes(value)) return value as Difficulty;
  throw new EnumParseError('Difficulty', value);
}

export const RunModeValues = Object.freeze(['campaign', 'campaign_replay', 'ascension', 'beyond', 'endless'] as const);
export type RunMode = (typeof RunModeValues)[number];
export function parseRunMode(value:unknown):RunMode {
  if (typeof value === 'string' && (RunModeValues as readonly string[]).includes(value)) return value as RunMode;
  throw new EnumParseError('RunMode', value);
}

export const QualityTierValues = Object.freeze(['auto', 'high', 'medium', 'low'] as const);
export type QualityTier = (typeof QualityTierValues)[number];
export function parseQualityTier(value:unknown):QualityTier {
  if (typeof value === 'string' && (QualityTierValues as readonly string[]).includes(value)) return value as QualityTier;
  throw new EnumParseError('QualityTier', value);
}
