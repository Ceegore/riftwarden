import { RandomInvariantError } from '../sim/random/invariant-error.js';
import { parseRunSeed } from '../sim/random/run-seed.js';
import { REPLAY_SPEED_MILLI, type ReplaySpeedMilli } from '../rules/mechanic-rules.js';
import type { JsonValue } from './json-value.js';
import type { ReplayAuthoritative, ReplayDecision, ReplayDisplaySpeedEvent, ReplayFile } from './replay-types.js';

const HEX64 = /^[0-9a-f]{64}$/;
const VERSION = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const DECISION = /^[a-z][A-Za-z0-9.:-]{1,79}$/;
// Record shapes are validated by `exact()` before typed access; declaring the
// fields keeps dot access legal under noPropertyAccessFromIndexSignature.
interface DecisionRecord { tick: number; sequence: number; type: string; payload: unknown }
interface SpeedEventRecord { tick: number; speedMilli: number }
interface RootRecord { authoritative: unknown; integrity: unknown; display?: unknown; debug?: unknown }
interface AuthoritativeRecord { schemaVersion: unknown; contentVersion: string; simulationVersion: string; runSeed: unknown; startSnapshot: unknown; decisions: unknown[] }
interface IntegrityRecord { algorithm: string; authoritativeHash: string }
interface DisplayRecord { speedEvents: unknown[] }
interface DebugRecord { eventLog: unknown[] }
function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new RandomInvariantError('P13_REPLAY_FIELD');
  return value as Record<string, unknown>;
}
function exact(record: object, required: readonly string[], optional: readonly string[] = []): void {
  const rec = record as Record<string, unknown>;
  const allowed = new Set([...required, ...optional]);
  if (required.some((k) => !(k in rec)) || Object.keys(rec).some((k) => !allowed.has(k))) throw new RandomInvariantError('P13_REPLAY_FIELD');
}
function integer(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || Object.is(value, -0)) throw new RandomInvariantError('P13_REPLAY_FIELD');
  return value as number;
}

function decision(value: unknown): ReplayDecision {
  const r = object(value) as unknown as DecisionRecord;
  exact(r, ['tick', 'sequence', 'type', 'payload']);
  if (typeof r.type !== 'string' || !DECISION.test(r.type)) throw new RandomInvariantError('P13_REPLAY_FIELD');
  return Object.freeze({ tick: integer(r.tick), sequence: integer(r.sequence), type: r.type, payload: r.payload as JsonValue });
}
function speedEvent(value: unknown): ReplayDisplaySpeedEvent {
  const r = object(value) as unknown as SpeedEventRecord;
  exact(r, ['tick', 'speedMilli']);
  const speed = integer(r.speedMilli);
  if (!(REPLAY_SPEED_MILLI as readonly number[]).includes(speed)) throw new RandomInvariantError('P13_REPLAY_FIELD');
  return Object.freeze({ tick: integer(r.tick), speedMilli: speed as ReplaySpeedMilli });
}
function assertMonotonic(items: readonly { tick: number; sequence?: number }[]): void {
  for (let i = 1; i < items.length; i += 1) {
    const a = items[i - 1];
    const b = items[i];
    if (a === undefined || b === undefined) throw new RandomInvariantError('P13_REPLAY_FIELD', { reason: 'non-monotonic-order', index: i });
    if (b.tick < a.tick || (b.tick === a.tick && (b.sequence ?? 0) <= (a.sequence ?? 0))) throw new RandomInvariantError('P13_REPLAY_FIELD', { reason: 'non-monotonic-order', index: i });
  }
}

export function validateReplayFile(value: unknown): ReplayFile {
  const root = object(value) as unknown as RootRecord;
  exact(root, ['authoritative', 'integrity'], ['display', 'debug']);
  const a = object(root.authoritative) as unknown as AuthoritativeRecord;
  exact(a, ['schemaVersion', 'contentVersion', 'simulationVersion', 'runSeed', 'startSnapshot', 'decisions']);
  if (!Number.isInteger(a.schemaVersion)) throw new RandomInvariantError('P13_REPLAY_FIELD');
  if (a.schemaVersion !== 1) throw new RandomInvariantError('P13_REPLAY_SCHEMA_UNSUPPORTED', { schemaVersion: a.schemaVersion as number });
  if (typeof a.contentVersion !== 'string' || !HEX64.test(a.contentVersion) || typeof a.simulationVersion !== 'string' || !VERSION.test(a.simulationVersion) || !Array.isArray(a.decisions)) throw new RandomInvariantError('P13_REPLAY_FIELD');
  const decisions = Object.freeze(a.decisions.map(decision));
  assertMonotonic(decisions);
  const authoritative: ReplayAuthoritative = Object.freeze({
    schemaVersion: 1,
    contentVersion: a.contentVersion,
    simulationVersion: a.simulationVersion,
    runSeed: parseRunSeed(a.runSeed),
    startSnapshot: a.startSnapshot as JsonValue,
    decisions
  });
  const i = object(root.integrity) as unknown as IntegrityRecord;
  exact(i, ['algorithm', 'authoritativeHash']);
  if (i.algorithm !== 'sha256' || typeof i.authoritativeHash !== 'string' || !HEX64.test(i.authoritativeHash)) throw new RandomInvariantError('P13_REPLAY_FIELD');
  const result: {
    authoritative: ReplayAuthoritative;
    integrity: { algorithm: 'sha256'; authoritativeHash: string };
    display?: { speedEvents: readonly ReplayDisplaySpeedEvent[] };
    debug?: { eventLog: readonly JsonValue[] };
  } = { authoritative, integrity: Object.freeze({ algorithm: 'sha256', authoritativeHash: i.authoritativeHash }) };
  if (root.display !== undefined) {
    const d = object(root.display) as unknown as DisplayRecord;
    exact(d, ['speedEvents']);
    if (!Array.isArray(d.speedEvents)) throw new RandomInvariantError('P13_REPLAY_FIELD');
    const speedEvents = Object.freeze(d.speedEvents.map(speedEvent));
    assertMonotonic(speedEvents);
    result.display = Object.freeze({ speedEvents });
  }
  if (root.debug !== undefined) {
    const d = object(root.debug) as unknown as DebugRecord;
    exact(d, ['eventLog']);
    if (!Array.isArray(d.eventLog)) throw new RandomInvariantError('P13_REPLAY_FIELD');
    result.debug = Object.freeze({ eventLog: Object.freeze(d.eventLog as JsonValue[]) });
  }
  return Object.freeze(result);
}
