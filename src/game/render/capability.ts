import type { RenderBackend, RenderFailureReason, RenderQualityTier } from './types.js';
import { RenderError } from './render-error.js';

/**
 * Capability probe abstraction (WEBGL_CAPABILITY_LIFECYCLE_CONTRACT). The
 * renderer requests WebGL explicitly, prefers WebGL2 and accepts WebGL1 only
 * after real-device validation. Canvas and WebGPU paths are forbidden.
 */
export interface CapabilityProbe {
  readonly webglVersion: 1 | 2 | null;
  /** True only after WebGL1 was validated on a real device. */
  readonly validated: boolean;
  readonly maxTextureSize: number;
  readonly maxRenderbufferSize: number;
  readonly maxViewportWidth: number;
  readonly maxViewportHeight: number;
  readonly devicePixelRatio: number;
}

export interface CapabilityConfig {
  readonly logicalStageWidth: number;
  readonly logicalStageHeight: number;
  readonly dprCap: number;
}

export interface CapabilityResult {
  readonly backend: RenderBackend;
  readonly webglVersion: 1 | 2 | null;
  readonly qualityTier: RenderQualityTier;
  readonly maxResolution: Readonly<{ width: number; height: number }>;
  readonly dprCap: number;
  readonly textureLimit: number;
  readonly renderbufferLimit: number;
  /** null only when capability resolution succeeded (backend webgl2/webgl1). */
  readonly failureReason: RenderFailureReason | null;
}

const NO_CONTEXT: RenderFailureReason = 'webgl_unavailable';
const UNVALIDATED_WEBGL1: RenderFailureReason = 'webgl1_unvalidated';

export function resolveCapability(probe: CapabilityProbe, config: CapabilityConfig): CapabilityResult {
  if (
    !Number.isSafeInteger(probe.maxTextureSize) ||
    probe.maxTextureSize <= 0 ||
    !Number.isSafeInteger(probe.maxRenderbufferSize) ||
    probe.maxRenderbufferSize <= 0 ||
    !Number.isSafeInteger(probe.maxViewportWidth) ||
    probe.maxViewportWidth <= 0 ||
    !Number.isSafeInteger(probe.maxViewportHeight) ||
    probe.maxViewportHeight <= 0 ||
    !Number.isFinite(probe.devicePixelRatio) ||
    probe.devicePixelRatio <= 0
  ) {
    throw new RenderError('CAPABILITY_INVALID_PROBE', { reason: 'limits' });
  }
  if (!Number.isSafeInteger(config.logicalStageWidth) || config.logicalStageWidth <= 0 || !Number.isSafeInteger(config.logicalStageHeight) || config.logicalStageHeight <= 0) {
    throw new RenderError('CAPABILITY_INVALID_PROBE', { reason: 'logical-stage' });
  }
  if (!Number.isSafeInteger(config.dprCap) || config.dprCap < 1) throw new RenderError('CAPABILITY_INVALID_PROBE', { reason: 'dpr-cap' });

  const dprCap = Math.min(config.dprCap, Math.max(1, probe.devicePixelRatio));
  const maxResolution = Object.freeze({
    width: Math.min(config.logicalStageWidth, probe.maxViewportWidth),
    height: Math.min(config.logicalStageHeight, probe.maxViewportHeight),
  });

  if (probe.webglVersion === 2) {
    return {
      backend: 'webgl2',
      webglVersion: 2,
      qualityTier: 'high',
      maxResolution,
      dprCap,
      textureLimit: probe.maxTextureSize,
      renderbufferLimit: probe.maxRenderbufferSize,
      failureReason: null,
    };
  }
  if (probe.webglVersion === 1 && probe.validated) {
    return {
      backend: 'webgl1',
      webglVersion: 1,
      qualityTier: 'medium',
      maxResolution,
      dprCap,
      textureLimit: probe.maxTextureSize,
      renderbufferLimit: probe.maxRenderbufferSize,
      failureReason: null,
    };
  }
  if (probe.webglVersion === 1) {
    return { backend: 'none', webglVersion: 1, qualityTier: 'reduced', maxResolution, dprCap, textureLimit: probe.maxTextureSize, renderbufferLimit: probe.maxRenderbufferSize, failureReason: UNVALIDATED_WEBGL1 };
  }
  return { backend: 'none', webglVersion: null, qualityTier: 'reduced', maxResolution, dprCap, textureLimit: probe.maxTextureSize, renderbufferLimit: probe.maxRenderbufferSize, failureReason: NO_CONTEXT };
}
