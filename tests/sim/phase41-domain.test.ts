/**
 * Phase 41 domain tests: auto-quality, GPU budget, memory profiler.
 */
import { describe, expect, it } from 'vitest';
import { createQualityState, reportFrame, budgetForTier } from '../../src/game/performance/auto-quality.js';
import { createBudget, recordDrawCall, recordTextureBind, recordShaderSwitch, resetFrame, isOverBudget, budgetUtilization } from '../../src/game/performance/gpu-budget.js';
import { checkSaveSize, createSnapshot, textureMemoryEstimate } from '../../src/game/performance/memory-profiler.js';

describe('auto-quality selector', () => {
  it('starts at high quality', () => {
    const s = createQualityState();
    expect(s.currentTier).toBe('high');
  });

  it('stays high with fast frames', () => {
    let s = createQualityState();
    for (let i = 0; i < 60; i += 1) {
      s = reportFrame(s, 8);
    }
    expect(s.currentTier).toBe('high');
  });

  it('degrades to medium with slow frames', () => {
    let s = createQualityState();
    for (let i = 0; i < 60; i += 1) {
      s = reportFrame(s, 25);
    }
    expect(s.currentTier).toBe('medium');
  });

  it('degrades to low with very slow frames', () => {
    let s = createQualityState();
    for (let i = 0; i < 60; i += 1) {
      s = reportFrame(s, 25);
    }
    // simulate cooldown expiry
    for (let i = 0; i < 120; i += 1) {
      s = reportFrame(s, 40);
    }
    expect(s.currentTier).toBe('low');
  });

  it('upgrades back when frames improve', () => {
    let s = createQualityState();
    // degrade to low first
    for (let i = 0; i < 400; i += 1) {
      s = reportFrame(s, 40);
    }
    expect(s.currentTier).toBe('low');
    // wait for cooldown then send fast frames through two upgrades
    for (let i = 0; i < 400; i += 1) {
      s = reportFrame(s, 8);
    }
    expect(s.currentTier).toBe('high');
  });

  it('provides correct budget per tier', () => {
    expect(budgetForTier('high').targetMs).toBeCloseTo(16.67);
    expect(budgetForTier('medium').targetMs).toBeCloseTo(33.33);
    expect(budgetForTier('low').targetMs).toBe(50);
  });

  it('does not change tier during cooldown', () => {
    let s = createQualityState();
    // Send one batch of slow frames to degrade
    for (let i = 0; i < 60; i += 1) {
      s = reportFrame(s, 25);
    }
    const tierAfterDegrade = s.currentTier;
    // Immediately send fast frames — should not upgrade yet (cooldown)
    for (let i = 0; i < 10; i += 1) {
      s = reportFrame(s, 8);
    }
    // Tier should not have changed back yet
    expect(s.currentTier).toBe(tierAfterDegrade);
  });
});

describe('GPU budget', () => {
  it('starts empty', () => {
    const b = createBudget('high');
    expect(b.currentDrawCalls).toBe(0);
    expect(b.currentTextures).toBe(0);
  });

  it('tracks draw calls', () => {
    let b = createBudget('low');
    for (let i = 0; i < 10; i += 1) {
      b = recordDrawCall(b);
    }
    expect(b.currentDrawCalls).toBe(10);
  });

  it('detects over-budget draw calls', () => {
    let b = createBudget('low');
    for (let i = 0; i < 51; i += 1) {
      b = recordDrawCall(b);
    }
    expect(isOverBudget(b)).toBe(true);
  });

  it('resets per frame', () => {
    let b = createBudget('medium');
    b = recordDrawCall(b);
    b = recordTextureBind(b);
    b = resetFrame(b);
    expect(b.currentDrawCalls).toBe(0);
    expect(b.currentTextures).toBe(0);
  });

  it('calculates utilization ratio', () => {
    let b = createBudget('high');
    for (let i = 0; i < 200; i += 1) {
      b = recordDrawCall(b);
    }
    const util = budgetUtilization(b);
    expect(util).toBeCloseTo(0.5);
  });

  it('tracks texture binds', () => {
    let b = createBudget('high');
    b = recordTextureBind(b);
    b = recordTextureBind(b);
    expect(b.currentTextures).toBe(2);
  });

  it('tracks shader switches', () => {
    let b = createBudget('high');
    b = recordShaderSwitch(b);
    b = recordShaderSwitch(b);
    b = recordShaderSwitch(b);
    expect(b.currentShaderSwitches).toBe(3);
  });
});

describe('memory profiler', () => {
  it('accepts saves under limit', () => {
    const result = checkSaveSize(10_000);
    expect(result.ok).toBe(true);
    expect(result.warning).toBe(false);
  });

  it('warns near limit', () => {
    const result = checkSaveSize(60_000);
    expect(result.ok).toBe(true);
    expect(result.warning).toBe(true);
  });

  it('rejects saves over limit', () => {
    const result = checkSaveSize(300_000);
    expect(result.ok).toBe(false);
    expect(result.warning).toBe(true);
  });

  it('creates a snapshot with timestamp', () => {
    const snap = createSnapshot(42_000, 1_000_000);
    expect(snap.saveBytes).toBe(42_000);
    expect(snap.timestamp).toBeGreaterThan(0);
  });

  it('estimates texture memory', () => {
    const estimate = textureMemoryEstimate(4, 2048, 4);
    expect(estimate).toBe(4 * 2048 * 2048 * 4);
  });
});