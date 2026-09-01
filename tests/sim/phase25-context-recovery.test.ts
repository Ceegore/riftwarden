import { describe, expect, it } from 'vitest';
import { createContextRecovery } from '../../src/game/render/context-recovery.js';
import { createSnapshotPresenter } from '../../src/game/render/snapshot-presenter.js';
import type { BattlePresentationFrame } from '../../src/game/render/types.js';
import { catchRenderCode, entity, frame, hexHash, readJson } from './phase25-helpers.js';

const contextLossMatrix = readJson('fixtures/context-loss-matrix.json') as {
  scenarios: readonly string[];
  required: readonly string[];
};

/** Scripted battle snippet per context-loss scenario (fixture scenarios). */
function scenarioFrames(name: string): readonly BattlePresentationFrame[] {
  switch (name) {
    case 'during_cast':
      return [
        frame(0, [entity('caster', { lane: 1, visualState: 'idle' }), entity('target', { lane: 1, visualState: 'idle' })], hexHash(1)),
        frame(1, [entity('caster', { lane: 1, visualState: 'prepare' }), entity('target', { lane: 1, visualState: 'idle' })], hexHash(2)),
        frame(2, [entity('caster', { lane: 1, visualState: 'execute' }), entity('target', { lane: 1, visualState: 'hurt' })], hexHash(3)),
      ];
    case 'during_projectile':
      return [
        frame(0, [entity('shooter', { lane: 2, visualState: 'idle' }), entity('target', { lane: 2, visualState: 'idle' })], hexHash(4)),
        frame(1, [entity('shooter', { lane: 2, visualState: 'execute' }), entity('target', { lane: 2, visualState: 'idle' })], hexHash(5)),
      ];
    case 'during_spawn':
      return [
        frame(0, [entity('vanguard', { lane: 0, visualState: 'idle' })], hexHash(6)),
        frame(1, [entity('vanguard', { lane: 0, visualState: 'idle' }), entity('reinforcement', { lane: 2, visualState: 'spawn' })], hexHash(7)),
      ];
    case 'during_battle_end':
      return [
        frame(0, [entity('hero', { lane: 1, visualState: 'execute' }), entity('boss', { lane: 1, visualState: 'hurt' })], hexHash(8)),
        frame(1, [entity('hero', { lane: 1, visualState: 'victory' })], hexHash(9)),
      ];
    default:
      throw new Error(`unknown scenario ${name}`);
  }
}

interface Harness {
  recovery: ReturnType<typeof createContextRecovery>;
  presenter: ReturnType<typeof createSnapshotPresenter>;
  hooks: string[];
}

function runLoss(name: string, rebuild: (f: BattlePresentationFrame) => BattlePresentationFrame | null): Harness {
  const presenter = createSnapshotPresenter();
  const hooks: string[] = [];
  const recovery = createContextRecovery({
    presenter,
    requestSnapshot: () => hooks.push('snapshot_request'),
    teardownResources: () => hooks.push('teardown'),
    rebuildFromSnapshot: rebuild,
  });
  recovery.beginInitialize();
  recovery.completeInitialize(true);
  for (const f of scenarioFrames(name)) {
    presenter.submitConfirmed(f);
    presenter.present(500);
  }
  recovery.onContextLost();
  return { recovery, presenter, hooks };
}

