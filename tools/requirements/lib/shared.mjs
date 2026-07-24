import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

export const CATEGORIES = [
  'Product', 'Content', 'Sim', 'UX', 'Save', 'A11y', 'Perf',
  'Security', 'Android', 'iOS', 'Store', 'QA',
];

export const REQUIREMENT_STATUSES = [
  'planned', 'implemented', 'verified', 'blocked', 'deferred_by_spec',
];

export const NORMS = ['MUST', 'MUST_NOT', 'SHOULD', 'MAY'];

export const ID_PATTERNS = Object.freeze({
  requirement: /^REQ-(PRODUCT|CONTENT|SIM|UX|SAVE|A11Y|PERF|SECURITY|ANDROID|IOS|STORE|QA)-\d{4}$/,
  test: /^(UT|PT|GR|IT|E2E|VIS|NAT-A|NAT-I|FQA|SEC|PERF)-[A-Z0-9]+(?:-[A-Z0-9]+)*-\d{3}$/,
  adr: /^ADR-\d{4}$/,
  defect: /^DEFECT-(P0|P1|P2|P3)-\d{4}$/,
  external: /^EXT-[A-Z0-9]+(?:-[A-Z0-9]+)*-\d{3}$/,
  normalization: /^NORM-\d{3}$/,
  phase: /^PHASE-(?:0\d|[1-4]\d)$/,
  gate: /^G(?:0\d|[1-4]\d)$/,
  screen: /^(?:S(?:0\d|[1-5]\d|6[0-5])|O0[1-7])$/,
});

/**
 * @typedef {Object} Issue
 * @property {'error'|'warning'|'info'} severity
 * @property {string} code
 * @property {string} message
 * @property {*} path
 * @property {*} details
 */

/**
 * Builds a structured validation issue record.
 * @param {'error'|'warning'|'info'} severity One of error/warning/info.
 * @param {string} code Stable issue code.
 * @param {string} message Human-readable message.
 * @param {*} [path] Optional JSON path of the offending value.
 * @param {*} [details] Optional structured details.
 * @returns {Issue}
 */
export function issue(severity, code, message, path = null, details = null) {
  return { severity, code, message, path, details };
}

/**
 * Returns true when value is a non-array, non-null object.
 * @param {*} value
 * @returns {boolean}
 */
export function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Resolves filePath under root, throwing if it escapes root.
 * @param {string} root Repository root.
 * @param {string} filePath Repository-relative path.
 * @returns {string}
 */
export function assertInsideRoot(root, filePath) {
  const absoluteRoot = resolve(root);
  const absolutePath = resolve(root, filePath);
  const prefix = absoluteRoot.endsWith(sep) ? absoluteRoot : `${absoluteRoot}${sep}`;
  if (absolutePath !== absoluteRoot && !absolutePath.startsWith(prefix)) {
    throw new Error(`Path escapes repository root: ${filePath}`);
  }
  return absolutePath;
}

/**
 * Reads an indexed collection (inline array or files[] manifest).
 * @param {string} root Repository root.
 * @param {string} filePath Repository-relative path.
 * @param {string} arrayKey Key holding the items array.
 * @returns {Promise<{payload: *, items: *[], files: string[]}>}
 */
export async function readIndexedCollection(root, filePath, arrayKey) {
  const payload = await readJson(root, filePath);
  if (Array.isArray(payload?.[arrayKey])) {
    return { payload, items: payload[arrayKey], files: [filePath] };
  }
  if (!Array.isArray(payload?.files) || payload.files.length === 0) {
    throw new Error(`${filePath} must contain ${arrayKey} or a non-empty files array.`);
  }
  const items = [];
  const files = [];
  for (const childPath of payload.files) {
    if (typeof childPath !== 'string') throw new Error(`${filePath} contains a non-string child path.`);
    const child = await readJson(root, childPath);
    if (!Array.isArray(child?.[arrayKey])) throw new Error(`${childPath} must contain an ${arrayKey} array.`);
    items.push(...child[arrayKey]);
    files.push(childPath);
  }
  return { payload, items, files };
}

/**
 * Reads and parses a JSON file under root.
 * @param {string} root Repository root.
 * @param {string} filePath Repository-relative path.
 * @returns {Promise<*>}
 */
