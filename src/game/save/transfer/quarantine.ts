import type { JsonValue } from '../canonical-json.js';
import { SaveError } from '../save-error.js';
import { validateEntries, type EntryMeta } from './transfer-policy.js';

export type ImportDecision = 'backup_and_import' | 'cancel';

export interface ImportPreview {
  readonly profile: JsonValue | null;
  readonly run: JsonValue | null;
  readonly settings: JsonValue | null;
  readonly sourceVersion: string;
  readonly progress: Readonly<{ readonly level: number; readonly renown: number }> | null;
}

export interface ImportCommitPlan {
  readonly replaces: readonly ('profile' | 'run' | 'settings')[];
  readonly finalCommitId: number;
}

const STAGED_KEYS = ['profile.json', 'run.json', 'settings.json', 'manifest.json'] as const;

/**
 * Import quarantine: bytes are validated in an isolated staging area with
 * entry limits applied while streaming. Container structure, hashes and
 * schemas are checked before any active save is touched. Import always
 * replaces profile and run fully; merge is forbidden. Active saves remain
 * byte-identical until the confirmed final commit.
 */
export function validateQuarantineContainer(entries: readonly EntryMeta[], files: Readonly<Record<string, JsonValue>>): void {
  validateEntries(entries);
  for (const key of STAGED_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(files, key)) throw new SaveError('MISSING_CONTAINER_FILE', { key });
  }
  for (const key of Object.keys(files)) {
    if (!(STAGED_KEYS as readonly string[]).includes(key)) throw new SaveError('UNKNOWN_CONTAINER_FILE', { key });
  }
}

export function buildImportPreview(files: Readonly<Record<string, JsonValue>>, sourceVersion: string): ImportPreview {
  const profile = files['profile.json'] ?? null;
  const run = files['run.json'] ?? null;
  const settings = files['settings.json'] ?? null;
  const progress = profile && typeof profile === 'object' && !Array.isArray(profile)
    ? (profile as Record<string, unknown>)['permanentProgress']
    : null;
  const level = progress && typeof progress === 'object' ? (progress as Record<string, unknown>)['level'] : null;
  const renown = progress && typeof progress === 'object' ? (progress as Record<string, unknown>)['renown'] : null;
  return {
    profile,
    run,
    settings,
    sourceVersion,
    progress:
      typeof level === 'number' && typeof renown === 'number' ? { level, renown } : null,
  };
}

export function commitPlanFor(preview: ImportPreview): ImportCommitPlan {
  const replaces: ('profile' | 'run' | 'settings')[] = [];
  if (preview.profile) replaces.push('profile');
  if (preview.run) replaces.push('run');
  if (preview.settings) replaces.push('settings');
  if (replaces.length === 0) throw new SaveError('EMPTY_IMPORT');
  return { replaces, finalCommitId: 1 };
}
