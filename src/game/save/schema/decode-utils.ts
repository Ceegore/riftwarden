import { SaveError } from '../save-error.js';

export type DecodeErrorCode =
  | 'INVALID_OBJECT'
  | 'UNKNOWN_FIELD'
  | 'MISSING_FIELD'
  | 'INVALID_SCHEMA'
  | 'FUTURE_SCHEMA'
  | 'INVALID_FIELD'
  | 'INVALID_LANGUAGE'
  | 'INVALID_TEXT_SCALE'
  | 'INVALID_VOLUME'
  | 'INVALID_ENUM'
  | 'INVALID_RANGE'
  | 'INVALID_REFERENCE'
  | 'INVALID_ID';

export function decodeFailure(code: DecodeErrorCode): never {
  throw new SaveError(code);
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) decodeFailure('INVALID_OBJECT');
  return value as Record<string, unknown>;
}

export function assertClosedKeys(record: Record<string, unknown>, allowed: readonly string[]): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) throw new SaveError('UNKNOWN_FIELD', { field: key });
  }
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) throw new SaveError('MISSING_FIELD', { field: key });
  }
}

/** Like assertClosedKeys but `optional` keys are not required to be present. */
export function assertClosedKeysWithOptional(
  record: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
): void {
  const allowed = [...required, ...optional];
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) throw new SaveError('UNKNOWN_FIELD', { field: key });
  }
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) throw new SaveError('MISSING_FIELD', { field: key });
  }
}

export function requireSafeNonNegative(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new SaveError('INVALID_FIELD', { field });
  }
  return value;
}

export function requireRange(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new SaveError('INVALID_FIELD', { field });
  if (value < min || value > max) throw new SaveError('INVALID_RANGE', { field, min, max });
  return value;
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new SaveError('INVALID_FIELD', { field });
  return value;
}

export function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new SaveError('INVALID_FIELD', { field });
  return value;
}

export function requireIdList(value: unknown, field: string, allowed: readonly string[]): readonly string[] {
  if (!Array.isArray(value)) throw new SaveError('INVALID_FIELD', { field });
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') throw new SaveError('INVALID_FIELD', { field });
    if (seen.has(entry)) throw new SaveError('INVALID_ID', { field });
    seen.add(entry);
    if (allowed.length > 0 && !allowed.includes(entry)) throw new SaveError('INVALID_ID', { field, id: entry });
    result.push(entry);
  }
  return result;
}

export function requireStringRecord(value: unknown, field: string): Readonly<Record<string, number>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new SaveError('INVALID_FIELD', { field });
  const record = value as Record<string, number>;
  const result: Record<string, number> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (!Number.isSafeInteger(entry) || entry < 0) throw new SaveError('INVALID_FIELD', { field });
    result[key] = entry;
  }
  return result;
}

export function requireHeader(record: Record<string, unknown>, currentVersion: number): void {
  const schemaVersion = record['schemaVersion'];
  if (typeof schemaVersion !== 'number' || !Number.isSafeInteger(schemaVersion) || schemaVersion < 1) {
    throw new SaveError('INVALID_SCHEMA');
  }
  if (schemaVersion > currentVersion) throw new SaveError('FUTURE_SCHEMA');
  for (const field of ['contentVersion', 'simulationVersion', 'payloadId'] as const) {
    requireString(record[field], field);
  }
  requireSafeNonNegative(record['monotonicCommitId'], 'monotonicCommitId');
}