export async function readJson(root, filePath) {
  const absolutePath = assertInsideRoot(root, filePath);
  const raw = await readFile(absolutePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (/** @type {*} */ error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
  }
}

/**
 * Returns true when the file exists under root.
 * @param {string} root Repository root.
 * @param {string} filePath Repository-relative path.
 * @returns {Promise<boolean>}
 */
export async function fileExists(root, filePath) {
  try {
    await stat(assertInsideRoot(root, filePath));
    return true;
  } catch (/** @type {*} */ error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

/**
 * Returns the byte size of a file under root.
 * @param {string} root Repository root.
 * @param {string} filePath Repository-relative path.
 * @returns {Promise<number>}
 */
export async function fileSize(root, filePath) {
  const metadata = await stat(assertInsideRoot(root, filePath));
  return metadata.size;
}

/**
 * Computes the sha256 hex digest of a file under root.
 * @param {string} root Repository root.
 * @param {string} filePath Repository-relative path.
 * @returns {Promise<string>}
 */
export async function sha256File(root, filePath) {
  const absolutePath = assertInsideRoot(root, filePath);
  const data = await readFile(absolutePath);
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Computes the sha256 hex digest of a UTF-8 string.
 * @param {string} text Input text.
 * @returns {string}
 */
export function sha256Text(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Recursively sorts object keys for deterministic serialization.
 * @param {*} value
 * @returns {*}
 */
export function stableSortObject(value) {
  if (Array.isArray(value)) return value.map(stableSortObject);
  if (!isObject(value)) return value;
  /** @type {Record<string, *>} */
  const out = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = stableSortObject(value[key]);
  }
  return out;
}

/**
 * Serializes value to stable JSON text.
 * @param {*} value
 * @returns {string}
 */
export function stableJson(value) {
  return `${JSON.stringify(stableSortObject(value), null, 2)}\n`;
}

/**
 * Returns the sorted duplicate entries from values.
 * @param {*[]} values Values to check for duplicates.
 * @returns {string[]}
 */
export function duplicates(values) {
  const seen = new Set();
  const dupes = new Set();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return [...dupes].sort();
}

/**
 * Normalizes a requirement statement for duplicate comparison.
 * @param {*} value
 * @returns {string}
 */
export function normalizedStatement(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\u00a0]+/g, ' ')
    .replace(/[.!?;:,]+$/g, '')
    .trim();
}

/**
 * Pushes an error when value is not a non-empty string.
 * @param {Issue[]} issues Issue accumulator.
 * @param {*} value Value to test.
 * @param {string} path JSON path of the value.
 * @param {string} code Stable issue code.
 * @returns {boolean}
 */
export function pushRequiredString(issues, value, path, code) {
  if (typeof value !== 'string' || value.trim() === '') {
    issues.push(issue('error', code, 'Required non-empty string is missing.', path));
    return false;
  }
  return true;
}

/**
 * Pushes an error when value is not one of allowed.
 * @param {Issue[]} issues Issue accumulator.
 * @param {*} value Value to test.
 * @param {ReadonlyArray<*>} allowed Allowed values.
 * @param {string} path JSON path of the value.
 * @param {string} code Stable issue code.
 * @returns {boolean}
 */
export function pushEnum(issues, value, allowed, path, code) {
  if (!allowed.includes(value)) {
    issues.push(issue('error', code, `Expected one of: ${allowed.join(', ')}.`, path, { actual: value }));
    return false;
  }
  return true;
}

/**
 * Pushes an error when value does not match pattern.
 * @param {Issue[]} issues Issue accumulator.
 * @param {*} value Value to test.
 * @param {RegExp} pattern Required ID pattern.
 * @param {string} path JSON path of the value.
 * @param {string} code Stable issue code.
 * @returns {boolean}
 */
export function pushId(issues, value, pattern, path, code) {
  if (typeof value !== 'string' || !pattern.test(value)) {
    issues.push(issue('error', code, `ID does not match ${pattern}.`, path, { actual: value }));
    return false;
  }
  return true;
}

/**
 * Parses argv flags --root, --mode, --json, --help.
 * @param {string[]} argv
 * @returns {{root: string, mode: string, json: string|null, help?: boolean}}
 */
export function parseArgs(argv) {
  /** @type {{root: string, mode: string, json: string|null, help?: boolean}} */
  const args = { root: '.', mode: 'draft', json: null };
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === undefined) continue;
    if (current === '--root') args.root = argv[++index] ?? '';
    else if (current.startsWith('--root=')) args.root = current.slice(7);
    else if (current === '--mode') args.mode = argv[++index] ?? '';
    else if (current.startsWith('--mode=')) args.mode = current.slice(7);
    else if (current === '--json') args.json = argv[++index] ?? '';
    else if (current.startsWith('--json=')) args.json = current.slice(7);
    else if (current === '--help' || current === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${current}`);
  }
  if (!['draft', 'gate'].includes(args.mode)) {
    throw new Error(`Invalid --mode ${args.mode}; use draft or gate.`);
  }
  return args;
}

/**
 * Counts issues by severity.
 * @param {Issue[]} issues Issues to summarize.
 * @returns {Record<'error'|'warning'|'info', number>}
 */
export function summarizeIssues(issues) {
  /** @type {Record<'error'|'warning'|'info', number>} */
  const totals = { error: 0, warning: 0, info: 0 };
  for (const item of issues) totals[item.severity] += 1;
  return totals;
}
