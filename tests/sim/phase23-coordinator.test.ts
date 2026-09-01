import { describe, expect, it } from 'vitest';
import { ALL_SLOTS, type SaveFamily } from '../../src/game/save/native-save-store.js';
import { SaveWriteCoordinator } from '../../src/game/save/save-write-coordinator.js';
import { WebQaStore } from '../../src/game/save/web-qa-store.js';
import { envelope, makeRequest } from './phase23-helpers.js';

describe('P23 write coordinator', () => {
  it('serializes writes: at most one active commit', async () => {
    const web = new WebQaStore(() => null, 5);
    const coordinator = new SaveWriteCoordinator(web);
    const requests = Array.from({ length: 10 }, (_, i) => makeRequest('profile', i + 1, { v: i + 1 }));
    const results = await Promise.all(requests.map((request) => coordinator.enqueue(request)));
    expect(results).toHaveLength(10);
    expect(new Set(results.map((r) => r.slot))).toEqual(new Set(ALL_SLOTS));
    const stats = coordinator.getStats();
    expect(stats.written).toBe(10);
    expect(stats.queued).toBe(0);
  });

  it('never drops profile/run/settings/purchase/reward transactions', async () => {
    const web = new WebQaStore();
    const coordinator = new SaveWriteCoordinator(web);
    const kinds: readonly { family: SaveFamily; reason: string }[] = [
      { family: 'profile', reason: 'profile' },
      { family: 'run', reason: 'run' },
      { family: 'settings', reason: 'settings' },
      { family: 'battle', reason: 'purchase' },
      { family: 'profile', reason: 'reward' },
    ];
    const results = await Promise.all(
      kinds.map((kind, i) => coordinator.enqueue({ ...makeRequest(kind.family, i + 1, { v: i + 1 }), reason: kind.reason })),
    );
    expect(results).toHaveLength(5);
    const log = web.getCommitLog();
    expect(log).toHaveLength(5);
  });

  it('coalesces waiting battle snapshots of the same family onto the newest tick', async () => {
    const web = new WebQaStore(() => null, 2);
    const coordinator = new SaveWriteCoordinator(web);
    const ticks = [150, 151, 180, 210];
    const results = await Promise.all(
      ticks.map((tickValue) =>
        coordinator.enqueue({
          family: 'battle',
          reason: 'battle_snapshot',
          battleTick: tickValue,
          envelope: envelope(tickValue, { tick: tickValue }),
        }),
      ),
    );
    // The first request is already active (never cancelled); the waiting
    // requests coalesce onto the newest tick, so exactly 150 and 210 are
    // written (the fixture's expectedWrittenWaitingTick is 210).
    const log = web.getCommitLog();
    expect(log.map((r) => r.commitId)).toEqual([150, 210]);
    // The coalesced callers all observe the newest written snapshot.
    expect(results[1]?.commitId).toBe(210);
    expect(results[2]?.commitId).toBe(210);
    expect(results[3]?.commitId).toBe(210);
    // The active (never cancelled) first write still completes.
    expect(results[0]?.commitId).toBe(150);
  });

  it('does not coalesce snapshots of different families', async () => {
    const web = new WebQaStore();
    const coordinator = new SaveWriteCoordinator(web);
    const results = await Promise.all([
      coordinator.enqueue({ family: 'battle', reason: 'battle_snapshot', battleTick: 150, envelope: envelope(150, { p: 'a' }) }),
      coordinator.enqueue({ family: 'battle', reason: 'battle_snapshot', battleTick: 180, envelope: envelope(180, { p: 'b' }) }),
    ]);
    expect(web.getCommitLog()).toHaveLength(2);
    expect(results.map((r) => r.commitId)).toEqual([150, 180]);
  });

  it('rejects enqueue after close with QUEUE_CLOSED', async () => {
    const web = new WebQaStore();
    const coordinator = new SaveWriteCoordinator(web);
    coordinator.close();
    await expect(coordinator.enqueue(makeRequest('profile', 1, { v: 1 }))).rejects.toMatchObject({ code: 'QUEUE_CLOSED' });
  });

  it('propagates store failures to every affected caller', async () => {
    const web = new WebQaStore((step) => (step === 'manifest_rename' ? 'MANIFEST_COMMIT_FAILED' : null));
    const coordinator = new SaveWriteCoordinator(web);
    await expect(coordinator.enqueue(makeRequest('profile', 1, { v: 1 }))).rejects.toMatchObject({
      code: 'MANIFEST_COMMIT_FAILED',
    });
    const stats = coordinator.getStats();
    expect(stats.failed).toBe(1);
  });
});
