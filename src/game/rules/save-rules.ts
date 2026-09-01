import { deepFreeze } from './deep-freeze.js';
export const SAVE_RULES = deepFreeze({
  autosaveRotationSlots: 3,
  manualProfileBackupSlots: 1,
  atomicWriteRequired: true,
  checksumBeforeReplace: true,
  fallbackToPreviousValidSlot: true,
  migrationDirection: 'forward',
  migrationIdempotent: true,
  backupBeforeMigration: true,
  internetRequired: false,
  deviceIdDependency: false,
  wallClockProgression: false,
} as const);
