import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function loadJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

/**
 * Loads the ledger index and every family ledger referenced by it.
 *
 * Tolerant by design: a missing or unparsable index or family file never
 * crashes the CLI. A missing index yields `{ index: null, indexError }`; a
 * missing/unparsable family yields a `{ data: null, error }` entry. Callers
 * report clean gate diagnostics for both cases.
 *
 * @param {string} indexDir Directory holding content-ledger.index.json plus the family files.
 * @returns {Promise<{ index: any, indexError?: string, ledgers: Array<{ family: string, category: string, expectedCount: number, data: any, error?: string }> }>}
 */
export async function loadLedgers(indexDir = 'docs/reports/content-ledger', { readFile: rf = readFile } = {}) {
  let index;
  let indexError;
  try {
    index = JSON.parse(await rf(path.join(indexDir, 'content-ledger.index.json'), 'utf8'));
  } catch (error) {
    indexError = error.code === 'ENOENT' ? 'missing content-ledger.index.json' : 'unparsable content-ledger.index.json';
  }
  if (!index) return { index: null, indexError, ledgers: [] };

  const ledgers = [];
  for (const fam of index.families ?? []) {
    try {
      const data = JSON.parse(await rf(path.join(indexDir, fam.file), 'utf8'));
      ledgers.push({ family: fam.family, category: fam.category, expectedCount: fam.expectedCount, data });
    } catch (error) {
      ledgers.push({
        family: fam.family,
        category: fam.category,
        expectedCount: fam.expectedCount,
        data: null,
        error: error.code === 'ENOENT' ? `missing ledger file ${fam.file}` : `unparsable ledger file ${fam.file}`
      });
    }
  }
  return { index, ledgers };
}
