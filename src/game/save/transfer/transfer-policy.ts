import { SaveError } from '../save-error.js';

export const TRANSFER_EXTENSION = '.riftwarden-save';
export const DIAGNOSTIC_EXTENSION = '.riftwarden-diagnostic';
export const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
export const MAX_ENTRY_BYTES = 8 * 1024 * 1024;
export const MAX_COMPRESSION_RATIO = 200;

const KNOWN_ROOT_FILES: readonly string[] = ['manifest.json', 'profile.json', 'run.json', 'settings.json'];

export interface EntryMeta {
  readonly name: string;
  readonly size: number;
  readonly compressedSize: number;
  readonly isLink: boolean;
}

/**
 * Validates a transfer container entry list. Only known root files are
 * allowed; path segments (slash/backslash), dot-dot, absolute paths, hidden
 * files, links, duplicates, oversized entries, oversized totals and
 * compression bombs are hard errors.
 */
export function validateEntries(entries: readonly EntryMeta[]): void {
  let total = 0;
  const names = new Set<string>();
  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.size) || entry.size < 0) throw new SaveError('INVALID_ARGUMENT', { field: 'size' });
    if (entry.name.includes('/') || entry.name.includes('\\') || entry.name.includes('..')) {
      throw new SaveError('INVALID_ENTRY_NAME', { name: entry.name });
    }
    if (entry.name.startsWith('.')) throw new SaveError('INVALID_ENTRY_NAME', { name: entry.name });
    if (entry.name.startsWith('/') || entry.name.includes(':') || entry.name.includes('\0')) {
      throw new SaveError('INVALID_ENTRY_NAME', { name: entry.name });
    }
    if (!KNOWN_ROOT_FILES.includes(entry.name)) throw new SaveError('INVALID_ENTRY_NAME', { name: entry.name });
    if (entry.isLink) throw new SaveError('LINK_FORBIDDEN', { name: entry.name });
    if (names.has(entry.name)) throw new SaveError('DUPLICATE_ENTRY', { name: entry.name });
    names.add(entry.name);
    if (entry.size > MAX_ENTRY_BYTES) throw new SaveError('ENTRY_TOO_LARGE', { name: entry.name });
    if (entry.compressedSize > 0 && entry.size / entry.compressedSize > MAX_COMPRESSION_RATIO) {
      throw new SaveError('BOMB_RATIO', { name: entry.name });
    }
    total += entry.size;
  }
  if (total > MAX_TOTAL_BYTES) throw new SaveError('TOTAL_TOO_LARGE', { total });
}

export function isKnownRootFile(name: string): boolean {
  return KNOWN_ROOT_FILES.includes(name);
}
