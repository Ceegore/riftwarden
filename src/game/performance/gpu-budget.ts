/**
 * Phase 41: GPU budget manager (GPU_BUDGET_CONTRACT).
 *
 * Tracks draw calls, texture binds, and shader switches against
 * tiered budgets. Warns when approaching limits.
 */

export interface GpuBudget {
  readonly maxDrawCalls: number;
  readonly maxTextures: number;
  readonly maxShaderSwitches: number;
  currentDrawCalls: number;
  currentTextures: number;
  currentShaderSwitches: number;
}

const PROFILE_TEMPLATES: Readonly<Record<string, GpuBudget>> = Object.freeze({
  low:    { maxDrawCalls: 50,  maxTextures: 8,  maxShaderSwitches: 3,  currentDrawCalls: 0, currentTextures: 0, currentShaderSwitches: 0 },
  medium: { maxDrawCalls: 150, maxTextures: 16, maxShaderSwitches: 6,  currentDrawCalls: 0, currentTextures: 0, currentShaderSwitches: 0 },
  high:   { maxDrawCalls: 400, maxTextures: 32, maxShaderSwitches: 12, currentDrawCalls: 0, currentTextures: 0, currentShaderSwitches: 0 },
});

export function createBudget(profile: 'low' | 'medium' | 'high'): GpuBudget {
  const t = PROFILE_TEMPLATES[profile];
  if (t === undefined) throw new Error(`GPU: unknown profile ${profile}`);
  return { ...t };
}

export function resetFrame(budget: GpuBudget): GpuBudget {
  return {
    ...budget,
    currentDrawCalls: 0,
    currentTextures: 0,
    currentShaderSwitches: 0,
  };
}

export function recordDrawCall(budget: GpuBudget): GpuBudget {
  return { ...budget, currentDrawCalls: budget.currentDrawCalls + 1 };
}

export function recordTextureBind(budget: GpuBudget): GpuBudget {
  return { ...budget, currentTextures: budget.currentTextures + 1 };
}

export function recordShaderSwitch(budget: GpuBudget): GpuBudget {
  return { ...budget, currentShaderSwitches: budget.currentShaderSwitches + 1 };
}

export function isOverBudget(budget: GpuBudget): boolean {
  return budget.currentDrawCalls > budget.maxDrawCalls ||
    budget.currentTextures > budget.maxTextures ||
    budget.currentShaderSwitches > budget.maxShaderSwitches;
}

export function budgetUtilization(budget: GpuBudget): number {
  const drawRatio = budget.currentDrawCalls / budget.maxDrawCalls;
  const texRatio = budget.currentTextures / budget.maxTextures;
  const shaderRatio = budget.currentShaderSwitches / budget.maxShaderSwitches;
  return Math.max(drawRatio, texRatio, shaderRatio);
}
