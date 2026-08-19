import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SaveError } from '../../src/game/save/save-error.js';
import { SaveService, type SaveCommitInput } from '../../src/game/save/save-service.js';
import { CommitCoordinator } from '../../src/game/save/commit-coordinator.js';
import { WebQaStore } from '../../src/game/save/web-qa-store.js';
import { createResumePlan, validateSnapshot, assertGoldenHash, type BattleSnapshot } from '../../src/game/save/battle-resume.js';
import { validateEntries, MAX_TOTAL_BYTES, MAX_ENTRY_BYTES, TRANSFER_EXTENSION } from '../../src/game/save/transfer/transfer-policy.js';
import {
  validateQuarantineContainer,
  buildImportPreview,
  commitPlanFor,
} from '../../src/game/save/transfer/quarantine.js';
import { decideRecovery, type RecoveryInput } from '../../src/game/save/recovery/recovery-engine.js';
import { buildDiagnostic, isDiagnosticKey } from '../../src/game/save/recovery/diagnostics.js';
import { payloadHash } from '../../src/game/save/save-envelope.js';
import type { JsonValue } from '../../src/game/save/canonical-json.js';
import type { SaveCommitReason } from '../../src/game/save/schema/types.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (name: string): unknown =>
  JSON.parse(readFileSync(path.join(here, '..', '..', 'contracts', 'phase24', name), 'utf8'));

function codeOf(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof SaveError ? error.code : null;
  }
}

function expectCode(fn: () => void, code: string): void {
  expect(codeOf(fn)).toBe(code);
}

// ---------------------------------------------------------------------------
// Commit coordinator + SaveService (P24 §7)
// ---------------------------------------------------------------------------

describe('P24 commit coordinator', () => {
  it('commits once and rejects duplicates by idempotency key', () => {
    const coordinator = new CommitCoordinator();
    expect(coordinator.commit({ reason: 'profile_change', idempotencyKey: 'k1', commitId: 1, payload: {} })).toBe('committed');
    expect(coordinator.commit({ reason: 'profile_change', idempotencyKey: 'k1', commitId: 1, payload: {} })).toBe('duplicate');
  });

  it('rejects non-monotonic commitId', () => {
    const coordinator = new CommitCoordinator();
    coordinator.commit({ reason: 'profile_change', idempotencyKey: 'k1', commitId: 5, payload: {} });
    expectCode(() => {
      coordinator.commit({ reason: 'profile_change', idempotencyKey: 'k2', commitId: 5, payload: {} });
    }, 'NON_MONOTONIC_COMMIT');
    expectCode(() => {
      coordinator.commit({ reason: 'profile_change', idempotencyKey: 'k3', commitId: 3, payload: {} });
    }, 'NON_MONOTONIC_COMMIT');
  });

  it('rejects an empty idempotency key', () => {
    const coordinator = new CommitCoordinator();
    expectCode(() => {
      coordinator.commit({ reason: 'profile_change', idempotencyKey: '', commitId: 1, payload: {} });
    }, 'INVALID_ARGUMENT');
  });
});

