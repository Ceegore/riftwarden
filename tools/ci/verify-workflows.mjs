import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from '../lib/fs-utils.mjs';

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root ?? '.github/workflows');
const pinPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[a-f0-9]{40}$/;
const localPattern = /^\.\//;
const errors = [];
const reports = [];

for (const name of (await readdir(root)).filter((x) => /\.ya?ml$/i.test(x)).sort()) {
  const file = path.join(root, name);
  const text = await readFile(file, 'utf8');
  const lines = text.split(/\n/);
  const fileErrors = [];
  if (/\bpull_request_target\s*:/.test(text)) fileErrors.push('pull_request_target is forbidden');
  if (/continue-on-error\s*:\s*true/.test(text)) fileErrors.push('continue-on-error true is forbidden');
  if (/permissions\s*:\s*write-all/.test(text)) fileErrors.push('write-all permissions are forbidden');
  if (/persist-credentials\s*:\s*true/.test(text)) fileErrors.push('checkout persist-credentials true is forbidden');
  if (/\bsecrets\.[A-Za-z0-9_]+/.test(text) && /pull_request\s*:/.test(text)) fileErrors.push('PR workflow references repository secrets');
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^\s*-?\s*uses:\s*['"]?([^'"\s]+)['"]?\s*(?:#.*)?$/);
    if (!match) continue;
    const ref = match[1];
    if (!localPattern.test(ref) && !pinPattern.test(ref)) fileErrors.push(`line ${i + 1}: action is not pinned to full SHA: ${ref}`);
  }
  if (!/^permissions:\s*$/m.test(text)) fileErrors.push('top-level explicit permissions block missing');
  reports.push({ file: name, errors: fileErrors });
  errors.push(...fileErrors.map((e) => `${name}: ${e}`));
}

const result = { schemaVersion: 1, root, reports, ok: errors.length === 0, errors };
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
