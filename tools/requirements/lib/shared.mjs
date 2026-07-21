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

export function issue(severity, code, message, path = null, details = null) {
  return { severity, code, message, path, details };
}

export function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function assertInsideRoot(root, filePath) {
  const absoluteRoot = resolve(root);
  const absolutePath = resolve(root, filePath);
  const prefix = absoluteRoot.endsWith(sep) ? absoluteRoot : `${absoluteRoot}${sep}`;
  if (absolutePath !== absoluteRoot && !absolutePath.startsWith(prefix)) {
    throw new Error(`Path escapes repository root: ${filePath}`);
  }
  return absolutePath;
}

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

export async function readJson(root, filePath) {
  const absolutePath = assertInsideRoot(root, filePath);
  const raw = await readFile(absolutePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
  }
}

export async function fileExists(root, filePath) {
  try {
    await stat(assertInsideRoot(root, filePath));
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

export async function fileSize(root, filePath) {
  const metadata = await stat(assertInsideRoot(root, filePath));
  return metadata.size;
}

export async function sha256File(root, filePath) {
  const absolutePath = assertInsideRoot(root, filePath);
  const data = await readFile(absolutePath);
  return createHash('sha256').update(data).digest('hex');
}

export function sha256Text(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function stableSortObject(value) {
  if (Array.isArray(value)) return value.map(stableSortObject);
  if (!isObject(value)) return value;
  const out = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = stableSortObject(value[key]);
  }
  return out;
}

export function stableJson(value) {
  return `${JSON.stringify(stableSortObject(value), null, 2)}\n`;
}

export function duplicates(values) {
  const seen = new Set();
  const dupes = new Set();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return [...dupes].sort();
}

export function normalizedStatement(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\u00a0]+/g, ' ')
    .replace(/[.!?;:,]+$/g, '')
    .trim();
}

export function pushRequiredString(issues, value, path, code) {
  if (typeof value !== 'string' || value.trim() === '') {
    issues.push(issue('error', code, 'Required non-empty string is missing.', path));
    return false;
  }
  return true;
}

export function pushEnum(issues, value, allowed, path, code) {
  if (!allowed.includes(value)) {
    issues.push(issue('error', code, `Expected one of: ${allowed.join(', ')}.`, path, { actual: value }));
    return false;
  }
  return true;
}

export function pushId(issues, value, pattern, path, code) {
  if (typeof value !== 'string' || !pattern.test(value)) {
    issues.push(issue('error', code, `ID does not match ${pattern}.`, path, { actual: value }));
    return false;
  }
  return true;
}

export function parseArgs(argv) {
  const args = { root: '.', mode: 'draft', json: null };
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--root') args.root = argv[++index];
    else if (current.startsWith('--root=')) args.root = current.slice(7);
    else if (current === '--mode') args.mode = argv[++index];
    else if (current.startsWith('--mode=')) args.mode = current.slice(7);
    else if (current === '--json') args.json = argv[++index];
    else if (current.startsWith('--json=')) args.json = current.slice(7);
    else if (current === '--help' || current === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${current}`);
  }
  if (!['draft', 'gate'].includes(args.mode)) {
    throw new Error(`Invalid --mode ${args.mode}; use draft or gate.`);
  }
  return args;
}

export function summarizeIssues(issues) {
  const totals = { error: 0, warning: 0, info: 0 };
  for (const item of issues) totals[item.severity] += 1;
  return totals;
}
