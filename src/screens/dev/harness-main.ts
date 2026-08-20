import { Application } from 'pixi.js';
import { resolveCapability, type CapabilityProbe } from '../../game/render/capability.js';
import { createContextRecovery } from '../../game/render/context-recovery.js';
import { createPixiScene } from '../../features/battle-render/pixi-scene.js';
import { createSnapshotPresenter } from '../../game/render/snapshot-presenter.js';
import { baselineQuality } from '../../game/render/quality.js';
import { buildSceneGraph, EMPTY_SCENE_GRAPH_INPUT } from '../../game/render/scene-graph.js';
import type { BattlePresentationFrame, EntityFrame, Lane, RendererLifecycle, VisualState } from '../../game/render/types.js';

/**
 * Dev-only browser harness (data-rw-dev-only marker; never part of the app
 * build): drives the Phase 25 context-recovery contract through real Chromium
 * WebGL2. A real Pixi Application owns the canvas; context loss is injected
 * with the genuine WEBGL_lose_context extension, the coordinator freezes,
 * requests a snapshot, tears the Pixi scene down and rebuilds it from the
 * authoritative snapshot. Results are exposed on window.__contextLossHarness.
 */
declare global {
  interface Window {
    __contextLossHarness?: unknown;
  }
}

export interface HarnessCapabilityResult {
  readonly backend: string;
  readonly webglVersion: number | null;
  readonly failureReason: string | null;
}

export interface HarnessScenarioResult {
  readonly name: string;
  readonly steps: readonly string[];
  readonly frozenHash: string | null;
  readonly endHash: string | null;
  readonly sameEndHash: boolean;
  readonly outcome: 'ready' | 'retry' | 'failed_safe';
  readonly lifecycle: RendererLifecycle;
  readonly snapshotRequests: number;
  readonly teardowns: number;
}

export interface HarnessResult {
  readonly capability: HarnessCapabilityResult;
  readonly scenarios: readonly HarnessScenarioResult[];
  readonly error?: string;
  readonly contextLostAt?: { readonly afterInit: boolean; readonly perScenario: readonly boolean[] };
}

function entity(id: string, overrides: Partial<EntityFrame> = {}): EntityFrame {
  return Object.freeze({ id, lane: 0, logicalX100: 100, visualState: 'idle', clipProgress1000: 0, ...overrides });
}

function frame(tick: number, entities: readonly EntityFrame[], hash: string): BattlePresentationFrame {
  return Object.freeze({ tick, entities: Object.freeze([...entities]), gameplayHash: hash });
}

function hexHash(n: number): string {
  return String(n).padStart(64, '0');
}

function scenarioFrames(name: string): readonly BattlePresentationFrame[] {
  const unit = (id: string, lane: Lane, visualState: VisualState, logicalX100: number): EntityFrame =>
    entity(id, { lane, visualState, logicalX100 });
  switch (name) {
    case 'during_cast':
      return [
        frame(0, [unit('caster', 1, 'idle', 400), unit('target', 1, 'idle', 800)], hexHash(1)),
        frame(1, [unit('caster', 1, 'prepare', 400), unit('target', 1, 'idle', 800)], hexHash(2)),
        frame(2, [unit('caster', 1, 'execute', 420), unit('target', 1, 'hurt', 800)], hexHash(3)),
      ];
    case 'during_projectile':
      return [
        frame(0, [unit('shooter', 2, 'idle', 300), unit('target', 2, 'idle', 900)], hexHash(4)),
        frame(1, [unit('shooter', 2, 'execute', 300), unit('target', 2, 'idle', 900)], hexHash(5)),
      ];
    case 'during_spawn':
      return [frame(0, [unit('vanguard', 0, 'idle', 500)], hexHash(6)), frame(1, [unit('vanguard', 0, 'idle', 500), unit('reinforcement', 2, 'spawn', 700)], hexHash(7))];
    case 'during_battle_end':
      return [frame(0, [unit('hero', 1, 'execute', 500), unit('boss', 1, 'hurt', 900)], hexHash(8)), frame(1, [unit('hero', 1, 'victory', 500)], hexHash(9))];
    default:
      throw new Error(`unknown scenario ${name}`);
  }
}

function readNumber(gl: WebGL2RenderingContext, pname: number): number {
  const value: unknown = gl.getParameter(pname);
  return typeof value === 'number' ? value : 0;
}

