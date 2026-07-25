import { describe, expect, it } from 'vitest';
import { DiagnosticLogger } from '../../src/platform/diagnostics/logger';
import { MemoryDiagnosticStore } from '../../src/platform/diagnostics/memory-store';
import { sanitizeDiagnosticContext } from '../../src/platform/diagnostics/safe-context';

describe('diagnostics', () => {
  it('removes forbidden context keys', () => {
    expect(
      sanitizeDiagnosticContext({
        moduleState: 'ready',
        deviceId: 'forbidden',
        userEmail: 'forbidden',
        elapsedMs: 10,
      }),
    ).toEqual({ moduleState: 'ready', elapsedMs: 10 });
  });

  it('keeps logging failures out of the app path', async () => {
    const logger = new DiagnosticLogger(
      {
        readSessions: () => Promise.reject(new Error('disk failure')),
        replaceSessions: () => Promise.resolve(),
      },
      {
        appVersion: '1.0.0',
        buildChannel: 'release',
        platform: 'web',
        osVersion: 'test',
        sessionId: 'session',
        startedAtUtc: '2026-01-01T00:00:00Z',
        nowUtc: () => '2026-01-01T00:00:01Z',
      },
    );
    await expect(logger.record('TEST', 'unit', {})).resolves.toBeUndefined();
    expect(logger.getHealth().appendFailures).toBe(1);
  });

  it('stores local structured entries', async () => {
    const store = new MemoryDiagnosticStore();
    const logger = new DiagnosticLogger(store, {
      appVersion: '1.0.0',
      buildChannel: 'qa',
      platform: 'web',
      osVersion: 'test',
      sessionId: 'session',
      startedAtUtc: '2026-01-01T00:00:00Z',
      nowUtc: () => '2026-01-01T00:00:01Z',
    });
    await logger.record('TEST', 'unit', { elapsedMs: 1 });
    const sessions = await store.readSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.entries[0]?.errorCode).toBe('TEST');
  });
});
