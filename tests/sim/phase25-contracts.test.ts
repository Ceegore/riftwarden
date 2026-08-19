import { describe, expect, it } from 'vitest';
import { LAYER_ORDER, layerIdByName, layerNameById, releaseLayerIds, READABILITY_LAYER_ID, DEBUG_LAYER_ID, entityLayerId } from '../../src/game/render/layer-graph.js';
import { SPEED_MILLI, RENDER_FPS } from '../../src/game/render/presentation-clock.js';
import { COSMETIC_KINDS, CRITICAL_KINDS, mayDropOnPressure } from '../../src/game/render/pool-policy.js';
import { VISUAL_STATES, PRESENTATION_EVENT_KINDS } from '../../src/game/render/event-mapping.js';
import { interpolateInt } from '../../src/game/render/interpolation.js';
import { readJson } from './phase25-helpers.js';

const constants = readJson('phase25-constants.json') as {
  logicalStage: { width: number; height: number };
  layers: readonly string[];
  speedMilli: readonly number[];
  maxCatchUpTicks: number;
  maxContextRestoreAttempts: number;
  interpolationScale: number;
  visualStates: readonly string[];
};

const layerGolden = readJson('fixtures/layer-order-golden.json') as { layers: readonly { id: number; name: string }[] };
const interpolationBoundaries = readJson('fixtures/interpolation-boundaries.json') as {
  cases: readonly { from: number; to: number; alpha1000: number }[];
};
const qualityPressure = readJson('fixtures/quality-pressure-matrix.json') as {
  droppable: readonly string[];
  protected: readonly string[];
};
const capabilityMatrix = readJson('fixtures/capability-matrix.json') as {
  cases: readonly string[];
  forbidden: readonly string[];
};
const contextLossMatrix = readJson('fixtures/context-loss-matrix.json') as {
  scenarios: readonly string[];
  required: readonly string[];
};

describe('P25 pinned constants (phase25-constants.json)', () => {
  it('pins the logical battle stage at 1920x1080', () => {
    expect(constants.logicalStage).toEqual({ width: 1920, height: 1080 });
  });

  it('pins the eight layers in handbook order', () => {
    expect(constants.layers).toEqual(['background', 'ground', 'back_units', 'main_units', 'projectiles', 'effects', 'readability', 'debug']);
  });

  it('pins presentation speeds, catch-up cap and restore attempts', () => {
    expect(constants.speedMilli).toEqual([500, 1000, 2000, 3000]);
    expect(constants.maxCatchUpTicks).toBe(8);
    expect(constants.maxContextRestoreAttempts).toBe(2);
    expect(constants.interpolationScale).toBe(1000);
  });

  it('pins the closed visual-state set', () => {
    expect(constants.visualStates).toEqual(VISUAL_STATES);
  });

  it('exposes the same speed and render-fps domains', () => {
    expect(SPEED_MILLI).toEqual(constants.speedMilli);
    expect(RENDER_FPS).toEqual([15, 30, 60, 120]);
  });
});

