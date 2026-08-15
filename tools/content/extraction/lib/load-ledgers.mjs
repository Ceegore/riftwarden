import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function loadJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

/**
 * Loads the ledger index and every family ledger referenced by it.
 *
 * @param {string} indexDir Directory holding content-ledger.index.json plus the family files.
 * @returns {Promise<{ index: any, ledgers: Array<{ family: string, category: string, expectedCount: number, data: any }> }>}
 */
export async function loadLedgers(indexDir = 'docs/reports/content-ledger', { readFile: rf = readFile } = {}) {
  const index = await loadJson(path.join(indexDir, 'content-ledger.index.json'), { readFile: rf });
  const ledgers = [];
  for (const fam of index.families) {
    const data = JSON.parse(await rf(path.join(indexDir, fam.file), 'utf8'));
    ledgers.push({ family: fam.family, category: fam.category, expectedCount: fam.expectedCount, data });
  }
  return { index, ledgers };
}
