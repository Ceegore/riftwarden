import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * @param {string} file
 * @returns {Promise<string>}
 */
export async function sha256File(file) {
  const hash = createHash('sha256');
  hash.update(await readFile(file));
  return hash.digest('hex');
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = /** @type {Record<string, unknown>} */ (value);
    return `{${Object.keys(record).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * @param {string} root
 * @param {{ excludedNames?: string[] }} [options]
 * @returns {Promise<string[]>}
 */
export async function walkFiles(root, options = {}) {
  const excluded = new Set(options.excludedNames ?? ['.git', 'node_modules']);
  /** @type {string[]} */
  const files = [];
  /**
   * @param {string} current
   * @returns {Promise<void>}
   */
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (excluded.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (entry.isFile()) files.push(full);
    }
  }
  const info = await stat(root);
  if (info.isFile()) return [root];
  await visit(root);
  return files.sort((a, b) => a.localeCompare(b, 'en'));
}

/**
 * Parses argv-style flags (`--key value`, `--flag`) into an object.
 *
 * Unknown flags become `true`; value flags become strings. Positional
 * arguments are collected under the `_` key.
 *
 * @param {readonly string[]} argv
 * @returns {Record<string, string | string[] | undefined>}
 */
export function parseArgs(argv) {
  /** @type {Record<string, string | string[] | undefined>} */
  const out = { _: /** @type {string[]} */ ([]) };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (!arg.startsWith('--')) { (/** @type {string[]} */ (out._)).push(arg); }
    else {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { out[key] = next; i += 1; }
      else out[key] = undefined;
    }
  }
  return out;
}
