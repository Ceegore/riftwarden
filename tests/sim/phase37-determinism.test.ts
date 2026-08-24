/** Phase 37 determinism and shared navigation boundary tests. */
import { describe, expect, it } from 'vitest';
import { getScreenModule } from '../../src/screens/screen-modules.js';
import { renderRegisteredScreen, resolveRegisteredScreen } from '../../src/screens/screen-renderer.js';
import { getScreenRegistration } from '../../src/app/navigation/screen-registry.js';
import { createExpedition } from '../../src/game/expedition/expedition-runner.js';
import { encodeExpeditionSave, restoreExpeditionSave } from '../../src/game/expedition/expedition-save.js';
import { generateMap } from '../../src/game/expedition/map-generator.js';
import type { ExpeditionMap, MapProfile } from '../../src/game/expedition/types.js';
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';

const PROFILE: MapProfile = {
  id: 'phase37-determinism.v1',
  logicalLevels: 6,
  targetVisited: [5, 8] as const,
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'fallback.v1',
};

function mapFor(seed: number): ExpeditionMap {
  return generateMap({ seed, profileId: PROFILE.id, contentRevision: '32.0' }, PROFILE);
}

describe('phase37 deterministic expedition boundaries', () => {
  it('produces byte-identical maps for the same seed and content revision', () => {
    const first = mapFor(3700);
    const second = mapFor(3700);
    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(mapFor(3701).mapHash).not.toBe(first.mapHash);
  });

  it('keeps transaction ids stable and distinct across actions', () => {
    expect(enterTransactionId('run-37', 'n0')).toBe('run-37:enter:n0');
    expect(actionTransactionId('run-37', 'n0', 'ENGAGE')).toBe('run-37:action:n0:ENGAGE:none');
    expect(actionTransactionId('run-37', 'n0', 'ENGAGE', 'reward:0')).not.toBe(
      actionTransactionId('run-37', 'n0', 'CLAIM_REWARD', 'reward:0'),
    );
  });

  it('replays a committed combat action without changing the canonical save', () => {
    const map = mapFor(3702);
    let runner = createExpedition(map, { startGold: 100 });
    runner = runner.enter(enterTransactionId(runner.state.runId, runner.currentNodeId));
    const request = {
      transactionId: actionTransactionId(runner.state.runId, runner.currentNodeId, 'ENGAGE'),
      nodeId: runner.currentNodeId,
      action: 'ENGAGE',
    } as const;

    const committed = runner.act(request);
    const committedSave = encodeExpeditionSave(committed);
    const replayed = committed.act(request);

    expect(encodeExpeditionSave(replayed)).toBe(committedSave);
    expect(replayed.state.ledger[request.transactionId]).toEqual(committed.state.ledger[request.transactionId]);
    expect(replayed.state.killsEarned).toBe(committed.state.killsEarned);
    expect(replayed.state.gold).toBe(committed.state.gold);
  });

  it('restores the same deterministic state and accepts a replay after reload', () => {
    const map = mapFor(3703);
    let runner = createExpedition(map, { startGold: 100 });
    runner = runner.enter(enterTransactionId(runner.state.runId, runner.currentNodeId));
    const request = {
      transactionId: actionTransactionId(runner.state.runId, runner.currentNodeId, 'ENGAGE'),
      nodeId: runner.currentNodeId,
      action: 'ENGAGE',
    } as const;
    runner = runner.act(request);

    const restored = restoreExpeditionSave(encodeExpeditionSave(runner), map);
    expect(encodeExpeditionSave(restored)).toBe(encodeExpeditionSave(runner));
    expect(encodeExpeditionSave(restored.act(request))).toBe(encodeExpeditionSave(runner));
  });
});

describe('phase37 unified navigation resolver', () => {
  it('resolves live HQ and expedition screens through registry loader ids', () => {
    const keys = ['hqOverview', 'equipmentPicker', 'formationPreview', 'dungeonMap', 'nodePreview', 'battleResult'] as const;
    for (const screenKey of keys) {
      const registration = getScreenRegistration(screenKey);
      expect(registration?.kind).toBe('screen');
      expect(getScreenModule(registration?.loaderId ?? '')).toBeDefined();
      expect(resolveRegisteredScreen(screenKey)).not.toBeNull();
    }
  });

  it('renders a registered screen through the shared route boundary', () => {
    const element = renderRegisteredScreen('hqOverview', { onNavigate: () => undefined, onBack: () => undefined });
    expect(element.type).toBeDefined();
  });
});
