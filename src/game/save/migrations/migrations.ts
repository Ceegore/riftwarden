import { SaveError } from '../save-error.js';
import type { SaveMigrationReport } from '../schema/types.js';

export interface Versioned {
  readonly schemaVersion: number;
}

export type Migration<T extends Versioned> = (input: Readonly<T>) => T;

export interface MigrationResult<T extends Versioned> {
  readonly value: T;
  readonly report: SaveMigrationReport;
}

/**
 * Sequential migration chain: only n -> n+1 edges are allowed. A direct jump
 * to latest is forbidden; registry gaps, cycles and future versions are hard
 * errors. Every edge is applied to a deep clone (the original stays
 * untouched) and must advance the schemaVersion by exactly one.
 */
export function migrateSequential<T extends Versioned>(
  input: Readonly<T>,
  latest: number,
  registry: ReadonlyMap<number, Migration<T>>,
): MigrationResult<T> {
  if (input.schemaVersion > latest) throw new SaveError('FUTURE_SCHEMA');
  if (input.schemaVersion < 1 || !Number.isSafeInteger(input.schemaVersion)) throw new SaveError('INVALID_SCHEMA');
  const from = input.schemaVersion;
  let value = structuredClone(input) as T;
  const steps: string[] = [];
  while (value.schemaVersion < latest) {
    const edge = registry.get(value.schemaVersion);
    if (!edge) throw new SaveError('MIGRATION_GAP', { from: value.schemaVersion });
    const before = value.schemaVersion;
    const next = edge(value);
    if (typeof next.schemaVersion !== 'number' || next.schemaVersion !== before + 1) {
      throw new SaveError('INVALID_MIGRATION_EDGE', { from: before });
    }
    value = structuredClone(next);
    steps.push(`${String(before)}->${String(value.schemaVersion)}`);
  }
  return { value, report: { from, to: latest, steps } };
}

/**
 * Asserts the registry has exactly one edge per published version up to
 * `latest - 1` (edges n -> n+1) and no gaps or cycles. A registry migrating
 * to version N needs edges 1..N-1.
 */
export function assertNoCycle<T extends Versioned>(registry: ReadonlyMap<number, Migration<T>>, latest: number): void {
  const seen = new Set<number>();
  for (let version = 1; version < latest; version++) {
    const edge = registry.get(version);
    if (!edge) throw new SaveError('MIGRATION_GAP', { from: version });
    if (seen.has(version)) throw new SaveError('MIGRATION_CYCLE', { from: version });
    seen.add(version);
  }
}

/**
 * Idempotency: applying the full chain to already-current data must not
 * change the canonical result. The chain never runs past `latest`, so a
 * current payload passes through unchanged.
 */
export function migrateIdempotent<T extends Versioned>(
  input: Readonly<T>,
  latest: number,
  registry: ReadonlyMap<number, Migration<T>>,
): T {
  const result = migrateSequential(input, latest, registry);
  return result.value;
}
