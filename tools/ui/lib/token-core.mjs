import { canonicalJson } from './canonical-json.mjs';
import { contrastRatio } from './contrast.mjs';

const ALLOWED = new Set(['color', 'radius', 'space', 'z', 'motion', 'safe-area', 'content', 'shadow', 'focus', 'border']);
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX = /^#[0-9A-F]{6}$/;

function codedError(code, message) {
  return Object.assign(new Error(message), { code });
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function flattenTokens(source) {
  if (!isRecord(source) || source.schemaVersion !== 1 || !isRecord(source.tokens)) {
    throw codedError('P07_TOKEN_JSON_INVALID', 'Token source must contain schemaVersion 1 and a tokens object');
  }
  const rows = [];
  for (const category of Object.keys(source.tokens).sort()) {
    if (!ALLOWED.has(category)) throw codedError('P07_TOKEN_UNKNOWN_CATEGORY', `Unknown token category ${category}`);
    if (!isRecord(source.tokens[category])) throw codedError('P07_TOKEN_JSON_INVALID', `Token category ${category} must be an object`);
    for (const name of Object.keys(source.tokens[category]).sort()) {
      if (!NAME.test(name)) throw codedError('P07_TOKEN_NAME_INVALID', `Invalid token name ${category}.${name}`);
      const leaf = source.tokens[category][name];
      if (!isRecord(leaf)) throw codedError('P07_TOKEN_JSON_INVALID', `Token leaf ${category}.${name} must be an object`);
      rows.push({ path: `${category}.${name}`, category, name, ...leaf });
    }
  }
  return rows;
}

export function tokenValue(leaf) {
  if (leaf.value === null || leaf.value === undefined) return null;
  return leaf.unit ? `${leaf.value}${leaf.unit}` : String(leaf.value);
}

function validateLeaf(row, diagnostics) {
  if (!['approved', 'required'].includes(row.approvalStatus)) {
    diagnostics.push({ code: 'P07_TOKEN_UNAPPROVED_VALUE', path: row.path, message: 'Unknown approvalStatus' });
  }
  if (typeof row.source !== 'string' || row.source.length === 0) {
    diagnostics.push({ code: 'P07_TOKEN_JSON_INVALID', path: row.path, message: 'Missing authority source' });
  }
  if (row.approvalStatus === 'required' || row.value === null) {
    diagnostics.push({ code: 'P07_TOKEN_UNAPPROVED_VALUE', path: row.path, message: `Approval required (${row.blockerId ?? 'no blocker id'})` });
    return;
  }
  if (row.kind === 'color') {
    if (typeof row.value !== 'string' || !HEX.test(row.value) || row.unit !== undefined) {
      diagnostics.push({ code: 'P07_TOKEN_VALUE_INVALID', path: row.path, message: 'Color must be uppercase six-digit hex without unit' });
    }
    return;
  }
  if (row.kind === 'length' || row.kind === 'duration') {
    const expected = row.kind === 'length' ? 'px' : 'ms';
    if (!Number.isFinite(row.value) || row.value < 0) {
      diagnostics.push({ code: 'P07_TOKEN_VALUE_INVALID', path: row.path, message: `${row.kind} value must be a finite non-negative number` });
    }
    if (row.unit !== expected) {
      diagnostics.push({ code: 'P07_TOKEN_UNIT_INVALID', path: row.path, message: `${row.kind} unit must be ${expected}` });
    }
    return;
  }
  if (row.kind === 'integer') {
    if (!Number.isInteger(row.value) || row.unit !== undefined) {
      diagnostics.push({ code: 'P07_TOKEN_VALUE_INVALID', path: row.path, message: 'Integer token must be an integer without unit' });
    }
    return;
  }
  if (row.kind === 'shadow') {
    if (typeof row.value !== 'string' || row.value.trim().length === 0 || row.unit !== undefined) {
      diagnostics.push({ code: 'P07_TOKEN_VALUE_INVALID', path: row.path, message: 'Approved shadow must be a non-empty CSS shadow string without unit' });
    }
    return;
  }
  diagnostics.push({ code: 'P07_TOKEN_VALUE_INVALID', path: row.path, message: `Unknown token kind ${String(row.kind)}` });
}

export function validateTokenSource(source, { mode = 'structure' } = {}) {
  const diagnostics = [];
  const rows = flattenTokens(source);
  const map = new Map(rows.map((row) => [row.path, row]));
  for (const row of rows) validateLeaf(row, diagnostics);
  if (source.contrastPairs !== undefined && !Array.isArray(source.contrastPairs)) {
    diagnostics.push({ code: 'P07_TOKEN_JSON_INVALID', path: 'contrastPairs', message: 'contrastPairs must be an array' });
  }
  for (const pair of source.contrastPairs ?? []) {
    const fg = map.get(pair.foreground);
    const bg = map.get(pair.background);
    if (!fg || !bg || fg.kind !== 'color' || bg.kind !== 'color' || !Number.isFinite(pair.minimum)) {
      diagnostics.push({ code: 'P07_CONTRAST_BELOW_MINIMUM', path: pair.id ?? '<missing>', message: 'Invalid contrast pair or token reference' });
      continue;
    }
    const ratio = contrastRatio(fg.value, bg.value);
    if (ratio + 1e-9 < pair.minimum) {
      diagnostics.push({ code: 'P07_CONTRAST_BELOW_MINIMUM', path: pair.id, message: `${ratio.toFixed(3)} < ${pair.minimum}` });
    }
  }
  const blocking = mode === 'release'
    ? diagnostics
    : diagnostics.filter((diagnostic) => diagnostic.code !== 'P07_TOKEN_UNAPPROVED_VALUE');
  return { mode, tokenCount: rows.length, diagnostics, blocking, ok: blocking.length === 0 };
}

function cssName(path) {
  return `--rw-${path.replaceAll('.', '-')}`;
}

export function generateCss(source) {
  const rows = flattenTokens(source);
  const approved = rows.filter((row) => row.approvalStatus === 'approved' && row.value !== null);
  const blocked = rows.filter((row) => row.approvalStatus !== 'approved' || row.value === null);
  const lines = ['/* GENERATED. DO NOT EDIT. */', ':root {'];
  for (const row of approved) lines.push(`  ${cssName(row.path)}: ${tokenValue(row)};`);
  for (const row of blocked) lines.push(`  /* BLOCKED ${row.path}: ${row.blockerId ?? 'approval required'} */`);
  lines.push('}', '');
  return lines.join('\n');
}

export function generateTs(source) {
  const rows = flattenTokens(source);
  const approved = Object.fromEntries(rows
    .filter((row) => row.approvalStatus === 'approved' && row.value !== null)
    .map((row) => [row.path, tokenValue(row)]));
  const blockers = rows
    .filter((row) => row.approvalStatus !== 'approved' || row.value === null)
    .map((row) => ({ path: row.path, blockerId: row.blockerId ?? 'APPROVAL_REQUIRED' }));
  return `// GENERATED. DO NOT EDIT.\nexport const uiTokens = ${canonicalJson(approved).trim()} as const;\nexport const uiTokenBlockers = ${canonicalJson(blockers).trim()} as const;\nexport type UiTokenPath = keyof typeof uiTokens;\n`;
}
