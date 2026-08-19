import { SaveError } from '../save-error.js';
import { decodeSettings } from '../schema/settings-schema.js';
import type { SettingsSave } from '../schema/types.js';
import type { Migration } from './migrations.js';

export const SETTINGS_LATEST = 2;

/**
 * v1 -> v2: adds `subtitleBackdrop` (boolean) with the default `false`,
 * keeping all other fields byte-stable. The input is validated first and the
 * output is validated after; the original object is never mutated.
 */
export const settingsV1toV2: Migration<SettingsSave> = (input) => {
  if (input.schemaVersion !== 1) throw new SaveError('INVALID_MIGRATION_EDGE', { from: input.schemaVersion });
  decodeSettings(input, 1);
  return {
    schemaVersion: 2,
    contentVersion: input.contentVersion,
    simulationVersion: input.simulationVersion,
    monotonicCommitId: input.monotonicCommitId,
    payloadId: input.payloadId,
    language: input.language,
    textScale: input.textScale,
    masterVolume: input.masterVolume,
    reducedMotion: input.reducedMotion,
    subtitleBackdrop: false,
  };
};

export const SETTINGS_MIGRATIONS: ReadonlyMap<number, Migration<SettingsSave>> = new Map([[1, settingsV1toV2]]);
