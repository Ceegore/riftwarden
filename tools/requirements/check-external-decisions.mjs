#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * @typedef {Object} ParsedArgs
 * @property {string} root
 * @property {string|null} gate
 */

/**
 * Parses argv for --root and --gate flags.
 * @param {string[]} argv Command-line arguments.
 * @returns {ParsedArgs}
 */
function parse(argv) {
  /** @type {ParsedArgs} */
  const args = { root: '.', gate: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === undefined) continue;
    if (value === '--root') args.root = argv[++index] ?? '';
    else if (value.startsWith('--root=')) args.root = value.slice(7);
    else if (value === '--gate') args.gate = argv[++index] ?? '';
    else if (value.startsWith('--gate=')) args.gate = value.slice(7);
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!/^G(?:0\d|[1-4]\d)$/.test(args.gate ?? '')) {
    throw new Error('A valid --gate G00..G49 is required.');
  }
  return args;
}

/**
 * Validates a single external decision value against its rule.
 * @param {any} decision External decision record.
 * @returns {string|null} Problem description, or null when valid.
 */
function validateValue(decision) {
  const value = decision.value;
  const rule = decision.validationRule ?? {};
  if (decision.status !== 'confirmed') return 'status is not confirmed';
  if (value === null || value === undefined || value === '') return 'value is empty';
  if (rule.type === 'not_placeholder') {
    if ((rule.forbiddenValues ?? []).includes(value)) return 'value is a forbidden placeholder';
  } else if (rule.type === 'email') {
    if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'value is not an email';
    const domain = value.split('@').at(-1)?.toLowerCase();
    /** @type {string[]} */
    const forbiddenDomains = (rule.forbiddenDomains ?? []).map(String);
    if (domain && forbiddenDomains.map((entry) => entry.toLowerCase()).includes(domain)) return 'email domain is forbidden';
  } else if (rule.type === 'https_url') {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:') return 'URL is not HTTPS';
      /** @type {string[]} */
      const forbiddenHosts = (rule.forbiddenHosts ?? []).map(String);
      if (forbiddenHosts.map((entry) => entry.toLowerCase()).includes(url.hostname.toLowerCase())) return 'URL host is forbidden';
    } catch {
      return 'value is not a valid URL';
    }
  } else if (rule.type === 'integer_range') {
    if (!Number.isInteger(value) || value < rule.minimum || value > rule.maximum) return 'integer is outside allowed range';
  } else if (rule.type === 'enum') {
    if (!(rule.values ?? []).includes(value)) return 'value is outside allowed enum';
  } else if (rule.type === 'exact_match') {
    if (value !== rule.expected) return `value does not equal ${rule.expected}`;
  } else {
    return `unknown validation rule ${rule.type}`;
  }
  return null;
}

const args = parse(process.argv.slice(2));
const path = resolve(args.root, 'docs/requirements/external-decisions.json');
const payload = JSON.parse(await readFile(path, 'utf8'));
const blockers = [];
for (const decision of payload.decisions ?? []) {
  if (!(decision.blockingGates ?? []).includes(args.gate)) continue;
  const problem = validateValue(decision);
  if (problem) blockers.push({ id: decision.id, key: decision.key, problem });
}
if (blockers.length > 0) {
  for (const blocker of blockers) {
    console.error(`BLOCK ${blocker.id} ${blocker.key}: ${blocker.problem}`);
  }
  console.error(`External decision gate ${args.gate}: BLOCKED (${blockers.length})`);
  process.exitCode = 1;
} else {
  console.log(`External decision gate ${args.gate}: PASS`);
}
