import { describe, expect, it } from 'vitest';
import {
  beginInitialize,
  beginRestore,
  completeInitialize,
  completeRestore,
  dispose,
  INITIAL_RECOVERY_STATE,
  onContextLost,
} from '../../src/game/render/lifecycle.js';
import { resolveCapability, type CapabilityProbe } from '../../src/game/render/capability.js';
import { catchRenderCode } from './phase25-helpers.js';

const DEFAULT_CONFIG = { logicalStageWidth: 1920, logicalStageHeight: 1080, dprCap: 3 };

function probe(overrides: Partial<CapabilityProbe> = {}): CapabilityProbe {
  return {
    webglVersion: 2,
    validated: false,
    maxTextureSize: 4096,
    maxRenderbufferSize: 4096,
    maxViewportWidth: 3840,
    maxViewportHeight: 2160,
    devicePixelRatio: 2,
    ...overrides,
  };
}

describe('Renderer lifecycle state machine', () => {
  it('starts uninitialized and reaches ready via initializing', () => {
    const s1 = beginInitialize(INITIAL_RECOVERY_STATE);
    expect(s1.lifecycle).toBe('initializing');
    const s2 = completeInitialize(s1, true);
    expect(s2.lifecycle).toBe('ready');
    expect(s2.restoreAttempts).toBe(0);
  });

  it('enters failed_safe when initialization fails', () => {
    const s1 = beginInitialize(INITIAL_RECOVERY_STATE);
    const s2 = completeInitialize(s1, false);
    expect(s2.lifecycle).toBe('failed_safe');
    expect(s2.failureReason).toBe('context_creation_failed');
  });

  it('guards invalid initialization transitions', () => {
    expect(catchRenderCode(() => beginInitialize({ lifecycle: 'ready', restoreAttempts: 0 }))).toBe('LIFECYCLE_INVALID_TRANSITION');
    expect(catchRenderCode(() => completeInitialize(INITIAL_RECOVERY_STATE, true))).toBe('LIFECYCLE_INVALID_TRANSITION');
  });

  it('restores once successfully (capability case restore_once)', () => {
    const ready = completeInitialize(beginInitialize(INITIAL_RECOVERY_STATE), true);
    const lost = onContextLost(ready);
    expect(lost.lifecycle).toBe('context_lost');
    const rebuilding = beginRestore(lost);
    expect(rebuilding.lifecycle).toBe('rebuilding');
    expect(rebuilding.restoreAttempts).toBe(1);
    const restored = completeRestore(rebuilding, true);
    expect(restored.lifecycle).toBe('ready');
    expect(restored.restoreAttempts).toBe(0);
    expect(restored.failureReason).toBeUndefined();
  });

  it('enters failed_safe after two failed restores (capability case restore_twice_fail)', () => {
    const ready = completeInitialize(beginInitialize(INITIAL_RECOVERY_STATE), true);
    const lost = onContextLost(ready);
    const first = completeRestore(beginRestore(lost), false);
    expect(first.lifecycle).toBe('context_lost');
    expect(first.restoreAttempts).toBe(1);
    expect(first.failureReason).toBe('restore_failed');
    const second = completeRestore(beginRestore(first), false);
    expect(second.lifecycle).toBe('failed_safe');
    expect(second.restoreAttempts).toBe(2);
    expect(second.failureReason).toBe('restore_failed');
  });

  it('guards context loss and restore transitions', () => {
    expect(catchRenderCode(() => onContextLost(INITIAL_RECOVERY_STATE))).toBe('LIFECYCLE_INVALID_TRANSITION');
    expect(catchRenderCode(() => onContextLost({ lifecycle: 'failed_safe', restoreAttempts: 2 }))).toBe('LIFECYCLE_INVALID_TRANSITION');
    expect(catchRenderCode(() => beginRestore(INITIAL_RECOVERY_STATE))).toBe('RESTORE_INVALID_STATE');
    expect(catchRenderCode(() => completeRestore(INITIAL_RECOVERY_STATE, true))).toBe('COMPLETE_INVALID_STATE');
  });

  it('dispose is terminal and idempotent', () => {
    const ready = completeInitialize(beginInitialize(INITIAL_RECOVERY_STATE), true);
    expect(dispose(ready).lifecycle).toBe('disposed');
    expect(dispose(dispose(ready)).lifecycle).toBe('disposed');
  });
});

describe('Capability matrix (capability-matrix.json)', () => {
  it('prefers WebGL2 with high quality and no failure', () => {
    const result = resolveCapability(probe(), DEFAULT_CONFIG);
    expect(result.backend).toBe('webgl2');
    expect(result.webglVersion).toBe(2);
    expect(result.qualityTier).toBe('high');
    expect(result.failureReason).toBeNull();
    expect(result.maxResolution).toEqual({ width: 1920, height: 1080 });
    expect(result.dprCap).toBe(2);
    expect(result.textureLimit).toBe(4096);
    expect(result.renderbufferLimit).toBe(4096);
  });

  it('accepts WebGL1 only after real-device validation', () => {
    const validated = resolveCapability(probe({ webglVersion: 1, validated: true }), DEFAULT_CONFIG);
    expect(validated.backend).toBe('webgl1');
    expect(validated.webglVersion).toBe(1);
    expect(validated.qualityTier).toBe('medium');
    expect(validated.failureReason).toBeNull();

    const unvalidated = resolveCapability(probe({ webglVersion: 1, validated: false }), DEFAULT_CONFIG);
    expect(unvalidated.backend).toBe('none');
    expect(unvalidated.failureReason).toBe('webgl1_unvalidated');
  });

  it('falls back to the compatible screen when no context exists', () => {
    const result = resolveCapability(probe({ webglVersion: null }), DEFAULT_CONFIG);
    expect(result.backend).toBe('none');
    expect(result.webglVersion).toBeNull();
    expect(result.failureReason).toBe('webgl_unavailable');
    expect(result.qualityTier).toBe('reduced');
  });

  it('clamps the maximum resolution to the hardware viewport', () => {
    const small = resolveCapability(probe({ maxViewportWidth: 1280, maxViewportHeight: 720 }), DEFAULT_CONFIG);
    expect(small.maxResolution).toEqual({ width: 1280, height: 720 });
  });

  it('caps the device pixel ratio by both device and configuration', () => {
    expect(resolveCapability(probe({ devicePixelRatio: 1 }), DEFAULT_CONFIG).dprCap).toBe(1);
    expect(resolveCapability(probe({ devicePixelRatio: 5 }), DEFAULT_CONFIG).dprCap).toBe(3);
  });

  it('rejects malformed probes with a closed failure code', () => {
    expect(catchRenderCode(() => resolveCapability(probe({ maxTextureSize: 0 }), DEFAULT_CONFIG))).toBe('CAPABILITY_INVALID_PROBE');
    expect(catchRenderCode(() => resolveCapability(probe({ devicePixelRatio: Number.NaN }), DEFAULT_CONFIG))).toBe('CAPABILITY_INVALID_PROBE');
    expect(catchRenderCode(() => resolveCapability(probe(), { logicalStageWidth: 0, logicalStageHeight: 1080, dprCap: 3 }))).toBe('CAPABILITY_INVALID_PROBE');
    expect(catchRenderCode(() => resolveCapability(probe(), { logicalStageWidth: 1920, logicalStageHeight: 1080, dprCap: 0 }))).toBe('CAPABILITY_INVALID_PROBE');
  });
});
