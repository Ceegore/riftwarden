/**
 * Phase 41: Auto-quality selector (AUTO_QUALITY_CONTRACT).
 *
 * Monitors rolling frame time and downgrades visual quality when
 * the budget is exceeded. Three tiers: high, medium, low.
 */

export type QualityTier = 'high' | 'medium' | 'low';

export interface FrameBudget {
  readonly targetMs: number;
  readonly sampleWindow: number;
  readonly degradationThreshold: number;
  readonly upgradeThreshold: number;
}

const BUDGETS: Readonly<Record<QualityTier, FrameBudget>> = Object.freeze({
  high:   { targetMs: 16.67, sampleWindow: 60, degradationThreshold: 0.8, upgradeThreshold: 0.5 },
  medium: { targetMs: 33.33, sampleWindow: 30, degradationThreshold: 0.8, upgradeThreshold: 0.5 },
  low:    { targetMs: 50.00, sampleWindow: 20, degradationThreshold: 0.8, upgradeThreshold: 0.5 },
});

export interface QualityState {
  readonly currentTier: QualityTier;
  readonly rollingAvgMs: number;
  readonly sampleCount: number;
  readonly samples: readonly number[];
  readonly cooldownFrames: number;
}

const COOLDOWN_FRAMES = 120;

export function createQualityState(): QualityState {
  return {
    currentTier: 'high',
    rollingAvgMs: 0,
    sampleCount: 0,
    samples: [],
    cooldownFrames: 0,
  };
}

export function reportFrame(state: QualityState, frameTimeMs: number): QualityState {
  const budget = BUDGETS[state.currentTier];
  const newSamples = [...state.samples, frameTimeMs].slice(-budget.sampleWindow);
  const avg = newSamples.reduce((a, b) => a + b, 0) / newSamples.length;
  const cooldown = Math.max(0, state.cooldownFrames - 1);

  let nextTier = state.currentTier;
  if (cooldown === 0) {
    if (avg > budget.targetMs * budget.degradationThreshold) {
      if (state.currentTier === 'high') nextTier = 'medium';
      else if (state.currentTier === 'medium') nextTier = 'low';
    } else if (avg < budget.targetMs * budget.upgradeThreshold) {
      if (state.currentTier === 'low') nextTier = 'medium';
      else if (state.currentTier === 'medium') nextTier = 'high';
    }
  }

  return {
    currentTier: nextTier,
    rollingAvgMs: avg,
    sampleCount: newSamples.length,
    samples: newSamples,
    cooldownFrames: nextTier !== state.currentTier ? COOLDOWN_FRAMES : cooldown,
  };
}

export function budgetForTier(tier: QualityTier): FrameBudget {
  return BUDGETS[tier];
}