import { SaveError } from '../save-error.js';
import {
  assertClosedKeys,
  asRecord,
  requireIdList,
  requireRange,
  requireSafeNonNegative,
  requireString,
  requireStringRecord,
} from './decode-utils.js';
import { requireHeader } from './decode-utils.js';
import type { ProfileSave } from './types.js';

export const PROFILE_CURRENT_VERSION = 1;

const ALLOWED_KEYS = [
  'schemaVersion',
  'contentVersion',
  'simulationVersion',
  'monotonicCommitId',
  'payloadId',
  'permanentProgress',
  'inventory',
  'renown',
  'unlocks',
  'achievements',
  'statistics',
  'settingsRef',
] as const;

export function decodeProfile(value: unknown, currentVersion: number = PROFILE_CURRENT_VERSION): ProfileSave {
  const record = asRecord(value);
  assertClosedKeys(record, ALLOWED_KEYS);
  requireHeader(record, currentVersion);

  const progress = asRecord(record['permanentProgress']);
  assertClosedKeys(progress, ['level', 'experience']);
  const level = requireRange(progress['level'], 'level', 0, 999);
  const experience = requireSafeNonNegative(progress['experience'], 'experience');

  const inventory = requireStringRecord(record['inventory'], 'inventory');
  const renown = requireSafeNonNegative(record['renown'], 'renown');
  const unlocks = requireIdList(record['unlocks'], 'unlocks', []);
  const achievements = requireIdList(record['achievements'], 'achievements', []);
  const statistics = requireStringRecord(record['statistics'], 'statistics');
  const settingsRef = requireString(record['settingsRef'], 'settingsRef');
  if (settingsRef.length === 0) throw new SaveError('INVALID_REFERENCE', { field: 'settingsRef' });

  return {
    schemaVersion: record['schemaVersion'] as number,
    contentVersion: requireString(record['contentVersion'], 'contentVersion'),
    simulationVersion: requireString(record['simulationVersion'], 'simulationVersion'),
    monotonicCommitId: record['monotonicCommitId'] as number,
    payloadId: requireString(record['payloadId'], 'payloadId'),
    permanentProgress: { level, experience },
    inventory,
    renown,
    unlocks,
    achievements,
    statistics,
    settingsRef,
  };
}
