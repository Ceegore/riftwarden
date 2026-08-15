import { deepFreeze } from './deep-freeze.js';
export const TECHNICAL_RULES = deepFreeze({
  simulationTicksPerSecond: 30,
  renderTargetFramesPerSecond: 60,
  maxCatchUpTicksPerRenderFrame: 8,
  positionScaleX100: 100,
  positionMinX100: 0,
  positionMaxX100: 10_000,
  milliValueScale: 1_000,
  basisPointsScale: 10_000,
  basisPointsNormalMin: 0,
  basisPointsNormalMax: 50_000,
  phaseTransitionDefaultTicks: 45,
  resolvingEndMaxTicks: 3,
  maxSafeInteger: Number.MAX_SAFE_INTEGER,
} as const);
export type TechnicalRules = typeof TECHNICAL_RULES;