describe('Context loss scenarios (context-loss-matrix.json)', () => {
  it('pins the four scenarios', () => {
    expect(contextLossMatrix.scenarios).toEqual(['during_cast', 'during_projectile', 'during_spawn', 'during_battle_end']);
  });

  for (const scenario of contextLossMatrix.scenarios) {
    it(`handles loss ${scenario}: preventDefault, freeze, snapshot request, teardown`, () => {
      const { recovery, presenter, hooks } = runLoss(scenario, (f) => f);
      expect(recovery.steps).toEqual(['prevent_default', 'freeze', 'snapshot_request', 'teardown']);
      expect(presenter.paused).toBe(true);
      expect(recovery.snapshotRequested).toBe(true);
      expect(recovery.lifecycle.lifecycle).toBe('context_lost');
      expect(hooks).toContain('snapshot_request');
      expect(hooks).toContain('teardown');
    });

    it(`reconstructs ${scenario} from the authoritative snapshot with the same end hash`, () => {
      const { recovery, presenter } = runLoss(scenario, (f) => f);
      const frozenHash = recovery.frozenFrame?.gameplayHash;
      expect(frozenHash).not.toBeNull();
      const outcome = recovery.attemptRestore();
      expect(outcome).toBe('ready');
      expect(recovery.lifecycle.lifecycle).toBe('ready');
      expect(recovery.lifecycle.restoreAttempts).toBe(0);
      expect(recovery.steps).toEqual(['prevent_default', 'freeze', 'snapshot_request', 'teardown', 'rebuild_from_snapshot', 'ready_gate']);
      expect(recovery.endGameplayHash).toBe(frozenHash);
      // No auto-resume: the presentation stays frozen until the ready gate
      // is explicitly passed (renderer/audio/input ready + user continue).
      expect(presenter.paused).toBe(true);
      recovery.resumeAfterReadyGate();
      expect(presenter.paused).toBe(false);
      const view = presenter.present(1000);
      expect(view.gameplayHash).toBe(frozenHash);
    });

    it(`falls back to safe recovery for ${scenario} after two failed rebuilds`, () => {
      const { recovery, presenter } = runLoss(scenario, () => null);
      expect(recovery.attemptRestore()).toBe('retry');
      expect(recovery.lifecycle.lifecycle).toBe('context_lost');
      expect(recovery.lifecycle.restoreAttempts).toBe(1);
      expect(recovery.steps).toEqual(['prevent_default', 'freeze', 'snapshot_request', 'teardown', 'rebuild_from_snapshot']);
      expect(recovery.attemptRestore()).toBe('failed_safe');
      expect(recovery.lifecycle.lifecycle).toBe('failed_safe');
      expect(recovery.steps).toEqual([
        'prevent_default',
        'freeze',
        'snapshot_request',
        'teardown',
        'rebuild_from_snapshot',
        'rebuild_from_snapshot',
        'failed_safe',
      ]);
      expect(presenter.paused).toBe(true);
      expect(recovery.endGameplayHash).toBeNull();
    });

    it(`treats a hash-divergent rebuild for ${scenario} as a failed restore`, () => {
      const { recovery } = runLoss(scenario, (f) => frame(f.tick, f.entities, hexHash(999)));
      expect(recovery.attemptRestore()).toBe('retry');
      expect(recovery.lifecycle.lifecycle).toBe('context_lost');
    });
  }

  it('guards restore outside the context_lost state', () => {
    const presenter = createSnapshotPresenter();
    presenter.submitConfirmed(frame(0, [entity('a')], hexHash(1)));
    const recovery = createContextRecovery({
      presenter,
      requestSnapshot: () => undefined,
      teardownResources: () => undefined,
      rebuildFromSnapshot: (f) => f,
    });
    recovery.beginInitialize();
    recovery.completeInitialize(true);
    expect(catchRenderCode(() => {
      recovery.attemptRestore();
    })).toBe('RESTORE_INVALID_STATE');
  });

  it('refuses context loss without any confirmed frame', () => {
    const presenter = createSnapshotPresenter();
    const recovery = createContextRecovery({
      presenter,
      requestSnapshot: () => undefined,
      teardownResources: () => undefined,
      rebuildFromSnapshot: (f) => f,
    });
    recovery.beginInitialize();
    recovery.completeInitialize(true);
    expect(catchRenderCode(() => {
      recovery.onContextLost();
    })).toBe('RECOVERY_NO_SNAPSHOT');
  });

  it('guards resume before the ready gate', () => {
    const { recovery } = runLoss('during_cast', (f) => f);
    expect(catchRenderCode(() => {
      recovery.resumeAfterReadyGate();
    })).toBe('LIFECYCLE_INVALID_TRANSITION');
  });

  it('requires initialization before context loss can be handled', () => {
    const presenter = createSnapshotPresenter();
    presenter.submitConfirmed(frame(0, [entity('a')], hexHash(1)));
    const recovery = createContextRecovery({
      presenter,
      requestSnapshot: () => undefined,
      teardownResources: () => undefined,
      rebuildFromSnapshot: (f) => f,
    });
    expect(catchRenderCode(() => {
      recovery.onContextLost();
    })).toBe('LIFECYCLE_INVALID_TRANSITION');
  });
});
