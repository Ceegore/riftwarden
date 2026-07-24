import { readFile } from 'node:fs/promises';
import { parseArgs } from '../lib/fs-utils.mjs';

const args = parseArgs(process.argv.slice(2));
const data = JSON.parse(await readFile(args.input ?? 'artifacts/security/dependencies/pnpm-audit.json', 'utf8'));
const findings = [];
function visit(value, path = '$') {
  if (Array.isArray(value)) value.forEach((v, i) => visit(v, `${path}[${i}]`));
  else if (value && typeof value === 'object') {
    const severity = String(value.severity ?? value.cvss?.severity ?? '').toLowerCase();
    if (['critical', 'high'].includes(severity)) findings.push({ path, severity, id: value.id ?? value.advisoryId ?? value.cve ?? null, title: value.title ?? value.name ?? null });
    for (const [k, v] of Object.entries(value)) visit(v, `${path}.${k}`);
  }
}
visit(data);
console.log(JSON.stringify({ schemaVersion: 1, ok: findings.length === 0, blockingFindings: findings }, null, 2));
if (findings.length) process.exitCode = 1;