function readNumberArray(gl: WebGL2RenderingContext, pname: number): readonly number[] {
  // MAX_VIEWPORT_DIMS is an Int32Array (not an Array); both expose length and
  // indexed access, so probe them uniformly.
  const value: unknown = gl.getParameter(pname);
  if (value === null || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  const length = record['length'];
  if (typeof length === 'number' && Number.isInteger(length) && length > 0 && length <= 64) {
    const output: number[] = [];
    for (let i = 0; i < length; i += 1) {
      const item = record[String(i)];
      if (typeof item === 'number') output.push(item);
    }
    return output;
  }
  return [];
}

function probeFromContext(gl: WebGL2RenderingContext, devicePixelRatio: number): CapabilityProbe {
  const viewport = readNumberArray(gl, gl.MAX_VIEWPORT_DIMS);
  return {
    webglVersion: 2,
    validated: true,
    maxTextureSize: readNumber(gl, gl.MAX_TEXTURE_SIZE),
    maxRenderbufferSize: readNumber(gl, gl.MAX_RENDERBUFFER_SIZE),
    maxViewportWidth: viewport[0] ?? 0,
    maxViewportHeight: viewport[1] ?? 0,
    devicePixelRatio,
  };
}

function loseContext(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext, onLost: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const extension = gl.getExtension('WEBGL_lose_context');
    if (extension === null) {
      reject(new Error(`WEBGL_lose_context unavailable (contextLost=${String(gl.isContextLost())})`));
      return;
    }
    canvas.addEventListener(
      'webglcontextlost',
      (event) => {
        event.preventDefault();
        onLost();
        resolve();
      },
      { once: true },
    );
    extension.loseContext();
  });
}

async function runScenario(name: string, frames: readonly BattlePresentationFrame[], failRebuild: boolean): Promise<HarnessScenarioResult> {
  // A fresh canvas + context per scenario: a real context loss leaves the
  // context lost, so each scenario independently proves creation, genuine
  // WEBGL_lose_context injection, teardown and rebuild from the snapshot.
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 540;
  const app = new Application();
  await app.init({ canvas, preference: 'webgl', width: 960, height: 540, backgroundAlpha: 0 });
  app.stop();
  const gl = canvas.getContext('webgl2');
  if (gl === null) throw new Error(`webgl2 context unavailable for ${name}`);
  const presenter = createSnapshotPresenter();
  const scene = createPixiScene(app, [0, 1, 2, 3, 4, 5, 6]);
  let snapshotRequests = 0;
  let teardowns = 0;
  const recovery = createContextRecovery({
    presenter,
    requestSnapshot: () => {
      snapshotRequests += 1;
    },
    teardownResources: () => {
      scene.teardown();
      teardowns += 1;
    },
    rebuildFromSnapshot: (snapshot) => {
      if (failRebuild) return null;
      scene.sync(buildSceneGraph(presenter.present(1000), EMPTY_SCENE_GRAPH_INPUT, baselineQuality('high')));
      return snapshot;
    },
  });
  recovery.beginInitialize();
  recovery.completeInitialize(true);
  for (const current of frames) {
    presenter.submitConfirmed(current);
    presenter.present(500);
  }
  const frozenHash = presenter.latestGameplayHash;
  if (gl.isContextLost()) {
    throw new Error(`context already lost before ${name}`);
  }
  await loseContext(canvas, gl, () => {
    recovery.onContextLost();
  });
  let outcome = recovery.attemptRestore();
  if (failRebuild && outcome === 'retry') {
    // The contract enters failed_safe after two failed rebuilds, so the
    // failed-restore scenario retries once more.
    outcome = recovery.attemptRestore();
  }
  if (outcome === 'ready') recovery.resumeAfterReadyGate();
  return {
    name,
    steps: recovery.steps,
    frozenHash,
    endHash: recovery.endGameplayHash,
    sameEndHash: frozenHash !== null && recovery.endGameplayHash === frozenHash,
    outcome,
    lifecycle: recovery.lifecycle.lifecycle,
    snapshotRequests,
    teardowns,
  };
}

async function main(): Promise<HarnessResult> {
  // Capability probe on a dedicated context; scenarios use fresh canvases.
  const probeCanvas = document.createElement('canvas');
  probeCanvas.width = 64;
  probeCanvas.height = 64;
  const gl = probeCanvas.getContext('webgl2');
  if (gl === null) throw new Error('webgl2 context unavailable for capability probe');
  const capability = resolveCapability(probeFromContext(gl, window.devicePixelRatio), { logicalStageWidth: 1920, logicalStageHeight: 1080, dprCap: 3 });
  const scenarios: HarnessScenarioResult[] = [];
  for (const name of ['during_cast', 'during_projectile', 'during_spawn', 'during_battle_end'] as const) {
    scenarios.push(await runScenario(name, scenarioFrames(name), false));
  }
  scenarios.push(await runScenario('during_cast_failed_restore', scenarioFrames('during_cast'), true));
  return {
    capability: { backend: capability.backend, webglVersion: capability.webglVersion, failureReason: capability.failureReason },
    scenarios,
  };
}

main()
  .then((result) => {
    window.__contextLossHarness = result;
  })
  .catch((error: unknown) => {
    window.__contextLossHarness = {
      capability: { backend: 'none', webglVersion: null, failureReason: 'harness_error' },
      scenarios: [],
      error: error instanceof Error ? error.message : String(error),
    };
  });