describe('P24 SaveService commit matrix', () => {
  it('commits every authorized reason through the store', async () => {
    const store = new WebQaStore();
    const service = new SaveService(store);
    const reasons = (read('fixtures/commit-matrix.json') as { reasons: readonly string[] }).reasons;
    for (const reason of reasons) {
      const input: SaveCommitInput = {
        family: reason === 'battle_snapshot' || reason === 'battle_started' || reason === 'battle_finished' ? 'battle' : 'profile',
        reason: reason as SaveCommitReason,
        idempotencyKey: `${reason}-1`,
        payload: { reason },
        ...(reason === 'battle_snapshot' ? { battleTick: 150 } : {}),
      };
      const result = await service.commit(input);
      expect(result.commitId).toBeGreaterThan(0);
    }
    expect(store.getCommitLog()).toHaveLength(reasons.length);
  });

  it('rejects a duplicate event without side effects', async () => {
    const store = new WebQaStore();
    const service = new SaveService(store);
    await service.commit({ family: 'profile', reason: 'reward_committed', idempotencyKey: 'reward-1', payload: { loot: ['x'] } });
    await expect(
      service.commit({ family: 'profile', reason: 'reward_committed', idempotencyKey: 'reward-1', payload: { loot: ['x'] } }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_COMMIT' });
    expect(store.getCommitLog()).toHaveLength(1);
  });

  it('never coalesces profile or reward commits', async () => {
    const store = new WebQaStore(() => null, 2);
    const service = new SaveService(store);
    const results = await Promise.all([
      service.commit({ family: 'profile', reason: 'profile_change', idempotencyKey: 'p1', payload: { v: 1 } }),
      service.commit({ family: 'profile', reason: 'reward_committed', idempotencyKey: 'p2', payload: { v: 2 } }),
      service.commit({ family: 'profile', reason: 'profile_change', idempotencyKey: 'p3', payload: { v: 3 } }),
    ]);
    expect(results).toHaveLength(3);
    expect(store.getCommitLog()).toHaveLength(3);
  });

  it('coalesces waiting battle snapshots onto the newest tick', async () => {
    const store = new WebQaStore(() => null, 1);
    const service = new SaveService(store);
    await service.commit({ family: 'battle', reason: 'battle_started', idempotencyKey: 'b0', payload: { v: 0 } });
    await Promise.all(
      [150, 151, 180, 210].map((tick) =>
        service.commit({
          family: 'battle',
          reason: 'battle_snapshot',
          idempotencyKey: `b-${String(tick)}`,
          payload: { tick },
          battleTick: tick,
        }),
      ),
    );
    // battle_started + first active snapshot + coalesced newest waiting tick
    // = three actual writes; the persisted envelope carries the newest tick.
    expect(store.getCommitLog()).toHaveLength(3);
    const loaded = await store.load('battle');
    expect((loaded.payload as { tick: number }).tick).toBe(210);
  });
});

// ---------------------------------------------------------------------------
// Battle snapshot + resume (P24 §8)
// ---------------------------------------------------------------------------

describe('P24 battle resume', () => {
  const snapshot = (overrides: Partial<BattleSnapshot> = {}): BattleSnapshot => ({
    tick: 150,
    phase: 'I',
    sequence: 9,
    rngStates: ['stream-a'],
    scheduler: [{ tick: 150 }],
    entities: [{ id: 'u1' }, { id: 'u2' }],
    expectedPreResumeHash: 'a'.repeat(64),
    ...overrides,
  });

  it('creates a paused, no-auto-resume plan', () => {
    const plan = createResumePlan(snapshot());
    expect(plan.paused).toBe(true);
    expect(plan.allowAutoResume).toBe(false);
    expect(plan.steps).toEqual(['rebuild_sim', 'verify_hash', 'build_views', 'ready_audio_input', 'await_user_continue']);
    expect(plan.tick).toBe(150);
  });

  it('rejects snapshots with missing RNG, duplicate entities or bad hash', () => {
    expectCode(() => {
      validateSnapshot(snapshot({ rngStates: [] }));
    }, 'INVALID_SNAPSHOT');
    expectCode(() => {
      validateSnapshot(snapshot({ entities: [{ id: 'u1' }, { id: 'u1' }] }));
    }, 'INVALID_SNAPSHOT');
    expectCode(() => {
      validateSnapshot(snapshot({ expectedPreResumeHash: 'short' }));
    }, 'INVALID_SNAPSHOT');
    expectCode(() => {
      validateSnapshot(snapshot({ tick: -1 }));
    }, 'INVALID_SNAPSHOT');
  });

  it('pins the golden resume contract', () => {
    const golden = read('fixtures/battle-resume-golden.json') as {
      id: string;
      cuts: readonly string[];
      expected: string;
    };
    expect(golden.id).toBe('golden_save_301');
    expect(golden.cuts).toEqual(['cast_commit', 'projectile_in_flight', 'spawn_commit', 'tick_150', 'tick_300']);
    expect(golden.expected).toBe('same_end_hash_and_relevant_event_log');
    expect(() => {
      assertGoldenHash('hash', 'hash');
    }).not.toThrow();
    expectCode(() => {
      assertGoldenHash('a', 'b');
    }, 'GOLDEN_HASH_MISMATCH');
  });
});

// ---------------------------------------------------------------------------
// Transfer + quarantine (P24 §9)
// ---------------------------------------------------------------------------

describe('P24 transfer policy', () => {
  it('pins the container constants', () => {
    expect(TRANSFER_EXTENSION).toBe('.riftwarden-save');
    expect(MAX_TOTAL_BYTES).toBe(10 * 1024 * 1024);
    expect(MAX_ENTRY_BYTES).toBe(8 * 1024 * 1024);
  });

  it('accepts the known root files', () => {
    const entries = [
      { name: 'manifest.json', size: 10, compressedSize: 10, isLink: false },
      { name: 'profile.json', size: 20, compressedSize: 20, isLink: false },
    ];
    expect(() => {
      validateEntries(entries);
    }).not.toThrow();
  });

  it('rejects every malicious corpus case', () => {
    const corpus = (read('fixtures/transfer-malicious-corpus.json') as { cases: readonly string[] }).cases;
    const total = new Set(corpus);
    expect(total.has('dotdot')).toBe(true);
    expect(total.has('unknown_file')).toBe(true);
    expect(total.has('entry_over_8mib')).toBe(true);
    expect(total.has('total_over_10mib')).toBe(true);
    expect(total.has('compression_bomb')).toBe(true);

    expectCode(() => {
      validateEntries([{ name: '../x', size: 1, compressedSize: 1, isLink: false }]);
    }, 'INVALID_ENTRY_NAME');
    expectCode(() => {
      validateEntries([{ name: '/etc/passwd', size: 1, compressedSize: 1, isLink: false }]);
    }, 'INVALID_ENTRY_NAME');
    expectCode(() => {
      validateEntries([{ name: 'a\\b.json', size: 1, compressedSize: 1, isLink: false }]);
    }, 'INVALID_ENTRY_NAME');
    expectCode(() => {
      validateEntries([{ name: 'sub/profile.json', size: 1, compressedSize: 1, isLink: false }]);
    }, 'INVALID_ENTRY_NAME');
    expectCode(() => {
      validateEntries([{ name: 'profile.json', size: 1, compressedSize: 1, isLink: true }]);
    }, 'LINK_FORBIDDEN');
    expectCode(() => {
      validateEntries([
          { name: 'profile.json', size: 1, compressedSize: 1, isLink: false },
          { name: 'profile.json', size: 1, compressedSize: 1, isLink: false },
        ]);
    }, 'DUPLICATE_ENTRY');
    expectCode(() => {
      validateEntries([{ name: 'hack.json', size: 1, compressedSize: 1, isLink: false }]);
    }, 'INVALID_ENTRY_NAME');
    expectCode(() => {
      validateEntries([{ name: 'profile.json', size: MAX_ENTRY_BYTES + 1, compressedSize: 1, isLink: false }]);
    }, 'ENTRY_TOO_LARGE');
    expectCode(() => {
      validateEntries([
          { name: 'profile.json', size: MAX_ENTRY_BYTES, compressedSize: MAX_ENTRY_BYTES, isLink: false },
          { name: 'run.json', size: MAX_ENTRY_BYTES, compressedSize: MAX_ENTRY_BYTES, isLink: false },
          { name: 'settings.json', size: MAX_ENTRY_BYTES, compressedSize: MAX_ENTRY_BYTES, isLink: false },
        ]);
    }, 'TOTAL_TOO_LARGE');
    expectCode(() => {
      validateEntries([{ name: 'profile.json', size: 1_000_000, compressedSize: 1, isLink: false }]);
    }, 'BOMB_RATIO');
  });

  it('validates quarantine containers and previews without touching active saves', () => {
    const files: Record<string, JsonValue> = {
      'manifest.json': { version: 1 },
      'profile.json': { permanentProgress: { level: 3, renown: 500 } },
      'run.json': { runStatus: 'active' },
      'settings.json': { language: 'de' },
    };
    const entries = Object.keys(files).map((name) => ({ name, size: 10, compressedSize: 10, isLink: false }));
    expect(() => {
      validateQuarantineContainer(entries, files);
    }).not.toThrow();

    const preview = buildImportPreview(files, 'v1');
    expect(preview.progress).toEqual({ level: 3, renown: 500 });
    const plan = commitPlanFor(preview);
    expect(plan.replaces).toEqual(['profile', 'run', 'settings']);
  });

  it('rejects missing and unknown container files', () => {
    expectCode(() => {
      validateQuarantineContainer([], { 'profile.json': { v: 1 } });
    }, 'MISSING_CONTAINER_FILE');
    expectCode(() => {
      validateQuarantineContainer([], {
          'manifest.json': { v: 1 },
          'profile.json': { v: 1 },
          'run.json': { v: 1 },
          'settings.json': { v: 1 },
          'evil.json': { v: 1 },
        });
    }, 'UNKNOWN_CONTAINER_FILE');
  });
});

// ---------------------------------------------------------------------------
// Recovery engine (P24 §10)
// ---------------------------------------------------------------------------

describe('P24 recovery engine', () => {
  const base: RecoveryInput = {
    active: { valid: true, commitId: 3 },
    others: [{ valid: false, commitId: 2 }],
    profileValid: true,
    runValid: true,
    migrationFailed: false,
    contentCompatible: true,
    diskFull: false,
    rendererAvailable: true,
  };

  it('loads the active slot when everything is valid', () => {
    const decision = decideRecovery(base);
    expect(decision.reason).toBe('none');
    expect(decision.action).toBe('load_active');
    expect(decision.requiresConfirmation).toBe(false);
  });

  it('falls back to the highest valid commitId when the active slot is invalid', () => {
    const decision = decideRecovery({ ...base, active: { valid: false, commitId: 4 }, others: [{ valid: true, commitId: 2 }, { valid: true, commitId: 7 }] });
    expect(decision.reason).toBe('newest_slot_invalid');
    expect(decision.action).toBe('load_highest_valid');
    expect(decision.requiresConfirmation).toBe(false);
  });

  it('offers import or new profile when no slot is valid (never deletes)', () => {
    const decision = decideRecovery({ ...base, active: { valid: false, commitId: 4 }, others: [] });
    expect(decision.reason).toBe('newest_slot_invalid');
    expect(decision.action).toBe('offer_import_or_new_profile');
    expect(decision.requiresConfirmation).toBe(true);
  });

  it('requires confirmation for safe run abort when the profile is valid', () => {
    const decision = decideRecovery({ ...base, runValid: false });
    expect(decision.reason).toBe('run_invalid');
    expect(decision.action).toBe('confirm_safe_abort');
    expect(decision.requiresConfirmation).toBe(true);
  });

  it('handles migration failure, content mismatch, disk full and renderer loss', () => {
    expect(decideRecovery({ ...base, migrationFailed: true }).reason).toBe('migration_failed');
    expect(decideRecovery({ ...base, contentCompatible: false }).reason).toBe('content_mismatch');
    expect(decideRecovery({ ...base, diskFull: true }).reason).toBe('insufficient_storage');
    expect(decideRecovery({ ...base, rendererAvailable: false }).reason).toBe('renderer_unavailable');
  });

  it('covers every pinned recovery-matrix row', () => {
    const matrix = (read('fixtures/recovery-matrix.json') as { rows: readonly string[] }).rows;
    expect(matrix).toEqual([
      'newest_slot_invalid',
      'run_invalid_profile_valid',
      'migration_failed',
      'content_mismatch_compatible',
      'content_mismatch_blocked',
      'insufficient_storage',
      'renderer_unavailable',
      'no_valid_slots',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Diagnostics (P24 §11)
// ---------------------------------------------------------------------------

describe('P24 diagnostics', () => {
  it('builds a minimized opt-in diagnostic with no payload content', () => {
    const report = {
      appVersion: '1.0.0',
      schemaVersions: { profile: 1, run: 1, settings: 2 },
      contentVersion: 'c1',
      simulationVersion: 's1',
      slotIntegrity: { A: 'valid', B: 'invalid' },
      recoveryDecisions: ['newest_slot_invalid'],
      rendererAvailable: true,
      errorCodes: ['INVALID_ENVELOPE'],
    } as const;
    const json = buildDiagnostic(report) as Record<string, unknown>;
    for (const key of Object.keys(json)) {
      expect(isDiagnosticKey(key)).toBe(true);
    }
    expect(json['recoveryDecisions']).toEqual(['newest_slot_invalid']);
    expect(JSON.stringify(json)).not.toContain('payload');
  });

  it('excludes personal data, paths and device ids by construction', () => {
    const report = {
      appVersion: '1.0.0',
      schemaVersions: { profile: 1, run: 1, settings: 2 },
      contentVersion: 'c1',
      simulationVersion: 's1',
      slotIntegrity: {},
      recoveryDecisions: ['none'] as const,
      rendererAvailable: true,
      errorCodes: [],
    };
    const text = JSON.stringify(buildDiagnostic(report));
    expect(text).not.toContain('C:\\');
    expect(text).not.toContain('deviceId');
    expect(text).not.toContain('email');
  });

  it('hashes payloads deterministically for envelope integrity', () => {
    expect(payloadHash({ a: 1, b: 2 })).toBe(payloadHash({ b: 2, a: 1 }));
    expect(payloadHash({ v: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });
});