describe('P25 layer graph golden (layer-order-golden.json)', () => {
  it('matches the pinned layer order exactly', () => {
    expect(LAYER_ORDER.map((layer) => ({ id: layer.id, name: layer.name }))).toEqual(layerGolden.layers);
    expect(LAYER_ORDER.map((layer) => layer.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('keeps readability above effects and debug last', () => {
    const readabilityIndex = LAYER_ORDER.findIndex((layer) => layer.name === 'readability');
    const effectsIndex = LAYER_ORDER.findIndex((layer) => layer.name === 'effects');
    const debugIndex = LAYER_ORDER.findIndex((layer) => layer.name === 'debug');
    expect(LAYER_ORDER[readabilityIndex]?.id).toBe(6);
    expect(LAYER_ORDER[effectsIndex]?.id).toBe(5);
    expect(LAYER_ORDER[debugIndex]?.id).toBe(7);
    expect(READABILITY_LAYER_ID).toBe(6);
    expect(DEBUG_LAYER_ID).toBe(7);
    expect(readabilityIndex).toBeGreaterThan(effectsIndex);
    expect(debugIndex).toBeGreaterThan(readabilityIndex);
  });

  it('excludes the debug layer from release bundles', () => {
    expect(releaseLayerIds(false)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(releaseLayerIds(true)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('maps names to ids and ids to names symmetrically', () => {
    for (const layer of layerGolden.layers) {
      expect(layerIdByName(layer.name)).toBe(layer.id);
      expect(layerNameById(layer.id)).toBe(layer.name);
    }
    expect(layerIdByName('missing')).toBeNull();
    expect(layerNameById(99)).toBeNull();
  });

  it('maps entity lanes onto the unit layers (presentation only)', () => {
    expect(entityLayerId(0)).toBe(2);
    expect(entityLayerId(1)).toBe(3);
    expect(entityLayerId(2)).toBe(3);
  });
});

describe('P25 interpolation boundaries (interpolation-boundaries.json)', () => {
  it('honours every pinned alpha boundary without extrapolation', () => {
    const alphas = interpolationBoundaries.cases.map((c) => c.alpha1000);
    expect(alphas).toEqual([0, 1, 499, 500, 999, 1000]);
    const results = interpolationBoundaries.cases.map((c) => interpolateInt(c.from, c.to, c.alpha1000));
    // 0..100 scaled by alpha/1000, rounded half away from zero.
    expect(results).toEqual([0, 0, 50, 50, 100, 100]);
    expect(results[0]).toBe(0);
    expect(results[5]).toBe(100);
  });

  it('stays monotonic across the pinned boundary sequence', () => {
    const results = interpolationBoundaries.cases.map((c) => interpolateInt(c.from, c.to, c.alpha1000));
    for (let i = 1; i < results.length; i += 1) {
      expect((results[i] ?? 0) >= (results[i - 1] ?? 0)).toBe(true);
    }
  });
});

describe('P25 quality pressure matrix (quality-pressure-matrix.json)', () => {
  it('matches the pinned droppable cosmetic kinds', () => {
    expect(COSMETIC_KINDS).toEqual(qualityPressure.droppable);
    for (const kind of qualityPressure.droppable) {
      expect(mayDropOnPressure(kind as 'decorative_particle')).toBe(true);
    }
  });

  it('never drops protected kinds', () => {
    expect(CRITICAL_KINDS).toEqual(['telegraph', 'warning', 'accessibility_signal']);
    for (const kind of CRITICAL_KINDS) expect(mayDropOnPressure(kind)).toBe(false);
    // entity_readability is protected by construction: quality only degrades
    // cosmetics, never unit/HP/status readability.
    expect(qualityPressure.protected).toContain('entity_readability');
  });
});

describe('P25 capability and context-loss matrices (fixtures)', () => {
  it('pins the capability cases and forbidden backends', () => {
    expect(capabilityMatrix.cases).toEqual(['webgl2', 'validated_webgl1', 'no_context', 'restore_once', 'restore_twice_fail']);
    expect(capabilityMatrix.forbidden).toEqual(['canvas', 'webgpu', 'network_asset_fetch']);
  });

  it('pins the context-loss scenarios and required steps', () => {
    expect(contextLossMatrix.scenarios).toEqual(['during_cast', 'during_projectile', 'during_spawn', 'during_battle_end']);
    expect(contextLossMatrix.required).toEqual([
      'prevent_default',
      'freeze',
      'snapshot_request',
      'teardown',
      'rebuild_from_snapshot',
      'same_end_hash_or_safe_recovery',
    ]);
  });

  it('pins the closed event kinds', () => {
    expect(PRESENTATION_EVENT_KINDS).toEqual(['damage', 'heal', 'projectile', 'spawn', 'defeat', 'battle_end']);
  });
});
