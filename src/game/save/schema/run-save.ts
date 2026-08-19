import { SaveError } from '../save-error.js';
import {
  assertClosedKeys,
  assertClosedKeysWithOptional,
  asRecord,
  requireIdList,
  requireSafeNonNegative,
  requireString,
  requireStringRecord,
} from './decode-utils.js';
import { requireHeader } from './decode-utils.js';
import type { RunSave } from './types.js';

export const RUN_CURRENT_VERSION = 1;

const RUN_MODES = ['standard', 'challenge'] as const;
const RUN_STATUSES = ['active', 'safe_aborted', 'finished'] as const;

const ALLOWED_KEYS = [
  'schemaVersion',
  'contentVersion',
  'simulationVersion',
  'monotonicCommitId',
  'payloadId',
  'runMode',
  'runStatus',
  'mapState',
  'loadout',
  'loot',
  'decisions',
  'seedRef',
  'battleSnapshot',
] as const;

const REQUIRED_KEYS = ALLOWED_KEYS.filter((key) => key !== 'battleSnapshot');
const OPTIONAL_KEYS = ['battleSnapshot'] as const;

export function decodeRun(value: unknown, currentVersion: number = RUN_CURRENT_VERSION): RunSave {
  const record = asRecord(value);
  assertClosedKeysWithOptional(record, REQUIRED_KEYS, OPTIONAL_KEYS);
  requireHeader(record, currentVersion);

  const runMode = record['runMode'];
  if (!(RUN_MODES as readonly string[]).includes(runMode as string)) throw new SaveError('INVALID_ENUM', { field: 'runMode' });
  const runStatus = record['runStatus'];
  if (!(RUN_STATUSES as readonly string[]).includes(runStatus as string)) {
    throw new SaveError('INVALID_ENUM', { field: 'runStatus' });
  }

  const mapState = requireStringRecord(record['mapState'], 'mapState');
  const loadout = requireIdList(record['loadout'], 'loadout', []);
  const loot = requireIdList(record['loot'], 'loot', []);
  const decisions = decodeDecisions(record['decisions']);
  const seedRef = requireString(record['seedRef'], 'seedRef');
  if (seedRef.length === 0) throw new SaveError('INVALID_REFERENCE', { field: 'seedRef' });

  const snapshotValue = record['battleSnapshot'];
  const battleSnapshot = snapshotValue !== undefined ? decodeSnapshot(snapshotValue) : undefined;

  return {
    schemaVersion: record['schemaVersion'] as number,
    contentVersion: requireString(record['contentVersion'], 'contentVersion'),
    simulationVersion: requireString(record['simulationVersion'], 'simulationVersion'),
    monotonicCommitId: record['monotonicCommitId'] as number,
    payloadId: requireString(record['payloadId'], 'payloadId'),
    runMode: runMode as RunSave['runMode'],
    runStatus: runStatus as RunSave['runStatus'],
    mapState,
    loadout,
    loot,
    decisions,
    seedRef,
    ...(battleSnapshot ? { battleSnapshot } : {}),
  };
}

function decodeSnapshot(value: unknown): RunSave['battleSnapshot'] {
  const snapshot = asRecord(value);
  assertClosedKeys(snapshot, ['tick', 'snapshotRef']);
  const tick = requireSafeNonNegative(snapshot['tick'], 'tick');
  const snapshotRef = requireString(snapshot['snapshotRef'], 'snapshotRef');
  if (snapshotRef.length === 0) throw new SaveError('INVALID_REFERENCE', { field: 'snapshotRef' });
  return { tick, snapshotRef };
}

function decodeDecisions(value: unknown): RunSave['decisions'] {
  if (!Array.isArray(value)) throw new SaveError('INVALID_FIELD', { field: 'decisions' });
  const result: { readonly nodeId: string; readonly choiceId: string }[] = [];
  for (const entry of value) {
    const record = asRecord(entry);
    assertClosedKeys(record, ['nodeId', 'choiceId']);
    const nodeId = requireString(record['nodeId'], 'nodeId');
    const choiceId = requireString(record['choiceId'], 'choiceId');
    result.push({ nodeId, choiceId });
  }
  return result;
}
