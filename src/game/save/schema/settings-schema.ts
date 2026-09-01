import { SaveError } from '../save-error.js';
import {
  assertClosedKeys,
  asRecord,
  requireBoolean,
  requireHeader,
  requireRange,
  requireString,
} from './decode-utils.js';
import type { SettingsSave, TextScale } from './types.js';

export const TEXT_SCALES: readonly TextScale[] = [100, 125, 150, 175, 200];
export const SETTINGS_CURRENT_VERSION = 1;

const ALLOWED_KEYS = [
  'schemaVersion',
  'contentVersion',
  'simulationVersion',
  'monotonicCommitId',
  'payloadId',
  'language',
  'textScale',
  'masterVolume',
  'reducedMotion',
] as const;

export function decodeSettings(value: unknown, currentVersion: number = SETTINGS_CURRENT_VERSION): SettingsSave {
  const record = asRecord(value);
  assertClosedKeys(record, ALLOWED_KEYS);
  requireHeader(record, currentVersion);
  const language = record['language'];
  if (language !== 'de' && language !== 'en') throw new SaveError('INVALID_LANGUAGE');
  const textScale = record['textScale'];
  if (!(TEXT_SCALES as readonly number[]).includes(textScale as number)) throw new SaveError('INVALID_TEXT_SCALE');
  const masterVolume = requireRange(record['masterVolume'], 'masterVolume', 0, 100);
  const reducedMotion = requireBoolean(record['reducedMotion'], 'reducedMotion');
  return {
    schemaVersion: record['schemaVersion'] as number,
    contentVersion: requireString(record['contentVersion'], 'contentVersion'),
    simulationVersion: requireString(record['simulationVersion'], 'simulationVersion'),
    monotonicCommitId: record['monotonicCommitId'] as number,
    payloadId: requireString(record['payloadId'], 'payloadId'),
    language,
    textScale: textScale as TextScale,
    masterVolume,
    reducedMotion,
  };
}

export function isSettingsVersion(value: unknown): boolean {
  try {
    decodeSettings(value);
    return true;
  } catch {
    return false;
  }
}
