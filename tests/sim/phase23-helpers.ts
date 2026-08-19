import type { JsonValue } from '../../src/game/save/canonical-json.js';
import { payloadHash, type SaveEnvelope } from '../../src/game/save/save-envelope.js';
import { SaveError } from '../../src/game/save/save-error.js';
import type { CommitRequest, SaveFamily } from '../../src/game/save/native-save-store.js';

export function envelope(commitId: number, payload: JsonValue): SaveEnvelope<JsonValue> {
  return Object.freeze({
    magic: 'RIFTWARDEN_SAVE',
    formatVersion: 1,
    schemaVersion: 1,
    simulationVersion: 1,
    contentVersion: 'c1',
    appVersion: 'a1',
    commitId,
    committedAtUtc: '2026-07-18T00:00:00Z',
    payloadSha256: payloadHash(payload),
    payload,
  });
}

export function makeRequest(family: SaveFamily = 'profile', commitId = 1, payload: JsonValue = { v: 1 }): CommitRequest {
  return { family, reason: family === 'battle' ? 'battle_snapshot' : family, envelope: envelope(commitId, payload) };
}

export function catchCode(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof SaveError ? error.code : null;
  }
}

export async function catchAsync(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (error) {
    return error instanceof SaveError ? error.code : null;
  }
}
