import { sha256Hex } from '../sim/snapshot/sha256.js';
import { canonicalUtf8, type JsonValue } from './canonical-json.js';
import { SaveError } from './save-error.js';

export interface SaveEnvelope<T extends JsonValue> {
  readonly magic: 'RIFTWARDEN_SAVE';
  readonly formatVersion: 1;
  readonly schemaVersion: number;
  readonly simulationVersion: number;
  readonly contentVersion: string;
  readonly appVersion: string;
  readonly commitId: number;
  readonly committedAtUtc: string;
  readonly payloadSha256: string;
  readonly payload: T;
}

const REQUIRED_KEYS = [
  'appVersion',
  'commitId',
  'committedAtUtc',
  'contentVersion',
  'formatVersion',
  'magic',
  'payload',
  'payloadSha256',
  'schemaVersion',
  'simulationVersion',
] as const;

export function payloadHash(payload: JsonValue): string {
  return sha256Hex(canonicalUtf8(payload));
}

function assertSameKeys(actual: readonly string[]): void {
  const sorted = [...actual].sort();
  const expected = [...REQUIRED_KEYS].sort();
  if (sorted.length !== expected.length) throw new SaveError('INVALID_ENVELOPE');
  for (let i = 0; i < expected.length; i++) {
    if (sorted[i] !== expected[i]) throw new SaveError('INVALID_ENVELOPE');
  }
}

function assertSafeNonNegative(value: unknown): void {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new SaveError('INVALID_ENVELOPE');
  }
}

/**
 * Validates a persisted envelope value: closed field set (unknown fields are
 * rejected), magic/formatVersion, safe non-negative integer versions and
 * commitId, string fields, and a recomputed canonical payload SHA-256.
 * Comparison is constant-time over equal-length hex digests.
 */
export function validateEnvelope(value: unknown): asserts value is SaveEnvelope<JsonValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SaveError('INVALID_ENVELOPE');
  const record = value as Record<string, unknown>;
  assertSameKeys(Object.keys(record));
  if (record['magic'] !== 'RIFTWARDEN_SAVE' || record['formatVersion'] !== 1) throw new SaveError('INVALID_ENVELOPE');
  assertSafeNonNegative(record['schemaVersion']);
  assertSafeNonNegative(record['simulationVersion']);
  assertSafeNonNegative(record['commitId']);
  for (const key of ['contentVersion', 'appVersion', 'committedAtUtc', 'payloadSha256'] as const) {
    if (typeof record[key] !== 'string') throw new SaveError('INVALID_ENVELOPE');
  }
  const payload = record['payload'] as JsonValue;
  const expected = payloadHash(payload);
  const actual = record['payloadSha256'] as string;
  if (actual.length !== expected.length || actual !== expected) throw new SaveError('HASH_MISMATCH');
}
